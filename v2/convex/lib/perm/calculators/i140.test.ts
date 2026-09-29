import { describe, it, expect } from 'vitest';
import { calculateI140FilingDeadline } from './i140';
import { ETA9089_EXPIRATION_DAYS, I140_FILING_DAYS } from '../constants';

// The last day to file is the certification date + 179 days: the date DOL
// prints (180 calendar days counting the certification day as day 1). The
// owner chose it on Sep 29 2026; +180 had put the app a day after DOL.
describe('calculateI140FilingDeadline', () => {
  it('is 179 days after certification, and the constants agree', () => {
    expect(ETA9089_EXPIRATION_DAYS).toBe(179);
    expect(I140_FILING_DAYS).toBe(179);
    // Oct 1, 2024 + 179 days = Mar 29, 2025
    expect(calculateI140FilingDeadline('2024-10-01')).toBe('2025-03-29');
  });

  it('should handle dates that cross year boundaries', () => {
    // Jul 15, 2024 + 179 days = Jan 10, 2025
    expect(calculateI140FilingDeadline('2024-07-15')).toBe('2025-01-10');
  });

  it('should handle leap year considerations', () => {
    // Aug 31, 2024 + 179 days = Feb 26, 2025 (2024 is a leap year, Feb 2025 is not)
    expect(calculateI140FilingDeadline('2024-08-31')).toBe('2025-02-26');
  });

  it('should handle end of month dates', () => {
    // Jan 31, 2024 + 179 days = Jul 28, 2024
    expect(calculateI140FilingDeadline('2024-01-31')).toBe('2024-07-28');
  });

  it('should handle dates in leap year February', () => {
    // Feb 29, 2024 + 179 days = Aug 26, 2024
    expect(calculateI140FilingDeadline('2024-02-29')).toBe('2024-08-26');
  });

  it('should handle dates that span multiple months', () => {
    // Dec 1, 2024 + 179 days = May 29, 2025
    expect(calculateI140FilingDeadline('2024-12-01')).toBe('2025-05-29');
  });
});
