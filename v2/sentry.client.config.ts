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

  // Performance monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay for debugging user sessions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

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
      // Debug logging when dev events are dropped
      console.debug(
        "[Sentry] Would have sent:",
        event.event_id,
        event.message || event.exception?.values?.[0]?.value
      );
      return null;
    }

    return event;
  },

  // Add replay integration for session recording
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content by default for privacy
      maskAllText: true,
      // Block all media (images, videos) by default
      blockAllMedia: true,
    }),
  ],
});
