import { describe, expect, it } from "vitest";

import { monthMakeup } from "./monthMakeup";

describe("monthMakeup", () => {
  it("splits a month into decided by kind, in line, and outside the line", () => {
    const m = monthMakeup([
      { status: "CERTIFIED", count: 7000, isFinal: true },
      { status: "CERTIFIED - EXPIRED", count: 789, isFinal: true },
      { status: "WITHDRAWN", count: 565, isFinal: true },
      { status: "DENIED", count: 22, isFinal: true },
      { status: "ANALYST REVIEW", count: 6435, isFinal: false },
      { status: "APPLICATION ON HOLD", count: 300, isFinal: false },
      { status: "RFI ISSUED", count: 159, isFinal: false },
    ]);
    expect(m).toEqual({
      total: 15270, decided: 8376, certified: 7789, denied: 22, withdrawn: 565, otherDecided: 0, inLine: 6435, outside: 459,
    });
  });

  it("keeps a final status it doesn't name in the decided total", () => {
    const m = monthMakeup([{ status: "DETERMINATION ISSUED", count: 3, isFinal: true }]);
    expect(m.decided).toBe(3);
    expect(m.otherDecided).toBe(3);
  });
});
