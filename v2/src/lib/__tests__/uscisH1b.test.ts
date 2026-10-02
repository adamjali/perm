import { describe, expect, it } from "vitest";

import { RATE_FLOOR, approvalRate, leadYear, shapeYears, sum, type H1bYearRow } from "../uscisH1b";

/**
 * The USCIS H-1B record's arithmetic. The two mistakes worth a test: a
 * part-year read as a whole one (FY2026 through June against FY2025 entire),
 * and an approval rate printed over a handful of decisions.
 */

const row = (fy: number, appr: number, den: number): H1bYearRow => ({
  fy: String(fy),
  new_appr: String(appr), new_den: String(den),
  cont_appr: "0", cont_den: "0", same_appr: "0", same_den: "0",
  conc_appr: "0", conc_den: "0", chg_appr: "1", chg_den: "0", amend_appr: "0", amend_den: null,
});

describe("shapeYears", () => {
  it("reads libSQL's strings, a NULL as zero, and sorts oldest first", () => {
    const y = shapeYears([row(2026, 10, 1), row(2024, 5, 0)]);
    expect(y.map((v) => v.fy)).toEqual([2024, 2026]);
    expect(sum(y[1]!.approved)).toBe(11);
    expect(y[1]!.denied.amend).toBe(0);
  });
});

describe("leadYear", () => {
  const years = shapeYears([row(2025, 100, 5), row(2026, 60, 2)]);

  it("leads with the last whole year while the newest is partway through", () => {
    expect(leadYear(years, "2026-06-30")).toEqual({ year: years[0], partial: false });
  });

  it("leads with the newest once USCIS has finished it", () => {
    expect(leadYear(years, "2026-09-30")).toEqual({ year: years[1], partial: false });
  });

  it("labels the newest as partial when there's no whole year before it", () => {
    expect(leadYear([years[1]!], "2026-06-30")).toEqual({ year: years[1], partial: true });
  });
});

describe("approvalRate", () => {
  it("withholds a rate under the floor and gives one at it", () => {
    expect(approvalRate(RATE_FLOOR - 1, 0)).toBeNull();
    expect(approvalRate(RATE_FLOOR - 2, 2)).toBeCloseTo(0.9);
  });
});
