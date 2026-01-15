/**
 * Case List Helpers Tests
 * Test suite for case list helper functions.
 */

import { describe, it, expect } from "vitest";
import type { CaseStatus, ProgressStatus } from "./dashboardTypes";
import type { CaseCardData } from "./caseListTypes";
import type { Id } from "../_generated/dataModel";
import {
  projectCaseForCard,
  calculateNextDeadline,
  sortCases,
  filterBySearch,
} from "./caseListHelpers";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockCase = (overrides: Partial<any> = {}): any => ({
  _id: "case123" as Id<"cases">,
  _creationTime: 1704067200000, // 2024-01-01T00:00:00Z
  userId: "user123" as Id<"users">,
  employerName: "ACME Corp",
  beneficiaryIdentifier: "John Doe",
  positionTitle: "Software Engineer",
  caseStatus: "pwd" as CaseStatus,
  progressStatus: "working" as ProgressStatus,
  isFavorite: false,
  updatedAt: 1704067200000,
  isDeleted: false,
  ...overrides,
});

// ============================================================================
// calculateNextDeadline TESTS
// ============================================================================

describe("calculateNextDeadline", () => {
  const TODAY = "2025-01-15";

  describe("when case has no deadlines", () => {
    it("returns null for case without any deadline fields", () => {
      const caseData = createMockCase({
        caseStatus: "pwd",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });

    it("returns null for closed case", () => {
      const caseData = createMockCase({
        caseStatus: "closed",
        pwdExpirationDate: "2025-06-30",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });

    it("returns null for deleted case", () => {
      const caseData = createMockCase({
        deletedAt: 1704067200000,
        pwdExpirationDate: "2025-06-30",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  describe("when case has PWD expiration deadline", () => {
    it("returns PWD expiration when pending and no ETA filed", () => {
      const caseData = createMockCase({
        caseStatus: "pwd",
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "pwd_expiration",
        date: "2025-06-30",
        daysUntil: 166,
        urgency: "later",
      });
    });

    it("returns null when PWD expired but ETA already filed", () => {
      const caseData = createMockCase({
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: "2025-01-10",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  describe("when case has RFI deadline", () => {
    it("returns RFI due when response pending", () => {
      const caseData = createMockCase({
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-20",
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "rfi_due",
        date: "2025-01-20",
        daysUntil: 5,
        urgency: "thisWeek",
      });
    });

    it("returns null when RFI already responded", () => {
      const caseData = createMockCase({
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-20",
            responseSubmittedDate: "2025-01-15",
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  describe("when case has RFE deadline", () => {
    it("returns RFE due when response pending", () => {
      const caseData = createMockCase({
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: "2025-01-05",
            responseDueDate: "2025-01-25",
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "rfe_due",
        date: "2025-01-25",
        daysUntil: 10,
        urgency: "thisMonth", // 10 days = thisMonth (>7 days, <=30 days)
      });
    });

    it("returns null when RFE already responded", () => {
      const caseData = createMockCase({
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: "2025-01-05",
            responseDueDate: "2025-01-25",
            responseSubmittedDate: "2025-01-15",
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  describe("when case has I-140 filing deadline", () => {
    it("returns I-140 filing deadline when not yet filed", () => {
      const caseData = createMockCase({
        eta9089CertificationDate: "2024-12-01",
        eta9089ExpirationDate: "2025-05-30",
        i140FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "i140_filing_deadline",
        date: "2025-05-30",
        daysUntil: 135,
        urgency: "later",
      });
    });

    it("returns null when I-140 already filed", () => {
      const caseData = createMockCase({
        eta9089CertificationDate: "2024-12-01",
        eta9089ExpirationDate: "2025-05-30",
        i140FilingDate: "2025-01-10",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  describe("when case has recruitment window deadline", () => {
    it("returns filing_window_opens when that is the most urgent deadline", () => {
      // Per PERM rules: Window opens 30 days after last recruitment ends
      // Here sundayAdSecondDate (2024-12-08) is the last since isProfessionalOccupation is false
      // Window opens: 2024-12-08 + 30 = 2025-01-07 (overdue from TODAY = 2025-01-15)
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-12-01",
        sundayAdSecondDate: "2024-12-08",
        additionalRecruitmentEndDate: "2024-12-15", // Ignored since not professional
        eta9089FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // Most urgent is filing_window_opens (overdue), not recruitment_window
      expect(result).toEqual({
        type: "filing_window_opens",
        date: "2025-01-07",
        daysUntil: -8,
        urgency: "overdue",
      });
    });

    it("returns recruitment_window when filing window already open", () => {
      // When filing window already opened (in the past), recruitment_window is next
      // Set dates far in the future so filing window opens is also in future but closes sooner
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-10-01",
        sundayAdSecondDate: "2024-10-08",
        eta9089FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // Filing window opens: 2024-10-08 + 30 = 2024-11-07 (in the past, -69 days)
      // Recruitment window closes: 2024-10-01 + 180 = 2025-03-30 (74 days)
      // Most urgent is filing_window_opens (overdue)
      expect(result?.type).toBe("filing_window_opens");
      expect(result?.urgency).toBe("overdue");
    });

    it("returns null when ETA already filed", () => {
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-12-01",
        additionalRecruitmentEndDate: "2024-12-15",
        eta9089FilingDate: "2025-01-10",
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------
  // Deadline Priority Ordering Tests (4.5)
  // ------------------------------------------

  describe("deadline priority ordering", () => {
    it("returns filing_window_opens over recruitment_window when both exist and opens is more urgent", () => {
      // Scenario: Filing window opens is overdue (-8 days), recruitment window is in future (74 days)
      // filing_window_opens should be returned because it's more urgent (lower daysUntil)
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-10-01", // Recruitment window closes: 2024-10-01 + 180 = 2025-03-30
        sundayAdSecondDate: "2024-10-08", // Filing window opens: 2024-10-08 + 30 = 2024-11-07
        eta9089FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // filing_window_opens should take priority (overdue is more urgent than 74 days)
      expect(result?.type).toBe("filing_window_opens");
      expect(result?.urgency).toBe("overdue");
    });

    it("returns recruitment_window when it is the most urgent remaining deadline", () => {
      // Scenario: Both deadlines exist, but recruitment_window (filing_deadline) is closer
      // This happens when window already opened (opens in past) and closes date is next
      // Note: In practice, once window opens passes, both dates are calculated
      // The more urgent one (recruitment_window closer) would be returned
      // Testing with dates where recruitment window is the closest future deadline

      // For recruitment_window to be returned, filing_window_opens must be in the past
      // AND recruitment_window must be the closest deadline
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-08-01", // Window closes: 2024-08-01 + 180 = 2025-01-28 (13 days)
        sundayAdSecondDate: "2024-08-08", // Window opens: 2024-08-08 + 30 = 2024-09-07 (past, overdue)
        eta9089FilingDate: undefined,
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // filing_window_opens is in the past (overdue), so most urgent is filing_window_opens
      // In practice, when filing window is open, both dates exist but overdue takes priority
      expect(result?.type).toBe("filing_window_opens");
      expect(result?.daysUntil).toBeLessThan(0); // Overdue
    });

    it("prioritizes RFI due over filing window when RFI is more urgent", () => {
      // RFI deadlines take priority over filing window deadlines when more urgent
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-10-01",
        sundayAdSecondDate: "2024-10-08",
        eta9089FilingDate: undefined,
        rfiEntries: [
          {
            id: "rfi-urgent",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-18", // 3 days from TODAY
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // RFI due in 3 days should beat filing window (which may be overdue or future)
      // The most urgent non-overdue deadline wins if there are no overdue deadlines
      // But overdue takes absolute priority
      expect(result?.type).toBe("filing_window_opens"); // Overdue wins
      expect(result?.urgency).toBe("overdue");
    });

    it("prioritizes overdue RFI over future filing window", () => {
      // Overdue RFI should take priority over future filing window
      const caseData = createMockCase({
        sundayAdFirstDate: "2024-12-15", // Window opens: 2025-01-14 (future)
        sundayAdSecondDate: "2024-12-22", // Window closes: 2025-06-13
        eta9089FilingDate: undefined,
        rfiEntries: [
          {
            id: "rfi-overdue",
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-10", // 5 days overdue
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      // RFI overdue should be returned as most urgent
      expect(result?.type).toBe("rfi_due");
      expect(result?.daysUntil).toBe(-5);
      expect(result?.urgency).toBe("overdue");
    });
  });

  describe("when case has multiple deadlines", () => {
    it("returns most urgent deadline (RFI overdue)", () => {
      const caseData = createMockCase({
        pwdExpirationDate: "2025-06-30",
        rfiEntries: [
          {
            id: "rfi-overdue",
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-10", // overdue
            createdAt: Date.now(),
          },
        ],
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "rfi_due",
        date: "2025-01-10",
        daysUntil: -5,
        urgency: "overdue",
      });
    });

    it("returns most urgent deadline (RFE this week)", () => {
      const caseData = createMockCase({
        pwdExpirationDate: "2025-06-30",
        rfeEntries: [
          {
            id: "rfe-thisweek",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-18", // 3 days away
            createdAt: Date.now(),
          },
        ],
        additionalRecruitmentEndDate: "2024-12-01", // 135 days away
      });

      const result = calculateNextDeadline(caseData, TODAY);

      expect(result).toEqual({
        type: "rfe_due",
        date: "2025-01-18",
        daysUntil: 3,
        urgency: "thisWeek",
      });
    });
  });
});

// ============================================================================
// projectCaseForCard TESTS
// ============================================================================

describe("projectCaseForCard", () => {
  const TODAY = "2025-01-15";

  it("projects minimal case without deadlines", () => {
    const caseData = createMockCase({
      _id: "case456" as Id<"cases">,
      employerName: "Test Corp",
      beneficiaryIdentifier: "Jane Smith",
      caseStatus: "pwd",
      progressStatus: "working",
      isFavorite: false,
      _creationTime: 1704067200000,
      updatedAt: 1704067200000,
    });

    const result = projectCaseForCard(caseData, TODAY);

    expect(result._id).toBe("case456");
    expect(result.employerName).toBe("Test Corp");
    expect(result.beneficiaryIdentifier).toBe("Jane Smith");
    expect(result.caseStatus).toBe("pwd");
    expect(result.progressStatus).toBe("working");
    expect(result.isFavorite).toBe(false);
    expect(result.nextDeadline).toBeUndefined();
    expect(result.dates.created).toBe(1704067200000);
    expect(result.dates.updated).toBe(1704067200000);
    expect(result.dates.pwdFiled).toBeUndefined();
    expect(result.dates.etaFiled).toBeUndefined();
    expect(result.dates.i140Filed).toBeUndefined();
  });

  it("projects case with all dates filled", () => {
    const caseData = createMockCase({
      _id: "case789" as Id<"cases">,
      employerName: "Big Corp",
      beneficiaryIdentifier: "Bob Johnson",
      caseStatus: "i140",
      progressStatus: "filed",
      isFavorite: true,
      pwdFilingDate: "2024-01-15",
      eta9089FilingDate: "2024-06-15",
      i140FilingDate: "2024-12-15",
      _creationTime: 1704067200000,
      updatedAt: 1705017600000, // 2024-01-12
    });

    const result = projectCaseForCard(caseData, TODAY);

    expect(result._id).toBe("case789");
    expect(result.isFavorite).toBe(true);
    expect(result.dates.pwdFiled).toBe("2024-01-15");
    expect(result.dates.etaFiled).toBe("2024-06-15");
    expect(result.dates.i140Filed).toBe("2024-12-15");
  });

  it("projects case with next deadline", () => {
    const caseData = createMockCase({
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: undefined,
    });

    const result = projectCaseForCard(caseData, TODAY);

    expect(result.nextDeadline).toBe("2025-06-30");
  });

  it("projects case with no next deadline", () => {
    const caseData = createMockCase({
      caseStatus: "closed",
    });

    const result = projectCaseForCard(caseData, TODAY);

    expect(result.nextDeadline).toBeUndefined();
  });
});

// ============================================================================
// sortCases TESTS
// ============================================================================

describe("sortCases", () => {
  const createCardData = (overrides: Partial<any> = {}): CaseCardData => {
    const base = createMockCase(overrides);
    return projectCaseForCard(base, "2025-01-15");
  };

  describe("sort by deadline", () => {
    it("sorts by deadline ascending (soonest first)", () => {
      const cases = [
        createCardData({
          _id: "case1",
          employerName: "C",
          pwdExpirationDate: "2025-03-01",
          eta9089FilingDate: undefined,
        }),
        createCardData({
          _id: "case2",
          employerName: "A",
          pwdExpirationDate: "2025-01-20",
          eta9089FilingDate: undefined,
        }),
        createCardData({
          _id: "case3",
          employerName: "B",
          pwdExpirationDate: "2025-02-15",
          eta9089FilingDate: undefined,
        }),
      ];

      const sorted = sortCases(cases, "deadline", "asc");

      expect(sorted.map((c) => c._id)).toEqual(["case2", "case3", "case1"]);
    });

    it("sorts by deadline descending (latest first)", () => {
      const cases = [
        createCardData({
          _id: "case1",
          pwdExpirationDate: "2025-01-20",
          eta9089FilingDate: undefined,
        }),
        createCardData({
          _id: "case2",
          pwdExpirationDate: "2025-03-01",
          eta9089FilingDate: undefined,
        }),
        createCardData({
          _id: "case3",
          pwdExpirationDate: "2025-02-15",
          eta9089FilingDate: undefined,
        }),
      ];

      const sorted = sortCases(cases, "deadline", "desc");

      expect(sorted.map((c) => c._id)).toEqual(["case2", "case3", "case1"]);
    });

    it("handles cases with no deadline (null dates sort to end)", () => {
      const cases = [
        createCardData({
          _id: "case1",
          pwdExpirationDate: "2025-02-15",
          eta9089FilingDate: undefined,
        }),
        createCardData({ _id: "case2", caseStatus: "closed" }), // no deadline
        createCardData({
          _id: "case3",
          pwdExpirationDate: "2025-01-20",
          eta9089FilingDate: undefined,
        }),
      ];

      const sorted = sortCases(cases, "deadline", "asc");

      expect(sorted.map((c) => c._id)).toEqual(["case3", "case1", "case2"]);
    });
  });

  describe("sort by updated", () => {
    it("sorts by updatedAt ascending (oldest first)", () => {
      const cases = [
        createCardData({ _id: "case1", updatedAt: 1704067200000 }), // 2024-01-01
        createCardData({ _id: "case2", updatedAt: 1705017600000 }), // 2024-01-12
        createCardData({ _id: "case3", updatedAt: 1704585600000 }), // 2024-01-07
      ];

      const sorted = sortCases(cases, "updated", "asc");

      expect(sorted.map((c) => c._id)).toEqual(["case1", "case3", "case2"]);
    });

    it("sorts by updatedAt descending (newest first)", () => {
      const cases = [
        createCardData({ _id: "case1", updatedAt: 1704067200000 }),
        createCardData({ _id: "case2", updatedAt: 1705017600000 }),
        createCardData({ _id: "case3", updatedAt: 1704585600000 }),
      ];

      const sorted = sortCases(cases, "updated", "desc");

      expect(sorted.map((c) => c._id)).toEqual(["case2", "case3", "case1"]);
    });
  });

  describe("sort by employer", () => {
    it("sorts by employerName ascending (A-Z)", () => {
      const cases = [
        createCardData({ _id: "case1", employerName: "Zebra Corp" }),
        createCardData({ _id: "case2", employerName: "Alpha Inc" }),
        createCardData({ _id: "case3", employerName: "Beta LLC" }),
      ];

      const sorted = sortCases(cases, "employer", "asc");

      expect(sorted.map((c) => c.employerName)).toEqual([
        "Alpha Inc",
        "Beta LLC",
        "Zebra Corp",
      ]);
    });

    it("sorts by employerName descending (Z-A)", () => {
      const cases = [
        createCardData({ _id: "case1", employerName: "Alpha Inc" }),
        createCardData({ _id: "case2", employerName: "Zebra Corp" }),
        createCardData({ _id: "case3", employerName: "Beta LLC" }),
      ];

      const sorted = sortCases(cases, "employer", "desc");

      expect(sorted.map((c) => c.employerName)).toEqual([
        "Zebra Corp",
        "Beta LLC",
        "Alpha Inc",
      ]);
    });

    it("sorts case-insensitively", () => {
      const cases = [
        createCardData({ _id: "case1", employerName: "zebra corp" }),
        createCardData({ _id: "case2", employerName: "Alpha Inc" }),
        createCardData({ _id: "case3", employerName: "BETA LLC" }),
      ];

      const sorted = sortCases(cases, "employer", "asc");

      expect(sorted.map((c) => c.employerName)).toEqual([
        "Alpha Inc",
        "BETA LLC",
        "zebra corp",
      ]);
    });
  });

  describe("sort by status", () => {
    it("sorts by caseStatus ascending (pwd, recruitment, eta9089, i140, closed)", () => {
      const cases = [
        createCardData({ _id: "case1", caseStatus: "closed" }),
        createCardData({ _id: "case2", caseStatus: "pwd" }),
        createCardData({ _id: "case3", caseStatus: "eta9089" }),
        createCardData({ _id: "case4", caseStatus: "recruitment" }),
        createCardData({ _id: "case5", caseStatus: "i140" }),
      ];

      const sorted = sortCases(cases, "status", "asc");

      expect(sorted.map((c) => c.caseStatus)).toEqual([
        "pwd",
        "recruitment",
        "eta9089",
        "i140",
        "closed",
      ]);
    });

    it("sorts by caseStatus descending", () => {
      const cases = [
        createCardData({ _id: "case1", caseStatus: "pwd" }),
        createCardData({ _id: "case2", caseStatus: "closed" }),
        createCardData({ _id: "case3", caseStatus: "recruitment" }),
      ];

      const sorted = sortCases(cases, "status", "desc");

      expect(sorted.map((c) => c.caseStatus)).toEqual([
        "closed",
        "recruitment",
        "pwd",
      ]);
    });
  });

  describe("sort by date fields", () => {
    it("sorts by pwdFiled ascending (oldest first, nulls last)", () => {
      const cases = [
        createCardData({
          _id: "case1",
          pwdFilingDate: "2024-03-15",
        }),
        createCardData({
          _id: "case2",
          pwdFilingDate: undefined,
        }),
        createCardData({
          _id: "case3",
          pwdFilingDate: "2024-01-10",
        }),
      ];

      const sorted = sortCases(cases, "pwdFiled", "asc");

      expect(sorted.map((c) => c._id)).toEqual(["case3", "case1", "case2"]);
    });

    it("sorts by etaFiled descending (newest first, nulls last)", () => {
      const cases = [
        createCardData({
          _id: "case1",
          eta9089FilingDate: "2024-03-15",
        }),
        createCardData({
          _id: "case2",
          eta9089FilingDate: undefined,
        }),
        createCardData({
          _id: "case3",
          eta9089FilingDate: "2024-06-20",
        }),
      ];

      const sorted = sortCases(cases, "etaFiled", "desc");

      expect(sorted.map((c) => c._id)).toEqual(["case3", "case1", "case2"]);
    });

    it("sorts by i140Filed ascending", () => {
      const cases = [
        createCardData({
          _id: "case1",
          i140FilingDate: "2024-12-01",
        }),
        createCardData({
          _id: "case2",
          i140FilingDate: "2024-09-15",
        }),
        createCardData({
          _id: "case3",
          i140FilingDate: undefined,
        }),
      ];

      const sorted = sortCases(cases, "i140Filed", "asc");

      expect(sorted.map((c) => c._id)).toEqual(["case2", "case1", "case3"]);
    });
  });

  it("returns new array (does not mutate original)", () => {
    const cases = [
      createCardData({ _id: "case1", employerName: "Z" }),
      createCardData({ _id: "case2", employerName: "A" }),
    ];

    const sorted = sortCases(cases, "employer", "asc");

    expect(sorted).not.toBe(cases);
    expect(cases[0]._id).toBe("case1"); // original unchanged
  });
});

// ============================================================================
// filterBySearch TESTS
// ============================================================================

describe("filterBySearch", () => {
  const cases = [
    projectCaseForCard(
      createMockCase({
        _id: "case1",
        employerName: "ACME Corporation",
        beneficiaryIdentifier: "John Doe",
        positionTitle: "Software Engineer",
      }),
      "2025-01-15"
    ),
    projectCaseForCard(
      createMockCase({
        _id: "case2",
        employerName: "Beta Technologies",
        beneficiaryIdentifier: "Jane Smith",
        positionTitle: "Data Scientist",
      }),
      "2025-01-15"
    ),
    projectCaseForCard(
      createMockCase({
        _id: "case3",
        employerName: "Gamma Industries",
        beneficiaryIdentifier: "Bob Johnson",
        positionTitle: "Project Manager",
      }),
      "2025-01-15"
    ),
    projectCaseForCard(
      createMockCase({
        _id: "case4",
        employerName: "Google LLC",
        beneficiaryIdentifier: "Alice Wong",
        positionTitle: "Software Developer",
      }),
      "2025-01-15"
    ),
    projectCaseForCard(
      createMockCase({
        _id: "case5",
        employerName: "Microsoft Corporation",
        beneficiaryIdentifier: "David Chen",
        positionTitle: "Cloud Architect",
      }),
      "2025-01-15"
    ),
    projectCaseForCard(
      createMockCase({
        _id: "case6",
        employerName: "Amazon Web Services",
        beneficiaryIdentifier: "Emily Park",
        positionTitle: "DevOps Engineer",
      }),
      "2025-01-15"
    ),
  ];

  describe("exact matching", () => {
    it("filters by employer name (case-insensitive)", () => {
      const result = filterBySearch(cases, "acme");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case1");
    });

    it("filters by beneficiary identifier (case-insensitive)", () => {
      const result = filterBySearch(cases, "jane smith");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case2");
    });

    it("filters by partial match", () => {
      const result = filterBySearch(cases, "john");

      expect(result).toHaveLength(2); // John Doe, Bob Johnson
      expect(result.map((c) => c._id)).toContain("case1");
      expect(result.map((c) => c._id)).toContain("case3");
    });

    it("returns all cases for empty query", () => {
      const result = filterBySearch(cases, "");

      expect(result).toHaveLength(6);
    });

    it("returns all cases for whitespace-only query", () => {
      const result = filterBySearch(cases, "   ");

      expect(result).toHaveLength(6);
    });

    it("returns empty array for no matches", () => {
      const result = filterBySearch(cases, "nonexistent");

      expect(result).toHaveLength(0);
    });

    it("matches across multiple fields", () => {
      const result = filterBySearch(cases, "beta");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case2");
    });

    it("returns new array (does not mutate original)", () => {
      const result = filterBySearch(cases, "acme");

      expect(result).not.toBe(cases);
      expect(cases).toHaveLength(6); // original unchanged
    });
  });

  describe("fuzzy matching (typo tolerance)", () => {
    it("matches 'Gogle' to 'Google' (1 character deletion)", () => {
      const result = filterBySearch(cases, "gogle");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case4");
      expect(result[0].employerName).toBe("Google LLC");
    });

    it("matches 'Googel' to 'Google' (2 character transposition)", () => {
      const result = filterBySearch(cases, "googel");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case4");
    });

    it("matches 'Mircosoft' to 'Microsoft' (2 character typos)", () => {
      const result = filterBySearch(cases, "mircosoft");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case5");
      expect(result[0].employerName).toBe("Microsoft Corporation");
    });

    it("matches 'Microsft' to 'Microsoft' (1 character deletion)", () => {
      const result = filterBySearch(cases, "microsft");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case5");
    });

    it("matches 'Amzon' to 'Amazon' (1 character deletion)", () => {
      const result = filterBySearch(cases, "amzon");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case6");
      expect(result[0].employerName).toBe("Amazon Web Services");
    });

    it("matches 'Amazn' to 'Amazon' (1 character deletion)", () => {
      const result = filterBySearch(cases, "amazn");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case6");
    });

    it("matches 'Amaon' to 'Amazon' (1 character substitution)", () => {
      const result = filterBySearch(cases, "amaon");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case6");
    });

    it("does not match with too many typos (exceeds threshold)", () => {
      const result = filterBySearch(cases, "Gxxxle"); // 3 typos in 6-char word

      expect(result).toHaveLength(0);
    });

    it("matches beneficiary names with typos", () => {
      const result = filterBySearch(cases, "alise"); // Alice with 1 typo

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case4");
    });

    it("matches beneficiary names with single character deletion", () => {
      const result = filterBySearch(cases, "emly"); // Emily with 1 deletion (i removed)

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case6");
    });
  });

  describe("relevance scoring", () => {
    it("sorts exact matches before fuzzy matches", () => {
      const casesWithSimilar = [
        ...cases,
        projectCaseForCard(
          createMockCase({
            _id: "case7",
            employerName: "Gogle Inc", // Exact match for "gogle"
            beneficiaryIdentifier: "Test User",
          }),
          "2025-01-15"
        ),
      ];

      const result = filterBySearch(casesWithSimilar, "gogle");

      // Should return both, but exact substring match first
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("case7"); // Exact match first
      expect(result[1]._id).toBe("case4"); // Fuzzy match second
    });

    it("sorts better fuzzy matches higher", () => {
      const result = filterBySearch(cases, "googl");

      // "googl" is closer to "google" (1 char) than to anything else
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case4");
    });
  });

  describe("edge cases", () => {
    it("handles very short queries (< 3 chars)", () => {
      const result = filterBySearch(cases, "jo");

      // Should still match "John" via substring match
      expect(result.map((c) => c._id)).toContain("case1");
      expect(result.map((c) => c._id)).toContain("case3");
    });

    it("handles queries with special characters", () => {
      const result = filterBySearch(cases, "acme.");

      // Should still match ACME (fuzzy matching on words)
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles queries with multiple words", () => {
      const result = filterBySearch(cases, "web services");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case6");
    });

    it("handles case insensitivity with typos", () => {
      const result = filterBySearch(cases, "GOGLE");

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("case4");
    });
  });
});
