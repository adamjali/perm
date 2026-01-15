/**
 * Tests for Derived Date Calculations
 *
 * Tests the single source of truth for derived date calculations per 20 CFR 656.17.
 */

import { describe, it, expect } from "vitest";
import {
  calculateRecruitmentStartDate,
  calculateRecruitmentEndDate,
  calculateFilingWindowOpens,
  calculateFilingWindowCloses,
  calculateRecruitmentWindowCloses,
  calculateDerivedDates,
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
} from "./derivedCalculations";

// Imports for sync tests - verify both modules use same constants
import {
  FILING_WINDOW_WAIT_DAYS as FILING_WAIT_FILING,
  FILING_WINDOW_CLOSE_DAYS as FILING_CLOSE_FILING,
  RECRUITMENT_WINDOW_DAYS as RECRUITMENT_WINDOW_FILING,
  PWD_RECRUITMENT_BUFFER_DAYS as PWD_BUFFER_FILING,
  calculateFilingWindow,
  calculateRecruitmentWindowCloses as calculateRecruitmentWindowClosesFilingWindow,
} from "./perm/dates/filingWindow";
import {
  FILING_WINDOW_WAIT_DAYS as FILING_WAIT_CONSTANTS,
  FILING_WINDOW_CLOSE_DAYS as FILING_CLOSE_CONSTANTS,
  RECRUITMENT_WINDOW_DAYS as RECRUITMENT_WINDOW_CONSTANTS,
  PWD_RECRUITMENT_BUFFER_DAYS as PWD_BUFFER_CONSTANTS,
} from "./perm/constants";

// ============================================================================
// calculateRecruitmentStartDate
// ============================================================================

describe("calculateRecruitmentStartDate", () => {
  it("should return null when no dates are provided", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: null,
      jobOrderStartDate: null,
      noticeOfFilingStartDate: null,
    });

    expect(result).toBeNull();
  });

  it("should return null when all dates are undefined", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: undefined,
      jobOrderStartDate: undefined,
      noticeOfFilingStartDate: undefined,
    });

    expect(result).toBeNull();
  });

  it("should return single date when only one is provided", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: "2024-01-15",
      jobOrderStartDate: null,
      noticeOfFilingStartDate: null,
    });

    expect(result).toBe("2024-01-15");
  });

  it("should return earliest date from multiple dates", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: "2024-01-15",
      jobOrderStartDate: "2024-01-10", // Earliest
      noticeOfFilingStartDate: "2024-01-12",
    });

    expect(result).toBe("2024-01-10");
  });

  it("should handle dates in any order", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: "2024-01-05", // Earliest
      jobOrderStartDate: "2024-01-20",
      noticeOfFilingStartDate: "2024-01-15",
    });

    expect(result).toBe("2024-01-05");
  });

  it("should ignore invalid date formats", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: "invalid-date",
      jobOrderStartDate: "2024-01-15",
      noticeOfFilingStartDate: null,
    });

    expect(result).toBe("2024-01-15");
  });

  it("should return null when all dates are invalid", () => {
    const result = calculateRecruitmentStartDate({
      sundayAdFirstDate: "invalid",
      jobOrderStartDate: "also-invalid",
      noticeOfFilingStartDate: "not-a-date",
    });

    expect(result).toBeNull();
  });
});

// ============================================================================
// calculateRecruitmentEndDate
// ============================================================================

describe("calculateRecruitmentEndDate", () => {
  it("should return null when no dates are provided", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: null,
      jobOrderEndDate: null,
      noticeOfFilingEndDate: null,
      isProfessionalOccupation: false,
    });

    expect(result).toBeNull();
  });

  it("should return single date when only one is provided", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "2024-02-15",
      jobOrderEndDate: null,
      noticeOfFilingEndDate: null,
      isProfessionalOccupation: false,
    });

    expect(result).toBe("2024-02-15");
  });

  it("should return latest date from multiple dates (non-professional)", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "2024-01-22",
      jobOrderEndDate: "2024-02-10", // Latest
      noticeOfFilingEndDate: "2024-01-26",
      isProfessionalOccupation: false,
    });

    expect(result).toBe("2024-02-10");
  });

  describe("isProfessionalOccupation flag", () => {
    it("should IGNORE additionalRecruitmentEndDate when isProfessionalOccupation is false", () => {
      const result = calculateRecruitmentEndDate({
        sundayAdSecondDate: "2024-01-22",
        jobOrderEndDate: "2024-02-10",
        noticeOfFilingEndDate: "2024-01-26",
        additionalRecruitmentEndDate: "2024-03-15", // Would be latest, but ignored
        isProfessionalOccupation: false,
      });

      expect(result).toBe("2024-02-10");
    });

    it("should INCLUDE additionalRecruitmentEndDate when isProfessionalOccupation is true", () => {
      const result = calculateRecruitmentEndDate({
        sundayAdSecondDate: "2024-01-22",
        jobOrderEndDate: "2024-02-10",
        noticeOfFilingEndDate: "2024-01-26",
        additionalRecruitmentEndDate: "2024-03-15", // Latest
        isProfessionalOccupation: true,
      });

      expect(result).toBe("2024-03-15");
    });

    it("should IGNORE additionalRecruitmentMethods when isProfessionalOccupation is false", () => {
      const result = calculateRecruitmentEndDate({
        sundayAdSecondDate: "2024-01-22",
        jobOrderEndDate: "2024-02-10",
        noticeOfFilingEndDate: "2024-01-26",
        additionalRecruitmentMethods: [
          { date: "2024-04-01" }, // Would be latest, but ignored
          { date: "2024-03-20" },
        ],
        isProfessionalOccupation: false,
      });

      expect(result).toBe("2024-02-10");
    });

    it("should INCLUDE additionalRecruitmentMethods when isProfessionalOccupation is true", () => {
      const result = calculateRecruitmentEndDate({
        sundayAdSecondDate: "2024-01-22",
        jobOrderEndDate: "2024-02-10",
        noticeOfFilingEndDate: "2024-01-26",
        additionalRecruitmentMethods: [
          { date: "2024-04-01" }, // Latest
          { date: "2024-03-20" },
        ],
        isProfessionalOccupation: true,
      });

      expect(result).toBe("2024-04-01");
    });

    it("should consider all additional dates for professional occupations", () => {
      const result = calculateRecruitmentEndDate({
        sundayAdSecondDate: "2024-01-22",
        jobOrderEndDate: "2024-02-10",
        noticeOfFilingEndDate: "2024-01-26",
        additionalRecruitmentEndDate: "2024-05-01", // Latest overall
        additionalRecruitmentMethods: [
          { date: "2024-04-01" },
          { date: "2024-03-20" },
        ],
        isProfessionalOccupation: true,
      });

      expect(result).toBe("2024-05-01");
    });
  });

  it("should handle methods with missing dates", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "2024-01-22",
      jobOrderEndDate: "2024-02-10", // Latest
      noticeOfFilingEndDate: "2024-01-26",
      additionalRecruitmentMethods: [
        { date: undefined },
        { date: "2024-01-15" }, // Older than jobOrderEndDate
      ],
      isProfessionalOccupation: true,
    });

    expect(result).toBe("2024-02-10");
  });

  it("should ignore invalid date formats", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "invalid",
      jobOrderEndDate: "2024-02-10",
      noticeOfFilingEndDate: null,
      isProfessionalOccupation: false,
    });

    expect(result).toBe("2024-02-10");
  });
});

// ============================================================================
// calculateFilingWindowOpens
// ============================================================================

describe("calculateFilingWindowOpens", () => {
  it("should return null when recruitmentEndDate is null", () => {
    const result = calculateFilingWindowOpens(null);
    expect(result).toBeNull();
  });

  it("should add 30 days to recruitment end date", () => {
    const result = calculateFilingWindowOpens("2024-01-15");
    expect(result).toBe("2024-02-14"); // Jan 15 + 30 days = Feb 14
  });

  it("should handle month boundaries correctly", () => {
    const result = calculateFilingWindowOpens("2024-02-15");
    expect(result).toBe("2024-03-16"); // Feb 15 + 30 days = Mar 16
  });

  it("should handle year boundaries correctly", () => {
    const result = calculateFilingWindowOpens("2024-12-15");
    expect(result).toBe("2025-01-14"); // Dec 15 + 30 days = Jan 14 next year
  });

  it("should handle leap year correctly", () => {
    // Feb 29, 2024 + 30 days = Mar 30, 2024
    const result = calculateFilingWindowOpens("2024-02-29");
    expect(result).toBe("2024-03-30");
  });

  it("should use FILING_WINDOW_WAIT_DAYS constant (30)", () => {
    expect(FILING_WINDOW_WAIT_DAYS).toBe(30);
  });
});

// ============================================================================
// calculateFilingWindowCloses
// ============================================================================

describe("calculateFilingWindowCloses", () => {
  it("should return null when recruitmentStartDate is null", () => {
    const result = calculateFilingWindowCloses(null, "2024-12-31");
    expect(result).toBeNull();
  });

  it("should add 180 days to recruitment start date when no PWD expiration", () => {
    const result = calculateFilingWindowCloses("2024-01-15", null);
    expect(result).toBe("2024-07-13"); // Jan 15 + 180 days = Jul 13
  });

  it("should add 180 days when PWD expiration is undefined", () => {
    const result = calculateFilingWindowCloses("2024-01-15", undefined);
    expect(result).toBe("2024-07-13");
  });

  it("should return natural close (start + 180) when PWD expiration is after", () => {
    // Jan 15 + 180 days = Jul 13
    // PWD expiration = Dec 31 (after Jul 13)
    const result = calculateFilingWindowCloses("2024-01-15", "2024-12-31");
    expect(result).toBe("2024-07-13");
  });

  it("should return PWD expiration when it's before natural close", () => {
    // Jan 15 + 180 days = Jul 13
    // PWD expiration = Jun 30 (before Jul 13)
    const result = calculateFilingWindowCloses("2024-01-15", "2024-06-30");
    expect(result).toBe("2024-06-30");
  });

  it("should return PWD expiration when it's exactly on natural close", () => {
    // Jan 15 + 180 days = Jul 13
    // PWD expiration = Jul 13 (same day)
    const result = calculateFilingWindowCloses("2024-01-15", "2024-07-13");
    // When equal, PWD is NOT before natural close, so natural close is returned
    expect(result).toBe("2024-07-13");
  });

  it("should handle year boundaries correctly", () => {
    // Aug 1 + 180 days = Jan 28 next year
    const result = calculateFilingWindowCloses("2024-08-01", null);
    expect(result).toBe("2025-01-28");
  });

  it("should use FILING_WINDOW_CLOSE_DAYS constant (180)", () => {
    expect(FILING_WINDOW_CLOSE_DAYS).toBe(180);
  });
});

// ============================================================================
// calculateRecruitmentWindowCloses
// ============================================================================

describe("calculateRecruitmentWindowCloses", () => {
  it("should return null when recruitmentStartDate is null", () => {
    const result = calculateRecruitmentWindowCloses(null, "2024-12-31");
    expect(result).toBeNull();
  });

  it("should return 150 days from start when no PWD expiration", () => {
    // Jan 15 + 150 days = Jun 13
    const result = calculateRecruitmentWindowCloses("2024-01-15", null);
    expect(result).toBe("2024-06-13");
  });

  it("should return 150 days when earlier than PWD - 30", () => {
    // Jan 15 + 150 = Jun 13
    // Dec 31 - 30 = Dec 1
    // Jun 13 < Dec 1, so use Jun 13
    const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-12-31");
    expect(result).toBe("2024-06-13");
  });

  it("should return PWD - 30 when earlier than 150 days", () => {
    // Jan 15 + 150 = Jun 13
    // May 1 - 30 = Apr 1
    // Apr 1 < Jun 13, so use Apr 1
    const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-05-01");
    expect(result).toBe("2024-04-01");
  });

  it("should handle exact same closing date", () => {
    // If both constraints give same date, return it
    // Jan 15 + 150 = Jun 13
    // Jul 13 - 30 = Jun 13
    const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-07-13");
    expect(result).toBe("2024-06-13");
  });

  it("should handle year boundaries correctly", () => {
    // Aug 1 + 150 days = Dec 29
    const result = calculateRecruitmentWindowCloses("2024-08-01", null);
    expect(result).toBe("2024-12-29");
  });

  it("should use RECRUITMENT_WINDOW_DAYS constant (150)", () => {
    expect(RECRUITMENT_WINDOW_DAYS).toBe(150);
  });

  it("should use PWD_RECRUITMENT_BUFFER_DAYS constant (30)", () => {
    expect(PWD_RECRUITMENT_BUFFER_DAYS).toBe(30);
  });
});

// ============================================================================
// calculateDerivedDates (Integration)
// ============================================================================

describe("calculateDerivedDates", () => {
  it("should return all null when no dates provided", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: null,
      sundayAdSecondDate: null,
      jobOrderStartDate: null,
      jobOrderEndDate: null,
      noticeOfFilingStartDate: null,
      noticeOfFilingEndDate: null,
      pwdExpirationDate: null,
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: null,
      recruitmentEndDate: null,
      filingWindowOpens: null,
      filingWindowCloses: null,
      recruitmentWindowCloses: null,
    });
  });

  it("should calculate all values for complete non-professional case", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-22",
      jobOrderStartDate: "2024-01-10", // Earliest start
      jobOrderEndDate: "2024-02-10",   // Latest end
      noticeOfFilingStartDate: "2024-01-12",
      noticeOfFilingEndDate: "2024-01-26",
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: "2024-01-10", // MIN(Jan 15, Jan 10, Jan 12)
      recruitmentEndDate: "2024-02-10",   // MAX(Jan 22, Feb 10, Jan 26)
      filingWindowOpens: "2024-03-11",    // Feb 10 + 30 days
      filingWindowCloses: "2024-07-08",   // MIN(Jan 10 + 180 = Jul 8, Dec 31) = Jul 8
      recruitmentWindowCloses: "2024-06-08", // MIN(Jan 10 + 150 = Jun 8, Dec 31 - 30 = Dec 1) = Jun 8
    });
  });

  it("should calculate all values for professional occupation", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-22",
      jobOrderStartDate: "2024-01-10",
      jobOrderEndDate: "2024-02-10",
      noticeOfFilingStartDate: "2024-01-12",
      noticeOfFilingEndDate: "2024-01-26",
      additionalRecruitmentEndDate: "2024-03-15", // Latest end (professional)
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: true,
    });

    expect(result).toEqual({
      recruitmentStartDate: "2024-01-10", // Same as non-professional
      recruitmentEndDate: "2024-03-15",   // Includes additional recruitment
      filingWindowOpens: "2024-04-14",    // Mar 15 + 30 days
      filingWindowCloses: "2024-07-08",   // MIN(Jan 10 + 180 = Jul 8, Dec 31) = Jul 8
      recruitmentWindowCloses: "2024-06-08", // MIN(Jan 10 + 150 = Jun 8, Dec 31 - 30 = Dec 1) = Jun 8
    });
  });

  it("should truncate filing window when PWD expires early", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-22",
      jobOrderStartDate: "2024-01-10",
      jobOrderEndDate: "2024-02-10",
      noticeOfFilingStartDate: "2024-01-12",
      noticeOfFilingEndDate: "2024-01-26",
      pwdExpirationDate: "2024-05-31", // Early expiration
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: "2024-01-10",
      recruitmentEndDate: "2024-02-10",
      filingWindowOpens: "2024-03-11",    // Feb 10 + 30 days
      filingWindowCloses: "2024-05-31",   // PWD expiration (before Jul 8)
      recruitmentWindowCloses: "2024-05-01", // MIN(Jan 10 + 150 = Jun 8, May 31 - 30 = May 1) = May 1
    });
  });

  it("should handle partial data (start dates only)", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: null,
      jobOrderStartDate: "2024-01-10",
      jobOrderEndDate: null,
      noticeOfFilingStartDate: null,
      noticeOfFilingEndDate: null,
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: "2024-01-10",
      recruitmentEndDate: null,           // No end dates
      filingWindowOpens: null,            // Can't calculate without end date
      filingWindowCloses: "2024-07-08",   // Can still calculate from start
      recruitmentWindowCloses: "2024-06-08", // MIN(Jan 10 + 150 = Jun 8, Dec 31 - 30 = Dec 1) = Jun 8
    });
  });

  it("should handle partial data (end dates only)", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: null,
      sundayAdSecondDate: "2024-02-10",
      jobOrderStartDate: null,
      jobOrderEndDate: "2024-03-15",
      noticeOfFilingStartDate: null,
      noticeOfFilingEndDate: null,
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: null,         // No start dates
      recruitmentEndDate: "2024-03-15",
      filingWindowOpens: "2024-04-14",    // Mar 15 + 30 days
      filingWindowCloses: null,           // Can't calculate without start date
      recruitmentWindowCloses: null,      // Can't calculate without start date
    });
  });

  it("should ignore professional occupation dates when flag is false", () => {
    const nonProfessional = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-22",
      jobOrderStartDate: "2024-01-10",
      jobOrderEndDate: "2024-02-10",
      noticeOfFilingStartDate: "2024-01-12",
      noticeOfFilingEndDate: "2024-01-26",
      additionalRecruitmentEndDate: "2024-05-01", // Would push end date later
      additionalRecruitmentMethods: [{ date: "2024-06-01" }], // Even later
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: false, // But flag is false!
    });

    expect(nonProfessional.recruitmentEndDate).toBe("2024-02-10"); // Ignores additional
    expect(nonProfessional.filingWindowOpens).toBe("2024-03-11");  // Based on Feb 10
  });

  it("should include professional occupation dates when flag is true", () => {
    const professional = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-22",
      jobOrderStartDate: "2024-01-10",
      jobOrderEndDate: "2024-02-10",
      noticeOfFilingStartDate: "2024-01-12",
      noticeOfFilingEndDate: "2024-01-26",
      additionalRecruitmentEndDate: "2024-05-01", // Included
      additionalRecruitmentMethods: [{ date: "2024-06-01" }], // Latest
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: true,
    });

    expect(professional.recruitmentEndDate).toBe("2024-06-01"); // Method date is latest
    expect(professional.filingWindowOpens).toBe("2024-07-01");  // Jun 1 + 30 days
  });
});

// ============================================================================
// Edge Cases and Regression Tests
// ============================================================================

describe("Edge Cases", () => {
  it("should handle empty additionalRecruitmentMethods array", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "2024-02-10",
      jobOrderEndDate: null,
      noticeOfFilingEndDate: null,
      additionalRecruitmentMethods: [],
      isProfessionalOccupation: true,
    });

    expect(result).toBe("2024-02-10");
  });

  it("should handle methods array with all undefined dates", () => {
    const result = calculateRecruitmentEndDate({
      sundayAdSecondDate: "2024-02-10",
      jobOrderEndDate: null,
      noticeOfFilingEndDate: null,
      additionalRecruitmentMethods: [
        { date: undefined },
        { date: undefined },
      ],
      isProfessionalOccupation: true,
    });

    expect(result).toBe("2024-02-10");
  });

  it("should handle all same dates", () => {
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-15",
      sundayAdSecondDate: "2024-01-15",
      jobOrderStartDate: "2024-01-15",
      jobOrderEndDate: "2024-01-15",
      noticeOfFilingStartDate: "2024-01-15",
      noticeOfFilingEndDate: "2024-01-15",
      pwdExpirationDate: "2024-12-31",
      isProfessionalOccupation: false,
    });

    expect(result).toEqual({
      recruitmentStartDate: "2024-01-15",
      recruitmentEndDate: "2024-01-15",
      filingWindowOpens: "2024-02-14",    // Jan 15 + 30 days
      filingWindowCloses: "2024-07-13",   // Jan 15 + 180 days
      recruitmentWindowCloses: "2024-06-13", // Jan 15 + 150 days
    });
  });

  it("should handle invalid window scenario (opens after closes)", () => {
    // This can happen if recruitment spans too long
    // Start: Jan 1, End: Jul 15
    // Opens: Jul 15 + 30 = Aug 14
    // Closes: Jan 1 + 180 = Jun 29
    // Window opens AFTER it closes!
    const result = calculateDerivedDates({
      sundayAdFirstDate: "2024-01-01", // Early start
      sundayAdSecondDate: null,
      jobOrderStartDate: null,
      jobOrderEndDate: "2024-07-15",   // Late end
      noticeOfFilingStartDate: null,
      noticeOfFilingEndDate: null,
      pwdExpirationDate: null,
      isProfessionalOccupation: false,
    });

    // We still calculate the dates - validation is separate
    expect(result).toEqual({
      recruitmentStartDate: "2024-01-01",
      recruitmentEndDate: "2024-07-15",
      filingWindowOpens: "2024-08-14",    // Opens Aug 14
      filingWindowCloses: "2024-06-29",   // Closes Jun 29 (BEFORE opens!)
      recruitmentWindowCloses: "2024-05-30", // Jan 1 + 150 = May 30
    });
    // This invalid state is caught by V-ETA validators, not this module
  });
});

// ============================================================================
// SYNC TESTS: Verify derivedCalculations.ts stays in sync with filingWindow.ts
// ============================================================================

describe("Sync Tests: derivedCalculations vs filingWindow", () => {
  /**
   * These tests ensure that derivedCalculations.ts (backend) produces
   * the same results as filingWindow.ts (frontend) for the same inputs.
   * Both modules should use constants from the central constants.ts file.
   */

  describe("Constants Sync", () => {
    it("should use same FILING_WINDOW_WAIT_DAYS constant", () => {
      expect(FILING_WINDOW_WAIT_DAYS).toBe(FILING_WAIT_FILING);
      expect(FILING_WINDOW_WAIT_DAYS).toBe(30); // Known value
    });

    it("should use same FILING_WINDOW_CLOSE_DAYS constant", () => {
      expect(FILING_WINDOW_CLOSE_DAYS).toBe(FILING_CLOSE_FILING);
      expect(FILING_WINDOW_CLOSE_DAYS).toBe(180); // Known value
    });

    it("should use same RECRUITMENT_WINDOW_DAYS constant", () => {
      expect(RECRUITMENT_WINDOW_DAYS).toBe(RECRUITMENT_WINDOW_FILING);
      expect(RECRUITMENT_WINDOW_DAYS).toBe(150); // Known value
    });

    it("should use same PWD_RECRUITMENT_BUFFER_DAYS constant", () => {
      expect(PWD_RECRUITMENT_BUFFER_DAYS).toBe(PWD_BUFFER_FILING);
      expect(PWD_RECRUITMENT_BUFFER_DAYS).toBe(30); // Known value
    });

    it("all constants should come from the single source of truth (constants.ts)", () => {
      // All three modules should have the same values
      expect(FILING_WAIT_CONSTANTS).toBe(FILING_WINDOW_WAIT_DAYS);
      expect(FILING_WAIT_CONSTANTS).toBe(FILING_WAIT_FILING);

      expect(FILING_CLOSE_CONSTANTS).toBe(FILING_WINDOW_CLOSE_DAYS);
      expect(FILING_CLOSE_CONSTANTS).toBe(FILING_CLOSE_FILING);

      expect(RECRUITMENT_WINDOW_CONSTANTS).toBe(RECRUITMENT_WINDOW_DAYS);
      expect(RECRUITMENT_WINDOW_CONSTANTS).toBe(RECRUITMENT_WINDOW_FILING);

      expect(PWD_BUFFER_CONSTANTS).toBe(PWD_RECRUITMENT_BUFFER_DAYS);
      expect(PWD_BUFFER_CONSTANTS).toBe(PWD_BUFFER_FILING);
    });
  });

  describe("Calculation Results Sync", () => {
    it("should produce same filing window opens date", () => {
      const input = {
        sundayAdFirstDate: "2024-01-15",
        sundayAdSecondDate: "2024-02-20",
        jobOrderStartDate: "2024-01-20",
        jobOrderEndDate: "2024-02-19",
        noticeOfFilingStartDate: "2024-01-16",
        noticeOfFilingEndDate: "2024-01-30",
        pwdExpirationDate: "2024-12-31",
        isProfessionalOccupation: false,
      };

      const derived = calculateDerivedDates(input);
      const filingWindow = calculateFilingWindow({
        firstRecruitmentDate: derived.recruitmentStartDate!,
        lastRecruitmentDate: derived.recruitmentEndDate!,
        pwdExpirationDate: input.pwdExpirationDate,
      });

      expect(derived.filingWindowOpens).toBe(filingWindow?.opens);
      expect(derived.filingWindowCloses).toBe(filingWindow?.closes);
    });

    it("should produce same recruitment window closes date", () => {
      const input = {
        sundayAdFirstDate: "2024-01-15",
        sundayAdSecondDate: "2024-02-20",
        jobOrderStartDate: "2024-01-20",
        jobOrderEndDate: "2024-02-19",
        noticeOfFilingStartDate: "2024-01-16",
        noticeOfFilingEndDate: "2024-01-30",
        pwdExpirationDate: "2024-12-31",
        isProfessionalOccupation: false,
      };

      const derived = calculateDerivedDates(input);
      const recruitmentWindow = calculateRecruitmentWindowClosesFilingWindow(
        derived.recruitmentStartDate!,
        input.pwdExpirationDate
      );

      expect(derived.recruitmentWindowCloses).toBe(recruitmentWindow?.closes);
    });

    it("should handle PWD-limited scenarios consistently", () => {
      // PWD expiration is tight - should limit the window
      const input = {
        sundayAdFirstDate: "2024-01-15",
        sundayAdSecondDate: "2024-02-20",
        jobOrderStartDate: null,
        jobOrderEndDate: null,
        noticeOfFilingStartDate: null,
        noticeOfFilingEndDate: null,
        pwdExpirationDate: "2024-04-01", // Very tight PWD
        isProfessionalOccupation: false,
      };

      const derived = calculateDerivedDates(input);
      const filingWindow = calculateFilingWindow({
        firstRecruitmentDate: derived.recruitmentStartDate!,
        lastRecruitmentDate: derived.recruitmentEndDate!,
        pwdExpirationDate: input.pwdExpirationDate,
      });
      const recruitmentWindow = calculateRecruitmentWindowClosesFilingWindow(
        derived.recruitmentStartDate!,
        input.pwdExpirationDate
      );

      expect(derived.filingWindowOpens).toBe(filingWindow?.opens);
      expect(derived.filingWindowCloses).toBe(filingWindow?.closes);
      expect(derived.recruitmentWindowCloses).toBe(recruitmentWindow?.closes);

      // PWD should limit the filing window close
      expect(filingWindow?.isPwdLimited).toBe(true);
    });
  });
});
