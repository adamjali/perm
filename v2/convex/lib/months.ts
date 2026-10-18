/**
 * The month names, once. Convex-safe and browser-safe, so the site, the
 * emails and the backend all spell a month from the same list.
 */

/** A month as every URL, form, table and query here writes it: `2026-03`, months 01 to 12 only. */
export const ISO_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Shift a `YYYY-MM` by whole months, in integer arithmetic only. Never builds a
 * Date: one made with `Date.UTC` and shown through a local-time formatter moves
 * a month back everywhere west of UTC, which shipped a prevailing-wage estimate
 * a month early until a test caught it.
 */
export function shiftMonth(month: string, delta: number): string {
  return monthFromIndex(monthIndex(month) + delta);
}

/** A month as a whole number, so months subtract: `2026-01` less `2025-12` is 1. Reads any ISO date's month. */
export function monthIndex(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
}

/** The `YYYY-MM` a `monthIndex` stands for. */
export function monthFromIndex(i: number): string {
  const year = Math.floor(i / 12);
  return `${year}-${String(i - year * 12 + 1).padStart(2, "0")}`;
}

/** The federal fiscal year starts in October: FY2026 runs October 2025 to September 2026. */
export const FY_START_MONTH = 10;

/** The federal fiscal year a `YYYY-MM` or an ISO date falls in. */
export function fiscalYearOf(iso: string): number {
  const year = Number(iso.slice(0, 4));
  return Number(iso.slice(5, 7)) >= FY_START_MONTH ? year + 1 : year;
}

/** The months a fiscal year spans, first and last: FY2026 is 2025-10 to 2026-09. */
export function fiscalYearSpan(fy: number): { from: string; to: string } {
  return { from: shiftMonth(`${fy - 1}-${FY_START_MONTH}`, 0), to: shiftMonth(`${fy}-${FY_START_MONTH}`, -1) };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** The three-letter forms, for axis labels, table cells and tight columns. */
export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const MONTH = /^(\d{4})-(\d{2})$/;

/**
 * "2026-09-11" (or a timestamp that starts with it) to "September 11, 2026".
 * Plain string work, no time zone: a date DOL printed is the same day for
 * every reader, and the server and the browser render the same text.
 * Null for anything that isn't a date.
 */
export function longDate(iso: string | null | undefined): string | null {
  const m = iso ? DAY.exec(iso) : null;
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${Number(m[3])}, ${m[1]}` : null;
}

/** "2026-09-11" to "Sep 11, 2026", for table cells; null for anything else. */
export function shortDate(iso: string | null | undefined): string | null {
  const m = iso ? DAY.exec(iso) : null;
  const name = m ? MONTH_ABBR[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${Number(m[3])}, ${m[1]}` : null;
}

/** "2026-09-11" to "Sep 11", for a chart tick or a date in this year's run; null for anything else. */
export function monthDay(iso: string | null | undefined): string | null {
  const m = iso ? DAY.exec(iso) : null;
  const name = m ? MONTH_ABBR[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${Number(m[3])}` : null;
}

/** "2026-09" to "September 2026"; null for anything else. */
export function monthYear(ym: string | null | undefined): string | null {
  const m = ym ? MONTH.exec(ym) : null;
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : null;
}

/**
 * "2025-06" to "Jun ’25", for a chart tick where a full year won't fit. The
 * apostrophe is the point: "Jun 25" reads as the 25th of June. Takes any ISO
 * date's month; null for anything else.
 */
export function monthTick(iso: string | null | undefined): string | null {
  const m = iso ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  const name = m ? MONTH_ABBR[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} \u2019${m[1]!.slice(2)}` : null;
}

