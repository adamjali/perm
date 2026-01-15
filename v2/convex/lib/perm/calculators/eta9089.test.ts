import { describe, it, expect } from 'vitest';
import {
  calculateETA9089Window,
  calculateETA9089Expiration,
  calculateRecruitmentEnd,
} from './eta9089';

describe('calculateETA9089Window', () => {
  it('should calculate window: opens 30 days after last recruitment, closes 180 days after first', () => {
    const firstRecruitment = new Date('2024-01-15');
    const lastRecruitment = new Date('2024-02-20');
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2024-03-21')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2024-07-13')); // firstRecruitment + 180 days
  });

  it('should handle same first and last recruitment dates', () => {
    const sameDate = new Date('2024-06-15');
    const result = calculateETA9089Window(sameDate, sameDate);

    expect(result.opens).toEqual(new Date('2024-07-15')); // +30 days
    expect(result.closes).toEqual(new Date('2024-12-12')); // +180 days
  });

  it('should handle recruitment spanning year boundary', () => {
    const firstRecruitment = new Date('2024-11-15');
    const lastRecruitment = new Date('2025-01-10');
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2025-02-09')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2025-05-14')); // firstRecruitment + 180 days
  });

  it('should handle leap year dates', () => {
    const firstRecruitment = new Date('2024-01-31');
    const lastRecruitment = new Date('2024-02-29');
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2024-03-30')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2024-07-29')); // firstRecruitment + 180 days
  });

  it('should calculate window from Jan 1', () => {
    const firstRecruitment = new Date('2024-01-01');
    const lastRecruitment = new Date('2024-01-31');
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2024-03-01')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2024-06-29')); // firstRecruitment + 180 days
  });

  it('should calculate window from Dec 31', () => {
    const firstRecruitment = new Date('2024-12-01');
    const lastRecruitment = new Date('2024-12-31');
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2025-01-30')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2025-05-30')); // firstRecruitment + 180 days
  });

  it('should handle typical PERM timeline (recruitment over 2-3 weeks)', () => {
    // Job order posted Jan 15, ends Feb 14 (30 days)
    // Sunday ads Jan 21 and Jan 28
    const firstRecruitment = new Date('2024-01-15'); // Job order start
    const lastRecruitment = new Date('2024-02-14'); // Job order end
    const result = calculateETA9089Window(firstRecruitment, lastRecruitment);

    expect(result.opens).toEqual(new Date('2024-03-15')); // lastRecruitment + 30 days
    expect(result.closes).toEqual(new Date('2024-07-13')); // firstRecruitment + 180 days
  });
});

describe('calculateETA9089Expiration', () => {
  it('should calculate expiration as certification + 180 days', () => {
    const certificationDate = new Date('2024-03-15');
    const result = calculateETA9089Expiration(certificationDate);

    expect(result).toEqual(new Date('2024-09-11')); // +180 days
  });

  it('should handle certification at year boundary', () => {
    const certificationDate = new Date('2024-12-01');
    const result = calculateETA9089Expiration(certificationDate);

    expect(result).toEqual(new Date('2025-05-30')); // +180 days
  });

  it('should handle leap year dates', () => {
    const certificationDate = new Date('2024-02-29');
    const result = calculateETA9089Expiration(certificationDate);

    expect(result).toEqual(new Date('2024-08-27')); // +180 days
  });

  it('should handle Jan 1 certification', () => {
    const certificationDate = new Date('2024-01-01');
    const result = calculateETA9089Expiration(certificationDate);

    expect(result).toEqual(new Date('2024-06-29')); // +180 days
  });

  it('should handle Dec 31 certification', () => {
    const certificationDate = new Date('2024-12-31');
    const result = calculateETA9089Expiration(certificationDate);

    expect(result).toEqual(new Date('2025-06-29')); // +180 days
  });
});

describe('calculateRecruitmentEnd', () => {
  it('should return later date when second Sunday ad is later', () => {
    const secondSundayAd = new Date('2024-06-16'); // Sunday
    const jobOrderEnd = new Date('2024-06-10');

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(result).toEqual(secondSundayAd);
  });

  it('should return later date when job order end is later', () => {
    const secondSundayAd = new Date('2024-06-09'); // Sunday
    const jobOrderEnd = new Date('2024-06-20');

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(result).toEqual(jobOrderEnd);
  });

  it('should handle same dates', () => {
    const sameDate = new Date('2024-06-15');

    const result = calculateRecruitmentEnd(sameDate, sameDate);
    expect(result).toEqual(sameDate);
  });

  it('should handle year boundary crossing', () => {
    const secondSundayAd = new Date('2024-12-29'); // Sunday
    const jobOrderEnd = new Date('2025-01-05');

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(result).toEqual(jobOrderEnd);
  });

  it('should return correct date when second Sunday is significantly earlier', () => {
    const secondSundayAd = new Date('2024-05-12'); // Sunday
    const jobOrderEnd = new Date('2024-06-30');

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(result).toEqual(jobOrderEnd);
  });

  it('should return correct date when job order is significantly earlier', () => {
    const secondSundayAd = new Date('2024-06-30'); // Sunday
    const jobOrderEnd = new Date('2024-05-15');

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(result).toEqual(secondSundayAd);
  });

  it('should include additional recruitment dates when provided', () => {
    const secondSundayAd = new Date('2024-06-09');
    const jobOrderEnd = new Date('2024-06-15');
    const additionalDates = [
      new Date('2024-06-20'),
      new Date('2024-06-25'),
    ];

    const result = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd, additionalDates);
    expect(result).toEqual(new Date('2024-06-25'));
  });
});

describe('Integration: Full ETA 9089 workflow', () => {
  it('should calculate complete timeline from recruitment to I-140 deadline', () => {
    // Scenario: First recruitment Jan 15, last recruitment ends Feb 20
    const firstRecruitment = new Date('2024-01-15');
    const lastRecruitment = new Date('2024-02-20');

    // Calculate filing window
    const window = calculateETA9089Window(firstRecruitment, lastRecruitment);
    expect(window.opens).toEqual(new Date('2024-03-21')); // lastRecruitment + 30 days
    expect(window.closes).toEqual(new Date('2024-07-13')); // firstRecruitment + 180 days

    // Assume filed within window, certified on May 15
    const certificationDate = new Date('2024-05-15');
    const i140Deadline = calculateETA9089Expiration(certificationDate);

    expect(i140Deadline).toEqual(new Date('2024-11-11')); // +180 days
  });

  it('should handle case where job order ends after second Sunday ad', () => {
    const firstSundayAd = new Date('2024-05-05'); // First recruitment step
    const secondSundayAd = new Date('2024-05-19'); // Sunday
    const jobOrderEnd = new Date('2024-06-10'); // 30 days after job order start

    const recruitmentEnd = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(recruitmentEnd).toEqual(jobOrderEnd);

    const window = calculateETA9089Window(firstSundayAd, recruitmentEnd);
    expect(window.opens).toEqual(new Date('2024-07-10')); // recruitmentEnd + 30 days
    expect(window.closes).toEqual(new Date('2024-11-01')); // firstSundayAd + 180 days
  });

  it('should handle case where second Sunday ad is after job order end', () => {
    const firstSundayAd = new Date('2024-06-02'); // First recruitment step
    const secondSundayAd = new Date('2024-06-23'); // Sunday - after job order
    const jobOrderEnd = new Date('2024-06-15');

    const recruitmentEnd = calculateRecruitmentEnd(secondSundayAd, jobOrderEnd);
    expect(recruitmentEnd).toEqual(secondSundayAd);

    const window = calculateETA9089Window(firstSundayAd, recruitmentEnd);
    expect(window.opens).toEqual(new Date('2024-07-23')); // recruitmentEnd + 30 days
    expect(window.closes).toEqual(new Date('2024-11-29')); // firstSundayAd + 180 days
  });

  it('should demonstrate window can close before it opens with late recruitment', () => {
    // This is an invalid scenario that should be flagged by validation
    // First recruitment Jan 1, last recruitment ends Aug 1 (7 months later)
    const firstRecruitment = new Date('2024-01-01');
    const lastRecruitment = new Date('2024-08-01');

    const window = calculateETA9089Window(firstRecruitment, lastRecruitment);
    // Opens: Aug 1 + 30 = Aug 31
    expect(window.opens).toEqual(new Date('2024-08-31'));
    // Closes: Jan 1 + 180 = Jun 29 (BEFORE opens!)
    expect(window.closes).toEqual(new Date('2024-06-29'));

    // This shows an invalid window - closes before opens
    // Callers should check this and handle appropriately
    expect(window.closes < window.opens).toBe(true);
  });
});
