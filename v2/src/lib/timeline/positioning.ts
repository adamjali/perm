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

/** A month is never narrower than this, so a month label and a marker fit. */
export const MIN_MONTH_PX = 44;
/** A marker's footprint along the time axis: its square and a small gap. */
const MARKER_FOOTPRINT_PX = 22;

/**
 * Group markers that would overlap into one marker each. The first answer to
 * overlapping squares (Sep 30 2026) stacked them on three lanes and folded the
 * rest into a "+N" chip; on real cases that drew towers of same-coloured
 * squares with a chip nobody could read (Adam's phone, the same morning). A
 * group is drawn as ONE square carrying its count, and its tooltip lists every
 * date in it.
 *
 * Walking left to right, a marker joins the current group when it sits within
 * one footprint of the group's last marker. Positions are percentages of the
 * range, converted at the NARROWEST the grid can be (`MIN_MONTH_PX` a month),
 * so markers that clear there clear at every wider size.
 *
 * @returns groups of input indexes, each in position order, groups ordered
 *   left to right
 */
export function groupMarkers(positions: number[], monthCount: number): number[][] {
  const minGap = (MARKER_FOOTPRINT_PX / (Math.max(1, monthCount) * MIN_MONTH_PX)) * 100;
  const order = positions.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const groups: number[][] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const [position, index] of order) {
    if (groups.length > 0 && position - last < minGap) groups[groups.length - 1]!.push(index);
    else groups.push([index]);
    last = position;
  }
  return groups;
}

/** Where a group is drawn: the middle of its first and last date. */
export function groupPosition(positions: number[], group: number[]): number {
  const ps = group.map((i) => positions[i] ?? 0);
  return (Math.min(...ps) + Math.max(...ps)) / 2;
}
