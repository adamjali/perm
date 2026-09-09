import { describe, expect, it } from "vitest";

import { calculateGreenCardFees, FEE_SCHEDULE } from "./greenCardFees";

describe("calculateGreenCardFees", () => {
  it("sums a regular petitioner's single-applicant case from the G-1055 figures", () => {
    const r = calculateGreenCardFees({ petitioner: "regular", adults: 1, workPermits: 1, travelDocuments: 1 });
    // 715 + 600 for the petition; 1,440 + 260 + 630 for the adjustment.
    expect(r.petitionTotal).toBe(1315);
    expect(r.adjustmentTotal).toBe(2330);
    expect(r.total).toBe(3645);
    expect(r.edition).toBe(FEE_SCHEDULE.edition);
  });

  it("prices the asylum program fee by petitioner kind and the I-140 by channel", () => {
    expect(calculateGreenCardFees({ petitioner: "nonprofit", adults: 0 }).petitionTotal).toBe(715);
    expect(calculateGreenCardFees({ petitioner: "small", adults: 0 }).petitionTotal).toBe(1015);
    expect(calculateGreenCardFees({ petitioner: "regular", onlineI140: true, adults: 0 }).petitionTotal).toBe(1265);
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
    expect(r.adjustmentTotal).toBe(2880 + 1900 + 520);
  });

  it("refuses counts that are not small whole numbers", () => {
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: -1 })).toThrow();
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: 1.5 })).toThrow();
    expect(() => calculateGreenCardFees({ petitioner: "regular", adults: 21 })).toThrow();
  });
});
