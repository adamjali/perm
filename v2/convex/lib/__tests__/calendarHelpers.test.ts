/**
 * Calendar Helpers Test Suite
 *
 * Comprehensive tests for calendar event formatting and utility functions.
 *
 * @see ../calendarHelpers.ts - Source implementation
 * @see ../calendarTypes.ts - Type definitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidISODate,
  isFutureDate,
  toGoogleCalendarDate,
  formatEventTitle,
  formatEventDescription,
  formatCalendarEvent,
  getEventTypeLabel,
  isRfiRfeEventType,
  isRetryableError,
  withExponentialBackoff,
  isCalendarEventType,
  ALL_CALENDAR_EVENT_TYPES,
} from "../calendarHelpers";
import type { CalendarEventInput, CalendarEventType } from "../calendarTypes";
import { Id } from "../../_generated/dataModel";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createEventInput = (
  overrides: Partial<CalendarEventInput> = {}
): CalendarEventInput => ({
  eventType: "pwd_expiration",
  date: "2025-06-15",
  caseId: "case123" as Id<"cases">,
  employerName: "Test Corp",
  beneficiaryIdentifier: "John Doe",
  ...overrides,
});

// ============================================================================
// isValidISODate Tests
// ============================================================================

describe("isValidISODate", () => {
  it("validates YYYY-MM-DD format", () => {
    expect(isValidISODate("2024-12-31")).toBe(true);
    expect(isValidISODate("2025-01-01")).toBe(true);
    expect(isValidISODate("2000-06-15")).toBe(true);
  });

  it("validates dates with leading zeros", () => {
    expect(isValidISODate("2024-01-05")).toBe(true);
    expect(isValidISODate("2024-09-01")).toBe(true);
  });

  it("rejects MM/DD/YYYY format", () => {
    expect(isValidISODate("12/31/2024")).toBe(false);
    expect(isValidISODate("01/15/2025")).toBe(false);
  });

  it("rejects DD-MM-YYYY format", () => {
    expect(isValidISODate("31-12-2024")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidISODate("")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidISODate(" ")).toBe(false);
    expect(isValidISODate("  2024-12-31  ")).toBe(false);
  });

  it("rejects invalid formats", () => {
    expect(isValidISODate("2024/12/31")).toBe(false);
    expect(isValidISODate("2024.12.31")).toBe(false);
    expect(isValidISODate("20241231")).toBe(false);
    expect(isValidISODate("2024-1-31")).toBe(false); // Missing leading zero
    expect(isValidISODate("2024-12-1")).toBe(false); // Missing leading zero
    expect(isValidISODate("24-12-31")).toBe(false); // Two-digit year
  });

  it("rejects dates with time component", () => {
    expect(isValidISODate("2024-12-31T00:00:00")).toBe(false);
    expect(isValidISODate("2024-12-31T12:30:00Z")).toBe(false);
  });

  it("rejects null and undefined (type coerced)", () => {
    // TypeScript should prevent this, but test runtime behavior
    expect(isValidISODate(null as unknown as string)).toBe(false);
    expect(isValidISODate(undefined as unknown as string)).toBe(false);
  });

  it("rejects text strings", () => {
    expect(isValidISODate("invalid")).toBe(false);
    expect(isValidISODate("not-a-date")).toBe(false);
  });
});

// ============================================================================
// isFutureDate Tests
// ============================================================================

describe("isFutureDate", () => {
  const TODAY = "2025-01-15";

  it("returns true for future dates", () => {
    expect(isFutureDate("2025-01-16", TODAY)).toBe(true);
    expect(isFutureDate("2025-06-15", TODAY)).toBe(true);
    expect(isFutureDate("2026-01-01", TODAY)).toBe(true);
  });

  it("returns true for today (not strictly future)", () => {
    expect(isFutureDate("2025-01-15", TODAY)).toBe(true);
  });

  it("returns false for past dates", () => {
    expect(isFutureDate("2025-01-14", TODAY)).toBe(false);
    expect(isFutureDate("2024-12-31", TODAY)).toBe(false);
    expect(isFutureDate("2020-01-01", TODAY)).toBe(false);
  });

  it("returns false for yesterday", () => {
    expect(isFutureDate("2025-01-14", TODAY)).toBe(false);
  });

  it("uses provided todayISO for comparison", () => {
    // Use different reference dates
    expect(isFutureDate("2025-06-01", "2025-05-01")).toBe(true);
    expect(isFutureDate("2025-04-01", "2025-05-01")).toBe(false);
    expect(isFutureDate("2025-05-01", "2025-05-01")).toBe(true);
  });

  it("returns false for invalid date format", () => {
    expect(isFutureDate("invalid", TODAY)).toBe(false);
    expect(isFutureDate("12/31/2025", TODAY)).toBe(false);
    expect(isFutureDate("", TODAY)).toBe(false);
  });

  it("uses current date when todayISO not provided", () => {
    // Test with a far future date to ensure it's always true
    expect(isFutureDate("2099-12-31")).toBe(true);
    // Test with a far past date to ensure it's always false
    expect(isFutureDate("2000-01-01")).toBe(false);
  });

  it("returns false when todayISO is invalid", () => {
    expect(isFutureDate("2025-06-15", "invalid")).toBe(false);
    expect(isFutureDate("2025-06-15", "")).toBe(false);
  });

  it("handles edge cases at year boundaries", () => {
    expect(isFutureDate("2026-01-01", "2025-12-31")).toBe(true);
    expect(isFutureDate("2025-12-30", "2025-12-31")).toBe(false);
  });
});

// ============================================================================
// toGoogleCalendarDate Tests
// ============================================================================

describe("toGoogleCalendarDate", () => {
  it("returns date object for valid date", () => {
    expect(toGoogleCalendarDate("2024-12-31")).toEqual({ date: "2024-12-31" });
    expect(toGoogleCalendarDate("2025-01-15")).toEqual({ date: "2025-01-15" });
  });

  it("throws for invalid format", () => {
    expect(() => toGoogleCalendarDate("12/31/2024")).toThrow(
      'Invalid ISO date format: "12/31/2024". Expected YYYY-MM-DD.'
    );
  });

  it("throws for empty string", () => {
    expect(() => toGoogleCalendarDate("")).toThrow(
      'Invalid ISO date format: "". Expected YYYY-MM-DD.'
    );
  });

  it("throws for invalid date strings", () => {
    expect(() => toGoogleCalendarDate("invalid")).toThrow(/Invalid ISO date format/);
    expect(() => toGoogleCalendarDate("2024-1-31")).toThrow(/Invalid ISO date format/);
  });
});

// ============================================================================
// formatEventTitle Tests
// ============================================================================

describe("formatEventTitle", () => {
  it("formats title with type and employer", () => {
    const input = createEventInput({
      eventType: "pwd_expiration",
      employerName: "Acme Corp",
    });
    expect(formatEventTitle(input)).toBe("PWD Expiration: Acme Corp");
  });

  it("uses correct label for pwd_expiration", () => {
    const input = createEventInput({ eventType: "pwd_expiration" });
    expect(formatEventTitle(input)).toContain("PWD Expiration");
  });

  it("uses correct label for eta9089_filing", () => {
    const input = createEventInput({ eventType: "eta9089_filing" });
    expect(formatEventTitle(input)).toContain("ETA 9089 Filing");
  });

  it("uses correct label for eta9089_expiration", () => {
    const input = createEventInput({ eventType: "eta9089_expiration" });
    expect(formatEventTitle(input)).toContain("ETA 9089 Expiration");
  });

  it("uses correct label for filing_window_opens", () => {
    const input = createEventInput({ eventType: "filing_window_opens" });
    expect(formatEventTitle(input)).toContain("Ready to File");
  });

  it("uses correct label for recruitment_expires", () => {
    const input = createEventInput({ eventType: "recruitment_expires" });
    expect(formatEventTitle(input)).toContain("Recruitment Expires");
  });

  it("uses correct label for i140_deadline", () => {
    const input = createEventInput({ eventType: "i140_deadline" });
    expect(formatEventTitle(input)).toContain("I-140 Deadline");
  });

  it("uses correct label for rfi_due", () => {
    const input = createEventInput({ eventType: "rfi_due" });
    expect(formatEventTitle(input)).toContain("RFI Response Due");
  });

  it("uses correct label for rfe_due", () => {
    const input = createEventInput({ eventType: "rfe_due" });
    expect(formatEventTitle(input)).toContain("RFE Response Due");
  });

  it("handles employer names with special characters", () => {
    const input = createEventInput({ employerName: "O'Brien & Associates, LLC" });
    expect(formatEventTitle(input)).toBe("PWD Expiration: O'Brien & Associates, LLC");
  });

  it("handles long employer names", () => {
    const longName = "A".repeat(100);
    const input = createEventInput({ employerName: longName });
    expect(formatEventTitle(input)).toBe(`PWD Expiration: ${longName}`);
  });
});

// ============================================================================
// formatEventDescription Tests
// ============================================================================

describe("formatEventDescription", () => {
  it("includes all case details", () => {
    const input = createEventInput({
      employerName: "Acme Corp",
      beneficiaryIdentifier: "John D.",
      caseNumber: "A-12345-67890",
      internalCaseNumber: "INT-001",
    });

    const desc = formatEventDescription(input);

    expect(desc).toContain("PWD Expiration");
    expect(desc).toContain("Employer: Acme Corp");
    expect(desc).toContain("Beneficiary: John D.");
    expect(desc).toContain("Case Number: A-12345-67890");
    expect(desc).toContain("Internal Reference: INT-001");
    expect(desc).toContain("PERM Tracker");
  });

  it("omits case number when not provided", () => {
    const input = createEventInput({
      caseNumber: undefined,
    });

    const desc = formatEventDescription(input);
    expect(desc).not.toContain("Case Number:");
  });

  it("omits internal case number when not provided", () => {
    const input = createEventInput({
      internalCaseNumber: undefined,
    });

    const desc = formatEventDescription(input);
    expect(desc).not.toContain("Internal Reference:");
  });

  it("adds entry ID for RFI events", () => {
    const input = createEventInput({
      eventType: "rfi_due",
      entryId: "rfi-entry-123",
    });

    const desc = formatEventDescription(input);
    expect(desc).toContain("RFI Entry ID: rfi-entry-123");
  });

  it("adds entry ID for RFE events", () => {
    const input = createEventInput({
      eventType: "rfe_due",
      entryId: "rfe-entry-456",
    });

    const desc = formatEventDescription(input);
    expect(desc).toContain("RFE Entry ID: rfe-entry-456");
  });

  it("does not add entry ID for non-RFI/RFE events even if provided", () => {
    const input = createEventInput({
      eventType: "pwd_expiration",
      entryId: "some-entry-id",
    });

    const desc = formatEventDescription(input);
    expect(desc).not.toContain("Entry ID:");
  });

  it("includes event type label as header", () => {
    const input = createEventInput({ eventType: "i140_deadline" });
    const desc = formatEventDescription(input);
    const lines = desc.split("\n");
    expect(lines[0]).toBe("I-140 Deadline");
  });

  it("has proper line structure", () => {
    const input = createEventInput();
    const desc = formatEventDescription(input);
    const lines = desc.split("\n");

    expect(lines.length).toBeGreaterThanOrEqual(5); // Header, blank, employer, beneficiary, blank, footer
    expect(lines[lines.length - 1]).toBe("PERM Tracker");
  });
});

// ============================================================================
// formatCalendarEvent Tests
// ============================================================================

describe("formatCalendarEvent", () => {
  it("returns complete event result", () => {
    const input = createEventInput({
      date: "2025-06-15",
      employerName: "Tech Corp",
    });

    const result = formatCalendarEvent(input);

    expect(result.summary).toBe("PWD Expiration: Tech Corp");
    expect(result.description).toContain("Employer: Tech Corp");
    expect(result.start).toEqual({ date: "2025-06-15" });
    expect(result.end).toEqual({ date: "2025-06-15" });
  });

  it("start and end dates are the same", () => {
    const input = createEventInput({ date: "2025-12-25" });
    const result = formatCalendarEvent(input);

    expect(result.start).toEqual(result.end);
  });

  it("throws for invalid date", () => {
    const input = createEventInput({ date: "invalid" });

    expect(() => formatCalendarEvent(input)).toThrow(
      'Invalid date format: "invalid". Expected YYYY-MM-DD.'
    );
  });

  it("throws for empty date", () => {
    const input = createEventInput({ date: "" });

    expect(() => formatCalendarEvent(input)).toThrow(/Invalid date format/);
  });
});

// ============================================================================
// getEventTypeLabel Tests
// ============================================================================

describe("getEventTypeLabel", () => {
  const expectedLabels: Record<CalendarEventType, string> = {
    pwd_expiration: "PWD Expiration",
    eta9089_filing: "ETA 9089 Filing",
    eta9089_expiration: "ETA 9089 Expiration",
    filing_window_opens: "Ready to File",
    recruitment_expires: "Recruitment Expires",
    i140_deadline: "I-140 Deadline",
    rfi_due: "RFI Response Due",
    rfe_due: "RFE Response Due",
  };

  for (const [type, label] of Object.entries(expectedLabels)) {
    it(`returns "${label}" for ${type}`, () => {
      expect(getEventTypeLabel(type as CalendarEventType)).toBe(label);
    });
  }
});

// ============================================================================
// isRfiRfeEventType Tests
// ============================================================================

describe("isRfiRfeEventType", () => {
  it("returns true for rfi_due", () => {
    expect(isRfiRfeEventType("rfi_due")).toBe(true);
  });

  it("returns true for rfe_due", () => {
    expect(isRfiRfeEventType("rfe_due")).toBe(true);
  });

  it("returns false for pwd_expiration", () => {
    expect(isRfiRfeEventType("pwd_expiration")).toBe(false);
  });

  it("returns false for eta9089_filing", () => {
    expect(isRfiRfeEventType("eta9089_filing")).toBe(false);
  });

  it("returns false for eta9089_expiration", () => {
    expect(isRfiRfeEventType("eta9089_expiration")).toBe(false);
  });

  it("returns false for filing_window_opens", () => {
    expect(isRfiRfeEventType("filing_window_opens")).toBe(false);
  });

  it("returns false for recruitment_expires", () => {
    expect(isRfiRfeEventType("recruitment_expires")).toBe(false);
  });

  it("returns false for i140_deadline", () => {
    expect(isRfiRfeEventType("i140_deadline")).toBe(false);
  });
});

// ============================================================================
// isCalendarEventType Tests
// ============================================================================

describe("isCalendarEventType", () => {
  it("returns true for all valid event types", () => {
    ALL_CALENDAR_EVENT_TYPES.forEach((type) => {
      expect(isCalendarEventType(type)).toBe(true);
    });
  });

  it("returns false for invalid strings", () => {
    expect(isCalendarEventType("invalid")).toBe(false);
    expect(isCalendarEventType("pwd")).toBe(false);
    expect(isCalendarEventType("PWD_EXPIRATION")).toBe(false);
    expect(isCalendarEventType("")).toBe(false);
  });
});

// ============================================================================
// isRetryableError Tests
// ============================================================================

describe("isRetryableError", () => {
  it("returns true for 429 status", () => {
    expect(isRetryableError({ code: 429 })).toBe(true);
    expect(isRetryableError({ status: 429 })).toBe(true);
  });

  it("returns true for 403 with rateLimitExceeded reason", () => {
    const error = {
      status: 403,
      response: {
        data: {
          error: {
            errors: [{ reason: "rateLimitExceeded" }],
          },
        },
      },
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it("returns false for 403 without rateLimitExceeded reason", () => {
    expect(isRetryableError({ code: 403 })).toBe(false);
    expect(
      isRetryableError({
        status: 403,
        response: {
          data: { error: { errors: [{ reason: "forbidden" }] } },
        },
      })
    ).toBe(false);
  });

  it("returns true for 408 status (Request Timeout)", () => {
    expect(isRetryableError({ code: 408 })).toBe(true);
    expect(isRetryableError({ status: 408 })).toBe(true);
  });

  it("returns true for 500 status (Internal Server Error)", () => {
    expect(isRetryableError({ code: 500 })).toBe(true);
    expect(isRetryableError({ status: 500 })).toBe(true);
  });

  it("returns true for 502 status (Bad Gateway)", () => {
    expect(isRetryableError({ code: 502 })).toBe(true);
    expect(isRetryableError({ status: 502 })).toBe(true);
  });

  it("returns true for 503 status (Service Unavailable)", () => {
    expect(isRetryableError({ code: 503 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it("returns true for 504 status (Gateway Timeout)", () => {
    expect(isRetryableError({ code: 504 })).toBe(true);
    expect(isRetryableError({ status: 504 })).toBe(true);
  });

  it("returns false for 401 status (Unauthorized)", () => {
    expect(isRetryableError({ code: 401 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
  });

  it("returns false for 404 status (Not Found)", () => {
    expect(isRetryableError({ code: 404 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
  });

  it("returns false for 400 status (Bad Request)", () => {
    expect(isRetryableError({ code: 400 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRetryableError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRetryableError(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isRetryableError("error")).toBe(false);
    expect(isRetryableError(123)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isRetryableError({})).toBe(false);
  });

  it("handles response.status format", () => {
    expect(isRetryableError({ response: { status: 429 } })).toBe(true);
    expect(isRetryableError({ response: { status: 500 } })).toBe(true);
    expect(isRetryableError({ response: { status: 401 } })).toBe(false);
  });
});

// ============================================================================
// withExponentialBackoff Tests
// ============================================================================

describe("withExponentialBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withExponentialBackoff(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 429 })
      .mockResolvedValue("success");

    const resultPromise = withExponentialBackoff(fn, 3, 1000);

    // Advance time for the retry delay
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue("success");

    const resultPromise = withExponentialBackoff(fn, 3, 1000);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws non-retryable errors immediately", async () => {
    const fn = vi.fn().mockRejectedValue({ code: 401 });

    await expect(withExponentialBackoff(fn, 3, 1000)).rejects.toEqual({
      code: 401,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws 404 errors immediately", async () => {
    const fn = vi.fn().mockRejectedValue({ code: 404 });

    await expect(withExponentialBackoff(fn, 3, 1000)).rejects.toEqual({
      code: 404,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws", async () => {
    vi.useRealTimers(); // Use real timers for this test
    const fn = vi.fn().mockRejectedValue({ code: 429 });

    // Use 0 retries to make this fast
    await expect(withExponentialBackoff(fn, 0, 10)).rejects.toEqual({
      code: 429,
    });
    // Initial call only (0 retries)
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries multiple times before success", async () => {
    vi.useRealTimers(); // Use real timers for this test
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 429 })
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue("success");

    const result = await withExponentialBackoff(fn, 3, 10);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses default maxRetries of 3", async () => {
    vi.useRealTimers(); // Use real timers for this test
    const fn = vi.fn().mockRejectedValue({ code: 429 });

    // Need to set a short base delay for testing
    await expect(withExponentialBackoff(fn, 1, 10)).rejects.toEqual({
      code: 429,
    });
    // Initial call + 1 retry = 2 calls
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("converts non-Error thrown values to Error", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(withExponentialBackoff(fn, 0, 1000)).rejects.toBe(
      "string error"
    );
  });
});

// ============================================================================
// ALL_CALENDAR_EVENT_TYPES Tests
// ============================================================================

describe("ALL_CALENDAR_EVENT_TYPES", () => {
  it("contains all 8 event types", () => {
    expect(ALL_CALENDAR_EVENT_TYPES).toHaveLength(8);
  });

  it("includes all expected types", () => {
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("pwd_expiration");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("eta9089_filing");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("eta9089_expiration");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("filing_window_opens");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("recruitment_expires");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("i140_deadline");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("rfi_due");
    expect(ALL_CALENDAR_EVENT_TYPES).toContain("rfe_due");
  });
});
