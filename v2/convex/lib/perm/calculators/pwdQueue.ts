import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { addMonths, monthStart, monthsBetween } from '../dates/monthUtils';

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
    // Month arithmetic on the numbers, never through a Date. Building the
    // target with Date.UTC and rendering it with date-fns `format` reads the
    // instant back in LOCAL time, so 2026-09-01T00:00Z printed as "2026-08"
    // anywhere west of UTC and the estimate came out a month early.
    estimatedMonth = addMonths(requestMonth, Math.ceil(estimatedMonthsRemaining));
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
