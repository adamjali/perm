import { parseISO, isAfter, differenceInDays, formatISO, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue, CaseData } from '../types';
import { createValidationResult } from '../types';
import { calculateETA9089Expiration } from '../calculators/eta9089';
import { FILING_WINDOW_WAIT_DAYS, FILING_WINDOW_CLOSE_DAYS, ETA9089_EXPIRATION_DAYS } from '../constants';
import { pwdBearing } from '../dates/pwdValidity';

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
> &
  Partial<Pick<CaseData, 'pwd_determination_date' | 'pwd_recruitment_start_date'>>;

/**
 * Validate ETA 9089 dates according to PERM regulations.
 *
 * Rules enforced:
 * - V-ETA-01: ETA 9089 filing must be at least 30 days after recruitment ends (last recruitment date)
 * - V-ETA-02: ETA 9089 filing must be within 180 days after recruitment starts (first recruitment date)
 * - V-ETA-03: the PWD (20 CFR 656.40(c)): file by its expiry unless recruitment
 *   began inside its validity period (dates/pwdValidity.ts)
 * - V-ETA-04: ETA 9089 certification must be after filing date
 * - V-ETA-05: Warning if expiration doesn't match calculated value (180 days after certification)
 *
 * Filing window logic:
 * - OPENS: 30 days after LAST recruitment step ends (recruitment_end_date)
 * - CLOSES: 180 days after FIRST recruitment step starts (recruitment_start_date), or at
 *   the PWD expiration while the PWD still limits the case (dates/pwdValidity.ts)
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

  // V-ETA-03: 20 CFR 656.40(c), "file their applications or begin the
  // recruitment period ... within the validity period". Recruitment begun
  // inside validity (first 656.17(e) step on or after the determination, on or
  // before the expiry) frees the filing from the expiry; the 180-day rule above
  // still closes it. Karl Storz Endoscopy-America, BALCA en banc, 2011-PER-00040.
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
    } else if (isAfter(filing, pwdExpiration)) {
      const bearing = pwdBearing({
        pwdDeterminationDate: input.pwd_determination_date,
        pwdExpirationDate: pwd_expiration_date,
        firstPwdStep: input.pwd_recruitment_start_date ?? recruitment_start_date,
      });
      if (bearing === 'began-before') {
        errors.push({
          ruleId: 'V-ETA-03',
          severity: 'error',
          field: 'eta9089_filing_date',
          message:
            'Recruitment began before the wage determination was issued, so the ETA 9089 must be filed by the PWD expiration (20 CFR § 656.40(c))',
          regulation: '20 CFR § 656.40(c)',
        });
      } else if (bearing === 'began-after' || bearing === 'not-begun') {
        errors.push({
          ruleId: 'V-ETA-03',
          severity: 'error',
          field: 'eta9089_filing_date',
          message:
            'Recruitment has to begin while the wage determination is valid, or the ETA 9089 be filed by its expiration (20 CFR § 656.40(c))',
          regulation: '20 CFR § 656.40(c)',
        });
      } else if (bearing === 'determination-unknown') {
        warnings.push({
          ruleId: 'V-ETA-03',
          severity: 'warning',
          field: 'eta9089_filing_date',
          message:
            'Filed after the PWD expiration. That is allowed only if recruitment began on or after the determination date, so add the determination date to check it (20 CFR § 656.40(c))',
          regulation: '20 CFR § 656.40(c)',
        });
      }
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
