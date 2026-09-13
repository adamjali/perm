import { describe, expect, it } from "vitest";
import {
  MONO_ADVANCE_EM,
  PAD,
  Y_LABEL_FONT_PX,
  Y_LABEL_GAP,
} from "../QueueHistoryChart";

/**
 * The y labels on this chart must fit inside the viewBox.
 *
 * WHY IT NEEDED A GATE. The axis is unusual - its y values are MONTHS
 * ("Nov 2025"), eight characters where most charts here have three or four -
 * and the labels are anchored `end` at `PAD.left - GAP`, so they grow LEFTWARD
 * off the edge. At `left: 64` the widest started at x = -1.6 and hung outside
 * the drawing, which is what a reader sees as "the labels are jammed against
 * the side". Measured with `getBBox()` on the live page; this repo does not
 * trust estimated text metrics after a characters-times-7 guess put every
 * label in the wrong place.
 *
 * Static rather than rendered because happy-dom has no layout engine, so a
 * component test cannot call `getBBox()` at all. The arithmetic is the same
 * arithmetic the browser did, with the advance pinned to the measurement.
 */
const WIDEST_LABEL = "Sep 2025"; // formatMonthShort: three letters, space, year

describe("QueueHistoryChart y-axis geometry", () => {
  const labelWidth = WIDEST_LABEL.length * Y_LABEL_FONT_PX * MONO_ADVANCE_EM;

  it("matches the width measured in the browser", () => {
    // 57.6px for "Sep 2025" at 12px mono, from getBBox on the live chart.
    expect(labelWidth).toBeCloseTo(57.6, 1);
  });

  it("leaves the widest label inside the viewBox", () => {
    const leftEdge = PAD.left - Y_LABEL_GAP - labelWidth;
    expect(leftEdge).toBeGreaterThan(0);
  });

  it("leaves a real margin, not a hairline", () => {
    // A label ending at x = 0.5 is inside and still looks broken.
    const leftEdge = PAD.left - Y_LABEL_GAP - labelWidth;
    expect(leftEdge).toBeGreaterThanOrEqual(8);
  });

  it("keeps a gap between the label and the axis line", () => {
    expect(Y_LABEL_GAP).toBeGreaterThanOrEqual(6);
  });
});
