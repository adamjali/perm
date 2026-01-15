import { parseISO, format, addDays, min, subDays } from 'date-fns';
import { addBusinessDays, lastSundayOnOrBefore } from '../dates';
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
 * Calculate Job Order end date (start + 30 calendar days).
 *
 * @param startDate - ISO date string (YYYY-MM-DD) when Job Order was posted
 * @returns ISO date string 30 calendar days after start
 *
 * @example
 * calculateJobOrderEnd('2024-01-15') // '2024-02-14'
 */
export function calculateJobOrderEnd(startDate: string): string {
  const date = parseISO(startDate);
  return format(addDays(date, JOB_ORDER_MIN_DAYS), 'yyyy-MM-dd');
}

/**
 * Calculate all recruitment deadlines based on first recruitment date and PWD expiration.
 *
 * Formulas (from V2_DEADLINE_FLOWS.md):
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
  const firstDate = parseISO(firstRecruitmentDate);
  const pwdDate = parseISO(pwdExpirationDate);

  // Calculate constraint dates
  const noticeDeadline = min([
    addDays(firstDate, RECRUITMENT_WINDOW_DAYS),
    subDays(pwdDate, PWD_RECRUITMENT_BUFFER_DAYS),
  ]);

  const jobOrderDeadline = min([
    addDays(firstDate, JOB_ORDER_START_DEADLINE_DAYS),
    subDays(pwdDate, JOB_ORDER_START_PWD_BUFFER_DAYS),
  ]);

  const firstSundayConstraint = min([
    addDays(firstDate, FIRST_SUNDAY_AD_DEADLINE_DAYS),
    subDays(pwdDate, FIRST_SUNDAY_AD_PWD_BUFFER_DAYS),
  ]);

  // Format dates
  const notice_of_filing_deadline = format(noticeDeadline, 'yyyy-MM-dd');
  const job_order_start_deadline = format(jobOrderDeadline, 'yyyy-MM-dd');

  return {
    notice_of_filing_deadline,
    job_order_start_deadline,
    second_sunday_ad_deadline: lastSundayOnOrBefore(notice_of_filing_deadline),
    first_sunday_ad_deadline: lastSundayOnOrBefore(
      format(firstSundayConstraint, 'yyyy-MM-dd')
    ),
    recruitment_window_closes: notice_of_filing_deadline,
  };
}
