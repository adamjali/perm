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
/** A marker's footprint along the time axis: its 16px square and a 2px gap. */
const MARKER_FOOTPRINT_PX = 18;
/** Vertical offsets for marker lanes: on the band, then above, then below. */
export const MARKER_LANE_OFFSETS = [0, -14, 14] as const;

/** Lane value for a marker folded into a neighbour (see foldedMarkers). */
export const FOLDED_LANE = -1;

/**
 * Spread markers that would overlap into lanes. Two dates a few days apart
 * drew their squares on top of each other, so one hid the other (Adam's
 * phone, Sep 30 2026). Walking the markers left to right, each takes the
 * first lane whose last marker is at least one footprint away. With every
 * lane taken it gets FOLDED_LANE: it is not drawn on its own, and the nearest
 * drawn marker carries it as a "+N" count and in its tooltip (a fourth lane
 * doesn't fit a row, and doubling up hid squares again: five dates in six
 * days did it at 24 months).
 *
 * Positions are percentages of the range. The footprint is converted at the
 * NARROWEST the grid can be (`MIN_MONTH_PX` a month), so markers that clear
 * there clear at every wider size.
 *
 * @returns the lane index (into MARKER_LANE_OFFSETS), or FOLDED_LANE, for
 *   each input position
 */
export function assignMarkerLanes(positions: number[], monthCount: number): number[] {
  const minGap = (MARKER_FOOTPRINT_PX / (Math.max(1, monthCount) * MIN_MONTH_PX)) * 100;
  const order = positions.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const lastInLane: number[] = MARKER_LANE_OFFSETS.map(() => Number.NEGATIVE_INFINITY);
  const lanes = new Array<number>(positions.length).fill(0);
  for (const [position, index] of order) {
    const lane = lastInLane.findIndex((last) => position - last >= minGap);
    lanes[index] = lane === -1 ? FOLDED_LANE : lane;
    if (lane !== -1) lastInLane[lane] = position;
  }
  return lanes;
}

/**
 * Which drawn marker carries each folded one: the drawn marker nearest in
 * position (the earlier one on a tie).
 *
 * @returns drawn marker index -> indexes folded into it, in position order
 */
export function foldedMarkers(positions: number[], lanes: number[]): Map<number, number[]> {
  const drawn = lanes.flatMap((lane, i) => (lane === FOLDED_LANE ? [] : [i]));
  const hosts = new Map<number, number[]>();
  if (drawn.length === 0) return hosts;
  const folded = lanes
    .flatMap((lane, i) => (lane === FOLDED_LANE ? [i] : []))
    .sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
  for (const i of folded) {
    const p = positions[i] ?? 0;
    let host = drawn[0]!;
    for (const d of drawn) {
      const gap = Math.abs((positions[d] ?? 0) - p);
      const best = Math.abs((positions[host] ?? 0) - p);
      if (gap < best || (gap === best && (positions[d] ?? 0) < (positions[host] ?? 0))) host = d;
    }
    hosts.set(host, [...(hosts.get(host) ?? []), i]);
  }
  return hosts;
}
