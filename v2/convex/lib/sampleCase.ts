/**
 * The onboarding sample case's dates, relative to today.
 *
 * One module so the sample case the tour creates and the onboarding
 * illustration that describes it give the same dates: the illustration had
 * typed "Oct 22" and "Feb 15" and went wrong the week after it was written.
 */

import { calculateFilingWindowFromCase, calculatePWDExpiration } from "./perm";
import type { FilingWindow } from "./perm";

/**
 * Build PERM-compliant sample case dates relative to today.
 * All dates pass validateCase() — Sunday ads on Sundays, job order >= 30 days,
 * notice of filing >= 14 calendar days (~10 business days), PWD expiration from real calculator.
 */
export function buildSampleCaseDates(referenceDate?: Date) {
  const today = referenceDate ?? new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };

  // Find the most recent Sunday on or before a given date
  const findPrevSunday = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00Z");
    const day = d.getUTCDay(); // 0=Sunday
    d.setUTCDate(d.getUTCDate() - day);
    return fmt(d);
  };

  const addDaysTo = (dateStr: string, n: number) => {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return fmt(d);
  };

  // PWD: filed 120 days ago, determined 45 days ago, expiration from real calculator
  const pwdFilingDate = daysAgo(120);
  const pwdDeterminationDate = daysAgo(45);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  // Job order: 40 days ago, runs exactly 30 days (meets JOB_ORDER_MIN_DAYS)
  const jobOrderStartDate = daysAgo(40);
  const jobOrderEndDate = addDaysTo(jobOrderStartDate, 30); // daysAgo(10)

  // Sunday ads: find actual Sundays ~4 weeks and ~3 weeks ago
  const sundayAdFirstDate = findPrevSunday(daysAgo(28));
  const sundayAdSecondDate = addDaysTo(sundayAdFirstDate, 7); // next Sunday

  // Notice of filing: 20 days ago, runs 14 calendar days (~10 business days)
  const noticeOfFilingStartDate = daysAgo(20);
  const noticeOfFilingEndDate = addDaysTo(noticeOfFilingStartDate, 14); // daysAgo(6)

  // Additional recruitment methods: after PWD determination, during recruitment window
  const additionalMethod1Date = daysAgo(22);
  const additionalMethod2Date = daysAgo(20);
  const additionalMethod3Date = daysAgo(18);

  return {
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    jobOrderStartDate,
    jobOrderEndDate,
    sundayAdFirstDate,
    sundayAdSecondDate,
    noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    additionalMethod1Date,
    additionalMethod2Date,
    additionalMethod3Date,
  };
}

/**
 * The sample case's ETA 9089 filing window, from the same central rule every
 * other surface uses (the case is a professional occupation, as inserted).
 */
export function sampleCaseFilingWindow(referenceDate?: Date): FilingWindow | null {
  const d = buildSampleCaseDates(referenceDate);
  return calculateFilingWindowFromCase({
    ...d,
    isProfessionalOccupation: true,
    additionalRecruitmentMethods: [
      { date: d.additionalMethod1Date },
      { date: d.additionalMethod2Date },
      { date: d.additionalMethod3Date },
    ],
  });
}
