import { describe, expect, it } from "vitest";

import { calculateGreenCardFees, FEE_SCHEDULE, STATE_FEES } from "./greenCardFees";

describe("calculateGreenCardFees", () => {
  it("sums a regular petitioner's single-applicant case from the G-1055 figures", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", adults: 1, workPermits: 1, travelDocuments: 1 });
    // 715 + 600 for the petition; 1,440 + 260 + 630 for the adjustment.
    expect(r.petitionTotal).toBe(1315);
    expect(r.applicationTotal).toBe(2330);
    expect(r.total).toBe(3645);
    expect(r.edition).toBe(FEE_SCHEDULE.edition);
  });

  it("prices the asylum program fee by petitioner kind", () => {
    // G-1055 (10/26/26): $600 regular, $300 small employer (25 or fewer full-time employees) or self-petitioner, $0 nonprofit.
    expect(calculateGreenCardFees({ petitioner: "nonprofit", adults: 0 }).petitionTotal).toBe(715);
    expect(calculateGreenCardFees({ petitioner: "small", adults: 0 }).petitionTotal).toBe(1015);
    expect(calculateGreenCardFees({ petitioner: "regular", adults: 0 }).petitionTotal).toBe(1315);
  });

  it("prices every form that can be filed online at its online fee", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", online: true, adults: 1, children: 1, workPermits: 1, travelDocuments: 1 });
    // G-1055 (10/26/26): I-140 $665, I-485 $1,390 and $900 under 14, I-131 $580; the I-765 is $260 either way.
    expect(r.petitionTotal).toBe(665 + 600);
    expect(r.applicationTotal).toBe(1390 + 900 + 260 + 580);
  });

  it("adds premium processing as its own line", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", premium: true, adults: 0 });
    expect(r.lines.find((l) => l.form === "I-907")?.total).toBe(2965);
    expect(r.petitionTotal).toBe(715 + 600 + 2965);
  });

  it("charges children under 14 the reduced I-485 and never gives them a work permit line", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", adults: 2, children: 2, workPermits: 4, travelDocuments: 0 });
    const i485 = r.lines.filter((l) => l.form === "I-485");
    expect(i485.map((l) => l.total)).toEqual([2880, 1900]);
    // Work permits ride an adult's pending I-485, so four requested become two.
    expect(r.lines.find((l) => l.form === "I-765")?.count).toBe(2);
    expect(r.applicationTotal).toBe(2880 + 1900 + 520);
  });

  it("through a consulate: State's visa fee and USCIS's immigrant fee for everyone, no I-485 family", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", route: "cp", adults: 2, children: 1, workPermits: 2, travelDocuments: 2 });
    expect(r.lines.some((l) => ["I-485", "I-765", "I-131"].includes(l.form))).toBe(false);
    const visa = r.lines.find((l) => l.form === "DS-260");
    const immigrant = r.lines.find((l) => l.form === "USCIS Immigrant Fee");
    // 22 CFR 22.1, item 32(b): $345 an employment-based immigrant visa; G-1055: $235 each immigrant.
    expect([visa?.count, visa?.each, visa?.agency]).toEqual([3, STATE_FEES.ivEmployment, "State"]);
    expect([immigrant?.count, immigrant?.each, immigrant?.agency]).toEqual([3, FEE_SCHEDULE.immigrantFee, "USCIS"]);
    expect(r.applicationTotal).toBe(3 * 345 + 3 * 235);
    // The petition is the same either way.
    expect(r.petitionTotal).toBe(1315);
  });

  it("refuses counts that are not small whole numbers", () => {
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: -1 })).toThrow();
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: 1.5 })).toThrow();
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: 21 })).toThrow();
  });
});
