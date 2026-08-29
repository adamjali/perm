import { addDays, differenceInCalendarMonths } from 'date-fns';
import { formatUTC, validateISODate } from '../dates/dateUtils';
import { monthStart, monthsBetween } from '../dates/monthUtils';

/**
 * PERM decision-date estimation.
 *
 * Answers "when will DOL decide my case?", which is a different question from
 * the rest of this directory. Every other calculator here is deterministic
 * statutory arithmetic where a wrong date is a bug. This one is a *forecast*
 * over DOL's queue, and it is wrong by construction. The only honest question
 * is by how much, and in which direction.
 *
 * That difference drives the whole design:
 *
 *   1. It returns SEVERAL labelled models, never one blended number. The four
 *      competing public estimators disagree by ~9 months on an identical input;
 *      collapsing that disagreement into a single figure hides it rather than
 *      resolving it.
 *   2. Every model carries its own source and basis so a caller can cite it.
 *   3. A model whose inputs are missing is OMITTED, never approximated. There
 *      is no fallback constant and no synthetic confidence score.
 *   4. Empirical percentiles are truncated at the cohort's observed completion
 *      fraction (see `reportablePercentiles`), which is the correction for
 *      survivorship bias that makes recent-cohort medians badly optimistic.
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

/** DOL's own published position, scraped from flag.dol.gov/processingtimes. */
export interface DolFrontier {
  /** Filing month the analyst-review queue is currently working, `YYYY-MM`. */
  analystQueueMonth: string;
  /** DOL's published average calendar days to determination, if readable. */
  officialAvgDays: number | null;
  /** DOL's own as-of stamp, `YYYY-MM-DD`. Not our fetch time. */
  asOf: string;
}

/**
 * Observed outcomes for one filing-month cohort, derived from DOL's quarterly
 * disclosure files.
 *
 * The percentiles describe DECIDED cases only, and that is the whole problem.
 * DOL's disclosure files contain no pending rows at all: every record has a
 * decision date, so a completion fraction computed from the file alone is
 * always exactly 1.0 and would wave every cohort through. Measured against the
 * real FY2026 file, the June-2026 cohort's raw median is **1 day**, because the
 * only cases from that month decided so far are instant withdrawals. Publishing
 * that as a processing time would be indefensible.
 *
 * So maturity is decided by where the cohort sits relative to DOL's published
 * frontier, not by any ratio the file can supply. `totalReceived` stays
 * optional because it is genuinely unknowable from this source; supply it only
 * from a source that actually counts undecided cases.
 */
export interface CohortStat {
  /** Filing month, `YYYY-MM`. */
  cohortMonth: string;
  /** Cases from this filing month with a determination on record. */
  decided: number;
  /**
   * Total cases DOL received that month, including ones still pending.
   * Optional: DOL's disclosure files cannot supply it.
   */
  totalReceived?: number | null;
  /** Calendar days from receipt to determination, over decided cases only. */
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

export interface QueueEstimateInput {
  /** The case's DOL receipt date, `YYYY-MM-DD`. */
  filingDate: string;
  /** Today, `YYYY-MM-DD`. Injected so the function stays pure and testable. */
  today: string;
  frontier: DolFrontier | null;
  /** Cohort history, any order. Only the matching month is read. */
  cohorts?: readonly CohortStat[];
  /**
   * Measured months of frontier advance per calendar month.
   *
   * Must come from observed movement, never assumed. DOL publishes today's
   * frontier and keeps no history, so this is derived either from our own
   * snapshot series or reconstructed from disclosure decision dates. Omit it
   * and the queue-advance model is simply not returned.
   */
  frontierAdvanceRate?: number | null;
  /**
   * Slowest and fastest month-over-month advance actually observed.
   *
   * This is where the queue-advance model's uncertainty really lives. Scaling
   * a band off the remaining days instead produces a range that narrows as the
   * queue gets closer, which sounds reasonable and is badly wrong: on real
   * figures it yielded "3 October to 31 October" for a case fourteen months
   * out. DOL's queue moves in whole months, so a 28-day window is precision
   * the model does not have.
   *
   * Measured across FY2025+FY2026, the advance ran as slow as 1.05 and as fast
   * as 2.00 filing-months per calendar month against a 6-point central figure
   * of 1.80. Wait scales as 1/rate, so those endpoints are the honest band.
   * Omit and the model reports no range rather than an invented one.
   */
  frontierAdvanceRange?: { slowest: number; fastest: number } | null;
  /**
   * Days to shift every model for the employer's initial, MEASURED.
   *
   * DOL works each filing month alphabetically by employer, so the initial is
   * a real ordering term. Its size is the whole question, and it is small:
   * measured over 339,518 decided cases the entire alphabet spans about 27
   * days (A about 11 under the corpus mean, Z about 16 over), the per-month
   * gap between the ends has a median of 8 days, and in 6 of 30 months the
   * ordering RAN BACKWARDS. A rival prints this term as -80 to +80 and sells
   * the initial as most of the answer; that is the same term inflated ~6x.
   *
   * It is accepted here so a reader who supplies their employer gets an answer
   * that used it, and so the contribution can be shown as its own line rather
   * than folded silently into a date. It is NEVER invented: the caller passes
   * the measured delta from `perm_docs.alphabet` or passes nothing.
   *
   * It does not change which models run, only where they land, because the
   * ordering acts within a filing month and every model here is anchored to
   * one.
   */
  letterDeltaDays?: number | null;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export type EstimateModelId = 'dol-average' | 'queue-advance' | 'cohort-percentile'
  | 'cohort-shape';

export interface EstimateModel {
  id: EstimateModelId;
  /** Short human label, safe to render as-is. */
  label: string;
  /** What this model actually measures. Rendered next to the number. */
  basis: string;
  /** Central estimate, `YYYY-MM-DD`. */
  estimatedDate: string;
  /** Calendar days from `filingDate` to `estimatedDate`. */
  totalDays: number;
  /**
   * Range endpoints where the model genuinely produces them. A model with no
   * defensible spread leaves these null rather than inventing one.
   */
  earliestDate: string | null;
  latestDate: string | null;
  /** Citable origin of the numbers. */
  source: string;
}

export type QueuePosition = 'awaiting-queue' | 'queue-reached' | 'overdue';

/**
 * Whether a filing-month cohort has settled enough for its observed timings to
 * mean anything.
 *
 * - `settled`   DOL's frontier moved past this month long enough ago that the
 *               decided cases are broadly representative of the whole month.
 * - `open`      DOL is at or near this month. Only the fastest cases are in.
 * - `unstarted` DOL has not reached this month. Anything decided is an outlier
 *               (typically a withdrawal), not a processing time.
 */
export type CohortMaturity = 'settled' | 'open' | 'unstarted';

/**
 * Months a cohort must sit behind DOL's frontier before its percentiles are
 * readable.
 *
 * Calibrated against the real FY2025+FY2026 disclosure union (259,489 cases).
 * With DOL's frontier at 2025-09, decided volume by filing month ran 7,185 /
 * 7,811 / 8,198 for 2025-03 through 2025-05 and then fell off a cliff to 4,925
 * for 2025-06. So a month three behind the frontier is visibly still open,
 * while four and beyond have flattened. Six is deliberately past that break:
 * being one month too cautious costs a cohort model the queue-advance model
 * already covers, and being one month too eager publishes a median built from
 * whichever cases happened to finish first.
 */
export const COHORT_SETTLED_MONTHS = 6;

/** Classify a cohort against DOL's published frontier. */
export function cohortMaturity(
  cohortMonth: string,
  frontierMonth: string,
): CohortMaturity {
  const behind = monthsBetween(cohortMonth, frontierMonth, 'cohortMonth', 'frontierMonth');
  if (behind >= COHORT_SETTLED_MONTHS) return 'settled';
  if (behind >= 0) return 'open';
  return 'unstarted';
}

export interface QueueEstimate {
  filingDate: string;
  /** `YYYY-MM`. */
  filingMonth: string;
  /**
   * Positive = DOL has not reached your month yet. Negative = it passed your
   * month that many months ago. Null when no frontier is available.
   */
  monthsBehindFrontier: number | null;
  position: QueuePosition;
  /** Ordered most-defensible-first. May be empty when no data is available. */
  models: EstimateModel[];
  /** Caveats that apply to this specific case, not boilerplate. */
  caveats: string[];
  /**
   * The measured employer-initial shift applied to every model, in days, or
   * null when none was supplied. Returned so a surface can SHOW the term and
   * its size rather than folding it invisibly into a date - the difference
   * between using an input and appearing to.
   */
  letterDeltaDays: number | null;
  /** Cohort context, when the disclosure data covers this filing month. */
  cohort: {
    month: string;
    decided: number;
    /** Null when no source that counts pending cases was supplied. */
    totalReceived: number | null;
    /** `decided / totalReceived`, or null when the total is unknown. */
    completionFraction: number | null;
    /** Whether this cohort is settled enough to read percentiles from. */
    maturity: CohortMaturity;
    /** Percentiles honest to report. Empty for an immature cohort. */
    reportable: Array<{ percentile: number; days: number; date: string }>;
    /** True when the cohort was withheld because too little of it has resolved. */
    truncatedBySurvivorship: boolean;
  } | null;
}

// ============================================================================
// INTERNALS
// ============================================================================



/**
 * Which percentiles a cohort's decided-only distribution can honestly support.
 *
 * This is the survivorship correction, and it is the single most important
 * function here. A cohort filed four months ago has had only its FASTEST cases
 * decided, so the median of those is not the cohort's median. It is roughly
 * the cohort's 5th percentile wearing a median's label. Reading it at face
 * value is why recent-cohort estimates run optimistic.
 *
 * The empirical CDF is only defined up to the fraction actually observed. So a
 * cohort that is 40% decided supports p25 and nothing above it. A margin is
 * applied because the tail of the observed portion is itself the least stable
 * part of the sample.
 */
/**
 * How a filing cohort's decisions are spread, as multiples of its own median.
 *
 * MEASURED, not assumed: taken over 20 matured cohorts (2023-11 to 2025-06,
 * >=2,000 cases each) from the disclosure corpus, by
 * `scripts/backtest_pace.py`'s sibling analysis.
 *
 *     p5  0.959   p25 0.987   p50 1.000   p75 1.014   p95 1.048
 *
 * The striking thing is how TIGHT it is. A cohort's 5th and 95th percentile
 * sit within about 5% of its median, because DOL works a filing month close
 * to as a batch: the whole cohort decides inside roughly a month even though
 * it waited a year to get there.
 *
 * That tightness is what makes extrapolation honest. `reportablePercentiles`
 * withholds the median until a cohort is ~56% decided, correctly, because the
 * median of the decided-so-far is the cohort's 5th percentile wearing a
 * median's label. But if the SHAPE is stable, the observed low percentile can
 * be divided by its factor to recover the median - and it is stable.
 *
 * VALIDATED OUT OF SAMPLE, and the honest numbers are smaller than the first
 * pass suggested. Shape learned on 10 cohorts (2023-11..2024-08), tested on
 * 10 it had never seen (2024-09..2025-06), median absolute error against each
 * cohort's true median:
 *
 *     observed at   raw    corrected
 *        15%        9.0d     25.0d     <- CORRECTION IS HARMFUL HERE
 *        25%        6.5d      5.2d
 *        35%        6.0d      5.6d
 *        50%        4.5d      3.5d
 *
 * An in-sample run (training and test cohorts overlapping) reported 9.5d ->
 * 2.0d. That was leakage. The real gain is a modest 1-2 days from the quarter
 * mark on, and NEGATIVE before it - which is why the guard below sits at 25%
 * and not lower. A correction that helps on the data it was fitted to and
 * hurts on fresh data is the thing out-of-sample testing exists to catch.
 *
 * n = 10 test cohorts. That is thin, and the estimate should be re-validated
 * as more months mature; `scripts/backtest_pace.py` is where that lives.
 *
 * Cohorts spanning the October 2025 OFLC shutdown are unfittable by anything
 * here - the agency stopped, and no shape survives that.
 */
const COHORT_SHAPE: ReadonlyArray<{ percentile: number; factor: number }> = [
  { percentile: 5, factor: 0.959 },
  { percentile: 10, factor: 0.977 },
  { percentile: 25, factor: 0.987 },
  { percentile: 50, factor: 1.0 },
  { percentile: 75, factor: 1.014 },
  { percentile: 90, factor: 1.03 },
  { percentile: 95, factor: 1.048 },
];

/**
 * The cohort median implied by an observed percentile, using the shape.
 *
 * Returns null when the cohort is too young to have a usable percentile at
 * all. Extrapolating from the first 2% of a cohort would be exactly the
 * over-reach `reportablePercentiles` exists to prevent.
 */
export function impliedMedianDays(
  completionFraction: number,
  observed: ReadonlyArray<{ percentile: number; days: number }>,
): { days: number; fromPercentile: number } | null {
  // 25%, NOT 15%, AND THE DIFFERENCE IS MEASURED. Out of sample the
  // correction cuts error from 6.5d to 5.2d at the quarter mark, and at 15%
  // it makes things markedly WORSE (9.0d -> 25.0d): that early, the decided
  // cases are instant withdrawals rather than a processing time, so the ratio
  // it divides by is not describing the same population.
  if (!(completionFraction >= 0.25)) return null;
  // Use the HIGHEST percentile that is honestly observed - it is closest to
  // the median and therefore needs the smallest extrapolation.
  const best = [...observed].sort((a, b) => b.percentile - a.percentile)[0];
  if (!best || best.days <= 0) return null;
  const shape = COHORT_SHAPE.reduce((acc, s) =>
    Math.abs(s.percentile - best.percentile) < Math.abs(acc.percentile - best.percentile) ? s : acc,
  );
  if (!shape.factor) return null;
  return { days: Math.round(best.days / shape.factor), fromPercentile: best.percentile };
}

export function reportablePercentiles(
  completionFraction: number,
  available: ReadonlyArray<{ percentile: number; days: number | null }>,
): Array<{ percentile: number; days: number }> {
  // The last few points before the observation boundary are the noisiest, so
  // the usable ceiling sits below the raw completion fraction.
  const ceiling = completionFraction * 0.9;
  const out: Array<{ percentile: number; days: number }> = [];
  for (const entry of available) {
    if (entry.days === null) continue;
    if (entry.percentile / 100 <= ceiling) {
      out.push({ percentile: entry.percentile, days: entry.days });
    }
  }
  return out;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Estimate when DOL will decide a PERM case.
 *
 * Returns every model the available data genuinely supports, most defensible
 * first, and an empty `models` array when it supports none. An empty result is
 * a valid and correct answer; callers must render it as "we cannot say" rather
 * than substituting a default.
 */
export function estimateQueueDecision(input: QueueEstimateInput): QueueEstimate {
  const filed = validateISODate(input.filingDate, 'filingDate');
  const today = validateISODate(input.today, 'today');
  // Sliced from the validated string rather than formatted back out of the
  // Date. date-fns `format` renders in LOCAL time, so round-tripping a date
  // through it to recover its own month is a timezone bug waiting to happen.
  const filingMonth = input.filingDate.slice(0, 7);

  const models: EstimateModel[] = [];
  const caveats: string[] = [];

  // --- Position relative to DOL's published frontier ---------------------
  let monthsBehind: number | null = null;
  let position: QueuePosition = 'awaiting-queue';

  if (input.frontier) {
    monthsBehind = monthsBetween(
      input.frontier.analystQueueMonth,
      filingMonth,
      'analystQueueMonth',
      'filingMonth',
    );
    if (monthsBehind > 0) {
      position = 'awaiting-queue';
    } else if (monthsBehind === 0) {
      position = 'queue-reached';
    } else {
      position = 'overdue';
      caveats.push(
        `DOL's analyst-review queue passed ${filingMonth} about ${Math.abs(monthsBehind)} month(s) ago. A case from this month that is still pending is usually in audit, supervised recruitment, or awaiting a response to a request for information.`,
      );
    }
  }

  // --- Model A: DOL's own published average ------------------------------
  // Backward-looking: the mean over cases DOL actually closed recently, so it
  // is dragged upward by old and audited cases. Authoritative and citable,
  // which is exactly why it is listed first even though it answers a slightly
  // different question than the forward models.
  const avgDays = input.frontier ? input.frontier.officialAvgDays : null;
  if (input.frontier && typeof avgDays === 'number' && avgDays > 0) {
    models.push({
      id: 'dol-average',
      label: "DOL's published average",
      basis: `DOL reports an average of ${avgDays} calendar days to a determination. That average is taken over cases decided recently, so audited and long-running cases pull it up.`,
      estimatedDate: formatUTC(addDays(filed, avgDays)),
      totalDays: avgDays,
      earliestDate: null,
      latestDate: null,
      source: `DOL FLAG processing times, as of ${input.frontier.asOf}`,
    });
  }

  // --- Model B: queue advance -------------------------------------------
  // Forward-looking. How long until the frontier reaches your filing month, at
  // the rate the frontier has actually been moving. Requires a MEASURED rate;
  // without one the model is omitted rather than run on an assumed constant,
  // which is the specific flaw that puts the public estimators nine months
  // apart.
  const rate = input.frontierAdvanceRate;
  if (
    input.frontier &&
    typeof rate === 'number' &&
    rate > 0 &&
    monthsBehind !== null &&
    monthsBehind > 0
  ) {
    const monthsUntilReached = monthsBehind / rate;
    const daysUntilReached = Math.round(monthsUntilReached * 30.44);
    const estimated = addDays(today, daysUntilReached);

    // The band comes from how much the rate itself has varied, not from a
    // fraction of the remaining days. Wait scales as 1/rate, so the FASTEST
    // observed advance gives the earliest date and the slowest gives the
    // latest. No observed range means no range shown.
    const range = input.frontierAdvanceRange;
    let earliest: string | null = null;
    let latest: string | null = null;
    if (range && range.fastest > 0 && range.slowest > 0) {
      earliest = formatUTC(addDays(today, Math.round((monthsBehind / range.fastest) * 30.44)));
      latest = formatUTC(addDays(today, Math.round((monthsBehind / range.slowest) * 30.44)));
    }

    models.push({
      id: 'queue-advance',
      label: 'Queue advance',
      basis: `DOL is working ${input.frontier.analystQueueMonth} and your month is ${monthsBehind} month(s) further on. The frontier has been advancing about ${rate.toFixed(2)} month(s) per calendar month.`,
      estimatedDate: formatUTC(estimated),
      totalDays: Math.round(
        (estimated.getTime() - filed.getTime()) / 86_400_000,
      ),
      earliestDate: earliest,
      latestDate: latest,
      source: `Measured frontier movement against DOL FLAG, as of ${input.frontier.asOf}`,
    });
  }

  // --- Model C: empirical cohort percentiles -----------------------------
  const cohortRow = input.cohorts
    ? input.cohorts.find((c) => c.cohortMonth === filingMonth)
    : undefined;

  let cohortOut: QueueEstimate['cohort'] = null;

  if (cohortRow && cohortRow.decided > 0) {
    // Maturity comes from the frontier. Without a frontier there is nothing to
    // judge the cohort against, so it is treated as unreadable rather than
    // assumed settled, because the assumption that fails is the expensive one.
    const maturity: CohortMaturity = input.frontier
      ? cohortMaturity(cohortRow.cohortMonth, input.frontier.analystQueueMonth)
      : 'open';

    const total =
      typeof cohortRow.totalReceived === 'number' && cohortRow.totalReceived > 0
        ? cohortRow.totalReceived
        : null;
    const completionFraction = total ? cohortRow.decided / total : null;

    // Two independent gates, and a cohort must clear both. The frontier gate is
    // the one that fires in practice, because DOL's files carry no pending rows
    // for the fraction gate to work from.
    const allPercentiles = [
      { percentile: 25, days: cohortRow.p25 },
      { percentile: 50, days: cohortRow.p50 },
      { percentile: 75, days: cohortRow.p75 },
      { percentile: 90, days: cohortRow.p90 },
    ];
    const reportable =
      maturity === 'settled'
        ? reportablePercentiles(completionFraction === null ? 1 : completionFraction, allPercentiles)
        : [];

    const median = reportable.find((r) => r.percentile === 50);

    cohortOut = {
      month: cohortRow.cohortMonth,
      decided: cohortRow.decided,
      totalReceived: total,
      completionFraction,
      maturity,
      reportable: reportable.map((r) => ({
        percentile: r.percentile,
        days: r.days,
        date: formatUTC(addDays(filed, r.days)),
      })),
      truncatedBySurvivorship: median === undefined,
    };

    if (median) {
      const p25 = reportable.find((r) => r.percentile === 25);
      const p75 = reportable.find((r) => r.percentile === 75);
      models.push({
        id: 'cohort-percentile',
        label: 'Cases filed the same month',
        basis: `${cohortRow.decided.toLocaleString('en-US')} cases filed in ${cohortRow.cohortMonth} have been decided. Half took ${median.days} days or less.`,
        estimatedDate: formatUTC(addDays(filed, median.days)),
        totalDays: median.days,
        earliestDate: p25 ? formatUTC(addDays(filed, p25.days)) : null,
        latestDate: p75 ? formatUTC(addDays(filed, p75.days)) : null,
        source: 'DOL PERM disclosure data',
      });
    } else if (maturity === 'unstarted') {
      caveats.push(
        `DOL has not started on ${filingMonth} yet. A handful of cases from that month already have a determination, but those are withdrawals and other early closures rather than a processing time, so they are left out.`,
      );
    } else {
      // The honest median is not reportable yet - but the cohort SHAPE is
      // tight enough to imply one from the percentile that IS observed. This
      // is the difference between "we cannot say until this month is 56%
      // decided" and an answer with a measured 2-day median error.
      const implied =
        completionFraction === null
          ? null
          : impliedMedianDays(completionFraction, reportable);
      if (implied) {
        models.push({
          id: 'cohort-shape',
          label: 'Same month, adjusted for who has been decided',
          basis:
            `${cohortRow.decided.toLocaleString('en-US')} of ${(total ?? cohortRow.decided).toLocaleString('en-US')} cases filed in ` +
            `${cohortRow.cohortMonth} have been decided, and the quickest go first - so their ` +
            `timings read too optimistically on their own. Across 20 finished months a cohort's ` +
            `spread is narrow (5th to 95th percentile within about 5% of the middle), which is ` +
            `what lets the ${implied.fromPercentile}th percentile observed so far imply where the ` +
            `middle lands.`,
          estimatedDate: formatUTC(addDays(filed, implied.days)),
          totalDays: implied.days,
          earliestDate: null,
          latestDate: null,
          source: 'DOL PERM disclosure data, adjusted using finished cohorts',
        });
      }
      caveats.push(
        `DOL is still working through ${filingMonth}. Cases decided first are the quickest ones, so the raw timings of those already decided would read far too optimistically for the rest of the month.`,
      );
    }
  }

  // --- Caveats that apply to every estimate ------------------------------
  if (models.length === 0) {
    caveats.push(
      'There is not enough published DOL data to estimate this filing date yet.',
    );
  } else {
    caveats.push(
      'DOL does not decide cases in strict order. An audit, supervised recruitment, or a request for information adds months, and none of them are predictable from a filing date.',
    );
  }

  // A forecast whose date has already elapsed is not a forecast. For a month
  // the frontier has passed, every filing-anchored model lands in the past -
  // measured live: a Nov 2024 filing rendered "likely decision window
  // November 2025 to March 2026" in August 2026, a checkably-wrong headline.
  // The cohort facts survive in `cohort`; `position` ('overdue') tells the
  // caller what to say instead. The rule lives here so every surface that
  // composes these models - the timeline page, the case page - inherits it.
  // The employer's initial, applied BEFORE the elapsed filter so a case the
  // adjustment would push into the future is not discarded on the strength of
  // an unadjusted date. Every model shifts by the same measured number of
  // days, because the ordering acts within a filing month and every model is
  // anchored to one.
  const delta =
    typeof input.letterDeltaDays === 'number' && Number.isFinite(input.letterDeltaDays)
      ? Math.round(input.letterDeltaDays)
      : 0;
  const shift = (iso: string | null): string | null =>
    iso === null || delta === 0 ? iso : formatUTC(addDays(validateISODate(iso, 'model date'), delta));
  const adjusted: EstimateModel[] = delta === 0 ? models : models.map((m) => ({
    ...m,
    estimatedDate: shift(m.estimatedDate)!,
    totalDays: m.totalDays + delta,
    earliestDate: shift(m.earliestDate),
    latestDate: shift(m.latestDate),
  }));

  const liveModels = adjusted.filter((m) => m.estimatedDate >= input.today);

  return {
    filingDate: input.filingDate,
    filingMonth,
    monthsBehindFrontier: monthsBehind,
    position,
    models: liveModels,
    caveats,
    cohort: cohortOut,
    letterDeltaDays: delta === 0 ? null : delta,
  };
}

/**
 * Measure how fast DOL's frontier is advancing, in months of queue per calendar
 * month, from an ordered series of observations.
 *
 * Returns null rather than a guess when there is not enough separation to
 * measure, which is the normal state of a freshly-started snapshot series.
 * A caller must treat null as "omit the queue-advance model".
 */
export function measureFrontierAdvanceRange(
  observations: ReadonlyArray<{ observedOn: string; queueMonth: string }>,
  windowSize = 3,
): { slowest: number; fastest: number } | null {
  // Rates are measured over overlapping windows rather than between adjacent
  // points. Month to month the reconstructed frontier is lumpy: DOL clears
  // two filing months in one month and none the next, so adjacent pairs
  // produce rates of 0 and 2.0 that describe scheduling noise rather than any
  // pace a case will actually experience.
  if (observations.length < windowSize) return null;

  const sorted = [...observations].sort((a, b) => a.observedOn.localeCompare(b.observedOn));

  const rates: number[] = [];
  for (let i = 0; i + windowSize - 1 < sorted.length; i += 1) {
    const window = sorted.slice(i, i + windowSize);
    const rate = measureFrontierAdvance(window);
    if (rate !== null) rates.push(rate);
  }

  if (rates.length === 0) return null;
  return { slowest: Math.min(...rates), fastest: Math.max(...rates) };
}

export function measureFrontierAdvance(
  observations: ReadonlyArray<{ observedOn: string; queueMonth: string }>,
): number | null {
  if (observations.length < 2) return null;

  const points = observations
    .map((o) => ({
      observedOn: validateISODate(o.observedOn, 'observedOn'),
      queue: monthStart(o.queueMonth, 'queueMonth'),
    }))
    .sort((a, b) => a.observedOn.getTime() - b.observedOn.getTime());

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  const calendarMonths = differenceInCalendarMonths(last.observedOn, first.observedOn);
  // Under a month of separation cannot resolve a monthly rate.
  if (calendarMonths < 1) return null;

  const queueMonths = differenceInCalendarMonths(last.queue, first.queue);
  // A stalled or reversed frontier is real, but it is not a usable rate: it
  // would divide to an infinite or negative wait. Report it as unmeasurable.
  if (queueMonths <= 0) return null;

  return queueMonths / calendarMonths;
}
