import { describe, it, expect } from 'vitest';
import { applyCascade, applyCascadeMultiple } from './cascade';
import type { CaseData, FieldChange } from './types';

// Helper to create minimal test case data
function createTestCase(overrides: Partial<CaseData> = {}): CaseData {
  return {
    pwd_filing_date: null,
    pwd_determination_date: null,
    pwd_expiration_date: null,
    sunday_ad_first_date: null,
    sunday_ad_second_date: null,
    job_order_start_date: null,
    job_order_end_date: null,
    notice_of_filing_start_date: null,
    notice_of_filing_end_date: null,
    recruitment_start_date: null,
    recruitment_end_date: null,
    is_professional_occupation: false,
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
    case_status: 'pwd',
    progress_status: 'working',
    ...overrides,
  };
}

describe('applyCascade', () => {
  describe('V-CASCADE-01: PWD determination → PWD expiration', () => {
    it('should auto-calculate PWD expiration when determination date is set', () => {
      const currentState = createTestCase();
      const result = applyCascade(currentState, {
        field: 'pwd_determination_date',
        value: '2024-05-15',
      });

      expect(result.pwd_determination_date).toBe('2024-05-15');
      expect(result.pwd_expiration_date).toBe('2024-08-13'); // Case 1: +90 days
    });

    it('should recalculate PWD expiration when determination date changes', () => {
      const currentState = createTestCase({
        pwd_determination_date: '2024-05-15',
        pwd_expiration_date: '2024-08-13',
      });

      const result = applyCascade(currentState, {
        field: 'pwd_determination_date',
        value: '2024-09-10',
      });

      expect(result.pwd_determination_date).toBe('2024-09-10');
      expect(result.pwd_expiration_date).toBe('2025-06-30'); // Case 2: next June 30
    });

    it('should clear PWD expiration when determination date is cleared', () => {
      const currentState = createTestCase({
        pwd_determination_date: '2024-05-15',
        pwd_expiration_date: '2024-08-13',
      });

      const result = applyCascade(currentState, {
        field: 'pwd_determination_date',
        value: null,
      });

      expect(result.pwd_determination_date).toBe(null);
      expect(result.pwd_expiration_date).toBe(null);
    });

    it('should handle different PWD expiration cases', () => {
      // Case 2: July-Dec → next June 30
      let result = applyCascade(createTestCase(), {
        field: 'pwd_determination_date',
        value: '2024-09-10',
      });
      expect(result.pwd_expiration_date).toBe('2025-06-30');

      // Case 3: Jan-Apr 1 → same June 30
      result = applyCascade(createTestCase(), {
        field: 'pwd_determination_date',
        value: '2024-02-05',
      });
      expect(result.pwd_expiration_date).toBe('2024-06-30');
    });
  });

  describe('V-CASCADE-04: Notice of Filing start → end (extend-only)', () => {
    it('should calculate Notice end when start is set (+10 business days)', () => {
      const currentState = createTestCase();
      const result = applyCascade(currentState, {
        field: 'notice_of_filing_start_date',
        value: '2024-01-15', // Monday
      });

      expect(result.notice_of_filing_start_date).toBe('2024-01-15');
      expect(result.notice_of_filing_end_date).toBe('2024-01-29'); // +10 business days
    });

    it('should extend Notice end when start moves forward', () => {
      const currentState = createTestCase({
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      const result = applyCascade(currentState, {
        field: 'notice_of_filing_start_date',
        value: '2024-01-20', // Move start forward (Saturday)
      });

      expect(result.notice_of_filing_start_date).toBe('2024-01-20');
      // 2024-01-20 (Sat) + 10 business days = 2024-02-02 (Fri)
      // This is later than the current end (2024-01-29), so it extends
      expect(result.notice_of_filing_end_date).toBe('2024-02-02'); // New end (extended)
    });

    it('should NOT shorten Notice end when start moves backward', () => {
      const currentState = createTestCase({
        notice_of_filing_start_date: '2024-01-20',
        notice_of_filing_end_date: '2024-02-05',
      });

      const result = applyCascade(currentState, {
        field: 'notice_of_filing_start_date',
        value: '2024-01-15', // Move start backward
      });

      expect(result.notice_of_filing_start_date).toBe('2024-01-15');
      expect(result.notice_of_filing_end_date).toBe('2024-02-05'); // Keep existing end (extend-only)
    });

    it('should clear Notice end when start is cleared', () => {
      const currentState = createTestCase({
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      const result = applyCascade(currentState, {
        field: 'notice_of_filing_start_date',
        value: null,
      });

      expect(result.notice_of_filing_start_date).toBe(null);
      expect(result.notice_of_filing_end_date).toBe(null);
    });
  });

  describe('V-CASCADE-05: Job Order start → end (extend-only)', () => {
    it('should calculate Job Order end when start is set (+30 calendar days)', () => {
      const currentState = createTestCase();
      const result = applyCascade(currentState, {
        field: 'job_order_start_date',
        value: '2024-01-15',
      });

      expect(result.job_order_start_date).toBe('2024-01-15');
      expect(result.job_order_end_date).toBe('2024-02-14'); // +30 calendar days
    });

    it('should extend Job Order end when start moves forward', () => {
      const currentState = createTestCase({
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
      });

      const result = applyCascade(currentState, {
        field: 'job_order_start_date',
        value: '2024-01-20', // Move start forward
      });

      expect(result.job_order_start_date).toBe('2024-01-20');
      expect(result.job_order_end_date).toBe('2024-02-19'); // New end (extended)
    });

    it('should NOT shorten Job Order end when start moves backward', () => {
      const currentState = createTestCase({
        job_order_start_date: '2024-01-20',
        job_order_end_date: '2024-02-19',
      });

      const result = applyCascade(currentState, {
        field: 'job_order_start_date',
        value: '2024-01-15', // Move start backward
      });

      expect(result.job_order_start_date).toBe('2024-01-15');
      expect(result.job_order_end_date).toBe('2024-02-19'); // Keep existing end (extend-only)
    });

    it('should clear Job Order end when start is cleared', () => {
      const currentState = createTestCase({
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
      });

      const result = applyCascade(currentState, {
        field: 'job_order_start_date',
        value: null,
      });

      expect(result.job_order_start_date).toBe(null);
      expect(result.job_order_end_date).toBe(null);
    });
  });

  describe('ETA 9089 certification → expiration', () => {
    it('should calculate ETA 9089 expiration when certification is set (+180 days)', () => {
      const currentState = createTestCase();
      const result = applyCascade(currentState, {
        field: 'eta9089_certification_date',
        value: '2024-03-15',
      });

      expect(result.eta9089_certification_date).toBe('2024-03-15');
      expect(result.eta9089_expiration_date).toBe('2024-09-11'); // +180 days
    });

    it('should recalculate expiration when certification changes', () => {
      const currentState = createTestCase({
        eta9089_certification_date: '2024-03-15',
        eta9089_expiration_date: '2024-09-11',
      });

      const result = applyCascade(currentState, {
        field: 'eta9089_certification_date',
        value: '2024-04-01',
      });

      expect(result.eta9089_certification_date).toBe('2024-04-01');
      expect(result.eta9089_expiration_date).toBe('2024-09-28'); // New +180 days
    });

    it('should clear expiration when certification is cleared', () => {
      const currentState = createTestCase({
        eta9089_certification_date: '2024-03-15',
        eta9089_expiration_date: '2024-09-11',
      });

      const result = applyCascade(currentState, {
        field: 'eta9089_certification_date',
        value: null,
      });

      expect(result.eta9089_certification_date).toBe(null);
      expect(result.eta9089_expiration_date).toBe(null);
    });
  });

  describe('RFI received → due date', () => {
    it('should calculate RFI due date when received is set (+30 calendar days)', () => {
      const currentState = createTestCase();
      const result = applyCascade(currentState, {
        field: 'rfi_received_date',
        value: '2024-10-15',
      });

      expect(result.rfi_received_date).toBe('2024-10-15');
      expect(result.rfi_due_date).toBe('2024-11-14'); // +30 calendar days
    });

    it('should recalculate due date when received changes (strict 30 days)', () => {
      const currentState = createTestCase({
        rfi_received_date: '2024-10-15',
        rfi_due_date: '2024-11-14',
      });

      const result = applyCascade(currentState, {
        field: 'rfi_received_date',
        value: '2024-10-20',
      });

      expect(result.rfi_received_date).toBe('2024-10-20');
      expect(result.rfi_due_date).toBe('2024-11-19'); // Always strict +30 days
    });

    it('should clear due date when received is cleared', () => {
      const currentState = createTestCase({
        rfi_received_date: '2024-10-15',
        rfi_due_date: '2024-11-14',
      });

      const result = applyCascade(currentState, {
        field: 'rfi_received_date',
        value: null,
      });

      expect(result.rfi_received_date).toBe(null);
      expect(result.rfi_due_date).toBe(null);
    });
  });

  describe('Non-cascade fields', () => {
    it('should not trigger cascade for non-cascade fields', () => {
      const currentState = createTestCase();

      // These should NOT trigger any cascade
      const nonCascadeFields: FieldChange[] = [
        { field: 'pwd_filing_date', value: '2024-01-15' },
        { field: 'pwd_expiration_date', value: '2024-08-13' }, // Derived field
        { field: 'sunday_ad_first_date', value: '2024-02-11' },
        { field: 'sunday_ad_second_date', value: '2024-02-18' },
        { field: 'notice_of_filing_end_date', value: '2024-01-29' }, // Derived field
        { field: 'job_order_end_date', value: '2024-02-14' }, // Derived field
        { field: 'is_professional_occupation', value: true },
        { field: 'eta9089_filing_date', value: '2024-07-15' },
        { field: 'eta9089_expiration_date', value: '2024-09-11' }, // Derived field
        { field: 'i140_filing_date', value: '2024-09-01' },
        { field: 'i140_approval_date', value: '2024-12-01' },
        { field: 'rfi_due_date', value: '2024-11-14' }, // Derived field
        { field: 'rfi_submitted_date', value: '2024-11-10' },
      ];

      nonCascadeFields.forEach((change) => {
        const result = applyCascade(currentState, change);
        expect(result).toEqual({
          ...currentState,
          [change.field]: change.value,
        });
      });
    });
  });

  describe('DAG structure (no infinite loops)', () => {
    it('should never cascade back to upstream dependencies', () => {
      const currentState = createTestCase({
        pwd_determination_date: '2024-05-15',
        pwd_expiration_date: '2024-08-13',
      });

      // Changing pwd_expiration_date manually should NOT cascade back to pwd_determination_date
      const result = applyCascade(currentState, {
        field: 'pwd_expiration_date',
        value: '2024-09-01',
      });

      expect(result.pwd_expiration_date).toBe('2024-09-01');
      expect(result.pwd_determination_date).toBe('2024-05-15'); // Unchanged
    });

    it('should handle single cascade level without infinite loops', () => {
      const currentState = createTestCase();

      // This should cascade exactly once (pwd_determination_date → pwd_expiration_date)
      const result = applyCascade(currentState, {
        field: 'pwd_determination_date',
        value: '2024-05-15',
      });

      expect(result.pwd_determination_date).toBe('2024-05-15');
      expect(result.pwd_expiration_date).toBe('2024-08-13');

      // No other fields should be affected
      expect(result.notice_of_filing_start_date).toBe(null);
      expect(result.job_order_start_date).toBe(null);
      expect(result.eta9089_certification_date).toBe(null);
    });
  });
});

describe('applyCascadeMultiple', () => {
  it('should apply multiple cascades in sequence', () => {
    const currentState = createTestCase();

    const result = applyCascadeMultiple(currentState, [
      { field: 'pwd_determination_date', value: '2024-05-15' },
      { field: 'notice_of_filing_start_date', value: '2024-01-15' },
      { field: 'job_order_start_date', value: '2024-01-15' },
    ]);

    expect(result.pwd_determination_date).toBe('2024-05-15');
    expect(result.pwd_expiration_date).toBe('2024-08-13');
    expect(result.notice_of_filing_start_date).toBe('2024-01-15');
    expect(result.notice_of_filing_end_date).toBe('2024-01-29');
    expect(result.job_order_start_date).toBe('2024-01-15');
    expect(result.job_order_end_date).toBe('2024-02-14');
  });

  it('should handle empty changes array', () => {
    const currentState = createTestCase({
      pwd_determination_date: '2024-05-15',
      pwd_expiration_date: '2024-08-13',
    });

    const result = applyCascadeMultiple(currentState, []);

    expect(result).toEqual(currentState);
  });

  it('should apply cascades sequentially (order matters)', () => {
    const currentState = createTestCase();

    // First set notice start, then change it
    const result = applyCascadeMultiple(currentState, [
      { field: 'notice_of_filing_start_date', value: '2024-01-15' }, // End = 2024-01-29
      { field: 'notice_of_filing_start_date', value: '2024-01-20' }, // End = 2024-02-02 (extend-only)
    ]);

    expect(result.notice_of_filing_start_date).toBe('2024-01-20');
    expect(result.notice_of_filing_end_date).toBe('2024-02-02');
  });

  it('should handle complex multi-field cascade scenario', () => {
    const currentState = createTestCase();

    const result = applyCascadeMultiple(currentState, [
      { field: 'pwd_determination_date', value: '2024-05-15' },
      { field: 'eta9089_certification_date', value: '2024-08-01' },
      { field: 'rfi_received_date', value: '2024-09-15' },
      { field: 'notice_of_filing_start_date', value: '2024-01-15' },
      { field: 'job_order_start_date', value: '2024-01-20' },
    ]);

    // Verify all cascades applied
    expect(result.pwd_determination_date).toBe('2024-05-15');
    expect(result.pwd_expiration_date).toBe('2024-08-13');
    expect(result.eta9089_certification_date).toBe('2024-08-01');
    expect(result.eta9089_expiration_date).toBe('2025-01-28');
    expect(result.rfi_received_date).toBe('2024-09-15');
    expect(result.rfi_due_date).toBe('2024-10-15');
    expect(result.notice_of_filing_start_date).toBe('2024-01-15');
    expect(result.notice_of_filing_end_date).toBe('2024-01-29');
    expect(result.job_order_start_date).toBe('2024-01-20');
    expect(result.job_order_end_date).toBe('2024-02-19');
  });
});
