/**
 * Where ONE case sits in the queue, derived from the live backlog.
 *
 * Outside the server-only boundary for the same reason liveQueue.ts and
 * queueAhead.ts are: these run under happy-dom in the unit project, where
 * importing `server-only` throws.
 *
 * NOTHING HERE PREDICTS ANYTHING. Every function is arithmetic over counts
 * that are already on the page, or over two dates the reader can check. The
 * page these feed answers a case number, which makes it feel personal, and a
 * reader will over-read any figure that looks tailored, so the line between
 * "measured now" and "modelled" has to hold in the data layer, not just in
 * the copy.
 *
 * The front comes from `findFront` rather than being recomputed, because a
 * second definition of "where DOL is working" is a page that contradicts the
 * queue overview two clicks away.
 */

import { findFront, monthsBetween, type CohortMonth } from "./liveQueue";

/** One filing month drawn on the wall. */
export interface WallSegment {
  month: string;
  /** Cases filed that month that are still undecided. */
  pending: number;
  /** Share of the drawn total, 0-100, so the drawing needs no arithmetic. */
  share: number;
  /** The reader's own filing month. */
  isSubject: boolean;
  /** The oldest month not substantially decided. */
  isFront: boolean;
}

export interface Wall {
  /** The front through the subject's month, oldest first. */
  segments: WallSegment[];
  /** Pending cases filed in STRICTLY earlier months than the subject's. */
  ahead: number;
  /**
   * The part of `ahead` that the drawn segments actually hold.
   *
   * Always the smaller of the two, because the drawing starts at the front
   * and `ahead` also counts cases still open in months DOL has otherwise
   * finished: a case in audit or on appeal since 2024 is undecided and was
   * filed earlier. The page states both rather than letting a reader add up
   * the segments and find a figure that disagrees with the headline.
   */
  drawnAhead: number;
  /** Still-pending cases filed in the same month as the subject. */
  sameMonth: number;
  /** The subject's own cohort row. */
  subject: CohortMonth;
  /** The month DOL is visibly working. */
  frontMonth: string;
  /**
   * Months from the front to the subject. Negative when the subject's month
   * is OLDER than the front, which is a real and common state: DOL has moved
   * past the month and this case is in one of the out-of-order queues.
   */
  monthsBehindFront: number;
  isPastFront: boolean;
}

/**
 * The wall between DOL's work front and one filing month.
 *
 * AHEAD IS PENDING-ONLY AND STRICTLY EARLIER. A decided case in an earlier
 * month is in front of nobody, and a still-pending case filed in the same
 * month is beside this one rather than in front of it. Summing `total`, or
 * including the subject's own month, both inflate the figure in the
 * direction that flatters the wait and both still look entirely plausible.
 *
 * Returns null rather than an empty drawing when there is nothing to draw:
 * no series, no locatable front, or a month the mirror has never seen. A
 * caller has to decide what absence looks like; a zeroed wall would render
 * as "nothing in front of you", which is the opposite of not knowing.
 */
export function buildWall(
  months: readonly CohortMonth[],
  filingMonth: string,
): Wall | null {
  const subject = months.find((x) => x.month === filingMonth);
  if (!subject) return null;
  const front = findFront(months);
  if (!front) return null;

  const monthsBehindFront = monthsBetween(front.month, filingMonth);
  const isPastFront = monthsBehindFront < 0;

  // Past the front there is no wall: every month between is finished, so
  // drawing a reversed span would invent a queue that is not there.
  const drawn = isPastFront
    ? [subject]
    : months.filter((x) => x.month >= front.month && x.month <= filingMonth);

  const drawnTotal = drawn.reduce((n, x) => n + x.pending, 0);
  const segments: WallSegment[] = drawn.map((x) => ({
    month: x.month,
    pending: x.pending,
    share: drawnTotal > 0 ? (x.pending / drawnTotal) * 100 : 0,
    isSubject: x.month === filingMonth,
    isFront: x.month === front.month,
  }));

  let ahead = 0;
  for (const x of months) if (x.month < filingMonth) ahead += x.pending;
  const drawnAhead = segments
    .filter((s) => !s.isSubject)
    .reduce((n, s) => n + s.pending, 0);

  return {
    segments,
    drawnAhead: isPastFront ? 0 : drawnAhead,
    // A straggler has cleared months behind it holding a handful of open
    // appeals. Those are not a queue in front of anybody, and counting them
    // would report a case DOL has already passed as still waiting on 5,000
    // others.
    ahead: isPastFront ? 0 : ahead,
    sameMonth: subject.pending,
    subject,
    frontMonth: front.month,
    monthsBehindFront,
    isPastFront,
  };
}

/**
 * How far through a filing month DOL has got, in the three states that
 * change what may honestly be said about it.
 *
 * This exists to keep a fiction off the page. DOL's disclosure files carry
 * no pending rows, so a duration computed from a young cohort is computed
 * entirely from the cases that finished FIRST, which three months in are
 * the instant withdrawals. The May 2026 cohort's decided cases have a raw
 * median of one day. Publishing that as "how long your month is taking"
 * would be indefensible, and it would look completely normal.
 */
export type CohortMaturity = "mature" | "working" | "untouched" | "unknown";

/** Below this many cases a month is too thin to characterise. */
const MATURITY_MIN_CASES = 100;
/** At or above this share decided, the surviving cases are the whole cohort. */
const MATURE_PCT = 90;
/** Below this share, the decided cases are the early exits and nothing else. */
const UNTOUCHED_PCT = 25;

export function cohortMaturity(cohort: CohortMonth): CohortMaturity {
  if (cohort.decidedPct === null || cohort.total < MATURITY_MIN_CASES) {
    return "unknown";
  }
  if (cohort.decidedPct >= MATURE_PCT) return "mature";
  if (cohort.decidedPct < UNTOUCHED_PCT) return "untouched";
  return "working";
}

/**
 * Below this share of a filing month present in DOL's decided files, a
 * duration computed from them describes the cases that finished first.
 */
const DURATION_MIN_COVERAGE = 0.8;

/**
 * Whether a duration may honestly be quoted for a filing month.
 *
 * THIS IS A SEPARATE JUDGEMENT FROM `cohortMaturity` AND THE DIFFERENCE IS
 * NOT COSMETIC. Maturity is measured against the LIVE mirror, which is
 * current. Durations come from DOL's quarterly disclosure files, which run
 * two months behind it. September 2025 is 85% decided in the mirror and
 * holds 527 of its 13,629 cases in the disclosure files (3.9%), so the
 * mirror calls that month nearly finished while the only durations available
 * for it are the fastest 4%. Their median is 56 days against a real cohort
 * that runs past 400.
 *
 * Measured on the live tables: the guard clears 2024 and 2025 months at
 * roughly 100% coverage, and refuses every 2026 month and September 2025.
 */
export function canQuoteCohortDuration(
  disclosureCount: number,
  cohortTotal: number,
): boolean {
  if (cohortTotal <= 0) return false;
  return disclosureCount / cohortTotal >= DURATION_MIN_COVERAGE;
}

/**
 * The subject's month with `span` months either side, clipped to the series.
 *
 * Clipped rather than padded: a month the mirror holds nothing for is not a
 * month with zero cases in it, and drawing one as an empty column says
 * something false about a period DOL simply has no data for here.
 */
export function neighbourMonths(
  months: readonly CohortMonth[],
  filingMonth: string,
  span = 2,
): CohortMonth[] {
  const i = months.findIndex((x) => x.month === filingMonth);
  if (i < 0) return [];
  return months.slice(Math.max(0, i - span), i + span + 1);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole days between two ISO dates, or null for anything unparseable.
 *
 * Null rather than NaN or zero on purpose: "0 days elapsed" is a claim, and
 * `Date.parse("2026-05T00:00:00Z")` is NaN, so a month passed where a date
 * was wanted would otherwise render "NaN days" or silently read as today.
 */
export function daysElapsed(
  from: string | null | undefined,
  to: string,
): number | null {
  if (!from || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export interface StatusCheck {
  /** The date part, for display. */
  date: string;
  ageDays: number;
  /** Old enough that DOL's own page is the better answer. */
  stale: boolean;
}

/**
 * A case's status is only as current as the last time it was read.
 *
 * MEASURED ON THE MIRROR: every pending case was last read in July or August
 * 2026, or carries no timestamp at all (11,955 of them). So a status here can
 * be weeks behind DOL's own page, and presenting it undated would be the
 * single most misleading thing this page could do: someone whose case was
 * certified last week would read "still in analyst review" and believe it.
 *
 * A decided status cannot change, so the age only matters while a case is
 * open; the caller decides whether to act on `stale`.
 */
export const STATUS_STALE_DAYS = 14;

export function statusCheckAge(
  lastCheckedAt: string | null | undefined,
  today: string,
): StatusCheck | null {
  if (!lastCheckedAt) return null;
  const date = lastCheckedAt.slice(0, 10);
  const ageDays = daysElapsed(date, today);
  if (ageDays === null) return null;
  return { date, ageDays, stale: ageDays > STATUS_STALE_DAYS };
}
