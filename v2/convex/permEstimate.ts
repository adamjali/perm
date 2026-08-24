import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  measureFrontierAdvance,
  measureFrontierAdvanceRange,
} from "./lib/perm/calculators/queueEstimate";
import { measurePwdClearance } from "./lib/perm/calculators/pwdQueue";

/**
 * Inputs for the public PERM decision-date estimator.
 *
 * Returns DATA, not an answer. `estimateQueueDecision` in
 * `convex/lib/perm/calculators/queueEstimate.ts` is a pure function re-exported
 * to the frontend, so a page fetches this once and then recomputes locally as
 * someone changes the date. That keeps typing instant, keeps one copy of the
 * math, and lets the server-rendered HTML carry real numbers for crawlers.
 */

/**
 * Frontier points to measure the advance rate over.
 *
 * The choice matters and is not neutral: measured on the real FY2025+FY2026
 * union, DOL's frontier advanced 1.05 filing-months per calendar month over 20
 * months, and 2.00 over the last three. Quoting either alone would be a
 * position taken silently. Six points is roughly two quarters, long enough to
 * survive one slow month and short enough to reflect DOL's current pace, and
 * the window is returned alongside the rate so a page can state it.
 */
const FRONTIER_WINDOW_POINTS = 6;

export const getEstimatorData = query({
  args: {},
  returns: v.object({
    frontier: v.union(
      v.object({
        analystQueueMonth: v.string(),
        officialAvgDays: v.union(v.number(), v.null()),
        asOf: v.string(),
      }),
      v.null(),
    ),
    cohorts: v.array(
      v.object({
        cohortMonth: v.string(),
        decided: v.number(),
        p25: v.union(v.number(), v.null()),
        p50: v.union(v.number(), v.null()),
        p75: v.union(v.number(), v.null()),
        p90: v.union(v.number(), v.null()),
      }),
    ),
    frontierAdvance: v.union(
      v.object({
        /** Filing months cleared per calendar month. */
        rate: v.number(),
        fromMonth: v.string(),
        toMonth: v.string(),
        pointsUsed: v.number(),
        /** Slowest and fastest advance observed across the whole series. */
        slowest: v.union(v.number(), v.null()),
        fastest: v.union(v.number(), v.null()),
      }),
      v.null(),
    ),
    /**
     * The reconstructed frontier series, oldest first.
     *
     * Returned in full rather than only as a rate so a page can plot it. The
     * rate is one number derived from this; the series is the evidence.
     */
    frontierHistory: v.array(
      v.object({
        decisionMonth: v.string(),
        medianFilingMonth: v.string(),
        decisions: v.number(),
      }),
    ),
    /** Provenance, so a page can cite what it is showing. */
    disclosure: v.union(
      v.object({
        sourceFiles: v.array(v.string()),
        uniqueCases: v.number(),
        computedAt: v.number(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_fetched")
      .order("desc")
      .first();

    let frontier = null;
    if (snapshot) {
      const analyst = snapshot.permQueues.find((q) =>
        q.queue.toLowerCase().includes("analyst"),
      );
      const avgRow = snapshot.permAverageDays.find((a) =>
        a.determination.toLowerCase().includes("analyst"),
      );
      // A queue row with no readable priority date is DOL printing "--". That
      // is a real state, not a parse failure, and it means there is no frontier
      // to position a case against.
      if (analyst && analyst.priorityDate) {
        frontier = {
          analystQueueMonth: analyst.priorityDate.slice(0, 7),
          officialAvgDays: avgRow && avgRow.calendarDays !== null ? avgRow.calendarDays : null,
          asOf: snapshot.permAsOf,
        };
      }
    }

    const stats = await ctx.db
      .query("permDisclosureStats")
      .withIndex("by_computed")
      .order("desc")
      .first();

    let frontierAdvance = null;
    if (stats && stats.frontierHistory.length >= 2) {
      const ordered = [...stats.frontierHistory].sort((a, b) =>
        a.decisionMonth.localeCompare(b.decisionMonth),
      );
      const window = ordered.slice(-FRONTIER_WINDOW_POINTS);
      const first = window[0];
      const last = window[window.length - 1];
      if (first && last) {
        // measureFrontierAdvance takes dated observations; a decision month is
        // dated to its first day, which is enough to resolve a monthly rate.
        const rate = measureFrontierAdvance(
          window.map((p) => ({
            observedOn: `${p.decisionMonth}-01`,
            queueMonth: p.medianFilingMonth,
          })),
        );
        if (rate !== null) {
          // The range is measured across the FULL series, not just the recent
          // window: the point of a band is to carry how much the pace has
          // actually varied, and a short window has not seen enough of it.
          const observed = measureFrontierAdvanceRange(
            ordered.map((p) => ({
              observedOn: `${p.decisionMonth}-01`,
              queueMonth: p.medianFilingMonth,
            })),
          );
          frontierAdvance = {
            rate,
            fromMonth: first.decisionMonth,
            toMonth: last.decisionMonth,
            pointsUsed: window.length,
            slowest: observed ? observed.slowest : null,
            fastest: observed ? observed.fastest : null,
          };
        }
      }
    }

    return {
      frontier,
      cohorts: stats ? stats.cohorts : [],
      frontierHistory: stats
        ? [...stats.frontierHistory].sort((a, b) =>
            a.decisionMonth.localeCompare(b.decisionMonth),
          )
        : [],
      frontierAdvance,
      disclosure: stats
        ? {
            sourceFiles: stats.sourceFiles,
            uniqueCases: stats.uniqueCases,
            computedAt: stats.computedAt,
          }
        : null,
    };
  },
});

/**
 * Inputs for the prevailing wage determination estimator.
 *
 * Better data than the PERM estimator has: DOL publishes PWD requests still
 * PENDING per month of receipt, so requests ahead of a case can be counted
 * outright. What it does not publish is how fast that backlog drains, which is
 * why `clearancePerMonth` is measured from consecutive snapshots and stays
 * null until there are two.
 */
export const getPwdEstimatorData = query({
  args: {},
  returns: v.object({
    frontier: v.union(
      v.object({
        oewsMonth: v.union(v.string(), v.null()),
        nonOewsMonth: v.union(v.string(), v.null()),
      }),
      v.null(),
    ),
    backlog: v.array(
      v.object({ receiptMonth: v.string(), remainingRequests: v.number() }),
    ),
    asOf: v.union(v.string(), v.null()),
    clearancePerMonth: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    // Two snapshots: the newest for the figures, the oldest available for the
    // drain rate. `take(2)` is not enough, because consecutive weekly snapshots are
    // days apart and `measurePwdClearance` needs a month of separation, so the
    // comparison reaches back through the history instead.
    const snapshots = await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_fetched")
      .order("desc")
      .take(60);

    const latest = snapshots[0];
    if (!latest) {
      return { frontier: null, backlog: [], asOf: null, clearancePerMonth: null };
    }

    const permRow = latest.pwdQueues.find((q) => q.program.toUpperCase() === "PERM");

    let clearancePerMonth: number | null = null;
    const latestAsOf = latest.pwdAsOf;
    if (latestAsOf) {
      // Walk back to the oldest snapshot whose PWD as-of date differs, which is
      // the widest real measurement window available.
      for (let i = snapshots.length - 1; i > 0; i -= 1) {
        const older = snapshots[i];
        if (!older || !older.pwdAsOf || older.pwdAsOf >= latestAsOf) continue;
        clearancePerMonth = measurePwdClearance(
          { asOf: older.pwdAsOf, backlog: older.pwdPermBacklog },
          { asOf: latestAsOf, backlog: latest.pwdPermBacklog },
        );
        if (clearancePerMonth !== null) break;
      }
    }

    return {
      frontier: permRow
        ? { oewsMonth: permRow.oewsReceiptDate, nonOewsMonth: permRow.nonOewsReceiptDate }
        : null,
      backlog: latest.pwdPermBacklog,
      asOf: latestAsOf === undefined ? null : latestAsOf,
      clearancePerMonth,
    };
  },
});
