import { describe, expect, it } from "vitest";

import { monthEndDate, type BacklogRow } from "./caseEstimateInputs";

const row = (month: string, analystReview: number): BacklogRow => ({
  month, total: analystReview + 100, pending: analystReview + 20, decided: 80, decidedPct: 50, analystReview,
});
const backlog = [row("2025-10", 43), row("2025-11", 463), row("2025-12", 6227), row("2026-01", 9000)];
const pace = { pace: 600, fast: 800, slow: 400, weekdayMean: 780, weekendMean: 200, weekdaysUsed: 20, daysUsed: 28 };

describe("monthEndDate", () => {
  it("dates the end of a month from every case in line filed through it, at DOL's pace", () => {
    const r = monthEndDate({ backlog, month: "2025-12", pace, frontierMonth: "2025-12", sweepFinishedOn: "2026-10-08", today: "2026-10-08" });
    expect(r).toMatchObject({ kind: "estimate", casesThrough: 43 + 463 + 6227 });
    if (r?.kind !== "estimate") throw new Error("expected a date");
    // 6,733 cases at 600 a day is about 11 days.
    expect(r.date >= "2026-10-17" && r.date <= "2026-10-21").toBe(true);
  });

  it("says a month DOL's queue has passed is passed, with what's still in line", () => {
    expect(monthEndDate({ backlog, month: "2025-11", pace, frontierMonth: "2025-12", sweepFinishedOn: "2026-10-08", today: "2026-10-08" }))
      .toEqual({ kind: "passed", inLine: 463 });
  });

  it("prints no date when the model refuses: a stale sweep, or no pace", () => {
    expect(monthEndDate({ backlog, month: "2026-01", pace, frontierMonth: "2025-12", sweepFinishedOn: "2026-10-01", today: "2026-10-08" })).toBeNull();
    expect(monthEndDate({ backlog, month: "2026-01", pace: null, frontierMonth: "2025-12", sweepFinishedOn: "2026-10-08", today: "2026-10-08" })).toBeNull();
  });
});
