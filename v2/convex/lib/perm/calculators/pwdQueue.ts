import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { addMonths, monthStart, monthsBetween } from '../dates/monthUtils';
import { addBusinessDays, subtractBusinessDays } from '../dates/businessDays';
import { isBusinessDay } from '../dates/holidays';
import { boundRange, COLLAPSE_FRACTION, type MeasuredRangeRow } from './decisionPace';

/**
 * Prevailing wage determination queue estimation.
 *
 * The PWD is the first step of a PERM and it gates every date after it, yet
 * essentially every public PERM estimator ignores it and starts the clock at
 * the ETA-9089. It also has better data behind it than the PERM queue does:
 * DOL publishes the number of PWD requests still PENDING per month of receipt,
 * so the requests ahead of a given case can be counted rather than modelled.
 * The PERM disclosure files contain no pending rows at all, which is why the
 * PERM estimator has to work from percentiles and a frontier instead.
 *
 * What is still not directly published is how fast that backlog drains. It is
 * measurable from consecutive snapshots and this module will use it once there
 * are two; until then the wait is deliberately left null rather than filled
 * with a plausible constant.
 */

// ============================================================================
// TYPES
// ============================================================================

/** One month of DOL's published PWD backlog for the PERM program. */
export interface PwdBacklogMonth {
  /** Month of receipt, `YYYY-MM`. */
  receiptMonth: string;
  remainingRequests: number;
}

export interface PwdQueueInput {
  /** Month DOL received the ETA-9141, `YYYY-MM`. */
  requestMonth: string;
  /**
   * Month DOL is currently issuing determinations for, `YYYY-MM`.
   * DOL publishes this separately for OEWS and non-OEWS wage sources.
   */
  frontierMonth: string | null;
  backlog: readonly PwdBacklogMonth[];
  /** DOL's own as-of stamp for the PWD section, `YYYY-MM-DD`. */
  asOf: string;
  /**
   * Requests DOL clears per month, measured from consecutive snapshots.
   * Null until two snapshots exist. Never assume a value: the whole estimate
   * scales linearly with it.
   */
  clearancePerMonth?: number | null;
}

export interface PwdQueueEstimate {
  requestMonth: string;
  /** Pending requests received in a month EARLIER than this one. */
  requestsAhead: number;
  /** Pending requests received in the same month, position within unknown. */
  requestsSameMonth: number;
  /** Every pending request DOL has on record for PERM. */
  totalPending: number;
  /** Positive = DOL has not reached this month. Null without a frontier. */
  monthsBehindFrontier: number | null;
  /** Months of waiting, or null when the drain rate is not yet measurable. */
  estimatedMonthsRemaining: number | null;
  /** `YYYY-MM`, or null for the same reason. */
  estimatedMonth: string | null;
  caveats: string[];
}



/**
 * Estimate the prevailing wage determination wait.
 *
 * `requestsAhead` is a real count from DOL's published backlog, not a model,
 * and is returned even when no wait can be computed: "15,193 requests are
 * ahead of yours" is a concrete, checkable fact and is the most useful thing
 * on the page when the drain rate is unknown.
 */
export function estimatePwdQueue(input: PwdQueueInput): PwdQueueEstimate {
  const requestMonth = input.requestMonth;
  monthStart(requestMonth, 'requestMonth'); // validate

  let requestsAhead = 0;
  let requestsSameMonth = 0;
  let totalPending = 0;

  for (const row of input.backlog) {
    totalPending += row.remainingRequests;
    // String comparison is correct and total for zero-padded `YYYY-MM`.
    if (row.receiptMonth < requestMonth) {
      requestsAhead += row.remainingRequests;
    } else if (row.receiptMonth === requestMonth) {
      requestsSameMonth += row.remainingRequests;
    }
  }

  const monthsBehindFrontier = input.frontierMonth
    ? monthsBetween(input.frontierMonth, requestMonth, 'frontierMonth', 'requestMonth')
    : null;

  const caveats: string[] = [];

  let estimatedMonthsRemaining: number | null = null;
  let estimatedMonth: string | null = null;

  const rate = input.clearancePerMonth;
  if (typeof rate === 'number' && rate > 0) {
    // Half of the same-receipt-month requests on average, since position
    // within a month is not published.
    const effective = requestsAhead + requestsSameMonth / 2;
    estimatedMonthsRemaining = effective / rate;
    // The wait runs from DOL's as-of date, because that is when the counts it
    // divides were true. Until Oct 3 2026 it ran from the REQUEST month, so a
    // June request with a few thousand ahead came out "July 2026" in late
    // September: a month already past, for every request not yet decided.
    //
    // Month arithmetic on the numbers, never through a Date. Building the
    // target with Date.UTC and rendering it with date-fns `format` reads the
    // instant back in LOCAL time, so 2026-09-01T00:00Z printed as "2026-08"
    // anywhere west of UTC and the estimate came out a month early.
    const asOfMonth = input.asOf.slice(0, 7);
    const day = Number(input.asOf.slice(8, 10));
    const [y, m] = asOfMonth.split('-').map(Number) as [number, number];
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // Months past the start of the as-of month: Sep 30 is 1.0, Sep 15 is 0.5.
    const into = day / daysInMonth + estimatedMonthsRemaining;
    estimatedMonth = addMonths(asOfMonth, Math.max(0, Math.ceil(into - 1e-9) - 1));
  } else {
    caveats.push(
      'How fast DOL clears the prevailing wage backlog is not something it publishes, and we will not guess at it. The count of requests ahead is exact; the wait it implies is not shown until the rate can be measured from DOL’s own figures over time.',
    );
  }

  if (requestsAhead === 0 && monthsBehindFrontier !== null && monthsBehindFrontier < 0) {
    caveats.push(
      `DOL has already worked past ${requestMonth} and has no requests left pending from before it. A request from that month that has had no determination is likely to have a problem with the filing itself rather than to be waiting in line.`,
    );
  }

  caveats.push(
    'A prevailing wage determination is the first step of a PERM, not the whole thing. The recruitment window and the ETA-9089 filing window both run from the date it is issued.',
  );

  return {
    requestMonth,
    requestsAhead,
    requestsSameMonth,
    totalPending,
    monthsBehindFrontier,
    estimatedMonthsRemaining,
    estimatedMonth,
    caveats,
  };
}

/**
 * Measure how many PWD requests DOL clears per month from two snapshots.
 *
 * Compares the same receipt months across both and sums how far each fell.
 * Months present in only one snapshot are skipped: a month that appears in the
 * later snapshot and not the earlier is new intake, not clearance, and
 * counting it would net out to a smaller number than DOL actually processed.
 *
 * Returns null when the snapshots are the same month or the backlog grew,
 * because neither yields a usable rate.
 */
export function measurePwdClearance(
  earlier: { asOf: string; backlog: readonly PwdBacklogMonth[] },
  later: { asOf: string; backlog: readonly PwdBacklogMonth[] },
): number | null {
  const months = differenceInCalendarMonths(
    parseISO(later.asOf),
    parseISO(earlier.asOf),
  );
  if (months < 1) return null;

  const earlierByMonth = new Map(earlier.backlog.map((r) => [r.receiptMonth, r.remainingRequests]));

  let cleared = 0;
  for (const row of later.backlog) {
    const before = earlierByMonth.get(row.receiptMonth);
    if (before === undefined) continue; // new intake, not clearance
    if (before > row.remainingRequests) cleared += before - row.remainingRequests;
  }

  if (cleared <= 0) return null;
  return cleared / months;
}

// ============================================================================
// THE DAY (Oct 8 2026; working days since Oct 15 2026)
// ============================================================================

/**
 * The PERM wage-request queue as our nightly sweep counts it
 * (perm_docs['pwd_day_queue'], scripts/ingest_pwd_status_direct.py).
 *
 * The month estimate above divides DOL's monthly backlog; this counts the
 * requests themselves. Every PERM wage request in process carries its filing
 * day, so the count ahead of one is exact rather than half a month, and DOL's
 * pace is measured from the requests our sweep watched it finish. The
 * standing backtest (scripts/backtest_pwd.py, its day section) tests it
 * against what DOL went on to do, and measures the range by distance.
 *
 * DOL'S DAYS, NOT OURS (Oct 15 2026). FLAG shows a new status the day DOL
 * decides it and our sweep reads it the next morning, so the sweep dates
 * every exit by the day DOL made it (scripts/lib_holidays.py, decided_on),
 * and the walk counts the days DOL works: weekdays that aren't federal
 * holidays. Counting calendar days on the sweep's own clock had dated
 * requests about 2 days late, most of all across a weekend or a holiday.
 */
export interface PwdDayQueue {
  /** The day the sweep counted, `YYYY-MM-DD`: the queue as DOL left it the day before. */
  asOf: string;
  /** Requests in process by filing day: `[YYYY-MM-DD, count]`, any order. */
  byDay: readonly (readonly [string, number])[];
  /** Requests DOL finishes a working day (measureWorkdayPace). */
  pace: WorkdayPace;
}

/** DOL's recent pace on wage requests, a working day. */
export interface WorkdayPace {
  /** Every request DOL finished in the window, over the working days in it. */
  perWorkday: number;
  /** The fastest recent week (90th percentile of 5-working-day stretches), a working day: the early edge. */
  fast: number;
  /** The slowest recent week (10th percentile), a working day: the late edge. */
  slow: number;
  workdaysUsed: number;
}

/** Fewer working days than this in the window and there's no pace to quote. */
export const PWD_MIN_WORKDAYS = 10;
/** The edges are DOL's fastest and slowest stretch of this many working days. */
export const PWD_EDGE_WORKDAYS = 5;

/**
 * DOL's wage-request pace a working day, or null when the window can't carry
 * one. `days` are DOL's days (the day each request was decided), every
 * calendar day in the window with its count, zeros included. A weekend's
 * few decisions count toward the total; a run of three or more working days
 * under a sixth of the usual (a shutdown, a broken feed) is left out, since
 * that isn't a pace.
 *
 * The edges are weeks, not days. A date weeks out depends on DOL's pace over
 * those weeks, and DOL's Fridays run at about half its other days (measured
 * Sep 16 to Oct 13 2026: 277 to 484 against 688 to 988), so the slowest
 * single day would stretch every far range to months. Its slowest and
 * fastest five-working-day stretches ran 669 and 775 a day over the same
 * weeks, against 734 for the whole window.
 */
export function measureWorkdayPace(days: readonly { date: string; n: number }[]): WorkdayPace | null {
  const ordered = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const work = ordered.filter((d) => isBusinessDay(d.date));
  if (work.length < PWD_MIN_WORKDAYS) return null;
  const sorted = work.map((d) => d.n).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (!(median > 0)) return null;
  const low = (d: { n: number }) => d.n < median * COLLAPSE_FRACTION;
  // Mark each working day inside a run of three or more low ones.
  const dropped = new Set<string>();
  for (let i = 0; i < work.length; ) {
    let j = i;
    while (j < work.length && low(work[j]!)) j++;
    if (j - i >= 3) for (let k = i; k < j; k++) dropped.add(work[k]!.date);
    i = j > i ? j : i + 1;
  }
  const kept = ordered.filter((d) => !dropped.has(d.date));
  const keptWork = kept.filter((d) => isBusinessDay(d.date)).map((d) => d.n);
  if (keptWork.length < PWD_MIN_WORKDAYS) return null;
  const total = kept.reduce((a, d) => a + d.n, 0);
  const perWorkday = total / keptWork.length;
  const mean = keptWork.reduce((a, b) => a + b, 0) / keptWork.length;
  // A weekend's few count toward the pace, so each stretch carries them too.
  const scale = mean > 0 ? perWorkday / mean : 1;
  const weeks: number[] = [];
  for (let i = 0; i + PWD_EDGE_WORKDAYS <= keptWork.length; i++) {
    let sum = 0;
    for (let k = i; k < i + PWD_EDGE_WORKDAYS; k++) sum += keptWork[k]!;
    weeks.push((sum / PWD_EDGE_WORKDAYS) * scale);
  }
  weeks.sort((a, b) => a - b);
  const q = (p: number) => weeks[Math.floor(p * (weeks.length - 1))] ?? 0;
  const fast = q(0.9);
  const slow = q(0.1);
  if (!(perWorkday > 0 && slow > 0)) return null;
  return { perWorkday, fast, slow, workdaysUsed: keptWork.length };
}

export interface PwdDayInput {
  /** The request's filing day, `YYYY-MM-DD`. */
  filingDate: string;
  today: string;
  queue: PwdDayQueue;
  /**
   * Ranges the backtest measured, by WORKING days out: `fromDays` to `toDays`
   * working days from the count, `earlyDays` and `lateDays` in working days
   * around the date. Other distances use the pace spread.
   */
  measuredRange?: readonly MeasuredRangeRow[] | null;
}

export type PwdDayEstimate =
  | {
      kind: 'estimate';
      /** `YYYY-MM-DD`, a day DOL works. */
      date: string;
      earliest: string;
      latest: string;
      /** Requests in process filed earlier, same-day filings counted half. */
      requestsAhead: number;
      /** DOL working days from the count to the date. */
      workdays: number;
      /** Requests DOL finishes a working day. */
      pace: number;
      rangeFrom: 'measured' | 'pace';
    }
  | { kind: 'refused'; reason: 'stale'; detail: string };

/** Past this many days the count and the pace are too old to date a request from. */
export const PWD_DAY_MAX_AGE_DAYS = 3;

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const isoOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** The first day DOL works on or after `iso`. */
const workdayFrom = (iso: string) => addBusinessDays(isoOf(dayNum(iso) - 1), 1);

/**
 * A wage request's likely determination day: the requests in process filed
 * before it, divided by DOL's pace a working day, counted in DOL's working
 * days from the last day the sweep's count covers. DOL works wage requests in
 * the order it received them. A date that has already come (the count is a
 * day or two old) becomes the next day DOL works: any day now.
 */
export function estimatePwdDay(input: PwdDayInput): PwdDayEstimate {
  const { filingDate, queue } = input;
  const today = dayNum(input.today);
  const asOf = dayNum(queue.asOf);
  if (today - asOf > PWD_DAY_MAX_AGE_DAYS) {
    return { kind: 'refused', reason: 'stale', detail: `Our last count of DOL's wage queue was ${today - asOf} days ago.` };
  }
  let ahead = 0;
  for (const [fd, n] of queue.byDay) {
    if (fd < filingDate) ahead += n;
    else if (fd === filingDate) ahead += n / 2;
  }
  const pace = queue.pace;
  // The count is the queue as DOL left it the day before the sweep.
  const counted = isoOf(asOf - 1);
  const open = workdayFrom(input.today);
  const walk = (rate: number) => addBusinessDays(counted, Math.max(1, Math.round(ahead / rate)));
  const workdays = Math.max(1, Math.round(ahead / pace.perWorkday));
  let date = addBusinessDays(counted, workdays);
  if (date < open) date = open;
  const row = input.measuredRange?.find((r) => r.fromDays <= workdays && workdays <= r.toDays);
  let early: string;
  let late: string;
  if (row) {
    const before = Math.max(0, -Math.min(0, row.earlyDays));
    early = before > 0 ? subtractBusinessDays(date, before) : date;
    late = addBusinessDays(date, Math.max(0, row.lateDays));
  } else {
    // If DOL keeps to its fastest or slowest recent week.
    early = walk(pace.fast);
    late = walk(pace.slow);
  }
  if (early < open) early = open;
  const [e, l] = boundRange(dayNum(date), dayNum(early), dayNum(late), today);
  return {
    kind: 'estimate',
    date,
    earliest: isoOf(e),
    latest: isoOf(l),
    requestsAhead: Math.round(ahead),
    workdays,
    pace: pace.perWorkday,
    rangeFrom: row ? 'measured' : 'pace',
  };
}
