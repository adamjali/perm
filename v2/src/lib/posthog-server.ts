/**
 * PostHog Server-Side Client
 *
 * Provides a singleton PostHog Node.js client for server-side event capture
 * (API routes, Server Actions, etc.).
 *
 * Configured with flushAt=1 and flushInterval=0 so events are sent
 * immediately, required for short-lived Next.js server functions.
 *
 * Returns null if NEXT_PUBLIC_POSTHOG_KEY is not set, so callers should
 * use optional chaining: getPostHogClient()?.capture(...)
 */

import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;
let warnedMissingKey = false;

export function getPostHogClient(): PostHog | null {
  if (!posthogClient) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      if (!warnedMissingKey) {
        console.warn("[PostHog Server] NEXT_PUBLIC_POSTHOG_KEY not set. Server analytics disabled.");
        warnedMissingKey = true;
      }
      return null;
    }
    posthogClient = new PostHog(key, {
      // Server-side uses the direct PostHog host, not the /ingest reverse
      // proxy (which is for browser ad-blocker avoidance only)
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
