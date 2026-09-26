import { describe, expect, it } from "vitest";

import { H1B_REGISTRATIONS, WEIGHTED_ESTIMATE, perRegistrationRate, registrationsPerBeneficiary } from "./h1bLottery";

describe("USCIS's H-1B registration table, as transcribed", () => {
  it("adds up the way USCIS's own columns do, every year", () => {
    // Eligible = registrations for beneficiaries with no other eligible
    // registration + those for beneficiaries with several. A typo in any one
    // cell breaks this.
    for (const y of H1B_REGISTRATIONS) {
      expect(y.soleRegistrations + y.multipleRegistrations, `FY${y.fy}`).toBe(y.eligible);
      expect(y.eligible, `FY${y.fy}`).toBeLessThanOrEqual(y.total);
      expect(y.selected, `FY${y.fy}`).toBeLessThan(y.eligible);
    }
  });

  it("runs FY2021 to FY2026 without a gap, oldest first", () => {
    expect(H1B_REGISTRATIONS.map((y) => y.fy)).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it("carries the rows USCIS prints (control: FY2024 and FY2026)", () => {
    const fy24 = H1B_REGISTRATIONS.find((y) => y.fy === 2024)!;
    expect([fy24.total, fy24.eligible, fy24.selected]).toEqual([780_884, 758_994, 188_400]);
    const fy26 = H1B_REGISTRATIONS.find((y) => y.fy === 2026)!;
    expect([fy26.total, fy26.eligible, fy26.selected]).toEqual([358_737, 343_981, 120_141]);
  });
});

describe("rates", () => {
  it("is selected over eligible registrations", () => {
    const fy26 = H1B_REGISTRATIONS.find((y) => y.fy === 2026)!;
    expect(perRegistrationRate(fy26)).toBeCloseTo(120_141 / 343_981, 10);
  });

  it("gives registrations per beneficiary only where USCIS published the beneficiaries", () => {
    const fy26 = H1B_REGISTRATIONS.find((y) => y.fy === 2026)!;
    const fy24 = H1B_REGISTRATIONS.find((y) => y.fy === 2024)!;
    // USCIS: "an average of 1.01 registrations per beneficiary this year".
    expect(registrationsPerBeneficiary(fy26)!.toFixed(2)).toBe("1.01");
    expect(registrationsPerBeneficiary(fy24)).toBeNull();
  });
});

describe("DHS's estimate for the weighted lottery", () => {
  it("doubles the level I odds at level II, triples at III, quadruples at IV", () => {
    // The rule enters level IV four times, III three, II two, I once; DHS's
    // simple weighted estimate is exactly proportional.
    const [l1, l2, l3, l4] = WEIGHTED_ESTIMATE.levels.map((l) => l.percent);
    expect(l2! / l1!).toBeCloseTo(2, 2);
    expect(l3! / l1!).toBeCloseTo(3, 2);
    expect(l4! / l1!).toBeCloseTo(4, 2);
    expect(WEIGHTED_ESTIMATE.randomPercent).toBe(29.59);
  });
});
