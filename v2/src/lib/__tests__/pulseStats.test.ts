import { describe, expect, it } from "vitest";

import type { ActivityDay } from "../activityStats";
import { certifiedShare, decisionBuckets, lastDays, pulseHeadline, pulseSummary, recentWeekdays } from "../pulseStats";

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

  // Oct 2026 as our sweep recorded it. Columbus Day (Mon Oct 12): DOL closed,
  // 11 decided, and the homepage board read "Decided Oct 12: 11".
  const HOLIDAY_WEEK: ActivityDay[] = [
    d("2026-09-07", 2), // Mon, Labor Day
    d("2026-09-14", 693), // Mon
    d("2026-09-21", 608), // Mon
    d("2026-09-28", 712), // Mon
    d("2026-10-05", 628), // Mon
    d("2026-10-09", 615), // Fri
    d("2026-10-02", 629), // Fri
    d("2026-09-25", 792), // Fri
    d("2026-09-18", 796), // Fri
    d("2026-09-11", 719), // Fri
    d("2026-10-10", 145), // Sat
    d("2026-10-11", 6), // Sun
    d("2026-10-12", 11, 0), // Mon, Columbus Day
  ];

  it("leads with DOL's last working day and names the holiday after it", () => {
    const h = pulseHeadline(HOLIDAY_WEEK)!;
    expect(h.day.date).toBe("2026-10-09");
    expect(h.typical).toBe(Math.round((792 + 796 + 629 + 719) / 4));
    expect(h.closedAfter).toEqual([{ date: "2026-10-12", name: "Columbus Day", total: 11 }]);
  });

  it("leads with Friday over a weekend, with no holiday to name", () => {
    const h = pulseHeadline(HOLIDAY_WEEK.filter((x) => x.date !== "2026-10-12"))!;
    expect(h.day.date).toBe("2026-10-09");
    expect(h.closedAfter).toEqual([]);
  });

  it("leaves a holiday out of the same-weekday average", () => {
    // Oct 5 against the Mondays before it: Labor Day's 2 isn't one of them.
    const h = pulseHeadline(HOLIDAY_WEEK.filter((x) => x.date <= "2026-10-05"))!;
    expect(h.day.date).toBe("2026-10-05");
    expect(h.typical).toBe(Math.round((693 + 608 + 712) / 3));
    expect(h.compared).toBe(3);
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

describe("pulseSummary", () => {
  it("totals calendar windows ending on the newest day, not the last n rows", () => {
    const s = pulseSummary(SERIES)!;
    // Sep 23 to 29: Sun 8 + Mon 712 + Tue 989. The 22nd is eight days back.
    expect(s.last7).toBe(1709);
    // Aug 31 to Sep 29 holds every row.
    expect(s.last30).toBe(700 + 800 + 2 + 600 + 900 + 8 + 712 + 989);
  });

  it("leaves a federal holiday out of the typical weekday and the typical week", () => {
    const rows = [d("2026-10-05", 628), d("2026-10-09", 615), d("2026-10-12", 11, 0)];
    expect(pulseSummary(rows)!.weekdayAvg).toBe(Math.round((628 + 615) / 2));
    const mon = recentWeekdays(rows, 4).find((x) => x.label === "Mon")!;
    expect(mon.days).toBe(1);
    expect(mon.mean).toBe(628);
  });

  it("averages weekdays only, so a weekend never drags the typical day down", () => {
    const s = pulseSummary(SERIES)!;
    // Mon to Fri rows in the window: 700, 800, 600, 900, 712, 989.
    expect(s.weekdayAvg).toBe(Math.round((700 + 800 + 600 + 900 + 712 + 989) / 6));
  });

  it("gives the certified share of the whole window", () => {
    const s = pulseSummary(SERIES)!;
    const total = 700 + 800 + 2 + 600 + 900 + 8 + 712 + 989;
    expect(s.certifiedPct).toBe(Math.round(((total - 83) / total) * 100));
  });

  it("returns null with nothing on record", () => {
    expect(pulseSummary([])).toBeNull();
  });
});

describe("decisionBuckets", () => {
  // Every day from Mon Jul 27 to Wed Oct 28 2026, 100 decisions each: 70 certified, 20 denied, 10 withdrawn.
  const daily: ActivityDay[] = [];
  for (let t = Date.UTC(2026, 6, 27); t <= Date.UTC(2026, 9, 28); t += 86_400_000) {
    daily.push({ date: new Date(t).toISOString().slice(0, 10), total: 100, certified: 70, denied: 20, withdrawn: 10 });
  }

  it("draws the last 30 days a column a day", () => {
    const b = decisionBuckets(daily, 30);
    expect(b).toHaveLength(30);
    expect(b.every((x) => x.by === "day")).toBe(true);
    expect(b[b.length - 1]!.start).toBe("2026-10-28");
  });

  it("draws 90 days a column a week, whole weeks only, the current week marked as still filling", () => {
    const b = decisionBuckets(daily, 90);
    expect(b.every((x) => x.by === "week")).toBe(true);
    expect(b[0]!.start >= "2026-07-31").toBe(true); // the first Monday inside the span
    expect(b[1]!).toMatchObject({ certified: 490, denied: 140, withdrawn: 70, total: 700, partial: false });
    expect(b[b.length - 1]!).toMatchObject({ start: "2026-10-26", total: 300, partial: true });
  });

  it("has nothing to draw with no days", () => {
    expect(decisionBuckets([], 180)).toEqual([]);
  });
});
