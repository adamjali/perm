import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  formatDistanceToNow,
  formatDate,
  formatISODate,
  safeFormatDistanceToNow,
  formatShortDate,
  safeFormatShortDate,
  formatCountdown,
} from "../date";

describe("formatDistanceToNow", () => {
  beforeEach(() => {
    // Reset time mocking before each test
    vi.useRealTimers();
  });

  test('returns "just now" for dates within 60 seconds', () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // Test Date object - 30 seconds ago
    const date30SecondsAgo = new Date("2024-12-24T11:59:30Z");
    expect(formatDistanceToNow(date30SecondsAgo)).toBe("just now");

    // Test timestamp - 59 seconds ago
    const timestamp59SecondsAgo = new Date("2024-12-24T11:59:01Z").getTime();
    expect(formatDistanceToNow(timestamp59SecondsAgo)).toBe("just now");

    // Edge case - exactly 60 seconds ago should still be "just now"
    const exactly60SecondsAgo = new Date("2024-12-24T11:59:00Z");
    expect(formatDistanceToNow(exactly60SecondsAgo)).toBe("just now");
  });

  test('returns "Xm ago" for dates within an hour', () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // 5 minutes ago
    const date5MinutesAgo = new Date("2024-12-24T11:55:00Z");
    expect(formatDistanceToNow(date5MinutesAgo)).toBe("5m ago");

    // 15 minutes ago (timestamp)
    const timestamp15MinutesAgo = new Date("2024-12-24T11:45:00Z").getTime();
    expect(formatDistanceToNow(timestamp15MinutesAgo)).toBe("15m ago");

    // 59 minutes ago
    const date59MinutesAgo = new Date("2024-12-24T11:01:00Z");
    expect(formatDistanceToNow(date59MinutesAgo)).toBe("59m ago");
  });

  test('returns "Xh ago" for dates within a day', () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // 2 hours ago
    const date2HoursAgo = new Date("2024-12-24T10:00:00Z");
    expect(formatDistanceToNow(date2HoursAgo)).toBe("2h ago");

    // 5 hours ago (timestamp)
    const timestamp5HoursAgo = new Date("2024-12-24T07:00:00Z").getTime();
    expect(formatDistanceToNow(timestamp5HoursAgo)).toBe("5h ago");

    // 23 hours ago
    const date23HoursAgo = new Date("2024-12-23T13:00:00Z");
    expect(formatDistanceToNow(date23HoursAgo)).toBe("23h ago");
  });

  test('returns "Xd ago" for dates within a week', () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // 2 days ago
    const date2DaysAgo = new Date("2024-12-22T12:00:00Z");
    expect(formatDistanceToNow(date2DaysAgo)).toBe("2d ago");

    // 5 days ago (timestamp)
    const timestamp5DaysAgo = new Date("2024-12-19T12:00:00Z").getTime();
    expect(formatDistanceToNow(timestamp5DaysAgo)).toBe("5d ago");

    // 6 days ago
    const date6DaysAgo = new Date("2024-12-18T12:00:00Z");
    expect(formatDistanceToNow(date6DaysAgo)).toBe("6d ago");
  });

  test("returns formatted date for dates older than a week", () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // 8 days ago (different month)
    const date8DaysAgo = new Date("2024-12-16T12:00:00Z");
    expect(formatDistanceToNow(date8DaysAgo)).toBe("Dec 16");

    // Last year (timestamp)
    const timestampLastYear = new Date("2023-11-15T12:00:00Z").getTime();
    expect(formatDistanceToNow(timestampLastYear)).toBe("Nov 15");

    // Different year format
    const dateOldYear = new Date("2022-03-20T12:00:00Z");
    expect(formatDistanceToNow(dateOldYear)).toBe("Mar 20");
  });

  test("handles timestamp numbers correctly", () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // Various timestamp formats
    const timestamp1MinAgo = new Date("2024-12-24T11:58:59Z").getTime();
    expect(formatDistanceToNow(timestamp1MinAgo)).toBe("1m ago");

    const timestamp3HoursAgo = new Date("2024-12-24T09:00:00Z").getTime();
    expect(formatDistanceToNow(timestamp3HoursAgo)).toBe("3h ago");

    const timestamp4DaysAgo = new Date("2024-12-20T12:00:00Z").getTime();
    expect(formatDistanceToNow(timestamp4DaysAgo)).toBe("4d ago");
  });

  test("handles edge cases around time boundaries", () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    // Exactly 1 hour ago (should show minutes)
    const exactly1HourAgo = new Date("2024-12-24T11:00:00Z");
    expect(formatDistanceToNow(exactly1HourAgo)).toBe("1h ago");

    // Exactly 24 hours ago (should show hours)
    const exactly24HoursAgo = new Date("2024-12-23T12:00:00Z");
    expect(formatDistanceToNow(exactly24HoursAgo)).toBe("1d ago");

    // Exactly 7 days ago (should show date)
    const exactly7DaysAgo = new Date("2024-12-17T12:00:00Z");
    expect(formatDistanceToNow(exactly7DaysAgo)).toBe("Dec 17");
  });
});

describe("formatDate", () => {
  test("formats Date object correctly", () => {
    const date = new Date("2024-01-15T00:00:00Z");
    expect(formatDate(date)).toBe("Jan 15, 2024");
  });

  test("formats ISO string correctly", () => {
    const isoString = "2024-03-20T10:30:00Z";
    expect(formatDate(isoString)).toBe("Mar 20, 2024");
  });

  test("handles different months correctly", () => {
    expect(formatDate(new Date("2024-02-10T00:00:00Z"))).toBe("Feb 10, 2024");
    expect(formatDate(new Date("2024-12-25T00:00:00Z"))).toBe("Dec 25, 2024");
    expect(formatDate("2024-07-04T00:00:00Z")).toBe("Jul 4, 2024");
  });

  test("handles single-digit days correctly", () => {
    expect(formatDate(new Date("2024-01-05T00:00:00Z"))).toBe("Jan 5, 2024");
    expect(formatDate("2024-09-01T00:00:00Z")).toBe("Sep 1, 2024");
  });

  test("handles different years correctly", () => {
    expect(formatDate(new Date("2023-06-15T00:00:00Z"))).toBe("Jun 15, 2023");
    expect(formatDate("2025-11-30T00:00:00Z")).toBe("Nov 30, 2025");
  });

  test("handles month boundaries correctly", () => {
    expect(formatDate(new Date("2024-01-31T00:00:00Z"))).toBe("Jan 31, 2024");
    expect(formatDate(new Date("2024-02-29T00:00:00Z"))).toBe("Feb 29, 2024"); // Leap year
    expect(formatDate("2024-12-31T23:59:59Z")).toBe("Dec 31, 2024");
  });
});

describe("formatISODate", () => {
  test("formats YYYY-MM-DD to readable format", () => {
    expect(formatISODate("2024-01-15")).toBe("Jan 15, 2024");
    expect(formatISODate("2024-03-20")).toBe("Mar 20, 2024");
    expect(formatISODate("2024-12-25")).toBe("Dec 25, 2024");
  });

  test("handles different months correctly", () => {
    expect(formatISODate("2024-02-10")).toBe("Feb 10, 2024");
    expect(formatISODate("2024-05-01")).toBe("May 1, 2024");
    expect(formatISODate("2024-08-30")).toBe("Aug 30, 2024");
    expect(formatISODate("2024-11-05")).toBe("Nov 5, 2024");
  });

  test("handles single-digit months and days", () => {
    expect(formatISODate("2024-01-05")).toBe("Jan 5, 2024");
    expect(formatISODate("2024-09-01")).toBe("Sep 1, 2024");
  });

  test("handles different years", () => {
    expect(formatISODate("2023-06-15")).toBe("Jun 15, 2023");
    expect(formatISODate("2025-11-30")).toBe("Nov 30, 2025");
    expect(formatISODate("2022-03-10")).toBe("Mar 10, 2022");
  });

  test("handles month boundaries", () => {
    expect(formatISODate("2024-01-31")).toBe("Jan 31, 2024");
    expect(formatISODate("2024-02-29")).toBe("Feb 29, 2024"); // Leap year
    expect(formatISODate("2024-12-31")).toBe("Dec 31, 2024");
  });

  test("handles all 12 months", () => {
    expect(formatISODate("2024-01-01")).toBe("Jan 1, 2024");
    expect(formatISODate("2024-02-01")).toBe("Feb 1, 2024");
    expect(formatISODate("2024-03-01")).toBe("Mar 1, 2024");
    expect(formatISODate("2024-04-01")).toBe("Apr 1, 2024");
    expect(formatISODate("2024-05-01")).toBe("May 1, 2024");
    expect(formatISODate("2024-06-01")).toBe("Jun 1, 2024");
    expect(formatISODate("2024-07-01")).toBe("Jul 1, 2024");
    expect(formatISODate("2024-08-01")).toBe("Aug 1, 2024");
    expect(formatISODate("2024-09-01")).toBe("Sep 1, 2024");
    expect(formatISODate("2024-10-01")).toBe("Oct 1, 2024");
    expect(formatISODate("2024-11-01")).toBe("Nov 1, 2024");
    expect(formatISODate("2024-12-01")).toBe("Dec 1, 2024");
  });
});

// ============================================================================
// SAFE WRAPPERS TESTS
// ============================================================================

describe("safeFormatDistanceToNow", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test("returns formatted time for valid timestamp", () => {
    const now = new Date("2024-12-24T12:00:00Z");
    vi.setSystemTime(now);

    const timestamp5MinAgo = new Date("2024-12-24T11:55:00Z").getTime();
    expect(safeFormatDistanceToNow(timestamp5MinAgo)).toBe("5m ago");
  });

  test("returns fallback for undefined", () => {
    expect(safeFormatDistanceToNow(undefined)).toBe("Unknown time");
  });

  test("returns fallback for null", () => {
    expect(safeFormatDistanceToNow(null)).toBe("Unknown time");
  });

  test("returns fallback for NaN", () => {
    expect(safeFormatDistanceToNow(NaN)).toBe("Unknown time");
  });

  test("returns fallback for negative timestamp", () => {
    expect(safeFormatDistanceToNow(-1000)).toBe("Unknown time");
  });

  test("returns custom fallback when provided", () => {
    expect(safeFormatDistanceToNow(undefined, "N/A")).toBe("N/A");
  });
});

describe("formatShortDate", () => {
  test("formats ISO date to short format", () => {
    expect(formatShortDate("2024-12-28")).toBe("Dec 28");
    expect(formatShortDate("2024-01-05")).toBe("Jan 5");
    expect(formatShortDate("2024-07-15")).toBe("Jul 15");
  });

  test("handles month boundaries", () => {
    expect(formatShortDate("2024-02-29")).toBe("Feb 29");
    expect(formatShortDate("2024-12-31")).toBe("Dec 31");
    expect(formatShortDate("2024-01-01")).toBe("Jan 1");
  });
});

describe("safeFormatShortDate", () => {
  test("returns formatted date for valid ISO string", () => {
    expect(safeFormatShortDate("2024-12-28")).toBe("Dec 28");
  });

  test("returns fallback for undefined", () => {
    expect(safeFormatShortDate(undefined)).toBe("Unknown");
  });

  test("returns fallback for null", () => {
    expect(safeFormatShortDate(null)).toBe("Unknown");
  });

  test("returns fallback for empty string", () => {
    expect(safeFormatShortDate("")).toBe("Unknown");
  });

  test("returns fallback for invalid date format", () => {
    expect(safeFormatShortDate("not-a-date")).toBe("Unknown");
    expect(safeFormatShortDate("2024-13-45")).toBe("Unknown");
  });

  test("returns custom fallback when provided", () => {
    expect(safeFormatShortDate(undefined, "TBD")).toBe("TBD");
  });
});

describe("formatCountdown", () => {
  test("returns 'Today' for 0 days", () => {
    expect(formatCountdown(0)).toBe("Today");
  });

  test("returns '1 day' for 1 day (singular)", () => {
    expect(formatCountdown(1)).toBe("1 day");
  });

  test("returns 'X days' for 2+ days (plural)", () => {
    expect(formatCountdown(2)).toBe("2 days");
    expect(formatCountdown(5)).toBe("5 days");
    expect(formatCountdown(30)).toBe("30 days");
  });

  test("returns 'Overdue' for negative days", () => {
    expect(formatCountdown(-1)).toBe("Overdue");
    expect(formatCountdown(-10)).toBe("Overdue");
  });

  test("returns 'Overdue' for non-finite values", () => {
    expect(formatCountdown(NaN)).toBe("Overdue");
    expect(formatCountdown(Infinity)).toBe("Overdue");
  });
});
