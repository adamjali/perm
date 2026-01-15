import type { ValidationResult, CaseData } from '../types';
import { composeValidators as _composeValidators, mergeResults } from '../utils/validation';
import { validatePWD } from './pwd';
import { validateRecruitment } from './recruitment';
import { validateETA9089 } from './eta9089';
import { validateI140 } from './i140';
import { validateRFI } from './rfi';
import { validateRFE } from './rfe';

/**
 * Validation-relevant subset of CaseData (excludes status fields).
 */
export type ValidationCaseData = Omit<CaseData, 'case_status' | 'progress_status'>;

/**
 * Master validation function that runs all PERM validators.
 *
 * Validates:
 * - PWD (V-PWD-01 to V-PWD-04)
 * - Recruitment (V-REC-01 to V-REC-12)
 * - ETA 9089 (V-ETA-01 to V-ETA-05)
 * - I-140 (V-I140-01 to V-I140-03)
 * - RFI (V-RFI-01 to V-RFI-05)
 * - RFE (V-RFE-01 to V-RFE-05)
 */
export function validateCase(caseData: ValidationCaseData): ValidationResult {
  return mergeResults([
    validatePWD({
      pwd_filing_date: caseData.pwd_filing_date,
      pwd_determination_date: caseData.pwd_determination_date,
      pwd_expiration_date: caseData.pwd_expiration_date,
    }),
    validateRecruitment({
      sunday_ad_first_date: caseData.sunday_ad_first_date,
      sunday_ad_second_date: caseData.sunday_ad_second_date,
      job_order_start_date: caseData.job_order_start_date,
      job_order_end_date: caseData.job_order_end_date,
      notice_of_filing_start_date: caseData.notice_of_filing_start_date,
      notice_of_filing_end_date: caseData.notice_of_filing_end_date,
    }),
    validateETA9089({
      recruitment_start_date: caseData.recruitment_start_date,
      recruitment_end_date: caseData.recruitment_end_date,
      eta9089_filing_date: caseData.eta9089_filing_date,
      pwd_expiration_date: caseData.pwd_expiration_date,
      eta9089_certification_date: caseData.eta9089_certification_date,
      eta9089_expiration_date: caseData.eta9089_expiration_date,
    }),
    validateI140({
      eta9089_certification_date: caseData.eta9089_certification_date,
      i140_filing_date: caseData.i140_filing_date,
      i140_approval_date: caseData.i140_approval_date,
    }),
    validateRFI({
      eta9089_filing_date: caseData.eta9089_filing_date,
      rfi_received_date: caseData.rfi_received_date,
      rfi_due_date: caseData.rfi_due_date,
      rfi_submitted_date: caseData.rfi_submitted_date,
    }),
    validateRFE({
      i140_filing_date: caseData.i140_filing_date,
      rfe_received_date: caseData.rfe_received_date,
      rfe_due_date: caseData.rfe_due_date,
      rfe_submitted_date: caseData.rfe_submitted_date,
    }),
  ]);
}
