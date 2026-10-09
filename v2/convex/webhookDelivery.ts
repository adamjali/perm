/**
 * Delivering webhooks: the queue's runner, its retries, pausing an endpoint
 * that keeps failing, and the one email that says so.
 *
 * WHERE IT RUNS. A Convex action, scheduled the moment an event is queued
 * (convex/lib/webhookQueue.ts) and again at each retry's time, with a cron
 * every 10 minutes as the floor. Convex because the endpoints, keys and
 * accounts live here and an action may call `fetch`; the site's server would
 * need its own copy of every endpoint and secret. A producer only inserts
 * rows and schedules this, so a slow or dead endpoint never slows a sweep.
 *
 * ONE SEND PER CLAIM. `claimDue` takes due rows in a transaction and stamps a
 * two-minute lease on each, so two runs at once can't send the same delivery;
 * a run that dies mid-send leaves rows whose lease simply runs out.
 *
 * RETRIES AND PAUSING. A failure (a non-2xx answer, a redirect, a timeout of
 * 10 seconds) is retried after 1 and 5 minutes, half an hour, then 2, 5 and
 * 10 hours, with the last attempt at the 24-hour mark (convex/lib/
 * webhookSign.ts). After that the delivery is `failed`, the endpoint pauses,
 * its waiting deliveries are held (kept, not sent) and its owner gets one
 * email through the shared send path (sendOrQueue, never Resend directly).
 * Resuming in Settings releases what was held.
 */
import { v } from "convex/values";

import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptToken } from "./lib/crypto";
import { FROM_EMAIL, getResend, sendOrQueue } from "./lib/email";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { MS_PER_DAY, MS_PER_MINUTE } from "./lib/time";
import { nextAttemptAt, webhookHeaders } from "./lib/webhookSign";

const log = createLogger("WebhookDelivery");

/** Deliveries one run sends; a full batch schedules the next run. */
const BATCH = 25;
const LEASE_MS = 2 * MS_PER_MINUTE;
const TIMEOUT_MS = 10_000;
/** Pause emails across every account in a day: one sending path, one budget. */
export const PAUSE_EMAILS_PER_DAY = 20;
/** How long the log keeps a delivery, and the queue an event. */
export const KEEP_DAYS = 30;

const claimed = v.object({
  deliveryId: v.id("webhookDeliveries"),
  eventId: v.id("webhookEvents"),
  url: v.string(),
  secretEnc: v.string(),
  payload: v.string(),
});

export const claimDue = internalMutation({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(claimed),
  handler: async (ctx, args) => {
    const out: { deliveryId: Id<"webhookDeliveries">; eventId: Id<"webhookEvents">; url: string; secretEnc: string; payload: string }[] = [];
    const due = ctx.db
      .query("webhookDeliveries")
      .withIndex("by_status_and_next", (q) => q.eq("status", "pending").lte("nextAttemptAt", args.now));
    for await (const d of due) {
      if (out.length >= args.limit) break;
      if (d.leaseUntil !== undefined && d.leaseUntil > args.now) continue;
      const [endpoint, event] = await Promise.all([ctx.db.get(d.endpointId), ctx.db.get(d.eventId)]);
      if (!endpoint || !event) {
        // Its endpoint was deleted or its event pruned: nothing left to send.
        await ctx.db.patch(d._id, { status: "failed", lastError: "the endpoint or event no longer exists", leaseUntil: undefined });
        continue;
      }
      if (endpoint.pausedAt !== undefined) {
        await ctx.db.patch(d._id, { status: "held", leaseUntil: undefined });
        continue;
      }
      await ctx.db.patch(d._id, {
        leaseUntil: args.now + LEASE_MS,
        attempts: d.attempts + 1,
        firstAttemptAt: d.firstAttemptAt ?? args.now,
      });
      out.push({ deliveryId: d._id, eventId: d.eventId, url: endpoint.url, secretEnc: endpoint.secretEnc, payload: event.payload });
    }
    return out;
  },
});

export const recordResult = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.deliveryId);
    if (!d) return null;
    const endpoint = await ctx.db.get(d.endpointId);
    if (args.ok) {
      await ctx.db.patch(d._id, {
        status: "delivered",
        deliveredAt: args.now,
        leaseUntil: undefined,
        lastError: undefined,
        ...(args.statusCode !== undefined ? { lastStatusCode: args.statusCode } : {}),
      });
      if (endpoint) {
        await ctx.db.patch(endpoint._id, {
          lastDeliveryAt: args.now,
          ...(args.statusCode !== undefined ? { lastStatusCode: args.statusCode } : {}),
        });
      }
      return null;
    }

    const error = (args.error ?? (args.statusCode !== undefined ? `answered ${args.statusCode}` : "no answer")).slice(0, 300);
    const next = nextAttemptAt(d.firstAttemptAt ?? args.now, d.attempts, args.now);
    if (endpoint) {
      await ctx.db.patch(endpoint._id, args.statusCode !== undefined ? { lastStatusCode: args.statusCode } : {});
    }
    if (next !== null) {
      await ctx.db.patch(d._id, {
        status: "pending",
        nextAttemptAt: next,
        leaseUntil: undefined,
        lastError: error,
        ...(args.statusCode !== undefined ? { lastStatusCode: args.statusCode } : {}),
      });
      await ctx.scheduler.runAt(next, internal.webhookDelivery.deliverDue, {});
      return null;
    }

    // 24 hours of failures: this delivery is failed, and the endpoint pauses.
    await ctx.db.patch(d._id, {
      status: "failed",
      leaseUntil: undefined,
      lastError: error,
      ...(args.statusCode !== undefined ? { lastStatusCode: args.statusCode } : {}),
    });
    if (endpoint && endpoint.pausedAt === undefined) {
      await ctx.db.patch(endpoint._id, {
        pausedAt: args.now,
        pauseReason: `Deliveries failed for 24 hours (last: ${error}).`,
      });
      const waiting = await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_endpoint", (q) => q.eq("endpointId", endpoint._id))
        .take(1000);
      for (const w of waiting) {
        if (w.status === "pending") await ctx.db.patch(w._id, { status: "held", leaseUntil: undefined });
      }
      await ctx.scheduler.runAfter(0, internal.webhookDelivery.notifyPaused, { endpointId: endpoint._id });
    }
    return null;
  },
});

/** Send what's due, a batch at a time. Safe to run any number of times at once. */
export const deliverDue = internalAction({
  args: {},
  returns: v.object({ sent: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const now = Date.now();
    const batch: { deliveryId: Id<"webhookDeliveries">; eventId: Id<"webhookEvents">; url: string; secretEnc: string; payload: string }[] =
      await ctx.runMutation(internal.webhookDelivery.claimDue, { now, limit: BATCH });
    let sent = 0;
    let failed = 0;
    for (const d of batch) {
      let ok = false;
      let statusCode: number | undefined;
      let error: string | undefined;
      try {
        const secret = await decryptToken(d.secretEnc);
        const headers = await webhookHeaders(secret, `msg_${d.eventId}`, Math.floor(Date.now() / 1000), d.payload);
        const res = await fetch(d.url, {
          method: "POST",
          headers,
          body: d.payload,
          // A redirect is an answer we don't follow: the signature names this
          // address, and following one is how a webhook gets sent somewhere else.
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        statusCode = res.status;
        ok = res.status >= 200 && res.status < 300;
        if (!ok) error = res.status >= 300 && res.status < 400 ? `answered ${res.status} (a redirect, which isn't followed)` : `answered ${res.status}`;
        // The body isn't kept; reading a little lets the connection close cleanly.
        await res.text().catch(() => "");
      } catch (e) {
        error = e instanceof Error && e.name === "TimeoutError" ? "didn't answer within 10 seconds" : "couldn't be reached";
      }
      if (ok) sent++;
      else failed++;
      await ctx.runMutation(internal.webhookDelivery.recordResult, {
        deliveryId: d.deliveryId,
        ok,
        ...(statusCode !== undefined ? { statusCode } : {}),
        ...(error !== undefined ? { error } : {}),
        now: Date.now(),
      });
    }
    // A full batch means more may be waiting; the next run takes them.
    if (batch.length === BATCH) await ctx.scheduler.runAfter(0, internal.webhookDelivery.deliverDue, {});
    return { sent, failed };
  },
});

/**
 * Claim the one email a pause gets, before it's sent: stamped once per pause,
 * and under a daily budget across every account, so a run of failing
 * endpoints can't spend the shared email allowance.
 */
export const claimPauseNotice = internalMutation({
  args: { endpointId: v.id("webhookEndpoints") },
  returns: v.union(v.null(), v.object({ email: v.string(), url: v.string(), reason: v.string() })),
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.endpointId);
    if (!e || e.pausedAt === undefined || e.pauseNotifiedAt !== undefined) return null;
    const user = await ctx.db.get(e.userId);
    if (!user?.email || user.deletedAt) return null;
    const budget = await checkAndRecordRateLimit(ctx, "all", "webhook-pause-email", {
      limit: PAUSE_EMAILS_PER_DAY,
      windowMs: MS_PER_DAY,
    });
    // Stamped either way: a pause the budget refused shows in Settings, and
    // no later run should keep trying to mail it.
    await ctx.db.patch(e._id, { pauseNotifiedAt: Date.now() });
    if (!budget.allowed) {
      log.warn("webhook pause emails used up for today", { endpointId: e._id });
      return null;
    }
    return { email: user.email, url: e.url, reason: e.pauseReason ?? "Deliveries failed for 24 hours." };
  },
});

export const notifyPaused = internalAction({
  args: { endpointId: v.id("webhookEndpoints") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notice: { email: string; url: string; reason: string } | null = await ctx.runMutation(
      internal.webhookDelivery.claimPauseNotice,
      args,
    );
    if (!notice) return null;
    const settings = `${SITE_URL}/settings?tab=api-keys`;
    const result = await sendOrQueue(ctx, "webhook-paused", getResend(), {
      from: FROM_EMAIL,
      to: notice.email,
      subject: "Your PERM Tracker webhook is paused",
      text: [
        "We've paused deliveries to your webhook endpoint:",
        notice.url,
        "",
        notice.reason,
        "",
        "Events since then are kept, not lost. Fix the endpoint, then resume it in Settings, under API keys, and we'll send what's waiting:",
        settings,
        "",
        "PERM Tracker",
      ].join("\n"),
    });
    if (result.error) log.error("webhook pause email failed", { error: result.error.message });
    return null;
  },
});

/** The log and queue, past 30 days, a batch at a time. */
export const prune = internalMutation({
  args: {},
  returns: v.object({ deliveries: v.number(), events: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_DAYS * MS_PER_DAY;
    let deliveries = 0;
    let events = 0;
    const oldD = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const d of oldD) {
      // A held delivery waits for its endpoint, however long; the rest go.
      if (d.status === "held") continue;
      await ctx.db.delete(d._id);
      deliveries++;
    }
    const oldE = await ctx.db
      .query("webhookEvents")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const e of oldE) {
      await ctx.db.delete(e._id);
      events++;
    }
    if (oldD.length === 500 || oldE.length === 500) await ctx.scheduler.runAfter(0, internal.webhookDelivery.prune, {});
    return { deliveries, events };
  },
});

/** What's waiting and what failed, for the admin page and the morning report. */
/** Endpoints, paused ones, deliveries waiting and held, and what was delivered or failed since `since`. */
export async function webhookHealth(ctx: QueryCtx, since: number) {
  const endpoints = await ctx.db.query("webhookEndpoints").take(2000);
  const pending = await ctx.db
    .query("webhookDeliveries")
    .withIndex("by_status_and_next", (q) => q.eq("status", "pending"))
    .take(5000);
  const held = await ctx.db
    .query("webhookDeliveries")
    .withIndex("by_status_and_next", (q) => q.eq("status", "held"))
    .take(5000);
  const recent = await ctx.db
    .query("webhookDeliveries")
    .withIndex("by_created", (q) => q.gte("createdAt", since))
    .take(5000);
  const watches = await ctx.db.query("webhookWatches").take(10_000);
  return {
    endpoints: endpoints.length,
    paused: endpoints.filter((e) => e.pausedAt !== undefined).length,
    pending: pending.length,
    held: held.length,
    deliveredSince: recent.filter((d) => d.status === "delivered").length,
    failedSince: recent.filter((d) => d.status === "failed").length,
    watches: watches.length,
  };
}

export const health = internalQuery({
  args: { since: v.number() },
  returns: v.object({
    endpoints: v.number(),
    paused: v.number(),
    pending: v.number(),
    held: v.number(),
    deliveredSince: v.number(),
    failedSince: v.number(),
    watches: v.number(),
  }),
  handler: async (ctx, args) => await webhookHealth(ctx, args.since),
});
