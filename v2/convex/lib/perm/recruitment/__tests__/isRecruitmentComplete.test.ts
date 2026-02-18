import { describe, it, expect } from 'vitest';
import {
  isRecruitmentComplete,
  isBasicRecruitmentComplete,
  isProfessionalRecruitmentComplete,
  type RecruitmentCheckInput,
} from '../isRecruitmentComplete';

const basicComplete: RecruitmentCheckInput = {
  jobOrderStartDate: '2024-01-15',
  jobOrderEndDate: '2024-02-14',
  sundayAdFirstDate: '2024-01-21',
  sundayAdSecondDate: '2024-01-28',
  noticeOfFilingStartDate: '2024-01-15',
  noticeOfFilingEndDate: '2024-01-29',
};

describe('isBasicRecruitmentComplete', () => {
  it('returns true when all basic fields are present', () => {
    expect(isBasicRecruitmentComplete(basicComplete)).toBe(true);
  });

  it.each([
    ['jobOrderStartDate', { ...basicComplete, jobOrderStartDate: undefined }],
    ['jobOrderEndDate', { ...basicComplete, jobOrderEndDate: undefined }],
    ['sundayAdFirstDate', { ...basicComplete, sundayAdFirstDate: undefined }],
    ['sundayAdSecondDate', { ...basicComplete, sundayAdSecondDate: undefined }],
    ['noticeOfFilingStartDate', { ...basicComplete, noticeOfFilingStartDate: undefined }],
    ['noticeOfFilingEndDate', { ...basicComplete, noticeOfFilingEndDate: undefined }],
  ])('returns false when %s is missing', (_field, input) => {
    expect(isBasicRecruitmentComplete(input)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isBasicRecruitmentComplete({})).toBe(false);
  });

  it('supports snake_case field names', () => {
    expect(isBasicRecruitmentComplete({
      job_order_start_date: '2024-01-15',
      job_order_end_date: '2024-02-14',
      sunday_ad_first_date: '2024-01-21',
      sunday_ad_second_date: '2024-01-28',
      notice_of_filing_start_date: '2024-01-15',
      notice_of_filing_end_date: '2024-01-29',
    })).toBe(true);
  });

  it('treats null values as missing', () => {
    expect(isBasicRecruitmentComplete({
      ...basicComplete,
      jobOrderStartDate: null,
    })).toBe(false);
  });
});

describe('isProfessionalRecruitmentComplete', () => {
  it('returns true for non-professional occupations', () => {
    expect(isProfessionalRecruitmentComplete({ isProfessionalOccupation: false })).toBe(true);
  });

  it('returns true when undefined (defaults to non-professional)', () => {
    expect(isProfessionalRecruitmentComplete({})).toBe(true);
  });

  it('returns false for professional with no methods', () => {
    expect(isProfessionalRecruitmentComplete({
      isProfessionalOccupation: true,
    })).toBe(false);
  });

  it('returns false for professional with < 3 methods', () => {
    expect(isProfessionalRecruitmentComplete({
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'Campus', date: '2024-01-10' },
        { method: 'Job Fair', date: '2024-01-12' },
      ],
    })).toBe(false);
  });

  it('returns true for professional with 3+ methods', () => {
    expect(isProfessionalRecruitmentComplete({
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'Campus', date: '2024-01-10' },
        { method: 'Job Fair', date: '2024-01-12' },
        { method: 'Trade Pub', date: '2024-01-15' },
      ],
    })).toBe(true);
  });

  it('accepts methods with startDate instead of date', () => {
    expect(isProfessionalRecruitmentComplete({
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'Campus', date: '', startDate: '2024-01-10' },
        { method: 'Job Fair', date: '', startDate: '2024-01-12' },
        { method: 'Trade Pub', date: '', startDate: '2024-01-15' },
      ],
    })).toBe(true);
  });

  it('accepts legacy additionalRecruitmentEndDate', () => {
    expect(isProfessionalRecruitmentComplete({
      isProfessionalOccupation: true,
      additionalRecruitmentEndDate: '2024-02-15',
    })).toBe(true);
  });

  it('supports snake_case is_professional_occupation', () => {
    expect(isProfessionalRecruitmentComplete({
      is_professional_occupation: true,
      additionalRecruitmentMethods: [
        { method: 'A', date: '2024-01-10' },
        { method: 'B', date: '2024-01-12' },
        { method: 'C', date: '2024-01-15' },
      ],
    })).toBe(true);
  });
});

describe('isRecruitmentComplete', () => {
  it('returns true for complete non-professional case', () => {
    expect(isRecruitmentComplete({ ...basicComplete, isProfessionalOccupation: false })).toBe(true);
  });

  it('returns false when basic incomplete even with professional methods', () => {
    expect(isRecruitmentComplete({
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'A', date: '2024-01-10' },
        { method: 'B', date: '2024-01-12' },
        { method: 'C', date: '2024-01-15' },
      ],
    })).toBe(false);
  });

  it('returns true for complete professional case', () => {
    expect(isRecruitmentComplete({
      ...basicComplete,
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'A', date: '2024-01-10' },
        { method: 'B', date: '2024-01-12' },
        { method: 'C', date: '2024-01-15' },
      ],
    })).toBe(true);
  });
});
