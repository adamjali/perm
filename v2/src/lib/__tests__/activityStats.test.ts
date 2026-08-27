import { describe, expect, it } from "vitest";

import {
  MIN_DAYS_FOR_WEEK,
  adjacentToGap,
  isWeekend,
  outcomeByQuarter,
  pace,
  segments,
  toWeeks,
  weekStart,
  weekdayExtremes,
  weekdayIndex,
  weekdayProfile,
  type ActivityDay,
} from "@/lib/activityStats";

/** A day with a total; the outcome split defaults to all certified. */
function day(date: string, total: number, extra: Partial<ActivityDay> = {}): ActivityDay {
  return { date, total, certified: total, denied: 0, withdrawn: 0, ...extra };
}

/** `count` consecutive days from `start`, each with `total`. */
function run(start: string, count: number, total: number): ActivityDay[] {
  const out: ActivityDay[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(day(d.toISOString().slice(0, 10), total));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("weekday helpers", () => {
  it("puts Monday at 0 and reads dates in UTC", () => {
    // TZ is pinned to America/New_York in vitest.config.ts. A local-time
    // reading of "2026-08-13" is the previous day, which would shift every
    // weekday by one and quietly move a Monday into Sunday.
    expect(weekdayIndex("2026-08-13")).toBe(3); // Thursday
    expect(weekdayIndex("2026-08-17")).toBe(0); // Monday
    expect(isWeekend("2026-08-23")).toBe(true); // Sunday
    expect(isWeekend("2026-08-24")).toBe(false); // Monday
  });

  it("snaps a date to the Monday of its ISO week", () => {
    expect(weekStart("2026-08-13")).toBe("2026-08-10");
    expect(weekStart("2026-08-10")).toBe("2026-08-10");
    expect(weekStart("2026-08-16")).toBe("2026-08-10"); // Sunday belongs back
  });
});

describe("toWeeks", () => {
  it("plots a complete week", () => {
    const weeks = toWeeks(run("2026-08-17", 7, 100));
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ weekStart: "2026-08-17", total: 700, daysRecorded: 7 });
  });

  it("withholds a week under the day floor rather than drawing a false dip", () => {
    const weeks = toWeeks(run("2026-08-17", MIN_DAYS_FOR_WEEK - 1, 100));
    expect(weeks).toEqual([null]);
  });

  it("plots a week exactly at the floor", () => {
    const weeks = toWeeks(run("2026-08-17", MIN_DAYS_FOR_WEEK, 100));
    expect(weeks[0]).toMatchObject({ daysRecorded: MIN_DAYS_FOR_WEEK });
  });

  it("emits a null for every absent calendar week, so a hole stays a hole", () => {
    // The real shape of this series: the disclosure file ends 2026-06-30 and
    // the live scan starts 2026-08-13, with 43 days between them. Walking
    // calendar weeks is what makes those weeks exist as nulls; grouping only
    // the recorded days would put the two runs side by side.
    const days = [...run("2026-06-22", 9), ...run("2026-08-17", 7, 100)].map(
      (d, i) => (i < 9 ? day(d.date, 200) : d),
    );
    const weeks = toWeeks(days);
    expect(weeks).toHaveLength(9); // Jun 22 through Aug 17 inclusive
    expect(weeks[0]).not.toBeNull();
    expect(weeks.slice(2, 8).every((w) => w === null)).toBe(true);
    expect(weeks[8]).toMatchObject({ weekStart: "2026-08-17" });
  });

  it("sums the outcome columns as well as the total", () => {
    const days = run("2026-08-17", 7, 100).map((d) =>
      day(d.date, 100, { certified: 90, denied: 7, withdrawn: 3 }),
    );
    expect(toWeeks(days)[0]).toMatchObject({
      total: 700,
      certified: 630,
      denied: 49,
      withdrawn: 21,
    });
  });

  it("returns nothing for an empty series", () => {
    expect(toWeeks([])).toEqual([]);
  });
});

describe("segments", () => {
  it("splits at every null and keeps each point's real x index", () => {
    const weeks = toWeeks([
      ...run("2026-06-22", 14, 200),
      ...run("2026-08-17", 7, 100),
    ]);
    const runs = segments(weeks);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.map((p) => p.i)).toEqual([0, 1]);
    // The live run keeps index 8, not index 2. Renumbering it would place a
    // six-week hole directly beside the run before it.
    expect(runs[1]!.map((p) => p.i)).toEqual([8]);
  });

  it("returns one run when nothing is missing", () => {
    expect(segments(toWeeks(run("2026-06-22", 21, 200)))).toHaveLength(1);
  });

  it("returns nothing when every week is withheld", () => {
    expect(segments([null, null])).toEqual([]);
  });
});

describe("weekdayProfile", () => {
  it("reports a zero-day count per weekday", () => {
    const days = [
      ...run("2026-08-17", 5, 500), // Mon to Fri
      day("2026-08-22", 0), // Saturday, genuinely nothing
      day("2026-08-23", 90), // Sunday
    ];
    const profile = weekdayProfile(days);
    expect(profile.map((p) => p.label)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    expect(profile[5]).toMatchObject({ label: "Sat", zeroDays: 1, mean: 0 });
    expect(profile[6]).toMatchObject({ label: "Sun", zeroDays: 0, mean: 90 });
  });

  it("emits all seven days even when the series covers fewer", () => {
    const profile = weekdayProfile(run("2026-08-17", 2, 500));
    expect(profile).toHaveLength(7);
    expect(profile[6]).toMatchObject({ days: 0, mean: 0, max: 0 });
  });
});

describe("pace", () => {
  /**
   * The bug this function exists to avoid.
   *
   * dolPace.businessDayPace counts every day carrying at least one decision
   * as a business day. In the real series NO recorded weekend day is ever
   * zero, so no weekend is ever excluded and the figure it labels "per
   * working day" is a mean over all seven. On the last 28 days of the
   * disclosure corpus that is 644 against a true weekday mean of 832.
   */
  const fortnight = [
    ...run("2026-08-03", 5, 800), // Mon-Fri
    ...run("2026-08-08", 2, 170), // Sat-Sun, non-zero
    ...run("2026-08-10", 5, 800),
    ...run("2026-08-15", 2, 170),
  ];

  it("separates the weekday rate from the weekend rate", () => {
    const p = pace(fortnight, 14);
    expect(p).not.toBeNull();
    expect(p!.perWeekday).toBe(800);
    expect(p!.weekdays).toBe(10);
    expect(p!.perWeekendDay).toBe(170);
    expect(p!.weekendDays).toBe(4);
  });

  it("does not let non-zero weekend days into the weekday rate", () => {
    // The whole-window mean is 620. Anything reporting that as a working-day
    // rate has reproduced the bug.
    const all = fortnight.reduce((a, b) => a + b.total, 0) / fortnight.length;
    expect(Math.round(all)).toBe(620);
    expect(pace(fortnight, 14)!.perWeekday).not.toBe(Math.round(all));
  });

  it("takes the most recent window, not the first", () => {
    const series = [...run("2026-08-03", 5, 100), ...run("2026-08-10", 5, 900)];
    expect(pace(series, 5)!.perWeekday).toBe(900);
  });

  it("reports no weekend rate rather than zero when the window holds none", () => {
    const p = pace(run("2026-08-17", 5, 800), 5);
    expect(p!.perWeekendDay).toBeNull();
    expect(p!.weekendDays).toBe(0);
  });

  it("returns null when the window holds no weekday at all", () => {
    // "We cannot say" and "the pace is zero" are different statements and
    // only one of them is safe to print.
    expect(pace(run("2026-08-22", 2, 170), 2)).toBeNull();
    expect(pace([], 28)).toBeNull();
  });
});

describe("adjacentToGap", () => {
  const recorded = new Set(["2025-09-30", "2025-10-01", "2025-10-07", "2025-10-31"]);

  it("flags a day whose NEXT day is missing", () => {
    // 2025-10-01 is followed by a five-day hole.
    expect(adjacentToGap("2025-10-01", recorded, "2025-09-30", "2025-10-31")).toBe(true);
  });

  it("flags a day whose PREVIOUS day is missing", () => {
    // Both halves of the check need their own case. A probe that disabled only
    // the backward branch left every other test in this file green, because
    // every day they name is also followed by a hole. 2025-10-31 closes the
    // 23-day hole and has nothing after it.
    expect(adjacentToGap("2025-10-31", recorded, "2025-09-30", "2025-10-31")).toBe(true);
  });

  it("flags a day with a hole on both sides", () => {
    // 2025-10-07 sits alone between a five-day hole and a 23-day one.
    expect(adjacentToGap("2025-10-07", recorded, "2025-09-30", "2025-10-31")).toBe(true);
  });

  it("does not flag a day whose neighbours are both present", () => {
    // 2025-09-30 opens the series and 2025-10-01 follows it, so there is no
    // hole on either side that this day could be measuring.
    expect(adjacentToGap("2025-09-30", recorded, "2025-09-30", "2025-10-31")).toBe(false);
  });

  it("does not flag the ends of the series merely for being ends", () => {
    // The series not having begun, or having ended, is not a gap. Treating it
    // as one would drop the first and last day of every record.
    const dense = new Set(["2026-08-17", "2026-08-18", "2026-08-19"]);
    expect(adjacentToGap("2026-08-17", dense, "2026-08-17", "2026-08-19")).toBe(false);
    expect(adjacentToGap("2026-08-19", dense, "2026-08-17", "2026-08-19")).toBe(false);
    expect(adjacentToGap("2026-08-18", dense, "2026-08-17", "2026-08-19")).toBe(false);
  });
});

describe("weekdayExtremes", () => {
  it("ranks weekdays only, on both ends", () => {
    const days = [...run("2026-08-17", 5, 500), day("2026-08-22", 1), day("2026-08-23", 2)];
    const { busiest, quietest } = weekdayExtremes(days, 3);
    expect(busiest.every((d) => !isWeekend(d.date))).toBe(true);
    expect(quietest.every((d) => !isWeekend(d.date))).toBe(true);
  });

  it("drops days against a hole and counts them", () => {
    // Without this guard the two days bracketing the October 2025 hole take
    // the top of the quietest list at one decision each, which reports the
    // shape of our record as a fact about the agency.
    const days = [
      ...run("2026-08-03", 5, 800),
      day("2026-08-10", 1), // Monday, followed by a hole
      // 2026-08-11 and 12 missing
      ...run("2026-08-13", 3, 700),
    ];
    const { quietest, excluded } = weekdayExtremes(days, 3);
    expect(quietest.map((d) => d.date)).not.toContain("2026-08-10");
    expect(excluded).toBeGreaterThan(0);
  });

  it("orders ties by date so a rebuild cannot change which day is named", () => {
    const days = [
      day("2026-08-17", 5),
      day("2026-08-18", 5),
      day("2026-08-19", 5),
      day("2026-08-20", 900),
      day("2026-08-21", 900),
    ];
    expect(weekdayExtremes(days, 2).busiest.map((d) => d.date)).toEqual([
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("handles an empty series without throwing", () => {
    expect(weekdayExtremes([], 5)).toEqual({ busiest: [], quietest: [], excluded: 0 });
  });
});

describe("outcomeByQuarter", () => {
  it("buckets by federal quarter and reports shares", () => {
    const days = [
      day("2026-04-01", 100, { certified: 90, denied: 6, withdrawn: 4 }),
      day("2026-06-30", 100, { certified: 90, denied: 6, withdrawn: 4 }),
      day("2026-07-01", 200, { certified: 180, denied: 12, withdrawn: 8 }),
    ];
    const quarters = outcomeByQuarter(days);
    expect(quarters.map((q) => q.quarter)).toEqual(["2026-Q2", "2026-Q3"]);
    expect(quarters[0]).toMatchObject({ total: 200 });
    expect(quarters[0]!.deniedPct).toBeCloseTo(6, 6);
    expect(quarters[1]!.withdrawnPct).toBeCloseTo(4, 6);
  });

  it("drops a quarter with no decisions instead of dividing by zero", () => {
    expect(outcomeByQuarter([day("2026-01-05", 0)])).toEqual([]);
  });

  it("orders quarters oldest first across a year boundary", () => {
    const days = [day("2026-01-05", 10), day("2025-11-05", 10)];
    expect(outcomeByQuarter(days).map((q) => q.quarter)).toEqual([
      "2025-Q4",
      "2026-Q1",
    ]);
  });
});
