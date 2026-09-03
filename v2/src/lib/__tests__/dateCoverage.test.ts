import { describe, expect, it } from "vitest";

import {
  coverageFor,
  daysInRange,
  intersect,
  isIsoDate,
  narrowIsIndexed,
  type CoverageWindows,
} from "@/lib/dateCoverage";

/**
 * The two windows as production actually holds them, measured 2026-09-03.
 * Using the real dates rather than round numbers keeps the boundary cases
 * honest: 2026-06-30 is the last published decision and 2026-08-26 the first
 * observation, so there is a genuine ~8 week gap between them that the page
 * has to be able to describe.
 */
const WINDOWS: CoverageWindows = {
  decided: { from: "2023-10-01", to: "2026-06-30" },
  observed: { from: "2026-08-26", to: "2026-09-03" },
};

describe("isIsoDate", () => {
  it.each([
    ["2026-06-30", true],
    ["2024-02-29", true], // a real leap day
    ["2025-02-29", false], // not a leap year, and the shape alone would pass
    ["2026-13-01", false],
    ["2026-6-30", false],
    ["", false],
    ["yesterday", false],
  ])("%s -> %s", (input, want) => {
    expect(isIsoDate(input)).toBe(want);
  });
});

describe("daysInRange", () => {
  it("counts a single day as one, not zero", () => {
    expect(daysInRange({ from: "2026-06-30", to: "2026-06-30" })).toBe(1);
  });

  it("is inclusive at both ends", () => {
    expect(daysInRange({ from: "2026-06-01", to: "2026-06-30" })).toBe(30);
  });

  it("counts across a leap day", () => {
    expect(daysInRange({ from: "2024-02-28", to: "2024-03-01" })).toBe(3);
  });

  it("returns 0 for a backwards range rather than a negative", () => {
    expect(daysInRange({ from: "2026-06-30", to: "2026-06-01" })).toBe(0);
  });
});

describe("intersect", () => {
  it("returns the overlap", () => {
    expect(
      intersect({ from: "2026-01-01", to: "2026-12-31" }, WINDOWS.decided),
    ).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });

  it("returns null when the ranges do not touch", () => {
    expect(
      intersect({ from: "2026-07-01", to: "2026-07-31" }, WINDOWS.decided),
    ).toBeNull();
  });

  it("treats a shared endpoint as touching", () => {
    expect(
      intersect({ from: "2026-06-30", to: "2026-07-31" }, WINDOWS.decided),
    ).toEqual({ from: "2026-06-30", to: "2026-06-30" });
  });

  it("returns null against a missing window rather than throwing", () => {
    expect(intersect({ from: "2026-01-01", to: "2026-01-02" }, null)).toBeNull();
  });
});

describe("coverageFor", () => {
  it("a day inside the published files is answerable, and filters are live", () => {
    const c = coverageFor({ from: "2025-03-12", to: "2025-03-12" }, WINDOWS);
    expect(c.decided).toEqual({ from: "2025-03-12", to: "2025-03-12" });
    expect(c.observed).toBeNull();
    expect(c.uncoveredDays).toBe(0);
  });

  it("a day we only observed has no published half, so wage cannot be filtered", () => {
    const c = coverageFor({ from: "2026-09-01", to: "2026-09-01" }, WINDOWS);
    expect(c.decided).toBeNull();
    expect(c.observed).toEqual({ from: "2026-09-01", to: "2026-09-01" });
    expect(c.uncoveredDays).toBe(0);
  });

  it("names the gap between the last file and the first observation", () => {
    // 2026-07-01..2026-08-25 is covered by neither. This is the case that must
    // say "we hold nothing" rather than render an empty table, which reads as
    // "DOL did nothing".
    const c = coverageFor({ from: "2026-07-01", to: "2026-08-25" }, WINDOWS);
    expect(c.decided).toBeNull();
    expect(c.observed).toBeNull();
    expect(c.totalDays).toBe(56);
    expect(c.uncoveredDays).toBe(56);
  });

  it("a range spanning the boundary reports BOTH halves and the gap", () => {
    const c = coverageFor({ from: "2026-06-29", to: "2026-08-27" }, WINDOWS);
    expect(c.decided).toEqual({ from: "2026-06-29", to: "2026-06-30" });
    expect(c.observed).toEqual({ from: "2026-08-26", to: "2026-08-27" });
    expect(c.totalDays).toBe(60);
    // 2 published + 2 observed = 4 covered, so 56 days are held by neither.
    expect(c.uncoveredDays).toBe(56);
  });

  it("a date before anything we hold is entirely uncovered", () => {
    const c = coverageFor({ from: "2019-01-01", to: "2019-01-10" }, WINDOWS);
    expect(c.decided).toBeNull();
    expect(c.observed).toBeNull();
    expect(c.uncoveredDays).toBe(10);
  });

  it("does not double-count days if the windows ever overlap", () => {
    // Not the shape of production today, but the arithmetic must be a union
    // rather than a sum, or a future overlap would report negative uncovered.
    const overlapping: CoverageWindows = {
      decided: { from: "2026-01-01", to: "2026-06-30" },
      observed: { from: "2026-06-01", to: "2026-07-31" },
    };
    // THE SELECTION MUST EXTEND PAST BOTH WINDOWS or this test cannot fail.
    // `uncoveredDays` is clamped at 0, so on a fully-covered selection a naive
    // `a + b` sum and a proper union both report 0 and the bug survives. It
    // was written that way first and the probe caught it: breaking the union
    // into a sum left all 27 tests green. Here 181 + 61 double-counts the 30
    // shared days, so the sum reports 1 uncovered where the truth is 31.
    const c = coverageFor({ from: "2026-01-01", to: "2026-08-31" }, overlapping);
    expect(c.totalDays).toBe(243);
    expect(c.uncoveredDays).toBe(31);
  });

  it("survives a database with no observations at all", () => {
    const c = coverageFor(
      { from: "2025-03-12", to: "2025-03-12" },
      { decided: WINDOWS.decided, observed: null },
    );
    expect(c.observed).toBeNull();
    expect(c.decided).not.toBeNull();
  });
});

describe("narrowIsIndexed", () => {
  it("employer, state, occupation and attorney all ride an index", () => {
    expect(
      narrowIsIndexed({
        employer: "google",
        state: "TX",
        socCode: "15-1252",
        attorney: "fragomen",
        status: "CERTIFIED",
      }),
    ).toBe(true);
  });

  it.each([
    ["a floor", { minWage: 150_000 }],
    ["a ceiling", { maxWage: 90_000 }],
    ["both", { minWage: 90_000, maxWage: 150_000 }],
  ])("a wage bound (%s) does not, so its range must be capped", (_l, narrow) => {
    expect(narrowIsIndexed(narrow)).toBe(false);
  });

  it("an empty narrow is indexed", () => {
    expect(narrowIsIndexed({})).toBe(true);
  });
});
