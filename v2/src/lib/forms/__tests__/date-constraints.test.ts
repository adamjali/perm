/**
 * Tests for Date Constraints
 *
 * Issue 6: Verify ETA filing window logic
 * Rules per perm_flow.md:
 * - Opens: 30 days after LAST recruitment step
 * - Closes: 180 days after FIRST recruitment step (or PWD expiration, whichever first)
 */

import { describe, it, expect } from "vitest";
import { format, addDays, subDays } from "date-fns";
import {
  getPWDDateConstraints,
  getRecruitmentDateConstraints,
  getProfessionalDateConstraints,
  getETA9089DateConstraints,
  getI140DateConstraints,
  getAllDateConstraints,
  getRecruitmentFieldDeadline,
} from "../date-constraints";

// Helper to format dates consistently
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

describe("getRecruitmentFieldDeadline", () => {
  describe("notice of filing deadline", () => {
    it("returns 150 days from first recruitment when no PWD expiration", () => {
      const firstRecruitment = "2024-02-01";
      const result = getRecruitmentFieldDeadline('noticeOfFilingStartDate', firstRecruitment, undefined);

      const expected = formatDate(addDays(new Date(firstRecruitment + "T00:00:00"), 150));
      expect(result.maxDate).toBe(expected);
      expect(result.limitingFactor).toBe('recruitment');
      expect(result.hint).toContain("150 days from first recruitment");
    });

    it("returns 30 days before PWD exp when earlier", () => {
      const firstRecruitment = "2024-02-01";
      const pwdExpiration = "2024-05-15"; // 30 days before = Apr 15, which is < 150 days from Feb 1 = Jul 1
      const result = getRecruitmentFieldDeadline('noticeOfFilingStartDate', firstRecruitment, pwdExpiration);

      const expected = formatDate(subDays(new Date(pwdExpiration + "T00:00:00"), 30));
      expect(result.maxDate).toBe(expected);
      expect(result.limitingFactor).toBe('pwd');
      expect(result.hint).toContain("30 days before PWD exp");
    });
  });

  describe("job order start deadline", () => {
    it("returns 120 days from first recruitment when no PWD expiration", () => {
      const firstRecruitment = "2024-02-01";
      const result = getRecruitmentFieldDeadline('jobOrderStartDate', firstRecruitment, undefined);

      const expected = formatDate(addDays(new Date(firstRecruitment + "T00:00:00"), 120));
      expect(result.maxDate).toBe(expected);
      expect(result.limitingFactor).toBe('recruitment');
      expect(result.hint).toContain("120 days from first recruitment");
    });

    it("returns 60 days before PWD exp when earlier", () => {
      const firstRecruitment = "2024-02-01";
      const pwdExpiration = "2024-05-01"; // 60 days before = Mar 2
      const result = getRecruitmentFieldDeadline('jobOrderStartDate', firstRecruitment, pwdExpiration);

      const expected = formatDate(subDays(new Date(pwdExpiration + "T00:00:00"), 60));
      expect(result.maxDate).toBe(expected);
      expect(result.limitingFactor).toBe('pwd');
      expect(result.hint).toContain("60 days before PWD exp");
    });
  });

  describe("Sunday ad deadlines (must be Sunday)", () => {
    it("first Sunday deadline is last Sunday on or before 143 days from recruitment", () => {
      const firstRecruitment = "2024-02-01";
      const result = getRecruitmentFieldDeadline('sundayAdFirstDate', firstRecruitment, undefined);

      // 143 days from Feb 1 = Jun 23. If Jun 23 is not a Sunday, get the last Sunday before it
      const deadline143 = addDays(new Date(firstRecruitment + "T00:00:00"), 143);
      const dayOfWeek = deadline143.getDay();
      const expectedDate = dayOfWeek === 0 ? deadline143 : subDays(deadline143, dayOfWeek);

      expect(result.maxDate).toBe(formatDate(expectedDate));
      expect(result.hint).toContain("must be Sunday");
    });

    it("second Sunday deadline is last Sunday on or before 150 days from recruitment", () => {
      const firstRecruitment = "2024-02-01";
      const result = getRecruitmentFieldDeadline('sundayAdSecondDate', firstRecruitment, undefined);

      // 150 days from Feb 1. If not Sunday, get the last Sunday before it
      const deadline150 = addDays(new Date(firstRecruitment + "T00:00:00"), 150);
      const dayOfWeek = deadline150.getDay();
      const expectedDate = dayOfWeek === 0 ? deadline150 : subDays(deadline150, dayOfWeek);

      expect(result.maxDate).toBe(formatDate(expectedDate));
      expect(result.hint).toContain("must be Sunday");
    });
  });

  describe("edge cases", () => {
    it("returns undefined when no dates provided", () => {
      const result = getRecruitmentFieldDeadline('noticeOfFilingStartDate', undefined, undefined);

      expect(result.maxDate).toBeUndefined();
      expect(result.limitingFactor).toBeUndefined();
      expect(result.hint).toBe('');
    });

    it("only uses PWD when no first recruitment", () => {
      const pwdExpiration = "2024-06-30";
      const result = getRecruitmentFieldDeadline('noticeOfFilingStartDate', undefined, pwdExpiration);

      const expected = formatDate(subDays(new Date(pwdExpiration + "T00:00:00"), 30));
      expect(result.maxDate).toBe(expected);
      expect(result.limitingFactor).toBe('pwd');
    });

    it("returns undefined for unknown field", () => {
      const result = getRecruitmentFieldDeadline('unknownField', "2024-02-01", "2024-06-30");

      expect(result.maxDate).toBeUndefined();
      expect(result.limitingFactor).toBeUndefined();
    });
  });
});

describe("getETA9089DateConstraints", () => {
  describe("filing window opens 30 days after LAST recruitment", () => {
    it("uses sundayAdSecondDate when it is the latest", () => {
      const sundaySecond = "2024-03-15";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: sundaySecond,
        jobOrderStartDate: "2024-02-01",
        jobOrderEndDate: "2024-03-02",
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
      });

      // Window opens 30 days after latest recruitment end (sundayAdSecondDate)
      const expectedOpenDate = formatDate(addDays(new Date(sundaySecond + "T00:00:00"), 30));
      expect(constraints.eta9089FilingDate.min).toBe(expectedOpenDate);
    });

    it("uses jobOrderEndDate when it is the latest", () => {
      const jobOrderEnd = "2024-04-01";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: "2024-02-01",
        jobOrderEndDate: jobOrderEnd,
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
      });

      // Window opens 30 days after latest recruitment end (jobOrderEndDate)
      const expectedOpenDate = formatDate(addDays(new Date(jobOrderEnd + "T00:00:00"), 30));
      expect(constraints.eta9089FilingDate.min).toBe(expectedOpenDate);
    });

    it("includes additionalRecruitmentEndDate if professional occupation", () => {
      const additionalEnd = "2024-05-01";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: "2024-02-01",
        jobOrderEndDate: "2024-03-02",
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
        isProfessionalOccupation: true, // Required to include additional recruitment dates
        additionalRecruitmentEndDate: additionalEnd,
      });

      // Window opens 30 days after latest recruitment end (additionalRecruitmentEndDate)
      const expectedOpenDate = formatDate(addDays(new Date(additionalEnd + "T00:00:00"), 30));
      expect(constraints.eta9089FilingDate.min).toBe(expectedOpenDate);
    });

    it("ignores additionalRecruitmentEndDate if NOT professional occupation", () => {
      const additionalEnd = "2024-05-01";
      const jobOrderEnd = "2024-03-02";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: "2024-02-01",
        jobOrderEndDate: jobOrderEnd,
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
        isProfessionalOccupation: false, // Non-professional - additional recruitment ignored
        additionalRecruitmentEndDate: additionalEnd,
      });

      // Window opens 30 days after latest base recruitment end (jobOrderEndDate, not additionalEnd)
      const expectedOpenDate = formatDate(addDays(new Date(jobOrderEnd + "T00:00:00"), 30));
      expect(constraints.eta9089FilingDate.min).toBe(expectedOpenDate);
    });
  });

  describe("filing window closes 180 days after FIRST recruitment", () => {
    it("uses sundayAdFirstDate when it is the earliest", () => {
      const sundayFirst = "2024-02-15";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: sundayFirst,
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
      });

      // Window closes 180 days after earliest recruitment start (sundayAdFirstDate)
      // expectedCloseDate = 2024-02-15 + 180 = 2024-08-13
      // Window opens 30 days after last recruitment (job order end 2024-03-31) = 2024-04-30
      // Hint should show the window range
      expect(constraints.eta9089FilingDate.hint).toContain("Filing window");
      expect(constraints.eta9089FilingDate.hint).toContain("Aug 13, 2024"); // 180 days from first recruitment
    });

    it("uses jobOrderStartDate when it is the earliest", () => {
      const jobOrderStart = "2024-02-01";
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: jobOrderStart,
        jobOrderEndDate: "2024-03-02",
        noticeOfFilingStartDate: "2024-03-01",
        noticeOfFilingEndDate: "2024-03-15",
      });

      // Window closes 180 days after earliest recruitment start (jobOrderStartDate)
      const expectedCloseDate = formatDate(addDays(new Date(jobOrderStart + "T00:00:00"), 180));
      // The max should be based on this close date (or today if in the past)
      expect(constraints.eta9089FilingDate.hint).toContain("Filing window");
    });
  });

  describe("PWD expiration truncates filing window", () => {
    it("uses PWD expiration when earlier than 180-day deadline", () => {
      const firstRecruitment = "2024-02-01";
      const pwdExpiration = "2024-06-15"; // Earlier than 180 days from first recruitment
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: firstRecruitment,
        jobOrderEndDate: "2024-03-02",
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
        pwdExpirationDate: pwdExpiration,
      });

      // Hint should mention PWD limitation
      expect(constraints.eta9089FilingDate.hint).toContain("limited by PWD expiration");
    });

    it("uses 180-day deadline when earlier than PWD expiration", () => {
      const firstRecruitment = "2024-02-01";
      const pwdExpiration = "2024-12-31"; // Later than 180 days from first recruitment
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        sundayAdSecondDate: "2024-02-22",
        jobOrderStartDate: firstRecruitment,
        jobOrderEndDate: "2024-03-02",
        noticeOfFilingStartDate: "2024-02-01",
        noticeOfFilingEndDate: "2024-02-15",
        pwdExpirationDate: pwdExpiration,
      });

      // Hint should NOT mention PWD limitation
      expect(constraints.eta9089FilingDate.hint).not.toContain("limited by PWD expiration");
    });
  });

  describe("edge cases", () => {
    it("returns undefined constraints when no recruitment dates provided", () => {
      const constraints = getETA9089DateConstraints({});

      expect(constraints.eta9089FilingDate.min).toBeUndefined();
      expect(constraints.eta9089FilingDate.hint).toContain("Complete recruitment dates first");
    });

    it("handles partial recruitment data", () => {
      const constraints = getETA9089DateConstraints({
        sundayAdFirstDate: "2024-02-15",
        // Missing end dates
      });

      expect(constraints.eta9089FilingDate.min).toBeUndefined();
      expect(constraints.eta9089FilingDate.hint).toContain("Complete recruitment end dates");
    });

    it("audit date must be after filing date (strictly, not same day)", () => {
      const filingDate = "2024-04-15";
      const constraints = getETA9089DateConstraints({
        eta9089FilingDate: filingDate,
      });

      // Min is day AFTER filing (not same day)
      const expectedMin = formatDate(addDays(new Date(filingDate + "T00:00:00"), 1));
      expect(constraints.eta9089AuditDate.min).toBe(expectedMin);
      expect(constraints.eta9089AuditDate.hint).toContain("after filing");
      expect(constraints.eta9089AuditDate.hint).toContain("Apr 15, 2024"); // Formatted date
    });

    it("certification date must be after audit date if present (strictly, not same day)", () => {
      const auditDate = "2024-05-01";
      const constraints = getETA9089DateConstraints({
        eta9089FilingDate: "2024-04-15",
        eta9089AuditDate: auditDate,
      });

      // Min is day AFTER audit (not same day)
      const expectedMin = formatDate(addDays(new Date(auditDate + "T00:00:00"), 1));
      expect(constraints.eta9089CertificationDate.min).toBe(expectedMin);
      expect(constraints.eta9089CertificationDate.hint).toContain("after audit");
    });
  });
});

describe("getProfessionalDateConstraints", () => {
  describe("max date calculation", () => {
    it("uses 150 days from first recruitment when no PWD expiration", () => {
      // Uses 150 days (not 180) to allow 30-day ETA 9089 waiting period
      const firstRecruitment = "2024-02-01";
      const constraints = getProfessionalDateConstraints({
        pwdDeterminationDate: "2024-01-15",
        sundayAdFirstDate: "2024-02-15",
        jobOrderStartDate: firstRecruitment,
        noticeOfFilingStartDate: "2024-03-01",
      });

      const expected150Days = formatDate(addDays(new Date(firstRecruitment + "T00:00:00"), 150));
      expect(constraints.additionalRecruitmentStartDate.max).toBe(expected150Days);
      expect(constraints.additionalRecruitmentStartDate.hint).toContain("150 days from first recruitment");
    });

    it("uses 30 days before PWD expiration when earlier", () => {
      const pwdExpiration = "2024-05-01"; // Will be earlier than 150 days from first recruitment
      const constraints = getProfessionalDateConstraints({
        pwdDeterminationDate: "2024-01-15",
        sundayAdFirstDate: "2024-02-15",
        jobOrderStartDate: "2024-02-01",
        noticeOfFilingStartDate: "2024-03-01",
        pwdExpirationDate: pwdExpiration,
      });

      const expected30Before = formatDate(subDays(new Date(pwdExpiration + "T00:00:00"), 30));
      expect(constraints.additionalRecruitmentStartDate.max).toBe(expected30Before);
      // New hint format: "After {pwdDetermination}. By {maxDate} (X days before PWD exp)"
      expect(constraints.additionalRecruitmentStartDate.hint).toContain("30 days before PWD exp");
    });

    it("end date must be after start date (strictly, not same day)", () => {
      const startDate = "2024-03-15";
      const constraints = getProfessionalDateConstraints({
        additionalRecruitmentStartDate: startDate,
      });

      // Min is day AFTER start (not same day)
      const expectedMin = formatDate(addDays(new Date(startDate + "T00:00:00"), 1));
      expect(constraints.additionalRecruitmentEndDate.min).toBe(expectedMin);
      // New hint format: "After {startDate}"
      expect(constraints.additionalRecruitmentEndDate.hint).toContain("After Mar 15, 2024");
    });
  });
});

describe("getPWDDateConstraints", () => {
  it("filing date cannot be after determination date", () => {
    const determinationDate = "2024-02-15";
    const constraints = getPWDDateConstraints({
      pwdDeterminationDate: determinationDate,
    });

    // Max filing should be the determination date (or today, whichever is earlier)
    expect(constraints.pwdFilingDate.max).toBeDefined();
    expect(constraints.pwdFilingDate.hint).toContain("before determination");
  });

  it("determination date must be after filing date (strictly, not same day)", () => {
    const filingDate = "2024-01-15";
    const constraints = getPWDDateConstraints({
      pwdFilingDate: filingDate,
    });

    // Min is day AFTER filing (not same day)
    const expectedMin = formatDate(addDays(new Date(filingDate + "T00:00:00"), 1));
    expect(constraints.pwdDeterminationDate.min).toBe(expectedMin);
    expect(constraints.pwdDeterminationDate.hint).toContain("after filing");
  });
});

describe("getRecruitmentDateConstraints", () => {
  it("second Sunday must be at least 7 days after first", () => {
    const firstSunday = "2024-02-18"; // A Sunday
    const constraints = getRecruitmentDateConstraints({
      sundayAdFirstDate: firstSunday,
    });

    const expectedMin = formatDate(addDays(new Date(firstSunday + "T00:00:00"), 7));
    expect(constraints.sundayAdSecondDate.min).toBe(expectedMin);
  });

  it("job order end date must be at least 30 days after start", () => {
    const startDate = "2024-02-01";
    const constraints = getRecruitmentDateConstraints({
      jobOrderStartDate: startDate,
    });

    const expectedMinEnd = formatDate(addDays(new Date(startDate + "T00:00:00"), 30));
    expect(constraints.jobOrderEndDate.min).toBe(expectedMinEnd);
  });
});

describe("getI140DateConstraints", () => {
  it("filing must be after ETA 9089 certification (strictly, not same day)", () => {
    const certDate = "2024-06-01";
    const constraints = getI140DateConstraints({
      eta9089CertificationDate: certDate,
    });

    // Min is day AFTER certification (not same day)
    const expectedMin = formatDate(addDays(new Date(certDate + "T00:00:00"), 1));
    expect(constraints.i140FilingDate.min).toBe(expectedMin);
  });

  it("filing must be within 180 days of certification", () => {
    const certDate = "2024-06-01";
    const constraints = getI140DateConstraints({
      eta9089CertificationDate: certDate,
    });

    // Max should be 180 days after cert (or today if in the future)
    const expected180Days = formatDate(addDays(new Date(certDate + "T00:00:00"), 180));
    expect(constraints.i140FilingDate.hint).toContain("180 days of certification");
  });

  it("receipt date must be after filing date (strictly, not same day)", () => {
    const filingDate = "2024-07-01";
    const constraints = getI140DateConstraints({
      i140FilingDate: filingDate,
    });

    // Min is day AFTER filing (not same day)
    const expectedMin = formatDate(addDays(new Date(filingDate + "T00:00:00"), 1));
    expect(constraints.i140ReceiptDate.min).toBe(expectedMin);
  });

  it("approval date must be after receipt date (strictly, not same day)", () => {
    const receiptDate = "2024-07-15";
    const constraints = getI140DateConstraints({
      i140FilingDate: "2024-07-01",
      i140ReceiptDate: receiptDate,
    });

    // Min is day AFTER receipt (not same day)
    const expectedMin = formatDate(addDays(new Date(receiptDate + "T00:00:00"), 1));
    expect(constraints.i140ApprovalDate.min).toBe(expectedMin);
    expect(constraints.i140ApprovalDate.hint).toContain("after receipt");
  });

  it("denial date must be after receipt date (strictly, not same day)", () => {
    const receiptDate = "2024-07-15";
    const constraints = getI140DateConstraints({
      i140FilingDate: "2024-07-01",
      i140ReceiptDate: receiptDate,
    });

    // Min is day AFTER receipt (not same day)
    const expectedMin = formatDate(addDays(new Date(receiptDate + "T00:00:00"), 1));
    expect(constraints.i140DenialDate.min).toBe(expectedMin);
    expect(constraints.i140DenialDate.hint).toContain("after receipt");
  });
});

describe("getAllDateConstraints", () => {
  it("returns constraints from all sections", () => {
    const constraints = getAllDateConstraints({
      pwdFilingDate: "2024-01-15",
      sundayAdFirstDate: "2024-02-15",
      eta9089FilingDate: "2024-04-15",
      i140FilingDate: "2024-07-01",
    });

    // Should have constraints from each section
    expect(constraints.pwdFilingDate).toBeDefined();
    expect(constraints.pwdDeterminationDate).toBeDefined();
    expect(constraints.sundayAdFirstDate).toBeDefined();
    expect(constraints.sundayAdSecondDate).toBeDefined();
    expect(constraints.additionalRecruitmentStartDate).toBeDefined();
    expect(constraints.eta9089FilingDate).toBeDefined();
    expect(constraints.i140FilingDate).toBeDefined();
  });
});
