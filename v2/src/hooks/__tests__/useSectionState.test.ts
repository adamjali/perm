import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSectionState } from '../useSectionState';
import type { CaseFormData } from '../../lib/forms';
import type { ISODateString } from '../../lib/perm';

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
    isProfessionalOccupation: false,
    additionalRecruitmentMethods: [],
    // Default all dates to undefined
    pwdFilingDate: undefined,
    pwdDeterminationDate: undefined,
    pwdExpirationDate: undefined,
    jobOrderStartDate: undefined,
    jobOrderEndDate: undefined,
    sundayAdFirstDate: undefined,
    sundayAdSecondDate: undefined,
    noticeOfFilingStartDate: undefined,
    noticeOfFilingEndDate: undefined,
    additionalRecruitmentStartDate: undefined,
    additionalRecruitmentEndDate: undefined,
    eta9089FilingDate: undefined,
    eta9089CertificationDate: undefined,
    eta9089ExpirationDate: undefined,
    i140FilingDate: undefined,
    ...overrides,
  };
}

/**
 * Create form data with complete basic recruitment
 */
function createCompleteBasicRecruitment(
  overrides: Partial<CaseFormData> = {}
): Partial<CaseFormData> {
  return createFormData({
    pwdDeterminationDate: '2024-01-01',
    pwdExpirationDate: '2024-06-30',
    // Basic recruitment: 3 methods, 6 dates
    sundayAdFirstDate: '2024-01-14', // Sunday
    sundayAdSecondDate: '2024-01-21', // Sunday
    jobOrderStartDate: '2024-01-15',
    jobOrderEndDate: '2024-02-15',
    noticeOfFilingStartDate: '2024-01-15',
    noticeOfFilingEndDate: '2024-01-29',
    ...overrides,
  });
}

/**
 * Create form data with complete professional recruitment (3 additional methods)
 */
function createCompleteProfessionalRecruitment(
  overrides: Partial<CaseFormData> = {}
): Partial<CaseFormData> {
  return createCompleteBasicRecruitment({
    isProfessionalOccupation: true,
    additionalRecruitmentMethods: [
      { method: 'Campus Recruiting', date: '2024-01-20', description: 'University visit' },
      { method: 'Job Fair', date: '2024-01-25', description: 'Tech fair' },
      { method: 'Professional Organization', date: '2024-02-01', description: 'IEEE posting' },
    ],
    ...overrides,
  });
}

// ============================================================================
// Mock Date for Deterministic Tests
// ============================================================================

describe('useSectionState', () => {
  const originalDate = global.Date;

  beforeEach(() => {
    // Mock current date to 2024-03-15 for predictable window calculations
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.Date = originalDate;
  });

  // ============================================================================
  // getETA9089WindowStatus Function Tests
  // ============================================================================

  describe('getETA9089WindowStatus (via eta9089WindowStatus)', () => {
    describe('window opens 30 days after last recruitment ends', () => {
      it('returns isOpen false when recruitment is not complete', () => {
        const values = createFormData({
          sundayAdFirstDate: '2024-01-14',
          // Missing other recruitment dates
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.isOpen).toBe(false);
        expect(result.current.eta9089WindowStatus.opensOn).toBeUndefined();
      });

      it('calculates opensOn as 30 days after the latest recruitment end date', () => {
        const values = createCompleteBasicRecruitment({
          // Latest recruitment end: jobOrderEndDate = 2024-02-15
          // Window opens: 2024-02-15 + 30 days = 2024-03-16
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.opensOn).toBe('2024-03-16');
      });

      it('uses additionalRecruitmentEndDate if it is the latest date (professional occupation)', () => {
        const values = createCompleteBasicRecruitment({
          additionalRecruitmentEndDate: '2024-03-01', // Later than jobOrderEndDate
          isProfessionalOccupation: true, // Required to include additional recruitment dates
          // Window opens: 2024-03-01 + 30 days = 2024-03-31
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.opensOn).toBe('2024-03-31');
      });

      it('ignores additionalRecruitmentEndDate when NOT professional occupation', () => {
        const values = createCompleteBasicRecruitment({
          additionalRecruitmentEndDate: '2024-03-01', // Later than jobOrderEndDate
          isProfessionalOccupation: false, // Additional dates should be ignored
        });

        const { result } = renderHook(() => useSectionState(values));

        // Should use base recruitment date (jobOrderEndDate 2024-02-14), not additional
        expect(result.current.eta9089WindowStatus.opensOn).toBe('2024-03-16');
      });
    });

    describe('window closes at 180 days OR PWD expiration (whichever first)', () => {
      it('calculates closesOn as 180 days after first recruitment date', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-12-31', // Far in future, not limiting
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.closesOn).toBe('2024-07-12');
        expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(false);
      });

      it('uses PWD expiration if earlier than 180 days from first recruitment', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-06-30',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.closesOn).toBe('2024-06-30');
        expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(true);
      });

      it('uses 180 days when PWD expiration is later', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-08-15', // Later than 180-day limit
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.closesOn).toBe('2024-07-12');
        expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(false);
      });
    });

    describe('daysUntilOpen calculation', () => {
      it('returns days remaining until window opens', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-02-13', // Opens on 2024-03-14 (before today)
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysUntilOpen).toBe(0);
        expect(result.current.eta9089WindowStatus.isOpen).toBe(true);
      });

      it('returns positive days when window has not yet opened', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-02-16', // Opens on 2024-03-17
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysUntilOpen).toBeGreaterThan(0);
        expect(result.current.eta9089WindowStatus.isOpen).toBe(false);
      });

      it('returns 0 when window is already open', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-01-30', // Opens on 2024-02-29
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysUntilOpen).toBe(0);
        expect(result.current.eta9089WindowStatus.isOpen).toBe(true);
      });

      it('calculates days until open when window is in future', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-03-10',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysUntilOpen).toBeGreaterThanOrEqual(24);
        expect(result.current.eta9089WindowStatus.daysUntilOpen).toBeLessThanOrEqual(26);
      });
    });

    describe('daysRemaining calculation', () => {
      it('returns days remaining until window closes', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-01-30', // Window already open
          pwdExpirationDate: '2024-06-30',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysRemaining).toBeGreaterThanOrEqual(106);
        expect(result.current.eta9089WindowStatus.daysRemaining).toBeLessThanOrEqual(108);
      });

      it('returns 0 when window has already closed', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-03-01',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.daysRemaining).toBe(0);
      });
    });

    describe('isPwdLimited flag', () => {
      it('is true when PWD expiration limits the window', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-05-01', // Earlier than 180-day limit
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(true);
      });

      it('is false when 180-day rule limits the window', () => {
        const values = createCompleteBasicRecruitment({
          pwdExpirationDate: '2024-12-31', // Later than 180-day limit
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(false);
      });
    });
  });

  // ============================================================================
  // Section State Calculation Tests
  // ============================================================================

  describe('Section State Calculations', () => {
    describe('PWD section', () => {
      it('is always enabled', () => {
        const values = createFormData();

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.pwd.isEnabled).toBe(true);
        expect(result.current.sectionStates.pwd.disabledReason).toBeUndefined();
      });
    });

    describe('Recruitment section', () => {
      it('is disabled when PWD determination date is missing', () => {
        const values = createFormData({
          pwdDeterminationDate: undefined,
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.recruitment.isEnabled).toBe(false);
        expect(result.current.sectionStates.recruitment.disabledReason).toBe(
          'Enter PWD determination date first'
        );
      });

      it('is enabled when PWD determination date exists', () => {
        const values = createFormData({
          pwdDeterminationDate: '2024-01-15',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.recruitment.isEnabled).toBe(true);
        expect(result.current.sectionStates.recruitment.disabledReason).toBeUndefined();
      });
    });

    describe('ETA 9089 section', () => {
      it('is disabled when recruitment is incomplete', () => {
        const values = createFormData({
          pwdDeterminationDate: '2024-01-15',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.eta9089.isEnabled).toBe(false);
        expect(result.current.sectionStates.eta9089.disabledReason).toBe(
          'Complete all recruitment activities first'
        );
      });

      it('is disabled during 30-day waiting period even with complete recruitment', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-03-10',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.eta9089.isEnabled).toBe(false);
        expect(result.current.sectionStates.eta9089.disabledReason).toMatch(
          /30-day waiting period: \d+ days remaining/
        );
        expect(result.current.sectionStates.eta9089.statusInfo).toMatch(/Opens .+ · \d+d remaining/);
      });

      it('is enabled when recruitment is complete AND window is open', () => {
        const values = createCompleteBasicRecruitment({
          jobOrderEndDate: '2024-01-30',
          pwdExpirationDate: '2024-12-31',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.eta9089.isEnabled).toBe(true);
        expect(result.current.sectionStates.eta9089.disabledReason).toBeUndefined();
      });

      it('is disabled when filing window has closed', () => {
        const values = createCompleteBasicRecruitment({
          sundayAdFirstDate: '2024-01-07',
          sundayAdSecondDate: '2024-01-14',
          jobOrderStartDate: '2024-01-01',
          jobOrderEndDate: '2024-01-01',
          noticeOfFilingStartDate: '2024-01-01',
          noticeOfFilingEndDate: '2024-01-15',
          pwdExpirationDate: '2024-03-10',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.eta9089WindowStatus.isOpen).toBe(false);
        expect(result.current.sectionStates.eta9089.isEnabled).toBe(false);
        expect(result.current.eta9089WindowStatus.daysRemaining).toBe(0);
      });
    });

    describe('I-140 section', () => {
      it('is disabled when ETA 9089 certification date is missing', () => {
        const values = createCompleteBasicRecruitment({
          eta9089CertificationDate: undefined,
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.i140.isEnabled).toBe(false);
        expect(result.current.sectionStates.i140.disabledReason).toBe(
          'Enter ETA 9089 certification date first'
        );
      });

      it('is enabled when ETA 9089 certification date exists', () => {
        const values = createCompleteBasicRecruitment({
          eta9089CertificationDate: '2024-04-15',
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.i140.isEnabled).toBe(true);
        expect(result.current.sectionStates.i140.disabledReason).toBeUndefined();
      });
    });

    describe('Notes section', () => {
      it('is always enabled', () => {
        const values = createFormData();

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.notes.isEnabled).toBe(true);
      });
    });
  });

  // ============================================================================
  // Completion Detection Tests
  // ============================================================================

  describe('Completion Detection', () => {
    describe('PWD section', () => {
      it('is complete when both determination + expiration dates filled', () => {
        const values = createFormData({
          pwdDeterminationDate: '2024-01-15',
          pwdExpirationDate: '2024-06-30',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.pwd.isComplete).toBe(true);
      });

      it('is incomplete when missing determination date', () => {
        const values = createFormData({
          pwdExpirationDate: '2024-06-30',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.pwd.isComplete).toBe(false);
      });

      it('is incomplete when missing expiration date', () => {
        const values = createFormData({
          pwdDeterminationDate: '2024-01-15',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.pwd.isComplete).toBe(false);
      });
    });

    describe('Recruitment section', () => {
      it('is complete when basic recruitment is complete (non-professional)', () => {
        const values = createCompleteBasicRecruitment();
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.recruitment.isComplete).toBe(true);
      });

      it('is incomplete when missing any basic field', () => {
        const values = createFormData({
          sundayAdFirstDate: '2024-01-14',
          sundayAdSecondDate: '2024-01-21',
          jobOrderStartDate: '2024-01-15',
          // Missing jobOrderEndDate, noticeOfFiling
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.recruitment.isComplete).toBe(false);
      });

      it('is complete when professional with 3+ methods', () => {
        const values = createCompleteProfessionalRecruitment();
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.recruitment.isComplete).toBe(true);
      });

      it('is incomplete with only 2 professional methods', () => {
        const values = createCompleteBasicRecruitment({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
          ],
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.recruitment.isComplete).toBe(false);
      });
    });

    describe('ETA 9089 section', () => {
      it('is complete when certification date is filled', () => {
        const values = createFormData({
          eta9089CertificationDate: '2024-04-15',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.eta9089.isComplete).toBe(true);
      });

      it('is incomplete without certification date', () => {
        const values = createFormData({
          eta9089FilingDate: '2024-03-01',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.eta9089.isComplete).toBe(false);
      });
    });

    describe('I-140 section', () => {
      it('is complete when approval date is filled', () => {
        const values = createFormData({
          i140ApprovalDate: '2024-07-01',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.i140.isComplete).toBe(true);
      });

      it('is complete when denial date is filled', () => {
        const values = createFormData({
          i140DenialDate: '2024-07-01',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.i140.isComplete).toBe(true);
      });

      it('is incomplete without approval or denial date', () => {
        const values = createFormData({
          i140FilingDate: '2024-05-01',
        });
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.i140.isComplete).toBe(false);
      });
    });

    describe('Notes section', () => {
      it('is never complete', () => {
        const values = createFormData();
        const { result } = renderHook(() => useSectionState(values));
        expect(result.current.sectionStates.notes.isComplete).toBe(false);
      });
    });
  });

  // ============================================================================
  // Summary Generation Tests
  // ============================================================================

  describe('Summary Generation', () => {
    it('PWD summary includes wage amount and level', () => {
      const values = createFormData({
        pwdDeterminationDate: '2024-01-15',
        pwdExpirationDate: '2024-06-30',
        pwdWageAmount: 95000,
        pwdWageLevel: 'Level II',
      });
      const { result } = renderHook(() => useSectionState(values));
      expect(result.current.sectionStates.pwd.summary).toContain('Determined Jan 15');
      expect(result.current.sectionStates.pwd.summary).toContain('Expires Jun 30');
      expect(result.current.sectionStates.pwd.summary).toContain('$95,000');
      expect(result.current.sectionStates.pwd.summary).toContain('LII');
    });

    it('PWD summary without wage info', () => {
      const values = createFormData({
        pwdDeterminationDate: '2024-01-15',
        pwdExpirationDate: '2024-06-30',
      });
      const { result } = renderHook(() => useSectionState(values));
      expect(result.current.sectionStates.pwd.summary).toBe('Determined Jan 15 · Expires Jun 30');
    });

    it('PWD summary undefined when incomplete', () => {
      const values = createFormData({ pwdDeterminationDate: '2024-01-15' });
      const { result } = renderHook(() => useSectionState(values));
      expect(result.current.sectionStates.pwd.summary).toBeUndefined();
    });

    it('Recruitment summary shows method count for professional cases', () => {
      const values = createCompleteProfessionalRecruitment();
      const { result } = renderHook(() => useSectionState(values));
      const summary = result.current.sectionStates.recruitment.summary!;
      expect(summary).toContain('3 methods');
    });

    it('ETA 9089 summary includes case number', () => {
      const values = createFormData({
        eta9089FilingDate: '2024-03-01',
        eta9089CertificationDate: '2024-06-01',
        eta9089CaseNumber: 'A-123',
      });
      const { result } = renderHook(() => useSectionState(values));
      const summary = result.current.sectionStates.eta9089.summary!;
      expect(summary).toContain('Filed Mar 1');
      expect(summary).toContain('Certified Jun 1');
      expect(summary).toContain('Case A-123');
    });

    it('Empty summary when section has no data', () => {
      const values = createFormData();
      const { result } = renderHook(() => useSectionState(values));
      expect(result.current.sectionStates.eta9089.summary).toBeUndefined();
      expect(result.current.sectionStates.i140.summary).toBeUndefined();
    });
  });

  // ============================================================================
  // isBasicRecruitmentComplete Tests
  // ============================================================================

  describe('isBasicRecruitmentComplete (via isRecruitmentComplete)', () => {
    it('returns false when all 6 dates are missing', () => {
      const values = createFormData();

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(false);
    });

    it('returns false with partial completion (5 of 6 dates)', () => {
      const values = createFormData({
        sundayAdFirstDate: '2024-01-14',
        sundayAdSecondDate: '2024-01-21',
        jobOrderStartDate: '2024-01-15',
        jobOrderEndDate: '2024-02-15',
        noticeOfFilingStartDate: '2024-01-15',
        // Missing noticeOfFilingEndDate
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(false);
    });

    it('returns false with only sundayAd dates filled', () => {
      const values = createFormData({
        sundayAdFirstDate: '2024-01-14',
        sundayAdSecondDate: '2024-01-21',
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(false);
    });

    it('returns false with only job order dates filled', () => {
      const values = createFormData({
        jobOrderStartDate: '2024-01-15',
        jobOrderEndDate: '2024-02-15',
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(false);
    });

    it('returns false with only notice of filing dates filled', () => {
      const values = createFormData({
        noticeOfFilingStartDate: '2024-01-15',
        noticeOfFilingEndDate: '2024-01-29',
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(false);
    });

    it('returns true when all 6 required dates are filled', () => {
      const values = createCompleteBasicRecruitment();

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isRecruitmentComplete).toBe(true);
    });
  });

  // ============================================================================
  // isProfessionalRecruitmentComplete Tests
  // ============================================================================

  describe('isProfessionalRecruitmentComplete (via isProfessionalComplete)', () => {
    describe('for non-professional occupations', () => {
      it('returns true regardless of additional methods', () => {
        const values = createFormData({
          isProfessionalOccupation: false,
          additionalRecruitmentMethods: [],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      it('returns true even with empty additional methods array', () => {
        const values = createCompleteBasicRecruitment({
          isProfessionalOccupation: false,
          additionalRecruitmentMethods: [],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });
    });

    describe('for professional occupations', () => {
      it('returns false when no additional methods provided', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns false with only 1 additional method', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns false with only 2 additional methods', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns false when 3 methods exist but one is missing method name', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: '', date: '2024-01-25', description: '' },
            { method: 'Professional Organization', date: '2024-02-01', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns false when 3 methods exist but one is missing date', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '', description: '' },
            { method: 'Professional Organization', date: '2024-02-01', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns true when exactly 3 complete methods provided', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'Professional Organization', date: '2024-02-01', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      it('returns true when more than 3 complete methods provided', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'Professional Organization', date: '2024-02-01', description: '' },
            { method: 'Trade Publication', date: '2024-02-05', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      it('description field is optional - methods complete without it', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20' },
            { method: 'Job Fair', date: '2024-01-25' },
            { method: 'Professional Organization', date: '2024-02-01' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      // Feature 006: methods with startDate or subEntries count as complete
      it('returns true when method has startDate instead of date', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'employer_website', date: '', startDate: '2024-02-01', description: '' },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      it('returns true when method has subEntries instead of date', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'radio_ad', date: '', description: '', subEntries: [{ date: '2024-02-01' as ISODateString, description: 'WABC morning' }] },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });

      it('returns false when method has empty subEntries array', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Campus Recruiting', date: '2024-01-20', description: '' },
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'radio_ad', date: '', description: '', subEntries: [] },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(false);
      });

      it('returns true with mixed date types (date, startDate, subEntries)', () => {
        const values = createFormData({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'Job Fair', date: '2024-01-25', description: '' },
            { method: 'employer_website', date: '', startDate: '2024-02-01', description: '' },
            { method: 'radio_ad', date: '', description: '', subEntries: [{ date: '2024-02-10' as ISODateString, description: '' }] },
          ],
        });

        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.isProfessionalComplete).toBe(true);
      });
    });
  });

  // ============================================================================
  // Section Interaction Tests
  // ============================================================================

  describe('Section Interaction Methods', () => {
    describe('toggleSection', () => {
      it('toggles section open state', () => {
        const values = createFormData();
        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.pwd.isOpen).toBe(true);

        act(() => {
          result.current.toggleSection('pwd');
        });

        expect(result.current.sectionStates.pwd.isOpen).toBe(false);

        act(() => {
          result.current.toggleSection('pwd');
        });

        expect(result.current.sectionStates.pwd.isOpen).toBe(true);
      });
    });

    describe('openSection', () => {
      it('expands a section', () => {
        const values = createFormData();
        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.recruitment.isOpen).toBe(false);

        act(() => {
          result.current.openSection('recruitment');
        });

        expect(result.current.sectionStates.recruitment.isOpen).toBe(true);
      });
    });

    describe('closeSection', () => {
      it('collapses a section', () => {
        const values = createFormData();
        const { result } = renderHook(() => useSectionState(values));

        expect(result.current.sectionStates.pwd.isOpen).toBe(true);

        act(() => {
          result.current.closeSection('pwd');
        });

        expect(result.current.sectionStates.pwd.isOpen).toBe(false);
      });
    });
  });

  // ============================================================================
  // Auto-open/collapse Tests
  // ============================================================================

  describe('Auto-open/collapse', () => {
    it('filling pwdDeterminationDate opens recruitment section', () => {
      const values = createFormData();
      const { result, rerender } = renderHook(({ v }) => useSectionState(v), {
        initialProps: { v: values },
      });

      expect(result.current.sectionStates.recruitment.isOpen).toBe(false);

      const updated = createFormData({ pwdDeterminationDate: '2024-01-15' });
      rerender({ v: updated });

      expect(result.current.sectionStates.recruitment.isOpen).toBe(true);
    });

    it('clearing pwdDeterminationDate collapses recruitment + eta9089 + i140', () => {
      const values = createFormData({ pwdDeterminationDate: '2024-01-15' });
      const { result, rerender } = renderHook(({ v }) => useSectionState(v), {
        initialProps: { v: values },
      });

      // Open downstream sections
      act(() => {
        result.current.openSection('eta9089');
        result.current.openSection('i140');
      });

      const cleared = createFormData({ pwdDeterminationDate: undefined });
      rerender({ v: cleared });

      expect(result.current.sectionStates.recruitment.isOpen).toBe(false);
      expect(result.current.sectionStates.eta9089.isOpen).toBe(false);
      expect(result.current.sectionStates.i140.isOpen).toBe(false);
    });

    it('filling eta9089CertificationDate opens i140 section', () => {
      const values = createFormData();
      const { result, rerender } = renderHook(({ v }) => useSectionState(v), {
        initialProps: { v: values },
      });

      const updated = createFormData({ eta9089CertificationDate: '2024-04-15' });
      rerender({ v: updated });

      expect(result.current.sectionStates.i140.isOpen).toBe(true);
    });

    it('clearing eta9089CertificationDate collapses i140', () => {
      const values = createFormData({ eta9089CertificationDate: '2024-04-15' });
      const { result, rerender } = renderHook(({ v }) => useSectionState(v), {
        initialProps: { v: values },
      });

      const cleared = createFormData({ eta9089CertificationDate: undefined });
      rerender({ v: cleared });

      expect(result.current.sectionStates.i140.isOpen).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty form data', () => {
      const values = {};

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.sectionStates.pwd.isEnabled).toBe(true);
      expect(result.current.sectionStates.recruitment.isEnabled).toBe(false);
      expect(result.current.sectionStates.eta9089.isEnabled).toBe(false);
      expect(result.current.sectionStates.i140.isEnabled).toBe(false);
    });

    it('handles undefined additionalRecruitmentMethods', () => {
      const values = createFormData({
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: undefined as unknown as CaseFormData['additionalRecruitmentMethods'],
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.isProfessionalComplete).toBe(false);
    });

    it('handles PWD expiration on same day as 180-day limit', () => {
      const values = createCompleteBasicRecruitment({
        pwdExpirationDate: '2024-07-12',
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.eta9089WindowStatus.closesOn).toBe('2024-07-12');
      expect(result.current.eta9089WindowStatus.isPwdLimited).toBe(false);
    });

    it('uses earliest first recruitment date from multiple sources', () => {
      const values = createFormData({
        pwdDeterminationDate: '2024-01-01',
        pwdExpirationDate: '2024-12-31',
        sundayAdFirstDate: '2024-01-21',
        jobOrderStartDate: '2024-01-10', // Earliest
        noticeOfFilingStartDate: '2024-01-15',
        sundayAdSecondDate: '2024-01-28',
        jobOrderEndDate: '2024-02-15',
        noticeOfFilingEndDate: '2024-01-29',
      });

      const { result } = renderHook(() => useSectionState(values));

      // 180 days from earliest (2024-01-10) = 2024-07-08
      expect(result.current.eta9089WindowStatus.closesOn).toBe('2024-07-08');
    });

    it('uses latest recruitment end date from multiple sources', () => {
      const values = createFormData({
        pwdDeterminationDate: '2024-01-01',
        pwdExpirationDate: '2024-12-31',
        sundayAdFirstDate: '2024-01-14',
        sundayAdSecondDate: '2024-01-21',
        jobOrderStartDate: '2024-01-15',
        jobOrderEndDate: '2024-02-15',
        noticeOfFilingStartDate: '2024-01-15',
        noticeOfFilingEndDate: '2024-01-29',
        additionalRecruitmentEndDate: '2024-03-01',
        isProfessionalOccupation: true,
      });

      const { result } = renderHook(() => useSectionState(values));

      expect(result.current.eta9089WindowStatus.opensOn).toBe('2024-03-31');
    });
  });
});
