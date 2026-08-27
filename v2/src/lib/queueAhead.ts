/**
 * Derivations over the per-filing-month PERM queue.
 *
 * Deliberately outside the server-only boundary that publicData.ts sits
 * behind, for the same two reasons dolPace.ts is: the calculator is a client
 * component and recomputes this every time the reader picks a different
 * month, and the unit vitest project runs happy-dom, where importing
 * server-only throws.
 *
 * The input is structural rather than the MonthQueueStat row type, so nothing
 * here depends on the Turso layer. `getQueueAhead` computes the same `ahead`
 * server-side for its own default month; the fixture test below pins both to
 * one arithmetic so they cannot drift.
 *
 * WHAT MAKES THIS ANSWERABLE AT ALL. DOL's quarterly disclosure files carry a
 * decision date on every record and no pending rows whatsoever, so a count of
 * what is still in front of you cannot be derived from them at any level of
 * effort. These counts come from per-case status, mirrored with attribution.
 */

export interface MonthQueue {
  /** "YYYY-MM". */
  filingMonth: string;
  total: number;
  pending: number;
  decided: number;
  /** decided / total, 0-100. Null when the month holds nothing. */
  decidedPct: number | null;
  /**
   * Where the month's pending cases actually sit.
   *
   * Optional because they are extra columns on the same row rather than
   * something every caller needs, and because a caller passing a bare
   * {month, total, pending, decided} shape is still valid input to
   * everything above.
   */
  analystReview?: number;
  rfiIssued?: number;
  auditResponse?: number;
  appeals?: number;
}

export interface QueueAheadResult {
  /** Pending cases filed BEFORE this month. */
  ahead: number;
  /** Pending cases filed in the same month. */
  sameMonth: number;
  /** This month's own row, when the series holds one. */
  subject: MonthQueue | null;
}

/**
 * How many cases are still in front of a given filing month.
 *
 * PENDING ONLY, and that is the whole correctness question. A decided case in
 * an earlier month is no longer in front of anybody, so counting it would
 * inflate the figure in exactly the direction that flatters a wait. Summing
 * `total` instead of `pending` here would roughly quadruple the answer and
 * still look entirely plausible on the page.
 */
export function deriveQueueAhead(
  months: readonly MonthQueue[],
  filingMonth: string,
): QueueAheadResult {
  let ahead = 0;
  for (const m of months) {
    if (m.filingMonth < filingMonth) ahead += m.pending;
  }
  const subject = months.find((m) => m.filingMonth === filingMonth) ?? null;
  return { ahead, sameMonth: subject?.pending ?? 0, subject };
}

/**
 * The band DOL is visibly working: months it has started and not finished.
 *
 * A month at 0% has not been reached and one at ~100% is done, so the months
 * between the two are where the work front actually is. Mirrors the same
 * thresholds `getQueueAhead` uses server-side.
 */
export function deriveActiveRange(
  months: readonly MonthQueue[],
): { from: string; to: string } | null {
  const working = months.filter(
    (m) => m.decidedPct !== null && m.decidedPct > 0.5 && m.decidedPct < 99,
  );
  if (working.length === 0) return null;
  return {
    from: working[0]!.filingMonth,
    to: working[working.length - 1]!.filingMonth,
  };
}

/** A month whose filing volume collapsed against both of its neighbours. */
export interface VolumeAnomaly {
  filingMonth: string;
  total: number;
  /** Mean of the two neighbouring months' totals. */
  neighbourMean: number;
  /** total / neighbourMean, so 0.11 reads as "a ninth of normal". */
  ratio: number;
}

/** Below this share of the neighbouring mean, a month is a cliff, not noise. */
const ANOMALY_RATIO = 0.4;

/**
 * Months where far fewer cases were filed than in either neighbour.
 *
 * October 2025 holds 1,616 against roughly 14,000 either side. That collapse
 * is REAL and it must not be smoothed away or dropped, but an unexplained
 * cliff in a chart reads as a bug, so the chart marks it and says so.
 *
 * Detected rather than hardcoded to that one month, because a hardcoded
 * special case is a claim about the future as well as the past. Requiring
 * BOTH neighbours also excludes the newest month, which is always partial
 * simply because it is still being filed into, and the oldest, which has no
 * left-hand neighbour to be compared against.
 */
export function findVolumeAnomalies(
  months: readonly MonthQueue[],
): VolumeAnomaly[] {
  const out: VolumeAnomaly[] = [];
  for (let i = 1; i < months.length - 1; i++) {
    const prev = months[i - 1]!;
    const cur = months[i]!;
    const next = months[i + 1]!;
    const neighbourMean = (prev.total + next.total) / 2;
    if (neighbourMean <= 0) continue;
    const ratio = cur.total / neighbourMean;
    if (ratio < ANOMALY_RATIO) {
      out.push({ filingMonth: cur.filingMonth, total: cur.total, neighbourMean, ratio });
    }
  }
  return out;
}
