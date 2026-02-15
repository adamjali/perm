/**
 * Sentry Client-Side Configuration
 *
 * Initializes Sentry for client-side error tracking and performance monitoring.
 * This file is automatically loaded by the @sentry/nextjs webpack plugin
 * when building the client bundle (NOT by instrumentation hook).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment and release tracking
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Structured logging
  enableLogs: true,

  // Performance monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay for debugging user sessions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Debug mode (very noisy — only enable when troubleshooting Sentry itself)
  debug: false,

  // Filter out noisy, non-actionable errors
  ignoreErrors: [
    // Browser-specific noise
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Network errors (usually user connectivity issues)
    "Failed to fetch",
    "NetworkError",
    "Network request failed",
    // User-initiated cancellations
    "AbortError",
    // Extension/plugin interference
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Auth/session expiry (expected, not bugs — handled gracefully by error boundaries)
    "not authenticated",
    "User profile not found",
  ],

  // Filter transactions for performance monitoring
  tracesSampler: (samplingContext) => {
    // Don't trace health check routes
    if (samplingContext.name?.includes("/api/health")) {
      return 0;
    }
    // Use default sample rate for everything else
    return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
  },

  // Scrub sensitive data before sending
  beforeSend(event) {
    // Remove any PII from request data
    if (event.request?.data) {
      delete event.request.data;
    }

    // Don't send events in development unless explicitly enabled
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.NEXT_PUBLIC_SENTRY_DEBUG
    ) {
      console.debug(
        "[Sentry] Would have sent:",
        event.event_id,
        event.message || event.exception?.values?.[0]?.value
      );
      return null;
    }

    return event;
  },

  integrations: [
    // Forward console.warn and console.error to Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    // Session Replay loaded lazily below to reduce initial bundle size (~50-70 KiB)
  ],
});

// Lazy-load Session Replay only when sampled (saves ~50-70 KiB from shared bundle)
if (typeof window !== "undefined") {
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
          // Ad-blockers may block Sentry CDN — silently ignore
        });
    }
  }
}
