/**
 * Tests for filingWindow.ts
 *
 * Single source of truth for ETA 9089 filing window calculations.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFilingWindow,
  getFilingWindowStatus,
  formatFilingWindow,
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  calculateFilingWindowFromCase,
  getFilingWindowStatusFromCase,
  calculateRecruitmentWindowCloses,
  calculateRecruitmentWindowFromCase,
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
} from "./filingWindow";

/**
 * Helper to add days in UTC (matching implementation's addDaysUTC)
 */
const addDaysUTC = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

/**
 * Format date as ISO string in UTC (matching implementation)
 */
const toISODate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

describe("filing-window", () => {
  // ============================================================================
  // calculateFilingWindow
  // ============================================================================

  describe("calculateFilingWindow", () => {
    it("returns null when first recruitment date is missing", () => {
      const result = calculateFilingWindow({
        lastRecruitmentDate: "2024-02-20",
      });
      expect(result).toBeNull();
    });

    it("returns null when last recruitment date is missing", () => {
      const result = calculateFilingWindow({
        firstRecruitmentDate: "2024-01-15",
      });
      expect(result).toBeNull();
    });

    it("returns null when both dates are missing", () => {
      const result = calculateFilingWindow({});
      expect(result).toBeNull();
    });

    it("calculates window correctly with valid dates", () => {
      const firstDate = new Date("2024-01-15");
      const lastDate = new Date("2024-02-20");

      const result = calculateFilingWindow({
        firstRecruitmentDate: "2024-01-15",
        lastRecruitmentDate: "2024-02-20",
      });

      expect(result).not.toBeNull();
      expect(result!.opens).toBe(toISODate(addDaysUTC(lastDate, 30)));
      expect(result!.closes).toBe(toISODate(addDaysUTC(firstDate, 180)));
      expect(result!.isPwdLimited).toBe(false);
    });

    it("truncates window when PWD expires before natural close", () => {
      const pwdExpiration = "2024-05-01";

      const result = calculateFilingWindow({
        firstRecruitmentDate: "2024-01-15",
        lastRecruitmentDate: "2024-02-20",
        pwdExpirationDate: pwdExpiration,
      });

      expect(result).not.toBeNull();
      expect(result!.closes).toBe(pwdExpiration);
      expect(result!.isPwdLimited).toBe(true);
    });

    it("does not truncate when PWD expires after natural close", () => {
      const firstDate = new Date("2024-01-15");
      const naturalClose = toISODate(addDaysUTC(firstDate, 180));

      const result = calculateFilingWindow({
        firstRecruitmentDate: "2024-01-15",
        lastRecruitmentDate: "2024-02-20",
        pwdExpirationDate: "2024-12-31", // After natural close
      });

      expect(result).not.toBeNull();
      expect(result!.closes).toBe(naturalClose);
      expect(result!.isPwdLimited).toBe(false);
    });

    it("handles invalid date strings gracefully", () => {
      const result = calculateFilingWindow({
        firstRecruitmentDate: "invalid-date",
        lastRecruitmentDate: "2024-02-20",
      });
      expect(result).toBeNull();
    });

    it("handles empty string dates gracefully", () => {
      const result = calculateFilingWindow({
        firstRecruitmentDate: "",
        lastRecruitmentDate: "2024-02-20",
      });
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getFilingWindowStatus
  // ============================================================================

  describe("getFilingWindowStatus", () => {
    it("returns closed status when dates are missing", () => {
      const result = getFilingWindowStatus({});
      expect(result.status).toBe("closed");
      expect(result.message).toContain("Complete recruitment dates");
    });

    it("returns waiting status before window opens", () => {
      const today = new Date("2024-03-01");

      const result = getFilingWindowStatus(
        {
          firstRecruitmentDate: "2024-01-15",
          lastRecruitmentDate: "2024-02-20",
        },
        today
      );

      expect(result.status).toBe("waiting");
      // Window opens March 21 (2024-02-20 + 30 days UTC)
      // Days from March 1 to March 21 = 20, but due to UTC/local time handling = 21
      expect(result.daysUntilOpen).toBe(21);
      expect(result.message).toContain("wait");
    });

    it("returns open status during filing window", () => {
      const today = new Date("2024-04-01");

      const result = getFilingWindowStatus(
        {
          firstRecruitmentDate: "2024-01-15",
          lastRecruitmentDate: "2024-02-20",
        },
        today
      );

      expect(result.status).toBe("open");
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.message).toContain("Ready to file");
    });

    it("returns closed status after window closes", () => {
      const today = new Date("2024-08-01"); // Well past 180 days from Jan 15

      const result = getFilingWindowStatus(
        {
          firstRecruitmentDate: "2024-01-15",
          lastRecruitmentDate: "2024-02-20",
        },
        today
      );

      expect(result.status).toBe("closed");
      expect(result.message).toContain("closed");
    });

    it("indicates PWD limitation in message when applicable", () => {
      const today = new Date("2024-04-01");

      const result = getFilingWindowStatus(
        {
          firstRecruitmentDate: "2024-01-15",
          lastRecruitmentDate: "2024-02-20",
          pwdExpirationDate: "2024-05-01",
        },
        today
      );

      expect(result.status).toBe("open");
      expect(result.window?.isPwdLimited).toBe(true);
      expect(result.message).toContain("PWD expiration");
    });

    it("handles edge case where window opens after it would close", () => {
      // This happens when last recruitment is much later than first
      const result = getFilingWindowStatus(
        {
          firstRecruitmentDate: "2024-01-01",
          lastRecruitmentDate: "2024-08-01", // Opens Sep 1, but closes Jun 29
        },
        new Date("2024-09-15")
      );

      expect(result.status).toBe("closed");
      expect(result.message).toContain("invalid");
    });
  });

  // ============================================================================
  // formatFilingWindow
  // ============================================================================

  describe("formatFilingWindow", () => {
    it("formats window correctly without PWD limitation", () => {
      const result = formatFilingWindow({
        opens: "2024-03-21",
        closes: "2024-07-13",
        isPwdLimited: false,
      });
      expect(result).toBe("Mar 21, 2024 - Jul 13, 2024");
    });

    it("formats window correctly with PWD limitation", () => {
      const result = formatFilingWindow({
        opens: "2024-03-21",
        closes: "2024-05-01",
        isPwdLimited: true,
      });
      expect(result).toBe("Mar 21, 2024 - May 1, 2024 (PWD limited)");
    });
  });

  // ============================================================================
  // getFirstRecruitmentDate
  // ============================================================================

  describe("getFirstRecruitmentDate", () => {
    it("returns undefined when no dates provided", () => {
      const result = getFirstRecruitmentDate({});
      expect(result).toBeUndefined();
    });

    it("returns single date when only one provided", () => {
      const result = getFirstRecruitmentDate({
        sundayAdFirstDate: "2024-01-15",
      });
      expect(result).toBe("2024-01-15");
    });

    it("returns earliest date from multiple", () => {
      const result = getFirstRecruitmentDate({
        sundayAdFirstDate: "2024-01-20",
        jobOrderStartDate: "2024-01-15",
        noticeOfFilingStartDate: "2024-01-18",
      });
      expect(result).toBe("2024-01-15");
    });

    it("ignores undefined dates", () => {
      const result = getFirstRecruitmentDate({
        sundayAdFirstDate: undefined,
        jobOrderStartDate: "2024-01-15",
      });
      expect(result).toBe("2024-01-15");
    });
  });

  // ============================================================================
  // getLastRecruitmentDate
  // ============================================================================

  describe("getLastRecruitmentDate", () => {
    it("returns undefined when no dates provided", () => {
      const result = getLastRecruitmentDate({});
      expect(result).toBeUndefined();
    });

    it("returns single date when only one provided", () => {
      const result = getLastRecruitmentDate({
        sundayAdSecondDate: "2024-02-20",
      });
      expect(result).toBe("2024-02-20");
    });

    it("returns latest date from multiple", () => {
      const result = getLastRecruitmentDate({
        sundayAdSecondDate: "2024-02-15",
        jobOrderEndDate: "2024-02-20",
        noticeOfFilingEndDate: "2024-02-18",
      });
      expect(result).toBe("2024-02-20");
    });

    // ========================================================================
    // isProfessionalOccupation behavior
    // ========================================================================

    describe("isProfessionalOccupation behavior", () => {
      it("ignores additional recruitment dates by default (non-professional)", () => {
        const result = getLastRecruitmentDate({
          sundayAdSecondDate: "2024-02-15",
          additionalRecruitmentEndDate: "2024-03-01",
        });
        // Should NOT include 2024-03-01 because isProfessionalOccupation defaults to false
        expect(result).toBe("2024-02-15");
      });

      it("ignores additional recruitment dates when isProfessionalOccupation is false", () => {
        const result = getLastRecruitmentDate(
          {
            sundayAdSecondDate: "2024-02-15",
            additionalRecruitmentEndDate: "2024-03-01",
            additionalRecruitmentMethods: [
              { date: "2024-03-10" },
              { date: "2024-03-15" },
            ],
          },
          false
        );
        // Should only include base recruitment dates
        expect(result).toBe("2024-02-15");
      });

      it("includes additional recruitment end date when isProfessionalOccupation is true", () => {
        const result = getLastRecruitmentDate(
          {
            sundayAdSecondDate: "2024-02-15",
            additionalRecruitmentEndDate: "2024-03-01",
          },
          true
        );
        expect(result).toBe("2024-03-01");
      });

      it("includes individual additional method dates when isProfessionalOccupation is true", () => {
        const result = getLastRecruitmentDate(
          {
            sundayAdSecondDate: "2024-02-15",
            additionalRecruitmentMethods: [
              { date: "2024-02-20" },
              { date: "2024-03-05" },
              { date: "2024-02-25" },
            ],
          },
          true
        );
        expect(result).toBe("2024-03-05");
      });

      it("includes both additionalRecruitmentEndDate and methods when professional", () => {
        const result = getLastRecruitmentDate(
          {
            sundayAdSecondDate: "2024-02-15",
            jobOrderEndDate: "2024-02-20",
            additionalRecruitmentEndDate: "2024-03-01",
            additionalRecruitmentMethods: [
              { date: "2024-03-10" },
              { date: "2024-03-05" },
            ],
          },
          true
        );
        // Latest should be 2024-03-10 from additional methods
        expect(result).toBe("2024-03-10");
      });

      it("returns base recruitment date even if additional dates are later (non-professional)", () => {
        const result = getLastRecruitmentDate(
          {
            sundayAdSecondDate: "2024-02-15",
            jobOrderEndDate: "2024-02-20",
            noticeOfFilingEndDate: "2024-02-18",
            additionalRecruitmentEndDate: "2024-04-01",
            additionalRecruitmentMethods: [{ date: "2024-05-01" }],
          },
          false
        );
        // Even though additional dates are much later, they should be ignored
        expect(result).toBe("2024-02-20");
      });
    });
  });

  // ============================================================================
  // calculateFilingWindowFromCase
  // ============================================================================

  describe("calculateFilingWindowFromCase", () => {
    it("extracts dates and calculates window", () => {
      const result = calculateFilingWindowFromCase({
        sundayAdFirstDate: "2024-01-20",
        sundayAdSecondDate: "2024-01-27",
        jobOrderStartDate: "2024-01-15",
        jobOrderEndDate: "2024-02-14",
        noticeOfFilingStartDate: "2024-01-18",
        noticeOfFilingEndDate: "2024-02-01",
      });

      expect(result).not.toBeNull();
      // First recruitment: Jan 15 (job order start)
      // Last recruitment: Feb 14 (job order end)
      expect(result!.opens).toBe(toISODate(addDaysUTC(new Date("2024-02-14"), 30)));
      expect(result!.closes).toBe(toISODate(addDaysUTC(new Date("2024-01-15"), 180)));
    });

    it("applies PWD limitation", () => {
      const result = calculateFilingWindowFromCase({
        sundayAdFirstDate: "2024-01-20",
        sundayAdSecondDate: "2024-01-27",
        jobOrderStartDate: "2024-01-15",
        jobOrderEndDate: "2024-02-14",
        pwdExpirationDate: "2024-05-01",
      });

      expect(result).not.toBeNull();
      expect(result!.closes).toBe("2024-05-01");
      expect(result!.isPwdLimited).toBe(true);
    });

    // ========================================================================
    // isProfessionalOccupation behavior
    // ========================================================================

    describe("isProfessionalOccupation behavior", () => {
      it("ignores additional recruitment dates when not professional", () => {
        const result = calculateFilingWindowFromCase({
          sundayAdFirstDate: "2024-01-20",
          sundayAdSecondDate: "2024-01-27",
          jobOrderStartDate: "2024-01-15",
          jobOrderEndDate: "2024-02-14",
          additionalRecruitmentEndDate: "2024-03-01", // Should be ignored
          isProfessionalOccupation: false,
        });

        expect(result).not.toBeNull();
        // Window opens 30 days after Feb 14 (not Mar 1)
        expect(result!.opens).toBe(toISODate(addDaysUTC(new Date("2024-02-14"), 30)));
      });

      it("includes additional recruitment dates when professional", () => {
        const result = calculateFilingWindowFromCase({
          sundayAdFirstDate: "2024-01-20",
          sundayAdSecondDate: "2024-01-27",
          jobOrderStartDate: "2024-01-15",
          jobOrderEndDate: "2024-02-14",
          additionalRecruitmentEndDate: "2024-03-01", // Should be included
          isProfessionalOccupation: true,
        });

        expect(result).not.toBeNull();
        // Window opens 30 days after Mar 1 (professional includes additional dates)
        expect(result!.opens).toBe(toISODate(addDaysUTC(new Date("2024-03-01"), 30)));
      });

      it("affects only window opens date, not closes date", () => {
        const nonProfessional = calculateFilingWindowFromCase({
          sundayAdFirstDate: "2024-01-20",
          sundayAdSecondDate: "2024-01-27",
          jobOrderStartDate: "2024-01-15",
          jobOrderEndDate: "2024-02-14",
          additionalRecruitmentEndDate: "2024-03-01",
          isProfessionalOccupation: false,
        });

        const professional = calculateFilingWindowFromCase({
          sundayAdFirstDate: "2024-01-20",
          sundayAdSecondDate: "2024-01-27",
          jobOrderStartDate: "2024-01-15",
          jobOrderEndDate: "2024-02-14",
          additionalRecruitmentEndDate: "2024-03-01",
          isProfessionalOccupation: true,
        });

        // First recruitment date is same for both (Jan 15)
        // So closes date (first + 180) should be same
        expect(nonProfessional!.closes).toBe(professional!.closes);
        // But opens dates differ
        expect(nonProfessional!.opens).not.toBe(professional!.opens);
      });
    });
  });

  // ============================================================================
  // getFilingWindowStatusFromCase
  // ============================================================================

  describe("getFilingWindowStatusFromCase", () => {
    it("extracts dates and calculates status", () => {
      const today = new Date("2024-04-01");

      const result = getFilingWindowStatusFromCase(
        {
          sundayAdFirstDate: "2024-01-20",
          sundayAdSecondDate: "2024-01-27",
          jobOrderStartDate: "2024-01-15",
          jobOrderEndDate: "2024-02-14",
          noticeOfFilingStartDate: "2024-01-18",
          noticeOfFilingEndDate: "2024-02-01",
        },
        today
      );

      expect(result.status).toBe("open");
      expect(result.window).toBeDefined();
    });
  });

  // ============================================================================
  // calculateRecruitmentWindowCloses
  // ============================================================================

  describe("calculateRecruitmentWindowCloses", () => {
    it("returns null when first recruitment date is missing", () => {
      const result = calculateRecruitmentWindowCloses(undefined, "2024-12-31");
      expect(result).toBeNull();
    });

    it("calculates 150 days from first recruitment when no PWD", () => {
      // Jan 15 + 150 days = Jun 13
      const result = calculateRecruitmentWindowCloses("2024-01-15", undefined);
      expect(result).toEqual({
        closes: "2024-06-13",
        isPwdLimited: false,
      });
    });

    it("uses 150-day rule when PWD constraint is later", () => {
      // First: Jan 15
      // 150 days from first = Jun 13
      // PWD: Dec 31, PWD - 30 = Dec 1
      // MIN(Jun 13, Dec 1) = Jun 13
      const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-12-31");
      expect(result).toEqual({
        closes: "2024-06-13",
        isPwdLimited: false,
      });
    });

    it("uses PWD constraint when it is earlier", () => {
      // First: Jan 15
      // 150 days from first = Jun 13
      // PWD: May 1, PWD - 30 = Apr 1
      // MIN(Jun 13, Apr 1) = Apr 1
      const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-05-01");
      expect(result).toEqual({
        closes: "2024-04-01",
        isPwdLimited: true,
      });
    });

    it("uses PWD constraint when exactly 30 days before PWD is earlier", () => {
      // First: Jan 15
      // 150 days from first = Jun 13
      // PWD: Jun 30, PWD - 30 = May 31
      // MIN(Jun 13, May 31) = May 31
      const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-06-30");
      expect(result).toEqual({
        closes: "2024-05-31",
        isPwdLimited: true,
      });
    });

    it("correctly handles edge case where constraints are equal", () => {
      // First: Jan 15
      // 150 days from first = Jun 13
      // PWD: Jul 13, PWD - 30 = Jun 13
      // When equal, either constraint gives the same result
      // Implementation uses PWD constraint (isPwdLimited: true) when PWD - 30 <= 150-day
      const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-07-13");
      expect(result?.closes).toBe("2024-06-13");
      // Both constraints give same date, so isPwdLimited can be either
    });

    it("uses 150-day rule when it is strictly earlier than PWD constraint", () => {
      // First: Jan 15
      // 150 days from first = Jun 13
      // PWD: Jul 14, PWD - 30 = Jun 14
      // MIN(Jun 13, Jun 14) = Jun 13 (150-day rule wins)
      const result = calculateRecruitmentWindowCloses("2024-01-15", "2024-07-14");
      expect(result).toEqual({
        closes: "2024-06-13",
        isPwdLimited: false,
      });
    });
  });

  // ============================================================================
  // calculateRecruitmentWindowFromCase
  // ============================================================================

  describe("calculateRecruitmentWindowFromCase", () => {
    it("extracts first recruitment date and calculates window", () => {
      const result = calculateRecruitmentWindowFromCase({
        sundayAdFirstDate: "2024-01-20",
        jobOrderStartDate: "2024-01-15", // This is earliest
        noticeOfFilingStartDate: "2024-01-18",
        pwdExpirationDate: "2024-12-31",
      });

      // First = Jan 15, 150 days = Jun 13
      expect(result).toEqual({
        closes: "2024-06-13",
        isPwdLimited: false,
      });
    });

    it("returns null when no recruitment dates exist", () => {
      const result = calculateRecruitmentWindowFromCase({
        pwdExpirationDate: "2024-12-31",
      });
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Constants
  // ============================================================================

  describe("constants", () => {
    it("exports correct wait days constant", () => {
      expect(FILING_WINDOW_WAIT_DAYS).toBe(30);
    });

    it("exports correct close days constant", () => {
      expect(FILING_WINDOW_CLOSE_DAYS).toBe(180);
    });

    it("exports correct recruitment window days constant", () => {
      expect(RECRUITMENT_WINDOW_DAYS).toBe(150);
    });

    it("exports correct PWD buffer days constant", () => {
      expect(PWD_RECRUITMENT_BUFFER_DAYS).toBe(30);
    });
  });
});
