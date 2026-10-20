import type { ValidationResult, ValidationIssue } from '../types';
import { createValidationResult } from '../types';
import { error, warning } from '../utils/validation';
import { calculateBalcaRequestDeadline, calculateDenialReviewDeadline } from '../calculators/denialReview';
import { DENIAL_REVIEW_DAYS } from '../constants';

/**
 * Input data for validating an ETA 9089 denial and the requests after it.
 */
export interface DenialReviewValidationInput {
  eta9089_filing_date: string | null;
  eta9089_denial_date?: string | null;
  eta9089_reconsideration_date?: string | null;
  eta9089_reconsideration_denied_date?: string | null;
  eta9089_balca_request_date?: string | null;
}

/**
 * Validate the denial path (calculators/denialReview.ts).
 *
 * - V-DEN-01: the denial can't come before the ETA 9089 filing
 * - V-DEN-02: a request can't come before what it answers (reconsideration and
 *   BALCA review after the denial; the reconsideration decision after the
 *   request; BALCA review after a reconsideration decision, when there is one)
 * - V-DEN-03: warning when a request is later than 30 days, 20 CFR 656.24(g)(1)
 *   and 656.26(a)(2)(i)
 * - V-DEN-04: warning when both were requested with no reconsideration decision:
 *   DOL's PERM FAQ Round 14 treats "a submission that ... asks for both" as a
 *   request for reconsideration
 *
 * Dates are ISO strings, so they compare as text.
 */
export function validateDenialReview(input: DenialReviewValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const filing = input.eta9089_filing_date || null;
  const denial = input.eta9089_denial_date || null;
  const reconsideration = input.eta9089_reconsideration_date || null;
  const upheld = input.eta9089_reconsideration_denied_date || null;
  const balca = input.eta9089_balca_request_date || null;

  if (!denial) return createValidationResult(errors, warnings);

  if (filing && denial < filing) {
    errors.push(error('V-DEN-01', 'eta9089_denial_date', `The denial (${denial}) can't come before the ETA 9089 filing (${filing}).`));
  }

  if (reconsideration && reconsideration < denial) {
    errors.push(error('V-DEN-02', 'eta9089_reconsideration_date', `Reconsideration (${reconsideration}) can't be requested before the denial (${denial}).`));
  }
  if (upheld && reconsideration && upheld < reconsideration) {
    errors.push(error('V-DEN-02', 'eta9089_reconsideration_denied_date', `The reconsideration decision (${upheld}) can't come before the request (${reconsideration}).`));
  }
  if (balca && balca < (upheld || denial)) {
    errors.push(error(
      'V-DEN-02',
      'eta9089_balca_request_date',
      upheld
        ? `BALCA review (${balca}) can't be requested before the reconsideration decision (${upheld}).`
        : `BALCA review (${balca}) can't be requested before the denial (${denial}).`,
    ));
  }

  const reviewDue = calculateDenialReviewDeadline(denial);
  const firstRequest = [reconsideration, upheld ? null : balca].filter((d): d is string => !!d).sort()[0];
  if (firstRequest && firstRequest > reviewDue) {
    warnings.push(warning(
      'V-DEN-03',
      firstRequest === reconsideration ? 'eta9089_reconsideration_date' : 'eta9089_balca_request_date',
      `Requested ${firstRequest}, after ${reviewDue}: DOL takes a request within ${DENIAL_REVIEW_DAYS} days of the denial letter's date.`,
      '20 CFR 656.24(g)(1), 656.26(a)(2)(i)',
    ));
  }
  if (upheld && balca && balca > calculateBalcaRequestDeadline(upheld)) {
    warnings.push(warning(
      'V-DEN-03',
      'eta9089_balca_request_date',
      `BALCA review requested ${balca}, after ${calculateBalcaRequestDeadline(upheld)}: DOL takes it within ${DENIAL_REVIEW_DAYS} days of the reconsideration notice.`,
      "DOL's PERM FAQ Round 14",
    ));
  }

  if (reconsideration && balca && !upheld) {
    warnings.push(warning(
      'V-DEN-04',
      'eta9089_balca_request_date',
      'Both reconsideration and BALCA review are recorded with no reconsideration decision. DOL treats a request for both as reconsideration.',
      "DOL's PERM FAQ Round 14",
    ));
  }

  return createValidationResult(errors, warnings);
}
