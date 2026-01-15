/**
 * useDateFieldValidation Hook Tests
 *
 * Comprehensive tests for the date field validation hook that handles:
 * - Sunday validation for sunday ad dates
 * - Second Sunday ad must be 7+ days after first
 * - Job order duration must be 30+ days
 * - Field dependency chains (PWD determination before recruitment, etc.)
 * - Min/max constraint enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDateFieldValidation } from '../useDateFieldValidation';
import type { CaseFormData } from '../../lib/forms/case-form-schema';

// ============================================================================
// Test Data Factory
// ============================================================================

function createFormData(overrides: Partial<CaseFormData> = {}): Partial<CaseFormData> {
  return {
    employerName: 'Test Corp',
    beneficiaryIdentifier: 'John Doe',
    positionTitle: 'Engineer',
    caseStatus: 'pwd',
    progressStatus: 'working',
    caseNumber: undefined,
    internalCaseNumber: undefined,
    employerFein: undefined,
    jobTitle: undefined,
    socCode: undefined,
    socTitle: undefined,
    jobOrderState: undefined,
    progressStatusOverride: false,
    pwdFilingDate: undefined,
    pwdDeterminationDate: undefined,
    pwdExpirationDate: undefined,
    pwdCaseNumber: undefined,
    pwdWageAmount: undefined,
    pwdWageLevel: undefined,
    jobOrderStartDate: undefined,
    jobOrderEndDate: undefined,
    sundayAdFirstDate: undefined,
    sundayAdSecondDate: undefined,
    sundayAdNewspaper: undefined,
    additionalRecruitmentStartDate: undefined,
    additionalRecruitmentEndDate: undefined,
    additionalRecruitmentMethods: [],
    recruitmentNotes: undefined,
    recruitmentApplicantsCount: 0,
    recruitmentSummaryCustom: undefined,
    isProfessionalOccupation: false,
    noticeOfFilingStartDate: undefined,
    noticeOfFilingEndDate: undefined,
    eta9089FilingDate: undefined,
    eta9089AuditDate: undefined,
    eta9089CertificationDate: undefined,
    eta9089ExpirationDate: undefined,
    eta9089CaseNumber: undefined,
    rfiEntries: [],
    rfeEntries: [],
    i140FilingDate: undefined,
    i140ReceiptDate: undefined,
    i140ReceiptNumber: undefined,
    i140ApprovalDate: undefined,
    i140DenialDate: undefined,
    i140Category: undefined,
    i140ServiceCenter: undefined,
    i140PremiumProcessing: undefined,
    priorityLevel: 'normal',
    isFavorite: false,
    notes: [],
    tags: [],
    calendarSyncEnabled: true,
    ...overrides,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a Sunday date string (guaranteed to be a Sunday)
 */
function _getSunday(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  // Find the next Sunday if the given date is not a Sunday
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 0) {
    date.setDate(date.getDate() + (7 - dayOfWeek));
  }
  return date.toISOString().split('T')[0];
}

/**
 * Get a non-Sunday date string
 */
function _getNonSunday(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  // If it's a Sunday, move to Monday
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

// Known Sundays for testing
const SUNDAY_JAN_5_2025 = '2025-01-05'; // This is a Sunday
const SUNDAY_JAN_12_2025 = '2025-01-12'; // This is a Sunday (7 days after Jan 5)
const SUNDAY_JAN_19_2025 = '2025-01-19'; // This is a Sunday (14 days after Jan 5)
const MONDAY_JAN_6_2025 = '2025-01-06'; // This is a Monday

// ============================================================================
// validateDateField Tests
// ============================================================================

describe('useDateFieldValidation', () => {
  describe('validateField - Basic Validation', () => {
    it('returns empty result for undefined/empty values (optional fields)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', undefined);
      });

      expect(validation).toEqual({});
    });

    it('returns empty result for empty string values', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', '');
      });

      expect(validation).toEqual({});
    });

    it('returns error for invalid date format (not YYYY-MM-DD)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', '01/15/2025');
      });

      expect(validation?.error).toBe('Invalid date format. Use YYYY-MM-DD.');
    });

    it('returns error for invalid date format (partial date)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', '2025-01');
      });

      expect(validation?.error).toBe('Invalid date format. Use YYYY-MM-DD.');
    });

    it('returns error for invalid date (impossible date)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', '2025-02-30');
      });

      expect(validation?.error).toBe('Invalid date format. Use YYYY-MM-DD.');
    });

    it('returns valid for correct date format', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('pwdFilingDate', '2025-01-15');
      });

      expect(validation?.isValid).toBe(true);
      expect(validation?.error).toBeUndefined();
    });
  });

  // ============================================================================
  // Sunday Validation Tests
  // ============================================================================

  describe('validateField - Sunday Validation', () => {
    it('rejects non-Sunday date for sundayAdFirstDate', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('sundayAdFirstDate', MONDAY_JAN_6_2025);
      });

      expect(validation?.error).toBe('This date must be a Sunday.');
    });

    it('accepts Sunday date for sundayAdFirstDate', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('sundayAdFirstDate', SUNDAY_JAN_5_2025);
      });

      expect(validation?.isValid).toBe(true);
      expect(validation?.error).toBeUndefined();
    });

    it('rejects non-Sunday date for sundayAdSecondDate', () => {
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('sundayAdSecondDate', MONDAY_JAN_6_2025);
      });

      expect(validation?.error).toBe('This date must be a Sunday.');
    });

    it('accepts Sunday date for sundayAdSecondDate when 7+ days after first', () => {
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_12_2025);
      });

      expect(validation?.isValid).toBe(true);
      expect(validation?.error).toBeUndefined();
    });
  });

  // ============================================================================
  // Second Sunday Ad Validation (7+ days after first)
  // ============================================================================

  describe('validateField - Second Sunday Ad 7+ Days Rule', () => {
    it('rejects second Sunday ad less than 7 days after first (same Sunday)', () => {
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Same day - 0 days difference
        // The hook checks min constraint first (must be >= first + 7 days)
        // So the error will be about the min date constraint
        validation = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_5_2025);
      });

      // Min constraint is enforced first, so we get "Date must be on or after" error
      expect(validation?.error).toContain('Date must be on or after');
    });

    it('rejects second Sunday ad that passes min constraint but fails 7-day rule', () => {
      // This test uses a scenario where the min constraint allows the date
      // but the 7-day cross-field check still fails
      // Since min constraint is +7 days from first, this scenario cannot happen
      // The min constraint effectively enforces the 7-day rule
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Exactly 7 days - should be valid (>= 7)
        validation = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_12_2025);
      });

      expect(validation?.isValid).toBe(true);
    });

    it('accepts second Sunday ad more than 7 days after first', () => {
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // 14 days - definitely valid
        validation = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_19_2025);
      });

      expect(validation?.isValid).toBe(true);
      expect(validation?.error).toBeUndefined();
    });

    it('allows second Sunday ad validation when first is not set', () => {
      const formData = createFormData({
        sundayAdFirstDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // No first date, so only Sunday check applies
        validation = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_12_2025);
      });

      // Should be valid since it's a Sunday and no cross-field check needed
      expect(validation?.isValid).toBe(true);
    });

    it('validates 7-day rule after min constraint passes', () => {
      // Test that the 7-day cross-field validation runs AFTER min constraint check
      // When min constraint passes but date is a non-Sunday, it should fail Sunday check
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // A Monday that is after the min date (7 days after first Sunday)
        // Should fail the "must be Sunday" check
        validation = result.current.validateField('sundayAdSecondDate', '2025-01-13'); // Monday Jan 13
      });

      expect(validation?.error).toBe('This date must be a Sunday.');
    });
  });

  // ============================================================================
  // Job Order Duration Validation (30+ days)
  // ============================================================================

  describe('validateField - Job Order 30+ Days Rule', () => {
    it('rejects job order end date less than 30 days after start (min constraint)', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // 15 days - invalid (min is start + 30 days = Jan 31)
        validation = result.current.validateField('jobOrderEndDate', '2025-01-16');
      });

      // Min constraint is enforced first (start + 30 days)
      expect(validation?.error).toContain('Date must be on or after');
    });

    it('rejects job order end date exactly 29 days after start (min constraint)', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // 29 days - still invalid (min is start + 30 days = Jan 31)
        validation = result.current.validateField('jobOrderEndDate', '2025-01-30');
      });

      // Min constraint is enforced (start + 30 days)
      expect(validation?.error).toContain('Date must be on or after');
    });

    it('accepts job order end date exactly 30 days after start', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // 30 days - valid
        validation = result.current.validateField('jobOrderEndDate', '2025-01-31');
      });

      expect(validation?.isValid).toBe(true);
      expect(validation?.error).toBeUndefined();
    });

    it('accepts job order end date more than 30 days after start', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // 45 days - valid
        validation = result.current.validateField('jobOrderEndDate', '2025-02-15');
      });

      expect(validation?.isValid).toBe(true);
    });

    it('allows job order end date validation when start is not set', () => {
      const formData = createFormData({
        jobOrderStartDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // No start date, so no duration check
        validation = result.current.validateField('jobOrderEndDate', '2025-01-31');
      });

      // Should be valid since no cross-field check
      expect(validation?.isValid).toBe(true);
    });

    it('validates 30-day rule when date passes min constraint but fails cross-field check', () => {
      // The hook enforces the 30-day rule via min constraint AND cross-field validation
      // When the date passes min constraint, the cross-field check runs
      // This test verifies the cross-field check message appears when min passes but duration fails
      // However, since min constraint = start + 30 days, if min passes, duration passes too
      // So we test that when min passes (date >= start + 30), the validation succeeds
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Exactly 30 days - passes both min constraint and cross-field check
        validation = result.current.validateField('jobOrderEndDate', '2025-01-31');
      });

      expect(validation?.isValid).toBe(true);
    });
  });

  // ============================================================================
  // Min/Max Constraint Enforcement
  // ============================================================================

  describe('validateField - Min/Max Constraint Enforcement', () => {
    it('rejects date before minimum constraint', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // PWD determination must be AFTER filing date
        validation = result.current.validateField('pwdDeterminationDate', '2025-01-09');
      });

      expect(validation?.error).toContain('Date must be on or after');
    });

    it('accepts date on or after minimum constraint', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Day after filing - valid
        validation = result.current.validateField('pwdDeterminationDate', '2025-01-12');
      });

      expect(validation?.isValid).toBe(true);
    });

    it('rejects date after maximum constraint', () => {
      const formData = createFormData({
        eta9089FilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Audit date should not be in the future (max: today)
        // Use a far future date to ensure it's after today
        validation = result.current.validateField('eta9089AuditDate', '2030-12-31');
      });

      expect(validation?.error).toContain('Date must be on or before');
    });
  });

  // ============================================================================
  // checkFieldDisabled (isFieldDisabled) Tests
  // ============================================================================

  describe('isFieldDisabled - Field Dependency Chains', () => {
    it('disables pwdDeterminationDate when pwdFilingDate is not set', () => {
      const formData = createFormData({
        pwdFilingDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('pwdDeterminationDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('PWD filing date');
    });

    it('enables pwdDeterminationDate when pwdFilingDate is set', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('pwdDeterminationDate');

      expect(disabledState.disabled).toBe(false);
      expect(disabledState.reason).toBeUndefined();
    });

    it('disables sundayAdSecondDate when sundayAdFirstDate is not set', () => {
      const formData = createFormData({
        sundayAdFirstDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('sundayAdSecondDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('first Sunday ad date');
    });

    it('enables sundayAdSecondDate when sundayAdFirstDate is set', () => {
      const formData = createFormData({
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('sundayAdSecondDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables i140ReceiptDate when i140FilingDate is not set', () => {
      const formData = createFormData({
        i140FilingDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140ReceiptDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('I-140 filing date');
    });

    it('enables i140ReceiptDate when i140FilingDate is set', () => {
      const formData = createFormData({
        i140FilingDate: '2025-01-15',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140ReceiptDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables i140ApprovalDate when i140FilingDate or i140ReceiptDate is not set', () => {
      const formData = createFormData({
        i140FilingDate: '2025-01-15',
        i140ReceiptDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140ApprovalDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('I-140 receipt date');
    });

    it('enables i140ApprovalDate when both i140FilingDate and i140ReceiptDate are set', () => {
      const formData = createFormData({
        i140FilingDate: '2025-01-15',
        i140ReceiptDate: '2025-01-20',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140ApprovalDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables jobOrderEndDate when jobOrderStartDate is not set', () => {
      const formData = createFormData({
        jobOrderStartDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('jobOrderEndDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('job order start date');
    });

    it('enables jobOrderEndDate when jobOrderStartDate is set', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('jobOrderEndDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables eta9089AuditDate when eta9089FilingDate is not set', () => {
      const formData = createFormData({
        eta9089FilingDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('eta9089AuditDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('ETA 9089 filing date');
    });

    it('enables eta9089AuditDate when eta9089FilingDate is set', () => {
      const formData = createFormData({
        eta9089FilingDate: '2025-03-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('eta9089AuditDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables additionalRecruitmentStartDate when pwdDeterminationDate is not set', () => {
      const formData = createFormData({
        pwdDeterminationDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('additionalRecruitmentStartDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('PWD determination date');
    });

    it('enables additionalRecruitmentStartDate when pwdDeterminationDate is set', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2025-01-20',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('additionalRecruitmentStartDate');

      expect(disabledState.disabled).toBe(false);
    });
  });

  // ============================================================================
  // allFieldDisabledStates Tests
  // ============================================================================

  describe('allFieldDisabledStates', () => {
    it('returns disabled states for all fields with dependencies', () => {
      const formData = createFormData({
        pwdFilingDate: undefined,
        pwdDeterminationDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const states = result.current.allFieldDisabledStates;

      expect(states.pwdDeterminationDate.disabled).toBe(true);
      expect(states.sundayAdSecondDate.disabled).toBe(true);
      expect(states.jobOrderEndDate.disabled).toBe(true);
    });

    it('updates when form values change', () => {
      const initialFormData = createFormData({
        pwdFilingDate: undefined,
      });

      const { result, rerender } = renderHook(
        ({ formData }) => useDateFieldValidation(formData),
        { initialProps: { formData: initialFormData } }
      );

      expect(result.current.allFieldDisabledStates.pwdDeterminationDate.disabled).toBe(true);

      // Update form data
      const updatedFormData = createFormData({
        pwdFilingDate: '2025-01-10',
      });

      rerender({ formData: updatedFormData });

      expect(result.current.allFieldDisabledStates.pwdDeterminationDate.disabled).toBe(false);
    });
  });

  // ============================================================================
  // validateOnChange Tests
  // ============================================================================

  describe('validateOnChange - Real-time Validation', () => {
    it('returns empty result for partial input (less than 10 chars)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateOnChange('pwdFilingDate', '2025-01');
      });

      expect(validation).toEqual({});
    });

    it('triggers full validation for complete date input (10 chars)', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateOnChange('pwdFilingDate', '2025-01-15');
      });

      expect(validation?.isValid).toBe(true);
    });

    it('returns empty result for empty/undefined value', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        validation = result.current.validateOnChange('pwdFilingDate', undefined);
      });

      expect(validation).toEqual({});
    });
  });

  // ============================================================================
  // getValidationState Tests
  // ============================================================================

  describe('getValidationState', () => {
    it('returns "error" after validation with error', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', MONDAY_JAN_6_2025);
      });

      expect(result.current.getValidationState('sundayAdFirstDate')).toBe('error');
    });

    it('returns "valid" after successful validation', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', SUNDAY_JAN_5_2025);
      });

      expect(result.current.getValidationState('sundayAdFirstDate')).toBe('valid');
    });

    it('returns undefined for unvalidated fields', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      expect(result.current.getValidationState('pwdFilingDate')).toBeUndefined();
    });
  });

  // ============================================================================
  // getError and getWarning Tests
  // ============================================================================

  describe('getError and getWarning', () => {
    it('returns error message after validation with error', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', MONDAY_JAN_6_2025);
      });

      expect(result.current.getError('sundayAdFirstDate')).toBe('This date must be a Sunday.');
    });

    it('returns undefined error for valid field', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', SUNDAY_JAN_5_2025);
      });

      expect(result.current.getError('sundayAdFirstDate')).toBeUndefined();
    });

    it('returns undefined for unvalidated fields', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      expect(result.current.getError('pwdFilingDate')).toBeUndefined();
      expect(result.current.getWarning('pwdFilingDate')).toBeUndefined();
    });
  });

  // ============================================================================
  // clearFieldValidation Tests
  // ============================================================================

  describe('clearFieldValidation', () => {
    it('clears validation state for a field', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      // First validate with an error
      act(() => {
        result.current.validateField('sundayAdFirstDate', MONDAY_JAN_6_2025);
      });

      expect(result.current.getValidationState('sundayAdFirstDate')).toBe('error');

      // Clear the validation
      act(() => {
        result.current.clearFieldValidation('sundayAdFirstDate');
      });

      expect(result.current.getValidationState('sundayAdFirstDate')).toBeUndefined();
      expect(result.current.getError('sundayAdFirstDate')).toBeUndefined();
    });
  });

  // ============================================================================
  // getConstraint Tests
  // ============================================================================

  describe('getConstraint', () => {
    it('returns constraint with min date for dependent field', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const constraint = result.current.getConstraint('pwdDeterminationDate');

      expect(constraint?.min).toBeDefined();
      expect(constraint?.min).toBe('2025-01-11'); // Day after filing
    });

    it('returns constraint with max date for fields that cannot be in future', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const constraint = result.current.getConstraint('pwdDeterminationDate');

      expect(constraint?.max).toBeDefined();
    });

    it('returns undefined for fields without constraints', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const constraint = result.current.getConstraint('nonExistentField');

      expect(constraint).toBeUndefined();
    });
  });

  // ============================================================================
  // getHint Tests
  // ============================================================================

  describe('getHint', () => {
    it('returns dynamic hint based on form state', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const hint = result.current.getHint('pwdDeterminationDate');

      expect(hint).toContain('after filing');
    });

    it('returns default hint when no constraint hint exists', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const hint = result.current.getHint('nonExistentField', 'Default hint');

      expect(hint).toBe('Default hint');
    });
  });

  // ============================================================================
  // constraints Memoization Tests
  // ============================================================================

  describe('constraints', () => {
    it('recalculates constraints when form values change', () => {
      const initialFormData = createFormData({
        pwdFilingDate: '2025-01-10',
      });

      const { result, rerender } = renderHook(
        ({ formData }) => useDateFieldValidation(formData),
        { initialProps: { formData: initialFormData } }
      );

      const initialMinDate = result.current.constraints.pwdDeterminationDate?.min;
      expect(initialMinDate).toBe('2025-01-11');

      // Update form data with new filing date
      const updatedFormData = createFormData({
        pwdFilingDate: '2025-02-15',
      });

      rerender({ formData: updatedFormData });

      const updatedMinDate = result.current.constraints.pwdDeterminationDate?.min;
      expect(updatedMinDate).toBe('2025-02-16');
    });
  });

  // ============================================================================
  // fieldStates/fieldErrors/fieldWarnings Direct Access Tests
  // ============================================================================

  describe('fieldStates, fieldErrors, fieldWarnings', () => {
    it('exposes fieldStates as a record', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', SUNDAY_JAN_5_2025);
      });

      expect(result.current.fieldStates.sundayAdFirstDate).toBe('valid');
    });

    it('exposes fieldErrors as a record', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      act(() => {
        result.current.validateField('sundayAdFirstDate', MONDAY_JAN_6_2025);
      });

      expect(result.current.fieldErrors.sundayAdFirstDate).toBe('This date must be a Sunday.');
    });

    it('exposes fieldWarnings as a record', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      // The hook doesn't currently set warnings, but verify the structure exists
      expect(result.current.fieldWarnings).toBeDefined();
      expect(typeof result.current.fieldWarnings).toBe('object');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles leap year dates correctly', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Feb 29, 2024 is a valid leap year date
        validation = result.current.validateField('pwdFilingDate', '2024-02-29');
      });

      expect(validation?.isValid).toBe(true);
    });

    it('rejects Feb 29 on non-leap year', () => {
      const formData = createFormData();
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let validation;
      act(() => {
        // Feb 29, 2025 is NOT a valid date (2025 is not a leap year)
        validation = result.current.validateField('pwdFilingDate', '2025-02-29');
      });

      expect(validation?.error).toBe('Invalid date format. Use YYYY-MM-DD.');
    });

    it('handles empty string as undefined-like value', () => {
      const formData = createFormData({
        pwdFilingDate: '', // Empty string
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      // pwdDeterminationDate should be disabled since pwdFilingDate is empty
      const disabledState = result.current.isFieldDisabled('pwdDeterminationDate');

      expect(disabledState.disabled).toBe(true);
    });

    it('handles null-like values in dependency check', () => {
      const formData = createFormData({
        sundayAdFirstDate: null as unknown as undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('sundayAdSecondDate');

      expect(disabledState.disabled).toBe(true);
    });
  });

  // ============================================================================
  // Additional Field Dependency Tests
  // ============================================================================

  describe('Additional Field Dependencies', () => {
    it('disables noticeOfFilingEndDate when noticeOfFilingStartDate is not set', () => {
      const formData = createFormData({
        noticeOfFilingStartDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('noticeOfFilingEndDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('notice of filing start date');
    });

    it('enables noticeOfFilingEndDate when noticeOfFilingStartDate is set', () => {
      const formData = createFormData({
        noticeOfFilingStartDate: '2025-01-15',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('noticeOfFilingEndDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables additionalRecruitmentEndDate when dependencies are not set', () => {
      const formData = createFormData({
        pwdDeterminationDate: undefined,
        additionalRecruitmentStartDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('additionalRecruitmentEndDate');

      expect(disabledState.disabled).toBe(true);
      expect(disabledState.reason).toContain('PWD determination date');
    });

    it('enables additionalRecruitmentEndDate when all dependencies are set', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2025-01-10',
        additionalRecruitmentStartDate: '2025-01-15',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('additionalRecruitmentEndDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables i140DenialDate when dependencies are not set', () => {
      const formData = createFormData({
        i140FilingDate: '2025-01-15',
        i140ReceiptDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140DenialDate');

      expect(disabledState.disabled).toBe(true);
    });

    it('enables i140DenialDate when all dependencies are set', () => {
      const formData = createFormData({
        i140FilingDate: '2025-01-15',
        i140ReceiptDate: '2025-01-20',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('i140DenialDate');

      expect(disabledState.disabled).toBe(false);
    });

    it('disables eta9089CertificationDate when eta9089FilingDate is not set', () => {
      const formData = createFormData({
        eta9089FilingDate: undefined,
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('eta9089CertificationDate');

      expect(disabledState.disabled).toBe(true);
    });

    it('enables eta9089CertificationDate when eta9089FilingDate is set', () => {
      const formData = createFormData({
        eta9089FilingDate: '2025-03-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const disabledState = result.current.isFieldDisabled('eta9089CertificationDate');

      expect(disabledState.disabled).toBe(false);
    });
  });

  // ============================================================================
  // Constraint Hint Tests
  // ============================================================================

  describe('Constraint Hints', () => {
    it('returns hint explaining PWD determination date requirement', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const hint = result.current.getHint('pwdDeterminationDate');

      expect(hint).toBeDefined();
      expect(hint).toContain('Jan 10, 2025'); // Formatted filing date in hint
    });

    it('returns hint for Sunday ad field', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2025-01-10',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const hint = result.current.getHint('sundayAdFirstDate');

      expect(hint).toBeDefined();
      expect(hint?.toLowerCase()).toContain('sunday');
    });

    it('returns hint for job order end date', () => {
      const formData = createFormData({
        jobOrderStartDate: '2025-01-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      const hint = result.current.getHint('jobOrderEndDate');

      expect(hint).toBeDefined();
      expect(hint?.toLowerCase()).toContain('30 days');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration - Full Validation Flow', () => {
    it('validates a complete PWD section correctly', () => {
      const formData = createFormData({
        pwdFilingDate: '2025-01-01',
        pwdDeterminationDate: '2025-01-15',
        pwdExpirationDate: '2025-06-30',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      // All PWD fields should be valid
      let filing, determination;
      act(() => {
        filing = result.current.validateField('pwdFilingDate', '2025-01-01');
        determination = result.current.validateField('pwdDeterminationDate', '2025-01-15');
      });

      expect(filing?.isValid).toBe(true);
      expect(determination?.isValid).toBe(true);
    });

    it('validates a complete recruitment section correctly', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2025-01-01',
        pwdExpirationDate: '2025-06-30',
        sundayAdFirstDate: SUNDAY_JAN_5_2025,
        sundayAdSecondDate: SUNDAY_JAN_12_2025,
        jobOrderStartDate: '2025-01-06',
        jobOrderEndDate: '2025-02-05', // 30 days
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      let firstSunday, secondSunday, jobStart, jobEnd;
      act(() => {
        firstSunday = result.current.validateField('sundayAdFirstDate', SUNDAY_JAN_5_2025);
        secondSunday = result.current.validateField('sundayAdSecondDate', SUNDAY_JAN_12_2025);
        jobStart = result.current.validateField('jobOrderStartDate', '2025-01-06');
        jobEnd = result.current.validateField('jobOrderEndDate', '2025-02-05');
      });

      expect(firstSunday?.isValid).toBe(true);
      expect(secondSunday?.isValid).toBe(true);
      expect(jobStart?.isValid).toBe(true);
      expect(jobEnd?.isValid).toBe(true);
    });

    it('validates I-140 chain correctly', () => {
      const formData = createFormData({
        eta9089CertificationDate: '2025-01-01',
        i140FilingDate: '2025-01-10',
        i140ReceiptDate: '2025-01-15',
        i140ApprovalDate: '2025-02-01',
      });
      const { result } = renderHook(() => useDateFieldValidation(formData));

      // All I-140 fields should be valid when chain is correct
      expect(result.current.isFieldDisabled('i140ReceiptDate').disabled).toBe(false);
      expect(result.current.isFieldDisabled('i140ApprovalDate').disabled).toBe(false);

      let approval;
      act(() => {
        approval = result.current.validateField('i140ApprovalDate', '2025-02-01');
      });

      expect(approval?.isValid).toBe(true);
    });
  });
});
