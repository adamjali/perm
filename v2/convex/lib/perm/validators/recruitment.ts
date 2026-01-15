import { parseISO, isBefore, isAfter, getDay, differenceInDays, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue, CaseData } from '../types';
import { createValidationResult } from '../types';
import { countBusinessDays } from '../dates/businessDays';
import { JOB_ORDER_MIN_DAYS, NOTICE_MIN_BUSINESS_DAYS } from '../constants';

/**
 * Input data for recruitment validation.
 * Derived from CaseData to prevent type drift.
 */
export type RecruitmentValidationInput = Pick<
  CaseData,
  | 'sunday_ad_first_date'
  | 'sunday_ad_second_date'
  | 'job_order_start_date'
  | 'job_order_end_date'
  | 'notice_of_filing_start_date'
  | 'notice_of_filing_end_date'
> & {
  previous_job_order_end_date?: string | null; // For V-REC-12 extend-only validation
  previous_notice_of_filing_end_date?: string | null; // For V-REC-11 extend-only validation
};

/**
 * Validate recruitment dates according to PERM regulations.
 *
 * Rules enforced:
 * - V-REC-01: First Sunday ad must be on a Sunday
 * - V-REC-02: Second Sunday ad must be on a Sunday
 * - V-REC-03: Second Sunday ad must be after first
 * - V-REC-04: Job order end must be after start
 * - V-REC-05: Job order must be at least 30 days
 * - V-REC-06: Notice end must be after start
 * - V-REC-07: Notice must be at least 10 business days
 * - V-REC-08: If notice start provided, notice end required
 * - V-REC-09: If notice end provided, notice start required
 * - V-REC-10: Warning if notice period less than 10 business days but > 0
 * - V-REC-11: Extend-only: Notice end can only extend
 * - V-REC-12: Extend-only: Job order end can only extend
 *
 * @param input - Recruitment dates to validate
 * @returns Validation result with errors and warnings
 */
export function validateRecruitment(
  input: RecruitmentValidationInput
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const {
    sunday_ad_first_date,
    sunday_ad_second_date,
    job_order_start_date,
    job_order_end_date,
    notice_of_filing_start_date,
    notice_of_filing_end_date,
    previous_job_order_end_date,
    previous_notice_of_filing_end_date,
  } = input;

  // V-REC-01: First Sunday ad must be on a Sunday
  if (sunday_ad_first_date) {
    const date = parseISO(sunday_ad_first_date);
    if (!isValid(date)) {
      errors.push({
        ruleId: 'V-REC-01',
        severity: 'error',
        field: 'sunday_ad_first_date',
        message: `Invalid date format: ${sunday_ad_first_date}`,
      });
    } else if (getDay(date) !== 0) {
      errors.push({
        ruleId: 'V-REC-01',
        severity: 'error',
        field: 'sunday_ad_first_date',
        message:
          'First Sunday newspaper ad must be on a Sunday (20 CFR § 656.17(e)(1)(i))',
        regulation: '20 CFR § 656.17(e)(1)(i)',
      });
    }
  }

  // V-REC-02: Second Sunday ad must be on a Sunday
  if (sunday_ad_second_date) {
    const date = parseISO(sunday_ad_second_date);
    if (!isValid(date)) {
      errors.push({
        ruleId: 'V-REC-02',
        severity: 'error',
        field: 'sunday_ad_second_date',
        message: `Invalid date format: ${sunday_ad_second_date}`,
      });
    } else if (getDay(date) !== 0) {
      errors.push({
        ruleId: 'V-REC-02',
        severity: 'error',
        field: 'sunday_ad_second_date',
        message:
          'Second Sunday newspaper ad must be on a Sunday (20 CFR § 656.17(e)(1)(i))',
        regulation: '20 CFR § 656.17(e)(1)(i)',
      });
    }
  }

  // V-REC-03: Second Sunday ad must be after first
  if (sunday_ad_first_date && sunday_ad_second_date) {
    const first = parseISO(sunday_ad_first_date);
    const second = parseISO(sunday_ad_second_date);

    // Skip if dates are invalid (already caught above)
    if (isValid(first) && isValid(second) && !isAfter(second, first)) {
      errors.push({
        ruleId: 'V-REC-03',
        severity: 'error',
        field: 'sunday_ad_second_date',
        message:
          'Second Sunday ad must be after first Sunday ad (20 CFR § 656.17(e)(1)(i))',
        regulation: '20 CFR § 656.17(e)(1)(i)',
      });
    }
  }

  // V-REC-04: Job order end must be after start
  if (job_order_start_date && job_order_end_date) {
    const start = parseISO(job_order_start_date);
    const end = parseISO(job_order_end_date);

    if (!isValid(start)) {
      errors.push({
        ruleId: 'V-REC-04',
        severity: 'error',
        field: 'job_order_start_date',
        message: `Invalid date format: ${job_order_start_date}`,
      });
    } else if (!isValid(end)) {
      errors.push({
        ruleId: 'V-REC-04',
        severity: 'error',
        field: 'job_order_end_date',
        message: `Invalid date format: ${job_order_end_date}`,
      });
    } else if (!isAfter(end, start)) {
      errors.push({
        ruleId: 'V-REC-04',
        severity: 'error',
        field: 'job_order_end_date',
        message:
          'Job order end date must be after start date (20 CFR § 656.17(d))',
        regulation: '20 CFR § 656.17(d)',
      });
    }
  }

  // V-REC-05: Job order must be at least 30 days
  if (job_order_start_date && job_order_end_date) {
    const start = parseISO(job_order_start_date);
    const end = parseISO(job_order_end_date);

    // Skip if dates are invalid (already caught above)
    if (isValid(start) && isValid(end)) {
      const days = differenceInDays(end, start);

      if (days < JOB_ORDER_MIN_DAYS) {
        errors.push({
          ruleId: 'V-REC-05',
          severity: 'error',
          field: 'job_order_end_date',
          message: `Job order must be at least ${JOB_ORDER_MIN_DAYS} calendar days. Current duration: ${days} days (20 CFR § 656.17(d))`,
          regulation: '20 CFR § 656.17(d)',
        });
      }
    }
  }

  // V-REC-06: Notice end must be after start
  if (notice_of_filing_start_date && notice_of_filing_end_date) {
    const start = parseISO(notice_of_filing_start_date);
    const end = parseISO(notice_of_filing_end_date);

    if (!isValid(start)) {
      errors.push({
        ruleId: 'V-REC-06',
        severity: 'error',
        field: 'notice_of_filing_start_date',
        message: `Invalid date format: ${notice_of_filing_start_date}`,
      });
    } else if (!isValid(end)) {
      errors.push({
        ruleId: 'V-REC-06',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: `Invalid date format: ${notice_of_filing_end_date}`,
      });
    } else if (!isAfter(end, start)) {
      errors.push({
        ruleId: 'V-REC-06',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message:
          'Notice of filing end date must be after start date (20 CFR § 656.10(d))',
        regulation: '20 CFR § 656.10(d)',
      });
    }
  }

  // V-REC-07: Notice must be at least 10 business days
  if (notice_of_filing_start_date && notice_of_filing_end_date) {
    const businessDays = countBusinessDays(
      notice_of_filing_start_date,
      notice_of_filing_end_date
    );

    if (businessDays < NOTICE_MIN_BUSINESS_DAYS) {
      errors.push({
        ruleId: 'V-REC-07',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: `Notice of filing must be posted for at least ${NOTICE_MIN_BUSINESS_DAYS} business days. Current: ${businessDays} business days (20 CFR § 656.10(d)(1)(ii))`,
        regulation: '20 CFR § 656.10(d)(1)(ii)',
      });
    }
  }

  // V-REC-08: If notice start provided, notice end required
  if (notice_of_filing_start_date && !notice_of_filing_end_date) {
    errors.push({
      ruleId: 'V-REC-08',
      severity: 'error',
      field: 'notice_of_filing_end_date',
      message:
        'Notice of filing end date is required when start date is provided',
    });
  }

  // V-REC-09: If notice end provided, notice start required
  if (!notice_of_filing_start_date && notice_of_filing_end_date) {
    errors.push({
      ruleId: 'V-REC-09',
      severity: 'error',
      field: 'notice_of_filing_start_date',
      message:
        'Notice of filing start date is required when end date is provided',
    });
  }

  // V-REC-10: Warning if notice period less than 10 business days but > 0
  if (notice_of_filing_start_date && notice_of_filing_end_date) {
    const businessDays = countBusinessDays(
      notice_of_filing_start_date,
      notice_of_filing_end_date
    );

    if (businessDays > 0 && businessDays < NOTICE_MIN_BUSINESS_DAYS) {
      warnings.push({
        ruleId: 'V-REC-10',
        severity: 'warning',
        field: 'notice_of_filing_end_date',
        message: `Notice of filing period is ${businessDays} business days. Minimum required: ${NOTICE_MIN_BUSINESS_DAYS} business days (20 CFR § 656.10(d)(1)(ii))`,
        regulation: '20 CFR § 656.10(d)(1)(ii)',
      });
    }
  }

  // V-REC-11: Extend-only: Notice end can only extend
  if (
    previous_notice_of_filing_end_date &&
    notice_of_filing_end_date &&
    previous_notice_of_filing_end_date !== notice_of_filing_end_date
  ) {
    const previous = parseISO(previous_notice_of_filing_end_date);
    const current = parseISO(notice_of_filing_end_date);

    if (isBefore(current, previous)) {
      errors.push({
        ruleId: 'V-REC-11',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: `Notice of filing end date can only be extended, not shortened. Previous: ${previous_notice_of_filing_end_date}, Current: ${notice_of_filing_end_date}`,
      });
    }
  }

  // V-REC-12: Extend-only: Job order end can only extend
  if (
    previous_job_order_end_date &&
    job_order_end_date &&
    previous_job_order_end_date !== job_order_end_date
  ) {
    const previous = parseISO(previous_job_order_end_date);
    const current = parseISO(job_order_end_date);

    if (isBefore(current, previous)) {
      errors.push({
        ruleId: 'V-REC-12',
        severity: 'error',
        field: 'job_order_end_date',
        message: `Job order end date can only be extended, not shortened. Previous: ${previous_job_order_end_date}, Current: ${job_order_end_date}`,
      });
    }
  }

  return createValidationResult(errors, warnings);
}
