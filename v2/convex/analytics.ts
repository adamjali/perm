/**
 * Server-side analytics capture.
 *
 * Convex actions can reach the network, so server-authoritative events (e.g. a
 * verified signup) are forwarded straight to PostHog's ingestion API. This is more
 * reliable than client capture — it fires exactly once from the source of truth and
 * can't be lost to a closed tab or an ad-blocker — and is the canonical signal for
 * the signup funnel + spike alerting.
 *
 * Best-effort by design: a missing key or a failed request is logged and swallowed.
 * Analytics must never affect (or block) the user-facing flow.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { logWarn } from "./lib/logging";
import { isEmailPostHogExcluded } from "./lib/posthog";

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Forward one event to PostHog from the server.
 *
 * `distinctId` MUST match the client-side identify id (userProfiles._id, used by
 * LoginTracker) so the event attaches to the same PostHog person.
 *
 * Respects POSTHOG_EXCLUDED_EMAILS — internal/admin emails are skipped to preserve
 * quota, mirroring the client-side opt-out in LoginTracker.
 */
export const captureServerEvent = internalAction({
  args: {
    event: v.string(),
    distinctId: v.string(),
    email: v.optional(v.string()),
    properties: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.POSTHOG_PROJECT_KEY;
    if (!apiKey) return; // No key configured (tests / local dev) → no-op.

    // Mirror the client opt-out exactly (domain-aware, shared helper) so the two
    // exclusion rules can never drift.
    if (isEmailPostHogExcluded(args.email, process.env.POSTHOG_EXCLUDED_EMAILS)) return;

    try {
      const res = await fetch(`${POSTHOG_HOST}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          event: args.event,
          distinct_id: args.distinctId,
          properties: { ...(args.properties ?? {}), $lib: "convex-server" },
        }),
      });
      if (!res.ok) {
        logWarn("Analytics", "PostHog server capture returned non-OK", {
          event: args.event,
          status: res.status,
        });
      }
    } catch (error) {
      logWarn("Analytics", "PostHog server capture failed", {
        event: args.event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
