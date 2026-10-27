import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DOL_DAY_STARTS_HOUR, dolDayBounds, dolDayOf } from "../dolDay";

/** The same fixture scripts/test_observed_decisions.py reads, so the chart and the feed agree. */
const fx = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/dol_day.json"), "utf8")) as {
  startsHour: number;
  days: { what: string; ms: number; day: string }[];
  bounds: { day: string; lo: number; hi: number }[];
};

describe("DOL's day: 7 AM Eastern to 7 AM the next morning", () => {
  it("starts at the fixture's hour", () => {
    expect(DOL_DAY_STARTS_HOUR).toBe(fx.startsHour);
  });

  it.each(fx.days.map((c) => [c.what, c.ms, c.day] as const))("%s", (_what, ms, day) => {
    expect(dolDayOf(ms)).toBe(day);
  });

  it.each(fx.bounds.map((b) => [b.day, b.lo, b.hi] as const))("bounds %s, across clock changes too", (day, lo, hi) => {
    expect(dolDayBounds(day)).toEqual({ lo, hi });
    expect(dolDayOf(lo)).toBe(day);
    expect(dolDayOf(lo - 1)).not.toBe(day);
    expect(dolDayOf(hi - 1)).toBe(day);
  });

  it("refuses a date that is not a date", () => {
    expect(dolDayBounds("2026-02-30")).toBeNull();
    expect(dolDayBounds("Oct 23")).toBeNull();
    expect(dolDayBounds("")).toBeNull();
  });
});
