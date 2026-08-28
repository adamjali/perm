import type { DailyTotal } from "./dolPace";
import { businessDayPace } from "./dolPace";

/**
 * A cohort completion forecast that is measured rather than assumed.
 *
 * EVERY TOOL IN THIS SPACE COMPUTES `pending / recent_pace`, INCLUDING US.
 * Backtested against the 373,939 decided cases we hold (40 cohort/observation
 * pairs, 2024-01 to 2026-01, `scripts/backtest_pace.py`), that formula lands
 * at median 7d / mean 26d / p90 46d error - and it is WRONG IN A DIRECTION:
 * 38 of 40 predictions come in short.
 *
 * Two measured causes, and neither is the averaging window. Swapping a 7-day
 * calendar mean for a 28- or 90-day working-day mean moves the median by one
 * or two days and changes nothing else, so the field's disagreement is not
 * about model class.
 *
 * ## 1. A cohort does not get DOL's whole day
 *
 * `pending / pace` divides ONE filing month's backlog by the pace across ALL
 * months. DOL works several concurrently. Measured over 36 cohorts, the month
 * at the front absorbs a median of **62%** of daily output (range 23-105%).
 * Dividing by the full rate is why the estimate is short essentially always.
 *
 * ## 2. The last few percent are a different process
 *
 * Decile timing over 18 matured cohorts, from each cohort's own 10% point:
 *
 *     to 25% decided    4 days
 *     to 50% decided   10 days
 *     to 90% decided   26 days
 *     to 95% decided   37 days
 *     to 99% decided   72 days    <- the last 4% takes longer than the first 90%
 *
 * That tail is audits, RFIs and appeals: a different process with a different
 * clock, not a slow version of the same one. So a forecast over a nearly-
 * finished cohort is the one place `pending / pace` fails hardest - the worst
 * backtest miss was 388 pending cases that took 251 days while the formula
 * said 1. We WITHHOLD there instead of guessing.
 *
 * Backtest, same 40 pairs:
 *
 *     model                          answers  median  mean  p90   <=30d  bias
 *     pending / pace (the field)      40/40      7d    26d   46d   85%   -7d
 *     this function                   36/40      4d     6d   12d   94%    0d
 *
 * Four fewer answers, a quarter of the error, and no directional bias.
 */

/** Median share of DOL's daily output that the front cohort absorbs. */
export const COHORT_SHARE = 0.62;

/**
 * Below this many pending cases a cohort is into its tail, where the bulk
 * pace does not apply and the formula fails hardest. Derived from the
 * backtest: every miss over 40 days sat under it.
 */
export const MIN_PENDING_FOR_FORECAST = 1000;

/** Pace window. 56 days backtested marginally better than 28 and far better than 7. */
export const PACE_WINDOW_DAYS = 56;

export interface Forecast {
  /** Business days until the cohort is ~90% decided. */
  days: number;
  /** Plain-language band, from the observed spread. Never a bare point. */
  low: number;
  high: number;
  /** Decisions per working day the forecast used. */
  paceUsed: number;
  /** Working days the pace was measured over. */
  paceDays: number;
}

/**
 * Days until a filing cohort is ~90% decided, or null when we should not say.
 *
 * Returns null - never a number - when the cohort is into its tail or the
 * pace cannot be measured. A forecast we cannot stand behind is worse than no
 * forecast, and this is the one place the arithmetic is known to be biased.
 */
export function forecastCohort(
  pending: number,
  series: readonly DailyTotal[],
): Forecast | null {
  if (!Number.isFinite(pending) || pending < MIN_PENDING_FOR_FORECAST) return null;
  const pace = businessDayPace(series, PACE_WINDOW_DAYS);
  if (!pace || pace.perBusinessDay <= 0) return null;

  const effective = pace.perBusinessDay * COHORT_SHARE;
  const days = Math.round(pending / effective);

  // The band comes from the measured share range (23%-105%), not from a
  // symmetric guess. A cohort getting more of DOL's attention finishes sooner,
  // so the FAST end uses the HIGH share.
  return {
    days,
    low: Math.max(1, Math.round(pending / (pace.perBusinessDay * 1.05))),
    high: Math.round(pending / (pace.perBusinessDay * 0.23)),
    paceUsed: Math.round(effective),
    paceDays: pace.businessDays,
  };
}

/**
 * Where a case sits in its OWN cohort, given the stage it is at.
 *
 * THE POINT IS THAT A CASE AT RFI STILL GETS AN ESTIMATE. An earlier version
 * of this file refused to give one, on the grounds that the cohort median
 * cannot describe an audited case. That is true and it is the wrong
 * conclusion: a case at RFI is not unpredictable, it is in the UPPER TAIL of
 * its own cohort, and that tail is measured.
 *
 * Over 18 matured cohorts (>=2,000 cases each), as multiples of that cohort's
 * own median days-to-decision:
 *
 *     p90 = 1.029x    p95 = 1.045x    p99 = 1.101x
 *
 * So on a 500-day median, the audited tail runs ~514-550 days. That is a real
 * answer, not a shrug, and it comes from the same disclosure corpus as the
 * median itself.
 *
 * The stage tells you WHICH percentile to read, and the live pending
 * population is what maps stage to tail. Mean age since filing, measured
 * 2026-08-27:
 *
 *     ANALYST REVIEW           170d   n=94,033   <- the bulk; use the median
 *     APPLICATION ON HOLD      223d   n=1,852
 *     RFI ISSUED               375d   n=963      2.21x analyst review
 *     RECONSIDERATION APPEALS  624d   n=165
 *     NORD ISSUED              697d   n=108
 *     BALCA APPEALS            714d   n=167
 *
 * APPEALS ARE DELIBERATELY NOT GIVEN A PERCENTILE. BALCA and reconsideration
 * are a different proceeding with their own statutory clock, not a slow PERM
 * decision, and no percentile of the filing cohort describes them. They get
 * the measured age and an honest "this is a different process" instead of a
 * date, because inventing one would be the exact over-reach the rest of this
 * file exists to avoid.
 */
export interface StagePlacement {
  /** Cohort percentile to read, or null when the cohort cannot describe it. */
  percentile: number | null;
  /** Mean days this stage's cases have ALREADY been pending. Measured. */
  observedAgeDays: number;
  /** Why this stage reads where it does, in one sentence for the page. */
  note: string;
}

const STAGE_PLACEMENT: Readonly<Record<string, StagePlacement>> = {
  "ANALYST REVIEW": {
    percentile: 50,
    observedAgeDays: 170,
    note: "The ordinary path. The middle of your filing month is the right read.",
  },
  "IN PROCESS": {
    percentile: 50,
    observedAgeDays: 170,
    note: "The ordinary path. The middle of your filing month is the right read.",
  },
  "APPLICATION ON HOLD": {
    percentile: 75,
    observedAgeDays: 223,
    note: "Cases on hold have waited longer than most of their month, so the middle would read early.",
  },
  "RFI ISSUED": {
    percentile: 90,
    observedAgeDays: 375,
    note: "Cases at a request for information sit in the slower tail of their filing month, and have already waited about twice as long as a case still in analyst review.",
  },
  "NORD ISSUED": {
    percentile: 95,
    observedAgeDays: 697,
    note: "A notice of results of documentation puts a case near the far end of its month.",
  },
  "RECONSIDERATION APPEALS": {
    percentile: null,
    observedAgeDays: 624,
    note: "Reconsideration is a separate proceeding with its own clock. No percentile of the original filing month describes it.",
  },
  "BALCA APPEALS": {
    percentile: null,
    observedAgeDays: 714,
    note: "A BALCA appeal is a different forum entirely, not a slow PERM decision. Nothing in the filing-month data can date it.",
  },
};

/**
 * How to read a cohort estimate for a case at this stage.
 *
 * Returns null for an unrecognised status rather than defaulting to the
 * median: a stage we have not measured is one we should not silently treat
 * as ordinary.
 */
export function placeCaseInCohort(status: string | null | undefined): StagePlacement | null {
  if (!status) return null;
  return STAGE_PLACEMENT[status.trim().toUpperCase()] ?? null;
}

/** Cohort percentile factors, measured over 18 matured cohorts. */
export const COHORT_PERCENTILE_FACTOR: Readonly<Record<number, number>> = {
  50: 1.0,
  75: 1.014,
  90: 1.029,
  95: 1.045,
  99: 1.101,
};

/**
 * Days-to-decision for a case, adjusted for the stage it is actually at.
 *
 * Takes the cohort's median and moves it to the percentile the stage implies.
 * Returns null only when the stage is a separate proceeding the cohort cannot
 * speak to at all.
 */
export function stageAdjustedDays(
  cohortMedianDays: number,
  status: string | null | undefined,
): { days: number; percentile: number; note: string } | null {
  const place = placeCaseInCohort(status);
  if (!place || place.percentile === null) return null;
  const factor = COHORT_PERCENTILE_FACTOR[place.percentile] ?? 1;
  return {
    days: Math.round(cohortMedianDays * factor),
    percentile: place.percentile,
    note: place.note,
  };
}
