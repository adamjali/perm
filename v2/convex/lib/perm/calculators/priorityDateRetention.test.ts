import { describe, expect, it } from "vitest";

import { calculatePriorityDateRetention } from "./priorityDateRetention";

describe("calculatePriorityDateRetention", () => {
  it("dates the 180-day withdrawal protection and the I-485 portability clock", () => {
    const r = calculatePriorityDateRetention({ i140Approved: "2026-01-10", i485Filed: "2026-03-01" });
    expect(r.withdrawalSafeFrom).toBe("2026-07-09");
    expect(r.portableFrom).toBe("2026-08-28");
    expect(r.withdrawal).toBeNull();
    expect(r.priorityDateRetained).toBe(true);
  });

  it("calls a withdrawal inside 180 days an automatic revocation and one at 180 or after not", () => {
    const early = calculatePriorityDateRetention({ i140Approved: "2026-01-10", employerWithdrew: "2026-07-08" });
    expect(early.withdrawal).toEqual({ on: "2026-07-08", daysAfterApproval: 179, autoRevokes: true });
    const late = calculatePriorityDateRetention({ i140Approved: "2026-01-10", employerWithdrew: "2026-07-09" });
    expect(late.withdrawal?.autoRevokes).toBe(false);
  });

  it("lets the I-485 clock save an early withdrawal when the I-485 has been pending 180 days", () => {
    const r = calculatePriorityDateRetention({ i140Approved: "2026-05-01", i485Filed: "2025-12-01", employerWithdrew: "2026-06-15" });
    expect(r.withdrawal?.daysAfterApproval).toBe(45);
    expect(r.withdrawal?.autoRevokes).toBe(false);
  });

  it("keeps the priority date even when the I-140 itself is revoked by withdrawal", () => {
    expect(calculatePriorityDateRetention({ i140Approved: "2026-01-10", employerWithdrew: "2026-02-01" }).priorityDateRetained).toBe(true);
  });

  it("refuses malformed dates", () => {
    expect(() => calculatePriorityDateRetention({ i140Approved: "Jan 10 2026" })).toThrow();
    expect(() => calculatePriorityDateRetention({ i140Approved: "2026-01-10", i485Filed: "soon" })).toThrow();
  });
});
