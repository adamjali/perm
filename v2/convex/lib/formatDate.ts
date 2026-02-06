/**
 * Date formatting utilities for notification emails and logs.
 */

/**
 * Format a date for notification display.
 *
 * @example formatDateForNotification(Date.now()) // "February 5, 2026"
 * @example formatDateForNotification(Date.now(), true) // "Thursday, February 5, 2026"
 */
export function formatDateForNotification(
  timestamp: number | Date,
  includeWeekday = false,
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeWeekday ? { weekday: "long" as const } : {}),
  };
  return date.toLocaleDateString("en-US", options);
}
