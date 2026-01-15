/**
 * Date utility functions for formatting and displaying dates
 * Pure JavaScript implementation - no external dependencies
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Format a date as a relative time from now (e.g., "5m ago", "just now")
 * For dates older than a week, returns formatted date (e.g., "Dec 16")
 *
 * @param date - Date object or timestamp number
 * @returns Formatted relative time string
 */
export function formatDistanceToNow(date: Date | number): string {
  const timestamp = typeof date === "number" ? date : date.getTime();
  const now = Date.now();
  const diffMs = now - timestamp;

  // Within 60 seconds (inclusive): "just now"
  // Edge case: exactly 60 seconds is still considered "just now"
  if (diffMs <= 60 * SECOND) {
    return "just now";
  }

  // Within 1 hour: "Xm ago"
  if (diffMs < HOUR) {
    const minutes = Math.floor(diffMs / MINUTE);
    return `${minutes}m ago`;
  }

  // Within 24 hours: "Xh ago"
  if (diffMs < DAY) {
    const hours = Math.floor(diffMs / HOUR);
    return `${hours}h ago`;
  }

  // Within 7 days: "Xd ago"
  if (diffMs < WEEK) {
    const days = Math.floor(diffMs / DAY);
    return `${days}d ago`;
  }

  // Older than 7 days: formatted date
  const dateObj = new Date(timestamp);
  const month = MONTH_NAMES[dateObj.getUTCMonth()];
  const day = dateObj.getUTCDate();
  return `${month} ${day}`;
}

/**
 * Parse ISO date parts with safe defaults
 * Consolidates repeated parsing logic from formatShortDate and formatISODate
 */
function parseISODateParts(isoDate: string): { year: number; month: number; day: number } {
  const parts = isoDate.split("-").map(Number);
  return {
    year: parts[0] ?? 0,
    month: parts[1] ?? 1,
    day: parts[2] ?? 1,
  };
}

/**
 * Format a date as "Mon D, YYYY" (e.g., "Jan 15, 2024")
 *
 * @param date - Date object or ISO string
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const month = MONTH_NAMES[dateObj.getUTCMonth()];
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Format an ISO date string (YYYY-MM-DD) as "Mon D, YYYY"
 *
 * @param isoDate - ISO date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export function formatISODate(isoDate: string): string {
  const { year, month, day } = parseISODateParts(isoDate);
  const monthName = MONTH_NAMES[month - 1]; // month is 1-indexed in ISO
  return `${monthName} ${day}, ${year}`;
}

// ============================================================================
// SAFE WRAPPERS (with validation and error handling)
// ============================================================================

/** Default fallback for invalid dates */
const FALLBACK_DATE = "Unknown";
const FALLBACK_TIME = "Unknown time";

/**
 * Validate if a value is a valid timestamp (number, not NaN, reasonable range)
 */
function isValidTimestamp(value: unknown): value is number {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  // Reasonable range: 1970-2100 (avoid accidental milliseconds/seconds confusion)
  const MIN_TIMESTAMP = 0;
  const MAX_TIMESTAMP = 4102444800000; // 2100-01-01
  return value >= MIN_TIMESTAMP && value <= MAX_TIMESTAMP;
}

/**
 * Validate if a string is a valid ISO date (YYYY-MM-DD format)
 */
function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  // Basic format check: YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(value)) return false;
  // Validate the date is actually valid
  const date = new Date(value + "T00:00:00");
  return !Number.isNaN(date.getTime());
}

/**
 * HOF: Create safe wrapper with validation and fallback
 * Eliminates repetitive try/catch pattern across safe wrappers
 */
function createSafeFormatter<T>(
  validator: (value: unknown) => value is T,
  formatter: (value: T) => string,
  defaultFallback: string
): (value: T | undefined | null, fallback?: string) => string {
  return (value, fallback = defaultFallback) => {
    if (!validator(value)) return fallback;
    try {
      return formatter(value);
    } catch {
      return fallback;
    }
  };
}

/**
 * Safe wrapper for formatDistanceToNow - returns fallback on invalid input
 *
 * @param timestamp - Timestamp number (milliseconds since epoch)
 * @param fallback - Fallback string for invalid input (default: "Unknown time")
 * @returns Formatted relative time or fallback
 */
export const safeFormatDistanceToNow = createSafeFormatter(
  isValidTimestamp,
  formatDistanceToNow,
  FALLBACK_TIME
);

/**
 * Format an ISO date as short date (e.g., "Dec 28")
 *
 * @param isoDate - ISO date string in YYYY-MM-DD format
 * @returns Short formatted date (Mon D)
 */
export function formatShortDate(isoDate: string): string {
  const { month, day } = parseISODateParts(isoDate);
  const monthName = MONTH_NAMES[month - 1];
  return `${monthName} ${day}`;
}

/**
 * Safe wrapper for formatShortDate - returns fallback on invalid input
 *
 * @param isoDate - ISO date string in YYYY-MM-DD format
 * @param fallback - Fallback string for invalid input (default: "Unknown")
 * @returns Short formatted date or fallback
 */
export const safeFormatShortDate = createSafeFormatter(
  isValidISODate,
  formatShortDate,
  FALLBACK_DATE
);

/**
 * Format countdown display for deadlines (e.g., "5 days", "1 day", "Today")
 *
 * @param days - Number of days until deadline (0 = today)
 * @returns Formatted countdown string
 */
export function formatCountdown(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}
