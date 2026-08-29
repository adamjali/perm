"use client";

import { useEffect } from "react";
import { isStaleDeploymentError } from "@/components/error/auth-error";

let sentryInitialized = false;

/**
 * Lazily initializes Sentry client SDK.
 * Only loaded in auth/authenticated layouts, public pages get zero Sentry JS.
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
        // No tracesSampleRate: tracing is tree-shaken out of the bundle
        // (bundleSizeOptimizations.excludeTracing in next.config.ts), so a
        // sample rate has no pipeline to configure. This SDK is errors-only.
        // Performance/web-vitals live in PostHog (instrumentation-client.ts).
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
          // Browser extension mutating DOM → React reconciler insertBefore/removeChild fails
          /insertBefore.*not a child/,
          /removeChild.*not a child/,
          // Network/deploy: stale chunk hashes, timeouts
          "ChunkLoadError",
          /Loading chunk.*failed/,
          // SW registration abort during page navigation (Serwist fire-and-forget)
          "Rejected",
          /Failed to register a ServiceWorker/,
          /Operation has been aborted/,
          // PostHog session recorder internal bugs (not our code)
          /bufferBelongsToIframe/,
          /Called on script loaded before session recording is available/,
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
        // SESSION REPLAY REMOVED 2026-08-29. PostHog records the authenticated
        // app (masked) via AppSessionReplay; two replay products recording the
        // same sessions was pure duplication and double the rrweb/replay
        // main-thread cost. Sentry stays for what it is better at here — the
        // explicit captureError() calls throughout the app and its console
        // integration — while PostHog owns replay and analytics.
        integrations: [
          Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
        ],
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => { init().catch(console.error); }, { timeout: 5000 });
    } else {
      setTimeout(() => { init().catch(console.error); }, 100);
    }
  }, []);

  return null;
}
