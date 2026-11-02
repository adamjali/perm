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

/** DOL's layout from Oct 31 2026: Analyst Review averages over the last 30, 90 and 180 days, no month. */
const windows = (permAsOf: string, days: [number, number, number]): ProcessingTimesSnapshot => ({
  ...snap(permAsOf, null, null),
  permAverageDays: (["Last 30 Days", "Last 90 Days", "Last 180 Days"] as const).map((period, i) => ({
    determination: "Analyst Review",
    month: null,
    period,
    calendarDays: days[i]!,
    raw: String(days[i]),
  })),
});

describe("averageTrend over DOL's windows", () => {
  it("sets the 30-day average against the 90-day one in the same reading", () => {
    expect(averageTrend([windows("2026-10-31", [300, 315, 360])])).toEqual({
      text: "15 days shorter than the 90-day average",
      dir: "down",
      tone: "good",
    });
    expect(averageTrend([windows("2026-10-31", [330, 315, 360])])?.tone).toBe("bad");
    expect(averageTrend([windows("2026-10-31", [316, 315, 360])])?.dir).toBe("level");
  });

  it("reads the month-based rows of an older reading after a window reading", () => {
    // A history that spans the change: the newest reading leads, so its windows decide.
    const h = [windows("2026-10-31", [300, 315, 360]), snap("2026-10-21", ["2026-09", 303], "2026-01")];
    expect(averageTrend(h)?.text).toBe("15 days shorter than the 90-day average");
  });
});

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
