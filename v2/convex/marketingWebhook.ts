/**
 * Resend Contact Webhook Event Recorder
 *
 * Records subscribe/unsubscribe/delete events from Resend into the
 * `marketingEvents` table. Append-only audit trail — Resend remains the
 * source of truth for current subscription status.
 *
 * Called only from `convex/http.ts` after svix signature verification.
 *
 * Idempotent: deduped on `svixId` (from the `svix-id` request header).
 * Resend retries on failure and delivers the same `svix-id`, so dedup
 * prevents duplicate rows.
 *
 * @module convex/marketingWebhook
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const recordContactEvent = internalMutation({
  args: {
    svixId: v.string(),
    email: v.string(),
    contactId: v.string(),
    audienceId: v.optional(v.string()),
    eventType: v.string(),
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
