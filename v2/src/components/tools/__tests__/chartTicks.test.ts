import { describe, expect, it } from "vitest";
import {
  dropCollidingTicks,
  evenTickIndices,
  tickAnchor,
  tickLabelWidth,
} from "../chartTicks";

/**
 * Tick labels must not touch each other.
 *
 * EVEN SPACING IS NOT ENOUGH, and that is the whole point of these tests.
 * `evenTickIndices` already spaces ticks evenly and is correct. `tickAnchor`
 * then turns the two END labels inward so they stay inside the canvas, which
 * moves each of them half a label width toward the middle and closes the gap
 * to its neighbour.
 *
 * Measured on the live priority-date chart, 96 bulletins with 7 ticks at
 * fontSize 15: "May 2025" ended at x 638.5 and "Sep 2026", anchored end,
 * began at 635.2 - three units of overlap on perfectly even ticks, plainly
 * visible as two touching labels.
 */

/** The real chart's geometry. */
const LEN = 96;
const X0 = 104;
const X1 = 720 - 16;
const FONT = 15;
const LABELS = (idx: readonly number[]) => idx.map(() => "May 2025"); // 8 chars, the widest

/** Boxes the labels will actually occupy, anchoring included. */
function boxes(indices: readonly number[]) {
  return indices.map((idx, i) => {
    const x = X0 + (idx / (LEN - 1)) * (X1 - X0);
    const w = tickLabelWidth("May 2025", FONT);
    const a = tickAnchor(i, indices.length);
    const left = a === "start" ? x : a === "end" ? x - w : x - w / 2;
    return { left, right: left + w };
  });
}

describe("chart tick collisions", () => {
  it("reproduces the overlap that shipped", () => {
    // Seven ticks, unfiltered: the last two touch.
    const raw = evenTickIndices(LEN, 7);
    const b = boxes(raw);
    const worst = Math.min(
      ...b.slice(1).map((x, i) => x.left - b[i]!.right),
    );
    expect(worst).toBeLessThan(0);
  });

  it("drops enough ticks that nothing collides", () => {
    const kept = dropCollidingTicks(evenTickIndices(LEN, 7), {
      length: LEN, x0: X0, x1: X1, labels: LABELS(evenTickIndices(LEN, 7)), fontPx: FONT,
    });
    const b = boxes(kept);
    for (let i = 1; i < b.length; i++) {
      expect(b[i]!.left - b[i - 1]!.right).toBeGreaterThanOrEqual(0);
    }
  });

  it("always keeps both ends", () => {
    const raw = evenTickIndices(LEN, 7);
    const kept = dropCollidingTicks(raw, {
      length: LEN, x0: X0, x1: X1, labels: LABELS(raw), fontPx: FONT,
    });
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(LEN - 1);
  });

  it("drops nothing when there is room", () => {
    const raw = evenTickIndices(LEN, 3);
    const kept = dropCollidingTicks(raw, {
      length: LEN, x0: X0, x1: X1, labels: LABELS(raw), fontPx: FONT,
    });
    expect(kept).toEqual(raw);
  });

  it("matches the width measured in the browser", () => {
    // getBBox gave 71.1 for "May 2025" at 15px; 0.6em over-estimates slightly,
    // which is the safe direction for a collision check.
    expect(tickLabelWidth("May 2025", 15)).toBeCloseTo(72, 0);
  });

  it("leaves a short series alone", () => {
    expect(dropCollidingTicks([0, 1], { length: 2, x0: X0, x1: X1, labels: ["a", "b"], fontPx: FONT }))
      .toEqual([0, 1]);
  });
});
