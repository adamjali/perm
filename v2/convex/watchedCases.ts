import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

/**
 * Every case number someone is waiting to hear about, for the hourly check.
 *
 * WHY THIS EXISTS (2026-09-26). The full sweep asks DOL about every case twice
 * a day, so a watched case could change status and the subscriber hear about
 * it up to twelve hours later. Two rivals now sell "hourly checks" as a paid
 * plan. `watched-cases.yml` runs every hour, reads this list, asks DOL about
 * only these numbers (a few hundred at most, 50 per request), writes any
 * change through the same Python writer the daily sweeps use, and then runs
 * the existing alert sweeps. Nothing about who is watching leaves Convex: the
 * workflow receives case numbers only, never an address or an endpoint.
 *
 * Email alerts count once confirmed and until unsubscribed or closed; browser
 * push alerts until closed. Numbers are uppercased and deduplicated, and the
 * list is capped so a flood of sign-ups cannot turn an hourly job into a
 * full sweep.
 */
export const WATCHED_CAP = 2_000;

export const watchedCaseNumbers = internalQuery({
  args: {},
  returns: v.object({
    caseNumbers: v.array(v.string()),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const out = new Set<string>();

    const email = ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_alert_sweep", (q) =>
        q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined),
      );
    for await (const row of email) {
      if (row.confirmedAt === undefined) continue;
      out.add(row.caseNumber.trim().toUpperCase());
      if (out.size >= WATCHED_CAP) return { caseNumbers: [...out].sort(), capped: true };
    }

    const push = ctx.db
      .query("caseStatusPushAlerts")
      .withIndex("by_closed", (q) => q.eq("closedAt", undefined));
    for await (const row of push) {
      out.add(row.caseNumber.trim().toUpperCase());
      if (out.size >= WATCHED_CAP) return { caseNumbers: [...out].sort(), capped: true };
    }

    return { caseNumbers: [...out].sort(), capped: false };
  },
});
