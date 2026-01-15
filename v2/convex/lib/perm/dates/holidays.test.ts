import { describe, test, expect } from 'vitest';
import {
  getFederalHolidays,
  isFederalHoliday,
  isBusinessDay,
} from './holidays';

describe('getFederalHolidays', () => {
  test('returns 11 holidays for non-inauguration year', () => {
    const holidays = getFederalHolidays(2024);
    expect(holidays.length).toBe(11);
  });

  test('returns 12 holidays for inauguration year', () => {
    const holidays = getFederalHolidays(2025);
    expect(holidays.length).toBe(12);
  });

  test('MLK Day 2025 is January 20', () => {
    const holidays = getFederalHolidays(2025);
    const mlk = holidays.find((h) => h.name === 'MLK Day');
    expect(mlk?.date).toBe('2025-01-20');
  });

  test('both MLK Day and Inauguration Day fall on Jan 20, 2025', () => {
    const holidays = getFederalHolidays(2025);
    const jan20Holidays = holidays.filter((h) => h.date === '2025-01-20');
    expect(jan20Holidays.length).toBe(2);
    const names = jan20Holidays.map((h) => h.name).sort();
    expect(names).toEqual(['Inauguration Day', 'MLK Day']);
  });

  test('Independence Day 2026 shifts from Saturday to Friday', () => {
    // July 4, 2026 is Saturday
    const holidays = getFederalHolidays(2026);
    const july4 = holidays.find((h) => h.name === 'Independence Day');
    expect(july4?.date).toBe('2026-07-03'); // Friday
  });

  test('Christmas 2027 shifts from Saturday to Friday', () => {
    // Dec 25, 2027 is Saturday
    const holidays = getFederalHolidays(2027);
    const christmas = holidays.find((h) => h.name === 'Christmas');
    expect(christmas?.date).toBe('2027-12-24'); // Friday
  });

  test('New Year 2023 shifts from Sunday to Monday', () => {
    // Jan 1, 2023 is Sunday
    const holidays = getFederalHolidays(2023);
    const newYear = holidays.find((h) => h.name === 'New Year');
    expect(newYear?.date).toBe('2023-01-02'); // Monday
  });

  test('Memorial Day 2024 is last Monday of May', () => {
    const holidays = getFederalHolidays(2024);
    const memorial = holidays.find((h) => h.name === 'Memorial Day');
    expect(memorial?.date).toBe('2024-05-27');
  });

  test('Thanksgiving 2024 is fourth Thursday of November', () => {
    const holidays = getFederalHolidays(2024);
    const thanksgiving = holidays.find((h) => h.name === 'Thanksgiving');
    expect(thanksgiving?.date).toBe('2024-11-28');
  });

  test('no Inauguration Day in 2024', () => {
    const holidays = getFederalHolidays(2024);
    const inauguration = holidays.find((h) => h.name === 'Inauguration Day');
    expect(inauguration).toBeUndefined();
  });

  test('Inauguration Day 2029 shifts from Saturday to Friday', () => {
    const holidays = getFederalHolidays(2029);
    const inauguration = holidays.find((h) => h.name === 'Inauguration Day');
    // Jan 20, 2029 is Saturday, so it shifts to Friday, Jan 19
    expect(inauguration?.date).toBe('2029-01-19');
  });

  test('all 11 standard holidays present in 2024', () => {
    const holidays = getFederalHolidays(2024);
    const names = holidays.map((h) => h.name).sort();
    expect(names).toEqual([
      'Christmas',
      'Columbus Day',
      'Independence Day',
      'Juneteenth',
      'Labor Day',
      'MLK Day',
      'Memorial Day',
      'New Year',
      'Presidents Day',
      'Thanksgiving',
      'Veterans Day',
    ]);
  });
});

describe('isFederalHoliday', () => {
  test('returns true for Christmas 2024', () => {
    expect(isFederalHoliday('2024-12-25')).toBe(true);
  });

  test('returns false for regular day', () => {
    expect(isFederalHoliday('2024-08-15')).toBe(false);
  });

  test('returns true for MLK Day 2025', () => {
    expect(isFederalHoliday('2025-01-20')).toBe(true);
  });

  test('returns true for shifted Independence Day 2026', () => {
    expect(isFederalHoliday('2026-07-03')).toBe(true); // Friday (shifted from Saturday)
  });

  test('returns false for actual Independence Day 2026 when shifted', () => {
    expect(isFederalHoliday('2026-07-04')).toBe(false); // Saturday (not observed)
  });

  test('returns true for Inauguration Day 2025', () => {
    expect(isFederalHoliday('2025-01-20')).toBe(true);
  });
});

describe('isBusinessDay', () => {
  test('returns false for Saturday', () => {
    expect(isBusinessDay('2024-12-21')).toBe(false); // Saturday
  });

  test('returns false for Sunday', () => {
    expect(isBusinessDay('2024-12-22')).toBe(false); // Sunday
  });

  test('returns false for Christmas', () => {
    expect(isBusinessDay('2024-12-25')).toBe(false); // Wednesday but holiday
  });

  test('returns true for regular Wednesday', () => {
    expect(isBusinessDay('2024-12-18')).toBe(true);
  });

  test('returns false for MLK Day 2025', () => {
    expect(isBusinessDay('2025-01-20')).toBe(false);
  });

  test('returns false for shifted Independence Day 2026', () => {
    expect(isBusinessDay('2026-07-03')).toBe(false); // Friday (observed)
  });

  test('returns false for actual Independence Day 2026 (Saturday, not a business day)', () => {
    expect(isBusinessDay('2026-07-04')).toBe(false); // Saturday (weekend)
  });

  test('returns false for Thanksgiving 2024', () => {
    expect(isBusinessDay('2024-11-28')).toBe(false);
  });
});
