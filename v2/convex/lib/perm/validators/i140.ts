import { parseISO, isAfter, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue } from '../types';
import { createValidationResult } from '../types';
import { calculateI140FilingDeadline } from '../calculators/i140';
import { error } from '../utils/validation';

/**
 * Input data for I-140 validation.
 */
export interface I140ValidationInput {
  eta9089_certification_date: string | null;
  /** The certification's printed last day; certification + 179 days when absent. */
  eta9089_expiration_date?: string | null;
  i140_filing_date: string | null;
  i140_approval_date: string | null;
}

/**
 * Validate I-140 dates according to PERM regulations.
 *
 * Rules:
 * - V-I140-01: Filing must be after ETA 9089 certification
 * - V-I140-02: Filing must be on or before the ETA 9089 expiration date
 * - V-I140-03: Approval must be after filing
 */
export function validateI140(input: I140ValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { eta9089_certification_date, eta9089_expiration_date, i140_filing_date, i140_approval_date } = input;

  // V-I140-01: Filing after certification
  if (eta9089_certification_date && i140_filing_date) {
    const certification = parseISO(eta9089_certification_date);
    const filing = parseISO(i140_filing_date);

    if (!isValid(certification)) {
      errors.push(error('V-I140-01', 'eta9089_certification_date', `Invalid date format: ${eta9089_certification_date}`));
      return createValidationResult(errors, warnings);
    }
    if (!isValid(filing)) {
      errors.push(error('V-I140-01', 'i140_filing_date', `Invalid date format: ${i140_filing_date}`));
      return createValidationResult(errors, warnings);
    }

    if (!isAfter(filing, certification)) {
      errors.push(error(
        'V-I140-01',
        'i140_filing_date',
        'I-140 filing date must be after ETA 9089 certification date'
      ));
    }
  }

  // V-I140-02: Filing on or before the certification's last valid day: the
  // expiration date on the case (what DOL printed) or, without one, the
  // computed date. A day count here once disagreed with the stored date.
  if (eta9089_certification_date && i140_filing_date) {
    const certification = parseISO(eta9089_certification_date);
    const filing = parseISO(i140_filing_date);

    if (isValid(certification) && isValid(filing)) {
      const lastDay =
        eta9089_expiration_date && isValid(parseISO(eta9089_expiration_date))
          ? eta9089_expiration_date
          : calculateI140FilingDeadline(eta9089_certification_date);
      if (i140_filing_date > lastDay) {
        errors.push(error(
          'V-I140-02',
          'i140_filing_date',
          `I-140 must be filed on or before the ETA 9089 expiration date (${lastDay}). Filed: ${i140_filing_date}`
        ));
      }
    }
  }

  // V-I140-03: Approval after filing
  if (i140_filing_date && i140_approval_date) {
    const filing = parseISO(i140_filing_date);
    const approval = parseISO(i140_approval_date);

    if (!isValid(filing) && !eta9089_certification_date) {
      errors.push(error('V-I140-03', 'i140_filing_date', `Invalid date format: ${i140_filing_date}`));
    } else if (!isValid(approval)) {
      errors.push(error('V-I140-03', 'i140_approval_date', `Invalid date format: ${i140_approval_date}`));
    } else if (!isAfter(approval, filing)) {
      errors.push(error(
        'V-I140-03',
        'i140_approval_date',
        'I-140 approval date must be after filing date'
      ));
    }
  }

  return createValidationResult(errors, warnings);
}
