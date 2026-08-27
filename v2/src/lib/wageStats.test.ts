import { describe, expect, it } from "vitest";

import {
  binWidth,
  clampBins,
  MIN_FOR_MEDIAN,
  MIN_FOR_TAILS,
  reportability,
} from "./wageStats";

describe("reportability", () => {
  it("shows nothing below the median floor, and says why", () => {
    const r = reportability(9);
    expect(r.showMiddle).toBe(false);
    expect(r.showTails).toBe(false);
    expect(r.note).toMatch(/Only 9 cases match/);
    // The reason has to name the floor, or a withheld figure reads as a bug.
    expect(r.note).toContain(String(MIN_FOR_MEDIAN));
  });

  it("distinguishes empty from merely thin", () => {
    expect(reportability(0).note).toMatch(/No certified cases/);
    expect(reportability(1).note).toMatch(/1 case matches/);
  });

  it("shows the middle but withholds the tails in between the floors", () => {
    const r = reportability(40);
    expect(r.showMiddle).toBe(true);
    expect(r.showTails).toBe(false);
    expect(r.note).toMatch(/5th and 95th are withheld/);
  });

  it("shows everything at the tail floor", () => {
    const r = reportability(MIN_FOR_TAILS);
    expect(r).toEqual({ showMiddle: true, showTails: true, note: null });
  });

  it("treats each floor as inclusive", () => {
    expect(reportability(MIN_FOR_MEDIAN).showMiddle).toBe(true);
    expect(reportability(MIN_FOR_MEDIAN - 1).showMiddle).toBe(false);
    expect(reportability(MIN_FOR_TAILS - 1).showTails).toBe(false);
  });
});

describe("binWidth", () => {
  it("snaps to a number a person can read", () => {
    // A $29k-$176k span wants ~7,350 per bin; 10,000 is the readable neighbour.
    expect(binWidth(29_120, 176_500)).toBe(10_000);
  });

  it("adapts to a narrow occupation rather than using one fixed ladder", () => {
    // Meat cutters sit in a band a $10k ladder would flatten to two bars.
    expect(binWidth(22_000, 31_000)).toBeLessThanOrEqual(1_000);
  });

  it("never returns a width below $1,000", () => {
    expect(binWidth(50_000, 50_100)).toBeGreaterThanOrEqual(1_000);
  });

  it("falls back rather than dividing by a missing bound", () => {
    expect(binWidth(null, 100_000)).toBe(10_000);
    expect(binWidth(100_000, null)).toBe(10_000);
    expect(binWidth(100_000, 100_000)).toBe(10_000);
    // An inverted pair is not a span.
    expect(binWidth(200_000, 100_000)).toBe(10_000);
  });
});

describe("clampBins", () => {
  const BINS = [
    { from: 0, count: 3 },
    { from: 20_000, count: 40 },
    { from: 40_000, count: 120 },
    { from: 60_000, count: 90 },
    { from: 2_000_000, count: 2 },
  ];

  it("folds outliers into counts instead of dropping them", () => {
    const r = clampBins(BINS, 20_000, 60_000);
    expect(r.bins.map((b) => b.from)).toEqual([20_000, 40_000, 60_000]);
    expect(r.below).toBe(3);
    expect(r.above).toBe(2);
    // Nothing is lost: the parts still add to the whole.
    const total = BINS.reduce((n, b) => n + b.count, 0);
    expect(r.bins.reduce((n, b) => n + b.count, 0) + r.below + r.above).toBe(total);
  });

  it("keeps everything when the range covers the series", () => {
    const r = clampBins(BINS, 0, 2_000_000);
    expect(r.bins).toHaveLength(BINS.length);
    expect(r.below + r.above).toBe(0);
  });

  it("does not mutate its input", () => {
    const copy = BINS.map((b) => ({ ...b }));
    clampBins(BINS, 20_000, 60_000);
    expect(BINS).toEqual(copy);
  });
});
