import { describe, expect, it } from "vitest";

import type { ProcessingTimesSnapshot } from "@/lib/db/processingTimes";
import { averageTrend, queueMoveTrend } from "@/lib/dolTrends";

const snap = (permAsOf: string, avg: [string, number] | null, analyst: string | null): ProcessingTimesSnapshot => ({
  permAsOf,
  permQueues: analyst ? [{ queue: "Analyst Review", priorityDate: analyst, raw: analyst }] : [],
  permAverageDays: avg ? [{ determination: "Analyst Review", month: avg[0], calendarDays: avg[1], raw: String(avg[1]) }] : [],
  pwdAsOf: null,
  pwdQueues: [],
  pwdPermBacklog: [],
  pwdReviews: [],
  sourceUrl: "",
  fetchedAt: 0,
});

const analyst = (s: ProcessingTimesSnapshot) => ({ month: s.permQueues[0]?.priorityDate, asOf: s.permAsOf });

describe("averageTrend", () => {
  it("sets the newest month's average against the month before, shorter being good", () => {
    const h = [snap("2026-10-05", ["2026-09", 324], "2025-12"), snap("2026-09-22", ["2026-09", 324], "2025-12"), snap("2026-09-01", ["2026-08", 336], "2025-11")];
    expect(averageTrend(h)).toEqual({ text: "12 days shorter than August", dir: "down", tone: "good" });
  });

  it("calls a longer average bad, a change under 3 days level, and needs two months", () => {
    expect(averageTrend([snap("2026-10-05", ["2026-09", 350], null), snap("2026-09-01", ["2026-08", 336], null)])?.tone).toBe("bad");
    expect(averageTrend([snap("2026-10-05", ["2026-09", 337], null), snap("2026-09-01", ["2026-08", 336], null)])?.dir).toBe("level");
    expect(averageTrend([snap("2026-10-05", ["2026-09", 337], null)])).toBeUndefined();
  });
});

describe("queueMoveTrend", () => {
  it("reads the month a queue moved over at least 28 days of readings", () => {
    const h = [snap("2026-10-05", null, "2025-12"), snap("2026-09-22", null, "2025-12"), snap("2026-09-01", null, "2025-11")];
    expect(queueMoveTrend(h, analyst)).toEqual({ text: "Forward 1 month since Sep 1", dir: "up", tone: "good" });
  });

  it("says a queue that held is unmoved, and one that went back is bad", () => {
    expect(queueMoveTrend([snap("2026-10-05", null, "2025-12"), snap("2026-09-01", null, "2025-12")], analyst)?.text).toBe("Unmoved since Sep 1");
    expect(queueMoveTrend([snap("2026-10-05", null, "2025-10"), snap("2026-09-01", null, "2025-12")], analyst)).toMatchObject({ dir: "down", tone: "bad" });
  });

  it("says nothing without a reading old enough to compare", () => {
    expect(queueMoveTrend([snap("2026-10-05", null, "2025-12"), snap("2026-09-22", null, "2025-11")], analyst)).toBeUndefined();
  });
});
