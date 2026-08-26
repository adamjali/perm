import { describe, expect, it } from "vitest";

import { businessDayPace, type DailyTotal } from "./dolPace";

/**
 * The whole point of this function is that it does NOT average over calendar
 * days, so the tests are built around days that carry no decisions.
 */

/** A fortnight where every other day is a zero, i.e. a weekend stand-in. */
function alternating(count: number, onValue: number): DailyTotal[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    total: i % 2 === 0 ? onValue : 0,
  }));
}

describe("businessDayPace", () => {
  it("divides by working days, not calendar days", () => {
    // 10 days, 5 of them working, 100 decisions each.
    const pace = businessDayPace(alternating(10, 100));
    expect(pace).not.toBeNull();
    // Calendar-day maths would give 50. Working-day maths gives 100.
    expect(pace!.perBusinessDay).toBe(100);
    expect(pace!.businessDays).toBe(5);
  });

  it("reports the window it actually measured, skipping the empty days", () => {
    const pace = businessDayPace(alternating(10, 40));
    // First and last days that carry decisions, not the first and last dates.
    expect(pace!.from).toBe("2026-03-01");
    expect(pace!.to).toBe("2026-03-09");
  });

  it("returns null rather than 0 when nothing was decided", () => {
    const idle: DailyTotal[] = [
      { date: "2026-03-01", total: 0 },
      { date: "2026-03-02", total: 0 },
    ];
    // A pace of zero and "we cannot say" are different claims. Only the
    // second one is safe to render, so the caller has to see null.
    expect(businessDayPace(idle)).toBeNull();
  });

  it("returns null on an empty series", () => {
    expect(businessDayPace([])).toBeNull();
  });

  it("only looks at the last `days` entries", () => {
    const series: DailyTotal[] = [
      // Ancient history, deliberately enormous, and outside the window.
      ...Array.from({ length: 40 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, "0")}`,
        total: 9999,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        total: 10,
      })),
    ];
    const pace = businessDayPace(series, 5);
    expect(pace!.perBusinessDay).toBe(10);
    expect(pace!.businessDays).toBe(5);
  });

  it("rounds to a whole number of decisions", () => {
    const series: DailyTotal[] = [
      { date: "2026-03-01", total: 10 },
      { date: "2026-03-02", total: 11 },
      { date: "2026-03-03", total: 10 },
    ];
    // 31 / 3 = 10.33
    expect(businessDayPace(series)!.perBusinessDay).toBe(10);
  });
});
