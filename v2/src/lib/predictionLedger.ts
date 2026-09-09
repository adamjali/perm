/**
 * Predictions the product made for real cases, written down before the
 * outcome so they can be scored afterwards.
 *
 * The prose ledger is `../.planning/prediction-ledger.md`; this file is the
 * structured copy the scorecard page renders, and the two are kept in step by
 * hand (a test asserts every case number here appears in the markdown when
 * the file is present). Entries are never edited after they are recorded: a
 * model change that would move a prediction gets a new dated entry, and the
 * old one is still the one that gets scored.
 *
 * Case numbers are public federal records. Never a subscriber's name or
 * address.
 */

export interface Prediction {
  /** ISO date the prediction was recorded. */
  recorded: string;
  caseNumber: string;
  /** ISO filing date, decoded from the case number or DOL's record. */
  filed: string;
  statusAtPrediction: string;
  /** The anchor as the page printed it. */
  anchor: string;
  /** The anchor's date, for scoring in days. */
  anchorIso: string;
  /** The window as the page printed it, ISO bounds inclusive. */
  windowFrom: string;
  windowTo: string;
  note?: string;
}

export const PREDICTIONS: Prediction[] = [
  {
    recorded: "2026-08-28",
    caseNumber: "G-100-25324-425560",
    filed: "2025-11-20",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around November 2026",
    anchorIso: "2026-11-27",
    windowFrom: "2026-09-01",
    windowTo: "2026-11-30",
    note:
      "The product's first real alert subscriber's case, recorded as /perm-case-status showed it on August 28, 2026. The next day the estimator gained a measured employer-initial shift, worth +2 days for this employer; the prediction of record is the earlier one and the shift does not move it outside its window.",
  },
];

export interface Score {
  /** Signed days: positive means DOL decided after the anchor. */
  errorDays: number;
  absErrorDays: number;
  inWindow: boolean;
}

const dayMs = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

/** Score one prediction against the day DOL decided. */
export function scorePrediction(p: Prediction, decidedOn: string): Score {
  const errorDays = days(p.anchorIso, decidedOn);
  return {
    errorDays,
    absErrorDays: Math.abs(errorDays),
    inWindow: decidedOn >= p.windowFrom && decidedOn <= p.windowTo,
  };
}

/** Median of absolute errors and the share inside the window, over scored predictions. */
export function summarizeScores(scores: Score[]): { n: number; medianAbsErrorDays: number | null; inWindowShare: number | null } {
  if (scores.length === 0) return { n: 0, medianAbsErrorDays: null, inWindowShare: null };
  const sorted = scores.map((s) => s.absErrorDays).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  return { n: scores.length, medianAbsErrorDays: median, inWindowShare: scores.filter((s) => s.inWindow).length / scores.length };
}

/** Days from `today` to the anchor; negative once the anchor has passed. */
export function daysToAnchor(p: Prediction, today: string): number {
  return days(today, p.anchorIso);
}
