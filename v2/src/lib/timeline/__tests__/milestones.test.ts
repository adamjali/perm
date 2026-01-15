/**
 * Tests for Timeline Milestone Utilities
 *
 * Tests cover:
 * - extractMilestones: static milestones, calculated milestones, RFI/RFE deadlines
 * - extractRangeBars: job order period extraction
 * - calculateReadyToFileDate: 30 days after last recruitment
 * - calculateRecruitmentExpiresDate: 180 days from first recruitment
 */

import { describe, it, expect } from "vitest";
import { format, addDays, parseISO } from "date-fns";
import {
  extractMilestones,
  extractRangeBars,
  calculateReadyToFileDate,
  calculateRecruitmentExpiresDate,
  extractRfiDeadlines,
  extractRfeDeadlines,
} from "../milestones";
import type { CaseWithDates, RfiEntry, RfeEntry } from "../types";

// Helper to format dates consistently - use parseISO to match implementation behavior
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

// Helper to parse ISO date strings consistently with the implementation
const toDate = (isoString: string) => parseISO(isoString);

describe("extractMilestones", () => {
  describe("static milestones", () => {
    it("should return static milestones from case data", () => {
      const caseData: CaseWithDates = {
        pwdFilingDate: "2024-01-15",
        pwdDeterminationDate: "2024-02-15",
        pwdExpirationDate: "2025-06-30",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
      };

      const milestones = extractMilestones(caseData);

      // Check that static milestones are present
      expect(milestones.some((m) => m.field === "pwdFilingDate")).toBe(true);
      expect(milestones.some((m) => m.field === "pwdDeterminationDate")).toBe(true);
      expect(milestones.some((m) => m.field === "pwdExpirationDate")).toBe(true);
      expect(milestones.some((m) => m.field === "sundayAdFirstDate")).toBe(true);
      expect(milestones.some((m) => m.field === "sundayAdSecondDate")).toBe(true);

      // Verify milestone structure
      const pwdFiled = milestones.find((m) => m.field === "pwdFilingDate");
      expect(pwdFiled).toMatchObject({
        field: "pwdFilingDate",
        label: "PWD Filed",
        date: "2024-01-15",
        stage: "pwd",
        isCalculated: false,
      });
    });

    it("should exclude milestones with no date", () => {
      const caseData: CaseWithDates = {
        pwdFilingDate: "2024-01-15",
        // pwdDeterminationDate is undefined
        pwdExpirationDate: undefined,
      };

      const milestones = extractMilestones(caseData);

      expect(milestones.some((m) => m.field === "pwdFilingDate")).toBe(true);
      expect(milestones.some((m) => m.field === "pwdDeterminationDate")).toBe(false);
      expect(milestones.some((m) => m.field === "pwdExpirationDate")).toBe(false);
    });

    it("should sort milestones by date ascending", () => {
      const caseData: CaseWithDates = {
        pwdFilingDate: "2024-03-01",
        pwdDeterminationDate: "2024-01-01",
        pwdExpirationDate: "2024-02-01",
      };

      const milestones = extractMilestones(caseData);

      // Should be sorted by date
      expect(milestones[0].date).toBe("2024-01-01");
      expect(milestones[1].date).toBe("2024-02-01");
      expect(milestones[2].date).toBe("2024-03-01");
    });
  });

  describe("calculated milestones", () => {
    it("should calculate Ready to File date correctly", () => {
      const caseData: CaseWithDates = {
        sundayAdSecondDate: "2024-03-10",
        jobOrderEndDate: "2024-03-31", // Latest
      };

      const milestones = extractMilestones(caseData);

      const readyToFile = milestones.find((m) => m.field === "readyToFile");
      expect(readyToFile).toBeDefined();
      expect(readyToFile?.isCalculated).toBe(true);
      expect(readyToFile?.label).toBe("Ready to File");

      // 30 days after job order end (2024-03-31)
      const expectedDate = formatDate(addDays(toDate("2024-03-31"), 30));
      expect(readyToFile?.date).toBe(expectedDate);
    });

    it("should calculate Filing Deadline (recruitment expires) date correctly", () => {
      const caseData: CaseWithDates = {
        sundayAdFirstDate: "2024-03-03", // Earliest
        jobOrderStartDate: "2024-03-15",
      };

      const milestones = extractMilestones(caseData);

      const recruitmentExpires = milestones.find((m) => m.field === "recruitmentExpires");
      expect(recruitmentExpires).toBeDefined();
      expect(recruitmentExpires?.isCalculated).toBe(true);
      expect(recruitmentExpires?.label).toBe("Filing Deadline"); // Renamed from "Recruitment Expires"

      // 180 days from first sunday ad (2024-03-03)
      const expectedDate = formatDate(addDays(toDate("2024-03-03"), 180));
      expect(recruitmentExpires?.date).toBe(expectedDate);
    });

    it("should skip calculated milestones when ETA 9089 filed", () => {
      const caseData: CaseWithDates = {
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        eta9089FilingDate: "2024-05-01", // ETA filed!
      };

      const milestones = extractMilestones(caseData);

      // Should NOT have calculated milestones
      expect(milestones.some((m) => m.field === "readyToFile")).toBe(false);
      expect(milestones.some((m) => m.field === "recruitmentExpires")).toBe(false);

      // Should have the static ETA filing milestone
      expect(milestones.some((m) => m.field === "eta9089FilingDate")).toBe(true);
    });
  });

  describe("RFI/RFE deadlines", () => {
    it("should extract active RFI deadlines", () => {
      const caseData: CaseWithDates = {
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2024-03-01",
            responseDueDate: "2024-03-31",
            createdAt: Date.now(),
          },
        ],
      };

      const milestones = extractMilestones(caseData);

      const rfiDeadline = milestones.find((m) => m.field === "rfiDeadline_rfi-1");
      expect(rfiDeadline).toBeDefined();
      expect(rfiDeadline?.date).toBe("2024-03-31");
      expect(rfiDeadline?.stage).toBe("rfi");
    });

    it("should extract active RFE deadlines", () => {
      const caseData: CaseWithDates = {
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: "2024-04-01",
            responseDueDate: "2024-05-15",
            createdAt: Date.now(),
          },
        ],
      };

      const milestones = extractMilestones(caseData);

      const rfeDeadline = milestones.find((m) => m.field === "rfeDeadline_rfe-1");
      expect(rfeDeadline).toBeDefined();
      expect(rfeDeadline?.date).toBe("2024-05-15");
      expect(rfeDeadline?.stage).toBe("rfe");
    });

    it("should not include resolved RFI entries (has responseSubmittedDate)", () => {
      const caseData: CaseWithDates = {
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2024-03-01",
            responseDueDate: "2024-03-31",
            responseSubmittedDate: "2024-03-15", // Resolved!
            createdAt: Date.now(),
          },
        ],
      };

      const milestones = extractMilestones(caseData);

      expect(milestones.some((m) => m.field === "rfiDeadline_rfi-1")).toBe(false);
    });

    it("should number multiple RFIs/RFEs", () => {
      const caseData: CaseWithDates = {
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: "2024-03-01",
            responseDueDate: "2024-03-31",
            createdAt: Date.now(),
          },
          {
            id: "rfi-2",
            receivedDate: "2024-04-01",
            responseDueDate: "2024-05-01",
            createdAt: Date.now(),
          },
        ],
      };

      const milestones = extractMilestones(caseData);

      const rfi1 = milestones.find((m) => m.field === "rfiDeadline_rfi-1");
      const rfi2 = milestones.find((m) => m.field === "rfiDeadline_rfi-2");

      expect(rfi1?.label).toContain("#1");
      expect(rfi2?.label).toContain("#2");
      expect(rfi1?.order).toBe(1);
      expect(rfi2?.order).toBe(2);
    });
  });
});

describe("extractRangeBars", () => {
  it("should return job order period", () => {
    const caseData: CaseWithDates = {
      jobOrderStartDate: "2024-03-01",
      jobOrderEndDate: "2024-03-31",
    };

    const rangeBars = extractRangeBars(caseData);

    expect(rangeBars).toHaveLength(1);
    expect(rangeBars[0]).toMatchObject({
      field: "jobOrder",
      label: "Job Order Period",
      startDate: "2024-03-01",
      endDate: "2024-03-31",
      stage: "recruitment",
    });
  });

  it("should return empty array when no job order dates", () => {
    const caseData: CaseWithDates = {
      pwdFilingDate: "2024-01-15",
    };

    const rangeBars = extractRangeBars(caseData);

    expect(rangeBars).toHaveLength(0);
  });

  it("should return empty array when only start date present", () => {
    const caseData: CaseWithDates = {
      jobOrderStartDate: "2024-03-01",
      // Missing jobOrderEndDate
    };

    const rangeBars = extractRangeBars(caseData);

    expect(rangeBars).toHaveLength(0);
  });

  it("should return empty array when only end date present", () => {
    const caseData: CaseWithDates = {
      // Missing jobOrderStartDate
      jobOrderEndDate: "2024-03-31",
    };

    const rangeBars = extractRangeBars(caseData);

    expect(rangeBars).toHaveLength(0);
  });
});

describe("calculateReadyToFileDate", () => {
  it("should return null with no recruitment data", () => {
    const caseData: CaseWithDates = {};

    const result = calculateReadyToFileDate(caseData);

    expect(result).toBeNull();
  });

  it("should return null when only sundayAdFirstDate present", () => {
    const caseData: CaseWithDates = {
      sundayAdFirstDate: "2024-03-03",
    };

    const result = calculateReadyToFileDate(caseData);

    expect(result).toBeNull();
  });

  it("should calculate from sundayAdSecondDate when latest", () => {
    const caseData: CaseWithDates = {
      sundayAdSecondDate: "2024-04-07",
      jobOrderEndDate: "2024-03-31",
    };

    const result = calculateReadyToFileDate(caseData);

    // 30 days after 2024-04-07
    const expected = formatDate(addDays(toDate("2024-04-07"), 30));
    expect(result).toBe(expected);
  });

  it("should calculate from jobOrderEndDate when latest", () => {
    const caseData: CaseWithDates = {
      sundayAdSecondDate: "2024-03-10",
      jobOrderEndDate: "2024-03-31",
    };

    const result = calculateReadyToFileDate(caseData);

    // 30 days after 2024-03-31
    const expected = formatDate(addDays(toDate("2024-03-31"), 30));
    expect(result).toBe(expected);
  });

  it("should handle only sundayAdSecondDate present", () => {
    const caseData: CaseWithDates = {
      sundayAdSecondDate: "2024-03-10",
    };

    const result = calculateReadyToFileDate(caseData);

    const expected = formatDate(addDays(toDate("2024-03-10"), 30));
    expect(result).toBe(expected);
  });

  it("should handle only jobOrderEndDate present", () => {
    const caseData: CaseWithDates = {
      jobOrderEndDate: "2024-03-31",
    };

    const result = calculateReadyToFileDate(caseData);

    const expected = formatDate(addDays(toDate("2024-03-31"), 30));
    expect(result).toBe(expected);
  });
});

describe("calculateRecruitmentExpiresDate", () => {
  it("should return null with no recruitment start dates", () => {
    const caseData: CaseWithDates = {};

    const result = calculateRecruitmentExpiresDate(caseData);

    expect(result).toBeNull();
  });

  it("should calculate from sundayAdFirstDate when earliest", () => {
    const caseData: CaseWithDates = {
      sundayAdFirstDate: "2024-03-03",
      jobOrderStartDate: "2024-03-15",
    };

    const result = calculateRecruitmentExpiresDate(caseData);

    // 180 days from 2024-03-03
    const expected = formatDate(addDays(toDate("2024-03-03"), 180));
    expect(result).toBe(expected);
  });

  it("should calculate from jobOrderStartDate when earliest", () => {
    const caseData: CaseWithDates = {
      sundayAdFirstDate: "2024-03-15",
      jobOrderStartDate: "2024-03-01",
    };

    const result = calculateRecruitmentExpiresDate(caseData);

    // 180 days from 2024-03-01
    const expected = formatDate(addDays(toDate("2024-03-01"), 180));
    expect(result).toBe(expected);
  });

  it("should handle only sundayAdFirstDate present", () => {
    const caseData: CaseWithDates = {
      sundayAdFirstDate: "2024-03-03",
    };

    const result = calculateRecruitmentExpiresDate(caseData);

    const expected = formatDate(addDays(toDate("2024-03-03"), 180));
    expect(result).toBe(expected);
  });

  it("should handle only jobOrderStartDate present", () => {
    const caseData: CaseWithDates = {
      jobOrderStartDate: "2024-03-01",
    };

    const result = calculateRecruitmentExpiresDate(caseData);

    const expected = formatDate(addDays(toDate("2024-03-01"), 180));
    expect(result).toBe(expected);
  });
});

describe("extractRfiDeadlines", () => {
  it("should extract active RFI with due date", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-1",
        receivedDate: "2024-03-01",
        responseDueDate: "2024-03-31",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfiDeadlines(entries);

    expect(milestones).toHaveLength(1);
    expect(milestones[0].field).toBe("rfiDeadline_rfi-1");
    expect(milestones[0].date).toBe("2024-03-31");
  });

  it("should filter out resolved RFIs", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-1",
        receivedDate: "2024-03-01",
        responseDueDate: "2024-03-31",
        responseSubmittedDate: "2024-03-15",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfiDeadlines(entries);

    expect(milestones).toHaveLength(0);
  });

  it("should use title as label when provided", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-1",
        title: "Employment Verification",
        receivedDate: "2024-03-01",
        responseDueDate: "2024-03-31",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfiDeadlines(entries);

    expect(milestones[0].label).toBe("Employment Verification");
  });

  it("should sort by received date and number multiple entries", () => {
    const entries: RfiEntry[] = [
      {
        id: "rfi-2",
        receivedDate: "2024-04-01",
        responseDueDate: "2024-05-01",
        createdAt: Date.now(),
      },
      {
        id: "rfi-1",
        receivedDate: "2024-03-01",
        responseDueDate: "2024-03-31",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfiDeadlines(entries);

    expect(milestones).toHaveLength(2);
    // First by received date should be #1
    expect(milestones[0].order).toBe(1);
    expect(milestones[0].label).toContain("#1");
    expect(milestones[1].order).toBe(2);
    expect(milestones[1].label).toContain("#2");
  });
});

describe("extractRfeDeadlines", () => {
  it("should extract active RFE with due date", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1",
        receivedDate: "2024-04-01",
        responseDueDate: "2024-05-15",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfeDeadlines(entries);

    expect(milestones).toHaveLength(1);
    expect(milestones[0].field).toBe("rfeDeadline_rfe-1");
    expect(milestones[0].date).toBe("2024-05-15");
    expect(milestones[0].stage).toBe("rfe");
  });

  it("should filter out resolved RFEs", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1",
        receivedDate: "2024-04-01",
        responseDueDate: "2024-05-15",
        responseSubmittedDate: "2024-05-01",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfeDeadlines(entries);

    expect(milestones).toHaveLength(0);
  });

  it("should use title as label when provided", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1",
        title: "Wage Level Evidence",
        receivedDate: "2024-04-01",
        responseDueDate: "2024-05-15",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfeDeadlines(entries);

    expect(milestones[0].label).toBe("Wage Level Evidence");
  });

  it("should handle multiple RFEs with numbering", () => {
    const entries: RfeEntry[] = [
      {
        id: "rfe-1",
        receivedDate: "2024-04-01",
        responseDueDate: "2024-05-15",
        createdAt: Date.now(),
      },
      {
        id: "rfe-2",
        receivedDate: "2024-06-01",
        responseDueDate: "2024-07-15",
        createdAt: Date.now(),
      },
    ];

    const milestones = extractRfeDeadlines(entries);

    expect(milestones).toHaveLength(2);
    expect(milestones[0].order).toBe(1);
    expect(milestones[1].order).toBe(2);
  });
});
