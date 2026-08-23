import { describe, it, expect } from "vitest";
import {
  formatMonth,
  formatAsOf,
  formatCount,
  monthsMoved,
  daysBetween,
  daysAsApproxMonths,
} from "../dolFormat";

describe("formatMonth", () => {
  it("renders DOL's month keys", () => {
    expect(formatMonth("2025-09")).toBe("September 2025");
    expect(formatMonth("2026-01")).toBe("January 2026");
    expect(formatMonth("2026-12")).toBe("December 2026");
  });

  it("returns null rather than inventing a month", () => {
    // The page must be able to say "DOL did not publish one" instead of
    // rendering a plausible-looking date nobody published.
    for (const bad of [null, undefined, "", "--", "2026", "2026-13", "Sept 2025"]) {
      expect(formatMonth(bad as string | null)).toBeNull();
    }
  });

  it("rejects a month index out of range instead of wrapping", () => {
    expect(formatMonth("2026-00")).toBeNull();
    expect(formatMonth("2026-99")).toBeNull();
  });
});

describe("formatAsOf", () => {
  it("renders DOL's as-of stamps", () => {
    expect(formatAsOf("2026-08-20")).toBe("August 20, 2026");
    expect(formatAsOf("2026-06-30")).toBe("June 30, 2026");
  });

  it("drops a leading zero on the day", () => {
    expect(formatAsOf("2026-08-05")).toBe("August 5, 2026");
  });

  it("returns null on anything that is not a full date", () => {
    expect(formatAsOf("2026-08")).toBeNull();
    expect(formatAsOf(null)).toBeNull();
  });
});

describe("monthsMoved", () => {
  it("measures forward movement", () => {
    expect(monthsMoved("2025-06", "2025-09")).toBe(3);
    expect(monthsMoved("2025-11", "2026-02")).toBe(3);
    expect(monthsMoved("2025-09", "2025-09")).toBe(0);
  });

  it("reports a backwards move rather than clamping it", () => {
    // DOL has revised a frontier backwards before. Silently flooring at zero
    // would hide that; the page should be able to show what actually happened.
    expect(monthsMoved("2025-09", "2025-06")).toBe(-3);
  });

  it("returns null when either end is missing", () => {
    expect(monthsMoved(null, "2025-09")).toBeNull();
    expect(monthsMoved("2025-09", null)).toBeNull();
    expect(monthsMoved("garbage", "2025-09")).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-08-01", "2026-08-20")).toBe(19);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("is timezone-stable", () => {
    // Parsed as UTC on both ends, so a machine in New York and one in UTC
    // agree. The suite pins TZ to America/New_York precisely to catch this.
    expect(daysBetween("2026-03-08", "2026-03-09")).toBe(1);
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
  });

  it("returns null on unparseable input", () => {
    expect(daysBetween("nope", "2026-08-20")).toBeNull();
  });
});

describe("daysAsApproxMonths", () => {
  it("reads DOL's average as months without implying false precision", () => {
    expect(daysAsApproxMonths(372)).toBe("about 12 months");
    expect(daysAsApproxMonths(501)).toBe("about 16 months");
  });

  it("keeps the singular grammatical", () => {
    expect(daysAsApproxMonths(30)).toBe("about 1 month");
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(14386)).toBe("14,386");
    expect(formatCount(11)).toBe("11");
    expect(formatCount(0)).toBe("0");
  });
});

// Guards added after a review found each of these rendered onto a public page
// or silently removed a section, with nothing erroring in either case.
describe("null and nonsense guards", () => {
  it("daysBetween refuses a month where a date is wanted", () => {
    // "2025-09" compiled fine against the old `string` signature and produced
    // NaN, so the velocity section just vanished with nothing to debug.
    expect(daysBetween("2025-09", "2026-08-20")).toBeNull();
    expect(daysBetween(null, "2026-08-20")).toBeNull();
    expect(daysBetween("2026-08-20", undefined)).toBeNull();
  });

  it("daysAsApproxMonths never renders NaN or a negative", () => {
    expect(daysAsApproxMonths(null)).toBeNull();
    expect(daysAsApproxMonths(undefined)).toBeNull();
    expect(daysAsApproxMonths(Number.NaN)).toBeNull();
    expect(daysAsApproxMonths(-30)).toBeNull();
  });

  it("formatCount passes null through instead of printing it", () => {
    expect(formatCount(null)).toBeNull();
    expect(formatCount(undefined)).toBeNull();
    expect(formatCount(Number.NaN)).toBeNull();
  });
});
