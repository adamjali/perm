/**
 * The two derived inputs the case page hands the estimate: cases ahead, and
 * how old the sweep's record is.
 *
 * ONE FUNCTION, TWO CALLERS, ON PURPOSE. The case page renders an estimate and
 * the daily scorecard records one (`/api/cron/scorecard`). If they computed
 * these separately, the scorecard would grade a number no reader was ever
 * shown, which is the one thing a scorecard must not do. Both call this.
 *
 * Plain module (no server-only) so the unit project can test it.
 */

import { estimateByPace, type MeasuredPace } from "@/lib/perm";
import { casesAheadOfDay, deriveQueueAhead, inLine, lineAheadByMonth, type LineAheadRow, type MonthQueue } from "@/lib/queueAhead";
import { MS_PER_DAY } from "@/lib/time";

export interface BacklogRow {
  month: string;
  total: number;
  pending: number;
  decided: number;
  decidedPct: number | null;
  analystReview?: number;
}

export function caseEstimateInputs(input: {
  backlog: readonly BacklogRow[];
  filingDate: string | null;
  /** The sweep's own finish date, `YYYY-MM-DD`, or null when unknown. */
  sweepFinishedOn: string | null;
  today: string;
}): { casesAhead: number | null; sweepAgeDays: number | null; lineAhead: LineAheadRow[] | null } {
  const { backlog, filingDate, sweepFinishedOn, today } = input;
  // A MISSING SWEEP RECORD IS NOT TREATED AS STALE: `getDecisionPace` refuses
  // a series whose newest day is more than three days old, and the same sweep
  // writes it, so a stopped sweep takes the pace with it.
  const sweepAgeDays = sweepFinishedOn
    ? Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sweepFinishedOn}T00:00:00Z`)) /
          MS_PER_DAY,
      )
    : null;
  // Prorated by the filing day, and counting only the cases in line
  // (analyst review): see `inLine` in queueAhead.ts.
  const months: MonthQueue[] = backlog.map((m) => ({
    filingMonth: m.month,
    total: m.total,
    pending: m.pending,
    decided: m.decided,
    decidedPct: m.decidedPct,
    analystReview: m.analystReview,
  }));
  const casesAhead = filingDate ? casesAheadOfDay(months, filingDate) : null;
  // The same count split by month, for the page's bars; its rows add up to it.
  const lineAhead = filingDate ? lineAheadByMonth(months, filingDate) : null;
  return { casesAhead, sweepAgeDays, lineAhead };
}

export type MonthEnd =
  | { kind: "estimate"; date: string; casesThrough: number }
  | { kind: "passed"; inLine: number };

/**
 * When DOL's line should reach the END of a filing month: every case in line
 * filed through that month, over DOL's measured pace, through the same
 * `estimateByPace` the case page dates a case with. Null whenever that model
 * refuses (a stale sweep, no pace), so the month page prints no date it
 * couldn't stand behind. A month DOL's published queue has already passed
 * answers with how many of its cases are still in line instead.
 */
export function monthEndDate(input: {
  backlog: readonly BacklogRow[];
  month: string;
  pace: MeasuredPace | null;
  frontierMonth: string | null;
  sweepFinishedOn: string | null;
  today: string;
}): MonthEnd | null {
  const { backlog, month, pace, frontierMonth, sweepFinishedOn, today } = input;
  const months: MonthQueue[] = backlog.map((m) => ({
    filingMonth: m.month, total: m.total, pending: m.pending, decided: m.decided,
    decidedPct: m.decidedPct, analystReview: m.analystReview,
  }));
  const { ahead, subject } = deriveQueueAhead(months, month);
  if (!subject || frontierMonth === null) return null;
  const index = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));
  const monthsBehind = index(month) - index(frontierMonth);
  if (monthsBehind < 0) return { kind: "passed", inLine: inLine(subject) };
  const sweepAgeDays = sweepFinishedOn
    ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sweepFinishedOn}T00:00:00Z`)) / MS_PER_DAY)
    : 0;
  const casesThrough = ahead + inLine(subject);
  const r = estimateByPace({
    today: Math.floor(Date.parse(`${today}T00:00:00Z`) / MS_PER_DAY),
    casesAhead: casesThrough,
    pace,
    status: "ANALYST REVIEW",
    monthsBehindFrontier: monthsBehind,
    sweepAgeDays,
  });
  if (r.kind !== "estimate") return null;
  return { kind: "estimate", date: new Date(r.day * MS_PER_DAY).toISOString().slice(0, 10), casesThrough };
}
