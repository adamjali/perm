import { describe, expect, it } from "vitest";

import { FAMILY_SIZE, type LineResult } from "./greenCardLine";
import { compareLines, plausibleRange } from "./greenCardLineCompare";
import { twoLines } from "./__tests__/greenCardLine.fixture";

// Past every approval in the profile, so each line's people ahead is simply
// USCIS's count times its family size.
const FAR = "2031-01-01";

describe("compareLines: which line has fewer people ahead", () => {
  it("names the line whose whole range sits below the other's", () => {
    const c = compareLines("india", FAR, twoLines(5000, 1000));
    expect(c.fewer).toBe("EB3");
    if (c.EB3.kind !== "estimate") throw new Error(c.EB3.kind);
    expect(c.EB3.peopleAhead.high).toBeCloseTo(1000 * FAMILY_SIZE.EB3.high, 6);
  });

  it("calls it a tie when the two ranges overlap, whichever midpoint is lower", () => {
    // 5,000 each: EB-2 is 10,050 to 10,400, EB-3 10,175 to 10,225.
    expect(compareLines("india", FAR, twoLines(5000, 5000)).fewer).toBe("overlap");
  });

  it("puts a current line ahead of one that isn't", () => {
    expect(compareLines("india", FAR, twoLines(5000, 1000, { eb2: { kind: "current" } })).fewer).toBe("EB2");
  });

  it("says both are current rather than pick one", () => {
    const c = compareLines("india", FAR, twoLines(5000, 1000, { eb2: { kind: "current" }, eb3: { kind: "current" } }));
    expect(c.fewer).toBe("both-current");
  });

  it("claims nothing when either line can't be worked out", () => {
    expect(compareLines("india", FAR, twoLines(5000, 1000, { eb3: null })).fewer).toBeNull();
  });
});

describe("plausibleRange", () => {
  const estimate = (scaled: { low: number; high: number } | null) =>
    ({
      kind: "estimate",
      peopleAhead: { low: 100_000, high: 140_000, mid: 120_000 },
      check: scaled ? { scaled } : null,
    }) as unknown as Extract<LineResult, { kind: "estimate" }>;

  it("is the estimate's own range when nothing disagrees", () => {
    expect(plausibleRange(estimate(null))).toEqual({ low: 100_000, high: 140_000 });
  });

  it("stretches to cover the scaled range when the check disagrees", () => {
    // A line that overcounts must not be called longer on the overcount alone.
    expect(plausibleRange(estimate({ low: 45_000, high: 60_000 }))).toEqual({ low: 45_000, high: 140_000 });
  });
});
