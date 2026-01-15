import { parseISO, isBefore, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue, CaseData } from '../types';
import { createValidationResult } from '../types';
import { calculatePWDExpiration } from '../calculators/pwd';
import { getTodayISO, error, warning } from '../utils/validation';

/**
 * Input data for PWD validation.
 */
export type PWDValidationInput = Pick<
  CaseData,
  'pwd_filing_date' | 'pwd_determination_date' | 'pwd_expiration_date'
>;

/**
 * Validate PWD dates according to PERM regulations.
 *
 * Rules:
 * - V-PWD-01: Filing date must be before determination date
 * - V-PWD-02: Determination date must be before expiration date
 * - V-PWD-03: Warning if expiration doesn't match calculated value
 * - V-PWD-04: Warning if PWD has expired
 */
export function validatePWD(input: PWDValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { pwd_filing_date, pwd_determination_date, pwd_expiration_date } = input;

  // V-PWD-01: Filing before determination
  if (pwd_filing_date && pwd_determination_date) {
    const filing = parseISO(pwd_filing_date);
    const determination = parseISO(pwd_determination_date);

    if (!isValid(filing)) {
      errors.push(error('V-PWD-01', 'pwd_filing_date', `Invalid date format: ${pwd_filing_date}`));
      return createValidationResult(errors, warnings);
    }
    if (!isValid(determination)) {
      errors.push(error('V-PWD-01', 'pwd_determination_date', `Invalid date format: ${pwd_determination_date}`));
      return createValidationResult(errors, warnings);
    }

    if (!isBefore(filing, determination)) {
      errors.push(error(
        'V-PWD-01',
        'pwd_filing_date',
        'PWD filing date must be before determination date (20 CFR 656.40)',
        '20 CFR 656.40'
      ));
    }
  }

  // V-PWD-02: Determination before expiration
  if (pwd_determination_date && pwd_expiration_date) {
    const determination = parseISO(pwd_determination_date);
    const expiration = parseISO(pwd_expiration_date);

    if (!isValid(determination)) {
      errors.push(error('V-PWD-02', 'pwd_determination_date', `Invalid date format: ${pwd_determination_date}`));
    } else if (!isValid(expiration)) {
      errors.push(error('V-PWD-02', 'pwd_expiration_date', `Invalid date format: ${pwd_expiration_date}`));
    } else if (!isBefore(determination, expiration)) {
      errors.push(error(
        'V-PWD-02',
        'pwd_determination_date',
        'PWD determination date must be before expiration date (20 CFR 656.40(c))',
        '20 CFR 656.40(c)'
      ));
    }
  }

  // V-PWD-03: Expiration mismatch warning
  if (pwd_determination_date && pwd_expiration_date) {
    const expected = calculatePWDExpiration(pwd_determination_date);
    if (expected !== pwd_expiration_date) {
      warnings.push(warning(
        'V-PWD-03',
        'pwd_expiration_date',
        `PWD expiration date should be ${expected} based on determination date. Current value: ${pwd_expiration_date}`,
        '20 CFR 656.40(c)'
      ));
    }
  }

  // V-PWD-04: Expired PWD warning
  if (pwd_expiration_date) {
    const today = getTodayISO();
    if (pwd_expiration_date < today) {
      warnings.push(warning(
        'V-PWD-04',
        'pwd_expiration_date',
        `PWD has expired. Expiration date: ${pwd_expiration_date}`,
        '20 CFR 656.40(c)'
      ));
    }
  }

  return createValidationResult(errors, warnings);
}
