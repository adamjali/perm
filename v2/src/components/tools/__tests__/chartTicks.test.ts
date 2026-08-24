import { describe, expect, it } from "vitest";
import { evenTickIndices, tickAnchor } from "../chartTicks";

describe("evenTickIndices", () => {
  it("spaces ticks evenly across a long series", () => {
    // 20 points, 5 ticks: gaps of 5,5,4,5 rather than 4,4,4,4,3. The uneven
    // final gap is what printed two labels on top of each other, twice.
    expect(evenTickIndices(20, 5)).toEqual([0, 5, 10, 14, 19]);
  });

  it("always includes both ends", () => {
    for (const n of [6, 7, 14, 20, 33]) {
      const t = evenTickIndices(n, 5);
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]).toBe(n - 1);
    }
  });

  it("never leaves a final gap smaller than the others by more than one", () => {
    // The specific regression: a short last gap crowds the end labels.
    for (const n of [8, 11, 14, 17, 20, 26, 31]) {
      const t = evenTickIndices(n, 5);
      const gaps = t.slice(1).map((v, i) => v - t[i]!);
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    }
  });

  it("returns every point when the series is shorter than the tick count", () => {
    expect(evenTickIndices(3, 5)).toEqual([0, 1, 2]);
    expect(evenTickIndices(1, 5)).toEqual([0]);
  });

  it("returns nothing for an empty series", () => {
    expect(evenTickIndices(0)).toEqual([]);
  });

  it("de-duplicates when rounding collides", () => {
    const t = evenTickIndices(4, 5);
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("tickAnchor", () => {
  it("turns the end labels inward", () => {
    // A label centred on the last tick is inside the canvas by its anchor and
    // past the edge by its box.
    expect(tickAnchor(0, 5)).toBe("start");
    expect(tickAnchor(4, 5)).toBe("end");
  });

  it("centres everything between", () => {
    expect(tickAnchor(1, 5)).toBe("middle");
    expect(tickAnchor(2, 5)).toBe("middle");
    expect(tickAnchor(3, 5)).toBe("middle");
  });
});
