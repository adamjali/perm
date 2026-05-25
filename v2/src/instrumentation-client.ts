/**
 * Next.js client-side instrumentation — runs once, before the app hydrates.
 *
 * Next.js loads exactly ONE `instrumentation-client` file, and because this app
 * lives under `src/`, it must be THIS file (`src/instrumentation-client.ts`);
 * a root-level `instrumentation-client.ts` is silently ignored. Both PostHog
 * and Vercel BotID need to initialize here, so they live together in this one
 * file. (Splitting them across two files drops whichever one isn't here — that
 * is exactly the regression that took PostHog analytics offline once BotID
 * added its own `src/instrumentation-client.ts`.)
 *
 * Each initializer is wrapped in its own try/catch so a failure in one never
 * prevents the other from running or breaks the client module's side-effect
 * import.
 */

import posthog from "posthog-js";
import { initBotId } from "botid/client/core";

// ---------------------------------------------------------------------------
// PostHog — product analytics + client exception capture.
// Events are sent via the /ingest reverse proxy (next.config.ts rewrites) to
// reduce ad-blocker interference.
// ---------------------------------------------------------------------------
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  try {
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
  } catch (error) {
    // Privacy-mode browsers (storage blocked) or strict CSP can throw on init.
    // Swallow so analytics failure never breaks the client module import.
    console.warn(
      "[instrumentation-client] PostHog init failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics disabled."
  );
}

// ---------------------------------------------------------------------------
// Vercel BotID — passively collects browser/TLS/interaction signals on every
// page load. The server-side checkBotId() call in each protected route's
// handler verifies the caller had a real browser.
//
// Direct-API attackers (curl, bare fetch, scripts without a real browser
// loading this file) never collect signals, so checkBotId() returns
// isBot=true and the route returns 403 before any work is done.
//
// Every path listed here MUST have a matching server-side checkBotId() call,
// otherwise the collected signals go unconsumed and the entry is dead config
// that implies a protection that isn't enforced.
//
// NOTE: /api/auth is intentionally NOT protected by BotID. That route is owned
// by @convex-dev/auth's proxy (src/proxy.ts) and has no route handler we can
// add checkBotId() to. checkBotId() also relies on @vercel/request-context /
// next/headers and throws on its response-header mutation path outside a real
// route handler, so it can't run cleanly in the auth middleware. Auth is
// instead guarded by Cloudflare Turnstile + per-IP + per-email rate limits +
// server-side name validation (see docs/SECURITY.md). Listing "/api/auth/*"
// here was a no-op (nothing consumed the signals), so it's removed.
// ---------------------------------------------------------------------------
try {
  initBotId({
    protect: [
      // AI chat — biggest AI-cost protection target. One abusive burst can
      // burn through Gemini/OpenRouter/Mistral/Groq/Cerebras free-tier
      // quotas in minutes. Enforced by checkBotId() in src/app/api/chat/route.ts.
      { path: "/api/chat", method: "POST" },
    ],
  });
} catch (error) {
  // Don't crash the client bundle if BotID init fails. The server-side
  // checkBotId() call will treat the request as unverifiable (isBot=true)
  // and reject it — which is the correct behavior on init failure anyway.
  console.warn(
    "[instrumentation-client] BotID init failed:",
    error instanceof Error ? error.message : String(error),
  );
}
