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

/**
 * What a rival published for the SAME case on the same day.
 *
 * WHY RECORD THEIRS AT ALL. "We match or beat permupdate" is a claim, and a
 * claim about accuracy is only worth anything if it was written down before
 * the outcome. Scoring ourselves alone answers "were we close"; scoring all
 * three answers "were we closer", which is the question actually being asked.
 *
 * Captured from each site's own PUBLIC endpoint on the recorded date, and
 * never edited afterwards. A rival changing their model later does not
 * rewrite what they said on the day - that is the whole point of a ledger.
 */
export interface RivalPrediction {
  site: "permupdate" | "permtrack";
  /** Their headline date, ISO. */
  anchorIso: string;
  /** Their upper bound, or null where they publish none. */
  upperIso: string | null;
  /** Their lower bound. permupdate publishes NO lower bound; theirs is null. */
  lowerIso: string | null;
  /** Which of their models this is, named as plainly as their API allows. */
  model: string;
}

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
  /** What the rivals said for this case on the same day. */
  rivals?: RivalPrediction[];
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
    rivals: [
      {
        site: "permupdate",
        anchorIso: "2026-09-20",
        upperIso: "2026-09-21",
        lowerIso: null,
        model: "cases ahead / 650 a day; upper bound is remaining x 1.15, and they publish no lower bound",
      },
      {
        site: "permtrack",
        anchorIso: "2026-09-19",
        upperIso: "2026-09-23",
        lowerIso: "2026-09-18",
        model: "cases ahead / their measured pace (644 a calendar day: 804 weekday, 243 weekend), from /api/watchlist/predict - the same shape as ours",
      },
    ]
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
    rivals: [
      {
        site: "permupdate",
        anchorIso: "2026-10-26",
        upperIso: "2026-11-01",
        lowerIso: null,
        model: "cases ahead / 650 a day; upper bound is remaining x 1.15, and they publish no lower bound",
      },
      {
        site: "permtrack",
        anchorIso: "2026-10-17",
        upperIso: "2026-11-05",
        lowerIso: "2026-10-15",
        model: "cases ahead / their measured pace (644 a calendar day: 804 weekday, 243 weekend), from /api/watchlist/predict - the same shape as ours",
      },
    ]
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
    rivals: [
      {
        site: "permupdate",
        anchorIso: "2026-11-17",
        upperIso: "2026-11-26",
        lowerIso: null,
        model: "cases ahead / 650 a day; upper bound is remaining x 1.15, and they publish no lower bound",
      },
      {
        site: "permtrack",
        anchorIso: "2026-11-06",
        upperIso: "2026-12-10",
        lowerIso: "2026-11-03",
        model: "cases ahead / their measured pace (644 a calendar day: 804 weekday, 243 weekend), from /api/watchlist/predict - the same shape as ours",
      },
    ]
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
    rivals: [
      {
        site: "permupdate",
        anchorIso: "2026-12-23",
        upperIso: "2027-01-07",
        lowerIso: null,
        model: "cases ahead / 650 a day; upper bound is remaining x 1.15, and they publish no lower bound",
      },
      {
        site: "permtrack",
        anchorIso: "2026-12-09",
        upperIso: "2027-02-02",
        lowerIso: "2026-12-02",
        model: "cases ahead / their measured pace (644 a calendar day: 804 weekday, 243 weekend), from /api/watchlist/predict - the same shape as ours",
      },
    ]
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

/**
 * Score one rival's published answer against the same outcome.
 *
 * DELIBERATELY THE SAME ARITHMETIC AS OURS, and separate only because their
 * band is a different shape: permupdate publishes an upper bound and no lower
 * one, so "inside the window" for them means at-or-before that bound rather
 * than between two. Scoring a one-sided band as if it were two-sided would
 * flatter them on every early decision and is the sort of quiet thumb on the
 * scale that makes a comparison worthless.
 *
 * `inWindow` is null when they publish no bound at all - absent, not false.
 */
export interface RivalScore {
  errorDays: number;
  absErrorDays: number;
  /** null when the site publishes no bound at all - absent, not false. */
  inWindow: boolean | null;
}

export function scoreRival(r: RivalPrediction, decidedOn: string): RivalScore {
  const errorDays = days(r.anchorIso, decidedOn);
  let inWindow: boolean | null = null;
  if (r.lowerIso && r.upperIso) {
    inWindow = decidedOn >= r.lowerIso && decidedOn <= r.upperIso;
  } else if (r.upperIso) {
    // One-sided and upward only: anything at or before the bound counts.
    inWindow = decidedOn <= r.upperIso;
  }
  return { errorDays, absErrorDays: Math.abs(errorDays), inWindow };
}

/**
 * Every scored answer for one case, ours first.
 *
 * Ours is labelled `permtracker` so the three read as peers in the output.
 * A comparison that renders our own row differently from the others invites
 * exactly the reading it should not.
 */
export function scoreAll(
  p: Prediction,
  decidedOn: string,
): Array<{ site: string; anchorIso: string; model: string | null; score: RivalScore }> {
  const ours = scorePrediction(p, decidedOn);
  return [
    {
      site: "permtracker",
      anchorIso: p.anchorIso,
      model: null,
      score: { errorDays: ours.errorDays, absErrorDays: ours.absErrorDays, inWindow: ours.inWindow },
    },
    ...(p.rivals ?? []).map((r) => ({
      site: r.site,
      anchorIso: r.anchorIso,
      model: r.model,
      score: scoreRival(r, decidedOn),
    })),
  ];
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
