/**
 * Tests for calendar event mapper utility.
 *
 * TDD tests for converting case data to calendar events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { caseToCalendarEvents, calculateUrgency } from "./event-mapper";
import type { CalendarCaseData } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal case for testing.
 */
function createTestCase(
  overrides: Partial<CalendarCaseData> = {}
): CalendarCaseData {
  return {
    _id: "test-case-id" as CalendarCaseData["_id"],
    employerName: "Acme Corp",
    beneficiaryIdentifier: "Smith, John",
    caseStatus: "pwd",
    progressStatus: "working",
    ...overrides,
  };
}

// ============================================================================
// Urgency Calculation Tests
// ============================================================================

describe("calculateUrgency", () => {
  it("returns 'overdue' for negative days", () => {
    expect(calculateUrgency(-1)).toBe("overdue");
    expect(calculateUrgency(-30)).toBe("overdue");
  });

  it("returns 'urgent' for 0 days (today)", () => {
    expect(calculateUrgency(0)).toBe("urgent");
  });

  it("returns 'urgent' for 1-7 days", () => {
    expect(calculateUrgency(1)).toBe("urgent");
    expect(calculateUrgency(7)).toBe("urgent");
  });

  it("returns 'soon' for 8-30 days", () => {
    expect(calculateUrgency(8)).toBe("soon");
    expect(calculateUrgency(15)).toBe("soon");
    expect(calculateUrgency(30)).toBe("soon");
  });

  it("returns 'normal' for 31+ days", () => {
    expect(calculateUrgency(31)).toBe("normal");
    expect(calculateUrgency(100)).toBe("normal");
    expect(calculateUrgency(365)).toBe("normal");
  });
});

// ============================================================================
// Case to Calendar Events Tests
// ============================================================================

describe("caseToCalendarEvents", () => {
  beforeEach(() => {
    // Mock the current date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic event creation", () => {
    it("returns empty array for case with no dates", () => {
      const caseData = createTestCase({});
      const events = caseToCalendarEvents(caseData);
      expect(events).toEqual([]);
    });

    it("creates event for PWD expiration date", () => {
      const caseData = createTestCase({
        pwdExpirationDate: "2024-07-15",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("PWD Exp: Smith J.");
      expect(events[0].start.toISOString().split("T")[0]).toBe("2024-07-15");
      expect(events[0].end.toISOString().split("T")[0]).toBe("2024-07-15");
      expect(events[0].allDay).toBe(true);
      expect(events[0].caseId).toBe("test-case-id");
      expect(events[0].deadlineType).toBe("pwdExpires");
      expect(events[0].stage).toBe("pwd");
    });

    it("creates event for PWD filing date", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("PWD Filed: Smith J.");
      expect(events[0].start.toISOString().split("T")[0]).toBe("2024-06-01");
      expect(events[0].end.toISOString().split("T")[0]).toBe("2024-06-01");
      expect(events[0].allDay).toBe(true);
      expect(events[0].deadlineType).toBe("pwdFiled");
      expect(events[0].stage).toBe("pwd");
    });
  });

  describe("all deadline types", () => {
    it("creates events for all standard milestones", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-01-15",
        pwdDeterminationDate: "2024-02-15",
        pwdExpirationDate: "2024-08-15",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderStartDate: "2024-03-15",
        jobOrderEndDate: "2024-04-14",
        eta9089FilingDate: "2024-05-15",
        eta9089CertificationDate: "2024-06-15",
        eta9089ExpirationDate: "2024-12-15",
        i140FilingDate: "2024-07-15",
        i140ApprovalDate: "2024-09-15",
      });

      const events = caseToCalendarEvents(caseData);

      // Should have 12 events for all standard milestones
      expect(events.length).toBe(12);

      // Verify all milestone types are present
      const types = events.map((e) => e.deadlineType);
      expect(types).toContain("pwdFiled");
      expect(types).toContain("pwdDetermined");
      expect(types).toContain("pwdExpires");
      expect(types).toContain("sundayAdFirst");
      expect(types).toContain("sundayAdSecond");
      expect(types).toContain("jobOrderStart");
      expect(types).toContain("jobOrderEnd");
      expect(types).toContain("eta9089Filed");
      expect(types).toContain("eta9089Certified");
      expect(types).toContain("eta9089Expires");
      expect(types).toContain("i140Filed");
      expect(types).toContain("i140Approved");
    });
  });

  describe("missing dates handling", () => {
    it("skips events for undefined dates", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
        pwdExpirationDate: undefined, // Explicitly undefined
        eta9089FilingDate: "2024-06-15",
      });

      const events = caseToCalendarEvents(caseData);

      // Should only have 2 events (PWD filed and ETA filed)
      expect(events.length).toBe(2);
      const types = events.map((e) => e.deadlineType);
      expect(types).not.toContain("pwdExpires");
    });

    it("skips events for null dates", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
        pwdExpirationDate: null, // Explicitly null
      });

      const events = caseToCalendarEvents(caseData);

      expect(events.length).toBe(1);
      expect(events[0].deadlineType).toBe("pwdFiled");
    });

    it("skips events for empty string dates", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
        pwdExpirationDate: "", // Empty string
      });

      const events = caseToCalendarEvents(caseData);

      expect(events.length).toBe(1);
    });
  });

  describe("urgency calculation", () => {
    it("marks events as 'overdue' for past dates", () => {
      const caseData = createTestCase({
        pwdExpirationDate: "2024-06-01", // Past (today is 2024-06-15)
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].urgency).toBe("overdue");
    });

    it("marks events as 'urgent' for dates within 7 days", () => {
      const caseData = createTestCase({
        pwdExpirationDate: "2024-06-20", // 5 days from now
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].urgency).toBe("urgent");
    });

    it("marks events as 'soon' for dates 8-30 days away", () => {
      const caseData = createTestCase({
        pwdExpirationDate: "2024-07-01", // 16 days from now
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].urgency).toBe("soon");
    });

    it("marks events as 'normal' for dates 31+ days away", () => {
      const caseData = createTestCase({
        pwdExpirationDate: "2024-08-01", // 47 days from now
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].urgency).toBe("normal");
    });
  });

  describe("filing window events", () => {
    it("creates separate open and close events for filing window", () => {
      // Case with recruitment complete but ETA not yet filed
      // Ready to File = 30 days after recruitment ends
      // Filing Deadline = 180 days after first recruitment step
      const caseData = createTestCase({
        caseStatus: "eta9089",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderEndDate: "2024-04-09",
        // No eta9089FilingDate - so filing window should be calculated
      });

      const events = caseToCalendarEvents(caseData);

      // Should have events for the filing window
      const windowEvents = events.filter((e) => e.isFilingWindow);
      expect(windowEvents.length).toBe(2);

      const openEvent = windowEvents.find(
        (e) => e.deadlineType === "filingWindowOpens"
      );
      const closeEvent = windowEvents.find(
        (e) => e.deadlineType === "filingWindowCloses"
      );

      expect(openEvent).toBeDefined();
      expect(closeEvent).toBeDefined();

      // Ready to file = jobOrderEnd (2024-04-09) + 30 days = 2024-05-09
      expect(openEvent!.start.toISOString().split("T")[0]).toBe("2024-05-09");
      expect(openEvent!.title).toContain("ETA Window Opens");

      // Filing deadline = sundayAdFirst (2024-03-03) + 180 days = 2024-08-30
      expect(closeEvent!.start.toISOString().split("T")[0]).toBe("2024-08-30");
      expect(closeEvent!.title).toContain("ETA Window Closes");
    });

    it("does not create filing window events when ETA already filed", () => {
      const caseData = createTestCase({
        caseStatus: "eta9089",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderEndDate: "2024-04-09",
        eta9089FilingDate: "2024-05-15", // Already filed
      });

      const events = caseToCalendarEvents(caseData);

      const windowEvents = events.filter((e) => e.isFilingWindow);
      expect(windowEvents.length).toBe(0);
    });

    it("does not create filing window events when no recruitment dates", () => {
      const caseData = createTestCase({
        caseStatus: "pwd",
        pwdFilingDate: "2024-06-01",
        // No recruitment dates
      });

      const events = caseToCalendarEvents(caseData);

      const windowEvents = events.filter((e) => e.isFilingWindow);
      expect(windowEvents.length).toBe(0);
    });
  });

  describe("title formatting", () => {
    it("formats title with last name and first initial", () => {
      const caseData = createTestCase({
        beneficiaryIdentifier: "Smith, John",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].title).toBe("PWD Filed: Smith J.");
    });

    it("handles single name (no comma)", () => {
      const caseData = createTestCase({
        beneficiaryIdentifier: "Smith",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].title).toBe("PWD Filed: Smith");
    });

    it("handles first name last name format", () => {
      const caseData = createTestCase({
        beneficiaryIdentifier: "John Smith",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      // Should still produce a readable title
      expect(events[0].title).toContain("Smith");
    });

    it("handles empty beneficiary name", () => {
      const caseData = createTestCase({
        beneficiaryIdentifier: "",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].title).toBe("PWD Filed");
    });
  });

  describe("RFI/RFE events", () => {
    it("creates events for active RFI deadlines", () => {
      const caseData = createTestCase({
        caseStatus: "eta9089",
        progressStatus: "rfi_rfe",
        rfiEntries: [
          {
            id: "rfi-1",
            title: "Missing Documents",
            receivedDate: "2024-06-01",
            responseDueDate: "2024-07-01",
            createdAt: Date.now(),
          },
        ],
      });

      const events = caseToCalendarEvents(caseData);

      const rfiEvents = events.filter((e) => e.deadlineType === "rfiDue");
      expect(rfiEvents.length).toBe(1);
      // Title uses the RFI title field + beneficiary name
      expect(rfiEvents[0].title).toContain("Missing Documents");
      expect(rfiEvents[0].stage).toBe("rfi");
    });

    it("excludes resolved RFI entries", () => {
      const caseData = createTestCase({
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2024-06-01",
            responseDueDate: "2024-07-01",
            responseSubmittedDate: "2024-06-15", // Resolved
            createdAt: Date.now(),
          },
        ],
      });

      const events = caseToCalendarEvents(caseData);

      const rfiEvents = events.filter((e) => e.deadlineType === "rfiDue");
      expect(rfiEvents.length).toBe(0);
    });

    it("creates events for active RFE deadlines", () => {
      const caseData = createTestCase({
        caseStatus: "i140",
        progressStatus: "rfi_rfe",
        rfeEntries: [
          {
            id: "rfe-1",
            title: "Additional Evidence",
            receivedDate: "2024-06-01",
            responseDueDate: "2024-08-01",
            createdAt: Date.now(),
          },
        ],
      });

      const events = caseToCalendarEvents(caseData);

      const rfeEvents = events.filter((e) => e.deadlineType === "rfeDue");
      expect(rfeEvents.length).toBe(1);
      // Title uses the RFE title field + beneficiary name
      expect(rfeEvents[0].title).toContain("Additional Evidence");
      expect(rfeEvents[0].stage).toBe("rfe");
    });
  });

  describe("event IDs", () => {
    it("generates unique IDs for each event", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
        pwdExpirationDate: "2024-08-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].id).not.toBe(events[1].id);
    });

    it("includes case ID in event ID", () => {
      const caseData = createTestCase({
        _id: "case-123" as CalendarCaseData["_id"],
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events[0].id).toContain("case-123");
    });
  });

  // ============================================================================
  // Tooltip Data Tests (4.4)
  // ============================================================================

  describe("tooltip data", () => {
    it("passes employerName to calendar events", () => {
      const caseData = createTestCase({
        employerName: "Acme Corporation",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].employerName).toBe("Acme Corporation");
    });

    it("passes positionTitle to calendar events", () => {
      const caseData = createTestCase({
        positionTitle: "Senior Software Engineer",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].positionTitle).toBe("Senior Software Engineer");
    });

    it("passes caseStatus to calendar events", () => {
      const caseData = createTestCase({
        caseStatus: "recruitment",
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].caseStatus).toBe("recruitment");
    });

    it("passes all tooltip fields to all events from the same case", () => {
      const caseData = createTestCase({
        employerName: "Big Tech Corp",
        positionTitle: "Data Scientist",
        caseStatus: "eta9089",
        pwdFilingDate: "2024-01-15",
        eta9089FilingDate: "2024-06-01",
        i140FilingDate: "2024-08-01",
      });

      const events = caseToCalendarEvents(caseData);

      // Should have 3 events (PWD filed, ETA filed, I-140 filed)
      expect(events).toHaveLength(3);

      // All events should have the same tooltip data
      events.forEach((event) => {
        expect(event.employerName).toBe("Big Tech Corp");
        expect(event.positionTitle).toBe("Data Scientist");
        expect(event.caseStatus).toBe("eta9089");
      });
    });

    it("handles undefined positionTitle gracefully", () => {
      const caseData = createTestCase({
        employerName: "Test Corp",
        positionTitle: undefined,
        pwdFilingDate: "2024-06-01",
      });

      const events = caseToCalendarEvents(caseData);

      expect(events).toHaveLength(1);
      expect(events[0].positionTitle).toBeUndefined();
      expect(events[0].employerName).toBe("Test Corp"); // Other fields still work
    });

    it("passes tooltip data for RFI/RFE events", () => {
      const caseData = createTestCase({
        employerName: "Healthcare Inc",
        positionTitle: "Nurse Practitioner",
        caseStatus: "eta9089",
        progressStatus: "rfi_rfe",
        rfiEntries: [
          {
            id: "rfi-1",
            title: "Missing Documents",
            receivedDate: "2024-06-01",
            responseDueDate: "2024-07-01",
            createdAt: Date.now(),
          },
        ],
      });

      const events = caseToCalendarEvents(caseData);

      const rfiEvent = events.find((e) => e.deadlineType === "rfiDue");
      expect(rfiEvent).toBeDefined();
      expect(rfiEvent!.employerName).toBe("Healthcare Inc");
      expect(rfiEvent!.positionTitle).toBe("Nurse Practitioner");
      expect(rfiEvent!.caseStatus).toBe("eta9089");
    });

    it("passes tooltip data for filing window events", () => {
      const caseData = createTestCase({
        employerName: "Tech Startup LLC",
        positionTitle: "Backend Engineer",
        caseStatus: "eta9089",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderEndDate: "2024-04-09",
        // No eta9089FilingDate - triggers filing window calculation
      });

      const events = caseToCalendarEvents(caseData);

      const filingWindowEvents = events.filter((e) => e.isFilingWindow);
      expect(filingWindowEvents.length).toBe(2);

      filingWindowEvents.forEach((event) => {
        expect(event.employerName).toBe("Tech Startup LLC");
        expect(event.positionTitle).toBe("Backend Engineer");
        expect(event.caseStatus).toBe("eta9089");
      });
    });
  });

  describe("stage colors", () => {
    it("assigns correct stage for PWD milestones", () => {
      const caseData = createTestCase({
        pwdFilingDate: "2024-06-01",
        pwdExpirationDate: "2024-08-01",
      });

      const events = caseToCalendarEvents(caseData);

      events.forEach((e) => {
        expect(e.stage).toBe("pwd");
      });
    });

    it("assigns correct stage for recruitment milestones", () => {
      const caseData = createTestCase({
        sundayAdFirstDate: "2024-03-03",
        jobOrderEndDate: "2024-04-09",
        eta9089FilingDate: "2024-05-15", // Filed ETA prevents calculated milestones
      });

      const events = caseToCalendarEvents(caseData);

      // Filter to only recruitment milestones (exclude calculated ones which have eta9089 stage)
      const recruitmentEvents = events.filter(
        (e) =>
          e.deadlineType === "sundayAdFirst" ||
          e.deadlineType === "sundayAdSecond" ||
          e.deadlineType === "jobOrderStart" ||
          e.deadlineType === "jobOrderEnd"
      );
      recruitmentEvents.forEach((e) => {
        expect(e.stage).toBe("recruitment");
      });
    });

    it("assigns correct stage for ETA 9089 milestones", () => {
      const caseData = createTestCase({
        eta9089FilingDate: "2024-05-15",
        eta9089CertificationDate: "2024-06-15",
      });

      const events = caseToCalendarEvents(caseData);

      events.forEach((e) => {
        expect(e.stage).toBe("eta9089");
      });
    });

    it("assigns correct stage for I-140 milestones", () => {
      const caseData = createTestCase({
        i140FilingDate: "2024-07-15",
        i140ApprovalDate: "2024-09-15",
      });

      const events = caseToCalendarEvents(caseData);

      events.forEach((e) => {
        expect(e.stage).toBe("i140");
      });
    });
  });
});
