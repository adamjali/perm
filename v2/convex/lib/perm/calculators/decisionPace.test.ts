import { describe, expect, it } from "vitest";
import {
  MAX_HORIZON_DAYS,
  MIN_BAND_DAYS,
  MIN_BAND_FRACTION,
  estimateByPace,
  measurePace,
  type DecisionDay,
  type MeasuredPace,
} from "./decisionPace";

/** An arbitrary "today", as a day number since the epoch. */
const T = 20710;

/**
 * A window of `len` calendar days at `n` decisions per weekday.
 *
 * Weekends run at a third of the weekday rate, which is what the live event
 * log actually shows (weekdays 700-1000, weekends 165-256, measured
 * 2026-09-13). A fixture that put weekends at zero would make the 5:2 mix
 * untested in the only direction it matters.
 */
const mk = (n: number, len = 28): DecisionDay[] =>
  Array.from({ length: len }, (_, i) => {
    const dayOfWeek = (i + 1) % 7;
    const weekend = dayOfWeek === 0 || dayOfWeek === 6;
    return { dayOfWeek, n: weekend ? Math.round(n * 0.33) : n };
  });

const normal = measurePace(mk(800)) as MeasuredPace;

/** A fully-specified happy-path estimate input, overridable per test. */
const ask = (over: Partial<Parameters<typeof estimateByPace>[0]> = {}) =>
  estimateByPace({
    today: T,
    casesAhead: 30_000,
    pace: normal,
    status: "ANALYST REVIEW",
    monthsBehindFrontier: 4,
    sweepAgeDays: 0,
    ...over,
  });

describe("measurePace", () => {
  it("measures a rate from an ordinary window", () => {
    expect(normal).not.toBeNull();
    expect(normal.pace).toBeGreaterThan(0);
  });

  it("puts the calendar pace BELOW the weekday rate", () => {
    // The whole reason the calendar mean exists. A weekday-only rate
    // projected across seven days is the 11%-high bug.
    expect(normal.pace).toBeLessThan(normal.weekdayMean);
  });

  it("refuses a window with too few weekdays", () => {
    expect(measurePace(mk(800, 6))).toBeNull();
  });

  it("refuses a window of all zeros rather than reporting a zero rate", () => {
    // A zero pace would divide into Infinity days, not an error.
    expect(measurePace(mk(0))).toBeNull();
  });

  it("refuses a window containing no weekend (a broken feed, not a 7-day DOL)", () => {
    const noWeekend = Array.from({ length: 20 }, (_, i) => ({
      dayOfWeek: (i % 5) + 1,
      n: 800,
    }));
    expect(measurePace(noWeekend)).toBeNull();
  });

  it("keeps an isolated holiday IN the rate", () => {
    // A federal holiday is part of the calendar. Dropping it is exactly how
    // the rate read 11% high against permupdate's published daily volume.
    const withHoliday = mk(800);
    withHoliday[3] = { ...withHoliday[3]!, n: 2 };
    const held = measurePace(withHoliday) as MeasuredPace;
    expect(held.pace).toBeLessThan(normal.pace);
  });

  it("EXCLUDES a sustained collapse, leaving the rate unchanged", () => {
    // The right assertion is that the collapse does not move the rate, not
    // that the rate clears some number: a clean fixture here paces at ~647,
    // and asserting ">700" was reasoning about a weekday-only rate.
    const shutdown = mk(800).map((d, i) =>
      i >= 5 && i <= 11 ? { ...d, n: 1 } : d,
    );
    const collapsed = measurePace(shutdown) as MeasuredPace;
    expect(collapsed).not.toBeNull();
    expect(Math.abs(collapsed.pace - normal.pace)).toBeLessThan(1);
    expect(collapsed.daysUsed).toBeLessThan(normal.daysUsed);
  });

  it("still measures when only half the window is alive", () => {
    const half = mk(800).map((d, i) => (i < 14 ? { ...d, n: 1 } : d));
    expect(measurePace(half)).not.toBeNull();
  });

  it("orders the band edges around the central rate", () => {
    expect(normal.slow).toBeLessThanOrEqual(normal.pace);
    expect(normal.fast).toBeGreaterThanOrEqual(normal.pace);
  });

  it("widens the band when the daily rate is volatile", () => {
    const steady = measurePace(mk(800)) as MeasuredPace;
    const jumpy = measurePace(
      mk(800).map((d, i) =>
        d.dayOfWeek === 0 || d.dayOfWeek === 6
          ? d
          : { ...d, n: i % 2 ? 1400 : 300 },
      ),
    ) as MeasuredPace;
    expect(jumpy.fast - jumpy.slow).toBeGreaterThan(steady.fast - steady.slow);
  });

  it("is unaffected by the ORDER of days in the window", () => {
    // The collapse walk-back indexes into the array; a rate that moved when
    // the same days arrived in a different order would be reading position.
    const days = mk(800);
    const shuffled = [...days.slice(14), ...days.slice(0, 14)];
    expect(measurePace(shuffled)!.pace).toBeCloseTo(normal.pace, 6);
  });
});

describe("estimateByPace: refusals come before any date", () => {
  it("refuses on a stale sweep", () => {
    const r = ask({ sweepAgeDays: 9 });
    expect(r).toMatchObject({ kind: "refused", reason: "stale-data" });
  });

  it("refuses a case that is not in filing order", () => {
    const r = ask({ status: "RFI ISSUED" });
    expect(r).toMatchObject({ kind: "refused", reason: "side-queue" });
  });

  it("refuses once the queue has passed the filing month", () => {
    const r = ask({ monthsBehindFrontier: -2 });
    expect(r).toMatchObject({ kind: "refused", reason: "overdue" });
    // The absence IS the answer here, so the detail must say what happened.
    expect((r as { detail: string }).detail).toContain("passed");
  });

  it("refuses when the queue position is unknown", () => {
    expect(ask({ casesAhead: null })).toMatchObject({
      kind: "refused",
      reason: "unknown-case",
    });
  });

  it("refuses when the pace could not be measured", () => {
    expect(ask({ pace: null })).toMatchObject({
      kind: "refused",
      reason: "pace-unmeasurable",
    });
  });

  it("refuses beyond the horizon instead of printing a date years out", () => {
    const r = ask({ casesAhead: 50_000_000 });
    expect(r).toMatchObject({ kind: "refused", reason: "beyond-horizon" });
    expect((r as { rawDays: number }).rawDays).toBeGreaterThan(MAX_HORIZON_DAYS);
  });

  it("checks staleness BEFORE the queue position", () => {
    // Order matters: a stale sweep makes every other input suspect, so a
    // reader must be told about the sweep rather than about their case.
    const r = ask({ sweepAgeDays: 9, casesAhead: null });
    expect(r).toMatchObject({ reason: "stale-data" });
  });
});

describe("estimateByPace: the queue-clear branch", () => {
  it("does NOT promise an imminent decision when the queue is clear", () => {
    const r = ask({ casesAhead: 10 });
    expect(r.kind).toBe("queue-clear");
    // Measured, U-shaped: less than a day's work ahead means a median
    // 34-day wait, LONGER than a case with three to ten days ahead.
    expect(r).toMatchObject({ medianDays: 34, p75Days: 81, p90Days: 149 });
  });

  it("fires on the pace NUMBER, not the pace object", () => {
    // `casesAhead <= pace` compared a number to an object, coerced to NaN,
    // and the branch never ran at all. A case exactly at the rate must hit it.
    const r = ask({ casesAhead: Math.floor(normal.pace) });
    expect(r.kind).toBe("queue-clear");
  });

  it("does not fire one case above the rate", () => {
    const r = ask({ casesAhead: Math.ceil(normal.pace) + 1 });
    expect(r.kind).toBe("estimate");
  });
});

describe("estimateByPace: the date and its band", () => {
  it("divides the queue by the calendar pace", () => {
    const r = ask({ casesAhead: 30_000 });
    if (r.kind !== "estimate") throw new Error("expected an estimate");
    expect(r.rawDays).toBe(Math.round(30_000 / normal.pace));
    expect(r.day).toBe(T + r.rawDays);
  });

  it("brackets the estimate with the band", () => {
    const r = ask({ casesAhead: 30_000 });
    if (r.kind !== "estimate") throw new Error("expected an estimate");
    expect(r.early).toBeLessThanOrEqual(r.day);
    expect(r.late).toBeGreaterThanOrEqual(r.day);
  });

  it("never places the early edge in the past", () => {
    const r = ask({ casesAhead: Math.round(normal.pace * 1.2) });
    if (r.kind !== "estimate") throw new Error("expected an estimate");
    expect(r.early).toBeGreaterThan(T);
  });

  it("floors a collapsed band at the measured fraction of the horizon", () => {
    // A metronome fortnight gives fast == slow and a one-day band at four
    // months out. Stable recent pace is not a certain forecast.
    const flat = mk(800).map((d) =>
      d.dayOfWeek === 0 || d.dayOfWeek === 6 ? d : { ...d, n: 800 },
    );
    const steady = measurePace(flat) as MeasuredPace;
    expect(steady.fast).toBeCloseTo(steady.slow, 6);
    const r = estimateByPace({
      today: T,
      casesAhead: 60_000,
      pace: steady,
      status: "ANALYST REVIEW",
      monthsBehindFrontier: 6,
      sweepAgeDays: 0,
    });
    if (r.kind !== "estimate") throw new Error("expected an estimate");
    const width = r.late - r.early;
    const floor = Math.max(
      MIN_BAND_DAYS,
      Math.round(r.rawDays * MIN_BAND_FRACTION),
    );
    // `- 1` only for the two roundings in the late-heavy split, nothing else.
    expect(width).toBeGreaterThanOrEqual(floor - 1);
    // And the floor must actually be BINDING here, or this test would pass
    // against a build with no floor at all - which is how it was first
    // written: `min(floor, width) <= width` is true for every input.
    expect(steady.fast - steady.slow).toBeLessThan(1);
    expect(floor).toBeGreaterThan(MIN_BAND_DAYS);
  });

  it("grows a floored band LATE-heavy, not symmetrically", () => {
    // Misses run late far more often than early (35% vs 23% near-horizon):
    // an audit delays a case, nothing decides it sooner than the queue allows.
    const flat = mk(800).map((d) =>
      d.dayOfWeek === 0 || d.dayOfWeek === 6 ? d : { ...d, n: 800 },
    );
    const steady = measurePace(flat) as MeasuredPace;
    const r = estimateByPace({
      today: T,
      casesAhead: 60_000,
      pace: steady,
      status: "ANALYST REVIEW",
      monthsBehindFrontier: 6,
      sweepAgeDays: 0,
    });
    if (r.kind !== "estimate") throw new Error("expected an estimate");
    expect(r.late - r.day).toBeGreaterThan(r.day - r.early);
  });

  it("is monotonic: a longer queue never yields an earlier day", () => {
    let prev = -Infinity;
    for (const ahead of [5_000, 20_000, 60_000, 120_000, 200_000]) {
      const r = ask({ casesAhead: ahead });
      if (r.kind !== "estimate") continue;
      expect(r.day).toBeGreaterThanOrEqual(prev);
      prev = r.day;
    }
  });

  it("is monotonic in the pace: a faster DOL never yields a later day", () => {
    const slowPace = measurePace(mk(400)) as MeasuredPace;
    const fastPace = measurePace(mk(1200)) as MeasuredPace;
    const slow = ask({ pace: slowPace, casesAhead: 60_000 });
    const fast = ask({ pace: fastPace, casesAhead: 60_000 });
    if (slow.kind !== "estimate" || fast.kind !== "estimate") {
      throw new Error("expected estimates");
    }
    expect(fast.day).toBeLessThanOrEqual(slow.day);
  });

  it("carries NO fitted correction - the day is the raw division", () => {
    // An earlier version subtracted a per-horizon median error. Deleting it
    // cost nothing at the horizons that exist (86% of the live queue is
    // under four months) and removed the last tunable number in the model.
    // A day that differs from casesAhead/pace means a constant crept back.
    for (const ahead of [12_000, 45_000, 90_000]) {
      const r = ask({ casesAhead: ahead });
      if (r.kind !== "estimate") continue;
      expect(r.day - T).toBe(Math.round(ahead / normal.pace));
    }
  });
});
