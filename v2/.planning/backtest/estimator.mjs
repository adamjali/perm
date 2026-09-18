/**
 * PERM decision estimator - reference implementation.
 *
 *   day   = today + (cases ahead / 28-day calendar pace) - bias[horizon]
 *   range = cases ahead / {p90, p10} weekday pace, converted to calendar
 *
 * Deliberately small. Two lookups and one fitted number; everything else is
 * division. The band is a PACE SCENARIO, not a confidence interval - measured
 * coverage is about 47% at 2-4 months, and the label must say so.
 */
export const MIN_WEEKDAYS = 6;          // below this the pace is not measurable
export const COLLAPSE_FRACTION = 0.15;  // a day under 15% of the weekday median is a holiday/shutdown
export const MAX_HORIZON_DAYS = 1400;   // beyond this we do not pretend

/**
 * The band may never be narrower than this share of the predicted horizon.
 *
 * WHY A FLOOR AT ALL. The band is built from the spread of DOL's recent daily
 * pace, so a fortnight where DOL ran at a metronome produces fast == slow and
 * the band collapses - one day wide at four months out. Stable recent pace is
 * not the same as a certain forecast, and this repo already measured why: even
 * taking the FULL observed range of daily pace only reaches 44-72% coverage,
 * because queue movement, audits and DOL behaviour are not in the pace at all.
 *
 * 0.25 is set BELOW what real data produces so it binds only in the degenerate
 * case: measured against 31 origins the real band runs 35-52% of the horizon.
 */
/**
 * Chosen by sweeping against 82,000 backtest predictions, not picked:
 *
 *   fraction   0-2mo  2-4mo  4-6mo   overall   widest band
 *     0.25      38%    47%    48%      48%        78d
 *     0.40      39%    50%    51%      51%        78d
 *     0.55      41%    53%    57%      56%        89d   <- chosen
 *     0.70      46%    60%    70%      64%       110d
 *
 * 0.55 is the most coverage available while the widest band stays under 90
 * days, which is the product constraint. Going to 0.70 buys 8 points and costs
 * 21 days of width.
 */
export const MIN_BAND_FRACTION = 0.55;
export const MIN_BAND_DAYS = 7;

/*
 * THERE IS NO BIAS CORRECTION, AND THAT IS A DELIBERATE REMOVAL.
 *
 * An earlier version subtracted a measured median error per horizon bucket
 * (-2, +1, -7, -31 days). Tested by simply deleting it, over ~90,000 backtest
 * predictions:
 *
 *                 with correction        without
 *   0-2mo          -2d,  41% in band     -4d,  42%
 *   2-4mo          -4d,  53%             -4d,  53%
 *   4-6mo          +3d,  57%             -4d,  58%
 *   overall              56%                   58%
 *
 * It earns nothing at the horizons that exist. Today's entire live queue is
 * under six months (86% under four), and across that whole range the corrected
 * and uncorrected models are within two days of each other while the
 * uncorrected one covers slightly MORE. The only bucket where the correction
 * helps is 6-9 months, which holds 0% of the live population.
 *
 * So the model has NO fitted parameters. It is a count divided by a measured
 * rate, with a band from that rate's own spread. Every number in it can be
 * pointed at in the data. That is worth more than two days of median error,
 * especially since a fitted correction is the thing that has been wrong
 * repeatedly here - most memorably a +111-day "bias" that turned out to be
 * DOL's acceleration wearing a calibration costume.
 */

/**
 * @param {{dayOfWeek:number, n:number}[]} days  last 28 calendar days of decisions
 * @returns {{pace:number, fast:number, slow:number, weekdayMean:number, weekendMean:number, weekdaysUsed:number}|null}
 */
export function measurePace(days) {
  const wd = [], we = [];
  for (const d of days) ((d.dayOfWeek === 0 || d.dayOfWeek === 6) ? we : wd).push(d.n);
  if (wd.length < MIN_WEEKDAYS) return null;
  const sorted = [...wd].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (!(median > 0)) return null;

  /* THE CENTRAL RATE IS A PLAIN CALENDAR MEAN OVER EVERY OBSERVED DAY.
   *
   * It used to be rebuilt as (weekdayMean * 5 + weekendMean * 2) / 7 from a
   * weekday mean that EXCLUDED collapsed days. That reads 11% high, and the
   * error is structural rather than small: dropping Labor Day from the weekday
   * average produces "a typical working weekday", and projecting five of those
   * into every future week silently assumes no future week contains a holiday.
   *
   * Caught by cross-checking against the rival dashboard's published daily_volume over
   * 16 overlapping days: our raw counts match theirs to 0.7% (619/day against
   * 623), while our reconstruction was claiming 688. The data was never wrong;
   * the projection was.
   *
   * Federal holidays are a normal part of the calendar and belong in a calendar
   * rate. Only a SUSTAINED collapse - three or more consecutive near-dead days,
   * i.e. a shutdown - is excluded, because that is not a rate at all.
   */
  const runLen = [];
  let run = 0;
  for (const d of days) {
    if (d.n < median * COLLAPSE_FRACTION) run++; else run = 0;
    runLen.push(run);
  }
  for (let i = days.length - 2; i >= 0; i--)
    if (runLen[i + 1] > runLen[i] && runLen[i] > 0) runLen[i] = runLen[i + 1];
  const kept = days.filter((_, i) => runLen[i] < 3);
  const keptWd = kept.filter((d) => d.dayOfWeek !== 0 && d.dayOfWeek !== 6);
  const keptWe = kept.filter((d) => d.dayOfWeek === 0 || d.dayOfWeek === 6);
  if (keptWd.length < MIN_WEEKDAYS) return null;
  // A 28-day window with no weekend day in it means the feed is broken, not
  // that DOL worked every weekend. Refuse rather than project a weekday rate
  // across calendar days that include weekends.
  if (keptWe.length < 2) return null;
  const wdAll = keptWd.reduce((a, d) => a + d.n, 0) / keptWd.length;
  const weAll = keptWe.reduce((a, d) => a + d.n, 0) / keptWe.length;
  // The 5:2 mix, not the window's own mix, so an unbalanced window cannot
  // tilt the rate. Holidays stay IN the weekday population on purpose.
  const pace = (wdAll * 5 + weAll * 2) / 7;

  /* The band still comes from the WEEKDAY spread, because that is where DOL's
   * variation lives - a weekend is quiet by definition, not by effort. Each
   * weekday quantile is converted onto the calendar rate by the same ratio the
   * central rate carries, so fast/slow stay on one scale with `pace`.
   */
  const activeWd = sorted.filter((x) => x >= median * COLLAPSE_FRACTION);
  if (activeWd.length < MIN_WEEKDAYS) return null;
  const wdMean = activeWd.reduce((a, b) => a + b, 0) / activeWd.length;
  const q = (p) => activeWd[Math.floor(p * (activeWd.length - 1))];
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

/**
 * @param {{today:number, casesAhead:number|null, pace:ReturnType<measurePace>,
 *          status:string, monthsBehindFrontier:number|null, sweepAgeDays:number}} input
 *   day numbers are days since epoch.
 */
export function estimate(input) {
  const { today, casesAhead, pace, status, monthsBehindFrontier, sweepAgeDays } = input;

  // --- refusals, in the order a reader would ask them ---------------------
  if (sweepAgeDays > 3)
    return { kind: "refused", reason: "stale-data",
      detail: `Our last sweep of DOL was ${sweepAgeDays} days ago.` };
  if (status && status !== "ANALYST REVIEW")
    return { kind: "refused", reason: "side-queue", status,
      detail: `A case in ${status} is not in filing order; DOL publishes a separate queue for it.` };
  if (monthsBehindFrontier !== null && monthsBehindFrontier < 0)
    return { kind: "refused", reason: "overdue",
      detail: `DOL's queue passed your filing month about ${Math.abs(monthsBehindFrontier)} month(s) ago.` };
  if (casesAhead === null)
    return { kind: "refused", reason: "unknown-case" };
  if (!pace)
    return { kind: "refused", reason: "pace-unmeasurable",
      detail: "Too few working days observed to measure DOL's pace." };

  // A case with almost nothing ahead of it is NOT about to be decided, and
  // assuming so was a bug here until it was measured. Actual days to decision,
  // by how much work sits ahead (31 origins, real outcomes):
  //
  //   queue ahead      n       p25   MEDIAN    p75    p90
  //   <1 day          708       12      34      81    149
  //   1-3 days      1,504        6      18      44     99
  //   3-10 days     5,057        5      12      26     52
  //   10-30 days   14,201       13      23      37     60
  //
  // The relationship is U-shaped. A case with LESS than a day's work ahead
  // waits LONGER (median 34) than one with three to ten days (median 12),
  // because "nothing ahead and still pending" is what being stuck looks like:
  // an audit, an RFI, something outside filing order the queue cannot see.
  //
  // (The comparison also used to be `casesAhead <= pace`, against the pace
  // OBJECT, which coerced to NaN so this branch never ran at all.)
  if (casesAhead <= pace.pace) {
    return { kind: "queue-clear", casesAhead, pace: pace.pace,
      medianDays: 34, p75Days: 81, p90Days: 149,
      detail: "DOL has essentially cleared the filing queue ahead of you. Cases "
            + "in this position were decided in a median of 34 days, though a "
            + "quarter took more than 81 - a case that reaches the front and "
            + "stays pending is usually held by something outside filing order." };
  }

  const rawDays = Math.round(casesAhead / pace.pace);
  if (rawDays > MAX_HORIZON_DAYS)
    return { kind: "refused", reason: "beyond-horizon", rawDays,
      detail: "The queue ahead is longer than anything we can measure against." };

  const day = today + rawDays;
  // Scenario edges. Clip at tomorrow: a pending case cannot be decided in the past.
  let early = today + Math.round(casesAhead / pace.fast);
  let late  = today + Math.round(casesAhead / pace.slow);
  const floor = Math.max(MIN_BAND_DAYS, Math.round(rawDays * MIN_BAND_FRACTION));
  if (late - early < floor) {
    // GROW LATE-HEAVY. Measured over 82,000 backtest predictions the misses are
    // consistently more often late than early (23% vs 35% at the near horizon):
    // a case gets delayed by an audit or an RFI, it is never decided sooner than
    // the queue allows. A symmetric floor therefore spends half its width on the
    // side the truth rarely lands. One third early, two thirds late.
    const grow = floor - (late - early);
    early -= Math.round(grow / 3);
    late  += Math.round((grow * 2) / 3);
  }
  early = Math.max(today + 1, early);   // a pending case cannot be decided in the past
  return {
    kind: "estimate",
    day,
    early: Math.min(early, day),          // the band must bracket the estimate
    late:  Math.max(late,  day),
    casesAhead, rawDays, pace: pace.pace,
  };
}
