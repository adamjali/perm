import { describe, expect, it } from "vitest";

import { splitYears, type WageSourceYear } from "../wageSourceYears";

const year = (fy: number, total: number, all?: number): WageSourceYear => ({
  fy, total, all, OES: total, Survey: 0, CBA: 0, SCA: 0, DBA: 0, Other: 0,
});

describe("splitYears", () => {
  it("holds back a year the backfill has only partly read, which would read as the whole year", () => {
    // Measured Oct 4 2026 mid-backfill: FY2021 showed "1,397 LCAs" of about 600,000.
    const out = splitYears([year(2021, 1397, 600000), year(2025, 566291, 596000), year(2026, 437115, 437496)]);
    expect(out.shown.map((y) => y.fy)).toEqual([2025, 2026]);
    expect(out.pending).toEqual([2021]);
  });

  it("draws a year at the 90% line and holds it just under", () => {
    expect(splitYears([year(2024, 900, 1000)]).shown).toHaveLength(1);
    expect(splitYears([year(2024, 899, 1000)]).pending).toEqual([2024]);
  });

  it("draws a year from a doc built before the full count was carried", () => {
    expect(splitYears([year(2024, 5000)]).shown).toHaveLength(1);
  });

  it("leaves out a year too small to split, without calling it pending", () => {
    expect(splitYears([year(2020, 40, 40)])).toEqual({ shown: [], pending: [] });
  });
});
