/**
 * Sentry Server-Side Configuration
 *
 * Initializes Sentry for server-side error tracking.
 * This file is loaded by the instrumentation hook when running on the server.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Environment and release tracking
  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Performance monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Filter out noisy errors
  ignoreErrors: [
    // Next.js internal errors that are not actionable
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // Don't send events in development unless explicitly enabled
  beforeSend(event) {
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.SENTRY_DEBUG
    ) {
      return null;
    }
    return event;
  },
});
