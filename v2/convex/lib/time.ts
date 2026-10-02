/**
 * Units of time and the Eastern calendar day, shared by Convex and the site.
 * Pure: no Convex imports, so a page, a component and a Convex function all
 * count a day the same way.
 *
 * src/ imports these through `@/lib/time`; anything Convex bundles (Convex
 * functions, src/emails and the src/lib modules they import) imports this
 * file by relative path.
 */

export const MS_PER_MINUTE = 60 * 1000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 365.25 / 12 = 30.4375: the mean calendar month, for turning days into months. */
export const DAYS_PER_MONTH = 365.25 / 12;

/**
 * The mean month rounded to two places. Kept apart from DAYS_PER_MONTH
 * because the figures that use it were published with it, and the exact
 * value can move a rounded month count or a projected day by one.
 */
export const DAYS_PER_MONTH_2DP = 30.44;

/**
 * The zone DOL, USCIS and this site's readers count days in. After 8 PM
 * Eastern a UTC date is already tomorrow, so anything that says "today" or
 * names a day is computed in this zone.
 */
export const EASTERN_TIMEZONE = "America/New_York";

const ISO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIMEZONE, hour: "numeric", minute: "2-digit" });
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIMEZONE, month: "short", day: "numeric" });

/** The Eastern calendar day of an instant, "YYYY-MM-DD". */
export function easternDay(at: Date | number = new Date()): string {
  return ISO_DAY.format(at);
}

/** "5:25 AM ET, Oct 1": when something was checked, as a reader can check it. */
export function checkedLabel(ms: number): string {
  return `${CLOCK.format(ms)} ET, ${SHORT_DAY.format(ms)}`;
}

/**
 * Calendar days from `from` to `to`, both "YYYY-MM-DD", counted at UTC
 * midnight so daylight saving never shifts it. Negative when `to` is earlier;
 * NaN when either date doesn't parse.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}
