import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEADLINE_TIMEZONE_RULES,
  ENFORCEMENT_TIMEZONE_RULES,
  DOL_TIMEZONE,
  getEffectiveTimezone,
  getTodayInTimezone,
  getTodayForDeadline,
  getTimezoneDisplayLabel,
} from "./timezones";
import type { DeadlineType } from "./types";

// CONSTANTS

describe("DEADLINE_TIMEZONE_RULES", () => {
  it("has a rule for every deadline type", () => {
    const allTypes: DeadlineType[] = [
      "pwd_expiration",
      "filing_window_opens",
      "filing_window_closes",
      "recruitment_window_closes",
      "i140_filing_deadline",
      "rfi_due",
      "rfe_due",
    ];

    for (const type of allTypes) {
      expect(DEADLINE_TIMEZONE_RULES[type]).toBeDefined();
      expect(["local", "dol"]).toContain(DEADLINE_TIMEZONE_RULES[type]);
    }
  });

  it("maps DOL-filed deadlines to dol timezone", () => {
    expect(DEADLINE_TIMEZONE_RULES.filing_window_closes).toBe("dol");
    expect(DEADLINE_TIMEZONE_RULES.rfi_due).toBe("dol");
  });

  it("maps local deadlines to local timezone", () => {
    expect(DEADLINE_TIMEZONE_RULES.pwd_expiration).toBe("local");
    expect(DEADLINE_TIMEZONE_RULES.filing_window_opens).toBe("local");
    expect(DEADLINE_TIMEZONE_RULES.recruitment_window_closes).toBe("local");
    expect(DEADLINE_TIMEZONE_RULES.i140_filing_deadline).toBe("local");
    expect(DEADLINE_TIMEZONE_RULES.rfe_due).toBe("local");
  });
});

describe("ENFORCEMENT_TIMEZONE_RULES", () => {
  it("maps filing_window_missed to dol", () => {
    expect(ENFORCEMENT_TIMEZONE_RULES.filing_window_missed).toBe("dol");
  });

  it("maps other violations to local", () => {
    expect(ENFORCEMENT_TIMEZONE_RULES.pwd_expired).toBe("local");
    expect(ENFORCEMENT_TIMEZONE_RULES.recruitment_window_missed).toBe("local");
    expect(ENFORCEMENT_TIMEZONE_RULES.eta9089_expired).toBe("local");
  });
});

describe("DOL_TIMEZONE", () => {
  it("is Eastern Time", () => {
    expect(DOL_TIMEZONE).toBe("America/New_York");
  });
});

// HELPER FUNCTIONS

describe("getEffectiveTimezone", () => {
  it("returns DOL timezone for 'dol' rule", () => {
    expect(getEffectiveTimezone("dol", "America/Los_Angeles")).toBe(
      "America/New_York"
    );
  });

  it("returns user timezone for 'local' rule", () => {
    expect(getEffectiveTimezone("local", "America/Los_Angeles")).toBe(
      "America/Los_Angeles"
    );
  });

  it("returns user timezone for 'local' rule with various timezones", () => {
    expect(getEffectiveTimezone("local", "America/Chicago")).toBe(
      "America/Chicago"
    );
    expect(getEffectiveTimezone("local", "Pacific/Honolulu")).toBe(
      "Pacific/Honolulu"
    );
    expect(getEffectiveTimezone("local", "Europe/London")).toBe(
      "Europe/London"
    );
  });
});

describe("getTodayInTimezone", () => {
  it("returns a valid ISO date string", () => {
    const result = getTodayInTimezone("America/New_York");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns valid date for various timezones", () => {
    const timezones = [
      "America/New_York",
      "America/Los_Angeles",
      "America/Chicago",
      "Pacific/Honolulu",
      "UTC",
    ];

    for (const tz of timezones) {
      const result = getTodayInTimezone(tz);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("falls back to UTC for invalid timezone", () => {
    const result = getTodayInTimezone("Invalid/Timezone");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("can return different dates for different timezones near midnight", () => {
    // Mock time to 11:30 PM Pacific (7:30 AM UTC next day)
    const mockDate = new Date("2025-06-30T06:30:00Z"); // 11:30 PM PT Jun 29 / 2:30 AM ET Jun 30
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const pacificDate = getTodayInTimezone("America/Los_Angeles");
    const easternDate = getTodayInTimezone("America/New_York");
    const utcDate = getTodayInTimezone("UTC");

    // At 6:30 AM UTC on June 30:
    // Pacific = 11:30 PM June 29 → "2025-06-29"
    // Eastern = 2:30 AM June 30 → "2025-06-30"
    // UTC = 6:30 AM June 30 → "2025-06-30"
    expect(pacificDate).toBe("2025-06-29");
    expect(easternDate).toBe("2025-06-30");
    expect(utcDate).toBe("2025-06-30");

    vi.useRealTimers();
  });
});

describe("getTodayForDeadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses DOL timezone for filing_window_closes", () => {
    // Mock: 11 PM Pacific = 2 AM ET next day
    const mockDate = new Date("2025-07-01T06:00:00Z"); // 11 PM PT Jun 30 / 2 AM ET Jul 1
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const result = getTodayForDeadline(
      "filing_window_closes",
      "America/Los_Angeles"
    );
    // DOL timezone (ET) = July 1
    expect(result).toBe("2025-07-01");
  });

  it("uses user timezone for pwd_expiration", () => {
    // Mock: 11 PM Pacific = 2 AM ET next day
    const mockDate = new Date("2025-07-01T06:00:00Z"); // 11 PM PT Jun 30 / 2 AM ET Jul 1
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const result = getTodayForDeadline(
      "pwd_expiration",
      "America/Los_Angeles"
    );
    // User timezone (PT) = still June 30
    expect(result).toBe("2025-06-30");
  });

  it("uses DOL timezone for rfi_due regardless of user timezone", () => {
    const mockDate = new Date("2025-07-01T06:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const ptResult = getTodayForDeadline("rfi_due", "America/Los_Angeles");
    const ctResult = getTodayForDeadline("rfi_due", "America/Chicago");
    const etResult = getTodayForDeadline("rfi_due", "America/New_York");

    // All should return the same date (DOL = ET)
    expect(ptResult).toBe(etResult);
    expect(ctResult).toBe(etResult);
    expect(etResult).toBe("2025-07-01");
  });
});

describe("getTimezoneDisplayLabel", () => {
  it("returns ET label for dol rule", () => {
    expect(getTimezoneDisplayLabel("dol")).toBe("11:59 PM ET");
  });

  it("returns local label for local rule", () => {
    expect(getTimezoneDisplayLabel("local")).toBe("11:59 PM your time");
  });
});

// INTEGRATION: timezone rules + extractActiveDeadlines

describe("timezone rule integration", () => {
  it("filing_window_closes and rfi_due are the only DOL deadlines", () => {
    const dolDeadlines = Object.entries(DEADLINE_TIMEZONE_RULES)
      .filter(([, rule]) => rule === "dol")
      .map(([type]) => type);

    expect(dolDeadlines).toHaveLength(2);
    expect(dolDeadlines).toContain("filing_window_closes");
    expect(dolDeadlines).toContain("rfi_due");
  });

  it("filing_window_missed is the only DOL enforcement violation", () => {
    const dolViolations = Object.entries(ENFORCEMENT_TIMEZONE_RULES)
      .filter(([, rule]) => rule === "dol")
      .map(([type]) => type);

    expect(dolViolations).toHaveLength(1);
    expect(dolViolations).toContain("filing_window_missed");
  });
});
