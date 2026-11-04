"use client";

import { useEffect } from "react";
import { isStaleDeploymentError } from "@/components/error/auth-error";
import { sentryEventFromInjectedPageScript } from "@/lib/exceptionNoise";
import { CLIENT_IGNORE_ERRORS } from "@/lib/sentryIgnore";
import { redactBrowserEvent } from "@/lib/sentryRedact";

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
    // Only the live site reports. A dev server or a local production build
    // (audits) runs on another host, and every error there used to arrive as
    // a new issue and an email.
    if (window.location.hostname !== "permtracker.app") return;

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
        // Anchored patterns only: a bare string matches anywhere in a message (src/lib/sentryIgnore.ts).
        ignoreErrors: CLIENT_IGNORE_ERRORS,
        // Code that isn't ours, identified by where it runs: a script some
        // extension or tool injects as executors/<n>.js (Sentry 43).
        denyUrls: [/executors\/\d+\.js/, /extensions\//, /^safari-(web-)?extension:/],
        tracesSampler: (samplingContext) => {
          if (samplingContext.name?.includes("/api/health")) return 0;
          return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
        },
        beforeSend(event) {
          // Chrome for iPhone's own Translate and form scripts, filed under the
          // page's address (Sentry 5E): the same rule PostHog applies.
          if (sentryEventFromInjectedPageScript(event, navigator.userAgent)) return null;
          if (event.request?.data) delete event.request.data;
          if (
            process.env.NODE_ENV === "development" &&
            !process.env.NEXT_PUBLIC_SENTRY_DEBUG
          ) {
            return null;
          }
          // No email address goes to Sentry, from the user or from any message (src/lib/sentryRedact.ts).
          return redactBrowserEvent(event);
        },
        // NO SESSION REPLAY. PostHog records the authenticated app (masked)
        // via AppSessionReplay; two replay products recording the same
        // sessions would be pure duplication and double the replay
        // main-thread cost. Sentry stays for what it is better at here, the
        // explicit captureError() calls throughout the app and its console
        // integration, while PostHog owns replay and analytics.
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
