import { parseISO, isBefore, isAfter, differenceInDays, formatISO, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue, CaseData } from '../types';
import { createValidationResult } from '../types';
import { calculateETA9089Expiration } from '../calculators/eta9089';
import { FILING_WINDOW_WAIT_DAYS, FILING_WINDOW_CLOSE_DAYS, ETA9089_EXPIRATION_DAYS } from '../constants';

/**
 * Input data for ETA 9089 validation.
 * Derived from CaseData to prevent type drift.
 */
export type ETA9089ValidationInput = Pick<
  CaseData,
  | 'recruitment_start_date'
  | 'recruitment_end_date'
  | 'eta9089_filing_date'
  | 'pwd_expiration_date'
  | 'eta9089_certification_date'
  | 'eta9089_expiration_date'
>;

/**
 * Validate ETA 9089 dates according to PERM regulations.
 *
 * Rules enforced:
 * - V-ETA-01: ETA 9089 filing must be at least 30 days after recruitment ends (last recruitment date)
 * - V-ETA-02: ETA 9089 filing must be within 180 days after recruitment starts (first recruitment date)
 * - V-ETA-03: ETA 9089 filing must be before PWD expiration date
 * - V-ETA-04: ETA 9089 certification must be after filing date
 * - V-ETA-05: Warning if expiration doesn't match calculated value (180 days after certification)
 *
 * Filing window logic:
 * - OPENS: 30 days after LAST recruitment step ends (recruitment_end_date)
 * - CLOSES: 180 days after FIRST recruitment step starts (recruitment_start_date) OR PWD expiration (whichever is first)
 *
 * @param input - ETA 9089 dates to validate
 * @returns Validation result with errors and warnings
 */
export function validateETA9089(
  input: ETA9089ValidationInput
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const {
    recruitment_start_date,
    recruitment_end_date,
    eta9089_filing_date,
    pwd_expiration_date,
    eta9089_certification_date,
    eta9089_expiration_date,
  } = input;

  // V-ETA-01: ETA 9089 filing must be at least 30 days after recruitment ends
  if (recruitment_end_date && eta9089_filing_date) {
    const recruitmentEnd = parseISO(recruitment_end_date);
    const filing = parseISO(eta9089_filing_date);

    if (!isValid(recruitmentEnd)) {
      errors.push({
        ruleId: 'V-ETA-01',
        severity: 'error',
        field: 'recruitment_end_date',
        message: `Invalid date format: ${recruitment_end_date}`,
      });
    } else if (!isValid(filing)) {
      errors.push({
        ruleId: 'V-ETA-01',
        severity: 'error',
        field: 'eta9089_filing_date',
        message: `Invalid date format: ${eta9089_filing_date}`,
      });
    } else {
      const days = differenceInDays(filing, recruitmentEnd);

      if (days < FILING_WINDOW_WAIT_DAYS) {
        errors.push({
          ruleId: 'V-ETA-01',
          severity: 'error',
          field: 'eta9089_filing_date',
          message: `ETA 9089 must be filed at least ${FILING_WINDOW_WAIT_DAYS} days after recruitment ends. Current: ${days} days after recruitment end (20 CFR § 656.17)`,
          regulation: '20 CFR § 656.17',
        });
      }
    }
  }

  // V-ETA-02: ETA 9089 filing must be within 180 days after recruitment STARTS (first recruitment date)
  // Filing window CLOSES 180 days after FIRST recruitment step, not last
  if (recruitment_start_date && eta9089_filing_date) {
    const recruitmentStart = parseISO(recruitment_start_date);
    const filing = parseISO(eta9089_filing_date);

    // Skip if start date is invalid
    if (!isValid(recruitmentStart)) {
      errors.push({
        ruleId: 'V-ETA-02',
        severity: 'error',
        field: 'recruitment_start_date',
        message: `Invalid date format: ${recruitment_start_date}`,
      });
    } else if (isValid(filing)) {
      const days = differenceInDays(filing, recruitmentStart);

      if (days > FILING_WINDOW_CLOSE_DAYS) {
        errors.push({
          ruleId: 'V-ETA-02',
          severity: 'error',
          field: 'eta9089_filing_date',
          message: `ETA 9089 must be filed within ${FILING_WINDOW_CLOSE_DAYS} days after recruitment starts. Current: ${days} days after recruitment start (20 CFR § 656.17)`,
          regulation: '20 CFR § 656.17',
        });
      }
    }
  }

  // V-ETA-03: ETA 9089 filing must be before PWD expiration date (Either/Or Rule)
  if (eta9089_filing_date && pwd_expiration_date) {
    const filing = parseISO(eta9089_filing_date);
    const pwdExpiration = parseISO(pwd_expiration_date);

    if (!isValid(filing)) {
      // Already caught above if recruitment_end_date was provided
      if (!recruitment_end_date) {
        errors.push({
          ruleId: 'V-ETA-03',
          severity: 'error',
          field: 'eta9089_filing_date',
          message: `Invalid date format: ${eta9089_filing_date}`,
        });
      }
    } else if (!isValid(pwdExpiration)) {
      errors.push({
        ruleId: 'V-ETA-03',
        severity: 'error',
        field: 'pwd_expiration_date',
        message: `Invalid date format: ${pwd_expiration_date}`,
      });
    } else if (!isBefore(filing, pwdExpiration)) {
      errors.push({
        ruleId: 'V-ETA-03',
        severity: 'error',
        field: 'eta9089_filing_date',
        message:
          'ETA 9089 filing must be before PWD expiration date (20 CFR § 656.40(c))',
        regulation: '20 CFR § 656.40(c)',
      });
    }
  }

  // V-ETA-04: ETA 9089 certification must be after filing date
  if (eta9089_filing_date && eta9089_certification_date) {
    const filing = parseISO(eta9089_filing_date);
    const certification = parseISO(eta9089_certification_date);

    if (!isValid(certification)) {
      errors.push({
        ruleId: 'V-ETA-04',
        severity: 'error',
        field: 'eta9089_certification_date',
        message: `Invalid date format: ${eta9089_certification_date}`,
      });
    } else if (isValid(filing) && !isAfter(certification, filing)) {
      errors.push({
        ruleId: 'V-ETA-04',
        severity: 'error',
        field: 'eta9089_certification_date',
        message: 'ETA 9089 certification date must be after filing date',
      });
    }
  }

  // V-ETA-05: Warning if expiration doesn't match calculated value (180 days after certification)
  if (eta9089_certification_date && eta9089_expiration_date) {
    const certificationDate = parseISO(eta9089_certification_date);

    // Skip if certification date is invalid (already caught above)
    if (isValid(certificationDate)) {
      const expectedExpirationDate = calculateETA9089Expiration(certificationDate);
      const expectedExpiration = formatISO(expectedExpirationDate, {
        representation: 'date',
      });

      if (expectedExpiration !== eta9089_expiration_date) {
        warnings.push({
          ruleId: 'V-ETA-05',
          severity: 'warning',
          field: 'eta9089_expiration_date',
          message: `ETA 9089 expiration date should be ${expectedExpiration} (${ETA9089_EXPIRATION_DAYS} days after certification). Current value: ${eta9089_expiration_date}`,
        });
      }
    }
  }

  return createValidationResult(errors, warnings);
}
