import { describe, expect, it } from "vitest";

import { fillPath } from "../SectionDivider";
import { deriveFigures } from "../dataPageFigures";

describe("fillPath", () => {
  it("closes an open top edge down to the viewBox floor", () => {
    expect(fillPath("M0,40 L1440,44")).toBe("M0,40 L1440,44 L1440,64 L0,64 Z");
  });
});

describe("deriveFigures", () => {
  const full = {
    uniqueCases: 259489,
    byState: [
      { state: "CA", total: 45727 },
      { state: "VI", total: 39 },
    ],
    wageLadder: { p10: 29120, p50: 102066, p90: 176500 },
    topEmployers: [{ total: 90449 }],
    topAttorneys: [{ total: 168241 }],
    risk: { baseline: { denialRate: 2.57, denied: 6379, decided: 248158 } },
  };

  it("derives the published figures", () => {
    const f = deriveFigures(full);
    expect(f.states).toEqual({
      count: 2,
      top: "CA",
      topCases: 45727,
      low: "VI",
      lowCases: 39,
    });
    expect(f.wages).toEqual({ p10: 29120, p50: 102066, p90: 176500 });
    expect(f.denial).toEqual({ rate: 2.57, denied: 6379, decided: 248158 });
  });

  it("degrades every field to null rather than to a wrong number", () => {
    const f = deriveFigures(null);
    expect(Object.values(f).every((v) => v === null)).toBe(true);
  });

  it("withholds a wage ladder whose rungs are missing or out of order", () => {
    expect(
      deriveFigures({
        ...full,
        wageLadder: { p10: 29120, p50: null, p90: 176500 },
      }).wages,
    ).toBeNull();
    expect(
      deriveFigures({
        ...full,
        wageLadder: { p10: 200000, p50: 102066, p90: 176500 },
      }).wages,
    ).toBeNull();
  });

  it("withholds a state span when one row is both the largest and the smallest", () => {
    expect(
      deriveFigures({ ...full, byState: [{ state: "CA", total: 45727 }] })
        .states,
    ).toBeNull();
  });

  it("withholds a denial rate with no decided cases behind it", () => {
    expect(
      deriveFigures({
        ...full,
        risk: { baseline: { denialRate: 0, denied: 0, decided: 0 } },
      }).denial,
    ).toBeNull();
  });
});
