/**
 * Date Validation Utilities
 *
 * Shared utilities for ISO date string validation and parsing.
 * Used across dashboard, deadline, calendar, and enforcement helpers.
 *
 * All dates are expected in YYYY-MM-DD (ISO) format.
 * UTC parsing avoids timezone/DST issues.
 *
 * @module
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** ISO date format regex: YYYY-MM-DD */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds in one day */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if a string is a valid ISO date format (YYYY-MM-DD).
 *
 * @param dateStr - Date string to validate
 * @returns true if valid format
 *
 * @example
 * isValidISODate("2024-12-31"); // true
 * isValidISODate("12/31/2024"); // false
 * isValidISODate(null); // false
 */
export function isValidISODate(
  dateStr: string | null | undefined
): dateStr is string {
  if (!dateStr) return false;
  return ISO_DATE_REGEX.test(dateStr);
}

/**
 * Validate ISO date string format (YYYY-MM-DD).
 * Throws an error for malformed dates to prevent NaN propagation.
 *
 * @param dateStr - Date string to validate
 * @throws Error if format is invalid
 *
 * @example
 * validateISODateFormat("2024-12-31"); // passes
 * validateISODateFormat("invalid"); // throws
 */
export function validateISODateFormat(dateStr: string): void {
  if (!ISO_DATE_REGEX.test(dateStr)) {
    throw new Error(
      `Invalid ISO date format: "${dateStr}". Expected YYYY-MM-DD.`
    );
  }
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse ISO date string to UTC timestamp at midnight.
 * This avoids timezone/DST issues by treating all dates as UTC.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns UTC timestamp at midnight
 * @throws Error if dateStr is invalid format or out of range
 *
 * @example
 * parseISOToUTC("2024-12-31"); // 1735603200000
 */
export function parseISOToUTC(dateStr: string): number {
  validateISODateFormat(dateStr);
  const [year, month, day] = dateStr.split("-").map(Number);
  const result = Date.UTC(year as number, (month as number) - 1, day);
  if (isNaN(result)) {
    throw new Error(
      `Invalid date value: "${dateStr}". Date components are out of range.`
    );
  }
  return result;
}

/**
 * Parse ISO date string to UTC timestamp, returning null for invalid dates.
 * Non-throwing variant for cases where invalid dates should be silently skipped.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns UTC timestamp at midnight, or null if invalid
 *
 * @example
 * parseISOToUTCSafe("2024-12-31"); // 1735603200000
 * parseISOToUTCSafe("invalid"); // null
 */
export function parseISOToUTCSafe(
  dateStr: string | null | undefined
): number | null {
  if (!isValidISODate(dateStr)) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const result = Date.UTC(year!, (month! - 1), day!);

  return isNaN(result) ? null : result;
}

// ============================================================================
// DATE ARITHMETIC
// ============================================================================

/**
 * Calculate days between two ISO date strings.
 * Uses UTC to avoid timezone and DST issues.
 *
 * @param fromISO - Start date (YYYY-MM-DD)
 * @param toISO - End date (YYYY-MM-DD)
 * @returns Days difference (positive if toISO is after fromISO, negative otherwise)
 * @throws Error if either date is invalid
 *
 * @example
 * daysBetween("2024-01-01", "2024-01-10"); // 9
 * daysBetween("2024-01-10", "2024-01-01"); // -9
 */
export function daysBetween(fromISO: string, toISO: string): number {
  const fromUTC = parseISOToUTC(fromISO);
  const toUTC = parseISOToUTC(toISO);
  return Math.floor((toUTC - fromUTC) / MS_PER_DAY);
}

/**
 * Add days to an ISO date string.
 *
 * @param dateISO - Base date (YYYY-MM-DD)
 * @param days - Days to add (can be negative to subtract)
 * @returns New ISO date string (YYYY-MM-DD)
 * @throws Error if dateISO is invalid
 *
 * @example
 * addDaysToISO("2024-01-01", 30); // "2024-01-31"
 * addDaysToISO("2024-01-31", -30); // "2024-01-01"
 */
export function addDaysToISO(dateISO: string, days: number): string {
  const utc = parseISOToUTC(dateISO);
  const newDate = new Date(utc + days * MS_PER_DAY);
  return newDate.toISOString().split("T")[0] as string;
}

/**
 * Add days to an ISO date string, returning null for invalid dates.
 * Non-throwing variant for pipeline operations.
 *
 * @param dateISO - Base date (YYYY-MM-DD)
 * @param days - Days to add (can be negative)
 * @returns New ISO date string, or null if invalid input
 *
 * @example
 * addDaysToISOSafe("2024-01-01", 30); // "2024-01-31"
 * addDaysToISOSafe(null, 30); // null
 */
export function addDaysToISOSafe(
  dateISO: string | null | undefined,
  days: number
): string | null {
  const utc = parseISOToUTCSafe(dateISO);
  if (utc === null) return null;
  const newDate = new Date(utc + days * MS_PER_DAY);
  return newDate.toISOString().split("T")[0] as string;
}

// ============================================================================
// DATE COMPARISON
// ============================================================================

/**
 * Get the minimum (earliest) date from an array of ISO date strings.
 * Invalid dates are silently skipped.
 *
 * @param dates - Array of ISO date strings
 * @returns Earliest date, or null if no valid dates
 *
 * @example
 * getMinDate(["2024-01-15", "2024-01-10", "2024-01-20"]); // "2024-01-10"
 * getMinDate([]); // null
 */
export function getMinDate(dates: (string | null | undefined)[]): string | null {
  const validDates = dates.filter(isValidISODate);
  if (validDates.length === 0) return null;

  validDates.sort((a, b) => {
    const aTime = parseISOToUTCSafe(a)!;
    const bTime = parseISOToUTCSafe(b)!;
    return aTime - bTime;
  });

  return validDates[0]!;
}

/**
 * Get the maximum (latest) date from an array of ISO date strings.
 * Invalid dates are silently skipped.
 *
 * @param dates - Array of ISO date strings
 * @returns Latest date, or null if no valid dates
 *
 * @example
 * getMaxDate(["2024-01-15", "2024-01-10", "2024-01-20"]); // "2024-01-20"
 * getMaxDate([]); // null
 */
export function getMaxDate(dates: (string | null | undefined)[]): string | null {
  const validDates = dates.filter(isValidISODate);
  if (validDates.length === 0) return null;

  validDates.sort((a, b) => {
    const aTime = parseISOToUTCSafe(a)!;
    const bTime = parseISOToUTCSafe(b)!;
    return bTime - aTime;
  });

  return validDates[0]!;
}

// ============================================================================
// TODAY HELPERS
// ============================================================================

/**
 * Get today's date as ISO string (YYYY-MM-DD) in UTC.
 *
 * @returns Today's date in ISO format
 *
 * @example
 * getTodayISO(); // "2024-12-31" (or current date)
 */
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

/**
 * Check if a date is in the future (on or after today).
 * Uses string comparison which works correctly for ISO dates.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @param todayISO - Optional today's date for testing
 * @returns true if date is today or in the future
 *
 * @example
 * isFutureDate("2025-12-31"); // true (assuming today is before)
 * isFutureDate("2020-01-01"); // false
 */
export function isFutureDate(dateStr: string, todayISO?: string): boolean {
  if (!isValidISODate(dateStr)) return false;

  const today = todayISO ?? getTodayISO();
  if (!isValidISODate(today)) return false;

  return dateStr >= today;
}
