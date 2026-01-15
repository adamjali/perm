import { describe, it, expect } from 'vitest';
import { validateRecruitment } from './recruitment';

describe('Recruitment Validators', () => {
  describe('V-REC-01: First Sunday ad must be on a Sunday', () => {
    it('should pass when first Sunday ad is on a Sunday', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14', // Sunday
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when first Sunday ad is not on a Sunday (Monday)', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-15', // Monday
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-01',
        severity: 'error',
        field: 'sunday_ad_first_date',
        message: expect.stringContaining('Sunday'),
      });
    });

    it('should fail when first Sunday ad is not on a Sunday (Saturday)', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-13', // Saturday
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleId).toBe('V-REC-01');
    });

    it('should skip validation when first Sunday ad date is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: null,
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-REC-02: Second Sunday ad must be on a Sunday', () => {
    it('should pass when second Sunday ad is on a Sunday', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21', // Sunday
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when second Sunday ad is not on a Sunday', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-22', // Monday
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-02',
        severity: 'error',
        field: 'sunday_ad_second_date',
        message: expect.stringContaining('Sunday'),
      });
    });

    it('should skip validation when second Sunday ad date is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: null,
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-REC-03: Second Sunday ad must be after first', () => {
    it('should pass when second Sunday ad is after first', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when second Sunday ad is before first', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-21',
        sunday_ad_second_date: '2024-01-14',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-03',
        severity: 'error',
        field: 'sunday_ad_second_date',
        message: expect.stringContaining('after'),
      });
    });

    it('should fail when second Sunday ad equals first', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-21',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleId).toBe('V-REC-03');
    });

    it('should skip validation when either date is null', () => {
      const result1 = validateRecruitment({
        sunday_ad_first_date: null,
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      const result2 = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: null,
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe('V-REC-04: Job order end must be after start', () => {
    it('should pass when job order end is after start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when job order end is before start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-02-14',
        job_order_end_date: '2024-01-15',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      // Will also trigger V-REC-05 (< 30 days) since end is before start (negative days)
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const error = result.errors.find((e) => e.ruleId === 'V-REC-04');
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        field: 'job_order_end_date',
        message: expect.stringContaining('after'),
      });
    });

    it('should fail when job order end equals start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-01-15',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleId).toBe('V-REC-04');
    });

    it('should skip validation when either date is null', () => {
      const result1 = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: null,
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      const result2 = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: null,
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe('V-REC-05: Job order must be at least 30 days', () => {
    it('should pass when job order is exactly 30 days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14', // 30 days from start
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when job order is more than 30 days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-03-15', // 60 days
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when job order is less than 30 days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-10', // 26 days
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-05',
        severity: 'error',
        field: 'job_order_end_date',
        message: expect.stringContaining('30'),
      });
    });

    it('should skip validation when either date is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: null,
        job_order_end_date: null,
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-REC-06: Notice end must be after start', () => {
    it('should pass when notice end is after start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when notice end is before start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-29',
        notice_of_filing_end_date: '2024-01-15',
      });

      expect(result.valid).toBe(false);
      // Will also trigger V-REC-07 (< 10 business days) since end is before start
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const error = result.errors.find((e) => e.ruleId === 'V-REC-06');
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: expect.stringContaining('after'),
      });
    });

    it('should fail when notice end equals start', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-15',
      });

      expect(result.valid).toBe(false);
      // Will have both V-REC-06 (end must be after start) and V-REC-07 (< 10 business days)
      const errorIds = result.errors.map((e) => e.ruleId);
      expect(errorIds).toContain('V-REC-06');
    });

    it('should skip validation when either date is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-REC-07: Notice must be at least 10 business days', () => {
    it('should pass when notice is exactly 10 business days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15', // Monday
        notice_of_filing_end_date: '2024-01-29', // 10 business days later
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when notice is more than 10 business days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-02-05', // 15 business days
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when notice is less than 10 business days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-26', // Only 9 business days
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-07',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: expect.stringContaining('10 business days'),
      });
    });

    it('should skip validation when either date is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-REC-08: If notice start provided, notice end required', () => {
    it('should pass when both notice start and end are provided', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when both notice dates are null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when notice start is provided but notice end is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-08',
        severity: 'error',
        field: 'notice_of_filing_end_date',
        message: expect.stringContaining('required'),
      });
    });
  });

  describe('V-REC-09: If notice end provided, notice start required', () => {
    it('should pass when both notice dates are provided', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when notice end is provided but notice start is null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: '2024-01-29',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        ruleId: 'V-REC-09',
        severity: 'error',
        field: 'notice_of_filing_start_date',
        message: expect.stringContaining('required'),
      });
    });
  });

  describe('V-REC-10: Warning if notice period less than 10 business days but > 0', () => {
    it('should not warn when notice period is 10+ business days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-29', // 10 business days
      });

      const warning = result.warnings.find((w) => w.ruleId === 'V-REC-10');
      expect(warning).toBeUndefined();
    });

    it('should warn when notice period is positive but less than 10 business days', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: '2024-01-19', // Only 4 business days
      });

      // This will be invalid because V-REC-07 triggers an error for < 10 business days
      expect(result.valid).toBe(false);
      // But V-REC-10 warning should also be present
      const warning = result.warnings.find((w) => w.ruleId === 'V-REC-10');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        field: 'notice_of_filing_end_date',
        message: expect.stringContaining('business days'),
      });
    });

    it('should not warn when dates are null', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-14',
        sunday_ad_second_date: '2024-01-21',
        job_order_start_date: '2024-01-15',
        job_order_end_date: '2024-02-14',
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: null,
      });

      const warning = result.warnings.find((w) => w.ruleId === 'V-REC-10');
      expect(warning).toBeUndefined();
    });
  });

  describe('Combined validation scenarios', () => {
    it('should return multiple errors when multiple validations fail', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: '2024-01-15', // Monday (error)
        sunday_ad_second_date: '2024-01-14', // Before first (error)
        job_order_start_date: '2024-02-14',
        job_order_end_date: '2024-01-15', // Before start (error)
        notice_of_filing_start_date: '2024-01-15',
        notice_of_filing_end_date: null, // Missing end (error)
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle all null dates gracefully', () => {
      const result = validateRecruitment({
        sunday_ad_first_date: null,
        sunday_ad_second_date: null,
        job_order_start_date: null,
        job_order_end_date: null,
        notice_of_filing_start_date: null,
        notice_of_filing_end_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
