import { describe, expect, it } from "vitest";

import { backlogTrend, dayTrend, waitTrend, waitingTrend } from "@/lib/homeTrends";

describe("waitTrend", () => {
  it("calls a shorter wait good, a longer one bad, and a week either way level", () => {
    expect(waitTrend(290, 320)).toEqual({ text: "30 days quicker in a month", dir: "down", tone: "good" });
    expect(waitTrend(330, 300)).toMatchObject({ text: "30 days longer in a month", tone: "bad" });
    expect(waitTrend(300, 304)?.dir).toBe("level");
    expect(waitTrend(300, null)).toBeUndefined();
  });
});

describe("backlogTrend", () => {
  it("reads a shrinking line as good and a growing one as bad", () => {
    expect(backlogTrend({ change: -1234, trend: "shrinking" })).toEqual({ text: "1,234 fewer in 30 days", dir: "down", tone: "good" });
    expect(backlogTrend({ change: 800, trend: "growing" })).toMatchObject({ text: "800 more in 30 days", tone: "bad" });
    expect(backlogTrend({ change: 3, trend: "level" })?.tone).toBe("neutral");
    expect(backlogTrend(null)).toBeUndefined();
  });
});

describe("dayTrend", () => {
  it("names the weekday it compares with", () => {
    expect(dayTrend("2026-10-30", 24)).toEqual({ text: "24% above a typical Friday", dir: "up", tone: "good" });
    expect(dayTrend("2026-10-30", -30)).toMatchObject({ text: "30% below a typical Friday", tone: "bad" });
    expect(dayTrend("2026-10-30", 4)?.text).toBe("Near a typical Friday");
    expect(dayTrend("2026-10-30", null)).toBeUndefined();
  });
});

describe("waitingTrend", () => {
  it("calls fewer waiting good, more information, and none level, dated by the census day", () => {
    expect(waitingTrend(900, 941, "2026-10-31")).toEqual({ text: "41 fewer since Oct 31", dir: "down", tone: "good" });
    expect(waitingTrend(950, 941, "2026-10-31")).toMatchObject({ text: "9 more since Oct 31", tone: "info" });
    expect(waitingTrend(941, 941, "2026-10-31")?.dir).toBe("level");
    expect(waitingTrend(941, null, "2026-10-31")).toBeUndefined();
    expect(waitingTrend(941, 900, null)).toBeUndefined();
  });
});
