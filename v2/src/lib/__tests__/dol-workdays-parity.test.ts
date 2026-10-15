import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getFederalHolidays, measureWorkdayPace, PWD_MIN_WORKDAYS } from "@/lib/perm";
import { COLLAPSE_FRACTION } from "@convex/lib/perm/calculators/decisionPace";
import { PWD_EDGE_WORKDAYS } from "@convex/lib/perm/calculators/pwdQueue";
import { decidedOnFromSeen, SEEN_NEXT_MORNING_BEFORE_HOUR } from "@/lib/scorecard/score";

/**
 * The wage-request day is built twice: by the site (estimatePwdDay) and by
 * the nightly backtest that tests it (scripts/backtest_pwd.py, with
 * scripts/lib_holidays.py). A holiday or a constant the two disagree on is a
 * backtest grading a date no reader was shown, so both are held to one
 * fixture here and in scripts/test_holidays.py.
 */
const root = process.cwd();
const fixture = JSON.parse(readFileSync(join(root, "scripts/fixtures/federal_holidays.json"), "utf8")) as {
  years: Record<string, [string, string][]>;
};
const py = (file: string) => readFileSync(join(root, "scripts", file), "utf8");
const pyConst = (src: string, name: string) => {
  const m = src.match(new RegExp(`^${name} = ([\\d.]+)`, "m"));
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
};

describe("DOL's working days, site and backtest alike", () => {
  it("the site's federal holidays are the fixture's, year by year", () => {
    const years = Object.keys(fixture.years);
    expect(years.length).toBeGreaterThanOrEqual(5);
    for (const y of years) {
      const site = getFederalHolidays(Number(y))
        .map((h) => [h.date, h.name] as [string, string])
        .sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
      expect(site, y).toEqual(fixture.years[y]);
    }
  });

  it("the backtest's constants are the site's", () => {
    const bt = py("backtest_pwd.py");
    expect(pyConst(bt, "DAY_MIN_WORKDAYS")).toBe(PWD_MIN_WORKDAYS);
    expect(pyConst(bt, "DAY_EDGE_WORKDAYS")).toBe(PWD_EDGE_WORKDAYS);
    expect(pyConst(bt, "DAY_COLLAPSE")).toBe(COLLAPSE_FRACTION);
    expect(pyConst(py("lib_holidays.py"), "SEEN_NEXT_MORNING_BEFORE_HOUR")).toBe(SEEN_NEXT_MORNING_BEFORE_HOUR);
  });

  it("a decision seen in the morning was made the day before; one seen in the afternoon, that day", () => {
    // 5:40 AM EDT Tue Oct 13 2026 (09:40 UTC), after Columbus Day: decided Monday the 12th.
    expect(decidedOnFromSeen(Date.UTC(2026, 9, 13, 9, 40))).toBe("2026-10-12");
    // 5:05 PM EDT Fri Oct 9 (21:05 UTC): the 5-minute check, the same day.
    expect(decidedOnFromSeen(Date.UTC(2026, 9, 9, 21, 5))).toBe("2026-10-09");
    // 11:59 AM EDT is still the morning sweep's reading; noon is not.
    expect(decidedOnFromSeen(Date.UTC(2026, 9, 14, 15, 59))).toBe("2026-10-13");
    expect(decidedOnFromSeen(Date.UTC(2026, 9, 14, 16, 0))).toBe("2026-10-14");
    // 1 AM EST on Jan 2 (06:00 UTC): the day before, across a year.
    expect(decidedOnFromSeen(Date.UTC(2027, 0, 2, 6, 0))).toBe("2027-01-01");
  });

  it("the pace a working day is the backtest's on the same days (scripts/test_backtest_pwd.py)", () => {
    // Two weeks Mon Sep 28 to Sun Oct 11 2026, Columbus Day Monday the 12th in the third.
    const days: { date: string; n: number }[] = [];
    const counts = [800, 820, 780, 810, 400, 5, 0, 830, 860, 790, 840, 420, 3, 0, 90, 900, 880, 850, 450];
    for (let i = 0; i < counts.length; i++) {
      days.push({ date: new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10), n: counts[i]! });
    }
    const p = measureWorkdayPace(days);
    if (!p) throw new Error("expected a pace");
    expect(p.workdaysUsed).toBe(14);
    // Every exit (holiday and weekend ones too) over the 14 working days.
    expect(p.perWorkday).toBe(10_528 / 14);
    expect(p.fast).toBeCloseTo(773.1973154362416, 9);
    expect(p.slow).toBeCloseTo(706.5771812080537, 9);
  });
});
