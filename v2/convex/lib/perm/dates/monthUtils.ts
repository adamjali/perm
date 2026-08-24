import { differenceInCalendarMonths, parseISO } from 'date-fns';

/**
 * `YYYY-MM` month arithmetic.
 *
 * DOL and USCIS both publish queue positions by MONTH, not by date: "analyst
 * review is working September 2025", "requests received April 2026". Those are
 * months, and treating them as dates invites the timezone bugs this file
 * exists to prevent.
 *
 * Lives here rather than beside a calculator because the queue estimators all
 * need the same three operations, and an earlier version of each had its own
 * copy of `MONTH_RE` and `monthStart`.
 */

/** A zero-padded year and month, e.g. `2026-08`. */
export const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function isValidMonth(value: string): boolean {
  if (!MONTH_PATTERN.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * Parse a `YYYY-MM` to the first day of that month.
 *
 * Throws rather than returning null: every caller here is working from a value
 * that DOL published or a user picked from a fixed list, so an unparseable
 * month is a bug upstream, and a silent null would surface as a missing
 * estimate rather than as the parse failure it is.
 */
export function monthStart(month: string, fieldName: string): Date {
  if (!isValidMonth(month)) {
    throw new Error(
      `Invalid month format for ${fieldName}: expected YYYY-MM, got "${month}"`,
    );
  }
  return parseISO(`${month}-01`);
}

/**
 * Whole months from `from` to `to`. Negative when `to` is earlier.
 *
 * Each argument is named separately in its own error. Sharing one field name
 * across both made a malformed frontier month report as a malformed cohort
 * month, which points debugging at the wrong value.
 */
export function monthsBetween(
  from: string,
  to: string,
  fromField = 'fromMonth',
  toField = 'toMonth',
): number {
  return differenceInCalendarMonths(monthStart(to, toField), monthStart(from, fromField));
}

/**
 * Shift a `YYYY-MM` by whole months, in integer arithmetic only.
 *
 * Deliberately never builds a Date. Constructing one with `Date.UTC` and
 * rendering it through a local-time formatter shifts the answer back a month
 * everywhere west of UTC, which shipped a prevailing-wage estimate one month
 * early until a test caught it.
 */
export function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const zeroBased = Number(month.slice(5, 7)) - 1 + delta;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12;
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
}
