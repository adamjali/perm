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

/**
 * Estimated width of a tick label, in viewBox units.
 *
 * The charts here label axes in the mono face, whose advance is 0.6em -
 * measured with `getBBox()` on the live priority-date chart, where "May 2025"
 * at 16px came back 71.1px wide against 8 x 16 x 0.6 = 76.8. Rounding up is
 * the safe direction for a collision check.
 */
export function tickLabelWidth(label: string, fontPx: number): number {
  return label.length * fontPx * 0.6;
}

/**
 * Drop interior ticks whose labels would collide, END ANCHORING INCLUDED.
 *
 * THIS IS THE BIT `evenTickIndices` CANNOT KNOW. It spaces ticks evenly and
 * that is correct, but `tickAnchor` then turns the two END labels inward so
 * they stay inside the canvas - which moves each of them half a label width
 * toward the middle and closes the gap to its neighbour. Measured on the
 * priority-date chart: "May 2025" ended at x 638.5 and "Sep 2026", anchored
 * end, began at 635.2. Three pixels of overlap, on evenly spaced ticks.
 *
 * So the check has to be done on the BOXES the labels will actually occupy,
 * not on the tick positions. An interior label that collides is dropped
 * rather than shifted: a tick label that no longer sits over its tick is
 * worse than one fewer label.
 */
export function dropCollidingTicks(
  indices: readonly number[],
  opts: {
    /** Series length, so an index can be turned into a position. */
    length: number;
    /** Left and right edges of the plot, in viewBox units. */
    x0: number;
    x1: number;
    labels: readonly string[];
    fontPx: number;
    /** Minimum clear space between two labels. */
    gap?: number;
  },
): number[] {
  const { length, x0, x1, labels, fontPx, gap = 6 } = opts;
  if (indices.length < 3 || length < 2) return [...indices];
  const boxes = indices.map((idx, i) => {
    const x = x0 + (idx / (length - 1)) * (x1 - x0);
    const w = tickLabelWidth(labels[i] ?? "", fontPx);
    const anchor = tickAnchor(i, indices.length);
    const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    return { idx, left, right: left + w };
  });
  // Walk inward from each end, keeping the ends themselves.
  const keep = new Set<number>([0, boxes.length - 1]);
  let lastRight = boxes[0]!.right;
  for (let i = 1; i < boxes.length - 1; i++) {
    const b = boxes[i]!;
    if (b.left - lastRight >= gap && boxes[boxes.length - 1]!.left - b.right >= gap) {
      keep.add(i);
      lastRight = b.right;
    }
  }
  return boxes.filter((_, i) => keep.has(i)).map((b) => b.idx);
}
