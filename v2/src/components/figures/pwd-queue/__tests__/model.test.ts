import { describe, expect, it } from "vitest";
import { estimatePwdDay, isBusinessDay, type PwdDayQueue } from "@/lib/perm";
import { buildPwdQueueRun, pwdDayAt, pwdReading, pwdRemainingAt } from "../model";

// Shaped like the count on Oct 21 2026 (PERM wage requests in process by filing day).
const BY_DAY: [string, number][] = [
  ["2026-04-16", 4], ["2026-05-07", 17], ["2026-06-04", 62],
  ["2026-07-01", 3000], ["2026-07-15", 3000], ["2026-07-31", 3078],
  ["2026-08-03", 5000], ["2026-08-17", 5000], ["2026-08-31", 5022],
  ["2026-09-01", 600], ["2026-09-15", 7000], ["2026-09-30", 6839],
  ["2026-10-01", 4000], ["2026-10-15", 4797],
];
const queue: PwdDayQueue = { asOf: "2026-10-21", byDay: BY_DAY, pace: { perWorkday: 750, fast: 800, slow: 700, workdaysUsed: 19 } };
const input = { queue, dolMonth: "2026-06", dolAsOf: "2026-09-30", today: "2026-10-21" };

describe("the wage-queue figure runs the wage-request lookup's own arithmetic", () => {
  const run = buildPwdQueueRun(input)!;

  it("draws from the month before DOL's and watches the month three after it", () => {
    expect(run.months.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(run.earlier).toBe(4);
    expect(run.pick).toBe("2026-09");
    expect(run.months.find((m) => m.month === "2026-09")!.inLine).toBe(14439);
    expect(run.counted).toBe("2026-10-20");
  });

  it("reaches the picked month's first and last day on the dates estimatePwdDay gives", () => {
    const reach = estimatePwdDay({ filingDate: "2026-09-01", today: "2026-10-21", queue });
    const end = estimatePwdDay({ filingDate: "2026-09-30", today: "2026-10-21", queue });
    expect(reach.kind).toBe("estimate");
    expect(end.kind).toBe("estimate");
    if (reach.kind !== "estimate" || end.kind !== "estimate") return;
    expect(run.reachDate).toBe(reach.date);
    expect(run.endDate).toBe(end.date);
    // the same requests ahead, the day's own counted half included
    expect(Math.round(run.aheadReach)).toBe(reach.requestsAhead);
    expect(run.aheadReach).toBe(24183 + 600 / 2);
    expect(Math.round(run.aheadEnd)).toBe(end.requestsAhead);
    // the time-lapse's own walk lands on those days
    expect(pwdDayAt(run, run.reachWork)).toBe(run.reachDate);
    expect(pwdDayAt(run, run.endWork)).toBe(run.endDate);
  });

  it("walks only the days DOL works", () => {
    const shown = new Set<string>();
    for (let w = 1; w <= Math.ceil(run.endWork); w++) shown.add(pwdDayAt(run, w));
    for (const d of shown) expect(isBusinessDay(d), d).toBe(true);
    expect(shown.has("2026-11-26")).toBe(false); // Thanksgiving
    expect(shown.has("2026-12-25")).toBe(false);
  });

  it("works the oldest requests first", () => {
    const left = pwdRemainingAt(run, 1); // 750 decided: the 4 older, May's 17, June's 62, then July
    expect(left.earlier).toBe(0);
    expect(left.months.slice(0, 3)).toEqual([0, 0, 9078 - (750 - 83)]);
  });

  it("says where the line is, then the lookup's dates", () => {
    expect(pwdReading(run, 0)).toBe("October 20, 2026, as DOL left it: the front tray is May 2026.");
    expect(pwdReading(run, 1)).toBe("October 21, 2026: the front tray is July 2026.");
    expect(pwdReading(run, run.reachWork)).toMatch(/^Around .+: the line reaches September 2026\.$/);
    expect(pwdReading(run, run.endWork)).toMatch(/^Around .+: requests filed on the last day of September 2026 are decided\.$/);
  });

  it("shows nothing it can't stand behind", () => {
    expect(buildPwdQueueRun({ ...input, queue: null })).toBeNull();
    expect(buildPwdQueueRun({ ...input, dolMonth: null })).toBeNull();
    expect(buildPwdQueueRun({ ...input, today: "2026-10-26" })).toBeNull(); // a count 5 days old: the estimate refuses
  });

  it("steps back to the newest month with requests when the third is empty", () => {
    const short = buildPwdQueueRun({ ...input, queue: { ...queue, byDay: BY_DAY.filter(([d]) => d < "2026-09-01") } })!;
    expect(short.pick).toBe("2026-08");
  });
});
