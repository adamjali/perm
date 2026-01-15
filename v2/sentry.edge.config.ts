/**
 * Sentry Edge Runtime Configuration
 *
 * Initializes Sentry for edge runtime (middleware, edge routes).
 * This file is loaded by the instrumentation hook when running on the edge.
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
