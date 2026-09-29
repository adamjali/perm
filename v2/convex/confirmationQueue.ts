/**
 * Confirmations a full pool could not send at once, sent when there's room.
 *
 * ## Why this exists (Sep 29 2026)
 *
 * On Sep 28 fifteen people asked for case alerts after the day's 15
 * case-confirmation emails were spent, and two more the next morning. Each
 * was told "try again later" and nothing was kept, so none of them got an
 * email unless they came back. That day the whole Resend account sent 57 of
 * its 100: the pool was full, the account was not. The pools were sized when
 * their sum was the only guard against Resend's cap; Resend now reports its
 * own count on every send and in its list of sent mail, which is a better
 * guard than a fixed share.
 *
 * ## How it works
 *
 * 1. A subscribe mutation whose pool is full calls `queueConfirmation`: one
 *    row per (kind, address), the call's own arguments kept as JSON without
 *    the IP. The reply says the email is queued (`queued: true`, so a form
 *    never heads it "Check your inbox"), the same words for every address:
 *    it depends on how busy the site is, not on what an address holds. A
 *    drain is scheduled at once.
 * 2. `drain` counts what Resend has sent since midnight UTC (its free plan's
 *    daily quota is a UTC calendar day, and Resend's own list is the count),
 *    and replays waiting requests through the same subscribe mutation with
 *    `fromQueue`, oldest first, while the day stays under DRAIN_CEILING. The
 *    replay re-runs every per-address check; only the per-IP limit and the
 *    pool are skipped (the first call passed the one, and the drain measured
 *    the account instead of the other).
 * 3. A cron drains every 15 minutes, so a request that waited for the UTC
 *    day to turn (8 PM Eastern in summer) goes out then.
 *
 * Bounds: QUEUE_MAX rows in all (past that, the old refusal, counted); a row
 * unsent after EXPIRE_MS is dropped and counted as turned away; the drain
 * stops at DRAIN_CEILING of the 100 so sign-in codes keep the rest. The
 * first queued request and the first turn-away of each Eastern day email the
 * admin, which is how the owner hears about a full pool the same day.
 */
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { BUDGETS, noteQueued, noteRefusal, type BudgetName } from "./lib/alertBudgets";
import { siteThrottleReply } from "./lib/throttleReply";
import { createLogger } from "./lib/logging";

const log = createLogger("ConfirmationQueue");

export type QueueKind = Doc<"confirmationQueue">["kind"];

/** Waiting requests the queue holds in all. About one day of the account's room. */
export const QUEUE_MAX = 100;
/** A request unsent after three days is dropped and counted as turned away. */
export const EXPIRE_MS = 3 * 24 * 60 * 60 * 1000;
/** A drain's claim on a row; older than this, another drain may take it. */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;
/** Replays of one row before it's given up (each one failed by throwing). */
export const MAX_ATTEMPTS = 5;
/**
 * The drain sends while Resend's count for the UTC day is under this. The
 * free plan allows 100 a day, sent and received together; the other 20 are
 * for sign-in and reset codes, which lock a person out when they don't come.
 */
export const DRAIN_CEILING = 80;
/** Received mail counts toward Resend's quota too; the list shows sent only. */
export const RECEIVED_MARGIN = 5;
/** Requests one drain run may send. */
export const PER_RUN = 25;

/** Every address gets these same words, so the reply says nothing about the address. */
export const QUEUED_REPLY =
  "We're sending a lot of email right now, so your confirmation is in a short queue. " +
  "It goes out on its own, usually within minutes; on the busiest days it can wait until the evening. " +
  "There's nothing else to do.";
export const QUEUED_LINK_REPLY =
  "We're sending a lot of email right now, so your link is in a short queue. " +
  "It goes out on its own, usually within minutes; on the busiest days it can wait until the evening.";

/** A subscribe call's arguments as the queue keeps them: no IP, no replay flag. */
export function replayArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) if (k !== "ip" && k !== "fromQueue") out[k] = v;
  return out;
}

/**
 * Put a request a full pool refused into the queue, and say so. Call it in
 * place of the refusal, BEFORE any alert row is written, so the queued
 * request leaves no stamp for a later retry to trip over.
 */
export async function queueConfirmation(
  ctx: MutationCtx,
  req: {
    kind: QueueKind;
    pool: BudgetName;
    email: string;
    /** The subscribe call's arguments, without `ip` and `fromQueue`. */
    args: Record<string, unknown>;
    /** When the pool frees, for the refusal if the queue is full too. */
    resetInMs: number;
    /** "confirmation emails" or "preference links", for that refusal. */
    what?: string;
  },
): Promise<{ ok: boolean; message: string; throttled?: boolean; queued?: boolean }> {
  const reply = req.kind === "prefs" ? QUEUED_LINK_REPLY : QUEUED_REPLY;
  const payload = JSON.stringify(req.args);
  const now = Date.now();

  const waiting = await ctx.db
    .query("confirmationQueue")
    .withIndex("by_kind_email", (q) => q.eq("kind", req.kind).eq("email", req.email))
    .first();
  if (waiting) {
    // The newest request stands for the address; it keeps its place in line.
    await ctx.db.patch(waiting._id, { payload });
    return { ok: true, message: reply, queued: true };
  }

  const held = await ctx.db.query("confirmationQueue").withIndex("by_queuedAt").take(QUEUE_MAX);
  if (held.length >= QUEUE_MAX) {
    const first = await noteRefusal(ctx, req.pool);
    if (first) await alertAdmin(ctx, "turnedAway", req.pool, held.length);
    log.error("confirmation queue full; refusing", { pool: req.pool, held: held.length });
    return { ok: false, message: siteThrottleReply(req.resetInMs, req.what), throttled: true };
  }

  await ctx.db.insert("confirmationQueue", {
    kind: req.kind,
    pool: req.pool,
    email: req.email,
    payload,
    queuedAt: now,
  });
  const first = await noteQueued(ctx, req.pool);
  if (first) await alertAdmin(ctx, "queued", req.pool, held.length + 1);
  await ctx.scheduler.runAfter(0, internal.confirmationQueue.drain, {});
  return { ok: true, message: reply, queued: true };
}

function easternTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

/** The once-a-day admin email for a full pool (queued) or a lost request (turnedAway). */
async function alertAdmin(ctx: MutationCtx, what: "queued" | "turnedAway", pool: BudgetName, held: number) {
  const b = BUDGETS[pool];
  const at = easternTime(Date.now());
  const subject =
    what === "queued"
      ? `${b.label}: today's ${b.limit} are used; new requests are queued`
      : `${b.label}: someone got no email`;
  const body =
    what === "queued"
      ? `The ${b.label.toLowerCase()} pool (${b.limit} a day) filled at ${at}. New requests now wait in a queue and ` +
        `go out as soon as Resend's own count for the day leaves room (the queue stops at ${DRAIN_CEILING} of the ` +
        `free plan's 100, keeping the rest for sign-in codes). Nobody has been turned away. The admin page's ` +
        `Alerts and email tab shows the queue. If this happens most days, Resend Pro (about $20 a month, no ` +
        `daily cap) removes the limit. This email comes at most once a day.`
      : `At ${at} a request for the ${b.label.toLowerCase()} pool got no email: the queue already held ${held} ` +
        `(its limit is ${QUEUE_MAX}), or a queued request waited more than three days. That person was told to try ` +
        `again later. The admin page's Alerts and email tab has the counts. Resend Pro (about $20 a month, no daily ` +
        `cap) would have sent it. This email comes at most once a day.`;
  await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, { subject, body });
}

// ---------------------------------------------------------------------------
// Pure helpers (tested directly)
// ---------------------------------------------------------------------------

/** Resend's "2026-09-28 09:16:00.832000+00" as epoch ms, or NaN. */
export function parseResendTime(s: string): number {
  return Date.parse(s.replace(" ", "T").replace(/\+00(:00)?$/, "Z"));
}

/** Midnight UTC at the start of `now`'s UTC day: when Resend's daily quota began. */
export function utcDayStart(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * How many waiting requests may go now, given what Resend has sent today.
 * Received mail isn't in the list, so a margin stands in for it.
 */
export function drainRoom(sentToday: number, perRun: number = PER_RUN): number {
  return Math.max(0, Math.min(perRun, DRAIN_CEILING - RECEIVED_MARGIN - sentToday));
}

interface ResendListPage {
  data: { id: string; created_at: string }[];
  has_more: boolean;
}

/**
 * What Resend has sent since midnight UTC, read from its own newest-first
 * list. Null when the list can't be read, so the caller sends nothing rather
 * than guessing. The free plan can't send more than 100 a day, so two pages
 * are the most this needs; a third is a guard.
 */
export async function countSentToday(
  listPage: (after?: string) => Promise<ResendListPage | null>,
  now: number,
): Promise<number | null> {
  const start = utcDayStart(now);
  let count = 0;
  let after: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await listPage(after);
    if (!res) return null;
    for (const e of res.data) {
      const t = parseResendTime(e.created_at);
      if (!Number.isFinite(t)) return null;
      if (t < start) return count;
      count++;
    }
    const last = res.data[res.data.length - 1];
    if (!res.has_more || !last) return count;
    after = last.id;
  }
  return count;
}

// ---------------------------------------------------------------------------
// The queue itself
// ---------------------------------------------------------------------------

/** True when anything is waiting (a cheap first look before asking Resend). */
export const hasWaiting = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => (await ctx.db.query("confirmationQueue").withIndex("by_queuedAt").first()) !== null,
});

/**
 * Drop rows past their three days (counted as turned away), then claim up to
 * `limit` of the oldest rows no other drain holds.
 */
export const claim = internalMutation({
  args: { limit: v.number() },
  returns: v.array(
    v.object({ id: v.id("confirmationQueue"), kind: v.string(), payload: v.string() }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db.query("confirmationQueue").withIndex("by_queuedAt").take(QUEUE_MAX);
    const out: { id: Id<"confirmationQueue">; kind: string; payload: string }[] = [];
    for (const row of rows) {
      if (now - row.queuedAt > EXPIRE_MS) {
        await ctx.db.delete(row._id);
        const first = await noteRefusal(ctx, row.pool as BudgetName);
        if (first) await alertAdmin(ctx, "turnedAway", row.pool as BudgetName, rows.length);
        continue;
      }
      if (out.length >= args.limit) continue;
      if (row.claimedAt !== undefined && now - row.claimedAt < CLAIM_LEASE_MS) continue;
      await ctx.db.patch(row._id, { claimedAt: now, attempts: (row.attempts ?? 0) + 1 });
      out.push({ id: row._id, kind: row.kind, payload: row.payload });
    }
    return out;
  },
});

/**
 * A replay finished (`done`: sent, or absorbed by a per-address check such as
 * the cooldown after another confirmation), so the row goes; or it threw.
 */
export const settle = internalMutation({
  args: { id: v.id("confirmationQueue"), done: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    if (args.done) {
      await ctx.db.delete(row._id);
      return null;
    }
    // The replay threw. Free the claim for the next drain, or give up.
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      await ctx.db.delete(row._id);
      const first = await noteRefusal(ctx, row.pool as BudgetName);
      if (first) await alertAdmin(ctx, "turnedAway", row.pool as BudgetName, 0);
      return null;
    }
    await ctx.db.patch(row._id, { claimedAt: undefined });
    return null;
  },
});

/** What the admin page shows: how many wait, and since when. */
export const summary = internalQuery({
  args: {},
  returns: v.object({ waiting: v.number(), oldestQueuedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("confirmationQueue").withIndex("by_queuedAt").take(QUEUE_MAX);
    return { waiting: rows.length, oldestQueuedAt: rows[0]?.queuedAt ?? null };
  },
});

async function replay(
  ctx: Pick<ActionCtx, "runMutation">,
  kind: string,
  args: Record<string, unknown>,
): Promise<void> {
  const call = { ...args, fromQueue: true };
  // Each module's own validators check the stored arguments on the way in.
  if (kind === "case") await ctx.runMutation(internal.caseAlerts.subscribe, call as never);
  else if (kind === "employer") await ctx.runMutation(internal.employerAlerts.subscribe, call as never);
  else if (kind === "queue") await ctx.runMutation(internal.queueAlerts.subscribe, call as never);
  else if (kind === "bulletin") await ctx.runMutation(internal.bulletinAlerts.subscribe, call as never);
  else if (kind === "prefs") await ctx.runMutation(internal.emailPrefs.requestLink, call as never);
  else throw new Error(`unknown queue kind ${kind}`);
}

/**
 * Send what's waiting, while Resend's count for the day leaves room. Runs
 * right after a request is queued and every 15 minutes (convex/crons.ts).
 */
export const drain = internalAction({
  args: {},
  returns: v.object({ sent: v.number(), room: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.confirmationQueue.hasWaiting, {}))) return { sent: 0, room: 0 };

    const key = process.env.AUTH_RESEND_KEY;
    if (!key) {
      log.error("drain: AUTH_RESEND_KEY is not set; the queue waits");
      return { sent: 0, room: null };
    }
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const sentToday = await countSentToday(async (after) => {
      const { data, error } = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) });
      if (error || !data) {
        log.warn("drain: Resend's list of sent mail couldn't be read", { error: error?.message });
        return null;
      }
      return data as unknown as ResendListPage;
    }, Date.now());
    if (sentToday === null) return { sent: 0, room: null };

    const room = drainRoom(sentToday);
    if (room === 0) {
      log.info("drain: the day's room is used; the queue waits for the UTC day to turn", { sentToday });
      return { sent: 0, room };
    }

    const rows = await ctx.runMutation(internal.confirmationQueue.claim, { limit: room });
    let sent = 0;
    for (const row of rows) {
      try {
        await replay(ctx, row.kind, JSON.parse(row.payload) as Record<string, unknown>);
        await ctx.runMutation(internal.confirmationQueue.settle, { id: row.id, done: true });
        sent++;
      } catch (e) {
        log.error("drain: a replay failed; it stays queued", {
          kind: row.kind,
          error: e instanceof Error ? e.message : String(e),
        });
        await ctx.runMutation(internal.confirmationQueue.settle, { id: row.id, done: false });
      }
    }
    if (sent > 0) log.info("drain: queued confirmations released", { sent, sentToday });
    return { sent, room };
  },
});
