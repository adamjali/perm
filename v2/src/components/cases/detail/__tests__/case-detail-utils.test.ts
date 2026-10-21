import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fmtISODate,
  fmtISOShort,
  fmtTimestamp,
  fmtCurrency,
  computeWindowStatus,
} from "../case-detail-utils";

// FORMATTERS

describe("fmtISODate", () => {
  it.each([
    ["2024-06-15", "Jun 15, 2024"],
    ["2025-01-01", "Jan 1, 2025"],
    ["2023-12-31", "Dec 31, 2023"],
  ])("formats %s as %s", (input, expected) => {
    expect(fmtISODate(input)).toBe(expected);
  });

  it.each([null, undefined, ""])("returns em-dash for %s", (input) => {
    expect(fmtISODate(input as string | null | undefined)).toBe("-");
  });

  it("returns raw string for invalid date", () => {
    expect(fmtISODate("not-a-date")).toBe("not-a-date");
  });
});

describe("fmtISOShort", () => {
  it.each([
    ["2024-06-15", "Jun 15"],
    ["2025-01-01", "Jan 1"],
  ])("formats %s as %s", (input, expected) => {
    expect(fmtISOShort(input)).toBe(expected);
  });

  it.each([null, undefined, ""])("returns em-dash for %s", (input) => {
    expect(fmtISOShort(input as string | null | undefined)).toBe("-");
  });

  it("returns raw string for invalid date", () => {
    expect(fmtISOShort("garbage")).toBe("garbage");
  });
});

describe("fmtTimestamp", () => {
  it("formats a timestamp", () => {
    // Jan 15, 2025 in UTC
    const ts = new Date("2025-01-15T12:00:00Z").getTime();
    const result = fmtTimestamp(ts);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });
});

describe("fmtCurrency", () => {
  it.each([
    [50000, "$50,000"],
    [0, "$0"],
    [1234567, "$1,234,567"],
    ["75000", "$75,000"],
  ])("formats %s as %s", (input, expected) => {
    expect(fmtCurrency(input)).toBe(expected);
  });

  it("handles negative values", () => {
    expect(fmtCurrency(-1000)).toBe("-$1,000");
  });
});

// computeWindowStatus

describe("computeWindowStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for null/undefined dates", () => {
    expect(computeWindowStatus(null, null)).toBeNull();
    expect(computeWindowStatus(undefined, "2025-01-01")).toBeNull();
    expect(computeWindowStatus("2025-01-01", undefined)).toBeNull();
  });

  it("returns 'Upcoming' when now is before window start", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const result = computeWindowStatus("2025-02-01", "2025-08-01");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Upcoming");
    expect(result!.label).toBe("until window opens");
    expect(result!.pct).toBe(0);
    expect(result!.days).toBeGreaterThanOrEqual(30);
    expect(result!.days).toBeLessThanOrEqual(31);
  });

  it("returns 'Active' when inside the window", () => {
    vi.setSystemTime(new Date("2025-03-15T00:00:00Z"));
    const result = computeWindowStatus("2025-01-01", "2025-06-30");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Active");
    expect(result!.label).toBe("remaining in window");
    expect(result!.days).toBeGreaterThan(100);
    expect(result!.days).toBeLessThan(110);
    expect(result!.pct).toBeGreaterThan(0);
    expect(result!.pct).toBeLessThan(100);
  });

  it("returns 'Expired' when past the window end", () => {
    vi.setSystemTime(new Date("2025-09-01T00:00:00Z"));
    const result = computeWindowStatus("2025-01-01", "2025-06-30");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Expired");
    expect(result!.label).toBe("past expiration");
    expect(result!.pct).toBe(100);
    expect(result!.days).toBeGreaterThan(60);
    expect(result!.days).toBeLessThan(65);
  });

  it("returns 'Filed' when options.filed is true, with what was filed and no day count", () => {
    vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
    const result = computeWindowStatus("2025-01-01", "2025-06-30", {
      filed: true,
      filedLabel: "I-140 filed Mar 1, 2025",
    });
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Filed");
    expect(result!.label).toBe("I-140 filed Mar 1, 2025");
    expect(result!.pct).toBe(100);
    expect(result!.days).toBeNull();
  });

  it("never reads 'Expired' for a window whose filing is in, however long ago it closed", () => {
    // A case that filed its ETA 9089 inside the window had shown a red
    // "Expired, 82 days past expiration" on its own page (Oct 21 2026).
    vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
    const result = computeWindowStatus("2026-03-15", "2026-07-11", { filed: true, filedLabel: "ETA 9089 filed Apr 2, 2026" });
    expect(result!.chip).toBe("Filed");
    expect(result!.label).toBe("ETA 9089 filed Apr 2, 2026");
  });

  it("reads 'Begun' past the PWD's end when recruitment began inside it, and counts days while it runs", () => {
    vi.setSystemTime(new Date("2025-09-01T00:00:00Z"));
    const past = computeWindowStatus("2025-01-01", "2025-06-30", { begunInside: true });
    expect(past!.chip).toBe("Begun");
    expect(past!.days).toBeNull();
    vi.setSystemTime(new Date("2025-03-15T00:00:00Z"));
    const running = computeWindowStatus("2025-01-01", "2025-06-30", { begunInside: true });
    expect(running!.chip).toBe("Active");
    expect(running!.days).toBeGreaterThan(100);
  });

  it("handles zero-length window in the past", () => {
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
    // Start = end = past day => Expired, total = 0
    const result = computeWindowStatus("2025-01-01", "2025-01-01");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Expired");
    expect(result!.pct).toBe(100);
  });

  it("handles zero-length window on current day (expired by noon)", () => {
    // parseISO creates midnight local; by noon the zero-length window is past
    vi.setSystemTime(new Date("2025-03-15T12:00:00"));
    const result = computeWindowStatus("2025-03-15", "2025-03-15");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Expired");
    expect(result!.pct).toBe(100);
  });
});
