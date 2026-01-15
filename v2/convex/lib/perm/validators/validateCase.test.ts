import { describe, it, expect } from 'vitest';
import { validateCase, type ValidationCaseData } from './validateCase';
import type { ValidationResult } from '../types';

describe('validateCase - Master Validator', () => {
  it('should return valid result when all dates are null', () => {
    const caseData: ValidationCaseData = {
      // PWD dates
      pwd_filing_date: null,
      pwd_determination_date: null,
      pwd_expiration_date: null,
      // Recruitment dates
      sunday_ad_first_date: null,
      sunday_ad_second_date: null,
      job_order_start_date: null,
      job_order_end_date: null,
      notice_of_filing_start_date: null,
      notice_of_filing_end_date: null,
      recruitment_start_date: null,
      recruitment_end_date: null,
      is_professional_occupation: false,
      // ETA 9089 dates
      eta9089_filing_date: null,
      eta9089_certification_date: null,
      eta9089_expiration_date: null,
      // I-140 dates
      i140_filing_date: null,
      i140_approval_date: null,
      // RFI dates
      rfi_received_date: null,
      rfi_due_date: null,
      rfi_submitted_date: null,
      // RFE dates
      rfe_received_date: null,
      rfe_due_date: null,
      rfe_submitted_date: null,
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should return valid result for a complete valid case', () => {
    const caseData: ValidationCaseData = {
      // PWD dates
      pwd_filing_date: '2026-01-01',
      pwd_determination_date: '2026-01-15',
      pwd_expiration_date: '2027-06-30',
      // Recruitment dates
      sunday_ad_first_date: '2026-02-01', // Sunday
      sunday_ad_second_date: '2026-02-08', // Sunday, 7 days later
      job_order_start_date: '2026-02-01',
      job_order_end_date: '2026-03-15', // 30+ days
      notice_of_filing_start_date: '2026-02-01',
      notice_of_filing_end_date: '2026-02-16', // 10+ business days
      recruitment_start_date: '2026-02-01',
      recruitment_end_date: '2026-03-15',
      is_professional_occupation: false,
      // ETA 9089 dates
      eta9089_filing_date: '2026-04-20', // 36 days after recruitment end
      eta9089_certification_date: '2026-08-01',
      eta9089_expiration_date: '2027-01-28', // 180 days after certification
      // I-140 dates
      i140_filing_date: '2026-08-15', // Within 180 days of certification
      i140_approval_date: '2026-10-01',
      // RFI dates
      rfi_received_date: '2026-05-15',
      rfi_due_date: '2026-06-14', // Exactly 30 days
      rfi_submitted_date: '2026-06-10',
      // RFE dates
      rfe_received_date: '2026-09-01',
      rfe_due_date: '2026-10-15',
      rfe_submitted_date: '2026-10-10',
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should aggregate errors from multiple validators', () => {
    const caseData: ValidationCaseData = {
      // PWD dates - Invalid: filing after determination
      pwd_filing_date: '2026-01-20',
      pwd_determination_date: '2026-01-15',
      pwd_expiration_date: '2027-06-30',
      // Recruitment dates
      sunday_ad_first_date: null,
      sunday_ad_second_date: null,
      job_order_start_date: '2026-02-01',
      job_order_end_date: '2026-02-10', // Invalid: less than 30 days
      notice_of_filing_start_date: null,
      notice_of_filing_end_date: null,
      recruitment_start_date: '2026-02-01',
      recruitment_end_date: '2026-02-10',
      is_professional_occupation: false,
      // ETA 9089 dates - Invalid: filing too soon (less than 30 days)
      eta9089_filing_date: '2026-02-20', // Only 10 days after recruitment end
      eta9089_certification_date: null,
      eta9089_expiration_date: null,
      // I-140 dates
      i140_filing_date: null,
      i140_approval_date: null,
      // RFI dates
      rfi_received_date: null,
      rfi_due_date: null,
      rfi_submitted_date: null,
      // RFE dates
      rfe_received_date: null,
      rfe_due_date: null,
      rfe_submitted_date: null,
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Should have errors from PWD validator
    const pwdErrors = result.errors.filter((e) => e.ruleId.startsWith('V-PWD'));
    expect(pwdErrors.length).toBeGreaterThan(0);

    // Should have errors from Recruitment validator
    const recErrors = result.errors.filter((e) => e.ruleId.startsWith('V-REC'));
    expect(recErrors.length).toBeGreaterThan(0);

    // Should have errors from ETA 9089 validator
    const etaErrors = result.errors.filter((e) => e.ruleId.startsWith('V-ETA'));
    expect(etaErrors.length).toBeGreaterThan(0);
  });

  it('should aggregate errors from RFI and RFE validators', () => {
    const caseData: ValidationCaseData = {
      // PWD dates
      pwd_filing_date: null,
      pwd_determination_date: null,
      pwd_expiration_date: null,
      // Recruitment dates
      sunday_ad_first_date: null,
      sunday_ad_second_date: null,
      job_order_start_date: null,
      job_order_end_date: null,
      notice_of_filing_start_date: null,
      notice_of_filing_end_date: null,
      recruitment_start_date: null,
      recruitment_end_date: null,
      is_professional_occupation: false,
      // ETA 9089 dates
      eta9089_filing_date: '2026-04-01',
      eta9089_certification_date: null,
      eta9089_expiration_date: null,
      // I-140 dates
      i140_filing_date: '2026-05-01',
      i140_approval_date: null,
      // RFI dates - Invalid: received before ETA filing
      rfi_received_date: '2026-03-01',
      rfi_due_date: '2026-03-31',
      rfi_submitted_date: null,
      // RFE dates - Invalid: received before I-140 filing
      rfe_received_date: '2026-04-15',
      rfe_due_date: '2026-05-15',
      rfe_submitted_date: null,
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(false);

    // Should have error from RFI validator
    const rfiErrors = result.errors.filter((e) => e.ruleId.startsWith('V-RFI'));
    expect(rfiErrors.length).toBeGreaterThan(0);

    // Should have error from RFE validator
    const rfeErrors = result.errors.filter((e) => e.ruleId.startsWith('V-RFE'));
    expect(rfeErrors.length).toBeGreaterThan(0);
  });

  it('should aggregate warnings from multiple validators', () => {
    const caseData: ValidationCaseData = {
      // PWD dates
      pwd_filing_date: null,
      pwd_determination_date: null,
      pwd_expiration_date: null,
      // Recruitment dates
      sunday_ad_first_date: null,
      sunday_ad_second_date: null,
      job_order_start_date: null,
      job_order_end_date: null,
      notice_of_filing_start_date: null,
      notice_of_filing_end_date: null,
      recruitment_start_date: null,
      recruitment_end_date: null,
      is_professional_occupation: false,
      // ETA 9089 dates
      eta9089_filing_date: '2026-04-01',
      eta9089_certification_date: null,
      eta9089_expiration_date: null,
      // I-140 dates
      i140_filing_date: '2026-05-01',
      i140_approval_date: null,
      // RFI dates - Warning: submitted late
      rfi_received_date: '2026-04-15',
      rfi_due_date: '2026-05-15',
      rfi_submitted_date: '2026-05-20', // After due date
      // RFE dates - Warning: submitted late
      rfe_received_date: '2026-05-10',
      rfe_due_date: '2026-06-10',
      rfe_submitted_date: '2026-06-15', // After due date
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(true); // Valid because warnings don't make it invalid

    // Should have warning from RFI validator
    const rfiWarnings = result.warnings.filter((w) =>
      w.ruleId.startsWith('V-RFI')
    );
    expect(rfiWarnings.length).toBeGreaterThan(0);

    // Should have warning from RFE validator
    const rfeWarnings = result.warnings.filter((w) =>
      w.ruleId.startsWith('V-RFE')
    );
    expect(rfeWarnings.length).toBeGreaterThan(0);
  });

  it('should handle partial case data', () => {
    const caseData: ValidationCaseData = {
      // Only PWD and some recruitment dates
      pwd_filing_date: '2026-01-01',
      pwd_determination_date: '2026-01-15',
      pwd_expiration_date: '2027-06-30',
      // Partial recruitment dates
      sunday_ad_first_date: '2026-02-01',
      sunday_ad_second_date: null,
      job_order_start_date: null,
      job_order_end_date: null,
      notice_of_filing_start_date: null,
      notice_of_filing_end_date: null,
      recruitment_start_date: null,
      recruitment_end_date: null,
      is_professional_occupation: false,
      // No ETA, I-140, RFI, RFE dates
      eta9089_filing_date: null,
      eta9089_certification_date: null,
      eta9089_expiration_date: null,
      i140_filing_date: null,
      i140_approval_date: null,
      rfi_received_date: null,
      rfi_due_date: null,
      rfi_submitted_date: null,
      rfe_received_date: null,
      rfe_due_date: null,
      rfe_submitted_date: null,
    };

    const result: ValidationResult = validateCase(caseData);

    // Should validate PWD (valid) and skip others
    expect(result.valid).toBe(true);
  });

  it('should validate that all validator modules are integrated', () => {
    const caseData: ValidationCaseData = {
      // PWD - valid
      pwd_filing_date: '2026-01-01',
      pwd_determination_date: '2026-01-15',
      pwd_expiration_date: '2027-06-30',
      // Recruitment - valid
      sunday_ad_first_date: '2026-02-01',
      sunday_ad_second_date: '2026-02-08',
      job_order_start_date: '2026-02-01',
      job_order_end_date: '2026-03-15',
      notice_of_filing_start_date: '2026-02-01',
      notice_of_filing_end_date: '2026-02-16', // 10+ business days
      recruitment_start_date: '2026-02-01',
      recruitment_end_date: '2026-03-15',
      is_professional_occupation: false,
      // ETA 9089 - valid
      eta9089_filing_date: '2026-04-20',
      eta9089_certification_date: '2026-08-01',
      eta9089_expiration_date: '2027-01-28',
      // I-140 - valid
      i140_filing_date: '2026-08-15',
      i140_approval_date: '2026-10-01',
      // RFI - valid
      rfi_received_date: '2026-05-15',
      rfi_due_date: '2026-06-14',
      rfi_submitted_date: '2026-06-10',
      // RFE - valid
      rfe_received_date: '2026-09-01',
      rfe_due_date: '2026-10-15',
      rfe_submitted_date: '2026-10-10',
    };

    const result: ValidationResult = validateCase(caseData);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Might have some warnings (e.g., expiration dates)
  });
});
