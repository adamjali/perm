import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fmtISODate,
  fmtISOShort,
  fmtTimestamp,
  fmtCurrency,
  computeWindowStatus,
  STAGE_ACCENT_COLORS,
} from "../case-detail-utils";

// ============================================================================
// FORMATTERS
// ============================================================================

describe("fmtISODate", () => {
  it.each([
    ["2024-06-15", "Jun 15, 2024"],
    ["2025-01-01", "Jan 1, 2025"],
    ["2023-12-31", "Dec 31, 2023"],
  ])("formats %s as %s", (input, expected) => {
    expect(fmtISODate(input)).toBe(expected);
  });

  it.each([null, undefined, ""])("returns em-dash for %s", (input) => {
    expect(fmtISODate(input as string | null | undefined)).toBe("\u2014");
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
    expect(fmtISOShort(input as string | null | undefined)).toBe("\u2014");
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

// ============================================================================
// STAGE_ACCENT_COLORS
// ============================================================================

describe("STAGE_ACCENT_COLORS", () => {
  it("has all 5 stages", () => {
    expect(Object.keys(STAGE_ACCENT_COLORS)).toEqual([
      "pwd",
      "recruitment",
      "eta9089",
      "i140",
      "closed",
    ]);
  });

  it("uses CSS variables", () => {
    for (const value of Object.values(STAGE_ACCENT_COLORS)) {
      expect(value).toMatch(/^var\(--stage-/);
    }
  });
});

// ============================================================================
// computeWindowStatus
// ============================================================================

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

  it("returns 'Filed' when options.filed is true", () => {
    vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
    const result = computeWindowStatus("2025-01-01", "2025-06-30", {
      filed: true,
    });
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Filed");
    expect(result!.label).toBe("I-140 filed");
    expect(result!.pct).toBe(100);
    expect(result!.days).toBe(0);
  });

  it("handles zero-length window in the past", () => {
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
    // Start = end = past day => Expired, total = 0
    const result = computeWindowStatus("2025-01-01", "2025-01-01");
    expect(result).not.toBeNull();
    expect(result!.chip).toBe("Expired");
    expect(result!.pct).toBe(100);
  });
});
