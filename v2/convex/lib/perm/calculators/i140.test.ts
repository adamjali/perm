import { describe, it, expect } from 'vitest';
import { calculateI140FilingDeadline } from './i140';

describe('calculateI140FilingDeadline', () => {
  it('should calculate 180 days from certification date', () => {
    // Oct 1, 2024 + 180 days = Mar 30, 2025
    expect(calculateI140FilingDeadline('2024-10-01')).toBe('2025-03-30');
  });

  it('should handle dates that cross year boundaries', () => {
    // Jul 15, 2024 + 180 days = Jan 11, 2025
    expect(calculateI140FilingDeadline('2024-07-15')).toBe('2025-01-11');
  });

  it('should handle leap year considerations', () => {
    // Aug 31, 2024 + 180 days = Feb 27, 2025
    // 2024 is a leap year, but Feb 2025 is not
    expect(calculateI140FilingDeadline('2024-08-31')).toBe('2025-02-27');
  });

  it('should handle end of month dates', () => {
    // Jan 31, 2024 + 180 days = Jul 29, 2024
    expect(calculateI140FilingDeadline('2024-01-31')).toBe('2024-07-29');
  });

  it('should handle dates in leap year February', () => {
    // Feb 29, 2024 + 180 days = Aug 27, 2024
    expect(calculateI140FilingDeadline('2024-02-29')).toBe('2024-08-27');
  });

  it('should handle dates that span multiple months', () => {
    // Dec 1, 2024 + 180 days = May 30, 2025
    expect(calculateI140FilingDeadline('2024-12-01')).toBe('2025-05-30');
  });
});
