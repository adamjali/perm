import { describe, expect, it } from "vitest";

import { currentWait, monthIndex, type WaitMonthRow } from "../waitTrend";

const row = (decisionMonth: string, medianFilingMonth: string, decisions = 1000): WaitMonthRow => ({
  decisionMonth,
  medianFilingMonth,
  decisions,
});

// The series' real shape as published: the wait rose, then fell.
const REAL = [row("2024-10", "2023-08", 7505), row("2026-02", "2024-09", 14327), row("2026-06", "2025-05", 19787)];

describe("monthIndex", () => {
  it("orders months across a year boundary", () => {
    expect(monthIndex("2026-01")! - monthIndex("2025-12")!).toBe(1);
  });

  it.each(["garbage", "2026-13", "2026-00", "2026-1"])("rejects %s", (v) => {
    expect(monthIndex(v)).toBeNull();
  });
});

describe("currentWait", () => {
  it("is the newest decision month's wait, in whole months", () => {
    expect(currentWait(REAL)).toBe(13);
  });

  it("reads the newest month whatever order the rows arrive in", () => {
    expect(currentWait([...REAL].reverse())).toBe(13);
  });

  it("skips a row decided before it was filed, and unparseable rows", () => {
    expect(currentWait([...REAL, row("2026-07", "2026-09"), row("garbage", "2025-05")])).toBe(13);
  });

  it("has nothing to say with no rows, or a newest row with no wait", () => {
    expect(currentWait([])).toBeNull();
    expect(currentWait([row("2026-06", "2026-06")])).toBeNull();
  });
});
