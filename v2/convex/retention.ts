/**
 * Retention for the backend's operational logs.
 *
 * These tables have no other cleanup: systemErrors, marketingEvents,
 * apiUsage, emailDays and chatConfirmations. They're records of what the machinery did, not anyone's data,
 * and none is read past a few
 * weeks: the admin panel shows recent errors, the morning report reads one
 * day of usage. So each keeps a margin well past its readers and the rest goes,
 * in batches so a backlog can never make one run too big.
 *
 * The run also starts `toolCache.cleanExpired` (chat tool results expire by
 * their own TTL rather than by age, so that cleanup lives with the cache) and
 * `inboundFilter.pruneHeld` (mail the spam filter held, 30 days after it was held).
 *
 * Not here, on purpose: `auditLogs` (kept indefinitely by the retention
 * policy, docs/compliance/DATA_RETENTION.md, and removed with an account),
 * people's own content (cases, notes, messages sent to us), and the tables
 * that already have their own cleanup (notifications, conversations, rate
 * limits, the alert outbox, daily reports, budget refusals).
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { MS_PER_DAY } from "./lib/time";

/** Days each table keeps. Read by the tests and the retention doc. */
export const RETENTION_DAYS = {
  systemErrors: 180,
  marketingEvents: 365,
  apiUsage: 90,
  /** One row per UTC day of email counts (convex/emailLedger.ts); a year and a bit of history. */
  emailDays: 400,
  /** The chat's confirmation cards (convex/chatConfirmations.ts); each expires after a day. */
  chatConfirmations: 30,
} as const;

/** Rows one run deletes per table; a longer backlog reschedules itself. */
const BATCH = 500;

/**
 * A case-alert sign-up nobody confirmed in this many days is dropped. Such
 * rows hold an address that never said yes, are never mailed, and sit at the
 * front of the sweep's index (never checked), so every 5-minute sweep re-read
 * them. The confirmation link in the email stops working after this.
 */
export const UNCONFIRMED_CASE_ALERT_DAYS = 30;

export const pruneOperationalLogs = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({
    systemErrors: v.number(),
    marketingEvents: v.number(),
    apiUsage: v.number(),
    emailDays: v.number(),
    chatConfirmations: v.number(),
    unconfirmedCaseAlerts: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const out = { systemErrors: 0, marketingEvents: 0, apiUsage: 0, emailDays: 0, chatConfirmations: 0, unconfirmedCaseAlerts: 0 };
    let more = false;
    for (const table of Object.keys(RETENTION_DAYS) as (keyof typeof RETENTION_DAYS)[]) {
      const cutoff = now - RETENTION_DAYS[table] * MS_PER_DAY;
      const old = await ctx.db
        .query(table)
        .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
        .take(BATCH + 1);
      for (const row of old.slice(0, BATCH)) await ctx.db.delete(row._id);
      out[table] = Math.min(old.length, BATCH);
      if (old.length > BATCH) more = true;
    }
    // Never-checked live rows lead the sweep's index; the unconfirmed ones
    // among them past the horizon go.
    const staleBefore = now - UNCONFIRMED_CASE_ALERT_DAYS * MS_PER_DAY;
    let looked = 0;
    for await (const row of ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_alert_sweep", (q) =>
        q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined).eq("lastCheckedAt", undefined),
      )) {
      if (++looked > BATCH * 4) {
        more = true;
        break;
      }
      if (row.confirmedAt !== undefined || row._creationTime >= staleBefore) continue;
      await ctx.db.delete(row._id);
      if (++out.unconfirmedCaseAlerts >= BATCH) {
        more = true;
        break;
      }
    }
    // Guarded on progress, so an empty table can never spin a timer.
    if (more) await ctx.scheduler.runAfter(0, internal.retention.pruneOperationalLogs, { now });
    // Once per daily run: the last run of the chain is the one with no backlog left.
    else {
      await ctx.scheduler.runAfter(0, internal.toolCache.cleanExpired, {});
      // Mail the spam filter held, 30 days after it was held (convex/inboundFilter.ts).
      await ctx.scheduler.runAfter(0, internal.inboundFilter.pruneHeld, {});
    }
    return out;
  },
});
