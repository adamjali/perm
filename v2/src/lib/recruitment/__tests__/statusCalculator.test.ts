/**
 * Tests for Recruitment Status Calculator
 *
 * Tests cover:
 * - calculateRecruitmentStatus: main function for determining filing window status
 * - Status types: incomplete, waiting, ready, expired
 * - Mandatory steps validation: NOF, Job Order, Sunday Ads
 * - Professional occupation methods (3 additional required)
 * - Filing window calculation (30-180 days after recruitment ends)
 * - PWD expiration truncating the filing window
 * - formatFilingWindowRange: helper for display formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { format, addDays, parseISO } from "date-fns";
import {
  calculateRecruitmentStatus,
  formatFilingWindowRange,
  type RecruitmentCaseData,
} from "../statusCalculator";

// Helper to format dates consistently
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

// Helper to create a complete non-professional case data fixture
function createCompleteMandatorySteps(
  baseDate: string = "2024-03-01"
): RecruitmentCaseData {
  const base = parseISO(baseDate);
  return {
    noticeOfFilingStartDate: formatDate(base),
    noticeOfFilingEndDate: formatDate(addDays(base, 14)), // 10 business days
    jobOrderStartDate: formatDate(base),
    jobOrderEndDate: formatDate(addDays(base, 30)),
    sundayAdFirstDate: formatDate(addDays(base, 7)), // First Sunday
    sundayAdSecondDate: formatDate(addDays(base, 14)), // Second Sunday
    isProfessionalOccupation: false,
  };
}

// Helper to create complete professional case with additional methods
function createCompleteProfessionalCase(
  baseDate: string = "2024-03-01"
): RecruitmentCaseData {
  const base = parseISO(baseDate);
  return {
    ...createCompleteMandatorySteps(baseDate),
    isProfessionalOccupation: true,
    additionalRecruitmentMethods: [
      { method: "job_fair", date: formatDate(addDays(base, 20)), description: "Local job fair" },
      { method: "employee_referral", date: formatDate(addDays(base, 25)), description: "Internal referral program" },
      { method: "campus_placement", date: formatDate(addDays(base, 28)), description: "University career fair" },
    ],
    additionalRecruitmentEndDate: formatDate(addDays(base, 35)),
  };
}

describe("calculateRecruitmentStatus", () => {
  beforeEach(() => {
    // Mock current date for consistent testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("incomplete status - missing mandatory steps", () => {
    it("returns incomplete when Notice of Filing is missing", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        // Missing noticeOfFilingStartDate and noticeOfFilingEndDate
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("Notice of Filing");
      expect(result.mandatorySteps.noticeOfFiling.complete).toBe(false);
      expect(result.mandatorySteps.allComplete).toBe(false);
    });

    it("returns incomplete when Notice of Filing start is present but end is missing", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        // Missing noticeOfFilingEndDate
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("Notice of Filing");
      expect(result.mandatorySteps.noticeOfFiling.complete).toBe(false);
    });

    it("returns incomplete when Job Order is missing", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        // Missing jobOrderStartDate and jobOrderEndDate
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("Job Order");
      expect(result.mandatorySteps.jobOrder.complete).toBe(false);
    });

    it("returns incomplete when first Sunday Ad is missing", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        // Missing sundayAdFirstDate
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("First Sunday Ad");
      expect(result.mandatorySteps.sundayAdFirst.complete).toBe(false);
    });

    it("returns incomplete when second Sunday Ad is missing", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        // Missing sundayAdSecondDate
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("Second Sunday Ad");
      expect(result.mandatorySteps.sundayAdSecond.complete).toBe(false);
    });

    it("returns incomplete with multiple missing steps listed", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        // Missing all mandatory steps
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("Notice of Filing");
      expect(result.message).toContain("Job Order");
      expect(result.message).toContain("First Sunday Ad");
      expect(result.message).toContain("Second Sunday Ad");
      expect(result.mandatorySteps.allComplete).toBe(false);
    });
  });

  describe("incomplete status - missing professional occupation methods", () => {
    it("returns incomplete when professional occupation has no additional methods", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        ...createCompleteMandatorySteps(),
        isProfessionalOccupation: true,
        // No additionalRecruitmentMethods
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("3 additional recruitment methods");
      expect(result.professionalMethods.required).toBe(true);
      expect(result.professionalMethods.completedCount).toBe(0);
      expect(result.professionalMethods.requiredCount).toBe(3);
      expect(result.professionalMethods.allComplete).toBe(false);
    });

    it("returns incomplete when professional occupation has only 1 additional method", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        ...createCompleteMandatorySteps(),
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: "job_fair", date: "2024-03-20" },
        ],
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("2 additional recruitment methods");
      expect(result.professionalMethods.completedCount).toBe(1);
      expect(result.professionalMethods.allComplete).toBe(false);
    });

    it("returns incomplete when professional occupation has only 2 additional methods", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        ...createCompleteMandatorySteps(),
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: "job_fair", date: "2024-03-20" },
          { method: "employee_referral", date: "2024-03-25" },
        ],
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
      expect(result.message).toContain("1 additional recruitment method");
      expect(result.professionalMethods.completedCount).toBe(2);
      expect(result.professionalMethods.allComplete).toBe(false);
    });

    it("non-professional occupation does not require additional methods", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data = createCompleteMandatorySteps();

      const result = calculateRecruitmentStatus(data);

      // Should not be incomplete due to missing additional methods
      expect(result.status).not.toBe("incomplete");
      expect(result.professionalMethods.required).toBe(false);
      expect(result.professionalMethods.requiredCount).toBe(0);
      expect(result.professionalMethods.allComplete).toBe(true);
    });
  });

  describe("waiting status - before 30-day window opens", () => {
    it("returns waiting when within 30 days of recruitment end", () => {
      // Recruitment ends March 31, 2024
      // Window opens April 30, 2024 (30 days later)
      vi.setSystemTime(new Date("2024-04-15")); // 15 days before window opens

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31", // Latest recruitment date
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("waiting");
      expect(result.message).toContain("Must wait until");
      expect(result.message).toContain("Apr 30, 2024");
      expect(result.daysUntilWindowOpens).toBe(15);
      expect(result.filingWindowOpens).toBe("2024-04-30");
    });

    it("returns waiting on the day after recruitment ends", () => {
      // Recruitment ends March 31, 2024
      vi.setSystemTime(new Date("2024-04-01")); // 1 day after recruitment ends, 29 days until window

      const data = createCompleteMandatorySteps();
      data.jobOrderEndDate = "2024-03-31"; // Ensure this is the latest

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("waiting");
      expect(result.daysUntilWindowOpens).toBe(29);
    });

    it("calculates days until window opens correctly", () => {
      // Recruitment ends March 31, 2024
      // Window opens April 30, 2024
      vi.setSystemTime(new Date("2024-04-25")); // 5 days before window opens

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("waiting");
      expect(result.daysUntilWindowOpens).toBe(5);
    });
  });

  describe("ready status - within 30-180 day filing window", () => {
    it("returns ready on the first day of the filing window", () => {
      // Recruitment ends March 31, 2024
      // Window opens April 30, 2024 (30 days later)
      // Use noon to avoid any timezone boundary issues
      vi.setSystemTime(new Date("2024-04-30T12:00:00"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.message).toContain("Ready to file");
      expect(result.message).toContain("days remaining");
    });

    it("returns ready in the middle of the filing window", () => {
      // Recruitment ends March 31, 2024
      // Window: April 30 - September 27, 2024
      vi.setSystemTime(new Date("2024-07-01")); // Mid-window

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.daysRemainingInWindow).toBeGreaterThan(0);
    });

    it("returns ready on the last day of the filing window", () => {
      // Recruitment ends March 31, 2024
      // Window closes September 27, 2024 (180 days later)
      vi.setSystemTime(new Date("2024-09-27")); // Last day of window

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.daysRemainingInWindow).toBe(0);
    });

    it("calculates days remaining in window correctly", () => {
      // Recruitment ends March 31, 2024
      // Window closes September 27, 2024
      vi.setSystemTime(new Date("2024-09-17")); // 10 days before window closes

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.daysRemainingInWindow).toBe(10);
    });

    it("returns ready for professional occupation with 3 additional methods", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data = createCompleteProfessionalCase();

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.professionalMethods.completedCount).toBe(3);
      expect(result.professionalMethods.allComplete).toBe(true);
    });
  });

  describe("expired status - past 180 days", () => {
    it("returns expired after 180 days from recruitment end", () => {
      // Recruitment ends March 31, 2024
      // Window closes September 27, 2024
      vi.setSystemTime(new Date("2024-09-28")); // 1 day after window closes

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("expired");
      expect(result.message).toContain("Filing window closed");
      expect(result.message).toContain("must restart recruitment");
    });

    it("returns expired well after 180 days", () => {
      // Recruitment ends March 31, 2024
      vi.setSystemTime(new Date("2025-01-01")); // ~9 months later

      const data = createCompleteMandatorySteps();

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("expired");
    });
  });

  describe("PWD expiration truncates filing window", () => {
    it("uses PWD expiration as window close when earlier than 180 days", () => {
      // Recruitment ends March 31, 2024
      // Normal window would close September 27, 2024
      // But PWD expires June 30, 2024
      vi.setSystemTime(new Date("2024-05-15")); // During truncated window

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
        pwdExpirationDate: "2024-06-30", // Truncates window
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.filingWindowCloses).toBe("2024-06-30");
      // Days remaining should be based on PWD expiration, not 180 days
      expect(result.daysRemainingInWindow).toBe(46); // June 30 - May 15 = 46 days
    });

    it("returns expired when past PWD expiration even if within 180 days", () => {
      // Recruitment ends March 31, 2024
      // Normal window would close September 27, 2024
      // But PWD expires June 30, 2024
      vi.setSystemTime(new Date("2024-07-01")); // After PWD expiration

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
        pwdExpirationDate: "2024-06-30",
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("expired");
    });

    it("uses 180-day window when PWD expiration is later", () => {
      // Recruitment ends March 31, 2024
      // Normal window closes September 27, 2024
      // PWD expires December 31, 2024 (later than 180 days)
      vi.setSystemTime(new Date("2024-09-15")); // Near end of 180-day window

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
        pwdExpirationDate: "2024-12-31",
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.filingWindowCloses).toBe("2024-09-27"); // 180 days, not PWD
    });

    it("correctly calculates days remaining when PWD truncates window", () => {
      // Recruitment ends March 31, 2024
      // PWD expires June 15, 2024
      vi.setSystemTime(new Date("2024-06-10")); // 5 days before PWD expires

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
        pwdExpirationDate: "2024-06-15",
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.daysRemainingInWindow).toBe(5);
    });
  });

  describe("recruitment end date calculation", () => {
    it("uses latest date among all recruitment activities", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      // Job order end is the latest
      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-04-15", // Latest
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.recruitmentEndDate).toBe("2024-04-15");
      // Window opens 30 days after: May 15
      expect(result.filingWindowOpens).toBe("2024-05-15");
    });

    it("uses sundayAdSecondDate when it is the latest", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-04-21", // Latest - a Sunday after job order ends
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.recruitmentEndDate).toBe("2024-04-21");
    });

    it("includes additionalRecruitmentEndDate in calculation", () => {
      vi.setSystemTime(new Date("2024-07-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: "job_fair", date: "2024-04-01" },
          { method: "employee_referral", date: "2024-04-15" },
          { method: "campus_placement", date: "2024-05-01" }, // Latest individual method
        ],
        additionalRecruitmentEndDate: "2024-05-15", // Latest overall
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.recruitmentEndDate).toBe("2024-05-15");
    });

    it("considers individual additional method dates", () => {
      vi.setSystemTime(new Date("2024-07-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: "job_fair", date: "2024-04-01" },
          { method: "employee_referral", date: "2024-04-15" },
          { method: "campus_placement", date: "2024-06-01" }, // Latest - later than job order end
        ],
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.recruitmentEndDate).toBe("2024-06-01");
    });

    // ========================================================================
    // isProfessionalOccupation behavior
    // ========================================================================

    describe("isProfessionalOccupation behavior", () => {
      it("ignores additional recruitment dates when NOT professional occupation", () => {
        vi.setSystemTime(new Date("2024-06-01"));

        const data: RecruitmentCaseData = {
          noticeOfFilingStartDate: "2024-03-01",
          noticeOfFilingEndDate: "2024-03-15",
          jobOrderStartDate: "2024-03-01",
          jobOrderEndDate: "2024-03-31",
          sundayAdFirstDate: "2024-03-10",
          sundayAdSecondDate: "2024-03-17",
          isProfessionalOccupation: false,
          // These should be IGNORED for non-professional cases
          additionalRecruitmentEndDate: "2024-05-15",
          additionalRecruitmentMethods: [
            { method: "job_fair", date: "2024-06-01" },
          ],
        };

        const result = calculateRecruitmentStatus(data);

        // Should use job order end (Mar 31), not additional dates (May 15 or Jun 1)
        expect(result.recruitmentEndDate).toBe("2024-03-31");
      });

      it("includes additional dates when professional occupation", () => {
        vi.setSystemTime(new Date("2024-07-01"));

        const data: RecruitmentCaseData = {
          noticeOfFilingStartDate: "2024-03-01",
          noticeOfFilingEndDate: "2024-03-15",
          jobOrderStartDate: "2024-03-01",
          jobOrderEndDate: "2024-03-31",
          sundayAdFirstDate: "2024-03-10",
          sundayAdSecondDate: "2024-03-17",
          isProfessionalOccupation: true,
          additionalRecruitmentEndDate: "2024-05-15",
          additionalRecruitmentMethods: [
            { method: "job_fair", date: "2024-04-01" },
            { method: "employee_referral", date: "2024-04-15" },
            { method: "campus_placement", date: "2024-05-01" },
          ],
        };

        const result = calculateRecruitmentStatus(data);

        // Should use additional recruitment end date (May 15) as it's latest
        expect(result.recruitmentEndDate).toBe("2024-05-15");
      });

      it("filing window differs based on isProfessionalOccupation", () => {
        vi.setSystemTime(new Date("2024-06-01"));

        const baseData = {
          noticeOfFilingStartDate: "2024-03-01",
          noticeOfFilingEndDate: "2024-03-15",
          jobOrderStartDate: "2024-03-01",
          jobOrderEndDate: "2024-03-31",
          sundayAdFirstDate: "2024-03-10",
          sundayAdSecondDate: "2024-03-17",
          additionalRecruitmentEndDate: "2024-05-15",
          additionalRecruitmentMethods: [
            { method: "job_fair", date: "2024-04-01" },
            { method: "employee_referral", date: "2024-04-15" },
            { method: "campus_placement", date: "2024-05-01" },
          ],
        };

        const nonProfessional = calculateRecruitmentStatus({
          ...baseData,
          isProfessionalOccupation: false,
        });

        // For professional, we need to be in the waiting period
        vi.setSystemTime(new Date("2024-06-14")); // 30 days after May 15 = June 14
        const professional = calculateRecruitmentStatus({
          ...baseData,
          isProfessionalOccupation: true,
        });

        // Non-professional: window opens 30 days after Mar 31 = Apr 30
        expect(nonProfessional.filingWindowOpens).toBe("2024-04-30");

        // Professional: window opens 30 days after May 15 = Jun 14
        expect(professional.filingWindowOpens).toBe("2024-06-14");
      });
    });
  });

  describe("mandatory steps details", () => {
    it("calculates business days for Notice of Filing correctly", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-04", // Monday
        noticeOfFilingEndDate: "2024-03-15", // Friday (10 business days)
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.mandatorySteps.noticeOfFiling.businessDays).toBe(10);
    });

    it("calculates job order duration in days", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31", // 30 days
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.mandatorySteps.jobOrder.durationDays).toBe(30);
    });

    it("reports all mandatory step dates correctly", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
        jobOrderStartDate: "2024-03-05",
        jobOrderEndDate: "2024-04-05",
        sundayAdFirstDate: "2024-03-10",
        sundayAdSecondDate: "2024-03-17",
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.mandatorySteps.noticeOfFiling.startDate).toBe("2024-03-01");
      expect(result.mandatorySteps.noticeOfFiling.endDate).toBe("2024-03-15");
      expect(result.mandatorySteps.jobOrder.startDate).toBe("2024-03-05");
      expect(result.mandatorySteps.jobOrder.endDate).toBe("2024-04-05");
      expect(result.mandatorySteps.sundayAdFirst.date).toBe("2024-03-10");
      expect(result.mandatorySteps.sundayAdSecond.date).toBe("2024-03-17");
    });
  });

  describe("professional methods details", () => {
    it("reports professional methods correctly", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const methods = [
        { method: "job_fair", date: "2024-03-20", description: "Local job fair" },
        { method: "employee_referral", date: "2024-03-25", description: "Internal referrals" },
        { method: "campus_placement", date: "2024-03-28", description: "University fair" },
      ];

      const data: RecruitmentCaseData = {
        ...createCompleteMandatorySteps(),
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: methods,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.professionalMethods.methods).toEqual(methods);
      expect(result.professionalMethods.completedCount).toBe(3);
      expect(result.professionalMethods.requiredCount).toBe(3);
      expect(result.professionalMethods.required).toBe(true);
      expect(result.professionalMethods.allComplete).toBe(true);
    });

    it("handles more than 3 additional methods", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        ...createCompleteMandatorySteps(),
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: "job_fair", date: "2024-03-20" },
          { method: "employee_referral", date: "2024-03-25" },
          { method: "campus_placement", date: "2024-03-28" },
          { method: "trade_organization", date: "2024-04-01" },
          { method: "professional_journal", date: "2024-04-05" },
        ],
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.professionalMethods.completedCount).toBe(5);
      expect(result.professionalMethods.allComplete).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty case data", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data: RecruitmentCaseData = {
        isProfessionalOccupation: false,
      };

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("incomplete");
    });

    it("returns daysUntilWindowOpens as 0 when in window", () => {
      vi.setSystemTime(new Date("2024-06-01"));

      const data = createCompleteMandatorySteps("2024-03-01");
      // Window opens around April 1 (30 days after latest date)
      // Current date is June 1, so we're in the window

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("ready");
      expect(result.daysUntilWindowOpens).toBe(0);
    });

    it("returns daysRemainingInWindow as 0 when past window", () => {
      vi.setSystemTime(new Date("2025-01-01")); // Well past window

      const data = createCompleteMandatorySteps("2024-03-01");

      const result = calculateRecruitmentStatus(data);

      expect(result.status).toBe("expired");
      expect(result.daysRemainingInWindow).toBe(0);
    });
  });
});

describe("formatFilingWindowRange", () => {
  it("formats date range correctly", () => {
    const result = formatFilingWindowRange("2024-04-30", "2024-09-27");

    expect(result).toBe("Apr 30, 2024 - Sep 27, 2024");
  });

  it("handles same month dates", () => {
    const result = formatFilingWindowRange("2024-06-01", "2024-06-30");

    expect(result).toBe("Jun 1, 2024 - Jun 30, 2024");
  });

  it("handles year-spanning dates", () => {
    const result = formatFilingWindowRange("2024-12-01", "2025-02-28");

    expect(result).toBe("Dec 1, 2024 - Feb 28, 2025");
  });
});

describe("business days calculation (via mandatorySteps)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts weekdays correctly for a full week", () => {
    const data: RecruitmentCaseData = {
      noticeOfFilingStartDate: "2024-03-04", // Monday
      noticeOfFilingEndDate: "2024-03-08", // Friday
      jobOrderStartDate: "2024-03-01",
      jobOrderEndDate: "2024-03-31",
      sundayAdFirstDate: "2024-03-10",
      sundayAdSecondDate: "2024-03-17",
      isProfessionalOccupation: false,
    };

    const result = calculateRecruitmentStatus(data);

    // Monday to Friday = 5 business days
    expect(result.mandatorySteps.noticeOfFiling.businessDays).toBe(5);
  });

  it("excludes weekends from business day count", () => {
    const data: RecruitmentCaseData = {
      noticeOfFilingStartDate: "2024-03-08", // Friday
      noticeOfFilingEndDate: "2024-03-11", // Monday (includes weekend)
      jobOrderStartDate: "2024-03-01",
      jobOrderEndDate: "2024-03-31",
      sundayAdFirstDate: "2024-03-10",
      sundayAdSecondDate: "2024-03-17",
      isProfessionalOccupation: false,
    };

    const result = calculateRecruitmentStatus(data);

    // Friday + Monday = 2 business days (Saturday and Sunday excluded)
    expect(result.mandatorySteps.noticeOfFiling.businessDays).toBe(2);
  });

  it("handles two-week period correctly", () => {
    const data: RecruitmentCaseData = {
      noticeOfFilingStartDate: "2024-03-04", // Monday
      noticeOfFilingEndDate: "2024-03-15", // Friday (2 weeks later)
      jobOrderStartDate: "2024-03-01",
      jobOrderEndDate: "2024-03-31",
      sundayAdFirstDate: "2024-03-10",
      sundayAdSecondDate: "2024-03-17",
      isProfessionalOccupation: false,
    };

    const result = calculateRecruitmentStatus(data);

    // 2 full weeks = 10 business days
    expect(result.mandatorySteps.noticeOfFiling.businessDays).toBe(10);
  });

  it("counts single day as 1 business day if weekday", () => {
    const data: RecruitmentCaseData = {
      noticeOfFilingStartDate: "2024-03-05", // Tuesday
      noticeOfFilingEndDate: "2024-03-05", // Same day
      jobOrderStartDate: "2024-03-01",
      jobOrderEndDate: "2024-03-31",
      sundayAdFirstDate: "2024-03-10",
      sundayAdSecondDate: "2024-03-17",
      isProfessionalOccupation: false,
    };

    const result = calculateRecruitmentStatus(data);

    expect(result.mandatorySteps.noticeOfFiling.businessDays).toBe(1);
  });
});
