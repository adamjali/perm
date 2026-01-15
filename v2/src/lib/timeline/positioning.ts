/**
 * Position calculation utilities for timeline components.
 * Shared logic for milestone markers and range bars.
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2026-01-09
 */

/**
 * Calculate horizontal position as percentage for a given date.
 *
 * @param date - The date to position
 * @param startDate - Timeline start date
 * @param endDate - Timeline end date
 * @returns Position as percentage (0-100) or null if outside range
 */
export function calculatePosition(
  date: Date,
  startDate: Date,
  endDate: Date
): number | null {
  if (date < startDate || date > endDate) return null;
  const totalMs = endDate.getTime() - startDate.getTime();
  const dateMs = date.getTime() - startDate.getTime();
  return (dateMs / totalMs) * 100;
}

/**
 * Calculate positions for a range bar (start and end).
 * Handles partial visibility by clamping to 0-100.
 *
 * @param start - Range start date
 * @param end - Range end date
 * @param startDate - Timeline start date
 * @param endDate - Timeline end date
 * @returns Object with startPosition and endPosition, or null if not visible
 */
export function calculateRangePosition(
  start: Date,
  end: Date,
  startDate: Date,
  endDate: Date
): { startPosition: number; endPosition: number } | null {
  // Check if range is completely outside timeline
  if (start > endDate || end < startDate) return null;

  const startPosition = calculatePosition(start, startDate, endDate);
  const endPosition = calculatePosition(end, startDate, endDate);

  // Clamp to 0-100 for partial visibility
  const clampedStart = startPosition ?? 0;
  const clampedEnd = endPosition ?? 100;

  return { startPosition: clampedStart, endPosition: clampedEnd };
}

/**
 * Clamp a position value to valid range (0-100).
 */
export function clampPosition(position: number): number {
  return Math.max(0, Math.min(100, position));
}
