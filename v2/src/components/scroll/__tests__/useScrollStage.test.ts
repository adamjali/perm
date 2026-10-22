import { describe, expect, it } from "vitest";

import { scrollTopForStep, stagePlace } from "../useScrollStage";

// A 900px viewport, a 72px header, a stage 900 + 6 x 300 = 2700px tall: the pinned span is 2700 - 828 = 1872px.
const VH = 900;
const LINE = 72;
const H = 2700;
const SPAN = H - (VH - LINE);

describe("stagePlace", () => {
  it("is at the start before the section reaches the sticky line", () => {
    expect(stagePlace(400, H, VH, LINE, 6)).toEqual({ progress: 0, step: 0, within: 0 });
  });

  it("is at the end once the section's bottom has reached the viewport's bottom", () => {
    const p = stagePlace(LINE - SPAN - 500, H, VH, LINE, 6);
    expect(p.progress).toBe(1);
    expect(p.step).toBe(5);
  });

  it("splits the span into equal steps", () => {
    // Halfway through the third step: progress 2.5 / 6.
    const top = LINE - SPAN * (2.5 / 6);
    const p = stagePlace(top, H, VH, LINE, 6);
    expect(p.step).toBe(2);
    expect(p.within).toBeCloseTo(0.5, 5);
  });

  it("never names a step past the last", () => {
    expect(stagePlace(LINE - SPAN, H, VH, LINE, 6).step).toBe(5);
  });

  it("treats a section no taller than the viewport as one move", () => {
    expect(stagePlace(100, 500, VH, LINE, 3).step).toBe(0);
    expect(stagePlace(0, 500, VH, LINE, 3).progress).toBe(1);
  });
});

describe("scrollTopForStep", () => {
  it("lands in the middle of the step it names", () => {
    const sectionTop = 1500;
    for (let step = 0; step < 6; step++) {
      const y = scrollTopForStep(sectionTop, H, VH, LINE, 6, step);
      // After scrolling to y, the section's top sits at sectionTop - y on screen.
      expect(stagePlace(sectionTop - y, H, VH, LINE, 6).step).toBe(step);
    }
  });
});
