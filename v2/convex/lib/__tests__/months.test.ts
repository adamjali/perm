import { describe, expect, it } from "vitest";

import { MONTH_ABBR, MONTH_NAMES, longDate, monthYear, shortDate } from "../months";

describe("the shared month names and date labels", () => {
  it("has twelve months, and the short forms are the long ones cut to three", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_ABBR).toEqual(MONTH_NAMES.map((m) => m.slice(0, 3)));
  });

  it("writes a date the way DOL's own pages do, whatever the reader's time zone", () => {
    expect(longDate("2026-09-01")).toBe("September 1, 2026");
    expect(longDate("2026-12-31T23:59:00")).toBe("December 31, 2026");
    expect(shortDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(monthYear("2025-11")).toBe("November 2025");
  });

  it("answers null for anything that isn't a date, so a caller chooses what shows", () => {
    for (const bad of ["", null, undefined, "2026-13-01", "next week", "2026/09/01"]) {
      expect(longDate(bad)).toBeNull();
      expect(shortDate(bad)).toBeNull();
    }
    expect(monthYear("2026-00")).toBeNull();
    expect(monthYear("2026-09-01")).toBeNull();
  });
});
