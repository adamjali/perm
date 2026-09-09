import { describe, expect, it } from "vitest";

import { latestLimits, latestUsage, type VisaAnnualLimitsDoc } from "@/lib/visaLimits";

// The figures the Department printed on its FY2026 sheet and its FY2024
// Table V, as scripts/test_visa_limits.py pins them from the real PDFs.
const doc: VisaAnnualLimitsDoc = {
  limits: {
    "2026": {
      fiscal_year: 2026,
      estimated: true,
      family: { Total: { foreign_state: 15820, worldwide: 226000 } },
      employment: {
        E1: { foreign_state: 3724, worldwide: 53196 },
        E2: { foreign_state: 3724, worldwide: 53196 },
        "E3/EW": { foreign_state: 3724, worldwide: 53196 },
        "E4/SR": { foreign_state: 924, worldwide: 13206 },
        E5: { foreign_state: 924, worldwide: 13206 },
        Total: { foreign_state: 13020, worldwide: 186000 },
      },
      family_base: 226000,
      employment_base: 140000,
      spillover_to_employment: 46000,
      per_country_employment: 13020,
      notes: ["*Estimated, pending official determination."],
      source: "https://travel.state.gov/x",
    },
  },
  table_v: {
    "2024": {
      fiscal_year: 2024,
      family: { total: 215959 },
      employment: { total: 167394 },
      grand_total: 383353,
      family_base: 226000,
      family_unused: 10041,
      source: "https://travel.state.gov/y",
    },
  },
};

describe("latestLimits", () => {
  it("reads the newest year's employment total and the spillover the Department set", () => {
    const s = latestLimits(doc)!;
    expect(s.fiscalYear).toBe(2026);
    expect(s.employmentTotal).toBe(186000);
    expect(s.spillover).toBe(46000);
    expect(s.estimated).toBe(true);
    expect(s.perCountry).toBe(13020);
    expect(s.rows.map((r) => r.label)).toEqual(["EB-1", "EB-2", "EB-3, including other workers", "EB-4, including religious workers", "EB-5", "All employment-based"]);
    expect(s.rows[0]).toEqual({ label: "EB-1", worldwide: 53196, foreignState: 3724 });
  });

  it("picks the newest year when several are held", () => {
    const two: VisaAnnualLimitsDoc = { ...doc, limits: { ...doc.limits, "2025": { ...doc.limits["2026"]!, fiscal_year: 2025, spillover_to_employment: 1 } } };
    expect(latestLimits(two)!.fiscalYear).toBe(2026);
  });

  it("is null with no document or no years, never a fabricated figure", () => {
    expect(latestLimits(null)).toBeNull();
    expect(latestLimits({ limits: {}, table_v: {} })).toBeNull();
  });
});

describe("latestUsage", () => {
  it("reads Table V's totals and the unused family numbers", () => {
    const u = latestUsage(doc)!;
    expect(u).toMatchObject({ fiscalYear: 2024, familyUsed: 215959, familyUnused: 10041, employmentUsed: 167394 });
    expect(u.familyBase - u.familyUsed).toBe(u.familyUnused);
  });

  it("is null without a Table V", () => {
    expect(latestUsage({ limits: doc.limits, table_v: {} })).toBeNull();
  });
});
