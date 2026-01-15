import { describe, it, expect } from 'vitest';
import { validateETA9089 } from './eta9089';

describe('validateETA9089', () => {
  describe('V-ETA-01: ETA 9089 filing must be at least 30 days after recruitment ends', () => {
    it('should pass when filing is exactly 30 days after recruitment end', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-07-15', // 30 days later
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when filing is more than 30 days after recruitment end', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-08-20', // 66 days later
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when filing is less than 30 days after recruitment end', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-07-10', // 25 days later
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-ETA-01',
        severity: 'error',
        field: 'eta9089_filing_date',
      });
      expect(result.errors[0].message).toContain('at least 30 days');
      expect(result.errors[0].message).toContain('25 days');
    });

    it('should fail when filing is on the same day as recruitment end', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-06-15', // Same day
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-ETA-01');
    });

    it('should skip validation when recruitment end date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: null,
        eta9089_filing_date: '2026-07-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when ETA 9089 filing date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: null,
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-ETA-02: ETA 9089 filing must be within 180 days after recruitment starts', () => {
    // NOTE: Filing window CLOSES 180 days after FIRST recruitment (start), not last (end)
    // This aligns with perm_flow.md: "Filing window CLOSES: 180 days after FIRST recruitment"

    it('should pass when filing is exactly 180 days after recruitment start', () => {
      // Jan 15 + 180 days = Jul 14
      // recruitment_end must be at least 30 days before filing: Jul 14 - 30 = Jun 14
      const result = validateETA9089({
        recruitment_start_date: '2026-01-15', // First recruitment
        recruitment_end_date: '2026-06-14',   // Last recruitment (30 days before filing)
        eta9089_filing_date: '2026-07-14',    // 180 days after start
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when filing is less than 180 days after recruitment start', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-01-15', // First recruitment
        recruitment_end_date: '2026-02-20',   // Last recruitment
        eta9089_filing_date: '2026-03-25',    // ~69 days after start
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when filing is more than 180 days after recruitment start', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-01-15', // First recruitment
        recruitment_end_date: '2026-06-15',   // Last recruitment
        eta9089_filing_date: '2026-07-20',    // 186 days after start - too late!
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-ETA-02',
        severity: 'error',
        field: 'eta9089_filing_date',
      });
      expect(result.errors[0].message).toContain('within 180 days');
      expect(result.errors[0].message).toContain('186 days');
      expect(result.errors[0].message).toContain('after recruitment starts');
    });

    it('should skip validation when recruitment start date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: null,
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-12-20',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle case where end is 30+ days before start+180 (normal case)', () => {
      // Typical case: recruitment starts Jan 15, ends Feb 15
      // Window opens: Feb 15 + 30 = Mar 17
      // Window closes: Jan 15 + 180 = Jul 14
      const result = validateETA9089({
        recruitment_start_date: '2026-01-15',
        recruitment_end_date: '2026-02-15',
        eta9089_filing_date: '2026-04-01', // Within window (45 days after end, ~76 days after start)
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-ETA-03: ETA 9089 filing must be before PWD expiration date', () => {
    it('should pass when filing is before PWD expiration', () => {
      // Filing Sep 30 must be within 180 days of start: Sep 30 - 180 = Apr 3
      // recruitment_end must be at most 30 days before filing: Sep 30 - 30 = Aug 31
      const result = validateETA9089({
        recruitment_start_date: '2026-04-03',
        recruitment_end_date: '2026-08-31',
        eta9089_filing_date: '2026-09-30',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when filing is on PWD expiration date', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-01-01',
        recruitment_end_date: '2026-01-15',
        eta9089_filing_date: '2027-06-30',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      const v_eta_03_errors = result.errors.filter((e) => e.ruleId === 'V-ETA-03');
      expect(v_eta_03_errors).toHaveLength(1);
      expect(v_eta_03_errors[0]).toMatchObject({
        ruleId: 'V-ETA-03',
        severity: 'error',
        field: 'eta9089_filing_date',
      });
      expect(v_eta_03_errors[0].message).toContain('before PWD expiration');
    });

    it('should fail when filing is after PWD expiration', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-01-01',
        recruitment_end_date: '2026-01-15',
        eta9089_filing_date: '2027-07-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      const v_eta_03_errors = result.errors.filter((e) => e.ruleId === 'V-ETA-03');
      expect(v_eta_03_errors).toHaveLength(1);
      expect(v_eta_03_errors[0].ruleId).toBe('V-ETA-03');
    });

    it('should skip validation when PWD expiration date is null', () => {
      // Filing Aug 15 within 180 days of start (Apr 1 + 180 = Sep 28)
      // End Jul 15 is 31 days before filing
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15', // Within 30-180 day window (136 days from start)
        pwd_expiration_date: null,
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when ETA 9089 filing date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: null,
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-ETA-04: ETA 9089 certification must be after filing date', () => {
    it('should pass when certification is after filing', () => {
      // Filing Aug 15 within 180 days of start (Apr 1 + 180 = Sep 28)
      // End Jul 15 is 31 days before filing
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-11-15',
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when certification is on the same day as filing', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-08-15',
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-ETA-04',
        severity: 'error',
        field: 'eta9089_certification_date',
      });
      expect(result.errors[0].message).toContain('after filing date');
    });

    it('should fail when certification is before filing', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-08-01',
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-ETA-04');
    });

    it('should skip validation when filing date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: null,
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-11-15',
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation when certification date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-ETA-05: Warning if expiration does not match calculated value', () => {
    it('should pass when expiration matches calculated value (180 days after certification)', () => {
      // Filing Aug 15 within 180 days of start (Apr 1 + 180 = Sep 28)
      // End Jul 15 is 31 days before filing
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-11-15',
        eta9089_expiration_date: '2027-05-14', // 180 days after 2026-11-15
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when expiration does not match calculated value', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-11-15',
        eta9089_expiration_date: '2027-06-01', // Wrong date (should be 2027-05-14)
      });

      expect(result.valid).toBe(true); // Warnings don't affect validity
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        ruleId: 'V-ETA-05',
        severity: 'warning',
        field: 'eta9089_expiration_date',
      });
      expect(result.warnings[0].message).toContain('2027-05-14');
      expect(result.warnings[0].message).toContain('2027-06-01');
    });

    it('should skip validation when certification date is null', () => {
      // Filing Aug 15 within 180 days of start (Apr 1 + 180 = Sep 28)
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: null,
        eta9089_expiration_date: '2027-06-01',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when expiration date is null', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-07-15',
        eta9089_filing_date: '2026-08-15',
        pwd_expiration_date: '2027-06-30',
        eta9089_certification_date: '2026-11-15',
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Complex scenarios', () => {
    it('should report multiple errors when multiple rules fail', () => {
      const result = validateETA9089({
        recruitment_start_date: '2026-04-01',
        recruitment_end_date: '2026-06-15',
        eta9089_filing_date: '2026-07-01', // Too soon (16 days, needs 30)
        pwd_expiration_date: '2026-12-31',
        eta9089_certification_date: '2026-06-15', // Before filing
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);

      const ruleIds = result.errors.map((e) => e.ruleId);
      expect(ruleIds).toContain('V-ETA-01');
      expect(ruleIds).toContain('V-ETA-04');
    });

    it('should handle all null dates gracefully', () => {
      const result = validateETA9089({
        recruitment_start_date: null,
        recruitment_end_date: null,
        eta9089_filing_date: null,
        pwd_expiration_date: null,
        eta9089_certification_date: null,
        eta9089_expiration_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
