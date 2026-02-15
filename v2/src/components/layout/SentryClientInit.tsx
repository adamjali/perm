"use client";

import { useEffect } from "react";

let sentryInitialized = false;

/**
 * Initializes Sentry client SDK on authenticated pages only.
 * Deferred via requestIdleCallback to avoid blocking TBT.
 *
 * Public pages don't load Sentry at all (sentry.client.config.ts is empty).
 * Server-side Sentry (sentry.server.config.ts) covers all pages.
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

        // Session Replay
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

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

        beforeSend(event) {
          if (event.request?.data) {
            delete event.request.data;
          }
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

      // Lazy-load Session Replay when sampled
      const client = Sentry.getClient();
      if (client) {
        const rate =
          process.env.NODE_ENV === "production" ? 0.1 : 1.0;
        if (Math.random() < rate) {
          Sentry.lazyLoadIntegration("replayIntegration")
            .then((replay) => {
              client.addIntegration(
                replay({ maskAllText: true, blockAllMedia: true })
              );
            })
            .catch(() => {});
        }
      }
    };

    if ("requestIdleCallback" in window) {
      (window as Window).requestIdleCallback(() => init(), { timeout: 5000 });
    } else {
      setTimeout(init, 100);
    }
  }, []);

  return null;
}
