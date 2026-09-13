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
  {
    recorded: "2026-09-13",
    caseNumber: "G-300-25324-425356",
    filed: "2025-11-20",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around 27 September 2026",
    anchorIso: "2026-09-27",
    windowFrom: "2026-09-25",
    windowTo: "2026-10-03",
    note:
      "The first predictions from the decision-pace model, which became the lead model on 13 September 2026: cases ahead from the live census divided by DOL's measured 625 decisions a calendar day, band from that rate's own p10/p90. Recorded across four filing months on purpose - a model that is only ever scored near the frontier is never tested at the horizon where it can be most wrong. permupdate, queried the same day for the same filing dates, sat 6 to 16 days earlier.",
  },
  {
    recorded: "2026-09-13",
    caseNumber: "G-200-26015-564165",
    filed: "2026-01-15",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around 2 November 2026",
    anchorIso: "2026-11-02",
    windowFrom: "2026-10-23",
    windowTo: "2026-11-20",
    note:
      "The first predictions from the decision-pace model, which became the lead model on 13 September 2026: cases ahead from the live census divided by DOL's measured 625 decisions a calendar day, band from that rate's own p10/p90. Recorded across four filing months on purpose - a model that is only ever scored near the frontier is never tested at the horizon where it can be most wrong. permupdate, queried the same day for the same filing dates, sat 6 to 16 days earlier.",
  },
  {
    recorded: "2026-09-13",
    caseNumber: "G-200-26075-707139",
    filed: "2026-03-16",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around 25 November 2026",
    anchorIso: "2026-11-25",
    windowFrom: "2026-11-12",
    windowTo: "2026-12-22",
    note:
      "The first predictions from the decision-pace model, which became the lead model on 13 September 2026: cases ahead from the live census divided by DOL's measured 625 decisions a calendar day, band from that rate's own p10/p90. Recorded across four filing months on purpose - a model that is only ever scored near the frontier is never tested at the horizon where it can be most wrong. permupdate, queried the same day for the same filing dates, sat 6 to 16 days earlier.",
  },
  {
    recorded: "2026-09-13",
    caseNumber: "G-300-26166-017385",
    filed: "2026-06-15",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around 1 January 2027",
    anchorIso: "2027-01-01",
    windowFrom: "2026-12-11",
    windowTo: "2027-02-10",
    note:
      "The first predictions from the decision-pace model, which became the lead model on 13 September 2026: cases ahead from the live census divided by DOL's measured 625 decisions a calendar day, band from that rate's own p10/p90. Recorded across four filing months on purpose - a model that is only ever scored near the frontier is never tested at the horizon where it can be most wrong. permupdate, queried the same day for the same filing dates, sat 6 to 16 days earlier.",
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
