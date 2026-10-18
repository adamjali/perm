import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { ISO_MONTH_RE } from '../../months';

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

/** A zero-padded year and month, e.g. `2026-08`, months 01 to 12. */
export function isValidMonth(value: string): boolean {
  return ISO_MONTH_RE.test(value);
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

