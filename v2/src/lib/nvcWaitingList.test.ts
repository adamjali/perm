import { describe, expect, it } from "vitest";

import { EMPLOYMENT_ROWS, categorySeries, changeLabel, type NvcPoint, type NvcWaitingListDoc } from "./nvcWaitingList";

function point(asOf: string, over: Partial<NvcPoint>): NvcPoint {
  const zero = { F1: 0, F2: 0, F2A: 0, F2B: 0, F3: 0, F4: 0, F: 0, E1: 0, E2: 0, E3: 0, E3S: 0, EW: 0, E4: 0, E5: 0, E: 0, ALL: 0 };
  return { asOf, ...zero, ...over };
}

/** The Nov 2022 and Nov 2023 employment figures, as the 2023 report prints them, stored out of order. */
const DOC: NvcWaitingListDoc = {
  series: [
    point("2023-11-01", { E1: 20_582, E2: 75_567, E3S: 78_207, EW: 44_470, E4: 1_951, E5: 39_883 }),
    point("2022-11-01", { E1: 8_818, E2: 43_962, E3S: 41_838, EW: 26_729, E4: 1_303, E5: 45_498 }),
  ],
  revisions: [],
  newest: "2023-11-01",
  employmentByCountry: [],
  sources: {},
  statsPage: "",
};

describe("categorySeries", () => {
  it("runs each category oldest first and ends on the newest figure", () => {
    const ew = categorySeries(DOC, EMPLOYMENT_ROWS).find((r) => r.key === "EW")!;
    expect(ew.points.map((p) => p.asOf)).toEqual(["2022-11-01", "2023-11-01"]);
    expect(ew.latest).toBe(44_470);
  });

  it("matches State's own printed change for each category", () => {
    const rows = categorySeries(DOC, EMPLOYMENT_ROWS);
    // The report prints +133.4%, +71.9%, +86.9%, +66.4%, +49.7%, -12.3%.
    expect(rows.map((r) => (r.change! * 100).toFixed(1))).toEqual(["133.4", "71.9", "86.9", "66.4", "49.7", "-12.3"]);
  });

  it("has no change for a single year or a zero base", () => {
    const one = { ...DOC, series: [DOC.series[0]!] };
    expect(categorySeries(one, EMPLOYMENT_ROWS)[0]!.change).toBeNull();
    const zero = { ...DOC, series: [point("2022-11-01", {}), point("2023-11-01", { E1: 5 })] };
    expect(categorySeries(zero, EMPLOYMENT_ROWS)[0]!.change).toBeNull();
  });
});

describe("changeLabel", () => {
  it.each([
    [1.334, "+133%"],
    [-0.123, "-12%"],
    [-0.036, "-3.6%"],
    [0.041, "+4.1%"],
  ])("%d reads %s", (c, out) => {
    expect(changeLabel(c)).toBe(out);
  });
});
