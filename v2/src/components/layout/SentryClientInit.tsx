"use client";

import { useEffect } from "react";
import { isStaleDeploymentError } from "@/components/error/auth-error";

let sentryInitialized = false;

/**
 * Lazily initializes Sentry client SDK.
 * Only loaded in auth/authenticated layouts — public pages get zero Sentry JS.
 *
 * Also installs a global handler for stale deployment errors
 * (UnrecognizedActionError) to prompt users to refresh.
 */
export function SentryClientInit() {
  // Catch stale Server Action errors from deployment mismatches
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (isStaleDeploymentError(event.reason)) {
        event.preventDefault(); // Suppress console noise
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    if (sentryInitialized) return;
    sentryInitialized = true;

    const init = async () => {
      const Sentry = await import("@sentry/nextjs");

      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        enableLogs: true,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        debug: false,
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Failed to fetch",
          "NetworkError",
          "Network request failed",
          "AbortError",
          /^chrome-extension:\/\//,
          /^moz-extension:\/\//,
          "not authenticated",
          "User profile not found",
          // iOS network flake during Convex auth token refresh (mobile suspend/resume)
          "Load failed",
          // Deployment cache mismatch — client has stale Server Action hashes
          "Server Action",
          "UnrecognizedActionError",
          // Browser extension parsing JSON-LD structured data (not app code)
          /@context.*toLowerCase/,
          // Browser extension mutating DOM → React reconciler insertBefore fails
          /insertBefore.*not a child/,
          // Network/deploy: stale chunk hashes, timeouts
          "ChunkLoadError",
          /Loading chunk.*failed/,
          // SW registration abort during page navigation (Serwist fire-and-forget)
          "Rejected",
          /Failed to register a ServiceWorker/,
          // React hydration mismatch from browser extensions injecting DOM
          /Minified React error #418/,
          /Minified React error #423/,
          /Minified React error #425/,
        ],
        tracesSampler: (samplingContext) => {
          if (samplingContext.name?.includes("/api/health")) return 0;
          return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
        },
        beforeSend(event) {
          if (event.request?.data) delete event.request.data;
          if (
            process.env.NODE_ENV === "development" &&
            !process.env.NEXT_PUBLIC_SENTRY_DEBUG
          ) {
            return null;
          }
          return event;
        },
        replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
          Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
        ],
      });

      // Lazy-load Session Replay for all sessions — Sentry SDK internally
      // respects replaysSessionSampleRate/replaysOnErrorSampleRate from init().
      const client = Sentry.getClient();
      if (client) {
        Sentry.lazyLoadIntegration("replayIntegration")
          .then((replay) => {
            client.addIntegration(
              replay({ maskAllText: true, blockAllMedia: true })
            );
          })
          .catch((err) => {
            // Replay is non-critical, but log so we know if it's broken
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Sentry] Session Replay failed to load:', err);
            }
            Sentry.addBreadcrumb({
              category: 'sentry.init',
              message: 'Session Replay failed to load',
              level: 'warning',
              data: { error: err instanceof Error ? err.message : String(err) },
            });
          });
      }
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => { init().catch(console.error); }, { timeout: 5000 });
    } else {
      setTimeout(() => { init().catch(console.error); }, 100);
    }
  }, []);

  return null;
}
