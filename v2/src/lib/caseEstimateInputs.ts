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

import { casesAheadOfDay, type MonthQueue } from "@/lib/queueAhead";

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
}): { casesAhead: number | null; sweepAgeDays: number | null } {
  const { backlog, filingDate, sweepFinishedOn, today } = input;
  // A MISSING SWEEP RECORD IS NOT TREATED AS STALE: `getDecisionPace` refuses
  // a series whose newest day is more than three days old, and the same sweep
  // writes it, so a stopped sweep takes the pace with it.
  const sweepAgeDays = sweepFinishedOn
    ? Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sweepFinishedOn}T00:00:00Z`)) /
          86_400_000,
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
  return { casesAhead, sweepAgeDays };
}
