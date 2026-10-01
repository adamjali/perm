import { describe, expect, it } from "vitest";

import type { ActivityDay } from "../activityStats";
import { certifiedShare, lastDays, pulseHeadline, recentWeekdays } from "../pulseStats";

const d = (date: string, total: number, certified = total): ActivityDay => ({
  date,
  total,
  certified,
  denied: total - certified,
  withdrawn: 0,
});

// Sep 2026: the 1st is a Tuesday, so the 29th is a Tuesday too.
const SERIES: ActivityDay[] = [
  d("2026-09-08", 700), // Tue
  d("2026-09-15", 800), // Tue
  d("2026-09-20", 2), // Sun
  d("2026-09-21", 600), // Mon
  d("2026-09-22", 900), // Tue
  d("2026-09-27", 8), // Sun
  d("2026-09-28", 712), // Mon
  d("2026-09-29", 989, 906), // Tue, the newest day
];

describe("pulseHeadline", () => {
  it("compares the newest day with the same weekday before it, never the day before", () => {
    const h = pulseHeadline(SERIES)!;
    expect(h.day.date).toBe("2026-09-29");
    // Tuesdays before it: 700, 800, 900. Against Monday's 712 it would read
    // +39%; against the Sunday before that, +12,263%.
    expect(h.typical).toBe(800);
    expect(h.compared).toBe(3);
    expect(h.changePct).toBe(24);
  });

  it("reads the newest day whatever order the rows arrive in", () => {
    expect(pulseHeadline([...SERIES].reverse())!.day.date).toBe("2026-09-29");
  });

  it("uses at most the weeks asked for", () => {
    const h = pulseHeadline(SERIES, 1)!;
    expect(h.typical).toBe(900);
    expect(h.compared).toBe(1);
  });

  it("gives no comparison when no earlier same weekday is on record", () => {
    const h = pulseHeadline([d("2026-09-28", 712), d("2026-09-29", 989)])!;
    expect(h.typical).toBeNull();
    expect(h.changePct).toBeNull();
  });

  it("gives no percentage against a weekday that averaged zero", () => {
    const h = pulseHeadline([d("2026-09-20", 0), d("2026-09-27", 8)])!;
    expect(h.typical).toBe(0);
    expect(h.changePct).toBeNull();
  });

  it("is null for an empty series", () => {
    expect(pulseHeadline([])).toBeNull();
  });
});

describe("lastDays and recentWeekdays", () => {
  it("keeps the newest n days, oldest first", () => {
    expect(lastDays(SERIES, 2).map((x) => x.date)).toEqual(["2026-09-28", "2026-09-29"]);
  });

  it("averages each weekday over the window and leaves an unseen weekday at zero days", () => {
    const p = recentWeekdays(SERIES, 1);
    // The last seven rows: 09-15 .. 09-29 (the series is sparse on purpose).
    const tue = p.find((x) => x.label === "Tue")!;
    expect(tue.days).toBe(3);
    expect(tue.mean).toBe(Math.round((800 + 900 + 989) / 3));
    expect(p.find((x) => x.label === "Wed")!.days).toBe(0);
  });
});

describe("certifiedShare", () => {
  it("is a whole percent, and null on an empty day", () => {
    expect(certifiedShare(d("2026-09-29", 989, 906))).toBe(92);
    expect(certifiedShare(d("2026-09-27", 0))).toBeNull();
  });
});
