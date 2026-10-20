import { addDays, parseISO, format } from 'date-fns';
import { DENIAL_REVIEW_DAYS } from '../constants';

/**
 * What can follow an ETA 9089 denial, and by when.
 *
 * DOL's Final Determination letter denies the application. Within 30 calendar
 * days of the letter's date the employer may ask for ONE of: reconsideration by
 * the Certifying Officer (20 CFR 656.24(g)) or review by BALCA (656.26). If the
 * Certifying Officer reconsiders and upholds the denial, the employer has 30
 * days from that notice to ask BALCA; nothing is forwarded on its own (DOL's
 * PERM FAQ Round 14, question 3). With no request in time the denial is final
 * (656.24(e)), and a new application may be filed.
 *
 * A certification date ends the path whatever came before it: a denial that
 * reconsideration or BALCA reversed leaves both dates on the case, and the
 * certification is the one that counts.
 *
 * @module
 */

/** The denial path's dates, as a case holds them. */
export interface DenialReviewInput {
  eta9089CertificationDate?: string | null;
  /** The date on DOL's Final Determination letter. */
  eta9089DenialDate?: string | null;
  /** When the employer asked the Certifying Officer to reconsider. */
  eta9089ReconsiderationDate?: string | null;
  /** The date on the Certifying Officer's notice upholding the denial. */
  eta9089ReconsiderationDeniedDate?: string | null;
  /** When the employer asked BALCA to review the denial. */
  eta9089BalcaRequestDate?: string | null;
}

/**
 * Where a denied case stands:
 * - "request-review": nothing asked yet; reconsideration or BALCA, by denial + 30
 * - "reconsidering": reconsideration asked, the Certifying Officer hasn't answered
 * - "request-balca": reconsideration upheld the denial; BALCA, by notice + 30
 * - "at-balca": BALCA review asked
 */
export type DenialReviewStep = 'request-review' | 'reconsidering' | 'request-balca' | 'at-balca';

/** The denied case's step, or null when the ETA 9089 isn't denied (or was certified). */
export function denialReviewStep(input: DenialReviewInput): DenialReviewStep | null {
  if (!input.eta9089DenialDate || input.eta9089CertificationDate) return null;
  if (input.eta9089BalcaRequestDate) return 'at-balca';
  if (input.eta9089ReconsiderationDeniedDate) return 'request-balca';
  if (input.eta9089ReconsiderationDate) return 'reconsidering';
  return 'request-review';
}

function plusReviewDays(isoDate: string): string {
  return format(addDays(parseISO(isoDate), DENIAL_REVIEW_DAYS), 'yyyy-MM-dd');
}

/**
 * The last day to ask for reconsideration or BALCA review: the denial
 * letter's date + 30 calendar days.
 *
 * @example
 * calculateDenialReviewDeadline('2026-03-02') // '2026-04-01'
 */
export function calculateDenialReviewDeadline(denialDate: string): string {
  return plusReviewDays(denialDate);
}

/**
 * The last day to ask BALCA after reconsideration upheld the denial: the
 * Certifying Officer's notice date + 30 calendar days.
 */
export function calculateBalcaRequestDeadline(reconsiderationDeniedDate: string): string {
  return plusReviewDays(reconsiderationDeniedDate);
}

/** The deadline the case's step sets, or null when it sets none. */
export function denialReviewDeadline(
  input: DenialReviewInput,
): { kind: 'review' | 'balca'; date: string } | null {
  const step = denialReviewStep(input);
  if (step === 'request-review' && input.eta9089DenialDate) {
    return { kind: 'review', date: calculateDenialReviewDeadline(input.eta9089DenialDate) };
  }
  if (step === 'request-balca' && input.eta9089ReconsiderationDeniedDate) {
    return { kind: 'balca', date: calculateBalcaRequestDeadline(input.eta9089ReconsiderationDeniedDate) };
  }
  return null;
}
