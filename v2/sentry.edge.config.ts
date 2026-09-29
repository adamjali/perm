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

  // Only the live server reports: it is the one place SENTRY_ENVIRONMENT is
  // set (production.env on the Oracle server). A dev server, or a local
  // production build run for audits, sends nothing, so a half-saved file on a
  // laptop never becomes a new issue and an email (Sep 29 2026: every new
  // issue in two days came from development or the old staging server).
  enabled: Boolean(process.env.SENTRY_ENVIRONMENT),
  environment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Structured logging
  enableLogs: true,

  // Performance monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Debug mode (very noisy — only enable when troubleshooting Sentry itself)
  debug: false,

});
