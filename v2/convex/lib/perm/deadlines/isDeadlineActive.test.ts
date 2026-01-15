/**
 * Tests for deadline supersession logic.
 *
 * Per perm_flow.md line 41:
 * "A deadline becomes inactive/met once the filed has a value"
 */

import { describe, it, expect } from "vitest";
import {
  isDeadlineActive,
  getActiveRfiEntry,
  getActiveRfeEntry,
  hasAnyActiveDeadline,
} from "./isDeadlineActive";
import { SUPERSESSION_REASONS } from "./types";
import type { CaseDataForDeadlines, RfiEntry, RfeEntry } from "./types";

describe("isDeadlineActive", () => {
  // ==========================================================================
  // Global Filters
  // ==========================================================================

  describe("global filters", () => {
    it("returns inactive for closed cases", () => {
      const caseData: CaseDataForDeadlines = {
        caseStatus: "closed",
        pwdExpirationDate: "2025-06-30",
      };

      const result = isDeadlineActive("pwd_expiration", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.CASE_CLOSED);
    });

    it("returns inactive for deleted cases", () => {
      const caseData: CaseDataForDeadlines = {
        deletedAt: Date.now(),
        pwdExpirationDate: "2025-06-30",
      };

      const result = isDeadlineActive("pwd_expiration", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.CASE_DELETED);
    });
  });

  // ==========================================================================
  // PWD Expiration
  // ==========================================================================

  describe("pwd_expiration", () => {
    it("is active when PWD date exists and ETA 9089 not filed", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
      };

      const result = isDeadlineActive("pwd_expiration", caseData);

      expect(result.isActive).toBe(true);
      expect(result.supersededReason).toBeUndefined();
    });

    it("is superseded when ETA 9089 is filed", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: "2024-12-01",
      };

      const result = isDeadlineActive("pwd_expiration", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.ETA9089_FILED);
    });

    it("is inactive when no PWD expiration date", () => {
      const caseData: CaseDataForDeadlines = {};

      const result = isDeadlineActive("pwd_expiration", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.NO_DATE);
    });
  });

  // ==========================================================================
  // Filing Window Deadlines
  // ==========================================================================

  describe("filing_window_opens", () => {
    it("is active when ETA 9089 not filed", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowOpens: "2025-03-01",
      };

      const result = isDeadlineActive("filing_window_opens", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when ETA 9089 is filed", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowOpens: "2025-03-01",
        eta9089FilingDate: "2024-12-01",
      };

      const result = isDeadlineActive("filing_window_opens", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.ETA9089_FILED);
    });
  });

  describe("filing_window_closes", () => {
    it("is active when ETA 9089 not filed", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowCloses: "2025-06-15",
      };

      const result = isDeadlineActive("filing_window_closes", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when ETA 9089 is filed", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowCloses: "2025-06-15",
        eta9089FilingDate: "2024-12-01",
      };

      const result = isDeadlineActive("filing_window_closes", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.ETA9089_FILED);
    });
  });

  describe("recruitment_window_closes", () => {
    it("is active when ETA 9089 not filed", () => {
      const caseData: CaseDataForDeadlines = {
        recruitmentWindowCloses: "2025-05-01",
      };

      const result = isDeadlineActive("recruitment_window_closes", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when ETA 9089 is filed", () => {
      const caseData: CaseDataForDeadlines = {
        recruitmentWindowCloses: "2025-05-01",
        eta9089FilingDate: "2024-12-01",
      };

      const result = isDeadlineActive("recruitment_window_closes", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.ETA9089_FILED);
    });
  });

  // ==========================================================================
  // I-140 Filing Deadline
  // ==========================================================================

  describe("i140_filing_deadline", () => {
    it("is active when ETA 9089 certified and I-140 not filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
      };

      const result = isDeadlineActive("i140_filing_deadline", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when I-140 is filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
        i140FilingDate: "2024-10-01",
      };

      const result = isDeadlineActive("i140_filing_deadline", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.I140_FILED);
    });

    it("is inactive when ETA 9089 not certified", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089FilingDate: "2024-05-01",
        // No certification date
      };

      const result = isDeadlineActive("i140_filing_deadline", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.NOT_CERTIFIED);
    });

    it("is inactive when no expiration date", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        // No expiration date
      };

      const result = isDeadlineActive("i140_filing_deadline", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.NOT_CERTIFIED);
    });
  });

  // ==========================================================================
  // RFI Due
  // ==========================================================================

  describe("rfi_due", () => {
    it("is active when there is an active RFI entry", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
          },
        ],
      };

      const result = isDeadlineActive("rfi_due", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when RFI response is submitted", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
            responseSubmittedDate: "2024-12-15",
          },
        ],
      };

      const result = isDeadlineActive("rfi_due", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.RFI_RESPONDED);
    });

    it("is inactive when no RFI entries", () => {
      const caseData: CaseDataForDeadlines = {};

      const result = isDeadlineActive("rfi_due", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.RFI_RESPONDED);
    });

    it("is active for first active RFI when multiple exist", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-11-01",
            responseDueDate: "2024-12-01",
            responseSubmittedDate: "2024-11-15", // Responded
          },
          {
            id: "rfi-2", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
            // No response - active
          },
        ],
      };

      const result = isDeadlineActive("rfi_due", caseData);

      expect(result.isActive).toBe(true);
    });
  });

  // ==========================================================================
  // RFE Due
  // ==========================================================================

  describe("rfe_due", () => {
    it("is active when there is an active RFE entry", () => {
      const caseData: CaseDataForDeadlines = {
        rfeEntries: [
          {
            id: "rfe-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-15",
          },
        ],
      };

      const result = isDeadlineActive("rfe_due", caseData);

      expect(result.isActive).toBe(true);
    });

    it("is superseded when RFE response is submitted", () => {
      const caseData: CaseDataForDeadlines = {
        rfeEntries: [
          {
            id: "rfe-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-15",
            responseSubmittedDate: "2025-01-10",
          },
        ],
      };

      const result = isDeadlineActive("rfe_due", caseData);

      expect(result.isActive).toBe(false);
      expect(result.supersededReason).toBe(SUPERSESSION_REASONS.RFE_RESPONDED);
    });
  });
});

// ==========================================================================
// Helper Functions
// ==========================================================================

describe("getActiveRfiEntry", () => {
  it("returns first active RFI entry", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-1", createdAt: Date.now(),
        receivedDate: "2024-11-01",
        responseDueDate: "2024-12-01",
        responseSubmittedDate: "2024-11-15",
      },
      {
        id: "rfi-2", createdAt: Date.now(),
        receivedDate: "2024-12-01",
        responseDueDate: "2024-12-31",
      },
    ];

    const result = getActiveRfiEntry(entries);

    expect(result).toBeDefined();
    expect(result?.id).toBe("rfi-2");
  });

  it("returns undefined when all RFIs responded", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-1", createdAt: Date.now(),
        receivedDate: "2024-11-01",
        responseDueDate: "2024-12-01",
        responseSubmittedDate: "2024-11-15",
      },
    ];

    const result = getActiveRfiEntry(entries);

    expect(result).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    const result = getActiveRfiEntry([]);
    expect(result).toBeUndefined();
  });
});

describe("getActiveRfeEntry", () => {
  it("returns first active RFE entry", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1", createdAt: Date.now(),
        receivedDate: "2024-12-01",
        responseDueDate: "2025-01-15",
      },
    ];

    const result = getActiveRfeEntry(entries);

    expect(result).toBeDefined();
    expect(result?.id).toBe("rfe-1");
  });

  it("returns undefined when all RFEs responded", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1", createdAt: Date.now(),
        receivedDate: "2024-12-01",
        responseDueDate: "2025-01-15",
        responseSubmittedDate: "2025-01-10",
      },
    ];

    const result = getActiveRfeEntry(entries);

    expect(result).toBeUndefined();
  });
});

describe("hasAnyActiveDeadline", () => {
  it("returns true when PWD expiration is active", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
    };

    expect(hasAnyActiveDeadline(caseData)).toBe(true);
  });

  it("returns false for closed cases", () => {
    const caseData: CaseDataForDeadlines = {
      caseStatus: "closed",
      pwdExpirationDate: "2025-06-30",
    };

    expect(hasAnyActiveDeadline(caseData)).toBe(false);
  });

  it("returns false when all deadlines are superseded", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: "2024-12-01",
      eta9089CertificationDate: "2024-12-15",
      eta9089ExpirationDate: "2025-06-13",
      i140FilingDate: "2025-01-01",
      // All deadlines superseded
    };

    expect(hasAnyActiveDeadline(caseData)).toBe(false);
  });

  it("returns true when I-140 deadline is active", () => {
    const caseData: CaseDataForDeadlines = {
      eta9089FilingDate: "2024-12-01",
      eta9089CertificationDate: "2024-12-15",
      eta9089ExpirationDate: "2025-06-13",
      // I-140 not filed - deadline active
    };

    expect(hasAnyActiveDeadline(caseData)).toBe(true);
  });
});
