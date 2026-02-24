/**
 * PostHog Client-Side Initialization
 *
 * Initializes posthog-js for the entire Next.js application.
 * Using instrumentation-client.ts is the recommended approach for Next.js 15.3+.
 *
 * IMPORTANT: Do NOT combine this with PostHogProvider components — both call
 * posthog.init(), causing duplicate event tracking and race conditions on
 * the shared posthog-js singleton.
 *
 * Events are sent via the /ingest reverse proxy to reduce ad-blocker interference.
 */

import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    // Pin PostHog SDK defaults to this date to prevent behavior changes from SDK updates
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics disabled."
  );
}
