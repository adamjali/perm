/**
 * USCIS's I-129 request-for-evidence counts, shaped for the page: shares,
 * fiscal-year totals, and the headline comparison.
 *
 * A plain module (no `server-only`) so the unit project tests it; the page
 * reads the rows through `src/lib/db/uscisRfe.ts`. Every share here is
 * computed from USCIS's counts, never read from its percentage columns:
 * the spreadsheet and CSV editions print "Approved with RFE (%)" over two
 * different denominators under one heading, so the counts are the only
 * reading that means the same thing in every year.
 */

import { MONTH_ABBR, MONTH_NAMES } from "@convex/lib/months";

/** One visa's month, as `scripts/ingest_uscis_rfe.py` stored it. */
export interface RfeMonth {
  fy: number;
  /** Calendar month, 1 to 12: October is month 10 of the fiscal year it opens. */
  month: number;
  visa: string;
  received: number;
  approved: number;
  denied: number;
  completions: number;
  /** Only the editions from FY2025 on print it. */
  pending: number | null;
  rfeCompletions: number;
  rfeApproved: number;
  /** The USCIS file the month was read from, as USCIS named it. */
  sourceFile: string;
}

/**
 * Every visa key the ingest writes, in the order the page lists them, with
 * its label. `VISAS` in the Python is the other copy; a test reads that file
 * and holds the two to each other.
 */
export const RFE_VISAS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "h1b", label: "H-1B" },
  { key: "l1a", label: "L-1A" },
  { key: "l1b", label: "L-1B" },
  { key: "l1", label: "L-1A and L-1B" },
  { key: "l1_blanket", label: "Blanket L" },
  { key: "o", label: "O-1 and O-2" },
  { key: "p", label: "P" },
  { key: "r1", label: "R-1" },
  { key: "tn", label: "TN" },
  { key: "h2a", label: "H-2A" },
  { key: "h2b", label: "H-2B" },
];

export function visaLabel(key: string): string {
  return RFE_VISAS.find((v) => v.key === key)?.label ?? key;
}

/** Fiscal-year order: October first. */
export const FY_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The calendar year a fiscal month falls in: October to December are the year before. */
export function calendarYear(fy: number, month: number): number {
  return month >= 10 ? fy - 1 : fy;
}

/** `2025-10` for October of FY2026. */
export function monthKey(fy: number, month: number): string {
  return `${calendarYear(fy, month)}-${String(month).padStart(2, "0")}`;
}

/** The month's last day, `YYYY-MM-DD`. */
export function monthEnd(fy: number, month: number): string {
  const y = calendarYear(fy, month);
  const d = new Date(Date.UTC(y, month, 0)).getUTCDate();
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "October 2025". */
export function monthLabel(fy: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${calendarYear(fy, month)}`;
}

/** "Oct 2025". */
export function monthShort(fy: number, month: number): string {
  return `${MONTH_ABBR[month - 1]} ${calendarYear(fy, month)}`;
}

/** A share, or null when nothing was decided: 0 of 0 isn't a rate. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** "8.5%": one decimal, because USCIS's own sheets print one. */
export function pct(x: number | null): string {
  return x === null ? "n/a" : `${(x * 100).toFixed(1)}%`;
}

export interface RfeTotals {
  /** Months counted. */
  months: number;
  received: number;
  approved: number;
  denied: number;
  completions: number;
  rfeCompletions: number;
  rfeApproved: number;
  /** Completions with an RFE, of all completions. */
  rfeShare: number | null;
  /** Of the completions that had an RFE, the share approved. */
  approvedAfterRfe: number | null;
  /** Of all completions, the share approved. */
  approvalRate: number | null;
}

export function totals(rows: readonly RfeMonth[]): RfeTotals {
  const t = { months: rows.length, received: 0, approved: 0, denied: 0, completions: 0, rfeCompletions: 0, rfeApproved: 0 };
  for (const r of rows) {
    t.received += r.received;
    t.approved += r.approved;
    t.denied += r.denied;
    t.completions += r.completions;
    t.rfeCompletions += r.rfeCompletions;
    t.rfeApproved += r.rfeApproved;
  }
  return {
    ...t,
    rfeShare: share(t.rfeCompletions, t.completions),
    approvedAfterRfe: share(t.rfeApproved, t.rfeCompletions),
    approvalRate: share(t.approved, t.completions),
  };
}

const fyOrder = (month: number) => FY_MONTHS.indexOf(month as (typeof FY_MONTHS)[number]);

/** One visa's months, oldest first. */
export function monthsFor(rows: readonly RfeMonth[], visa: string): RfeMonth[] {
  return rows
    .filter((r) => r.visa === visa)
    .sort((a, b) => a.fy - b.fy || fyOrder(a.month) - fyOrder(b.month));
}

export interface RfeYear extends RfeTotals {
  fy: number;
  /** False for a fiscal year still under way: fewer than twelve months held. */
  complete: boolean;
}

/** One visa's totals per fiscal year, oldest first. */
export function yearsFor(rows: readonly RfeMonth[], visa: string): RfeYear[] {
  const by = new Map<number, RfeMonth[]>();
  for (const r of monthsFor(rows, visa)) {
    const list = by.get(r.fy) ?? [];
    list.push(r);
    by.set(r.fy, list);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fy, list]) => ({ fy, ...totals(list), complete: list.length === 12 }));
}

export interface SameMonths {
  visa: string;
  fy: number;
  /** The months both years hold, as calendar months in fiscal order. */
  months: number[];
  first: { fy: number; month: number };
  last: { fy: number; month: number };
  now: RfeTotals;
  /** The same months a year earlier, or null when that year isn't held whole. */
  yearBefore: (RfeTotals & { fy: number }) | null;
}

/**
 * The newest fiscal year to date for one visa, beside the same months of the
 * year before. Same months, because H-1B work is seasonal (the cap petitions
 * land in April) and a full year against nine months would compare seasons.
 */
export function sameMonths(rows: readonly RfeMonth[], visa: string): SameMonths | null {
  const mine = monthsFor(rows, visa);
  if (mine.length === 0) return null;
  const fy = mine[mine.length - 1]!.fy;
  const now = mine.filter((r) => r.fy === fy);
  const months = now.map((r) => r.month);
  const before = mine.filter((r) => r.fy === fy - 1 && months.includes(r.month));
  return {
    visa,
    fy,
    months,
    first: { fy, month: now[0]!.month },
    last: { fy, month: now[now.length - 1]!.month },
    now: totals(now),
    yearBefore: before.length === months.length ? { fy: fy - 1, ...totals(before) } : null,
  };
}

export interface RfeMonthPoint extends RfeMonth {
  key: string;
  rfeShare: number | null;
  /** Approved after an RFE, as a share of ALL completions (the inner bar). */
  approvedAfterRfeOfAll: number | null;
}

export function monthSeries(rows: readonly RfeMonth[], visa: string): RfeMonthPoint[] {
  return monthsFor(rows, visa).map((r) => ({
    ...r,
    key: monthKey(r.fy, r.month),
    rfeShare: share(r.rfeCompletions, r.completions),
    approvedAfterRfeOfAll: share(r.rfeApproved, r.completions),
  }));
}

/** The month with the highest RFE share, or null. */
export function peakMonth(series: readonly RfeMonthPoint[]): RfeMonthPoint | null {
  let best: RfeMonthPoint | null = null;
  for (const p of series) if (p.rfeShare !== null && (best === null || p.rfeShare > best.rfeShare!)) best = p;
  return best;
}

/**
 * The visas the by-year section lists, in `RFE_VISAS` order, each with its
 * years. A visa with no rows is left out; the combined L-1 table exists only
 * for the years USCIS printed L-1A and L-1B together.
 */
export function visaYears(rows: readonly RfeMonth[]): Array<{ key: string; label: string; years: RfeYear[] }> {
  return RFE_VISAS.map((v) => ({ ...v, years: yearsFor(rows, v.key) })).filter((v) => v.years.length > 0);
}

/** Every fiscal year held, oldest first. */
export function fiscalYears(rows: readonly RfeMonth[]): number[] {
  return [...new Set(rows.map((r) => r.fy))].sort((a, b) => a - b);
}
