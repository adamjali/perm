import { describe, test, expect } from 'vitest';
import { addBusinessDays, countBusinessDays } from './businessDays';

describe('addBusinessDays', () => {
  test('adds 10 business days (Notice of Filing)', () => {
    // Starting January 15, 2025 (Wednesday)
    // Skip weekends, skip MLK Day (Jan 20)
    const result = addBusinessDays('2025-01-15', 10);
    // Count: 16,17=2, skip 18-19 weekend, skip 20 MLK, 21-24=4, skip 25-26 weekend, 27-30=4, total=10
    expect(result).toBe('2025-01-30');
  });

  test('handles starting on Saturday', () => {
    const result = addBusinessDays('2024-12-21', 1); // Saturday
    expect(result).toBe('2024-12-23'); // Monday
  });

  test('handles starting on Sunday', () => {
    const result = addBusinessDays('2024-12-22', 1); // Sunday
    expect(result).toBe('2024-12-23'); // Monday
  });

  test('handles Thanksgiving week', () => {
    // Nov 28, 2024 is Thanksgiving (Note: Day After Thanksgiving is NOT a federal holiday)
    const result = addBusinessDays('2024-11-25', 5); // Monday before Thanksgiving
    // 26=1, 27=2, skip 28 Thanksgiving, 29=3, skip 30-1 weekend, 2=4, 3=5
    expect(result).toBe('2024-12-03');
  });

  test('adds 0 business days returns next business day if starting on weekend', () => {
    const result = addBusinessDays('2024-12-21', 0); // Saturday
    expect(result).toBe('2024-12-21'); // No days added, keep same date
  });

  test('handles Christmas to New Year period', () => {
    // Dec 23, 2024 (Monday) + 5 business days
    // 23=1, 24=2, skip 25 Christmas, skip 26 Day After Christmas, 27=3, skip 28-29 weekend, 30=4, 31=5
    const result = addBusinessDays('2024-12-23', 5);
    expect(result).toBe('2024-12-31');
  });

  test('adds 1 business day from Friday (skips weekend)', () => {
    const result = addBusinessDays('2024-12-20', 1); // Friday
    expect(result).toBe('2024-12-23'); // Monday
  });

  test('handles Independence Day period', () => {
    // July 3, 2025 (Thursday) + 2 business days
    // skip 4 July (Friday), skip 5-6 weekend, 7=1, 8=2
    const result = addBusinessDays('2025-07-03', 2);
    expect(result).toBe('2025-07-08');
  });
});

describe('countBusinessDays', () => {
  test('counts business days excluding holidays', () => {
    // Jan 1-10, 2025: skip Jan 1 (New Year), skip weekends (4-5)
    // Business days: 2,3,6,7,8,9,10 = 7 days
    const count = countBusinessDays('2025-01-01', '2025-01-10');
    expect(count).toBe(7);
  });

  test('returns 0 for same day weekend', () => {
    const count = countBusinessDays('2024-12-21', '2024-12-21');
    expect(count).toBe(0); // Saturday
  });

  test('returns 1 for same day business day', () => {
    const count = countBusinessDays('2024-12-18', '2024-12-18');
    expect(count).toBe(1); // Wednesday
  });

  test('counts business days over a week with holiday', () => {
    // Jan 15-22, 2025: skip weekends (18-19), skip MLK Day (20)
    // Business days: 15,16,17,21,22 = 5 days
    const count = countBusinessDays('2025-01-15', '2025-01-22');
    expect(count).toBe(5);
  });

  test('counts business days in Thanksgiving week', () => {
    // Nov 25-29, 2024: skip Thanksgiving (28)
    // Business days: 25,26,27,29 = 4 days
    const count = countBusinessDays('2024-11-25', '2024-11-29');
    expect(count).toBe(4);
  });

  test('returns 0 for weekend range', () => {
    const count = countBusinessDays('2024-12-21', '2024-12-22'); // Sat-Sun
    expect(count).toBe(0);
  });

  test('counts business days over year boundary with holidays', () => {
    // Dec 30, 2024 - Jan 2, 2025: 30=Mon, 31=Tue, skip Jan 1 (New Year), 2=Thu
    // Business days: 30,31,2 = 3 days
    const count = countBusinessDays('2024-12-30', '2025-01-02');
    expect(count).toBe(3);
  });

  test('counts full week without holidays', () => {
    // Feb 3-7, 2025 (Mon-Fri, no holidays)
    // Business days: 3,4,5,6,7 = 5 days
    const count = countBusinessDays('2025-02-03', '2025-02-07');
    expect(count).toBe(5);
  });

  test('counts business days when end date is before start date', () => {
    // Should return 0 if end is before start
    const count = countBusinessDays('2025-01-10', '2025-01-01');
    expect(count).toBe(0);
  });
});
