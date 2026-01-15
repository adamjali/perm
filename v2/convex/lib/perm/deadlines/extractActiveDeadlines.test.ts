/**
 * Tests for deadline extraction.
 */

import { describe, it, expect } from "vitest";
import {
  extractActiveDeadlines,
  getActiveDeadlineTypes,
  shouldRemindForDeadline,
  daysBetween,
} from "./extractActiveDeadlines";
import type { CaseDataForDeadlines } from "./types";

describe("daysBetween", () => {
  it("returns positive days for future date", () => {
    expect(daysBetween("2024-01-01", "2024-01-15")).toBe(14);
  });

  it("returns negative days for past date", () => {
    expect(daysBetween("2024-01-15", "2024-01-01")).toBe(-14);
  });

  it("returns 0 for same date", () => {
    expect(daysBetween("2024-01-15", "2024-01-15")).toBe(0);
  });

  it("handles year boundaries", () => {
    expect(daysBetween("2024-12-31", "2025-01-01")).toBe(1);
  });

  it("handles leap years", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is leap year
    expect(daysBetween("2023-02-28", "2023-03-01")).toBe(1); // 2023 is not
  });
});

describe("extractActiveDeadlines", () => {
  const TODAY = "2024-12-15";

  describe("filtering", () => {
    it("returns empty array for closed cases", () => {
      const caseData: CaseDataForDeadlines = {
        caseStatus: "closed",
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for deleted cases", () => {
      const caseData: CaseDataForDeadlines = {
        deletedAt: Date.now(),
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result).toHaveLength(0);
    });
  });

  describe("PWD expiration", () => {
    it("extracts PWD expiration when active", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "pwd_expiration",
        label: "PWD Expiration",
        date: "2025-06-30",
      });
      expect(result[0]!.daysUntil).toBeGreaterThan(0);
    });

    it("does not extract PWD when ETA 9089 filed", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: "2024-12-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);
      const pwdDeadline = result.find((d) => d.type === "pwd_expiration");

      expect(pwdDeadline).toBeUndefined();
    });
  });

  describe("filing window", () => {
    it("extracts filing window opens when active", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowOpens: "2025-03-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_opens")).toBeDefined();
    });

    it("extracts filing window closes when active", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowCloses: "2025-06-15",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_closes")).toBeDefined();
    });

    it("does not extract filing window when ETA 9089 filed", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowOpens: "2025-03-01",
        filingWindowCloses: "2025-06-15",
        eta9089FilingDate: "2024-12-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_opens")).toBeUndefined();
      expect(result.find((d) => d.type === "filing_window_closes")).toBeUndefined();
    });
  });

  describe("I-140 deadline", () => {
    it("extracts I-140 deadline when certified and not filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const i140Deadline = result.find((d) => d.type === "i140_filing_deadline");
      expect(i140Deadline).toBeDefined();
      expect(i140Deadline?.date).toBe("2024-11-28");
    });

    it("does not extract I-140 deadline when filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
        i140FilingDate: "2024-10-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "i140_filing_deadline")).toBeUndefined();
    });

    it("does not extract I-140 deadline when not certified", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089FilingDate: "2024-05-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "i140_filing_deadline")).toBeUndefined();
    });
  });

  describe("RFI deadline", () => {
    it("extracts RFI deadline when active", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const rfiDeadline = result.find((d) => d.type === "rfi_due");
      expect(rfiDeadline).toBeDefined();
      expect(rfiDeadline?.date).toBe("2024-12-31");
      expect(rfiDeadline?.entryId).toBe("rfi-1");
    });

    it("does not extract RFI deadline when responded", () => {
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

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "rfi_due")).toBeUndefined();
    });
  });

  describe("RFE deadline", () => {
    it("extracts RFE deadline when active", () => {
      const caseData: CaseDataForDeadlines = {
        rfeEntries: [
          {
            id: "rfe-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-15",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const rfeDeadline = result.find((d) => d.type === "rfe_due");
      expect(rfeDeadline).toBeDefined();
      expect(rfeDeadline?.date).toBe("2025-01-15");
      expect(rfeDeadline?.entryId).toBe("rfe-1");
    });

    it("does not extract RFE deadline when responded", () => {
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

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "rfe_due")).toBeUndefined();
    });
  });

  describe("sorting", () => {
    it("sorts deadlines by daysUntil (most urgent first)", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30", // Far future
        filingWindowOpens: "2025-01-01", // Soon
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-20", // Very soon
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBeGreaterThanOrEqual(3);
      // Most urgent (smallest daysUntil) should be first
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.daysUntil).toBeGreaterThanOrEqual(result[i - 1]!.daysUntil);
      }
    });

    it("handles overdue deadlines (negative daysUntil)", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2024-12-01", // Overdue
        filingWindowOpens: "2025-01-01", // Future
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBe(2);
      expect(result[0]!.daysUntil).toBeLessThan(0); // Overdue first
      expect(result[1]!.daysUntil).toBeGreaterThan(0); // Future second
    });
  });

  describe("multiple deadlines", () => {
    it("extracts all active deadlines from complex case", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        filingWindowOpens: "2025-03-01",
        filingWindowCloses: "2025-06-15",
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBe(4);
      expect(result.map((d) => d.type)).toContain("pwd_expiration");
      expect(result.map((d) => d.type)).toContain("filing_window_opens");
      expect(result.map((d) => d.type)).toContain("filing_window_closes");
      expect(result.map((d) => d.type)).toContain("rfi_due");
    });
  });
});

describe("getActiveDeadlineTypes", () => {
  it("returns all active deadline types", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      filingWindowOpens: "2025-03-01",
    };

    const result = getActiveDeadlineTypes(caseData);

    expect(result).toContain("pwd_expiration");
    expect(result).toContain("filing_window_opens");
  });

  it("excludes superseded deadline types", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: "2024-12-01",
    };

    const result = getActiveDeadlineTypes(caseData);

    expect(result).not.toContain("pwd_expiration");
    expect(result).not.toContain("filing_window_opens");
    expect(result).not.toContain("filing_window_closes");
  });
});

describe("shouldRemindForDeadline", () => {
  it("returns true when deadline is active and has date", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
    };

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(true);
  });

  it("returns false when deadline is superseded", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: "2024-12-01",
    };

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(false);
  });

  it("returns false when deadline has no date", () => {
    const caseData: CaseDataForDeadlines = {};

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(false);
  });

  it("returns true for active RFI with due date", () => {
    const caseData: CaseDataForDeadlines = {
      rfiEntries: [
        {
          id: "rfi-1", createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2024-12-31",
        },
      ],
    };

    expect(shouldRemindForDeadline("rfi_due", caseData)).toBe(true);
  });

  it("returns false for responded RFI", () => {
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

    expect(shouldRemindForDeadline("rfi_due", caseData)).toBe(false);
  });
});
