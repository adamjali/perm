/**
 * Dashboard Helper Functions Tests
 *
 * Tests for deadline extraction, urgency calculation, and grouping logic.
 */

import { describe, it, expect } from "vitest";
import {
  extractDeadlines,
  calculateUrgency,
  createDeadlineItem,
  sortByUrgency,
} from "../dashboardHelpers";
import type { CaseDataForDeadlines } from "../dashboardTypes";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TODAY_ISO = "2025-01-15";

function createMinimalCase(
  overrides: Partial<CaseDataForDeadlines> = {}
): CaseDataForDeadlines {
  return {
    employerName: "Test Corp",
    beneficiaryIdentifier: "Smith, John",
    caseStatus: "pwd",
    progressStatus: "working",
    ...overrides,
  };
}

// ============================================================================
// calculateUrgency Tests
// ============================================================================

describe("calculateUrgency", () => {
  it("returns overdue for negative days", () => {
    expect(calculateUrgency(-1)).toBe("overdue");
    expect(calculateUrgency(-30)).toBe("overdue");
  });

  it("returns thisWeek for 0-7 days", () => {
    expect(calculateUrgency(0)).toBe("thisWeek");
    expect(calculateUrgency(3)).toBe("thisWeek");
    expect(calculateUrgency(7)).toBe("thisWeek");
  });

  it("returns thisMonth for 8-30 days", () => {
    expect(calculateUrgency(8)).toBe("thisMonth");
    expect(calculateUrgency(15)).toBe("thisMonth");
    expect(calculateUrgency(30)).toBe("thisMonth");
  });

  it("returns later for 31+ days", () => {
    expect(calculateUrgency(31)).toBe("later");
    expect(calculateUrgency(100)).toBe("later");
    expect(calculateUrgency(365)).toBe("later");
  });
});

// ============================================================================
// createDeadlineItem Tests
// ============================================================================

describe("createDeadlineItem", () => {
  it("computes urgency from daysUntil automatically", () => {
    const item = createDeadlineItem({
      caseId: "test123" as Id<"cases">,
      employerName: "Test Corp",
      beneficiaryName: "Smith J.",
      type: "pwd_expiration",
      label: "PWD Expiration",
      dueDate: "2025-01-20",
      daysUntil: 5, // Should be thisWeek
      caseStatus: "pwd",
      progressStatus: "working",
    });

    expect(item.urgency).toBe("thisWeek");
    expect(item.daysUntil).toBe(5);
  });

  it("handles overdue cases correctly", () => {
    const item = createDeadlineItem({
      caseId: "test123" as Id<"cases">,
      employerName: "Test Corp",
      beneficiaryName: "Smith J.",
      type: "rfi_due",
      label: "RFI Due",
      dueDate: "2025-01-10",
      daysUntil: -5, // Overdue
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
    });

    expect(item.urgency).toBe("overdue");
  });
});

// ============================================================================
// sortByUrgency Tests
// ============================================================================

describe("sortByUrgency", () => {
  it("sorts by daysUntil ascending (most urgent first)", () => {
    const items = [
      { label: "Later", daysUntil: 100 },
      { label: "Overdue", daysUntil: -5 },
      { label: "ThisWeek", daysUntil: 3 },
    ];

    const sorted = sortByUrgency(items);

    expect(sorted[0]?.label).toBe("Overdue");
    expect(sorted[1]?.label).toBe("ThisWeek");
    expect(sorted[2]?.label).toBe("Later");
  });

  it("does not mutate original array", () => {
    const items = [
      { label: "B", daysUntil: 10 },
      { label: "A", daysUntil: 5 },
    ];
    const original = [...items];

    sortByUrgency(items);

    expect(items).toEqual(original);
  });
});

// ============================================================================
// extractDeadlines Tests
// ============================================================================

describe("extractDeadlines", () => {
  // ------------------------------------------
  // Basic extraction
  // ------------------------------------------

  describe("basic extraction", () => {
    it("skips closed cases", () => {
      const caseData = createMinimalCase({
        caseStatus: "closed",
        pwdExpirationDate: "2025-06-30",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);

      expect(deadlines).toHaveLength(0);
    });

    it("skips deleted cases", () => {
      const caseData = createMinimalCase({
        deletedAt: Date.now(),
        pwdExpirationDate: "2025-06-30",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);

      expect(deadlines).toHaveLength(0);
    });

    it("extracts PWD expiration when present and ETA 9089 not filed", () => {
      const caseData = createMinimalCase({
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: undefined,
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);

      expect(deadlines).toHaveLength(1);
      expect(deadlines[0]?.type).toBe("pwd_expiration");
      expect(deadlines[0]?.date).toBe("2025-06-30");
    });

    it("does NOT extract PWD expiration when ETA 9089 is filed", () => {
      const caseData = createMinimalCase({
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: "2025-03-01",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");

      expect(pwdDeadline).toBeUndefined();
    });
  });

  // ------------------------------------------
  // RFI/RFE extraction
  // ------------------------------------------

  describe("RFI/RFE extraction", () => {
    it("extracts active RFI deadline", () => {
      const caseData = createMinimalCase({
        caseStatus: "eta9089",
        progressStatus: "rfi_rfe",
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-31",
            createdAt: Date.now(),
          },
        ],
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const rfiDeadline = deadlines.find((d) => d.type === "rfi_due");

      expect(rfiDeadline).toBeDefined();
      expect(rfiDeadline?.date).toBe("2025-01-31");
    });

    it("skips RFI if already submitted", () => {
      const caseData = createMinimalCase({
        caseStatus: "eta9089",
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-31",
            responseSubmittedDate: "2025-01-20",
            createdAt: Date.now(),
          },
        ],
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const rfiDeadline = deadlines.find((d) => d.type === "rfi_due");

      expect(rfiDeadline).toBeUndefined();
    });

    it("extracts active RFE deadline", () => {
      const caseData = createMinimalCase({
        caseStatus: "i140",
        progressStatus: "rfi_rfe",
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-02-15",
            createdAt: Date.now(),
          },
        ],
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const rfeDeadline = deadlines.find((d) => d.type === "rfe_due");

      expect(rfeDeadline).toBeDefined();
      expect(rfeDeadline?.date).toBe("2025-02-15");
    });
  });

  // ------------------------------------------
  // I-140 deadline extraction
  // ------------------------------------------

  describe("I-140 deadline extraction", () => {
    it("extracts I-140 filing deadline when ETA 9089 certified but I-140 not filed", () => {
      const caseData = createMinimalCase({
        caseStatus: "i140",
        eta9089CertificationDate: "2025-01-01",
        eta9089ExpirationDate: "2025-07-01",
        i140FilingDate: undefined,
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const i140Deadline = deadlines.find(
        (d) => d.type === "i140_filing_deadline"
      );

      expect(i140Deadline).toBeDefined();
      expect(i140Deadline?.date).toBe("2025-07-01");
    });

    it("does NOT extract I-140 deadline when I-140 is filed", () => {
      const caseData = createMinimalCase({
        caseStatus: "i140",
        eta9089CertificationDate: "2025-01-01",
        eta9089ExpirationDate: "2025-07-01",
        i140FilingDate: "2025-02-01",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const i140Deadline = deadlines.find(
        (d) => d.type === "i140_filing_deadline"
      );

      expect(i140Deadline).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Filing window extraction - stored vs calculated
  // ------------------------------------------

  describe("filing window - stored vs calculated fallback", () => {
    it("uses stored filingWindowOpens when available", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowOpens: "2025-04-01", // Stored value
        sundayAdSecondDate: "2025-02-20", // Would calculate to different date
        jobOrderEndDate: "2025-02-25",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowOpens = deadlines.find(
        (d) => d.type === "filing_window_opens"
      );

      expect(windowOpens).toBeDefined();
      expect(windowOpens?.date).toBe("2025-04-01"); // Uses stored value
    });

    it("calculates filingWindowOpens when stored value not available", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowOpens: undefined, // No stored value
        sundayAdSecondDate: "2025-02-20",
        jobOrderEndDate: "2025-02-25", // This is later, so recruitment ends here
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowOpens = deadlines.find(
        (d) => d.type === "filing_window_opens"
      );

      expect(windowOpens).toBeDefined();
      // Recruitment ends Feb 25, window opens Feb 25 + 30 = Mar 27
      expect(windowOpens?.date).toBe("2025-03-27");
    });

    it("uses stored filingWindowCloses when available", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowCloses: "2025-08-15", // Stored value
        sundayAdFirstDate: "2025-02-15",
        pwdExpirationDate: "2025-12-31", // Would truncate to different date
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowCloses = deadlines.find(
        (d) => d.type === "recruitment_window"
      );

      expect(windowCloses).toBeDefined();
      expect(windowCloses?.date).toBe("2025-08-15"); // Uses stored value
    });

    it("calculates filingWindowCloses when stored value not available", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowCloses: undefined, // No stored value
        sundayAdFirstDate: "2025-02-15",
        pwdExpirationDate: "2025-12-31",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowCloses = deadlines.find(
        (d) => d.type === "recruitment_window"
      );

      expect(windowCloses).toBeDefined();
      // First recruitment Feb 15, window closes Feb 15 + 180 = Aug 14
      expect(windowCloses?.date).toBe("2025-08-14");
    });
  });

  // ------------------------------------------
  // PWD expiration truncation behavior
  // ------------------------------------------

  describe("PWD expiration truncation", () => {
    it("truncates filing window close to PWD expiration when earlier", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowCloses: undefined, // Force calculation
        sundayAdFirstDate: "2025-02-15", // Window would close Aug 14
        pwdExpirationDate: "2025-06-30", // But PWD expires earlier
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowCloses = deadlines.find(
        (d) => d.type === "recruitment_window"
      );

      expect(windowCloses).toBeDefined();
      // PWD expires Jun 30, which is before Aug 14, so window closes Jun 30
      expect(windowCloses?.date).toBe("2025-06-30");
    });

    it("uses 180-day window when PWD expires later", () => {
      const caseData = createMinimalCase({
        caseStatus: "recruitment",
        filingWindowCloses: undefined, // Force calculation
        sundayAdFirstDate: "2025-02-15", // Window closes Aug 14
        pwdExpirationDate: "2026-02-15", // PWD expires much later
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowCloses = deadlines.find(
        (d) => d.type === "recruitment_window"
      );

      expect(windowCloses).toBeDefined();
      // PWD expires Feb 2026, 180 days = Aug 14, so use Aug 14
      expect(windowCloses?.date).toBe("2025-08-14");
    });
  });

  // ------------------------------------------
  // Filing window skipped after ETA 9089 filed
  // ------------------------------------------

  describe("filing window after ETA 9089 filed", () => {
    it("does NOT extract filing window deadlines when ETA 9089 is filed", () => {
      const caseData = createMinimalCase({
        caseStatus: "eta9089",
        eta9089FilingDate: "2025-03-15",
        sundayAdFirstDate: "2025-02-15",
        sundayAdSecondDate: "2025-02-20",
        jobOrderEndDate: "2025-02-25",
      });

      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const windowOpens = deadlines.find(
        (d) => d.type === "filing_window_opens"
      );
      const windowCloses = deadlines.find(
        (d) => d.type === "recruitment_window"
      );

      expect(windowOpens).toBeUndefined();
      expect(windowCloses).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("handles malformed dates gracefully without crashing", () => {
      const caseData = createMinimalCase({
        pwdExpirationDate: "not-a-date", // Malformed date
      });

      // Should not throw, just skip the deadline
      const deadlines = extractDeadlines(caseData, TODAY_ISO);
      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");

      expect(pwdDeadline).toBeUndefined();
    });
  });
});
