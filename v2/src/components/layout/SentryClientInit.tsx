"use client";

import { useEffect } from "react";

let sentryInitialized = false;

/**
 * Lazily initializes Sentry client SDK.
 * Only loaded in auth/authenticated layouts — public pages get zero Sentry JS.
 */
export function SentryClientInit() {
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
        integrations: [
          Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
        ],
      });

      // Lazy-load Session Replay only when sampled
      const client = Sentry.getClient();
      if (client) {
        const replaySampleRate =
          process.env.NODE_ENV === "production" ? 0.1 : 1.0;
        if (Math.random() < replaySampleRate) {
          Sentry.lazyLoadIntegration("replayIntegration")
            .then((replay) => {
              client.addIntegration(
                replay({ maskAllText: true, blockAllMedia: true })
              );
            })
            .catch(() => {
              /* ad-blockers may block this */
            });
        }
      }
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => init(), { timeout: 5000 });
    } else {
      setTimeout(init, 100);
    }
  }, []);

  return null;
}
