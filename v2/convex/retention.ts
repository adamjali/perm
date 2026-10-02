/**
 * Retention for the backend's operational logs.
 *
 * Three tables have no other cleanup: systemErrors, marketingEvents and
 * apiUsage. They're records of what the machinery did, not anyone's data,
 * and none is read past a few
 * weeks: the admin panel shows recent errors, the morning report reads one
 * day of usage. So each keeps a margin well past its readers and the rest goes,
 * in batches so a backlog can never make one run too big.
 *
 * The run also starts `toolCache.cleanExpired`. Chat tool results expire by
 * their own TTL rather than by age, so that cleanup lives with the cache.
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
} as const;

/** Rows one run deletes per table; a longer backlog reschedules itself. */
const BATCH = 500;

export const pruneOperationalLogs = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({
    systemErrors: v.number(),
    marketingEvents: v.number(),
    apiUsage: v.number(),
    emailDays: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const out = { systemErrors: 0, marketingEvents: 0, apiUsage: 0, emailDays: 0 };
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
    // Guarded on progress, so an empty table can never spin a timer.
    if (more) await ctx.scheduler.runAfter(0, internal.retention.pruneOperationalLogs, { now });
    // Once per daily run: the last run of the chain is the one with no backlog left.
    else await ctx.scheduler.runAfter(0, internal.toolCache.cleanExpired, {});
    return out;
  },
});
