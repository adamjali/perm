import { describe, expect, it } from "vitest";
import { groupMarkers, groupPosition, MIN_MONTH_PX } from "../positioning";

/** Percent of a `months`-month range that `days` covers. */
const pct = (days: number, months: number) => (days / (months * 30.44)) * 100;
/** The 22px footprint as a percent of the narrowest grid. */
const footprint = (months: number) => (22 / (months * MIN_MONTH_PX)) * 100;

describe("groupMarkers", () => {
  it("keeps markers that are far apart as groups of one", () => {
    expect(groupMarkers([10, 40, 80], 24)).toEqual([[0], [1], [2]]);
  });

  it("puts markers too close to tell apart in one group", () => {
    expect(groupMarkers([50, 50 + pct(2, 24)], 24)).toEqual([[0, 1]]);
  });

  it("orders groups left to right and members by position, whatever the input order", () => {
    const p = [80, 50 + pct(3, 24), 10, 50];
    expect(groupMarkers(p, 24)).toEqual([[2], [3, 1], [0]]);
  });

  it("draws five dates in six days as ONE marker, not a tower (Adam's phone, Sep 30 2026)", () => {
    const p = [0, 2, 4, 5, 6].map((d) => 40 + pct(d, 24));
    expect(groupMarkers(p, 24)).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("clears at the narrowest month width: a footprint apart stays two markers", () => {
    const months = 12;
    expect(groupMarkers([20, 20 + footprint(months) + 0.01], months)).toEqual([[0], [1]]);
    expect(groupMarkers([20, 20 + footprint(months) - 0.5], months)).toEqual([[0, 1]]);
  });

  it("returns nothing for no markers", () => {
    expect(groupMarkers([], 24)).toEqual([]);
  });
});

describe("groupPosition", () => {
  it("draws a group at the middle of its first and last date", () => {
    expect(groupPosition([10, 14, 12], [0, 2, 1])).toBe(12);
    expect(groupPosition([30], [0])).toBe(30);
  });
});
