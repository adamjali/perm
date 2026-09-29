/**
 * Sentry Server-Side Configuration
 *
 * Initializes Sentry for server-side error tracking.
 * This file is loaded by the instrumentation hook when running on the server.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

import { createSentryBudget } from "./src/lib/sentryBudget";

// A per-process ceiling on what reaches Sentry in an hour (src/lib/sentryBudget.ts):
// far above a normal day, so a storm cannot spend the monthly allowance.
const budget = createSentryBudget();

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

  // Filter out noisy errors
  ignoreErrors: [
    // Next.js internal errors that are not actionable
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],


  beforeSend: (event) => budget.error(event),
  beforeSendLog: (log) => budget.log(log),

  integrations: [
    // Forward console.warn and console.error to Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
});
