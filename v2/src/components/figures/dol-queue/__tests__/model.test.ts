import { describe, expect, it } from "vitest";
import { estimateByPace, type MeasuredPace } from "@/lib/perm";
import { monthEndDate } from "@/lib/caseEstimateInputs";
import { buildQueueRun, queueReading, remainingAt } from "../model";

// The line on Oct 21 2026 (analyst review by filing month, from the live census).
const IN_LINE: [string, number][] = [
  ["2025-07", 9], ["2025-08", 31], ["2025-09", 45], ["2025-10", 10], ["2025-11", 343], ["2025-12", 1613],
  ["2026-01", 9707], ["2026-02", 4872], ["2026-03", 6625], ["2026-04", 7039], ["2026-05", 7865], ["2026-06", 10053],
  ["2026-07", 8837], ["2026-08", 8545], ["2026-09", 10035], ["2026-10", 6621],
];
const backlog = IN_LINE.map(([month, n]) => ({ month, total: n, pending: n, decided: 0, decidedPct: 0, analystReview: n }));
const pace: MeasuredPace = { pace: 600, fast: 700, slow: 500, weekdayMean: 780, weekendMean: 150, weekdaysUsed: 20, daysUsed: 28 };
const input = { backlog, pace, dolMonth: "2025-12", sweepFinishedOn: "2026-10-21", today: "2026-10-21" };

describe("the queue figure runs the estimate's own arithmetic", () => {
  const run = buildQueueRun(input)!;

  it("draws from the month before DOL's and watches the month three after it", () => {
    expect(run.months[0]!.month).toBe("2025-11");
    expect(run.earlier).toBe(9 + 31 + 45 + 10);
    expect(run.pick).toBe("2026-03");
  });

  it("reaches the picked month on the day estimateByPace gives for the cases ahead of it", () => {
    const ahead = 95 + 343 + 1613 + 9707 + 4872;
    const est = estimateByPace({ today: Date.parse("2026-10-21T00:00:00Z") / 86_400_000, casesAhead: ahead, pace, status: "ANALYST REVIEW", monthsBehindFrontier: 3, sweepAgeDays: 0 });
    expect(est.kind).toBe("estimate");
    expect(run.reachDays).toBe(Math.round(ahead / 600));
    expect(run.reachDate).toBe(new Date((est as { day: number }).day * 86_400_000).toISOString().slice(0, 10));
  });

  it("ends the picked month on the date the month page prints", () => {
    const end = monthEndDate({ backlog, month: "2026-03", pace, frontierMonth: "2025-12", sweepFinishedOn: "2026-10-21", today: "2026-10-21" });
    expect(end).toMatchObject({ kind: "estimate", date: run.endDate });
  });

  it("works the oldest cases first", () => {
    const left = remainingAt(run, 1); // 600 decided: the 95 older, the 343 from November, 162 from December
    expect(left.earlier).toBe(0);
    expect(left.months.slice(0, 3)).toEqual([0, 1613 - 162, 9707]);
  });

  it("says where the line is, then the estimate's dates in the month page's words", () => {
    expect(queueReading(run, 0)).toBe("October 21, 2026: DOL is finishing November 2025's last cases.");
    expect(queueReading(run, 2)).toBe("October 23, 2026: the front tray is December 2025.");
    expect(queueReading(run, run.reachDays)).toBe(`Around November 18, 2026: the line reaches March 2026.`);
    expect(queueReading(run, run.endDays)).toMatch(/^Around .+: the line reaches the end of March 2026\.$/);
  });

  it("shows nothing it can't stand behind", () => {
    expect(buildQueueRun({ ...input, pace: null })).toBeNull();
    expect(buildQueueRun({ ...input, dolMonth: null })).toBeNull();
    expect(buildQueueRun({ ...input, sweepFinishedOn: "2026-10-10" })).toBeNull(); // a stale sweep: the estimate refuses
  });
});
