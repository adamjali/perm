import { describe, it, expect } from 'vitest';
import {
  calculateRecruitmentDeadlines,
  lastSundayOnOrBefore,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
} from './recruitment';

describe('lastSundayOnOrBefore', () => {
  it('should return same date if Sunday', () => {
    const result = lastSundayOnOrBefore('2024-01-14'); // Sunday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Monday', () => {
    const result = lastSundayOnOrBefore('2024-01-15'); // Monday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Tuesday', () => {
    const result = lastSundayOnOrBefore('2024-01-16'); // Tuesday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Wednesday', () => {
    const result = lastSundayOnOrBefore('2024-01-17'); // Wednesday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Thursday', () => {
    const result = lastSundayOnOrBefore('2024-01-18'); // Thursday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Friday', () => {
    const result = lastSundayOnOrBefore('2024-01-19'); // Friday
    expect(result).toBe('2024-01-14');
  });

  it('should return previous Sunday if Saturday', () => {
    const result = lastSundayOnOrBefore('2024-01-20'); // Saturday
    expect(result).toBe('2024-01-14');
  });
});

describe('calculateNoticeOfFilingEnd', () => {
  it('should add 10 business days (no holidays)', () => {
    // Jan 2, 2024 (Tue) + 10 business days = Jan 17, 2024 (Wed)
    // Skips: Jan 6-7 (weekend), Jan 13-14 (weekend), Jan 15 (MLK Day)
    const result = calculateNoticeOfFilingEnd('2024-01-02');
    expect(result).toBe('2024-01-17');
  });

  it('should skip MLK Day (Jan 20)', () => {
    // Jan 15, 2024 (Mon) + 10 business days
    // Skips: Jan 20-21 (weekend), Jan 20 (MLK Day - Saturday)
    // Actually MLK Day 2024 is Monday Jan 15, so starting on Jan 15:
    // Let me recalculate: Jan 16, 2024 (Tue) + 10 business days
    const result = calculateNoticeOfFilingEnd('2024-01-16');
    expect(result).toBe('2024-01-30');
  });

  it('should skip New Year holiday', () => {
    // Dec 26, 2024 (Thu) + 10 business days
    // Skips: Dec 28-29 (weekend), Jan 1 (New Year)
    const result = calculateNoticeOfFilingEnd('2024-12-26');
    expect(result).toBe('2025-01-10');
  });
});

describe('calculateJobOrderEnd', () => {
  it('should add 30 calendar days', () => {
    const result = calculateJobOrderEnd('2024-01-15');
    expect(result).toBe('2024-02-14');
  });

  it('should handle month transitions', () => {
    const result = calculateJobOrderEnd('2024-03-15');
    expect(result).toBe('2024-04-14');
  });

  it('should handle year transitions', () => {
    const result = calculateJobOrderEnd('2024-12-15');
    expect(result).toBe('2025-01-14');
  });

  it('should handle leap years', () => {
    // Jan 15 + 30 days crosses Feb 29
    const result = calculateJobOrderEnd('2024-01-31');
    expect(result).toBe('2024-03-01');
  });
});

describe('calculateRecruitmentDeadlines', () => {
  describe('Basic case: First recruitment far from PWD expiration', () => {
    it('should calculate all deadlines driven by first recruitment date', () => {
      // First: Jan 15, 2024, PWD expires: Dec 31, 2024 (11.5 months away)
      // All deadlines driven by first recruitment + N days
      const result = calculateRecruitmentDeadlines(
        '2024-01-15',
        '2024-12-31'
      );

      // notice_of_filing_deadline: min(Jan 15 + 150, Dec 31 - 30) = min(Jun 13, Dec 1) = Jun 13
      expect(result.notice_of_filing_deadline).toBe('2024-06-13');

      // job_order_start_deadline: min(Jan 15 + 120, Dec 31 - 60) = min(May 14, Nov 1) = May 14
      expect(result.job_order_start_deadline).toBe('2024-05-14');

      // second_sunday_ad_deadline: lastSunday(Jun 13) = Jun 9 (Thu → Sun)
      expect(result.second_sunday_ad_deadline).toBe('2024-06-09');

      // first_sunday_ad_deadline: lastSunday(Jan 15 + 143) = lastSunday(Jun 6) = Jun 2 (Thu → Sun)
      expect(result.first_sunday_ad_deadline).toBe('2024-06-02');

      // recruitment_window_closes: same as notice_of_filing_deadline
      expect(result.recruitment_window_closes).toBe('2024-06-13');
    });
  });

  describe('Tight timeline: PWD expiration drives deadlines', () => {
    it('should calculate deadlines constrained by PWD expiration', () => {
      // First: Mar 1, 2024, PWD expires: Apr 30, 2024 (60 days away)
      const result = calculateRecruitmentDeadlines('2024-03-01', '2024-04-30');

      // notice_of_filing_deadline: min(Mar 1 + 150, Apr 30 - 30) = min(Jul 29, Mar 31) = Mar 31
      expect(result.notice_of_filing_deadline).toBe('2024-03-31');

      // job_order_start_deadline: min(Mar 1 + 120, Apr 30 - 60) = min(Jun 29, Mar 1) = Mar 1
      expect(result.job_order_start_deadline).toBe('2024-03-01');

      // second_sunday_ad_deadline: lastSunday(Mar 31) = Mar 31 (Sun)
      expect(result.second_sunday_ad_deadline).toBe('2024-03-31');

      // first_sunday_ad_deadline: lastSunday(Mar 1 + 143) = lastSunday(Jul 22) = Jul 21 (Mon → Sun)
      // But constrained by PWD: min(Mar 1 + 143, Apr 30 - 37) = min(Jul 22, Mar 24) = Mar 24 (Sun)
      expect(result.first_sunday_ad_deadline).toBe('2024-03-24');
    });
  });

  describe('Edge cases', () => {
    it('should handle case where first recruitment is already past job order deadline', () => {
      // First: Feb 1, PWD expires: Mar 15 (43 days away)
      const result = calculateRecruitmentDeadlines('2024-02-01', '2024-03-15');

      // job_order_start_deadline: min(Feb 1 + 120, Mar 15 - 60) = min(May 31, Jan 15) = Jan 15
      // This is BEFORE first recruitment! Deadline already passed.
      expect(result.job_order_start_deadline).toBe('2024-01-15');
    });

    it('should handle leap year dates', () => {
      // First: Feb 29, 2024 (leap day)
      const result = calculateRecruitmentDeadlines('2024-02-29', '2024-12-31');

      // notice_of_filing_deadline: Feb 29 + 150 = Jul 28
      expect(result.notice_of_filing_deadline).toBe('2024-07-28');
    });

    it('should handle year transitions', () => {
      // First: Nov 1, 2024, PWD expires: Jun 30, 2025
      const result = calculateRecruitmentDeadlines('2024-11-01', '2025-06-30');

      // notice_of_filing_deadline: min(Nov 1 + 150, Jun 30 - 30) = min(Mar 31, May 31) = Mar 31
      expect(result.notice_of_filing_deadline).toBe('2025-03-31');
    });
  });

  describe('Sunday boundary cases', () => {
    it('should handle notice deadline that falls on Sunday', () => {
      // Engineer a case where notice deadline IS a Sunday
      // Jun 9, 2024 is Sunday
      // Work backwards: Jun 9 - 150 = Jan 11, 2024 (Thu)
      const result = calculateRecruitmentDeadlines('2024-01-11', '2024-12-31');

      // notice_of_filing_deadline: Jan 11 + 150 = Jun 9 (Sun)
      expect(result.notice_of_filing_deadline).toBe('2024-06-09');

      // second_sunday_ad_deadline: lastSunday(Jun 9) = Jun 9 (already Sunday)
      expect(result.second_sunday_ad_deadline).toBe('2024-06-09');
    });

    it('should handle first Sunday deadline that falls on Sunday', () => {
      // Jun 2, 2024 is Sunday
      // Work backwards: Jun 2 - 143 = Jan 11, 2024 (Thu)
      const result = calculateRecruitmentDeadlines('2024-01-11', '2024-12-31');

      // first_sunday_ad_deadline: lastSunday(Jan 11 + 143) = lastSunday(Jun 2) = Jun 2 (Sun)
      expect(result.first_sunday_ad_deadline).toBe('2024-06-02');
    });
  });
});
