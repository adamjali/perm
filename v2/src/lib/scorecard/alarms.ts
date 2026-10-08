/**
 * The scorecard's alarms: the few things about our own estimates that need a
 * person, worked out where the summaries are written so the morning email,
 * the admin page and anything else read one list.
 *
 * MEASURES PROGRESS, NOT ACTIVITY. A day with no new grade is normal (DOL
 * decides in bursts, and a young record has few dates due), so nothing here
 * fires on a quiet day. Each alarm needs evidence that something should have
 * happened and didn't, or that the misses moved:
 *
 *   recording stopped   a program that was being recorded has nothing for
 *                       RECORD_GAP_DAYS: the daily run is failing
 *   grades stopped      at least DUE_FLOOR predicted dates passed a week ago
 *                       or more, and no case was graded for GRADE_GAP_DAYS:
 *                       the grading or the sweep behind it has stopped
 *   the miss worsened   the last RECENT_DAYS' typical miss, on at least
 *                       RECENT_FLOOR cases, is over twice the whole record's
 *                       and more than a week worse
 *   a weekly test stale a standing backtest older than BACKTEST_DAYS
 *
 * Plain module, pure functions.
 */

import { daysBetween } from "@/lib/time";

import { isGradedOutcome, type PredictionRow, type Program } from "./score";

export const RECORD_GAP_DAYS = 2;
export const DUE_FLOOR = 10;
export const GRADE_GAP_DAYS = 10;
export const RECENT_DAYS = 14;
export const RECENT_FLOOR = 10;
export const BACKTEST_DAYS = 9;

const LABEL: Record<Program, string> = {
  perm: "PERM decision dates",
  pwd: "Wage-request months",
  seasonal: "H-2A, H-2B and CW-1 dates",
  bulletin: "Visa bulletin release days",
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const latest = (xs: (string | null)[]): string | null =>
  xs.reduce<string | null>((a, x) => (x && (a === null || x > a) ? x : a), null);

export interface BacktestAge {
  /** What the test is, in words: "The weekly PERM backtest". */
  label: string;
  /** When it last wrote, ms since the epoch; null when it never has. */
  computedAt: number | null;
}

/** Our own estimates' alarms, as sentences, most urgent first. Empty when all is well. */
export function scorecardAlarms(
  rows: readonly PredictionRow[],
  today: string,
  backtests: readonly BacktestAge[] = [],
): string[] {
  const out: string[] = [];
  for (const program of ["perm", "pwd", "seasonal", "bulletin"] as const) {
    const mine = rows.filter((r) => r.source === "ours" && r.program === program);
    if (mine.length === 0) continue;
    const label = LABEL[program];

    const lastRecorded = latest(mine.map((r) => r.recordedOn));
    if (lastRecorded && daysBetween(lastRecorded, today) > RECORD_GAP_DAYS) {
      out.push(`${label}: nothing recorded since ${lastRecorded}. The daily scorecard run may be failing.`);
    }

    const graded = mine.filter((r) => r.decidedOn && isGradedOutcome(r.outcome, r.program));
    const due = mine.filter((r) => daysBetween(r.predicted, today) >= 7).length;
    const lastGraded = latest(graded.map((r) => r.decidedOn));
    if (due >= DUE_FLOOR && (lastGraded === null || daysBetween(lastGraded, today) > GRADE_GAP_DAYS)) {
      out.push(
        `${label}: no case graded ${lastGraded ? `since ${lastGraded}` : "yet"}, though ${due} predicted dates passed a week ago or more. The grading or the sweep behind it may have stopped.`,
      );
    }

    if (graded.length >= RECENT_FLOOR * 2) {
      const miss = (r: PredictionRow) => Math.abs(daysBetween(r.predicted, r.decidedOn!));
      const recent = graded.filter((r) => daysBetween(r.decidedOn!, today) <= RECENT_DAYS);
      if (recent.length >= RECENT_FLOOR) {
        const now = median(recent.map(miss));
        const all = median(graded.map(miss));
        if (now > 2 * all && now > all + 7) {
          out.push(
            `${label}: the last ${RECENT_DAYS} days' typical miss is ${Math.round(now)} days on ${recent.length} cases, against ${Math.round(all)} over the whole record.`,
          );
        }
      }
    }
  }
  const now = Date.parse(`${today}T12:00:00Z`);
  for (const b of backtests) {
    if (b.computedAt === null) continue;
    const age = Math.floor((now - b.computedAt) / 86_400_000);
    if (age > BACKTEST_DAYS) out.push(`${b.label} last ran ${age} days ago; it runs weekly.`);
  }
  return out;
}
