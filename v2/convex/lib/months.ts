/**
 * The month names, once. Convex-safe and browser-safe, so the site, the
 * emails and the backend all spell a month from the same list.
 */

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

/** "2026-09" to "September 2026"; null for anything else. */
export function monthYear(ym: string | null | undefined): string | null {
  const m = ym ? MONTH.exec(ym) : null;
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : null;
}
