/**
 * The one switch for how much email the site may send (Oct 12 2026): unset it
 * keeps every saving made for Resend's free 100 a day; set above 100 it puts
 * them all back, scaled to the new allowance.
 */
import { afterEach, describe, expect, it } from "vitest";

import { emailDailyLimit, emailScale, savingEmail, scaled } from "../emailAllowance";
import { dailyCeilings } from "../emailLimits";
import { windowFor } from "../alertBudgets";
import { newsletterDailyCap } from "../newsletterSummary";
import { summaryWorthSending, weekHadChange, type RawCaseUpdateData, type RawDeadlineData } from "../digestHelpers";
import type { Id } from "../../_generated/dataModel";

afterEach(() => {
  delete process.env.EMAIL_DAILY_LIMIT;
});

describe("the email allowance switch", () => {
  it("holds the free plan's savings when unset, garbled, or at or below 100", () => {
    for (const value of [undefined, "", "abc", "-5", "50", "100"]) {
      if (value === undefined) delete process.env.EMAIL_DAILY_LIMIT;
      else process.env.EMAIL_DAILY_LIMIT = value;
      expect(emailDailyLimit()).toBe(100);
      expect(savingEmail()).toBe(true);
      expect(emailScale()).toBe(1);
      expect(scaled(18)).toBe(18);
    }
  });

  it("puts every saving back above 100, growing counts with the allowance", () => {
    process.env.EMAIL_DAILY_LIMIT = "1600";
    expect(savingEmail()).toBe(false);
    expect(emailScale()).toBe(16);
    expect(scaled(18)).toBe(288);
  });

  it("keeps the day's ceilings at the same shares of the allowance", () => {
    expect(dailyCeilings()).toEqual({ cap: 100, list: 85, publicMail: 55 });
    process.env.EMAIL_DAILY_LIMIT = "1600";
    expect(dailyCeilings()).toEqual({ cap: 1600, list: 1360, publicMail: 880 });
  });

  it("grows every per-kind pool with the allowance", () => {
    expect(windowFor("caseAlert").limit).toBe(60);
    expect(windowFor("authMail").limit).toBe(80);
    process.env.EMAIL_DAILY_LIMIT = "1600";
    expect(windowFor("caseAlert").limit).toBe(960);
    expect(windowFor("authMail").limit).toBe(1280);
  });

  it("lifts the newsletter's daily send cap with the allowance", () => {
    delete process.env.NEWSLETTER_DAILY_CAP;
    expect(newsletterDailyCap()).toBe(30);
    process.env.EMAIL_DAILY_LIMIT = "1600";
    expect(newsletterDailyCap()).toBe(480);
  });
});

describe("whether a week's case summary goes", () => {
  const caseId = "k1" as Id<"cases">;
  const update: RawCaseUpdateData = {
    caseId,
    employerName: "Acme",
    beneficiaryIdentifier: "A",
    caseStatus: "pwd",
    progressStatus: "working",
    updatedAt: 1,
  };
  const deadline = (daysUntil: number): RawDeadlineData => ({
    caseId,
    employerName: "Acme",
    beneficiaryIdentifier: "A",
    deadlineType: "pwd_expiration",
    deadlineDate: "2026-10-20",
    daysUntil,
  });

  it("counts a case updated this week, or a deadline passed this week, as a change", () => {
    expect(weekHadChange([update], [])).toBe(true);
    expect(weekHadChange([], [deadline(-1)])).toBe(true);
    expect(weekHadChange([], [deadline(-7)])).toBe(true);
  });

  it("doesn't count a deadline coming up, or one missed weeks ago", () => {
    expect(weekHadChange([], [deadline(5)])).toBe(false);
    expect(weekHadChange([], [deadline(0)])).toBe(false);
    expect(weekHadChange([], [deadline(-8)])).toBe(false);
  });

  it("waits for a change while email is scarce, and goes for any active case once it isn't", () => {
    expect(summaryWorthSending({ savingEmail: true, changed: false, totalActiveCases: 3 })).toBe(false);
    expect(summaryWorthSending({ savingEmail: true, changed: true, totalActiveCases: 3 })).toBe(true);
    expect(summaryWorthSending({ savingEmail: false, changed: false, totalActiveCases: 3 })).toBe(true);
    expect(summaryWorthSending({ savingEmail: false, changed: false, totalActiveCases: 0 })).toBe(false);
  });
});
