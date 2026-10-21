import { describe, expect, it } from "vitest";
import { calculatePriorityDateRetention } from "@/lib/perm";
import { APPROVED, I485_FILED, LEAVE_MAX, PORTABLE_FROM, SAFE_FROM, readClocks } from "../model";

describe("the two-clocks figure says what the central rule says", () => {
  it("dates both clocks from the rule, matching the guide's worked example", () => {
    const r = calculatePriorityDateRetention({ i140Approved: APPROVED, i485Filed: I485_FILED });
    expect(SAFE_FROM).toBe(r.withdrawalSafeFrom);
    expect(PORTABLE_FROM).toBe(r.portableFrom);
    expect(SAFE_FROM).toBe("2026-10-17");
    expect(PORTABLE_FROM).toBe("2026-10-31");
  });

  it("says neither holds on October 1, as the guide does", () => {
    const r = readClocks(164);
    expect(r.leave).toBe("2026-10-01");
    expect([r.i140Holds, r.portable]).toEqual([false, false]);
    expect(r.sentence).toBe("Leave on Oct 1: a withdrawal would revoke the I-140, and the I-485 can't move yet.");
  });

  it("turns each clock on its 180th day, not before", () => {
    expect(readClocks(179).i140Holds).toBe(false);
    expect(readClocks(180).i140Holds).toBe(true);
    expect(readClocks(180).sentence).toBe("Leave on Oct 17: the I-140 survives a withdrawal, but the I-485 can't move until Oct 31.");
    expect(readClocks(193).portable).toBe(false);
    expect(readClocks(194).portable).toBe(true);
  });

  it("says both hold on November 2, as the guide does", () => {
    const r = readClocks(196);
    expect(r.leave).toBe("2026-11-02");
    expect(r.sentence).toBe("Leave on Nov 2: the I-140 survives a withdrawal, and the I-485 can move to a same or similar job.");
    expect(readClocks(LEAVE_MAX).portable).toBe(true);
  });
});
