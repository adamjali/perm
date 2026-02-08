import { describe, it, expect } from 'vitest';
import { prepareUpdatePayload } from '../prepareUpdatePayload';

describe('prepareUpdatePayload', () => {
  it('converts undefined values to null', () => {
    const data = {
      employerName: 'Test Corp',
      sundayAdSecondDate: undefined,
      pwdFilingDate: undefined,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.employerName).toBe('Test Corp');
    expect(result.sundayAdSecondDate).toBeNull();
    expect(result.pwdFilingDate).toBeNull();
  });

  it('preserves string values as-is', () => {
    const data = {
      pwdFilingDate: '2024-01-15',
      employerName: 'Test Corp',
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.pwdFilingDate).toBe('2024-01-15');
    expect(result.employerName).toBe('Test Corp');
  });

  it('preserves arrays as-is', () => {
    const data = {
      rfiEntries: [{ id: '1', receivedDate: '2024-01-15' }],
      notes: [],
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.rfiEntries).toEqual([{ id: '1', receivedDate: '2024-01-15' }]);
    expect(result.notes).toEqual([]);
  });

  it('preserves booleans as-is', () => {
    const data = {
      isProfessionalOccupation: false,
      isFavorite: true,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.isProfessionalOccupation).toBe(false);
    expect(result.isFavorite).toBe(true);
  });

  it('preserves numbers as-is', () => {
    const data = {
      pwdWageAmount: 75000,
      recruitmentApplicantsCount: 0,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.pwdWageAmount).toBe(75000);
    expect(result.recruitmentApplicantsCount).toBe(0);
  });

  it('preserves empty strings as-is (not converted to null)', () => {
    const data = {
      beneficiaryIdentifier: '',
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.beneficiaryIdentifier).toBe('');
  });

  it('preserves null values as-is', () => {
    const data = {
      sundayAdSecondDate: null,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.sundayAdSecondDate).toBeNull();
  });
});
