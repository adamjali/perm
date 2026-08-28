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
 * How much longer a case at a given review stage has historically sat.
 *
 * Adam's observation, and the data backs it hard. Measured on 2026-08-27 over
 * the live pending population, mean age since filing:
 *
 *     ANALYST REVIEW           170d   (n=94,033)
 *     APPLICATION ON HOLD      223d   (n=1,852)
 *     RFI ISSUED               375d   (n=963)     2.21x analyst review
 *     RECONSIDERATION APPEALS  624d   (n=165)
 *     NORD ISSUED              697d   (n=108)
 *     BALCA APPEALS            714d   (n=167)
 *
 * A case at RFI has ALREADY been pending 205 days longer than the typical
 * analyst-review case, so a cohort-level forecast applied to it is wrong by
 * about that much. When someone gives us a case number and we can see its
 * stage, we know something the cohort average cannot express.
 *
 * These are AGE MULTIPLES OF AN OBSERVED POPULATION, not a remaining-time
 * model - a case already at BALCA is not 4.2x from a decision, it is in a
 * different process entirely. They are exposed so a page can say "cases at
 * this stage have been waiting far longer than the cohort" and NOT so it can
 * multiply a date. Anything that wants a per-stage completion estimate needs
 * its own hazard model over `perm_case_events`, which we are only now
 * accumulating.
 */
export const STAGE_AGE_DAYS: Readonly<Record<string, number>> = {
  "ANALYST REVIEW": 170,
  "APPLICATION ON HOLD": 223,
  "RFI ISSUED": 375,
  "RECONSIDERATION APPEALS": 624,
  "NORD ISSUED": 697,
  "BALCA APPEALS": 714,
};

/**
 * Whether a cohort forecast is safe to apply to THIS case, given its stage.
 *
 * False for anything past analyst review: those cases are in a different
 * queue with its own clock, and the cohort number would understate them.
 */
export function cohortForecastAppliesTo(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toUpperCase();
  return s === "ANALYST REVIEW" || s === "IN PROCESS";
}
