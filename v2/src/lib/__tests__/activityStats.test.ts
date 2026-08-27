import { describe, expect, it } from "vitest";

import {
  MIN_DAYS_FOR_WEEK,
  fillZeros,
  isWeekend,
  outcomeByQuarter,
  pace,
  segments,
  toWeeks,
  weekStart,
  weekdayExtremes,
  weekdayIndex,
  weekdayProfile,
  zeroWeekdays,
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

  it("withholds a partial week at an end rather than drawing a false dip", () => {
    // After fillZeros the only partial weeks left are the two at the ends, so
    // this floor trims a cliff rather than hiding a collapse. The collapse
    // case is covered below: a zero-filled quiet week IS drawn.
    const weeks = toWeeks(run("2026-08-17", MIN_DAYS_FOR_WEEK - 1, 100));
    expect(weeks).toEqual([null]);
  });

  it("PLOTS a full week of zeros instead of withholding it", () => {
    // The October 2025 regression test. Three consecutive weeks read 1, 0 and
    // 0 in the real corpus; withholding them made the largest stoppage in the
    // record render as blank space.
    const weeks = toWeeks(fillZeros([day("2026-08-17", 1), day("2026-08-23", 0)]));
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ total: 1, daysRecorded: 7 });
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

describe("fillZeros", () => {
  it("turns an absent day into a ZERO, because absence is what zero looks like here", () => {
    // The disclosure series is GROUP BY decision_date over the case corpus,
    // proven by its total equalling COUNT(*) exactly, so a day with no
    // decisions produces no row. Reading those as unmeasured is what hid the
    // October 2025 stoppage behind a gap.
    const sparse = [day("2026-08-17", 500), day("2026-08-20", 400)];
    const filled = fillZeros(sparse);
    expect(filled.map((d) => d.date)).toEqual([
      "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
    ]);
    expect(filled.map((d) => d.total)).toEqual([500, 0, 0, 400]);
  });

  it("invents nothing outside the series' own ends", () => {
    // A day after the last is the series ENDING, which is a different fact
    // from a day DOL decided nothing, and filling it would manufacture an
    // outage exactly where the two sources hand over.
    const filled = fillZeros([day("2026-08-17", 500), day("2026-08-18", 400)]);
    expect(filled).toHaveLength(2);
  });

  it("carries the outcome columns through on a real day and zeroes an absent one", () => {
    const filled = fillZeros([
      day("2026-08-17", 100, { certified: 90, denied: 7, withdrawn: 3 }),
      day("2026-08-19", 100, { certified: 90, denied: 7, withdrawn: 3 }),
    ]);
    expect(filled[1]).toMatchObject({ total: 0, certified: 0, denied: 0, withdrawn: 0 });
    expect(filled[0]).toMatchObject({ certified: 90, denied: 7, withdrawn: 3 });
  });

  it("returns nothing for an empty series", () => {
    expect(fillZeros([])).toEqual([]);
  });
});

describe("zeroWeekdays", () => {
  it("finds weekdays with no determinations and ignores weekends", () => {
    const days = fillZeros([day("2026-08-17", 500), day("2026-08-24", 500)]);
    const idle = zeroWeekdays(days);
    expect(idle.every((d) => !isWeekend(d.date))).toBe(true);
    expect(idle.map((d) => d.date)).toEqual([
      "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21",
    ]);
  });
});

describe("weekdayExtremes", () => {
  it("ranks weekdays only, on both ends", () => {
    const days = [...run("2026-08-17", 5, 500), day("2026-08-22", 1), day("2026-08-23", 2)];
    const { busiest, quietest } = weekdayExtremes(days, 3);
    expect(busiest.every((d) => !isWeekend(d.date))).toBe(true);
    expect(quietest.every((d) => !isWeekend(d.date))).toBe(true);
  });

  it("ranks a genuine zero-decision weekday as the quietest, not as a gap", () => {
    // The reverse of the earlier behaviour, and the earlier behaviour was
    // wrong: a weekday DOL decided nothing IS the quietest day, and excluding
    // it removed every federal holiday and the whole of October 2025.
    const days = fillZeros([...run("2026-08-03", 5, 800), day("2026-08-12", 700)]);
    const { quietest } = weekdayExtremes(days, 3);
    expect(quietest[0]).toMatchObject({ total: 0 });
    expect(quietest.every((d) => !isWeekend(d.date))).toBe(true);
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
    expect(weekdayExtremes([], 5)).toEqual({ busiest: [], quietest: [] });
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
