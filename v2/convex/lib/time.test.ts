import { describe, expect, it } from "vitest";

import {
  DAYS_PER_MONTH,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  checkedLabel,
  daysBetween,
  easternDay,
} from "./time";

describe("units", () => {
  it("are the plain millisecond counts", () => {
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(DAYS_PER_MONTH).toBe(30.4375);
  });
});

describe("easternDay", () => {
  it("is still yesterday in Eastern time after 8 PM, when UTC has moved on", () => {
    // 01:30 UTC on Oct 2 is 9:30 PM EDT on Oct 1.
    expect(easternDay(Date.UTC(2026, 9, 2, 1, 30))).toBe("2026-10-01");
  });

  it("reads a winter instant in EST", () => {
    // 04:59 UTC on Jan 15 is 11:59 PM EST on Jan 14.
    expect(easternDay(Date.UTC(2026, 0, 15, 4, 59))).toBe("2026-01-14");
  });
});

describe("checkedLabel", () => {
  it("gives a 12-hour Eastern time and the Eastern day", () => {
    // 09:25 UTC on Oct 1 is 5:25 AM EDT.
    expect(checkedLabel(Date.UTC(2026, 9, 1, 9, 25))).toBe("5:25 AM ET, Oct 1");
  });
});

describe("daysBetween", () => {
  it("counts calendar days, across a leap day and a daylight-saving change", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-01-10", "2026-01-01")).toBe(-9);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("is NaN when a date doesn't parse", () => {
    expect(daysBetween("2026-13-01", "2026-01-01")).toBeNaN();
  });
});
