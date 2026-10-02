/**
 * The day's email count against Resend's quota, and the queue of sends that
 * failed and will be tried again.
 *
 * No email is refused and lost. Every sender goes through `sendOrQueue` in
 * convex/lib/email.ts, which checks the day's count, sends, records the count,
 * and hands a send that failed for a fixable reason to this queue. The drain
 * in convex/confirmationQueue.ts (every 15 minutes, and right after anything
 * is queued) sends what is due while the day has room.
 *
 * What is never lost: a Resend outage, its rate or quota limits, the network,
 * a key or domain problem someone fixes. What can't be delivered at all, and
 * is recorded as an error instead: a recipient on the blocklist, a malformed
 * request. What gives up: a send still failing after two weeks, or one that
 * arrives while 1,000 are already waiting; each is counted as lost and the
 * admin is emailed the same day.
 */
import { v } from "convex/values";
import type { Resend } from "resend";
import { internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  RETRY_EXPIRE_MS,
  RETRY_MAX_PAYLOAD,
  RETRY_MAX_ROWS,
  isQuotaError,
  isRetryableSendError,
  nextRetryAt,
  usedToday,
  utcDay,
} from "./lib/emailLimits";
import { createLogger } from "./lib/logging";
import { MS_PER_MINUTE } from "./lib/time";

const log = createLogger("EmailLedger");

/** A drain's claim on a retry row; older than this, another drain may take it. */
const CLAIM_LEASE_MS = 10 * MS_PER_MINUTE;
/** Retries past their two weeks dropped per claim. */
const EXPIRED_BATCH = 100;

async function dayRow(ctx: MutationCtx, now: number): Promise<Doc<"emailDays">> {
  const day = utcDay(now);
  const row = await ctx.db
    .query("emailDays")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  if (row) return row;
  const id = await ctx.db.insert("emailDays", { day, sent: 0 });
  return (await ctx.db.get(id))!;
}

/** What today has used, the larger of our count and Resend's. */
export const accountUsed = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => usedToday(ctx, Date.now()),
});

/** One email left. `quota` is Resend's own count from the send's response, when it gave one. */
export const recordSend = internalMutation({
  args: { quota: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await dayRow(ctx, Date.now());
    const patch: Partial<Doc<"emailDays">> = { sent: row.sent + 1 };
    if (args.quota !== undefined && args.quota > (row.reported ?? 0)) patch.reported = args.quota;
    await ctx.db.patch(row._id, patch);
    return null;
  },
});

/** Resend's own count for today (its list of sent mail plus a margin for received). */
export const noteReported = internalMutation({
  args: { count: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await dayRow(ctx, Date.now());
    if (args.count > (row.reported ?? 0)) await ctx.db.patch(row._id, { reported: args.count });
    return null;
  },
});

async function countOnDay(ctx: MutationCtx, field: "retried" | "lost", n = 1): Promise<Doc<"emailDays">> {
  const row = await dayRow(ctx, Date.now());
  await ctx.db.patch(row._id, { [field]: (row[field] ?? 0) + n });
  return row;
}

/** The once-a-day admin email about failed sends. */
async function alertOnce(ctx: MutationCtx, row: Doc<"emailDays">, subject: string, body: string) {
  if (row.alertedAt !== undefined) return;
  await ctx.db.patch(row._id, { alertedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, { subject, body });
}

/**
 * Keep a send that failed for a fixable reason. `quota` means Resend refused
 * on its daily or monthly count, so the first retry waits for the next UTC day.
 */
export const enqueueRetry = internalMutation({
  args: {
    kind: v.string(),
    to: v.string(),
    payload: v.string(),
    error: v.string(),
    quota: v.boolean(),
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.payload.length > RETRY_MAX_PAYLOAD) {
      const row = await countOnDay(ctx, "lost");
      await alertOnce(ctx, row, "An email failed and was too large to keep", failedBody(args.kind, args.error, "it was too large to store for a retry"));
      return { ok: false, reason: "too large to keep" };
    }
    const held = await ctx.db.query("emailRetries").withIndex("by_queuedAt").take(RETRY_MAX_ROWS);
    if (held.length >= RETRY_MAX_ROWS) {
      const row = await countOnDay(ctx, "lost");
      await alertOnce(ctx, row, "The email retry queue is full", failedBody(args.kind, args.error, `${RETRY_MAX_ROWS} failed emails were already waiting`));
      return { ok: false, reason: "retry queue full" };
    }
    await ctx.db.insert("emailRetries", {
      kind: args.kind,
      to: args.to,
      payload: args.payload,
      queuedAt: now,
      nextAttemptAt: nextRetryAt(0, now, args.quota),
      attempts: 0,
      lastError: args.error.slice(0, 500),
    });
    const row = await countOnDay(ctx, "retried");
    await alertOnce(
      ctx,
      row,
      "An email failed to send and was queued to retry",
      `A ${args.kind} email failed to send (${args.error.slice(0, 200)}) and was put in the retry queue. ` +
        `It is tried again automatically${args.quota ? " after Resend's daily count resets at midnight UTC (8 PM Eastern in summer)" : " in 5 minutes, then on a backoff"}, ` +
        `for up to two weeks. The admin page's Alerts and email tab shows how many are waiting. This email comes at most once a day.`,
    );
    log.warn("send failed; queued for retry", { kind: args.kind, quota: args.quota });
    return { ok: true };
  },
});

function failedBody(kind: string, error: string, why: string): string {
  return (
    `A ${kind} email failed to send (${error.slice(0, 200)}) and could not be queued for a retry: ${why}. ` +
    `It is counted as lost on the admin page. This email comes at most once a day.`
  );
}

/** True when a retry is due now. */
export const hasDueRetry = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const next = await ctx.db.query("emailRetries").withIndex("by_next").first();
    return next !== null && next.nextAttemptAt <= Date.now();
  },
});

/** Drop retries past two weeks (counted as lost), then claim up to `limit` that are due. */
export const claimRetries = internalMutation({
  args: { limit: v.number() },
  returns: v.array(v.object({ id: v.id("emailRetries"), kind: v.string(), payload: v.string() })),
  handler: async (ctx, args) => {
    const now = Date.now();
    const old = await ctx.db
      .query("emailRetries")
      .withIndex("by_queuedAt", (q) => q.lt("queuedAt", now - RETRY_EXPIRE_MS))
      .take(EXPIRED_BATCH);
    if (old.length > 0) {
      for (const r of old) await ctx.db.delete(r._id);
      const row = await countOnDay(ctx, "lost", old.length);
      await alertOnce(ctx, row, "Queued emails were given up on", failedBody(old[0]!.kind, old[0]!.lastError, "they kept failing for two weeks"));
    }
    const out: { id: Id<"emailRetries">; kind: string; payload: string }[] = [];
    if (args.limit <= 0) return out;
    const due = await ctx.db
      .query("emailRetries")
      .withIndex("by_next", (q) => q.lte("nextAttemptAt", now))
      .take(args.limit * 2 + 10);
    for (const r of due) {
      if (out.length >= args.limit) break;
      if (r.claimedAt !== undefined && now - r.claimedAt < CLAIM_LEASE_MS) continue;
      await ctx.db.patch(r._id, { claimedAt: now, attempts: r.attempts + 1 });
      out.push({ id: r._id, kind: r.kind, payload: r.payload });
    }
    return out;
  },
});

/** A retry was tried: sent (delete), failed for good (delete, count lost), or failed again (reschedule). */
export const settleRetry = internalMutation({
  args: {
    id: v.id("emailRetries"),
    ok: v.boolean(),
    error: v.optional(v.object({ name: v.string(), message: v.string() })),
    quota: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const now = Date.now();
    if (args.ok) {
      await ctx.db.delete(row._id);
      const day = await dayRow(ctx, now);
      const patch: Partial<Doc<"emailDays">> = { sent: day.sent + 1 };
      if (args.quota !== undefined && args.quota > (day.reported ?? 0)) patch.reported = args.quota;
      await ctx.db.patch(day._id, patch);
      return null;
    }
    const err = args.error ?? { name: "unknown", message: "unknown" };
    if (!isRetryableSendError(err)) {
      await ctx.db.delete(row._id);
      const day = await countOnDay(ctx, "lost");
      await alertOnce(ctx, day, "A queued email could not be delivered", failedBody(row.kind, `${err.name}: ${err.message}`, "the retry was refused for good"));
      return null;
    }
    await ctx.db.patch(row._id, {
      claimedAt: undefined,
      nextAttemptAt: nextRetryAt(row.attempts, now, isQuotaError(err)),
      lastError: `${err.name}: ${err.message}`.slice(0, 500),
    });
    return null;
  },
});

/** What the admin page and the morning report show. */
export const retrySummary = internalQuery({
  args: {},
  returns: v.object({
    waiting: v.number(),
    oldestQueuedAt: v.union(v.number(), v.null()),
    usedToday: v.number(),
    retriedToday: v.number(),
    lostToday: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("emailRetries").withIndex("by_queuedAt").take(RETRY_MAX_ROWS);
    const day = await ctx.db
      .query("emailDays")
      .withIndex("by_day", (q) => q.eq("day", utcDay(now)))
      .unique();
    return {
      waiting: rows.length,
      oldestQueuedAt: rows[0]?.queuedAt ?? null,
      usedToday: day ? Math.max(day.sent, day.reported ?? 0) : 0,
      retriedToday: day?.retried ?? 0,
      lostToday: day?.lost ?? 0,
    };
  },
});

/**
 * Send up to `room` due retries. Returns how many left. Called by the drain in
 * convex/confirmationQueue.ts, which has already measured the day's room.
 */
export async function drainRetries(ctx: ActionCtx, resend: Resend, room: number): Promise<number> {
  if (room <= 0) return 0;
  const { sendEmailWithRetry } = await import("./lib/email");
  const rows: { id: Id<"emailRetries">; kind: string; payload: string }[] = await ctx.runMutation(
    internal.emailLedger.claimRetries,
    { limit: room },
  );
  let sent = 0;
  for (const row of rows) {
    let params: Parameters<Resend["emails"]["send"]>[0];
    try {
      params = JSON.parse(row.payload);
    } catch {
      await ctx.runMutation(internal.emailLedger.settleRetry, {
        id: row.id,
        ok: false,
        error: { name: "validation_error", message: "stored email could not be read" },
      });
      continue;
    }
    const result = await sendEmailWithRetry(resend, params);
    if (result.error) {
      await ctx.runMutation(internal.emailLedger.settleRetry, { id: row.id, ok: false, error: result.error });
    } else {
      await ctx.runMutation(internal.emailLedger.settleRetry, { id: row.id, ok: true, quota: result.quota });
      sent++;
    }
  }
  return sent;
}
