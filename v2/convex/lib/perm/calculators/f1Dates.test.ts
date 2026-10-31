import { describe, expect, it } from "vitest";

import { calculateCapGap, calculateOptUnemployment, calculatePendingExtension, fiscalYearOfDay } from "./f1Dates";

/** Each expectation is the regulation's own words worked on dates chosen so the answer can be checked by hand. */

describe("cap-gap, 8 CFR 214.2(f)(5)(vii)(A)", () => {
  it("names the fiscal year by the September it ends in", () => {
    expect(fiscalYearOfDay("2026-10-01")).toBe(2027);
    expect(fiscalYearOfDay("2026-09-30")).toBe(2026);
  });

  it("runs until April 1 of the fiscal year while the petition is pending", () => {
    const r = calculateCapGap({ requestedStart: "2026-10-01", filed: "2026-04-01", optEnds: "2026-06-15" });
    expect(r).toMatchObject({ fiscalYear: 2027, aprilFirst: "2027-04-01", until: "2027-04-01", byApproval: false, optValidAtFiling: true, gap: true });
  });

  it("ends at the approved start date when that comes first", () => {
    const r = calculateCapGap({ requestedStart: "2026-10-01", approvedStart: "2026-10-01", filed: "2026-04-01", optEnds: "2026-06-15" });
    expect(r.until).toBe("2026-10-01");
    expect(r.byApproval).toBe(true);
  });

  it("says when the OPT had already ended on the filing day", () => {
    const r = calculateCapGap({ requestedStart: "2026-10-01", filed: "2026-05-02", optEnds: "2026-05-01" });
    expect(r.optValidAtFiling).toBe(false);
    expect(calculateCapGap({ requestedStart: "2026-10-01", filed: "2026-05-01", optEnds: "2026-05-01" }).optValidAtFiling).toBe(true);
  });

  it("sees no gap when the OPT runs past the start", () => {
    expect(calculateCapGap({ requestedStart: "2026-10-01", filed: "2026-04-01", optEnds: "2026-12-31" }).gap).toBe(false);
  });
});

describe("OPT unemployment, 8 CFR 214.2(f)(10)(ii)(E)", () => {
  it("counts every day of the current stretch, the first and today included", () => {
    const r = calculateOptUnemployment({ stem: false, usedBefore: 10, unemployedSince: "2026-10-01", today: "2026-10-31" });
    expect(r.used).toBe(41);
    expect(r.left).toBe(49);
    // The 90th day: 80 more from October 1, the first of them October 1 itself.
    expect(r.lastDay).toBe("2026-12-19");
    expect(r.over).toBe(false);
  });

  it("allows 150 in all once a STEM extension is granted", () => {
    const r = calculateOptUnemployment({ stem: true, usedBefore: 90, unemployedSince: "2026-10-01", today: "2026-10-01" });
    expect(r).toMatchObject({ limit: 150, used: 91, left: 59, lastDay: "2026-11-29" });
  });

  it("says over the limit past it", () => {
    expect(calculateOptUnemployment({ stem: false, usedBefore: 89, unemployedSince: "2026-10-30", today: "2026-10-31" }).over).toBe(true);
    expect(calculateOptUnemployment({ stem: false, usedBefore: 88, unemployedSince: "2026-10-30", today: "2026-10-31" }).over).toBe(false);
  });

  it("counts only the days already used when working now", () => {
    expect(calculateOptUnemployment({ stem: false, usedBefore: 30, today: "2026-10-31" })).toMatchObject({ used: 30, left: 60, lastDay: null });
  });
});

describe("the 240-day rule, 8 CFR 274a.12(b)(20)", () => {
  it("counts 240 days beginning on the I-94's end date, and says the later count too", () => {
    const r = calculatePendingExtension({ i94Ends: "2026-01-01", extensionFiled: "2025-12-15" });
    expect(r.lastDay).toBe("2026-08-28");
    expect(r.lastDayCountingFromNext).toBe("2026-08-29");
    expect(r.filedInTime).toBe(true);
  });

  it("says when the extension was filed after the stay ended", () => {
    expect(calculatePendingExtension({ i94Ends: "2026-01-01", extensionFiled: "2026-01-02" }).filedInTime).toBe(false);
  });

  it("refuses a date that isn't one", () => {
    expect(() => calculatePendingExtension({ i94Ends: "2026-02-30", extensionFiled: "2026-01-01" })).toThrow(/i94Ends/);
  });
});
