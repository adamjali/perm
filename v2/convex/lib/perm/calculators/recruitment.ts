import { parseISO, format, addDays, subDays } from 'date-fns';
import { addBusinessDays, subtractBusinessDays, lastSundayOnOrBefore } from '../dates';
import type { PwdStepLimit } from '../dates/pwdValidity';
import {
  JOB_ORDER_MIN_DAYS,
  NOTICE_MIN_BUSINESS_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  JOB_ORDER_START_DEADLINE_DAYS,
  JOB_ORDER_START_PWD_BUFFER_DAYS,
  FIRST_SUNDAY_AD_DEADLINE_DAYS,
  FIRST_SUNDAY_AD_PWD_BUFFER_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
} from '../constants';

/**
 * Recruitment deadlines for PERM process.
 */
export interface RecruitmentDeadlines {
  /** Latest date to complete Notice of Filing (min(first+150, pwd-30)) */
  notice_of_filing_deadline: string;
  /** Latest date to START Notice of Filing (subtractBusinessDays from notice_of_filing_deadline by 10) */
  notice_of_filing_start_deadline: string;
  /** Latest date to start Job Order (min(first+120, pwd-60)) */
  job_order_start_deadline: string;
  /** Latest Sunday for second newspaper ad (lastSunday of notice deadline) */
  second_sunday_ad_deadline: string;
  /** Latest Sunday for first newspaper ad (lastSunday of min(first+143, pwd-37)) */
  first_sunday_ad_deadline: string;
  /** Same as notice_of_filing_deadline */
  recruitment_window_closes: string;
}

// Re-export for backwards compatibility
export { lastSundayOnOrBefore } from '../dates';

/**
 * Calculate Notice of Filing end date (start + 10 business days).
 *
 * @param startDate - ISO date string (YYYY-MM-DD) when Notice of Filing was posted
 * @returns ISO date string 10 business days after start
 *
 * @example
 * calculateNoticeOfFilingEnd('2024-01-15') // '2024-01-29'
 */
export function calculateNoticeOfFilingEnd(startDate: string): string {
  return addBusinessDays(startDate, NOTICE_MIN_BUSINESS_DAYS);
}

/**
 * Calculate Job Order minimum end date (start + 29 days = 30 calendar days inclusive).
 *
 * Per 20 CFR § 656.17(d), the posting date counts as day 1.
 * So 30 calendar days = addDays(start, 29).
 *
 * @param startDate - ISO date string (YYYY-MM-DD) when Job Order was posted
 * @returns ISO date string for the 30th calendar day (inclusive)
 *
 * @example
 * calculateJobOrderEnd('2024-01-15') // '2024-02-13' (day 1=Jan 15, day 30=Feb 13)
 */
export function calculateJobOrderEnd(startDate: string): string {
  const date = parseISO(startDate);
  // Subtract 1 because the posting date itself counts as day 1
  return format(addDays(date, JOB_ORDER_MIN_DAYS - 1), 'yyyy-MM-dd');
}

/**
 * Per-step deadline configuration.
 * Each step has two constraint arms: first+daysFromRecruitment and pwd-daysBeforePwd.
 * Used by calculateStepDeadline (single source of truth for the min() logic).
 */
export const STEP_DEADLINE_CONFIGS = [
  { key: "job_order_start_deadline" as const, daysFromRecruitment: JOB_ORDER_START_DEADLINE_DAYS, daysBeforePwd: JOB_ORDER_START_PWD_BUFFER_DAYS, isSunday: false },
  { key: "notice_of_filing_deadline" as const, daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: false },
  { key: "first_sunday_ad_deadline" as const, daysFromRecruitment: FIRST_SUNDAY_AD_DEADLINE_DAYS, daysBeforePwd: FIRST_SUNDAY_AD_PWD_BUFFER_DAYS, isSunday: true },
  { key: "second_sunday_ad_deadline" as const, daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: true },
] as const;

/**
 * Calculate a single recruitment step's deadline from optional inputs.
 *
 * Computes each constraint arm independently, returns the earlier.
 * This is the SINGLE SOURCE OF TRUTH for the min(first+X, pwd-Y) arithmetic.
 * Pass the PWD only while it still limits the case (pwdValidity.ts); a case
 * holder should call calculateStepDeadlineUnderPwd, which decides that.
 *
 * @param firstRecruitmentDate - ISO date string (optional)
 * @param pwdExpirationDate - ISO date string (optional)
 * @param config - Step config with days constants and Sunday flag
 * @returns Computed deadline date, or undefined if neither input exists
 */
export function calculateStepDeadline(
  firstRecruitmentDate: string | undefined,
  pwdExpirationDate: string | undefined,
  config: { daysFromRecruitment: number; daysBeforePwd: number; isSunday: boolean }
): string | undefined {
  let fromRecruitment: string | undefined;
  let fromPwd: string | undefined;

  if (firstRecruitmentDate) {
    const raw = format(addDays(parseISO(firstRecruitmentDate), config.daysFromRecruitment), "yyyy-MM-dd");
    fromRecruitment = config.isSunday ? lastSundayOnOrBefore(raw) : raw;
  }
  if (pwdExpirationDate) {
    const raw = format(subDays(parseISO(pwdExpirationDate), config.daysBeforePwd), "yyyy-MM-dd");
    fromPwd = config.isSunday ? lastSundayOnOrBefore(raw) : raw;
  }

  if (fromRecruitment && fromPwd) return fromRecruitment <= fromPwd ? fromRecruitment : fromPwd;
  return fromRecruitment || fromPwd;
}

/**
 * A recruitment step's deadline under the PWD rule in dates/pwdValidity.ts.
 *
 * - `none`: first + X only (recruitment began inside the PWD's validity, or
 *   there's no PWD); undefined until recruitment has a first date.
 * - `begin-by`: recruitment hasn't begun, so this step, which would begin it,
 *   must start on or before the expiry (the last Sunday on or before it for an ad),
 *   and no later than first + X when an earlier Notice of Filing set a first date.
 * - `file-by`: min(first + X, expiry - Y), as before.
 *
 * `limitedBy` says which arm produced the date, for the form's hints.
 */
export function calculateStepDeadlineUnderPwd(
  firstRecruitmentDate: string | undefined,
  limit: PwdStepLimit,
  config: { daysFromRecruitment: number; daysBeforePwd: number; isSunday: boolean }
): { date: string | undefined; limitedBy: 'recruitment' | 'pwd' | 'pwd-begin' | undefined } {
  const fromFirst = calculateStepDeadline(firstRecruitmentDate, undefined, config);
  if (limit.kind === 'none') {
    return { date: fromFirst, limitedBy: fromFirst ? 'recruitment' : undefined };
  }
  if (limit.kind === 'begin-by') {
    const byExpiry = config.isSunday ? lastSundayOnOrBefore(limit.date) : limit.date;
    if (fromFirst && fromFirst <= byExpiry) return { date: fromFirst, limitedBy: 'recruitment' };
    return { date: byExpiry, limitedBy: 'pwd-begin' };
  }
  const date = calculateStepDeadline(firstRecruitmentDate, limit.date, config);
  return { date, limitedBy: date && date === fromFirst ? 'recruitment' : 'pwd' };
}

/**
 * Calculate all recruitment deadlines based on first recruitment date and PWD expiration.
 *
 * Requires both inputs. For partial inputs, use calculateStepDeadline directly.
 *
 * Formulas:
 * - notice_of_filing_deadline: min(first+150, pwd-30)
 * - job_order_start_deadline: min(first+120, pwd-60)
 * - second_sunday_ad_deadline: lastSunday(notice_of_filing_deadline)
 * - first_sunday_ad_deadline: lastSunday(min(first+143, pwd-37))
 * - recruitment_window_closes: same as notice_of_filing_deadline
 *
 * @param firstRecruitmentDate - ISO date string of first recruitment activity
 * @param pwdExpirationDate - ISO date string when PWD expires
 * @returns Object with all recruitment deadlines
 */
export function calculateRecruitmentDeadlines(
  firstRecruitmentDate: string,
  pwdExpirationDate: string
): RecruitmentDeadlines {
  // Use calculateStepDeadline for each step (DRY — same source of truth)
  const notice_of_filing_deadline = calculateStepDeadline(firstRecruitmentDate, pwdExpirationDate,
    { daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: false })!;
  const job_order_start_deadline = calculateStepDeadline(firstRecruitmentDate, pwdExpirationDate,
    { daysFromRecruitment: JOB_ORDER_START_DEADLINE_DAYS, daysBeforePwd: JOB_ORDER_START_PWD_BUFFER_DAYS, isSunday: false })!;
  const first_sunday_ad_deadline = calculateStepDeadline(firstRecruitmentDate, pwdExpirationDate,
    { daysFromRecruitment: FIRST_SUNDAY_AD_DEADLINE_DAYS, daysBeforePwd: FIRST_SUNDAY_AD_PWD_BUFFER_DAYS, isSunday: true })!;

  const notice_of_filing_start_deadline = subtractBusinessDays(
    notice_of_filing_deadline,
    NOTICE_MIN_BUSINESS_DAYS
  );

  return {
    notice_of_filing_deadline,
    notice_of_filing_start_deadline,
    job_order_start_deadline,
    second_sunday_ad_deadline: lastSundayOnOrBefore(notice_of_filing_deadline),
    first_sunday_ad_deadline,
    recruitment_window_closes: notice_of_filing_deadline,
  };
}
