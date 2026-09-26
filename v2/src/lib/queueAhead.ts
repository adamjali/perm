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

/**
 * The cases in a month that are actually IN LINE: `analystReview` when the row
 * carries it, every pending case otherwise.
 *
 * MEASURED 2026-09-26, and it is the largest error the estimator had. About
 * 5,700 pending cases sit on hold, at an RFI, on appeal or at NORD. They are
 * not in filing order (DOL is not working them as part of the line), and
 * counting them as ahead of everybody filed later added about a week to every
 * date. Rebuilding the queue as it stood on 2026-09-13 and scoring 7,112 real
 * decisions: counting every pending case gave a typical miss of 9.5 days and
 * 73% right on "decided by Sep 25"; counting ANALYST REVIEW only gave 3.9 days
 * and 86%. The ledger's recorded case landed 15 days early against the old
 * count. Method and figures: .planning/estimator-backtest-2026-09-26.md.
 *
 * The fallback to `pending` keeps every caller that passes a bare
 * {total, pending, decided} row answering exactly as before.
 */
export function inLine(m: { pending: number; analystReview?: number }): number {
  return typeof m.analystReview === "number" ? m.analystReview : m.pending;
}

export interface QueueAheadResult {
  /** Cases in line filed BEFORE this month (see `inLine`). */
  ahead: number;
  /** Cases in line filed in the same month. */
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
 * still look entirely plausible on the page. And IN LINE only: a case on
 * hold or at an RFI is pending but is not in front of anyone (see `inLine`).
 */
export function deriveQueueAhead(
  months: readonly MonthQueue[],
  filingMonth: string,
): QueueAheadResult {
  let ahead = 0;
  for (const m of months) {
    if (m.filingMonth < filingMonth) ahead += inLine(m);
  }
  const subject = months.find((m) => m.filingMonth === filingMonth) ?? null;
  return { ahead, sameMonth: subject ? inLine(subject) : 0, subject };
}

/**
 * A month is not counted as settled until it has stopped growing.
 *
 * MEASURED 2026-09-13 and it is not a small effect: over one week the
 * August-2026 filing month gained 1,261 cases (+16.4%), June gained 463
 * (+4.6%), and July gained 40 (+0.4%). DOL keeps indexing a month for weeks
 * after it ends and our own discovery keeps finding cases in it, so the two
 * or three newest months are always undercounts.
 *
 * Averaging them in makes the filing rate look SLOWER than it is, which makes
 * a future estimate look sooner than it should - the error points the
 * flattering way, which is the kind that survives review. Two months is where
 * growth fell under 1% in the measurement above.
 */
export const SETTLED_MONTH_LAG = 2;

export interface FilingRate {
  /** Cases received per CALENDAR day. */
  perDay: number;
  /** The months averaged, inclusive, as `YYYY-MM`. */
  from: string;
  to: string;
  monthsUsed: number;
}

/**
 * How fast cases are arriving, measured over months that have stopped growing.
 *
 * CALENDAR days, not working days, because the only thing this is ever
 * multiplied by is calendar days between today and a future filing date - the
 * same reason the decision pace is a calendar rate.
 *
 * Returns null rather than a guess when there are too few settled months.
 * `window` is how many settled months to average; filings are seasonal (Feb
 * 2026 ran 5,492 against June's 10,627, roughly half) so a short window is
 * noisy and a long one lags. Six is a compromise and the caller states it.
 */
export function measureFilingRate(
  months: readonly MonthQueue[],
  today: string,
  window = 6,
): FilingRate | null {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  if (!m) return null;
  // The newest month that is allowed to count, as YYYY-MM.
  const cutoff = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 - SETTLED_MONTH_LAG, 1))
    .toISOString()
    .slice(0, 7);
  const settled = months
    .filter((x) => x.filingMonth <= cutoff && x.total > 0)
    .sort((a, b) => (a.filingMonth < b.filingMonth ? -1 : 1))
    .slice(-window);
  if (settled.length < 3) return null;
  const total = settled.reduce((a, x) => a + x.total, 0);
  const first = settled[0]!;
  const last = settled[settled.length - 1]!;
  return {
    // 30.44 is the mean calendar month. The window spans whole months, so
    // there is no day-count to take from the calendar here.
    perDay: total / settled.length / 30.44,
    from: first.filingMonth,
    to: last.filingMonth,
    monthsUsed: settled.length,
  };
}

/**
 * Undecided cases filed before a given DAY, from month-granular counts.
 *
 * WHY PRORATION RATHER THAN A CLEAN MONTH BOUNDARY. The census counts pending
 * cases by filing MONTH, and "filed before yours" is a question about a day.
 * Counting only strictly-earlier months drops every case filed earlier in your
 * own month, and that is not a rounding error: a recent month carries several
 * thousand pending, which at DOL's measured ~625 decisions a day is one to two
 * weeks of the answer.
 *
 * So the same month is prorated by how far through it the filing date sits.
 * The assumption is uniform filing within a month, which is stated rather than
 * hidden and is roughly true - DOL receives on business days, and months are
 * mostly business days. It is a far smaller error than dropping the month.
 *
 * Returns null when the month is not in the series at all, because a zero
 * would read as "nothing ahead of you", which is the one answer this must
 * never invent.
 */
export interface AheadOptions {
  /** `YYYY-MM-DD`. Required to answer for a date after the census ends. */
  today?: string;
  /** Cases arriving per calendar day, from `measureFilingRate`. */
  filingRate?: number | null;
}

export interface AheadResult {
  total: number;
  /** Undecided cases in line that already exist (see `inLine`). */
  pending: number;
  /**
   * Cases expected to be filed between today and a future filing date.
   *
   * Zero for any date that is not in the future. Kept separate from `pending`
   * because one is counted and the other is projected, and a reader is owed
   * the difference.
   */
  projected: number;
}

/**
 * The same count, decomposed, and able to answer for a date in the FUTURE.
 *
 * WHY THE FUTURE NEEDS ITS OWN BRANCH. `casesAheadOfDay` returns null for any
 * month the census does not hold, which is right for a date BEFORE our data
 * (we genuinely do not know) and wrong for one after it (we know exactly:
 * every pending case is ahead of you, because you have not filed yet). Those
 * two were lumped together and both answered null.
 *
 * AND TODAY'S BACKLOG ALONE IS NOT THE ANSWER FOR A FUTURE DATE. People keep
 * filing between now and then - about 264 a calendar day, measured - and every
 * one of them is ahead of you. Counting only today's pending gives EVERY
 * future date the same answer: 95,326 ahead whether you file next month or
 * next year, which is transparently wrong and is what both rivals ship
 * (the rival tracker returns its whole backlog for a November date, with
 * `your_position_in_month: 0`). At a year out that understates the queue by
 * roughly 100,000 cases.
 *
 * The projection is returned SEPARATELY so the caller can say which half is
 * counted and which is assumed. It is never folded in silently.
 */
export function aheadOfDay(
  months: readonly MonthQueue[],
  filingDate: string,
  opts: AheadOptions = {},
): AheadResult | null {
  const counted = casesAheadOfDay(months, filingDate);
  if (counted !== null) return { total: counted, pending: counted, projected: 0 };

  // Not in the census. Two opposite reasons, and only one is answerable.
  const newest = months.reduce<string>((a, m) => (m.filingMonth > a ? m.filingMonth : a), "");
  if (!newest || filingDate.slice(0, 7) <= newest) return null; // before our data

  const pending = months.reduce((a, m) => a + inLine(m), 0);
  const { today, filingRate } = opts;
  if (!today || !filingRate || !(filingRate > 0)) {
    // Answerable but not projectable: say what we counted and nothing more.
    return { total: pending, pending, projected: 0 };
  }
  const days = Math.max(
    0,
    Math.round(
      (Date.parse(`${filingDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
    ),
  );
  const projected = Math.round(filingRate * days);
  return { total: pending + projected, pending, projected };
}

export function casesAheadOfDay(
  months: readonly MonthQueue[],
  filingDate: string,
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filingDate);
  if (!m) return null;
  const filingMonth = `${m[1]}-${m[2]}`;
  const day = Number(m[3]);
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(day) || day < 1) return null;
  const { ahead, sameMonth, subject } = deriveQueueAhead(months, filingMonth);
  if (!subject) return null;
  // Days in the filing month, from the calendar rather than a 30.44 constant:
  // this divides a real count, so February must be 28 or 29.
  const daysInMonth = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  // (day - 1), not day: cases filed on your own day are not ahead of you.
  const share = Math.min(1, Math.max(0, (day - 1) / daysInMonth));
  return ahead + Math.round(sameMonth * share);
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
