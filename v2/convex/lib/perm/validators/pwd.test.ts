import { describe, it, expect } from 'vitest';
import { validatePWD } from './pwd';

describe('PWD Validators', () => {
  describe('V-PWD-01: PWD filing date must be before determination date', () => {
    it('should pass when filing date is before determination date', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-01-15',
        pwd_determination_date: '2026-02-15',
        pwd_expiration_date: '2026-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBe(0);
    });

    it('should fail when filing date is after determination date', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-02-20',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-PWD-01',
        severity: 'error',
        field: 'pwd_filing_date',
        message: expect.stringContaining('filing date must be before'),
      });
    });

    it('should fail when filing date equals determination date', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-02-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-PWD-01');
    });

    it('should skip validation when filing date is null', () => {
      const result = validatePWD({
        pwd_filing_date: null,
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when determination date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: null,
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-PWD-02: PWD determination date must be before expiration date', () => {
    it('should pass when determination date is before expiration date', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when determination date is after expiration date', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-07-15',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-PWD-02',
        severity: 'error',
        field: 'pwd_determination_date',
        message: expect.stringContaining('determination date must be before'),
      });
    });

    it('should fail when determination date equals expiration date', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-06-30',
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-PWD-02');
    });

    it('should skip validation when determination date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: null,
        pwd_expiration_date: '2024-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when expiration date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-PWD-03: Warning if expiration does not match calculated value', () => {
    it('should pass without warning when expiration matches calculated value (90-day case)', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-04-10',
        pwd_determination_date: '2026-05-15',
        pwd_expiration_date: '2026-08-13', // 90 days from May 15
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass without warning when expiration matches calculated value (June 30 same year)', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-01-10',
        pwd_determination_date: '2026-02-05',
        pwd_expiration_date: '2026-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass without warning when expiration matches calculated value (June 30 next year)', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-08-10',
        pwd_determination_date: '2026-09-10',
        pwd_expiration_date: '2027-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when expiration does not match calculated value', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-04-10',
        pwd_determination_date: '2026-05-15',
        pwd_expiration_date: '2026-06-30', // Should be 2026-08-13
      });

      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        ruleId: 'V-PWD-03',
        severity: 'warning',
        field: 'pwd_expiration_date',
        message: expect.stringContaining('2026-08-13'),
      });
    });

    it('should skip validation when determination date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2026-01-15',
        pwd_determination_date: null,
        pwd_expiration_date: '2026-06-30',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when expiration date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('V-PWD-04: Warning if PWD has expired', () => {
    it('should warn when PWD expiration date is in the past', () => {
      const result = validatePWD({
        pwd_filing_date: '2020-01-15',
        pwd_determination_date: '2020-02-15',
        pwd_expiration_date: '2020-06-30',
      });

      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.warnings.length).toBeGreaterThan(0);
      const expiredWarning = result.warnings.find((w) => w.ruleId === 'V-PWD-04');
      expect(expiredWarning).toBeDefined();
      expect(expiredWarning).toMatchObject({
        severity: 'warning',
        field: 'pwd_expiration_date',
        message: expect.stringContaining('expired'),
      });
    });

    it('should not warn when PWD expiration date is in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureExpiration = futureDate.toISOString().split('T')[0];

      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: futureExpiration,
      });

      const expiredWarning = result.warnings.find((w) => w.ruleId === 'V-PWD-04');
      expect(expiredWarning).toBeUndefined();
    });

    it('should not warn when PWD expiration date is today', () => {
      const today = new Date().toISOString().split('T')[0];

      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: today,
      });

      const expiredWarning = result.warnings.find((w) => w.ruleId === 'V-PWD-04');
      expect(expiredWarning).toBeUndefined();
    });

    it('should skip validation when expiration date is null', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-01-15',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: null,
      });

      const expiredWarning = result.warnings.find((w) => w.ruleId === 'V-PWD-04');
      expect(expiredWarning).toBeUndefined();
    });
  });

  describe('Combined validation scenarios', () => {
    it('should return multiple errors when multiple validations fail', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-03-01',
        pwd_determination_date: '2024-02-15',
        pwd_expiration_date: '2024-02-10',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      const errorIds = result.errors.map((e) => e.ruleId);
      expect(errorIds).toContain('V-PWD-01');
      expect(errorIds).toContain('V-PWD-02');
    });

    it('should return errors and warnings together', () => {
      const result = validatePWD({
        pwd_filing_date: '2024-03-01',
        pwd_determination_date: '2024-02-15', // Error: after filing
        pwd_expiration_date: '2020-06-30', // Warning: expired
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle all null dates gracefully', () => {
      const result = validatePWD({
        pwd_filing_date: null,
        pwd_determination_date: null,
        pwd_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
