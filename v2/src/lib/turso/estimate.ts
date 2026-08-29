/**
 * Inputs for the PERM decision estimator, assembled from Turso.
 *
 * A faithful port of convex/permEstimate.ts:getEstimatorData. The frontier
 * arithmetic is NOT reimplemented here - `measureFrontierAdvance` and
 * `measureFrontierAdvanceRange` are imported from the canonical PERM logic in
 * convex/lib/perm, the same functions the Convex query called. Recreating
 * deadline or queue arithmetic outside that module is the one thing this
 * codebase forbids outright, and the estimator is exactly where a second
 * implementation would go unnoticed.
 */
import "server-only";

import {
  measureFrontierAdvance,
  measureFrontierAdvanceRange,
  measurePwdClearance,
} from "@/lib/perm";

import { getDisclosureStats, type Cohort, type FrontierPoint } from "./publicData";
import { getProcessingTimes, getProcessingTimesHistory } from "./processingTimes";

/**
 * How many recent observations set the headline pace.
 *
 * Carried over from the original Convex estimator query (since retired). The RANGE below is
 * deliberately measured over the full series instead: a band exists to carry
 * how much the pace has actually varied, and six points have not seen enough
 * of it.
 */
const FRONTIER_WINDOW_POINTS = 6;

export interface EstimatorData {
  frontier: {
    analystQueueMonth: string;
    officialAvgDays: number | null;
    asOf: string;
  } | null;
  cohorts: Cohort[];
  frontierHistory: FrontierPoint[];
  frontierAdvance: {
    rate: number;
    fromMonth: string;
    toMonth: string;
    pointsUsed: number;
    slowest: number | null;
    fastest: number | null;
  } | null;
  disclosure: { sourceFiles: string[]; uniqueCases: number; computedAt: number } | null;
}

export async function getEstimatorData(): Promise<EstimatorData> {
  const [snapshot, stats] = await Promise.all([
    getProcessingTimes(),
    getDisclosureStats(),
  ]);

  let frontier: EstimatorData["frontier"] = null;
  if (snapshot) {
    const analyst = snapshot.permQueues.find((q) =>
      q.queue.toLowerCase().includes("analyst"),
    );
    const avgRow = snapshot.permAverageDays.find((a) =>
      a.determination.toLowerCase().includes("analyst"),
    );
    // A queue row with no readable priority date is DOL printing "--". That is
    // a real state, not a parse failure, and it means there is no frontier to
    // position a case against.
    if (analyst && analyst.priorityDate) {
      frontier = {
        analystQueueMonth: analyst.priorityDate.slice(0, 7),
        officialAvgDays: avgRow && avgRow.calendarDays !== null ? avgRow.calendarDays : null,
        asOf: snapshot.permAsOf,
      };
    }
  }

  const history = stats?.frontierHistory ?? [];
  let frontierAdvance: EstimatorData["frontierAdvance"] = null;
  if (history.length >= 2) {
    const ordered = [...history].sort((a, b) =>
      a.decisionMonth.localeCompare(b.decisionMonth),
    );
    const window = ordered.slice(-FRONTIER_WINDOW_POINTS);
    const first = window[0];
    const last = window[window.length - 1];
    if (first && last) {
      // A decision month is dated to its first day, which is enough to
      // resolve a monthly rate.
      const rate = measureFrontierAdvance(
        window.map((p) => ({
          observedOn: `${p.decisionMonth}-01`,
          queueMonth: p.medianFilingMonth,
        })),
      );
      if (rate !== null) {
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
    cohorts: stats?.cohorts ?? [],
    frontierHistory: [...history].sort((a, b) =>
      a.decisionMonth.localeCompare(b.decisionMonth),
    ),
    frontierAdvance,
    disclosure: stats
      ? {
          sourceFiles: stats.sourceFiles,
          uniqueCases: stats.uniqueCases,
          computedAt: stats.computedAt,
        }
      : null,
  };
}

export interface PwdEstimatorData {
  frontier: { oewsMonth: string | null; nonOewsMonth: string | null } | null;
  backlog: Array<{ receiptMonth: string; remainingRequests: number }>;
  asOf: string | null;
  /**
   * Requests drained per month.
   *
   * NULL UNTIL THE HISTORY IS DEEP ENOUGH, and that is the honest answer
   * rather than a gap. The rate is measured BETWEEN two snapshots whose PWD
   * as-of dates differ by enough to resolve a monthly figure. This store
   * began on 2026-08-25 with a single snapshot, so there is nothing to
   * measure across yet; it fills in once DOL republishes. Inventing a rate
   * from one observation would be fabricating the one number the estimator
   * exists to supply.
   */
  clearancePerMonth: number | null;
}

export async function getPwdEstimatorData(): Promise<PwdEstimatorData> {
  // Two snapshots are not enough: consecutive publications can be days apart
  // and measurePwdClearance needs a month of separation, so the comparison
  // reaches back through the history instead.
  const snapshots = await getProcessingTimesHistory(60);
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
    asOf: latestAsOf ?? null,
    clearancePerMonth,
  };
}
