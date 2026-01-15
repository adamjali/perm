/**
 * Dashboard Helper Functions Unit Tests
 * TDD - Tests written BEFORE implementation
 *
 * Tests cover:
 * - calculateUrgency(daysUntil)
 * - sortByUrgency(items)
 * - extractDeadlines(caseData, todayISO)
 * - groupDeadlinesByUrgency(deadlines)
 * - Subtext builders (PWD, Recruitment, ETA 9089, I-140)
 */

import { describe, it, expect } from "vitest";
import { fixtures, daysFromNow, daysAgo, today } from "../../test-utils/dashboard-fixtures";
import type { Id } from "../_generated/dataModel";
import {
  calculateUrgency,
  sortByUrgency,
  extractDeadlines,
  groupDeadlinesByUrgency,
  buildPwdSubtext,
  buildRecruitmentSubtext,
  buildEta9089Subtext,
  buildI140Subtext,
} from "./dashboard";

// ============================================================================
// calculateUrgency(daysUntil)
// ============================================================================

describe("calculateUrgency", () => {
  it("returns 'overdue' for negative days", () => {
    expect(calculateUrgency(-10)).toBe("overdue");
    expect(calculateUrgency(-1)).toBe("overdue");
  });

  it("returns 'thisWeek' for 0-7 days", () => {
    expect(calculateUrgency(0)).toBe("thisWeek");
    expect(calculateUrgency(3)).toBe("thisWeek");
    expect(calculateUrgency(7)).toBe("thisWeek");
  });

  it("returns 'thisMonth' for 8-30 days", () => {
    expect(calculateUrgency(8)).toBe("thisMonth");
    expect(calculateUrgency(15)).toBe("thisMonth");
    expect(calculateUrgency(30)).toBe("thisMonth");
  });

  it("returns 'later' for 31+ days", () => {
    expect(calculateUrgency(31)).toBe("later");
    expect(calculateUrgency(100)).toBe("later");
    expect(calculateUrgency(365)).toBe("later");
  });
});

// ============================================================================
// sortByUrgency(items)
// ============================================================================

describe("sortByUrgency", () => {
  it("sorts by daysUntil ascending (most urgent first)", () => {
    const items = [
      { label: "Later", daysUntil: 100 },
      { label: "Overdue", daysUntil: -5 },
      { label: "ThisWeek", daysUntil: 3 },
      { label: "ThisMonth", daysUntil: 20 },
    ];

    const sorted = sortByUrgency(items);

    expect(sorted[0].label).toBe("Overdue");
    expect(sorted[1].label).toBe("ThisWeek");
    expect(sorted[2].label).toBe("ThisMonth");
    expect(sorted[3].label).toBe("Later");
  });

  it("handles empty array", () => {
    const result = sortByUrgency([]);
    expect(result).toEqual([]);
  });

  it("handles single item", () => {
    const items = [{ label: "Only", daysUntil: 10 }];
    const result = sortByUrgency(items);
    expect(result).toEqual(items);
  });

  it("maintains stability for equal daysUntil", () => {
    const items = [
      { label: "First", daysUntil: 5 },
      { label: "Second", daysUntil: 5 },
      { label: "Third", daysUntil: 5 },
    ];

    const sorted = sortByUrgency(items);

    // Should maintain original order for equal values
    expect(sorted[0].label).toBe("First");
    expect(sorted[1].label).toBe("Second");
    expect(sorted[2].label).toBe("Third");
  });
});

// ============================================================================
// extractDeadlines(caseData, todayISO)
// ============================================================================

describe("extractDeadlines", () => {
  // Note: userId is declared for potential future use in fixture data
  const _userId = "test-user-id" as Id<"users">;
  const todayISO = today();

  describe("PWD expiration deadline", () => {
    it("includes PWD expiration if in PWD stage", () => {
      const caseData = fixtures.pwd.pwdWithExpiration();
      const deadlines = extractDeadlines(caseData, todayISO);

      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");
      expect(pwdDeadline).toBeDefined();
      expect(pwdDeadline?.date).toBe(caseData.pwdExpirationDate);
      expect(pwdDeadline?.label).toContain("PWD Expiration");
    });

    it("includes PWD expiration if in recruitment stage", () => {
      const caseData = fixtures.recruitment.recruitmentActive();
      const deadlines = extractDeadlines(caseData, todayISO);

      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");
      expect(pwdDeadline).toBeDefined();
    });

    it("excludes PWD expiration if ETA 9089 filed (superseded)", () => {
      const caseData = fixtures.eta9089.eta9089Pending();
      const deadlines = extractDeadlines(caseData, todayISO);

      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");
      expect(pwdDeadline).toBeUndefined();
    });

    it("excludes PWD expiration if no expiration date", () => {
      const caseData = fixtures.pwd.pwdWorking();
      const deadlines = extractDeadlines(caseData, todayISO);

      const pwdDeadline = deadlines.find((d) => d.type === "pwd_expiration");
      expect(pwdDeadline).toBeUndefined();
    });
  });

  describe("RFI due deadline", () => {
    it("includes RFI due if received but not submitted", () => {
      const caseData = fixtures.eta9089.eta9089WithRFI();
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfiDeadline = deadlines.find((d) => d.type === "rfi_due");
      expect(rfiDeadline).toBeDefined();
      // Array structure: get responseDueDate from first active entry
      const activeRfi = caseData.rfiEntries.find((e) => e.receivedDate && !e.responseSubmittedDate);
      expect(rfiDeadline?.date).toBe(activeRfi?.responseDueDate);
      expect(rfiDeadline?.label).toContain("RFI Response Due");
    });

    it("excludes RFI if received but already submitted", () => {
      const baseData = fixtures.eta9089.eta9089WithRFI();
      const caseData = {
        ...baseData,
        rfiEntries: baseData.rfiEntries.map((e) => ({
          ...e,
          responseSubmittedDate: daysAgo(5),
        })),
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfiDeadline = deadlines.find((d) => d.type === "rfi_due");
      expect(rfiDeadline).toBeUndefined();
    });

    it("excludes RFI if not received", () => {
      const caseData = fixtures.eta9089.eta9089Pending();
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfiDeadline = deadlines.find((d) => d.type === "rfi_due");
      expect(rfiDeadline).toBeUndefined();
    });
  });

  describe("RFE due deadline", () => {
    it("includes RFE due if received but not submitted", () => {
      const caseData = fixtures.i140.i140WithRFE();
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfeDeadline = deadlines.find((d) => d.type === "rfe_due");
      expect(rfeDeadline).toBeDefined();
      // Array structure: get responseDueDate from first active entry
      const activeRfe = caseData.rfeEntries.find((e) => e.receivedDate && !e.responseSubmittedDate);
      expect(rfeDeadline?.date).toBe(activeRfe?.responseDueDate);
      expect(rfeDeadline?.label).toContain("RFE Response Due");
    });

    it("excludes RFE if received but already submitted", () => {
      const baseData = fixtures.i140.i140WithRFE();
      const caseData = {
        ...baseData,
        rfeEntries: baseData.rfeEntries.map((e) => ({
          ...e,
          responseSubmittedDate: daysAgo(10),
        })),
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfeDeadline = deadlines.find((d) => d.type === "rfe_due");
      expect(rfeDeadline).toBeUndefined();
    });

    it("excludes RFE if not received", () => {
      const caseData = fixtures.i140.i140Pending();
      const deadlines = extractDeadlines(caseData, todayISO);

      const rfeDeadline = deadlines.find((d) => d.type === "rfe_due");
      expect(rfeDeadline).toBeUndefined();
    });
  });

  describe("I-140 filing deadline", () => {
    it("includes I-140 filing deadline if ETA 9089 certified but I-140 not filed", () => {
      const caseData = fixtures.eta9089.eta9089Certified();
      const deadlines = extractDeadlines(caseData, todayISO);

      const i140Deadline = deadlines.find((d) => d.type === "i140_filing_deadline");
      expect(i140Deadline).toBeDefined();
      expect(i140Deadline?.date).toBe(caseData.eta9089ExpirationDate);
      expect(i140Deadline?.label).toContain("I-140 Filing Deadline");
    });

    it("excludes I-140 filing deadline if I-140 already filed", () => {
      const caseData = fixtures.i140.i140Pending();
      const deadlines = extractDeadlines(caseData, todayISO);

      const i140Deadline = deadlines.find((d) => d.type === "i140_filing_deadline");
      expect(i140Deadline).toBeUndefined();
    });

    it("excludes I-140 filing deadline if ETA 9089 not certified", () => {
      const caseData = fixtures.eta9089.eta9089Pending();
      const deadlines = extractDeadlines(caseData, todayISO);

      const i140Deadline = deadlines.find((d) => d.type === "i140_filing_deadline");
      expect(i140Deadline).toBeUndefined();
    });
  });

  describe("daysUntil calculation", () => {
    it("calculates positive daysUntil for future dates", () => {
      const futureDate = daysFromNow(10);
      const caseData = {
        ...fixtures.pwd.pwdWorking(),
        pwdExpirationDate: futureDate,
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines[0].daysUntil).toBe(10);
    });

    it("calculates negative daysUntil for past dates", () => {
      const pastDate = daysAgo(5);
      const caseData = {
        ...fixtures.pwd.pwdWorking(),
        pwdExpirationDate: pastDate,
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines[0].daysUntil).toBe(-5);
    });

    it("calculates 0 daysUntil for today", () => {
      const caseData = {
        ...fixtures.pwd.pwdWorking(),
        pwdExpirationDate: todayISO,
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines[0].daysUntil).toBe(0);
    });
  });

  describe("closed/deleted cases", () => {
    it("returns empty array for closed cases", () => {
      const caseData = fixtures.special.closedCase();
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines).toEqual([]);
    });

    it("returns empty array for deleted cases", () => {
      // Create case data with deletedAt set (simulating a soft-deleted case)
      const caseData = {
        ...fixtures.pwd.pwdWorking(),
        pwdExpirationDate: daysFromNow(30), // Would normally create a deadline
        deletedAt: Date.now(), // But case is deleted
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines).toEqual([]);
    });
  });

  describe("multiple deadlines", () => {
    it("returns all applicable deadlines for a case", () => {
      const caseData = {
        ...fixtures.eta9089.eta9089WithRFI(),
        // Has both PWD expiration (not filed yet) and RFI due
        eta9089FilingDate: undefined, // Remove to show PWD still relevant
      };
      const deadlines = extractDeadlines(caseData, todayISO);

      expect(deadlines.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// groupDeadlinesByUrgency(deadlines)
// ============================================================================

describe("groupDeadlinesByUrgency", () => {
  it("groups deadlines into 4 buckets (overdue, thisWeek, thisMonth, later)", () => {
    const deadlines = [
      {
        caseId: "1" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD Expiration",
        date: daysFromNow(-5),
        daysUntil: -5,
        beneficiaryName: "Test 1",
      },
      {
        caseId: "2" as Id<"cases">,
        type: "rfi_due" as const,
        label: "RFI Due",
        date: daysFromNow(3),
        daysUntil: 3,
        beneficiaryName: "Test 2",
      },
      {
        caseId: "3" as Id<"cases">,
        type: "rfe_due" as const,
        label: "RFE Due",
        date: daysFromNow(15),
        daysUntil: 15,
        beneficiaryName: "Test 3",
      },
      {
        caseId: "4" as Id<"cases">,
        type: "i140_filing_deadline" as const,
        label: "I-140 Filing",
        date: daysFromNow(100),
        daysUntil: 100,
        beneficiaryName: "Test 4",
      },
    ];

    const grouped = groupDeadlinesByUrgency(deadlines);

    expect(grouped.overdue.length).toBe(1);
    expect(grouped.thisWeek.length).toBe(1);
    expect(grouped.thisMonth.length).toBe(1);
    expect(grouped.later.length).toBe(1);
    expect(grouped.totalCount).toBe(4);
  });

  it("sorts each group by daysUntil ascending", () => {
    const deadlines = [
      {
        caseId: "1" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD 1",
        date: daysFromNow(-10),
        daysUntil: -10,
        beneficiaryName: "Test 1",
      },
      {
        caseId: "2" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD 2",
        date: daysFromNow(-2),
        daysUntil: -2,
        beneficiaryName: "Test 2",
      },
      {
        caseId: "3" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD 3",
        date: daysFromNow(-5),
        daysUntil: -5,
        beneficiaryName: "Test 3",
      },
    ];

    const grouped = groupDeadlinesByUrgency(deadlines);

    // Overdue should be sorted: -10, -5, -2 (most urgent first)
    expect(grouped.overdue[0].daysUntil).toBe(-10);
    expect(grouped.overdue[1].daysUntil).toBe(-5);
    expect(grouped.overdue[2].daysUntil).toBe(-2);
  });

  it("handles empty input", () => {
    const grouped = groupDeadlinesByUrgency([]);

    expect(grouped.overdue).toEqual([]);
    expect(grouped.thisWeek).toEqual([]);
    expect(grouped.thisMonth).toEqual([]);
    expect(grouped.later).toEqual([]);
    expect(grouped.totalCount).toBe(0);
  });

  it("calculates totalCount correctly", () => {
    const deadlines = [
      {
        caseId: "1" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD",
        date: daysFromNow(-5),
        daysUntil: -5,
        beneficiaryName: "Test 1",
      },
      {
        caseId: "2" as Id<"cases">,
        type: "rfi_due" as const,
        label: "RFI",
        date: daysFromNow(3),
        daysUntil: 3,
        beneficiaryName: "Test 2",
      },
    ];

    const grouped = groupDeadlinesByUrgency(deadlines);

    expect(grouped.totalCount).toBe(2);
  });

  it("handles all deadlines in one bucket", () => {
    const deadlines = [
      {
        caseId: "1" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD 1",
        date: daysFromNow(-5),
        daysUntil: -5,
        beneficiaryName: "Test 1",
      },
      {
        caseId: "2" as Id<"cases">,
        type: "pwd_expiration" as const,
        label: "PWD 2",
        date: daysFromNow(-10),
        daysUntil: -10,
        beneficiaryName: "Test 2",
      },
    ];

    const grouped = groupDeadlinesByUrgency(deadlines);

    expect(grouped.overdue.length).toBe(2);
    expect(grouped.thisWeek.length).toBe(0);
    expect(grouped.thisMonth.length).toBe(0);
    expect(grouped.later.length).toBe(0);
    expect(grouped.totalCount).toBe(2);
  });
});

// ============================================================================
// buildPwdSubtext(breakdown)
// ============================================================================

describe("buildPwdSubtext", () => {
  it("formats 'X working' for working count", () => {
    const breakdown = { working: 5, filed: 0 };
    const result = buildPwdSubtext(breakdown);
    expect(result).toBe("5 working");
  });

  it("formats 'X filed' for filed count", () => {
    const breakdown = { working: 0, filed: 3 };
    const result = buildPwdSubtext(breakdown);
    expect(result).toBe("3 filed");
  });

  it("formats 'X working, Y filed' for both", () => {
    const breakdown = { working: 4, filed: 2 };
    const result = buildPwdSubtext(breakdown);
    expect(result).toBe("4 working, 2 filed");
  });

  it("returns empty string for zero counts", () => {
    const breakdown = { working: 0, filed: 0 };
    const result = buildPwdSubtext(breakdown);
    expect(result).toBe("");
  });

  it("uses singular form for 1", () => {
    const breakdown = { working: 1, filed: 1 };
    const result = buildPwdSubtext(breakdown);
    expect(result).toBe("1 working, 1 filed");
  });
});

// ============================================================================
// buildRecruitmentSubtext(breakdown)
// ============================================================================

describe("buildRecruitmentSubtext", () => {
  it("formats 'X ready' for ready count", () => {
    const breakdown = { ready: 3, inProgress: 0 };
    const result = buildRecruitmentSubtext(breakdown);
    expect(result).toBe("3 ready");
  });

  it("formats 'X in progress' for inProgress count", () => {
    const breakdown = { ready: 0, inProgress: 2 };
    const result = buildRecruitmentSubtext(breakdown);
    expect(result).toBe("2 in progress");
  });

  it("formats 'X ready, Y in progress' for both", () => {
    const breakdown = { ready: 5, inProgress: 3 };
    const result = buildRecruitmentSubtext(breakdown);
    expect(result).toBe("5 ready, 3 in progress");
  });

  it("returns empty string for zero counts", () => {
    const breakdown = { ready: 0, inProgress: 0 };
    const result = buildRecruitmentSubtext(breakdown);
    expect(result).toBe("");
  });

  it("uses singular form for 1", () => {
    const breakdown = { ready: 1, inProgress: 1 };
    const result = buildRecruitmentSubtext(breakdown);
    expect(result).toBe("1 ready, 1 in progress");
  });
});

// ============================================================================
// buildEta9089Subtext(breakdown)
// ============================================================================

describe("buildEta9089Subtext", () => {
  it("formats 'X prep' for prep count", () => {
    const breakdown = { prep: 4, rfi: 0, filed: 0 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("4 prep");
  });

  it("formats 'X RFI' for rfi count", () => {
    const breakdown = { prep: 0, rfi: 2, filed: 0 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("2 RFI");
  });

  it("formats 'X filed' for filed count", () => {
    const breakdown = { prep: 0, rfi: 0, filed: 5 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("5 filed");
  });

  it("formats 'X prep, Y RFI, Z filed' for all", () => {
    const breakdown = { prep: 3, rfi: 1, filed: 2 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("3 prep, 1 RFI, 2 filed");
  });

  it("returns empty string for zero counts", () => {
    const breakdown = { prep: 0, rfi: 0, filed: 0 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("");
  });

  it("omits zero counts in output", () => {
    const breakdown = { prep: 3, rfi: 0, filed: 2 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("3 prep, 2 filed");
  });

  it("uses singular form for 1", () => {
    const breakdown = { prep: 1, rfi: 1, filed: 1 };
    const result = buildEta9089Subtext(breakdown);
    expect(result).toBe("1 prep, 1 RFI, 1 filed");
  });
});

// ============================================================================
// buildI140Subtext(breakdown)
// ============================================================================

describe("buildI140Subtext", () => {
  it("formats 'X prep' for prep count", () => {
    const breakdown = { prep: 5, rfe: 0, filed: 0 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("5 prep");
  });

  it("formats 'X RFE' for rfe count", () => {
    const breakdown = { prep: 0, rfe: 1, filed: 0 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("1 RFE");
  });

  it("formats 'X filed' for filed count", () => {
    const breakdown = { prep: 0, rfe: 0, filed: 3 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("3 filed");
  });

  it("formats 'X prep, Y RFE, Z filed' for all", () => {
    const breakdown = { prep: 4, rfe: 2, filed: 3 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("4 prep, 2 RFE, 3 filed");
  });

  it("returns empty string for zero counts", () => {
    const breakdown = { prep: 0, rfe: 0, filed: 0 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("");
  });

  it("omits zero counts in output", () => {
    const breakdown = { prep: 4, rfe: 0, filed: 3 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("4 prep, 3 filed");
  });

  it("uses singular form for 1", () => {
    const breakdown = { prep: 1, rfe: 1, filed: 1 };
    const result = buildI140Subtext(breakdown);
    expect(result).toBe("1 prep, 1 RFE, 1 filed");
  });
});
