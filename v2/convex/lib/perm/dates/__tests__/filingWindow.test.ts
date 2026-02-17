/**
 * Tests for getMethodLatestDate and getLastRecruitmentDate.
 *
 * Phase 10 tests for new Phase 8 functions:
 * - getMethodLatestDate: extracts latest date from any method type
 * - getLastRecruitmentDate: excludes special (latest-dated) method from quiet period
 */

import { describe, it, expect } from 'vitest';
import { getMethodLatestDate, getLastRecruitmentDate } from '../filingWindow';

// ============================================================================
// getMethodLatestDate
// ============================================================================

describe('getMethodLatestDate', () => {
  describe('single-date methods', () => {
    it('returns the date field', () => {
      expect(getMethodLatestDate({ date: '2024-06-15' })).toBe('2024-06-15');
    });

    it('returns undefined for empty date', () => {
      expect(getMethodLatestDate({ date: '' })).toBeUndefined();
    });

    it('returns undefined for missing date', () => {
      expect(getMethodLatestDate({})).toBeUndefined();
    });
  });

  describe('date-range methods', () => {
    it('returns endDate when both dates present', () => {
      expect(getMethodLatestDate({
        startDate: '2024-03-01',
        endDate: '2024-06-15',
      })).toBe('2024-06-15');
    });

    it('falls back to startDate when no endDate', () => {
      expect(getMethodLatestDate({
        startDate: '2024-03-01',
      })).toBe('2024-03-01');
    });

    it('uses endDate even if date field is later', () => {
      // endDate takes precedence for date-range methods
      const result = getMethodLatestDate({
        date: '2024-09-01',
        startDate: '2024-03-01',
        endDate: '2024-06-15',
      });
      // Returns max of all candidates: endDate (Jun 15) and date (Sep 1)
      expect(result).toBe('2024-09-01');
    });
  });

  describe('sub-entries methods', () => {
    it('returns max of all sub-entry dates', () => {
      expect(getMethodLatestDate({
        subEntries: [
          { date: '2024-03-01' },
          { date: '2024-05-15' },
          { date: '2024-04-10' },
        ],
      })).toBe('2024-05-15');
    });

    it('ignores sub-entries with empty dates', () => {
      expect(getMethodLatestDate({
        subEntries: [
          { date: '' },
          { date: '2024-04-10' },
        ],
      })).toBe('2024-04-10');
    });

    it('returns undefined when all sub-entries have empty dates', () => {
      expect(getMethodLatestDate({
        subEntries: [
          { date: '' },
          { date: '' },
        ],
      })).toBeUndefined();
    });

    it('combines sub-entry dates with single date', () => {
      expect(getMethodLatestDate({
        date: '2024-06-01',
        subEntries: [
          { date: '2024-03-01' },
          { date: '2024-05-15' },
        ],
      })).toBe('2024-06-01');
    });
  });

  describe('mixed fields', () => {
    it('returns max across all date sources', () => {
      expect(getMethodLatestDate({
        date: '2024-02-01',
        startDate: '2024-01-15',
        endDate: '2024-07-20',
        subEntries: [{ date: '2024-05-01' }],
      })).toBe('2024-07-20');
    });
  });
});

// ============================================================================
// getLastRecruitmentDate — special method exclusion
// ============================================================================

describe('getLastRecruitmentDate', () => {
  const baseData = {
    sundayAdSecondDate: '2024-04-07',
    jobOrderEndDate: '2024-04-15',
    noticeOfFilingEndDate: '2024-04-01',
  };

  describe('non-professional cases', () => {
    it('returns latest of basic dates', () => {
      expect(getLastRecruitmentDate(baseData, false)).toBe('2024-04-15');
    });

    it('ignores additional methods for non-professional', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-08-01' }, // later but should be ignored
        ],
      };
      expect(getLastRecruitmentDate(data, false)).toBe('2024-04-15');
    });

    it('ignores additionalRecruitmentEndDate for non-professional', () => {
      const data = {
        ...baseData,
        additionalRecruitmentEndDate: '2024-08-01',
      };
      expect(getLastRecruitmentDate(data, false)).toBe('2024-04-15');
    });

    it('returns undefined when no dates provided', () => {
      expect(getLastRecruitmentDate({}, false)).toBeUndefined();
    });
  });

  describe('professional cases — special method exclusion', () => {
    it('excludes the latest additional method (1 method → excluded)', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-06-01' }, // only method → excluded as "special"
        ],
      };
      // Only basic dates count: max = Apr 15
      expect(getLastRecruitmentDate(data, true)).toBe('2024-04-15');
    });

    it('excludes latest of 2 methods, keeps earlier', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-05-01' }, // earlier → contributes
          { date: '2024-06-15' }, // latest → excluded
        ],
      };
      // Basic max = Apr 15, plus earlier method May 1 → max = May 1
      expect(getLastRecruitmentDate(data, true)).toBe('2024-05-01');
    });

    it('excludes latest of 3 methods, keeps 2 earlier', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-05-01' },
          { date: '2024-05-15' },
          { date: '2024-06-20' }, // latest → excluded
        ],
      };
      // Basic max = Apr 15, plus May 1 and May 15 → max = May 15
      expect(getLastRecruitmentDate(data, true)).toBe('2024-05-15');
    });

    it('handles tie — any tied method can be excluded', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-06-01' },
          { date: '2024-06-01' }, // same date as first
          { date: '2024-05-01' },
        ],
      };
      // Two methods at Jun 1 (one excluded), plus May 1
      // Remaining: Jun 1 (one of the tied) + May 1 → max = Jun 1
      expect(getLastRecruitmentDate(data, true)).toBe('2024-06-01');
    });

    it('legacy additionalRecruitmentEndDate is NOT eligible for special exclusion', () => {
      const data = {
        ...baseData,
        additionalRecruitmentEndDate: '2024-08-01', // legacy — always contributes
        additionalRecruitmentMethods: [
          { date: '2024-06-01' }, // only method → excluded as special
        ],
      };
      // Legacy Aug 1 always contributes + basic Apr 15 → max = Aug 1
      expect(getLastRecruitmentDate(data, true)).toBe('2024-08-01');
    });

    it('skips methods with no dates', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '' },  // no date → skipped
          { date: '2024-06-01' }, // only method with date → excluded
        ],
      };
      expect(getLastRecruitmentDate(data, true)).toBe('2024-04-15');
    });

    it('handles date-range method as latest', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-05-01' },
          { startDate: '2024-04-01', endDate: '2024-07-01' }, // endDate is latest → excluded
        ],
      };
      // May 1 contributes, basic Apr 15 → max = May 1
      expect(getLastRecruitmentDate(data, true)).toBe('2024-05-01');
    });

    it('handles sub-entries method as latest', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [
          { date: '2024-05-01' },
          {
            subEntries: [
              { date: '2024-06-01' },
              { date: '2024-07-15' }, // latest sub-entry → method latest is Jul 15
            ],
          },
        ],
      };
      // Sub-entries method (Jul 15) excluded, May 1 contributes → max = May 1
      expect(getLastRecruitmentDate(data, true)).toBe('2024-05-01');
    });

    it('0 additional methods → no exclusion, just basic dates', () => {
      const data = {
        ...baseData,
        additionalRecruitmentMethods: [],
      };
      expect(getLastRecruitmentDate(data, true)).toBe('2024-04-15');
    });
  });
});
