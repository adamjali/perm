/**
 * Put a webhook event in the queue, from inside a mutation.
 *
 * Every producer (the case and employer watch sweeps, the feed hooks, the
 * Settings test button) calls `enqueueEvent` in its own transaction, so the
 * event is recorded exactly when the thing it reports is: a watch's new
 * status and its event commit together or not at all. Delivery happens
 * later, in its own action (convex/webhookDelivery.ts), scheduled here; a
 * producer never waits on anybody's server.
 */
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { WebhookEvent } from "./webhookSign";

/** What every delivery body looks like: Standard Webhooks' type, timestamp and data. */
export function eventBody(type: WebhookEvent | "ping", data: Record<string, unknown>, at: number): string {
  return JSON.stringify({ type, timestamp: new Date(at).toISOString(), data });
}

export interface Enqueued {
  eventId: Id<"webhookEvents"> | null;
  deliveries: number;
  /** True when an event with this key already existed, so nothing new was queued. */
  duplicate: boolean;
}

/**
 * Record an event and queue one delivery to each endpoint that wants it.
 *
 * `account` set: the endpoints of that account subscribed to `type` (a
 * watch's event). `account` absent: every endpoint subscribed to `type` (a
 * feed event). `onlyEndpoint`: that endpoint alone (a test event). An event
 * whose `key` is already recorded is a duplicate and queues nothing.
 */
export async function enqueueEvent(
  ctx: MutationCtx,
  args: {
    type: WebhookEvent | "ping";
    key: string;
    data: Record<string, unknown>;
    account?: string;
    onlyEndpoint?: Id<"webhookEndpoints">;
  },
): Promise<Enqueued> {
  const existing = await ctx.db
    .query("webhookEvents")
    .withIndex("by_key", (q) => q.eq("key", args.key))
    .first();
  if (existing) return { eventId: existing._id, deliveries: 0, duplicate: true };

  const now = Date.now();
  let targets: Doc<"webhookEndpoints">[];
  if (args.onlyEndpoint) {
    const one = await ctx.db.get(args.onlyEndpoint);
    targets = one ? [one] : [];
  } else if (args.account !== undefined) {
    const account = args.account;
    targets = (
      await ctx.db
        .query("webhookEndpoints")
        .withIndex("by_account", (q) => q.eq("account", account))
        .take(50)
    ).filter((e) => e.events.includes(args.type));
  } else {
    // A feed event: every subscribed endpoint. Endpoints are few (a handful
    // per account); this walks them once per publication.
    targets = [];
    for await (const e of ctx.db.query("webhookEndpoints")) {
      if (e.events.includes(args.type)) targets.push(e);
    }
  }
  if (targets.length === 0 && !args.onlyEndpoint) {
    // Nobody to tell: keep no event, so the table holds only what was sent.
    // A feed's own state (convex/webhookSweeps.ts) still records that it was seen.
    return { eventId: null, deliveries: 0, duplicate: false };
  }

  const eventId = await ctx.db.insert("webhookEvents", {
    type: args.type,
    key: args.key,
    payload: eventBody(args.type, args.data, now),
    ...(args.account !== undefined ? { account: args.account } : {}),
    createdAt: now,
  });
  for (const e of targets) {
    await ctx.db.insert("webhookDeliveries", {
      endpointId: e._id,
      eventId,
      account: e.account,
      type: args.type,
      status: e.pausedAt !== undefined ? "held" : "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    });
  }
  await ctx.scheduler.runAfter(0, internal.webhookDelivery.deliverDue, {});
  return { eventId, deliveries: targets.length, duplicate: false };
}
