/**
 * Derivations over the live per-case mirror.
 *
 * Outside the server-only boundary for the same reason as dolPace.ts,
 * queueAhead.ts and wageStats.ts: these run in client components and the unit
 * vitest project uses happy-dom, where importing server-only throws.
 *
 * WHY THIS DATA IS DIFFERENT FROM EVERYTHING ELSE ON THE SITE. DOL's quarterly
 * disclosure files carry a decision date on every record and no pending rows
 * at all. This mirror carries per-case CURRENT status, so it can answer where
 * the queue actually stands rather than where it stood when a quarter closed.
 *
 * KEY OFF `isFinal`, NEVER A STATUS LIST. Verified on the settled table at
 * 412,865 rows: zero integrity violations across every status, so final is
 * exact. It is also the reason nothing broke when the count went from 15
 * distinct statuses to 16: `DENIED - BALCA DISMISSED` appeared with a single
 * case, and a hardcoded list would have silently dropped it into the wrong
 * group while looking entirely healthy.
 */

export interface CohortMonth {
  /** Filing month, "YYYY-MM". */
  month: string;
  total: number;
  pending: number;
  decided: number;
  /** decided / total as 0-100, null when the month holds nothing. */
  decidedPct: number | null;
}

/**
 * Where DOL is visibly working, and how much is stacked behind it.
 *
 * THE FRONT IS NOT "THE OLDEST MONTH WITH ANYTHING PENDING". A handful of
 * cases from 2023 are still open in audit or on appeal, and letting one of
 * those define the front would report DOL as three years behind when it is
 * working a month from last autumn. The front is the oldest month that is not
 * substantially finished, which is a claim about the bulk of a cohort rather
 * than about its stragglers.
 */
export const FRONT_DONE_PCT = 90;

/** A month below this many cases is too thin to place the front on. */
export const FRONT_MIN_CASES = 100;

export interface QueueFront {
  /** The oldest month not yet substantially decided. */
  month: string;
  /** Cases still pending in that month. */
  pendingHere: number;
  /**
   * Every undecided case in the mirror. THE wall, and the headline figure.
   *
   * Not "pending at or before the front", which was the first shape of this
   * and answers a different question. A reader asking how big the wall is
   * means the whole backlog DOL still has to get through, not the remainder
   * of the month it happens to be working.
   */
  wallTotal: number;
  /**
   * Pending at or before the front: what DOL must clear to move past this
   * month. A much smaller number, and the one that moves week to week.
   */
  pendingToClear: number;
  /** How far the front sits behind the newest month with filings. */
  monthsBack: number;
  decidedPct: number | null;
}

/** Whole months between two "YYYY-MM" strings. */
export function monthsBetween(from: string, to: string): number {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
  );
}

/**
 * Locate the work front in a series ordered oldest first.
 *
 * Returns null rather than guessing when no month qualifies: an empty or
 * fully-decided series has no front, and inventing one would put a date on
 * the page that describes nothing.
 */
export function findFront(months: readonly CohortMonth[]): QueueFront | null {
  if (months.length === 0) return null;
  const front = months.find(
    (m) =>
      m.total >= FRONT_MIN_CASES &&
      m.pending > 0 &&
      (m.decidedPct === null || m.decidedPct < FRONT_DONE_PCT),
  );
  if (!front) return null;

  const wallTotal = months.reduce((n, m) => n + m.pending, 0);
  const pendingToClear = months
    .filter((m) => m.month <= front.month)
    .reduce((n, m) => n + m.pending, 0);

  const newest = months[months.length - 1]!.month;
  return {
    month: front.month,
    pendingHere: front.pending,
    wallTotal,
    pendingToClear,
    monthsBack: monthsBetween(front.month, newest),
    decidedPct: front.decidedPct,
  };
}

/** One status bucket within a filing month. */
export interface StatusCount {
  /** Normalised, upper case. */
  status: string;
  count: number;
  isFinal: boolean;
}

/**
 * Split a cohort's statuses into the three groups a reader can act on.
 *
 * ANALYST REVIEW is the ordinary queue and is the only one where waiting is
 * the whole story. RFI, audit, supervised recruitment and the appeals tail are
 * separate queues that take a case OUT of filing order, which is the honest
 * answer to "DOL passed my month and I have nothing". Decided is decided.
 */
export const ORDINARY_QUEUE = "ANALYST REVIEW";

export interface CohortSplit {
  ordinary: number;
  outOfOrder: StatusCount[];
  decided: StatusCount[];
  pending: number;
  total: number;
}

export function splitCohort(counts: readonly StatusCount[]): CohortSplit {
  let ordinary = 0;
  const outOfOrder: StatusCount[] = [];
  const decided: StatusCount[] = [];
  for (const c of counts) {
    if (c.isFinal) decided.push(c);
    else if (c.status === ORDINARY_QUEUE) ordinary += c.count;
    else outOfOrder.push(c);
  }
  const sum = (xs: readonly StatusCount[]) => xs.reduce((n, x) => n + x.count, 0);
  const pending = ordinary + sum(outOfOrder);
  return {
    ordinary,
    outOfOrder: outOfOrder.sort((a, b) => b.count - a.count),
    decided: decided.sort((a, b) => b.count - a.count),
    pending,
    total: pending + sum(decided),
  };
}
