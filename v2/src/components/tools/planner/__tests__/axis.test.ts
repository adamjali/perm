import { describe, expect, it } from "vitest";

import { axisTicks, TICKS_MAX } from "../axis";

const labels = (a: string, b: string) => axisTicks(a, b).map((t) => t.label);

describe("axisTicks", () => {
  it("labels months on a plan of a year or so, the year at each January", () => {
    // 16 months: every second month, on the calendar.
    expect(labels("2026-10-28", "2028-02-20")).toEqual(["Nov 2026", "2027", "Mar", "May", "Jul", "Sep", "Nov", "2028"]);
  });

  it("gives the first mark its year when no January is in view", () => {
    expect(labels("2027-02-10", "2027-09-30")).toEqual(["Mar 2027", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
  });

  it("falls back to whole years, every fifth, on a decades-long wait", () => {
    expect(labels("2026-02-10", "2061-07-01")).toEqual(["2030", "2035", "2040", "2045", "2050", "2055", "2060"]);
  });

  it("never draws more than the axis can hold, and marks Januaries", () => {
    for (const [a, b] of [["2026-01-01", "2026-12-31"], ["2026-01-01", "2029-06-30"], ["2020-01-01", "2090-01-01"]] as const) {
      expect(axisTicks(a, b).length).toBeLessThanOrEqual(TICKS_MAX);
    }
    expect(axisTicks("2026-10-28", "2028-02-20").filter((t) => t.year).map((t) => t.iso)).toEqual(["2027-01-01", "2028-01-01"]);
    expect(axisTicks("2026-10-28", "2026-10-30")).toEqual([]);
  });
});
