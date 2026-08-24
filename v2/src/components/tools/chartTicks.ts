/**
 * Evenly spaced tick indices across a series, including both ends.
 *
 * Taking every nth point and then appending the last one leaves a short final
 * gap, and the last two labels collide while the rest look fine. It happened
 * on the frontier chart, was fixed there, and then happened again on the
 * priority-date chart because the logic had been written out twice.
 *
 * @param length total points in the series
 * @param count  how many ticks to place, ends included
 */
export function evenTickIndices(length: number, count = 5): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const last = length - 1;
  return [
    ...new Set(
      Array.from({ length: count }, (_, j) => Math.round((j * last) / (count - 1))),
    ),
  ];
}

/**
 * Anchor for a tick label, so the end labels turn inward.
 *
 * A label centred on the last tick sits inside the canvas by its anchor point
 * and past the edge by its box, which a check on the anchor alone misses.
 */
export function tickAnchor(index: number, total: number): "start" | "middle" | "end" {
  if (index === 0) return "start";
  if (index === total - 1) return "end";
  return "middle";
}
