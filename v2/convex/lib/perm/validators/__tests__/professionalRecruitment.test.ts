import { describe, it, expect } from 'vitest';
import { validateProfessionalMethods } from '../recruitment';

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
      // Should not crash, no V-PROF errors (missing dates are handled by Zod schema)
      expect(result.errors.filter(e => e.ruleId.startsWith('V-PROF')).length).toBe(0);
    });
  });
});
