import { parseISO, isAfter, differenceInDays, isValid } from 'date-fns';
import type { ValidationResult, ValidationIssue } from '../types';
import { createValidationResult } from '../types';
import { I140_FILING_DAYS } from '../constants';
import { error } from '../utils/validation';

/**
 * Input data for I-140 validation.
 */
export interface I140ValidationInput {
  eta9089_certification_date: string | null;
  i140_filing_date: string | null;
  i140_approval_date: string | null;
}

/**
 * Validate I-140 dates according to PERM regulations.
 *
 * Rules:
 * - V-I140-01: Filing must be after ETA 9089 certification
 * - V-I140-02: Filing must be within 180 days of certification
 * - V-I140-03: Approval must be after filing
 */
export function validateI140(input: I140ValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { eta9089_certification_date, i140_filing_date, i140_approval_date } = input;

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

  // V-I140-02: Filing within 180 days
  if (eta9089_certification_date && i140_filing_date) {
    const certification = parseISO(eta9089_certification_date);
    const filing = parseISO(i140_filing_date);

    if (isValid(certification) && isValid(filing)) {
      const days = differenceInDays(filing, certification);
      if (days > I140_FILING_DAYS) {
        errors.push(error(
          'V-I140-02',
          'i140_filing_date',
          `I-140 must be filed within ${I140_FILING_DAYS} days of ETA 9089 certification. Current: ${days} days after certification`
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
