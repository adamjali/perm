import { describe, it, expect } from 'vitest';
import { validateI140 } from './i140';

describe('validateI140', () => {
  describe('V-I140-01: I-140 filing must be after ETA 9089 certification', () => {
    it('should pass when I-140 filing is after ETA 9089 certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when I-140 filing is on the same day as ETA 9089 certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-11-15',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-01',
        severity: 'error',
        field: 'i140_filing_date',
      });
      expect(result.errors[0].message).toContain('after ETA 9089 certification');
    });

    it('should fail when I-140 filing is before ETA 9089 certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-11-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-I140-01');
    });

    it('should skip validation when ETA 9089 certification date is null', () => {
      const result = validateI140({
        eta9089_certification_date: null,
        i140_filing_date: '2026-12-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when I-140 filing date is null', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: null,
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-I140-02: I-140 filing must be within 180 days of ETA 9089 certification', () => {
    it('should pass when I-140 filing is exactly 180 days after certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2027-05-14', // 180 days later
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when I-140 filing is less than 180 days after certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-15', // 30 days later
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when I-140 filing is 1 day after certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-11-16', // 1 day later
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when I-140 filing is more than 180 days after certification', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2027-05-20', // 186 days later
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-02',
        severity: 'error',
        field: 'i140_filing_date',
      });
      expect(result.errors[0].message).toContain('within 180 days');
      expect(result.errors[0].message).toContain('186 days');
    });

    it('should fail when I-140 filing is significantly late', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2027-12-01', // 381 days later
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-I140-02');
      expect(result.errors[0].message).toContain('381 days');
    });

    it('should skip validation when ETA 9089 certification date is null', () => {
      const result = validateI140({
        eta9089_certification_date: null,
        i140_filing_date: '2027-12-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when I-140 filing date is null', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: null,
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-I140-03: I-140 approval must be after filing date', () => {
    it('should pass when approval is after filing', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01',
        i140_approval_date: '2027-02-15',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when approval is on the same day as filing', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01',
        i140_approval_date: '2026-12-01',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-03',
        severity: 'error',
        field: 'i140_approval_date',
      });
      expect(result.errors[0].message).toContain('after filing date');
    });

    it('should fail when approval is before filing', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01',
        i140_approval_date: '2026-11-20',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-I140-03');
    });

    it('should skip validation when filing date is null', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: null,
        i140_approval_date: '2027-02-15',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when approval date is null', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Date format validation', () => {
    it('should fail V-I140-01 with invalid certification date format', () => {
      const result = validateI140({
        eta9089_certification_date: 'invalid-date',
        i140_filing_date: '2026-12-01',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-01',
        severity: 'error',
        field: 'eta9089_certification_date',
      });
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should fail V-I140-01 with invalid filing date format', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: 'not-a-date',
        i140_approval_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-01',
        severity: 'error',
        field: 'i140_filing_date',
      });
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should fail V-I140-03 with invalid approval date format', () => {
      const result = validateI140({
        eta9089_certification_date: null,
        i140_filing_date: '2026-12-01',
        i140_approval_date: 'bad-date',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-I140-03',
        severity: 'error',
        field: 'i140_approval_date',
      });
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should not duplicate errors for invalid filing date when both V-I140-01 and V-I140-03 apply', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: 'invalid',
        i140_approval_date: '2027-01-01',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-I140-01');
      expect(result.errors[0].field).toBe('i140_filing_date');
    });
  });

  describe('Complex scenarios', () => {
    it('should report multiple errors when multiple rules fail', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2027-12-01', // Too late (381 days)
        i140_approval_date: '2027-11-01', // Before filing
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);

      const ruleIds = result.errors.map((e) => e.ruleId);
      expect(ruleIds).toContain('V-I140-02');
      expect(ruleIds).toContain('V-I140-03');
    });

    it('should handle all null dates gracefully', () => {
      const result = validateI140({
        eta9089_certification_date: null,
        i140_filing_date: null,
        i140_approval_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass when all dates are valid and in sequence', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-11-15',
        i140_filing_date: '2026-12-01', // 16 days after cert
        i140_approval_date: '2027-02-15', // 76 days after filing
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail V-I140-01 but pass V-I140-03 when filing is before certification but approval is after filing', () => {
      const result = validateI140({
        eta9089_certification_date: '2026-12-15',
        i140_filing_date: '2026-12-01', // Before certification (V-I140-01 fail)
        i140_approval_date: '2027-01-15', // After filing (V-I140-03 pass)
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-I140-01');
    });
  });
});
