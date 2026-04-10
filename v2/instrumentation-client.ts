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
    before_send: (event) => {
      if (!event) return event;
      if (event.event === "$exception") {
        // Build a single string from all exception message sources for filtering.
        // PostHog stores messages in $exception_message AND/OR $exception_list[].value
        const exList = event.properties?.$exception_list as
          | Array<{ value?: string }>
          | undefined;
        const msg = [
          event.properties?.$exception_message || "",
          ...(exList || []).map((e) => e.value || ""),
        ].join(" ");

        // Stale deployment — normal during deploys, error boundaries reload the page
        if (
          msg.includes("Server Action") &&
          msg.includes("was not found on the server")
        ) {
          return null;
        }
        // Browser extension parsing JSON-LD structured data (not app code)
        if (msg.includes("@context") && msg.includes("toLowerCase")) {
          return null;
        }
        // Browser extension mutating DOM → React reconciler fails (not app code)
        if (
          (msg.includes("insertBefore") || msg.includes("removeChild")) &&
          msg.includes("not a child")
        ) {
          return null;
        }
        // Network/deploy: chunk load failures, timeouts, stale hashes
        if (/ChunkLoadError|Loading chunk.*failed/i.test(msg)) {
          return null;
        }
        if (/^(Load failed|Failed to fetch)$/i.test(msg.trim())) {
          return null;
        }
        // PostHog session recorder internal bugs (not our code)
        if (msg.includes("bufferBelongsToIframe")) {
          return null;
        }
        if (msg.includes("Called on script loaded before session recording is available")) {
          return null;
        }
        // Transient ServiceWorker registration failures (network, page navigation aborts)
        if (/Failed to register a ServiceWorker/i.test(msg)) {
          return null;
        }
        if (/AbortError.*ServiceWorker|ServiceWorker.*aborted|Operation has been aborted/i.test(msg)) {
          return null;
        }
      }
      return event;
    },
  });
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics disabled."
  );
}
