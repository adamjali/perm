/**
 * Calendar Event Extractor Test Suite
 *
 * Comprehensive tests for extracting calendar events from case data.
 *
 * @see ../calendarEventExtractor.ts - Source implementation
 * @see ../calendarTypes.ts - Type definitions
 */

import { describe, it, expect } from "vitest";
import {
  extractCalendarEvents,
  getDefaultCalendarPreferences,
} from "../calendarEventExtractor";
import type {
  CaseDataForCalendar,
  UserCalendarPreferences,
  CalendarRfiEntry,
  CalendarRfeEntry,
} from "../calendarTypes";
import { Id } from "../../_generated/dataModel";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TODAY_ISO = "2025-01-15";

/**
 * Helper to create a future date string N days from TODAY_ISO.
 */
function futureDate(daysFromToday: number = 30): string {
  const date = new Date(TODAY_ISO);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split("T")[0]!;
}

/**
 * Helper to create a past date string N days before TODAY_ISO.
 */
function pastDate(daysAgo: number = 30): string {
  const date = new Date(TODAY_ISO);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0]!;
}

const createBaseCase = (
  overrides: Partial<CaseDataForCalendar> = {}
): CaseDataForCalendar => ({
  _id: "case123" as Id<"cases">,
  employerName: "Test Corp",
  beneficiaryIdentifier: "John Doe",
  caseStatus: "recruitment",
  progressStatus: "in_progress",
  calendarSyncEnabled: true,
  ...overrides,
});

const createAllPreferencesEnabled = (): UserCalendarPreferences => ({
  calendarSyncEnabled: true,
  calendarSyncPwd: true,
  calendarSyncEta9089: true,
  calendarSyncI140: true,
  calendarSyncRfi: true,
  calendarSyncRfe: true,
  calendarSyncRecruitment: true,
  calendarSyncFilingWindow: true,
});

const createAllPreferencesDisabled = (): UserCalendarPreferences => ({
  calendarSyncEnabled: false,
  calendarSyncPwd: false,
  calendarSyncEta9089: false,
  calendarSyncI140: false,
  calendarSyncRfi: false,
  calendarSyncRfe: false,
  calendarSyncRecruitment: false,
  calendarSyncFilingWindow: false,
});

// ============================================================================
// extractCalendarEvents Tests - Basic Functionality
// ============================================================================

describe("extractCalendarEvents", () => {
  describe("PWD Expiration Events", () => {
    it("extracts PWD expiration when enabled", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.eventType).toBe("pwd_expiration");
      expect(result.events[0]!.date).toBe(futureDate(60));
    });

    it("skips past PWD dates", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: pastDate(10), // Past date
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedPastDates).toContain("pwd_expiration");
    });

    it("skips PWD when preference disabled", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncPwd = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedByPreference).toContain("pwd_expiration");
    });

    it("skips PWD when missing", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: undefined,
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedMissingData).toContain("pwd_expiration");
    });
  });

  describe("ETA 9089 Events", () => {
    it("extracts ETA 9089 filing date when not yet certified", () => {
      const caseData = createBaseCase({
        eta9089FilingDate: futureDate(30),
        eta9089CertificationDate: undefined, // Not yet certified
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "eta9089_filing")).toBeDefined();
    });

    it("skips ETA 9089 filing date when already certified", () => {
      const caseData = createBaseCase({
        eta9089FilingDate: pastDate(30),
        eta9089CertificationDate: pastDate(10), // Already certified
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "eta9089_filing")).toBeUndefined();
    });

    it("extracts ETA 9089 expiration date", () => {
      const caseData = createBaseCase({
        eta9089ExpirationDate: futureDate(90),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "eta9089_expiration");
      expect(event).toBeDefined();
      expect(event!.date).toBe(futureDate(90));
    });

    it("skips ETA 9089 when preference disabled", () => {
      const caseData = createBaseCase({
        eta9089ExpirationDate: futureDate(90),
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncEta9089 = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "eta9089_expiration")).toBeUndefined();
    });
  });

  describe("Filing Window Events", () => {
    it("extracts filing window opens date", () => {
      const caseData = createBaseCase({
        filingWindowOpens: futureDate(45),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "filing_window_opens");
      expect(event).toBeDefined();
      expect(event!.date).toBe(futureDate(45));
    });

    it("skips filing window when preference disabled", () => {
      const caseData = createBaseCase({
        filingWindowOpens: futureDate(45),
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncFilingWindow = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.skippedByPreference).toContain("filing_window_opens");
    });
  });

  describe("Recruitment Events", () => {
    it("extracts recruitment window closes date", () => {
      const caseData = createBaseCase({
        recruitmentWindowCloses: futureDate(120),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "recruitment_expires");
      expect(event).toBeDefined();
      expect(event!.date).toBe(futureDate(120));
    });

    it("skips recruitment when preference disabled", () => {
      const caseData = createBaseCase({
        recruitmentWindowCloses: futureDate(120),
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncRecruitment = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.skippedByPreference).toContain("recruitment_expires");
    });
  });

  describe("I-140 Deadline Events", () => {
    it("calculates I-140 deadline from certification date", () => {
      const certDate = pastDate(10); // Certified 10 days ago
      const caseData = createBaseCase({
        eta9089CertificationDate: certDate,
        i140FilingDate: undefined, // Not yet filed
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "i140_deadline");
      expect(event).toBeDefined();
      // I-140 deadline is 180 days from certification
      // certDate is 10 days ago, so deadline is 170 days from today
    });

    it("skips I-140 when already filed", () => {
      const caseData = createBaseCase({
        eta9089CertificationDate: pastDate(30),
        i140FilingDate: pastDate(5), // Already filed
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "i140_deadline")).toBeUndefined();
    });

    it("skips I-140 when no certification date", () => {
      const caseData = createBaseCase({
        eta9089CertificationDate: undefined,
        i140FilingDate: undefined,
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "i140_deadline")).toBeUndefined();
    });

    it("skips I-140 when preference disabled", () => {
      const caseData = createBaseCase({
        eta9089CertificationDate: pastDate(10),
        i140FilingDate: undefined,
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncI140 = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.skippedByPreference).toContain("i140_deadline");
    });
  });

  describe("RFI Due Date Events", () => {
    it("extracts RFI due dates only when unresolved", () => {
      const rfiEntry: CalendarRfiEntry = {
        id: "rfi-1",
        receivedDate: pastDate(10),
        responseDueDate: futureDate(20),
        responseSubmittedDate: undefined, // Unresolved
      };
      const caseData = createBaseCase({
        rfiEntries: [rfiEntry],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "rfi_due");
      expect(event).toBeDefined();
      expect(event!.entryId).toBe("rfi-1");
      expect(event!.date).toBe(futureDate(20));
    });

    it("skips resolved RFI entries", () => {
      const rfiEntry: CalendarRfiEntry = {
        id: "rfi-1",
        receivedDate: pastDate(30),
        responseDueDate: futureDate(20),
        responseSubmittedDate: pastDate(5), // Resolved
      };
      const caseData = createBaseCase({
        rfiEntries: [rfiEntry],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "rfi_due")).toBeUndefined();
    });

    it("extracts multiple unresolved RFI entries", () => {
      const rfiEntries: CalendarRfiEntry[] = [
        {
          id: "rfi-1",
          receivedDate: pastDate(30),
          responseDueDate: futureDate(10),
          responseSubmittedDate: undefined,
        },
        {
          id: "rfi-2",
          receivedDate: pastDate(20),
          responseDueDate: futureDate(20),
          responseSubmittedDate: undefined,
        },
      ];
      const caseData = createBaseCase({
        rfiEntries,
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const rfiEvents = result.events.filter((e) => e.eventType === "rfi_due");
      expect(rfiEvents).toHaveLength(2);
    });

    it("skips RFI when preference disabled", () => {
      const rfiEntry: CalendarRfiEntry = {
        id: "rfi-1",
        receivedDate: pastDate(10),
        responseDueDate: futureDate(20),
        responseSubmittedDate: undefined,
      };
      const caseData = createBaseCase({
        rfiEntries: [rfiEntry],
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncRfi = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "rfi_due")).toBeUndefined();
    });
  });

  describe("RFE Due Date Events", () => {
    it("extracts RFE due dates only when unresolved", () => {
      const rfeEntry: CalendarRfeEntry = {
        id: "rfe-1",
        receivedDate: pastDate(10),
        responseDueDate: futureDate(20),
        responseSubmittedDate: undefined, // Unresolved
      };
      const caseData = createBaseCase({
        rfeEntries: [rfeEntry],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      const event = result.events.find((e) => e.eventType === "rfe_due");
      expect(event).toBeDefined();
      expect(event!.entryId).toBe("rfe-1");
      expect(event!.date).toBe(futureDate(20));
    });

    it("skips resolved RFE entries", () => {
      const rfeEntry: CalendarRfeEntry = {
        id: "rfe-1",
        receivedDate: pastDate(30),
        responseDueDate: futureDate(20),
        responseSubmittedDate: pastDate(5), // Resolved
      };
      const caseData = createBaseCase({
        rfeEntries: [rfeEntry],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "rfe_due")).toBeUndefined();
    });

    it("skips RFE when preference disabled", () => {
      const rfeEntry: CalendarRfeEntry = {
        id: "rfe-1",
        receivedDate: pastDate(10),
        responseDueDate: futureDate(20),
        responseSubmittedDate: undefined,
      };
      const caseData = createBaseCase({
        rfeEntries: [rfeEntry],
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncRfe = false;

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.find((e) => e.eventType === "rfe_due")).toBeUndefined();
    });
  });

  describe("All Event Types Extraction", () => {
    it("extracts all 8 event types when data is available", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(180),
        eta9089FilingDate: futureDate(60),
        eta9089ExpirationDate: futureDate(200),
        filingWindowOpens: futureDate(45),
        recruitmentWindowCloses: futureDate(120),
        eta9089CertificationDate: pastDate(10), // Triggers I-140 calculation
        i140FilingDate: undefined,
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: pastDate(5),
            responseDueDate: futureDate(25),
            responseSubmittedDate: undefined,
          },
        ],
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: pastDate(3),
            responseDueDate: futureDate(27),
            responseSubmittedDate: undefined,
          },
        ],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      // Should have: pwd_expiration, eta9089_expiration, filing_window_opens,
      // recruitment_expires, i140_deadline, rfi_due, rfe_due
      // Note: eta9089_filing is skipped because we have certification date
      expect(result.events.length).toBeGreaterThanOrEqual(7);

      const eventTypes = result.events.map((e) => e.eventType);
      expect(eventTypes).toContain("pwd_expiration");
      expect(eventTypes).toContain("eta9089_expiration");
      expect(eventTypes).toContain("filing_window_opens");
      expect(eventTypes).toContain("recruitment_expires");
      expect(eventTypes).toContain("i140_deadline");
      expect(eventTypes).toContain("rfi_due");
      expect(eventTypes).toContain("rfe_due");
    });
  });

  describe("Preference Toggles", () => {
    it("respects preference toggles - all disabled", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(60),
        eta9089ExpirationDate: futureDate(90),
        filingWindowOpens: futureDate(45),
        recruitmentWindowCloses: futureDate(120),
        eta9089CertificationDate: pastDate(10),
      });
      const prefs = createAllPreferencesDisabled();
      prefs.calendarSyncEnabled = true; // Master switch on, individual toggles off

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedByPreference.length).toBeGreaterThan(0);
    });

    it("master switch disables all events", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(60),
        eta9089ExpirationDate: futureDate(90),
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncEnabled = false; // Master switch off

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
    });
  });

  describe("Case-Level Controls", () => {
    it("skips closed cases", () => {
      const caseData = createBaseCase({
        caseStatus: "closed",
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedMissingData.length).toBeGreaterThan(0);
    });

    it("skips deleted cases", () => {
      const caseData = createBaseCase({
        deletedAt: Date.now(),
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
    });

    it("skips cases with calendarSyncEnabled=false", () => {
      const caseData = createBaseCase({
        calendarSyncEnabled: false,
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
      expect(result.skippedByPreference.length).toBeGreaterThan(0);
    });
  });

  describe("Event Input Data", () => {
    it("includes case details in event input", () => {
      const caseData = createBaseCase({
        _id: "case-abc" as Id<"cases">,
        employerName: "Acme Corp",
        beneficiaryIdentifier: "Jane D.",
        caseNumber: "A-123-456",
        internalCaseNumber: "INT-001",
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(1);
      const event = result.events[0]!;
      expect(event.caseId).toBe("case-abc");
      expect(event.employerName).toBe("Acme Corp");
      expect(event.beneficiaryIdentifier).toBe("Jane D.");
      expect(event.caseNumber).toBe("A-123-456");
      expect(event.internalCaseNumber).toBe("INT-001");
    });
  });

  describe("Edge Cases", () => {
    it("handles case with no dates", () => {
      const caseData = createBaseCase();
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(0);
    });

    it("handles empty RFI entries array", () => {
      const caseData = createBaseCase({
        rfiEntries: [],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.filter((e) => e.eventType === "rfi_due")).toHaveLength(0);
    });

    it("handles empty RFE entries array", () => {
      const caseData = createBaseCase({
        rfeEntries: [],
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events.filter((e) => e.eventType === "rfe_due")).toHaveLength(0);
    });

    it("uses current date when todayISO not provided", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: "2099-12-31", // Far future
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs);

      expect(result.events).toHaveLength(1);
    });

    it("includes today in future dates", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: TODAY_ISO, // Today
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.date).toBe(TODAY_ISO);
    });
  });

  describe("Result Structure", () => {
    it("returns correct structure with all fields", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: futureDate(60),
      });
      const prefs = createAllPreferencesEnabled();

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("skippedByPreference");
      expect(result).toHaveProperty("skippedPastDates");
      expect(result).toHaveProperty("skippedMissingData");
      expect(Array.isArray(result.events)).toBe(true);
      expect(Array.isArray(result.skippedByPreference)).toBe(true);
      expect(Array.isArray(result.skippedPastDates)).toBe(true);
      expect(Array.isArray(result.skippedMissingData)).toBe(true);
    });

    it("categorizes skipped events correctly", () => {
      const caseData = createBaseCase({
        pwdExpirationDate: pastDate(10), // Past - skipped
        eta9089ExpirationDate: undefined, // Missing - skipped
        filingWindowOpens: futureDate(45), // Will be extracted
      });
      const prefs = createAllPreferencesEnabled();
      prefs.calendarSyncRecruitment = false; // Disabled - skipped

      const result = extractCalendarEvents(caseData, prefs, TODAY_ISO);

      expect(result.skippedPastDates).toContain("pwd_expiration");
      expect(result.skippedMissingData).toContain("eta9089_expiration");
      expect(result.skippedByPreference).toContain("recruitment_expires");
    });
  });
});

// ============================================================================
// getDefaultCalendarPreferences Tests
// ============================================================================

describe("getDefaultCalendarPreferences", () => {
  it("returns all preferences enabled", () => {
    const prefs = getDefaultCalendarPreferences();

    expect(prefs.calendarSyncEnabled).toBe(true);
    expect(prefs.calendarSyncPwd).toBe(true);
    expect(prefs.calendarSyncEta9089).toBe(true);
    expect(prefs.calendarSyncFilingWindow).toBe(true);
    expect(prefs.calendarSyncRecruitment).toBe(true);
    expect(prefs.calendarSyncI140).toBe(true);
    expect(prefs.calendarSyncRfi).toBe(true);
    expect(prefs.calendarSyncRfe).toBe(true);
  });

  it("returns all 8 preference fields", () => {
    const prefs = getDefaultCalendarPreferences();
    const keys = Object.keys(prefs);

    expect(keys).toHaveLength(8);
    expect(keys).toContain("calendarSyncEnabled");
    expect(keys).toContain("calendarSyncPwd");
    expect(keys).toContain("calendarSyncEta9089");
    expect(keys).toContain("calendarSyncFilingWindow");
    expect(keys).toContain("calendarSyncRecruitment");
    expect(keys).toContain("calendarSyncI140");
    expect(keys).toContain("calendarSyncRfi");
    expect(keys).toContain("calendarSyncRfe");
  });

  it("returns a new object each call (not a reference)", () => {
    const prefs1 = getDefaultCalendarPreferences();
    const prefs2 = getDefaultCalendarPreferences();

    expect(prefs1).not.toBe(prefs2);
    expect(prefs1).toEqual(prefs2);

    // Modify one, should not affect the other
    prefs1.calendarSyncPwd = false;
    expect(prefs2.calendarSyncPwd).toBe(true);
  });
});
