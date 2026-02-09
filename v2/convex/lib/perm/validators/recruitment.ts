import { parseISO, isBefore, isAfter, getDay, differenceInDays, isValid, addDays } from 'date-fns';
import type { ValidationResult, ValidationIssue, CaseData } from '../types';
import { createValidationResult } from '../types';
import { countBusinessDays } from '../dates/businessDays';
import { JOB_ORDER_MIN_DAYS, NOTICE_MIN_BUSINESS_DAYS } from '../constants';
import { DATE_RANGE_METHODS, SUB_ENTRY_METHODS } from '../recruitment/methodCategories';

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

/**
 * Input for professional method-level date validation (Feature 006).
 */
export interface ProfessionalMethodsInput {
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;
  firstRecruitmentDate?: string | null;
  methods: Array<{
    method: string;
    date: string;
    startDate?: string;
    endDate?: string;
    subEntries?: Array<{ date: string; description?: string }>;
  }>;
}

/**
 * Validate professional recruitment method-level dates (V-PROF rules).
 *
 * Rules enforced:
 * - V-PROF-01: Date range start must be after PWD determination date
 * - V-PROF-02: Date range start cannot be after end date
 * - V-PROF-03: Date range end must be before recruitment window close
 * - V-PROF-04: Date range end cannot be before start (same as V-PROF-02)
 * - V-PROF-05: Sub-entries date must be within recruitment window
 *
 * @param input - Professional methods with dates to validate
 * @returns Validation result with errors and warnings
 */
export function validateProfessionalMethods(
  input: ProfessionalMethodsInput
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const { pwdDeterminationDate, pwdExpirationDate, firstRecruitmentDate, methods } = input;

  // Calculate recruitment window max date: min(firstRecruitment + 150, pwdExpiration - 30)
  let maxRecruitmentDate: Date | null = null;
  const firstDate = firstRecruitmentDate ? parseISO(firstRecruitmentDate) : null;
  const pwdMax = pwdExpirationDate ? parseISO(pwdExpirationDate) : null;

  if (firstDate && isValid(firstDate)) {
    const max150 = addDays(firstDate, 150);
    const pwdCap = pwdMax && isValid(pwdMax) ? addDays(pwdMax, -30) : null;
    maxRecruitmentDate = pwdCap && pwdCap < max150 ? pwdCap : max150;
  } else if (pwdMax && isValid(pwdMax)) {
    maxRecruitmentDate = addDays(pwdMax, -30);
  }

  const pwdDetDate = pwdDeterminationDate ? parseISO(pwdDeterminationDate) : null;

  // Validate each method
  methods.forEach((method, index) => {
    // Only validate date-range and sub-entry methods
    const isDateRange = (DATE_RANGE_METHODS as readonly string[]).includes(method.method);
    const isSubEntry = (SUB_ENTRY_METHODS as readonly string[]).includes(method.method);

    if (!isDateRange && !isSubEntry) {
      return; // Single-date methods are validated by existing validators
    }

    // DATE-RANGE METHOD VALIDATION
    if (isDateRange) {
      const { startDate, endDate } = method;

      // V-PROF-01: startDate must be after PWDDD
      if (startDate && pwdDetDate && isValid(pwdDetDate)) {
        const start = parseISO(startDate);
        if (isValid(start) && !isAfter(start, pwdDetDate)) {
          errors.push({
            ruleId: 'V-PROF-01',
            severity: 'error',
            field: `additionalRecruitmentMethods.${index}.startDate`,
            message: `Method start date must be after PWD determination date (${pwdDeterminationDate})`,
          });
        }
      }

      // V-PROF-02: startDate must not be after endDate (covers V-PROF-04 from endDate perspective)
      if (startDate && endDate) {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        if (isValid(start) && isValid(end) && isAfter(start, end)) {
          errors.push({
            ruleId: 'V-PROF-02',
            severity: 'error',
            field: `additionalRecruitmentMethods.${index}.endDate`,
            message: 'Method end date must be on or after start date',
          });
        }
      }

      // V-PROF-03: endDate must be within recruitment window
      if (endDate && maxRecruitmentDate) {
        const end = parseISO(endDate);
        if (isValid(end) && isAfter(end, maxRecruitmentDate)) {
          const maxDateStr = maxRecruitmentDate.toISOString().split('T')[0];
          errors.push({
            ruleId: 'V-PROF-03',
            severity: 'error',
            field: `additionalRecruitmentMethods.${index}.endDate`,
            message: `Method end date must be on or before ${maxDateStr} (recruitment window closes)`,
          });
        }
      }
    }

    // SUB-ENTRY METHOD VALIDATION
    if (isSubEntry && method.subEntries) {
      method.subEntries.forEach((entry, subIndex) => {
        const entryDate = parseISO(entry.date);
        if (!isValid(entryDate)) return;

        // V-PROF-05: sub-entry date must be after PWDDD
        if (pwdDetDate && isValid(pwdDetDate) && !isAfter(entryDate, pwdDetDate)) {
          errors.push({
            ruleId: 'V-PROF-05',
            severity: 'error',
            field: `additionalRecruitmentMethods.${index}.subEntries.${subIndex}.date`,
            message: `Entry date must be after PWD determination date (${pwdDeterminationDate})`,
          });
        }

        // V-PROF-05: sub-entry date must be within recruitment window
        if (maxRecruitmentDate && isAfter(entryDate, maxRecruitmentDate)) {
          const maxDateStr = maxRecruitmentDate.toISOString().split('T')[0];
          errors.push({
            ruleId: 'V-PROF-05',
            severity: 'error',
            field: `additionalRecruitmentMethods.${index}.subEntries.${subIndex}.date`,
            message: `Entry date must be on or before ${maxDateStr} (recruitment window closes)`,
          });
        }
      });
    }
  });

  return createValidationResult(errors, warnings);
}
