import { describe, it, expect } from 'vitest';
import { mapToValidatorFormat } from '../fieldMapper';

describe('mapToValidatorFormat', () => {
  it('maps camelCase PWD fields to snake_case', () => {
    const result = mapToValidatorFormat({
      pwdFilingDate: '2024-01-15',
      pwdDeterminationDate: '2024-03-01',
      pwdExpirationDate: '2025-03-01',
    });
    expect(result.pwd_filing_date).toBe('2024-01-15');
    expect(result.pwd_determination_date).toBe('2024-03-01');
    expect(result.pwd_expiration_date).toBe('2025-03-01');
  });

  it('maps recruitment dates', () => {
    const result = mapToValidatorFormat({
      sundayAdFirstDate: '2024-01-21',
      jobOrderStartDate: '2024-01-15',
      noticeOfFilingEndDate: '2024-01-29',
    });
    expect(result.sunday_ad_first_date).toBe('2024-01-21');
    expect(result.job_order_start_date).toBe('2024-01-15');
    expect(result.notice_of_filing_end_date).toBe('2024-01-29');
  });

  it('treats empty strings as null', () => {
    const result = mapToValidatorFormat({ pwdFilingDate: '' });
    expect(result.pwd_filing_date).toBeNull();
  });

  it('defaults caseStatus to pwd and progressStatus to working', () => {
    const result = mapToValidatorFormat({});
    expect(result.case_status).toBe('pwd');
    expect(result.progress_status).toBe('working');
  });

  it('passes through caseStatus and progressStatus', () => {
    const result = mapToValidatorFormat({
      caseStatus: 'i140',
      progressStatus: 'filed',
    });
    expect(result.case_status).toBe('i140');
    expect(result.progress_status).toBe('filed');
  });

  it('extracts active RFI entry (first without submitted date)', () => {
    const result = mapToValidatorFormat({
      rfiEntries: [
        { id: '1', receivedDate: '2024-01-01', responseDueDate: '2024-02-01', responseSubmittedDate: '2024-01-15', createdAt: 1 },
        { id: '2', receivedDate: '2024-03-01', responseDueDate: '2024-04-01', createdAt: 2 },
      ],
    });
    expect(result.rfi_received_date).toBe('2024-03-01');
    expect(result.rfi_due_date).toBe('2024-04-01');
    expect(result.rfi_submitted_date).toBeNull();
  });

  it('returns null RFI/RFE fields when no entries', () => {
    const result = mapToValidatorFormat({});
    expect(result.rfi_received_date).toBeNull();
    expect(result.rfe_due_date).toBeNull();
  });
});
