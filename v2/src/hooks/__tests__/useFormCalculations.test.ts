/**
 * useFormCalculations Hook Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormCalculations } from '../useFormCalculations';
import type { CaseFormData } from '../../lib/forms';

// ============================================================================
// Test Data Factory
// ============================================================================

function createFormData(overrides: Partial<CaseFormData> = {}): CaseFormData {
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
    // RFI/RFE are now array entries, handled within their respective components
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
// Hook Tests
// ============================================================================

describe('useFormCalculations', () => {
  let setFormData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setFormData = vi.fn();
  });

  // ============================================================================
  // PWD EXPIRATION CALCULATION
  // ============================================================================

  describe('PWD Expiration Calculation', () => {
    it('calculates PWD expiration when determination date changes (Apr 2 - Jun 30 = +90 days)', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-05-15', // May 15 = +90 days = Aug 13
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      // Trigger calculation
      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          pwdExpirationDate: '2024-08-13',
        })
      );
    });

    it('calculates PWD expiration (Jul 1 - Dec 31 = Jun 30 next year)', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-09-10', // Sep 10 = Jun 30 2025
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          pwdExpirationDate: '2025-06-30',
        })
      );
    });

    it('calculates PWD expiration (Jan 1 - Apr 1 = Jun 30 same year)', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-02-05', // Feb 5 = Jun 30 2024
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          pwdExpirationDate: '2024-06-30',
        })
      );
    });

    it('marks pwdExpirationDate as auto-calculated', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-05-15',
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      expect(result.current.autoCalculatedFields.has('pwdExpirationDate')).toBe(true);
    });
  });

  // ============================================================================
  // NOTICE OF FILING END CALCULATION
  // ============================================================================

  describe('Notice of Filing End Calculation', () => {
    it('calculates notice of filing end (+10 business days)', () => {
      const formData = createFormData({
        noticeOfFilingStartDate: '2024-01-15', // Monday
        // 10 business days = Jan 29 (Mon), skipping weekends
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('noticeOfFilingStartDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          noticeOfFilingEndDate: '2024-01-29',
        })
      );
    });

    it('marks noticeOfFilingEndDate as auto-calculated', () => {
      const formData = createFormData({
        noticeOfFilingStartDate: '2024-01-15',
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('noticeOfFilingStartDate');
      });

      expect(result.current.autoCalculatedFields.has('noticeOfFilingEndDate')).toBe(true);
    });
  });

  // ============================================================================
  // JOB ORDER END CALCULATION
  // ============================================================================

  describe('Job Order End Calculation', () => {
    it('suggests job order end (+30 days)', () => {
      const formData = createFormData({
        jobOrderStartDate: '2024-01-15', // + 30 days = Feb 14
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('jobOrderStartDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOrderEndDate: '2024-02-14',
        })
      );
    });
  });

  // ============================================================================
  // ETA 9089 EXPIRATION CALCULATION
  // ============================================================================

  describe('ETA 9089 Expiration Calculation', () => {
    it('calculates ETA 9089 expiration (+180 days from certification)', () => {
      const formData = createFormData({
        eta9089CertificationDate: '2024-03-15', // + 180 days = Sep 11
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('eta9089CertificationDate');
      });

      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          eta9089ExpirationDate: '2024-09-11',
        })
      );
    });
  });

  // ============================================================================
  // RFI DUE DATE CALCULATION
  // ============================================================================
  // NOTE: RFI due date (+30 days) is now calculated within RFIEntry component,
  // not at the form level. Tests for this behavior are in RFIEntry.test.tsx.

  // ============================================================================
  // MANUAL OVERRIDE BEHAVIOR
  // ============================================================================

  describe('Manual Override Behavior', () => {
    it('does not recalculate if field was manually set', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-05-15',
        pwdExpirationDate: '2024-09-01', // Manually set different value
      });

      const { result, rerender } = renderHook(
        ({ data }) => useFormCalculations(data, setFormData),
        { initialProps: { data: formData } }
      );

      // Mark as manually set
      act(() => {
        result.current.markAsManual('pwdExpirationDate');
      });

      // Update formData
      const newFormData = {
        ...formData,
        pwdDeterminationDate: '2024-06-01',
      };
      rerender({ data: newFormData });

      // Trigger recalculation
      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      // Should NOT have called setFormData with new expiration
      expect(setFormData).not.toHaveBeenCalledWith(
        expect.objectContaining({
          pwdExpirationDate: expect.any(String),
        })
      );
    });

    it('tracks which fields are auto vs manual', () => {
      const formData = createFormData({
        pwdDeterminationDate: '2024-05-15',
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      // Initially empty
      expect(result.current.autoCalculatedFields.size).toBe(0);

      // Trigger calculation
      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      // Now has auto-calculated field
      expect(result.current.autoCalculatedFields.has('pwdExpirationDate')).toBe(true);

      // Mark as manual
      act(() => {
        result.current.markAsManual('pwdExpirationDate');
      });

      // No longer auto
      expect(result.current.autoCalculatedFields.has('pwdExpirationDate')).toBe(false);
    });
  });

  // ============================================================================
  // CASCADE BEHAVIOR
  // ============================================================================

  describe('Cascade Behavior', () => {
    it('clears pwdExpirationDate when pwdDeterminationDate is cleared (persists as empty string)', () => {
      const formData = createFormData({
        pwdDeterminationDate: undefined,
        pwdExpirationDate: '2024-08-13', // Had a value before
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('pwdDeterminationDate');
      });

      // Cleared values must be "" (not undefined) so they persist through Convex save.
      // Convex strips undefined from mutation args → ?? fallback restores old DB value.
      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          pwdExpirationDate: '',
        })
      );
    });

    it('recursively clears entire chain: pwdFilingDate → pwdDeterminationDate → pwdExpirationDate', () => {
      const formData = createFormData({
        pwdFilingDate: undefined, // cleared
        pwdDeterminationDate: '2024-05-15',
        pwdExpirationDate: '2024-08-13',
      });

      const { result } = renderHook(() =>
        useFormCalculations(formData, setFormData)
      );

      act(() => {
        result.current.triggerCalculation('pwdFilingDate');
      });

      // Both dependent fields in the chain should be cleared as ""
      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          pwdDeterminationDate: '',
          pwdExpirationDate: '',
        })
      );
    });
  });
});
