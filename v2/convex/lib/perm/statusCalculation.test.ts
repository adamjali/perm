import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateAutoStatus, type StatusCalculationInput } from './statusCalculation';

describe('calculateAutoStatus', () => {
  // Mock date for consistent testing (needed for isEta9089WindowOpen)
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default state', () => {
    it('returns pwd/working for empty input', () => {
      const result = calculateAutoStatus({});
      expect(result).toEqual({ caseStatus: 'pwd', progressStatus: 'working' });
    });
  });

  describe('PWD stage', () => {
    it('returns pwd/filed when only pwdFilingDate is set', () => {
      const result = calculateAutoStatus({
        pwdFilingDate: '2024-01-15',
      });
      expect(result).toEqual({ caseStatus: 'pwd', progressStatus: 'filed' });
    });

    it('returns recruitment/working when pwdDeterminationDate is set', () => {
      const result = calculateAutoStatus({
        pwdFilingDate: '2024-01-15',
        pwdDeterminationDate: '2024-02-15',
      });
      expect(result).toEqual({ caseStatus: 'recruitment', progressStatus: 'working' });
    });

    it('returns recruitment/working when only pwdDeterminationDate is set (no filing date)', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-02-15',
      });
      expect(result).toEqual({ caseStatus: 'recruitment', progressStatus: 'working' });
    });
  });

  describe('Recruitment stage', () => {
    const baseRecruitmentComplete: StatusCalculationInput = {
      pwdDeterminationDate: '2024-01-15',
      jobOrderStartDate: '2024-01-20',
      jobOrderEndDate: '2024-02-20',
      sundayAdFirstDate: '2024-01-21',
      sundayAdSecondDate: '2024-01-28',
      noticeOfFilingStartDate: '2024-01-20',
      noticeOfFilingEndDate: '2024-02-03',
    };

    it('returns recruitment/filed when recruitment complete but window not open yet', () => {
      // Set current time to before window opens (30 days after last recruitment)
      vi.setSystemTime(new Date('2024-02-25')); // Only 5 days after recruitment end

      const result = calculateAutoStatus(baseRecruitmentComplete);
      expect(result).toEqual({ caseStatus: 'recruitment', progressStatus: 'filed' });
    });

    it('returns eta9089/working when recruitment complete and window is open', () => {
      // Set current time to after window opens
      vi.setSystemTime(new Date('2024-04-01')); // More than 30 days after recruitment end

      const result = calculateAutoStatus(baseRecruitmentComplete);
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'working' });
    });
  });

  describe('ETA 9089 stage', () => {
    it('returns eta9089/filed when eta9089FilingDate is set', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        eta9089FilingDate: '2024-03-15',
      });
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'filed' });
    });

    it('returns i140/working when eta9089CertificationDate is set', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        eta9089FilingDate: '2024-03-15',
        eta9089CertificationDate: '2024-05-15',
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'working' });
    });
  });

  describe('I-140 stage', () => {
    it('returns i140/filed when i140FilingDate is set', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'filed' });
    });

    it('returns i140/approved when i140ApprovalDate is set', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
        i140ApprovalDate: '2024-08-15',
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'approved' });
    });

    it('returns closed/approved when i140DenialDate is set', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
        i140DenialDate: '2024-08-15',
      });
      expect(result).toEqual({ caseStatus: 'closed', progressStatus: 'approved' });
    });
  });

  describe('RFI/RFE override', () => {
    it('returns eta9089/rfi_rfe when active RFI exists', () => {
      const result = calculateAutoStatus({
        eta9089FilingDate: '2024-03-15',
        rfiEntries: [
          { receivedDate: '2024-04-01' }, // Active RFI (no response submitted)
        ],
      });
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'rfi_rfe' });
    });

    it('returns eta9089/filed when RFI is responded', () => {
      const result = calculateAutoStatus({
        eta9089FilingDate: '2024-03-15',
        rfiEntries: [
          { receivedDate: '2024-04-01', responseSubmittedDate: '2024-04-15' },
        ],
      });
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'filed' });
    });

    it('returns i140/rfi_rfe when active RFE exists', () => {
      const result = calculateAutoStatus({
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
        rfeEntries: [
          { receivedDate: '2024-07-01' }, // Active RFE
        ],
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'rfi_rfe' });
    });

    it('returns i140/filed when RFE is responded', () => {
      const result = calculateAutoStatus({
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
        rfeEntries: [
          { receivedDate: '2024-07-01', responseSubmittedDate: '2024-07-15' },
        ],
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'filed' });
    });

    it('RFI/RFE override takes priority over approval date', () => {
      // Even if approval date exists, an active RFE should show rfi_rfe status
      const result = calculateAutoStatus({
        i140ApprovalDate: '2024-08-15',
        rfeEntries: [
          { receivedDate: '2024-09-01' }, // Active RFE received after approval (weird but possible)
        ],
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'rfi_rfe' });
    });
  });

  describe('Professional occupation', () => {
    it('includes professional recruitment methods in completion check', () => {
      vi.setSystemTime(new Date('2024-05-01'));

      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        jobOrderStartDate: '2024-01-20',
        jobOrderEndDate: '2024-02-20',
        sundayAdFirstDate: '2024-01-21',
        sundayAdSecondDate: '2024-01-28',
        noticeOfFilingStartDate: '2024-01-20',
        noticeOfFilingEndDate: '2024-02-03',
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: 'Campus Placement', date: '2024-02-01' },
          { method: 'Job Fair', date: '2024-02-05' },
          { method: 'Trade Publication', date: '2024-02-10' },
        ],
      });
      // With 3 professional methods, recruitment should be complete
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'working' });
    });

    it('shows recruitment/working if professional occupation missing required methods', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-01-15',
        jobOrderStartDate: '2024-01-20',
        jobOrderEndDate: '2024-02-20',
        sundayAdFirstDate: '2024-01-21',
        sundayAdSecondDate: '2024-01-28',
        noticeOfFilingStartDate: '2024-01-20',
        noticeOfFilingEndDate: '2024-02-03',
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { method: 'Campus Placement', date: '2024-02-01' },
          // Only 1 method, need 3 for professional occupation
        ],
      });
      // Incomplete professional recruitment
      expect(result).toEqual({ caseStatus: 'recruitment', progressStatus: 'working' });
    });
  });

  describe('priority order', () => {
    it('I-140 approval takes priority over all dates except RFE', () => {
      const result = calculateAutoStatus({
        pwdFilingDate: '2024-01-15',
        pwdDeterminationDate: '2024-02-15',
        eta9089FilingDate: '2024-03-15',
        eta9089CertificationDate: '2024-05-15',
        i140FilingDate: '2024-06-01',
        i140ApprovalDate: '2024-08-15',
      });
      expect(result).toEqual({ caseStatus: 'i140', progressStatus: 'approved' });
    });

    it('eta9089 filing takes priority over pwd determination', () => {
      const result = calculateAutoStatus({
        pwdDeterminationDate: '2024-02-15',
        eta9089FilingDate: '2024-03-15',
      });
      expect(result).toEqual({ caseStatus: 'eta9089', progressStatus: 'filed' });
    });

    it('pwd determination takes priority over pwd filing', () => {
      const result = calculateAutoStatus({
        pwdFilingDate: '2024-01-15',
        pwdDeterminationDate: '2024-02-15',
      });
      expect(result).toEqual({ caseStatus: 'recruitment', progressStatus: 'working' });
    });
  });

  describe('edge cases', () => {
    it('handles null values gracefully', () => {
      const result = calculateAutoStatus({
        pwdFilingDate: null,
        pwdDeterminationDate: null,
      });
      expect(result).toEqual({ caseStatus: 'pwd', progressStatus: 'working' });
    });

    it('handles empty arrays gracefully', () => {
      const result = calculateAutoStatus({
        rfiEntries: [],
        rfeEntries: [],
        additionalRecruitmentMethods: [],
      });
      expect(result).toEqual({ caseStatus: 'pwd', progressStatus: 'working' });
    });
  });
});
