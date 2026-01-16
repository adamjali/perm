import { parseISO, format, isValid, getDay, subDays } from 'date-fns';

/**
 * Type guard to check if a string is a valid ISO date (YYYY-MM-DD).
 * Does not throw - use for checking/filtering.
 *
 * @param dateStr - String to validate
 * @returns True if the string is a valid ISO date format
 *
 * @example
 * isValidISODate('2024-01-15') // true
 * isValidISODate('invalid') // false
 * isValidISODate(null) // false
 */
export function isValidISODate(dateStr: string | null | undefined): dateStr is string {
  return Boolean(dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr));
}

/**
 * Add days to a date in UTC (avoids DST issues).
 *
 * @param date - Date object to add days to
 * @param days - Number of days to add
 * @returns New Date with days added
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Validate that a string is a valid ISO date (YYYY-MM-DD).
 *
 * @param dateStr - String to validate
 * @param fieldName - Field name for error message
 * @returns Parsed Date object
 * @throws Error if format or value is invalid
 */
export function validateISODate(dateStr: string, fieldName: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(
      `Invalid date format for ${fieldName}: expected YYYY-MM-DD, got "${dateStr}"`
    );
  }

  const date = parseISO(dateStr);
  if (!isValid(date)) {
    throw new Error(
      `Invalid date value for ${fieldName}: "${dateStr}" is not a valid date`
    );
  }

  return date;
}

/**
 * Format a Date as ISO string (YYYY-MM-DD) using UTC.
 *
 * @param date - Date to format
 * @returns ISO date string
 */
export function formatUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find the last Sunday on or before a given date.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns ISO date string of the last Sunday on or before the input date
 *
 * @example
 * lastSundayOnOrBefore('2024-01-14') // '2024-01-14' (already Sunday)
 * lastSundayOnOrBefore('2024-01-15') // '2024-01-14' (Monday → previous Sunday)
 */
export function lastSundayOnOrBefore(dateStr: string): string {
  const date = parseISO(dateStr);
  const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday

  if (dayOfWeek === 0) {
    return dateStr;
  }

  return format(subDays(date, dayOfWeek), 'yyyy-MM-dd');
}
