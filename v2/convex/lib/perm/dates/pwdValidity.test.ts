import { describe, expect, it } from "vitest";
import {
  getFirstRecruitmentStepForPwd,
  pwdBearing,
  pwdFilingLimit,
} from "./pwdValidity";
import { calculateFilingWindowFromCase } from "./filingWindow";

/**
 * 20 CFR 656.40(c): "employers must file their applications or begin the
 * recruitment period required by §§ 656.17(e) or 656.21 of this part within
 * the validity period specified by the NPC." Read by the Board en banc in Karl
 * Storz Endoscopy-America, 2011-PER-00040 (Dec 1 2011): beginning the
 * recruitment means the first recruitment step, and recruitment begun before
 * the determination means the application must be filed within validity.
 * The Notice of Filing is not a recruitment step for this test (the case
 * attorney's ruling, Oct 16 2026).
 */
describe("the first recruitment step, for the PWD test", () => {
  it("takes the earliest of the job order and the Sunday ads", () => {
    expect(
      getFirstRecruitmentStepForPwd({ jobOrderStartDate: "2026-03-10", sundayAdFirstDate: "2026-03-08" }),
    ).toBe("2026-03-08");
  });

  it("never counts the Notice of Filing", () => {
    expect(
      getFirstRecruitmentStepForPwd({ noticeOfFilingStartDate: "2026-01-02", jobOrderStartDate: "2026-03-10" }),
    ).toBe("2026-03-10");
    expect(getFirstRecruitmentStepForPwd({ noticeOfFilingStartDate: "2026-01-02" })).toBeUndefined();
  });

  it("counts the additional steps of a professional occupation, and only then", () => {
    const methods = [{ date: "2026-02-01" }];
    expect(
      getFirstRecruitmentStepForPwd({ jobOrderStartDate: "2026-03-10", additionalRecruitmentMethods: methods, isProfessionalOccupation: true }),
    ).toBe("2026-02-01");
    expect(
      getFirstRecruitmentStepForPwd({ jobOrderStartDate: "2026-03-10", additionalRecruitmentMethods: methods, isProfessionalOccupation: false }),
    ).toBe("2026-03-10");
    expect(
      getFirstRecruitmentStepForPwd({
        jobOrderStartDate: "2026-03-10",
        additionalRecruitmentMethods: [{ startDate: "2026-02-15", endDate: "2026-02-16" }],
        isProfessionalOccupation: true,
      }),
    ).toBe("2026-02-15");
  });
});

describe("how the PWD bears on a case", () => {
  const pwd = { pwdDeterminationDate: "2026-01-15", pwdExpirationDate: "2026-06-30" };

  it("has nothing to say without an expiry", () => {
    expect(pwdBearing({ firstPwdStep: "2026-02-01" })).toBe("none");
    expect(pwdFilingLimit({ firstPwdStep: "2026-02-01" })).toBeUndefined();
  });

  it("before recruitment begins, the expiry is the day it must begin by, and caps nothing yet", () => {
    expect(pwdBearing({ ...pwd })).toBe("not-begun");
    expect(pwdFilingLimit({ ...pwd })).toBeUndefined();
  });

  it("recruitment begun inside validity: the expiry no longer limits the filing", () => {
    for (const firstPwdStep of ["2026-01-15", "2026-03-01", "2026-06-30"]) {
      expect(pwdBearing({ ...pwd, firstPwdStep })).toBe("began-inside");
      expect(pwdFilingLimit({ ...pwd, firstPwdStep })).toBeUndefined();
    }
  });

  it("recruitment begun before the determination: file by the expiry", () => {
    expect(pwdBearing({ ...pwd, firstPwdStep: "2026-01-09" })).toBe("began-before");
    expect(pwdFilingLimit({ ...pwd, firstPwdStep: "2026-01-09" })).toBe("2026-06-30");
  });

  it("recruitment begun after the expiry: this determination can't be used", () => {
    expect(pwdBearing({ ...pwd, firstPwdStep: "2026-07-01" })).toBe("began-after");
    expect(pwdFilingLimit({ ...pwd, firstPwdStep: "2026-07-01" })).toBe("2026-06-30");
  });

  it("without a determination date it can't tell, so it keeps the stricter reading", () => {
    expect(pwdBearing({ pwdExpirationDate: "2026-06-30", firstPwdStep: "2026-03-01" })).toBe("determination-unknown");
    expect(pwdFilingLimit({ pwdExpirationDate: "2026-06-30", firstPwdStep: "2026-03-01" })).toBe("2026-06-30");
  });
});

describe("the filing window on the Board's own facts", () => {
  it("MPHASIS (2011-PER-00207): PWD valid Jul 9 to Oct 10 2007, recruitment begun inside it, a filing on Oct 19 2007 is inside the window", () => {
    const window = calculateFilingWindowFromCase({
      pwdDeterminationDate: "2007-07-09",
      pwdExpirationDate: "2007-10-10",
      jobOrderStartDate: "2007-07-20",
      jobOrderEndDate: "2007-08-19",
      sundayAdFirstDate: "2007-07-22",
      sundayAdSecondDate: "2007-07-29",
      noticeOfFilingStartDate: "2007-07-23",
      noticeOfFilingEndDate: "2007-08-03",
    });
    expect(window).not.toBeNull();
    expect(window!.isPwdLimited).toBe(false);
    expect(window!.closes).toBe("2008-01-16"); // first step Jul 20 + 180 days
    expect("2007-10-19" >= window!.opens && "2007-10-19" <= window!.closes).toBe(true);
  });

  it("Karl Storz (2011-PER-00040): recruitment begun 6 days before the determination, so the window closes at the expiry", () => {
    const window = calculateFilingWindowFromCase({
      pwdDeterminationDate: "2009-03-10",
      pwdExpirationDate: "2009-06-30",
      jobOrderStartDate: "2009-03-04",
      jobOrderEndDate: "2009-04-03",
      sundayAdFirstDate: "2009-03-15",
      sundayAdSecondDate: "2009-03-22",
    });
    expect(window!.isPwdLimited).toBe(true);
    expect(window!.closes).toBe("2009-06-30");
  });

  it("an early Notice of Filing doesn't make recruitment begin before the determination", () => {
    const window = calculateFilingWindowFromCase({
      pwdDeterminationDate: "2026-01-15",
      pwdExpirationDate: "2026-06-30",
      noticeOfFilingStartDate: "2026-01-05",
      noticeOfFilingEndDate: "2026-01-16",
      jobOrderStartDate: "2026-02-01",
      jobOrderEndDate: "2026-03-03",
      sundayAdFirstDate: "2026-02-08",
      sundayAdSecondDate: "2026-02-15",
    });
    // The PWD no longer limits it; the Notice still bounds the 180 days (20 CFR 656.10(d)).
    expect(window!.isPwdLimited).toBe(false);
    expect(window!.closes).toBe("2026-07-04"); // Jan 5 + 180
  });
});
