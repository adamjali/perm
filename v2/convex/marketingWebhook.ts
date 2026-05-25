/**
 * Resend Contact Webhook Event Recorder
 *
 * Records contact lifecycle events into the `marketingEvents` table as an
 * append-only audit trail. Resend remains the source of truth for current
 * subscription status. Supported event types:
 *   - contact.created / contact.updated / contact.deleted (live webhook)
 *   - contact.backfill (synthetic — see marketingEmail.backfillMarketingEvents)
 *
 * Two callers:
 *   1. `convex/http.ts` — live webhook, after svix signature verification.
 *      svixId is the real `svix-id` request header.
 *   2. `convex/marketingEmail.ts` — one-off backfill of historical Resend
 *      state. NOT svix-verified (it reads directly from the Resend API), and
 *      uses a synthetic svixId of `backfill_<contactId>`.
 *
 * Idempotent: deduped on `svixId`. Resend retries on non-2xx and redelivers
 * the same `svix-id`, so retry is safe (no duplicate rows). The backfill's
 * `backfill_<contactId>` svixId is stable per contact, making reruns a no-op.
 *
 * @module convex/marketingWebhook
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Single source of truth for the `marketingEvents.eventType` closed set.
 *
 * `LIVE_CONTACT_EVENT_TYPES` are the three event types Resend delivers over the
 * webhook; `contact.backfill` is synthetic (added by
 * `marketingEmail.backfillMarketingEvents`). The validator below is reused by
 * `convex/schema.ts` (table validator) and this mutation's args, and the
 * `http.ts` webhook narrows untrusted `body.type` against
 * `LIVE_CONTACT_EVENT_TYPES` via `isLiveContactEventType` — all derived from
 * this one declaration so the set can never drift across the three sites.
 */
export const LIVE_CONTACT_EVENT_TYPES = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
] as const;

export const contactEventTypeValidator = v.union(
  ...LIVE_CONTACT_EVENT_TYPES.map((t) => v.literal(t)),
  v.literal("contact.backfill"),
);

/** All event types accepted by the table (live deliveries + synthetic backfill). */
export type ContactEventType = Infer<typeof contactEventTypeValidator>;

/** Event types deliverable by the live Resend webhook (excludes synthetic backfill). */
export type LiveContactEventType = (typeof LIVE_CONTACT_EVENT_TYPES)[number];

/**
 * Type guard narrowing untrusted webhook `body.type` to a live contact event.
 * Backfill is excluded — it can only originate server-side, never from a
 * delivered webhook.
 */
export function isLiveContactEventType(s: unknown): s is LiveContactEventType {
  return (
    typeof s === "string" &&
    (LIVE_CONTACT_EVENT_TYPES as readonly string[]).includes(s)
  );
}

export const recordContactEvent = internalMutation({
  args: {
    svixId: v.string(),
    email: v.string(),
    contactId: v.string(),
    audienceId: v.optional(v.string()),
    eventType: contactEventTypeValidator,
    unsubscribed: v.boolean(),
    occurredAt: v.number(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    rawPayload: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: boolean; id: Id<"marketingEvents"> }> => {
    // Idempotency: if we've seen this svix message ID, skip insert.
    const existing = await ctx.db
      .query("marketingEvents")
      .withIndex("by_svix_id", (q) => q.eq("svixId", args.svixId))
      .first();

    if (existing) {
      return { inserted: false, id: existing._id };
    }

    const id = await ctx.db.insert("marketingEvents", {
      svixId: args.svixId,
      email: args.email,
      contactId: args.contactId,
      audienceId: args.audienceId,
      eventType: args.eventType,
      unsubscribed: args.unsubscribed,
      occurredAt: args.occurredAt,
      firstName: args.firstName,
      lastName: args.lastName,
      rawPayload: args.rawPayload,
    });

    return { inserted: true, id };
  },
});
