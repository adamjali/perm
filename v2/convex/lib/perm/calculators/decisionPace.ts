/**
 * How fast DOL is deciding, and what that implies for one case.
 *
 *   day   = today + (cases ahead / 28-day calendar pace)
 *   band  = cases ahead / {p90, p10} weekday pace, floored, late-heavy
 *
 * This is the shape the rival tracker and the rival dashboard both use, measured here across
 * ~88,000 backtested predictions before being written down. It has ZERO
 * fitted parameters: a count divided by a measured rate, with a band from
 * that rate's own spread. Every number in it can be pointed at in the data.
 *
 * THE BAND IS A PACE SCENARIO, NOT A CONFIDENCE INTERVAL. Measured coverage
 * is 57-58% overall and 41% at the near horizon. Any surface rendering it
 * must say so; calling it "80% confident" is the single most checkable lie
 * a queue estimator can tell, and a rival ships exactly that (their
 * `confidence_level: 0.8` is a constant, and real coverage is 8-15%).
 *
 * WHAT THIS MODULE IS NOT WIRED TO, AND WHY (measured 2026-09-13).
 * The backtest fed `days` from DOL's own `decision_date` in the quarterly
 * disclosure files. Production cannot: those files end 2026-06-30, so
 * "the last 28 days" does not exist in them. The only daily-resolution
 * source we hold is `perm_case_events`, which records when OUR SWEEP SAW a
 * change, and it begins 2026-08-27. The two ranges do not overlap by a
 * single day, so the substitution cannot be validated at all yet - it
 * becomes checkable when DOL publishes FY2026 Q4 (July-September), which
 * also lands the first days the event log covers.
 *
 * Until then this is exported, tested and NOT used to produce any number a
 * reader sees. That is deliberate. `estimateQueueDecision` keeps leading
 * with queue-advance, which is anchored on DOL's own published frontier and
 * needs no substitution.
 */

/** Below this many usable weekdays the pace is not measurable. */
export const MIN_WEEKDAYS = 6;

/** A day under this share of the weekday median is a holiday or a shutdown. */
export const COLLAPSE_FRACTION = 0.15;

/** Beyond this many days out we refuse rather than pretend. */
export const MAX_HORIZON_DAYS = 1400;

/**
 * The band may never be narrower than this share of the predicted horizon.
 *
 * WHY A FLOOR AT ALL. The band is built from the spread of DOL's recent daily
 * pace, so a fortnight where DOL ran at a metronome produces fast == slow and
 * the band collapses - one day wide at four months out. Stable recent pace is
 * not a certain forecast, and taking the FULL observed range of daily pace
 * still only reaches 44-72% coverage, because queue movement, audits and DOL
 * behaviour are not in the pace at all.
 *
 * Swept against ~82,000 backtest predictions rather than picked:
 *
 *   fraction   0-2mo  2-4mo  4-6mo   overall   widest band
 *     0.25      38%    47%    48%      48%        78d
 *     0.40      39%    50%    51%      51%        78d
 *     0.55      41%    53%    57%      56%        89d   <- chosen
 *     0.70      46%    60%    70%      64%       110d
 *
 * 0.55 is the most coverage available while the widest band stays under 90
 * days. Going to 0.70 buys 8 points and costs 21 days of width.
 *
 * AND AT 0.55 THE FLOOR BINDS AT EVERY HORIZON, so read the first paragraph
 * carefully: the band is in practice `0.55 x horizon` grown late-heavy, and
 * the p10/p90 spread decides only how that growth splits, not how wide it is.
 * The measured spread runs 35-52% of the horizon, entirely below the floor -
 * verified against production 2026-09-13, where a 110-day horizon gave 37
 * days from the spread and 61 from the floor. That is a defensible choice
 * because 0.55 was swept rather than picked, but it is a constant fraction
 * with a measured justification, not a live measurement, and it must not be
 * described to a reader as the latter.
 */
export const MIN_BAND_FRACTION = 0.55;

/** A band narrower than a week is noise whatever the horizon. */
export const MIN_BAND_DAYS = 7;

/**
 * One calendar day of decisions.
 *
 * `dayOfWeek` is 0 = Sunday through 6 = Saturday, matching `Date#getUTCDay`.
 * Pass every calendar day in the window INCLUDING zeros; a missing day and a
 * day with no decisions are different facts and only the caller knows which.
 */
export interface DecisionDay {
  dayOfWeek: number;
  n: number;
}

export interface MeasuredPace {
  /** Decisions per CALENDAR day - the rate a horizon is divided by. */
  pace: number;
  /** p90 weekday rate, scaled onto the calendar rate. The optimistic edge. */
  fast: number;
  /** p10 weekday rate, scaled onto the calendar rate. The pessimistic edge. */
  slow: number;
  weekdayMean: number;
  weekendMean: number;
  weekdaysUsed: number;
  daysUsed: number;
}

/**
 * Measure DOL's recent decision rate, or refuse.
 *
 * Returns null whenever the window cannot support a rate. Refusing is the
 * point: a fabricated pace propagates into a date a person plans around.
 */
export function measurePace(days: readonly DecisionDay[]): MeasuredPace | null {
  const weekdays: number[] = [];
  for (const d of days) {
    if (d.dayOfWeek !== 0 && d.dayOfWeek !== 6) weekdays.push(d.n);
  }
  if (weekdays.length < MIN_WEEKDAYS) return null;
  const sorted = [...weekdays].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (!(median > 0)) return null;

  /*
   * THE CENTRAL RATE IS A PLAIN CALENDAR MEAN OVER EVERY OBSERVED DAY.
   *
   * It used to be rebuilt as (weekdayMean * 5 + weekendMean * 2) / 7 from a
   * weekday mean that EXCLUDED collapsed days. That reads 11% high, and the
   * error is structural rather than small: dropping Labor Day from the
   * weekday average produces "a typical working weekday", and projecting
   * five of those into every future week silently assumes no future week
   * contains a holiday.
   *
   * Caught by cross-checking against the rival dashboard's published daily_volume
   * over 16 overlapping days: our raw counts match theirs to 0.7% (619/day
   * against 623) while our reconstruction was claiming 688. The data was
   * never wrong; the projection was.
   *
   * Federal holidays are a normal part of the calendar and belong in a
   * calendar rate. Only a SUSTAINED collapse - three or more consecutive
   * near-dead days, i.e. a shutdown - is excluded, because that is not a
   * rate at all.
   */
  const runLen: number[] = [];
  let run = 0;
  for (const d of days) {
    if (d.n < median * COLLAPSE_FRACTION) run++;
    else run = 0;
    runLen.push(run);
  }
  // Walk back so every day of a collapse carries the run's full length, not
  // just its position within it: a run is only recognisable from its end.
  for (let i = days.length - 2; i >= 0; i--) {
    const here = runLen[i] ?? 0;
    const next = runLen[i + 1] ?? 0;
    if (next > here && here > 0) runLen[i] = next;
  }
  const kept = days.filter((_, i) => (runLen[i] ?? 0) < 3);
  const keptWd = kept.filter((d) => d.dayOfWeek !== 0 && d.dayOfWeek !== 6);
  const keptWe = kept.filter((d) => d.dayOfWeek === 0 || d.dayOfWeek === 6);
  if (keptWd.length < MIN_WEEKDAYS) return null;
  // A window with no weekend day in it means the feed is broken, not that DOL
  // worked every weekend. Refuse rather than project a weekday rate across
  // calendar days that include weekends.
  if (keptWe.length < 2) return null;

  const wdAll = keptWd.reduce((a, d) => a + d.n, 0) / keptWd.length;
  const weAll = keptWe.reduce((a, d) => a + d.n, 0) / keptWe.length;
  // The 5:2 mix, not the window's own mix, so an unbalanced window cannot
  // tilt the rate. Holidays stay IN the weekday population on purpose.
  const pace = (wdAll * 5 + weAll * 2) / 7;

  /*
   * The band comes from the WEEKDAY spread, because that is where DOL's
   * variation lives - a weekend is quiet by definition, not by effort. Each
   * weekday quantile is converted onto the calendar rate by the same ratio
   * the central rate carries, so fast/slow stay on one scale with `pace`.
   */
  const activeWd = sorted.filter((x) => x >= median * COLLAPSE_FRACTION);
  if (activeWd.length < MIN_WEEKDAYS) return null;
  const wdMean = activeWd.reduce((a, b) => a + b, 0) / activeWd.length;
  const q = (p: number): number =>
    activeWd[Math.floor(p * (activeWd.length - 1))] ?? 0;
  const scale = pace / wdMean;

  return {
    pace,
    fast: q(0.9) * scale,
    slow: q(0.1) * scale,
    weekdayMean: wdMean,
    weekendMean: weAll,
    weekdaysUsed: activeWd.length,
    daysUsed: kept.length,
  };
}

export type PaceRefusal =
  | "stale-data"
  | "side-queue"
  | "overdue"
  | "unknown-case"
  | "pace-unmeasurable"
  | "beyond-horizon";

export interface PaceEstimateInput {
  /** Days since the epoch. Day numbers, never Date objects. */
  today: number;
  /** Undecided cases filed before this one, or null when unknown. */
  casesAhead: number | null;
  pace: MeasuredPace | null;
  /** The case's current DOL status, uppercased as DOL spells it. */
  status: string;
  /** Positive = behind the frontier, negative = the queue has passed it. */
  monthsBehindFrontier: number | null;
  /** How long ago our sweep last read DOL, in days. */
  sweepAgeDays: number;
}

export type PaceEstimate =
  | { kind: "refused"; reason: PaceRefusal; detail?: string; status?: string; rawDays?: number }
  | {
      kind: "queue-clear";
      casesAhead: number;
      pace: number;
      medianDays: number;
      p75Days: number;
      p90Days: number;
      detail: string;
    }
  | {
      kind: "estimate";
      /** Days since the epoch. */
      day: number;
      early: number;
      late: number;
      casesAhead: number;
      rawDays: number;
      pace: number;
    };

/**
 * Turn a measured pace and a queue position into a day, a band, or a refusal.
 *
 * The refusals come first and in the order a reader would ask them, because
 * every one of them is a case where a date would be actively misleading
 * rather than merely uncertain.
 */
export function estimateByPace(input: PaceEstimateInput): PaceEstimate {
  const { today, casesAhead, pace, status, monthsBehindFrontier, sweepAgeDays } =
    input;

  if (sweepAgeDays > 3) {
    return {
      kind: "refused",
      reason: "stale-data",
      detail: `Our last sweep of DOL was ${sweepAgeDays} days ago.`,
    };
  }
  if (status && status !== "ANALYST REVIEW") {
    return {
      kind: "refused",
      reason: "side-queue",
      status,
      detail: `A case in ${status} is not in filing order; DOL publishes a separate queue for it.`,
    };
  }
  if (monthsBehindFrontier !== null && monthsBehindFrontier < 0) {
    return {
      kind: "refused",
      reason: "overdue",
      detail: `DOL's queue passed your filing month about ${Math.abs(monthsBehindFrontier)} month(s) ago.`,
    };
  }
  if (casesAhead === null) return { kind: "refused", reason: "unknown-case" };
  if (!pace) {
    return {
      kind: "refused",
      reason: "pace-unmeasurable",
      detail: "Too few working days observed to measure DOL's pace.",
    };
  }

  /*
   * A case with almost nothing ahead of it is NOT about to be decided, and
   * assuming so was a bug here until it was measured. Actual days to
   * decision, by how much work sits ahead (31 origins, real outcomes):
   *
   *   queue ahead      n       p25   MEDIAN    p75    p90
   *   <1 day          708       12      34      81    149
   *   1-3 days      1,504        6      18      44     99
   *   3-10 days     5,057        5      12      26     52
   *   10-30 days   14,201       13      23      37     60
   *
   * The relationship is U-shaped. A case with LESS than a day's work ahead
   * waits LONGER (median 34) than one with three to ten days (median 12),
   * because "nothing ahead and still pending" is what being stuck looks
   * like: an audit, an RFI, something outside filing order the queue cannot
   * see. The branch is named for what is true (the queue is clear) rather
   * than for what is not (a decision is imminent).
   *
   * The comparison also used to be `casesAhead <= pace`, against the pace
   * OBJECT, which coerced to NaN so this branch never ran at all.
   */
  if (casesAhead <= pace.pace) {
    return {
      kind: "queue-clear",
      casesAhead,
      pace: pace.pace,
      medianDays: 34,
      p75Days: 81,
      p90Days: 149,
      detail:
        "DOL has essentially cleared the filing queue ahead of you. Cases " +
        "in this position were decided in a median of 34 days, though a " +
        "quarter took more than 81 - a case that reaches the front and " +
        "stays pending is usually held by something outside filing order.",
    };
  }

  const rawDays = Math.round(casesAhead / pace.pace);
  if (rawDays > MAX_HORIZON_DAYS) {
    return {
      kind: "refused",
      reason: "beyond-horizon",
      rawDays,
      detail: "The queue ahead is longer than anything we can measure against.",
    };
  }

  const day = today + rawDays;
  let early = today + Math.round(casesAhead / pace.fast);
  let late = today + Math.round(casesAhead / pace.slow);
  const floor = Math.max(MIN_BAND_DAYS, Math.round(rawDays * MIN_BAND_FRACTION));
  if (late - early < floor) {
    /*
     * GROW LATE-HEAVY. Measured over 82,000 backtest predictions the misses
     * are consistently more often late than early (23% vs 35% at the near
     * horizon): a case gets delayed by an audit or an RFI, it is never
     * decided sooner than the queue allows. A symmetric floor therefore
     * spends half its width on the side the truth rarely lands. One third
     * early, two thirds late.
     */
    const grow = floor - (late - early);
    early -= Math.round(grow / 3);
    late += Math.round((grow * 2) / 3);
  }
  // A pending case cannot be decided in the past.
  early = Math.max(today + 1, early);

  return {
    kind: "estimate",
    day,
    // The band must bracket the estimate even when a clip moved an edge.
    early: Math.min(early, day),
    late: Math.max(late, day),
    casesAhead,
    rawDays,
    pace: pace.pace,
  };
}
