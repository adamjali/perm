import { describe, it, expect } from 'vitest';
import { validateProfessionalMethods } from './recruitment';

describe('validateProfessionalMethods (V-PROF rules)', () => {
  const baseInput = {
    pwdDeterminationDate: '2024-01-15',
    pwdExpirationDate: '2025-01-15',
    firstRecruitmentDate: '2024-02-01',
  };

  describe('V-PROF-01: Date range start must be after PWDDD', () => {
    it('errors when startDate is before PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-01-10', // before PWDDD
          endDate: '2024-03-10',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(true);
    });

    it('passes when startDate is after PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-02-01',
          endDate: '2024-03-01',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(false);
    });
  });

  describe('V-PROF-02: Date range start cannot be after end date', () => {
    it('errors when startDate is after endDate', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'employer_website',
          date: '',
          startDate: '2024-04-01',
          endDate: '2024-03-01', // before start
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-02')).toBe(true);
    });
  });

  describe('V-PROF-03: Date range end must be before recruitment window close', () => {
    it('errors when endDate exceeds recruitment window', () => {
      // firstRecruitment=2024-02-01, window closes at +150 = 2024-06-30
      // pwdExpiration=2025-01-15, -30 = 2024-12-16
      // Effective max = 2024-06-30 (recruitment limit is earlier)
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'private_employment_firm',
          date: '',
          startDate: '2024-02-15',
          endDate: '2024-08-01', // beyond 150 days
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(true);
    });
  });

  describe('V-PROF-04: Date range end cannot be before start', () => {
    // Same as V-PROF-02 from opposite perspective, tests endDate field path
    it('flags endDate field when end is before start', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-05-01',
          endDate: '2024-04-01',
        }],
      });
      const endError = result.errors.find(e => e.ruleId === 'V-PROF-02' || e.ruleId === 'V-PROF-04');
      expect(endError).toBeDefined();
    });
  });

  describe('V-PROF-05: Sub-entries date must be within recruitment window', () => {
    it('errors when sub-entry date is before PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-01-10', description: 'Morning show spot' }, // before PWDDD
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(true);
    });

    it('passes when sub-entry dates are within window', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'tv_ad',
          date: '',
          subEntries: [
            { date: '2024-03-01', description: 'Prime time spot' },
            { date: '2024-03-15', description: 'Weekend spot' },
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(false);
    });

    it('errors when sub-entry date exceeds recruitment window', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-08-01', description: 'Late spot' }, // beyond window
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(true);
    });
  });

  describe('single-date methods are NOT validated by V-PROF', () => {
    it('does not run V-PROF rules for single-date methods', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_fair',
          date: '2024-03-01',
        }],
      });
      expect(result.errors.filter(e => e.ruleId.startsWith('V-PROF')).length).toBe(0);
    });
  });

  describe('boundary cases', () => {
    it('V-PROF-01: errors when startDate equals PWDDD (must be strictly after)', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-01-15', // same as PWDDD
          endDate: '2024-03-01',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(true);
    });

    it('V-PROF-03: passes when endDate equals max recruitment date', () => {
      // firstRecruitment=2024-02-01, +150 = 2024-06-30
      // pwdExpiration=2025-01-15, -30 = 2024-12-16
      // Effective max = 2024-06-30
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-02-15',
          endDate: '2024-06-30', // exactly on max
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(false);
    });

    it('V-PROF-05: errors when sub-entry date equals PWDDD (must be strictly after)', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-01-15', description: 'Same as PWDDD' },
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(true);
    });
  });

  describe('null context dates', () => {
    it('skips V-PROF-01 when pwdDeterminationDate is null', () => {
      const result = validateProfessionalMethods({
        pwdDeterminationDate: null,
        pwdExpirationDate: '2025-01-15',
        firstRecruitmentDate: '2024-02-01',
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-01-01', // would fail if PWDDD was set
          endDate: '2024-03-01',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(false);
    });

    it('skips V-PROF-03 when both firstRecruitmentDate and pwdExpirationDate are null', () => {
      const result = validateProfessionalMethods({
        pwdDeterminationDate: '2024-01-15',
        pwdExpirationDate: null,
        firstRecruitmentDate: null,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-02-01',
          endDate: '2099-12-31', // way in the future
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(false);
    });

    it('uses pwdExpirationDate for V-PROF-03 max when firstRecruitmentDate is null', () => {
      // With only 1 method, it's the "special" one → max = pwd (no 30-day buffer)
      // So endDate must be AFTER pwd to trigger V-PROF-03
      const result = validateProfessionalMethods({
        pwdDeterminationDate: '2024-01-15',
        pwdExpirationDate: '2024-06-01',
        firstRecruitmentDate: null,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-02-01',
          endDate: '2024-06-02', // after pwdExpiration (special method max = pwd itself)
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(true);
    });

    it('non-special method uses pwd-30 when firstRecruitmentDate is null', () => {
      // With 2 methods, the non-special one gets normal max = pwd - 30
      const result = validateProfessionalMethods({
        pwdDeterminationDate: '2024-01-15',
        pwdExpirationDate: '2024-06-01', // -30 = 2024-05-02
        firstRecruitmentDate: null,
        methods: [
          {
            method: 'job_website_ad',
            date: '',
            startDate: '2024-02-01',
            endDate: '2024-05-15', // after pwd-30 (May 2), non-special
          },
          {
            method: 'employer_website',
            date: '',
            startDate: '2024-02-01',
            endDate: '2024-05-20', // latest → special
          },
        ],
      });
      // First method (non-special) endDate (May 15) > normalMax (May 2) → error
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03' && e.field.includes('.0.'))).toBe(true);
    });

    it('skips V-PROF-05 when pwdDeterminationDate is null', () => {
      const result = validateProfessionalMethods({
        pwdDeterminationDate: null,
        pwdExpirationDate: '2025-01-15',
        firstRecruitmentDate: '2024-02-01',
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-01-01', description: 'Early spot' }, // would fail if PWDDD was set
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty methods array', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [],
      });
      expect(result.valid).toBe(true);
    });

    it('handles method with no dates at all', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{ method: 'job_website_ad', date: '' }],
      });
      expect(result.errors.filter(e => e.ruleId.startsWith('V-PROF')).length).toBe(0);
    });

    it('skips invalid sub-entry dates without crashing', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: 'not-a-date', description: 'invalid' },
            { date: '2024-03-01', description: 'valid' },
          ],
        }],
      });
      // Should not crash; valid entry should be checked
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05' && e.field.includes('subEntries.0'))).toBe(false);
    });
  });

  describe('per-method special logic (latest method gets relaxed deadline)', () => {
    it('latest date-range method (special) uses min(first+180, pwd) deadline', () => {
      // firstRecruitment=2024-02-01, +180 = 2024-07-30
      // pwdExpiration=2025-01-15, so pwd constraint is not limiting
      // Normal max = first+150 = 2024-06-30
      // Special max = first+180 = 2024-07-30
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [
          {
            method: 'job_website_ad', // date-range
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-06-15', // within normal window
          },
          {
            method: 'employer_website', // date-range
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-07-20', // latest → special, within 180
          },
        ],
      });
      // No V-PROF-03 errors: special method (Jul 20) within 180-day deadline
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(false);
    });

    it('non-special date-range method errors when exceeding normal 150-day window', () => {
      // Normal max = first+150 = 2024-06-30
      // Use date-range methods because V-PROF-03 only fires for date-range/sub-entry
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [
          {
            method: 'job_website_ad', // date-range
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-07-05', // index 0: Jul 5 > Jun 30, NOT special
          },
          {
            method: 'employer_website', // date-range
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-07-20', // index 1: latest → special
          },
        ],
      });
      // The non-special method (Jul 5) should trigger V-PROF-03
      const errors = result.errors.filter(e => e.ruleId === 'V-PROF-03' && e.field.includes('.0.'));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('special date-range method errors when exceeding 180-day window', () => {
      // firstRecruitment=2024-02-01, +180 = 2024-07-30
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [
          {
            method: 'job_website_ad',
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-04-01',
          },
          {
            method: 'employer_website',
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-08-15', // latest → special, but > 180 days
          },
        ],
      });
      // Special method should get V-PROF-03 error — exceeds extended deadline
      const errors = result.errors.filter(e => e.ruleId === 'V-PROF-03' && e.field.includes('.1.'));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('single date-range method is always special and gets relaxed deadline', () => {
      // Only 1 method → it is the "special" one
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [
          {
            method: 'employer_website',
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-07-20', // within 180 days (Jul 30)
          },
        ],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(false);
    });

    it('date-range special method uses endDate for comparison', () => {
      // endDate = 2024-07-25 is within special 180-day window
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [
          { method: 'job_fair', date: '2024-04-01' },
          {
            method: 'employer_website',
            date: '',
            startDate: '2024-03-01',
            endDate: '2024-07-25', // latest → special, within 180 days
          },
        ],
      });
      const endDateErrors = result.errors.filter(e => e.ruleId === 'V-PROF-03');
      expect(endDateErrors.length).toBe(0);
    });
  });
});
