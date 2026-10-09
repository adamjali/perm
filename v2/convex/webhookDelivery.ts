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
 * ten-minute lease on each, longer than a whole batch can take (its sends run
 * at once, each cut off at 10 seconds), so two runs at once can't send the
 * same delivery. Each claim is numbered by the attempt it counts, and
 * `recordResult` keeps only the answer to the newest claim of a row still
 * pending: a run that dies mid-send leaves rows whose lease simply runs out,
 * and its late answer can't undo what a later run recorded.
 *
 * WHERE IT SENDS. Only to an https address with a public host name
 * (convex/lib/webhookSign.ts), and only when that name resolves to public
 * addresses, asked in Node at send time (convex/webhookResolve.ts). The fetch
 * resolves the name again, so a name whose owner switches its answer between
 * the two lookups can still get through: checking at connect time needs a
 * lower-level client than this runtime's fetch, and the requests leave from
 * Convex's servers, not ours.
 *
 * RETRIES AND PAUSING. A failure (a non-2xx answer, a redirect, a timeout of
 * 10 seconds) is retried after 1 and 5 minutes, half an hour, then 2, 5 and
 * 10 hours, with the last attempt at the 24-hour mark (convex/lib/
 * webhookSign.ts). After that the delivery is `failed`, the endpoint pauses,
 * its waiting deliveries are held (kept, not sent) and its owner gets one
 * email through the shared send path (sendOrQueue, never Resend directly).
 * Resuming in Settings releases what was held. Like everything in the log, a
 * held delivery and its event are kept for 30 days, and the email says so.
 */
import { v } from "convex/values";

import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { NO_WEBHOOKS_MESSAGE, entitlement } from "./lib/apiPlans";
import { BUDGETS, noteRefusal, windowFor } from "./lib/alertBudgets";
import { decryptToken } from "./lib/crypto";
import { FROM_EMAIL, getResend, sendOrQueue } from "./lib/email";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { MS_PER_DAY, MS_PER_MINUTE } from "./lib/time";
import { RETRY_WINDOW_MS, nextAttemptAt, webhookHeaders } from "./lib/webhookSign";

const log = createLogger("WebhookDelivery");

/** Deliveries one run sends; a full batch schedules the next run. */
const BATCH = 25;
const TIMEOUT_MS = 10_000;
/**
 * How long a claim holds a row: longer than a whole batch can take. The sends
 * run at once, so a batch takes about one timeout; even one at a time, 25
 * sends at 10 seconds is under 5 minutes.
 */
const LEASE_MS = 10 * MS_PER_MINUTE;
/** Pause emails across every account in a day (convex/lib/alertBudgets.ts, the Resend ledger in convex/caseAlerts.ts). */
export const PAUSE_EMAILS_PER_DAY = BUDGETS.webhookPause.limit;
/** How long the log keeps a delivery, the queue an event, and a paused endpoint what it holds. */
export const KEEP_DAYS = 30;

const claimed = v.object({
  deliveryId: v.id("webhookDeliveries"),
  eventId: v.id("webhookEvents"),
  attempt: v.number(),
  url: v.string(),
  secretEnc: v.string(),
  payload: v.string(),
});
type Claimed = { deliveryId: Id<"webhookDeliveries">; eventId: Id<"webhookEvents">; attempt: number; url: string; secretEnc: string; payload: string };

/**
 * The delivery is failed for good, and its endpoint pauses: what else is
 * waiting for it is held, and its owner gets one email.
 */
async function failAndPause(
  ctx: MutationCtx,
  d: Doc<"webhookDeliveries">,
  endpoint: Doc<"webhookEndpoints"> | null,
  error: string,
  statusCode: number | undefined,
  now: number,
): Promise<void> {
  await ctx.db.patch(d._id, {
    status: "failed",
    leaseUntil: undefined,
    lastError: error,
    ...(statusCode !== undefined ? { lastStatusCode: statusCode } : {}),
  });
  if (!endpoint || endpoint.pausedAt !== undefined) return;
  await ctx.db.patch(endpoint._id, {
    pausedAt: now,
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

export const claimDue = internalMutation({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(claimed),
  handler: async (ctx, args) => {
    const out: Claimed[] = [];
    const allowed = new Map<string, boolean>();
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
      // The plan as it applies now: once the paywall is on, what was queued
      // for an account whose plan has no webhooks is never sent.
      let ok = allowed.get(endpoint.account);
      if (ok === undefined) {
        const acct = await ctx.db
          .query("apiAccounts")
          .withIndex("by_account", (q) => q.eq("account", endpoint.account))
          .unique();
        ok = entitlement(acct?.plan).plan.webhookEndpoints > 0;
        allowed.set(endpoint.account, ok);
      }
      if (!ok) {
        await ctx.db.patch(d._id, { status: "failed", lastError: NO_WEBHOOKS_MESSAGE, leaseUntil: undefined });
        continue;
      }
      // A row whose 24 hours ran out without an answer being recorded (a run
      // that died after claiming it, every time) fails here instead of
      // heading every batch forever.
      if (d.firstAttemptAt !== undefined && args.now - d.firstAttemptAt >= RETRY_WINDOW_MS) {
        await failAndPause(ctx, d, endpoint, d.lastError ?? "no answer was recorded within 24 hours", d.lastStatusCode, args.now);
        continue;
      }
      const attempt = d.attempts + 1;
      await ctx.db.patch(d._id, {
        leaseUntil: args.now + LEASE_MS,
        attempts: attempt,
        firstAttemptAt: d.firstAttemptAt ?? args.now,
      });
      out.push({ deliveryId: d._id, eventId: d.eventId, attempt, url: endpoint.url, secretEnc: endpoint.secretEnc, payload: event.payload });
    }
    return out;
  },
});

export const recordResult = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    /** The attempt the claim counted; an answer to an older claim is ignored. */
    attempt: v.number(),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.deliveryId);
    // Gone, already settled (delivered, failed or held), or claimed again
    // since this answer's claim: a later run owns it now.
    if (!d || d.status !== "pending" || d.attempts !== args.attempt) return null;
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
    await failAndPause(ctx, d, endpoint, error, args.statusCode, args.now);
    return null;
  },
});

type Outcome = { ok: boolean; statusCode?: number; error?: string };

/** One POST, its body never read: only the status counts. */
async function post(d: Claimed): Promise<Outcome> {
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
    // The body is dropped unread: an endpoint can answer with any amount,
    // and reading it all is how one huge answer kills the run.
    await res.body?.cancel().catch(() => {});
    const statusCode = res.status;
    const ok = statusCode >= 200 && statusCode < 300;
    if (ok) return { ok, statusCode };
    const error = statusCode >= 300 && statusCode < 400 ? `answered ${statusCode} (a redirect, which isn't followed)` : `answered ${statusCode}`;
    return { ok, statusCode, error };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "didn't answer within 10 seconds" : "couldn't be reached" };
  }
}

/** Send what's due, a batch at a time. Safe to run any number of times at once. */
export const deliverDue = internalAction({
  args: {},
  returns: v.object({ sent: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const batch: Claimed[] = await ctx.runMutation(internal.webhookDelivery.claimDue, { now: Date.now(), limit: BATCH });
    // Each host's name is resolved once, in Node, and a name pointing at a
    // private address is never sent to.
    const hosts = [...new Set(batch.map((d) => new URL(d.url).hostname))];
    const verdicts = new Map<string, { ok: true } | { ok: false; reason: string }>();
    await Promise.all(
      hosts.map(async (host) => {
        verdicts.set(host, await ctx.runAction(internal.webhookResolve.publicHost, { host }));
      }),
    );
    // The sends run at once, so a batch takes about one timeout.
    const outcomes = await Promise.all(
      batch.map(async (d): Promise<Outcome> => {
        const verdict = verdicts.get(new URL(d.url).hostname);
        if (verdict && !verdict.ok) return { ok: false, error: verdict.reason };
        return await post(d);
      }),
    );
    let sent = 0;
    let failed = 0;
    for (const [i, d] of batch.entries()) {
      const o = outcomes[i]!;
      if (o.ok) sent++;
      else failed++;
      await ctx.runMutation(internal.webhookDelivery.recordResult, {
        deliveryId: d.deliveryId,
        attempt: d.attempt,
        ok: o.ok,
        ...(o.statusCode !== undefined ? { statusCode: o.statusCode } : {}),
        ...(o.error !== undefined ? { error: o.error } : {}),
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
    const budget = await checkAndRecordRateLimit(ctx, "all", BUDGETS.webhookPause.key, windowFor("webhookPause"));
    // Stamped either way: a pause the budget refused shows in Settings, and
    // no later run should keep trying to mail it.
    await ctx.db.patch(e._id, { pauseNotifiedAt: Date.now() });
    if (!budget.allowed) {
      await noteRefusal(ctx, "webhookPause");
      log.warn("webhook pause emails used up for today", { endpointId: e._id });
      return null;
    }
    return { email: user.email, url: e.url, reason: e.pauseReason ?? "Deliveries failed for 24 hours." };
  },
});

/** The pause email's words. */
export function pauseEmailText(url: string, reason: string, settings: string): string {
  return [
    "We've paused deliveries to your webhook endpoint:",
    url,
    "",
    reason,
    "",
    `Events from the last ${KEEP_DAYS} days wait for it; older ones are dropped. Fix the endpoint, then resume it in Settings, under API keys, and we'll send what's waiting:`,
    settings,
    "",
    "PERM Tracker",
  ].join("\n");
}

export const notifyPaused = internalAction({
  args: { endpointId: v.id("webhookEndpoints") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notice: { email: string; url: string; reason: string } | null = await ctx.runMutation(
      internal.webhookDelivery.claimPauseNotice,
      args,
    );
    if (!notice) return null;
    const result = await sendOrQueue(ctx, "webhook-paused", getResend(), {
      from: FROM_EMAIL,
      to: notice.email,
      subject: "Your PERM Tracker webhook is paused",
      text: pauseEmailText(notice.url, notice.reason, `${SITE_URL}/settings?tab=api-keys`),
    });
    if (result.error) log.error("webhook pause email failed", { error: result.error.message });
    return null;
  },
});

/**
 * The log and queue past 30 days, a batch at a time: deliveries of every
 * status (a paused endpoint's held ones included, as its owner's email says)
 * and events. Every row read is deleted, so the chain always ends.
 */
export const prune = internalMutation({
  args: {},
  returns: v.object({ deliveries: v.number(), events: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_DAYS * MS_PER_DAY;
    const oldD = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const d of oldD) await ctx.db.delete(d._id);
    const oldE = await ctx.db
      .query("webhookEvents")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const e of oldE) await ctx.db.delete(e._id);
    if (oldD.length === 500 || oldE.length === 500) await ctx.scheduler.runAfter(0, internal.webhookDelivery.prune, {});
    return { deliveries: oldD.length, events: oldE.length };
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
