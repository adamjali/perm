/**
 * Date-range coverage: which of our two records can answer a given day.
 *
 * A PLAIN MODULE, DELIBERATELY. `turso/decidedDays.ts` is `server-only`, and
 * the browser needs the same arithmetic to decide which controls to enable.
 * One definition reachable from both sides; a second copy is a page that
 * enables a filter the route cannot serve, which is the exact invariant the
 * case search already protects.
 *
 * The two records are not interchangeable and their windows do not meet:
 *
 *   decided   published quarterly files, 2023-10-01 -> 2026-06-30
 *   observed  our own sweep's event log,  2026-08-26 -> today
 *
 * The gap between them is real, and `uncoveredDays` is what lets a page say
 * "we hold nothing for that day" instead of rendering an empty table, which a
 * reader correctly reads as "DOL did nothing".
 */

/** A closed date range, inclusive at both ends. `from === to` is one day. */
export interface DateRange {
  from: string;
  to: string;
}

/** What each dimension can answer, measured from the tables themselves. */
export interface CoverageWindows {
  /** Published decisions, from the quarterly files. */
  decided: DateRange | null;
  /** Our own observations, from the sweep's event log. */
  observed: DateRange | null;
}

/** How a chosen date or range lands against those windows. */
export interface SelectionCoverage {
  selection: DateRange;
  /** The part of the selection the published files can answer. */
  decided: DateRange | null;
  /** The part the event log can answer. */
  observed: DateRange | null;
  /** Days answered by neither, which is an honest "we hold nothing". */
  uncoveredDays: number;
  totalDays: number;
}

const MS_PER_DAY = 86_400_000;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** True for a well-formed `YYYY-MM-DD` that is also a real calendar date. */
export function isIsoDate(v: string): boolean {
  if (!ISO.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

/** Inclusive day count. A single day is 1, not 0. */
export function daysInRange(r: DateRange): number {
  const lo = Date.parse(`${r.from}T00:00:00Z`);
  const hi = Date.parse(`${r.to}T00:00:00Z`);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return 0;
  return Math.round((hi - lo) / MS_PER_DAY) + 1;
}

/** The overlap of two closed ranges, or null when they do not touch. */
export function intersect(a: DateRange, b: DateRange | null): DateRange | null {
  if (!b) return null;
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return from <= to ? { from, to } : null;
}

/**
 * How a selection lands against the two windows.
 *
 * PURE, AND THAT IS DELIBERATE. The page decides which controls to enable from
 * this, and the same answer has to be reachable from a test without a
 * database. `uncoveredDays` is what licenses an honest "we hold nothing for
 * this day" instead of a blank table that reads as "DOL did nothing".
 */
export function coverageFor(
  selection: DateRange,
  windows: CoverageWindows,
): SelectionCoverage {
  const decided = intersect(selection, windows.decided);
  const observed = intersect(selection, windows.observed);
  const total = daysInRange(selection);
  // Days covered by EITHER, counted without double-billing the overlap. The
  // two windows are contiguous-or-disjoint in practice, but computing it from
  // the union rather than by adding keeps it correct if they ever overlap.
  const covered = unionDays(decided, observed);
  return {
    selection,
    decided,
    observed,
    totalDays: total,
    uncoveredDays: Math.max(0, total - covered),
  };
}

function unionDays(a: DateRange | null, b: DateRange | null): number {
  if (!a) return b ? daysInRange(b) : 0;
  if (!b) return daysInRange(a);
  const overlap = intersect(a, b);
  return daysInRange(a) + daysInRange(b) - (overlap ? daysInRange(overlap) : 0);
}

/** Filters a decided row can actually be narrowed by. */
export interface DecidedNarrow {
  employer?: string;
  state?: string;
  socCode?: string;
  /** PERM only; the wage-request and LCA files carry no attorney column. */
  attorney?: string;
  status?: string;
  minWage?: number;
  maxWage?: number;
}

/** True when a narrow can be served by an index rather than a row-by-row walk. */
export function narrowIsIndexed(n: DecidedNarrow): boolean {
  return n.minWage === undefined && n.maxWage === undefined;
}

