import { describe, it, expect } from 'vitest';
import {
  isValidISODate,
  validateISODateFormat,
  parseISOToUTC,
  parseISOToUTCSafe,
  daysBetween,
  addDaysToISO,
  addDaysToISOSafe,
  getMinDate,
  getMaxDate,
  isFutureDate,
} from '../dateValidation';

describe('isValidISODate', () => {
  it.each([
    ['2024-01-15', true],
    ['2024-12-31', true],
    ['2024-02-29', true],
    ['12/31/2024', false],
    ['2024-1-15', false],
    ['invalid', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('isValidISODate(%s) → %s', (input, expected) => {
    expect(isValidISODate(input)).toBe(expected);
  });
});

describe('validateISODateFormat', () => {
  it('passes for valid date', () => {
    expect(() => validateISODateFormat('2024-01-15')).not.toThrow();
  });

  it('throws for invalid format', () => {
    expect(() => validateISODateFormat('invalid')).toThrow('Invalid ISO date format');
  });
});

describe('parseISOToUTC', () => {
  it('parses valid date to UTC timestamp', () => {
    const ts = parseISOToUTC('2024-01-01');
    expect(ts).toBe(Date.UTC(2024, 0, 1));
  });

  it('throws for invalid format', () => {
    expect(() => parseISOToUTC('bad')).toThrow();
  });
});

describe('parseISOToUTCSafe', () => {
  it('parses valid date', () => {
    expect(parseISOToUTCSafe('2024-06-15')).toBe(Date.UTC(2024, 5, 15));
  });

  it.each([null, undefined, '', 'bad'])('returns null for %s', (input) => {
    expect(parseISOToUTCSafe(input)).toBeNull();
  });
});

describe('daysBetween', () => {
  it.each([
    ['2024-01-01', '2024-01-10', 9],
    ['2024-01-10', '2024-01-01', -9],
    ['2024-01-01', '2024-01-01', 0],
    ['2024-01-01', '2024-02-01', 31],
  ])('daysBetween(%s, %s) → %d', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });
});

describe('addDaysToISO', () => {
  it.each([
    ['2024-01-01', 30, '2024-01-31'],
    ['2024-01-31', -30, '2024-01-01'],
    ['2024-02-28', 1, '2024-02-29'], // leap year
    ['2024-12-31', 1, '2025-01-01'], // year boundary
  ])('addDaysToISO(%s, %d) → %s', (date, days, expected) => {
    expect(addDaysToISO(date, days)).toBe(expected);
  });
});

describe('addDaysToISOSafe', () => {
  it('adds days to valid date', () => {
    expect(addDaysToISOSafe('2024-01-01', 10)).toBe('2024-01-11');
  });

  it.each([null, undefined, 'bad'])('returns null for %s', (input) => {
    expect(addDaysToISOSafe(input, 10)).toBeNull();
  });
});

describe('getMinDate', () => {
  it('returns earliest date', () => {
    expect(getMinDate(['2024-01-15', '2024-01-10', '2024-01-20'])).toBe('2024-01-10');
  });

  it('skips invalid dates', () => {
    expect(getMinDate(['2024-01-15', null, 'bad', '2024-01-10'])).toBe('2024-01-10');
  });

  it('returns null for empty array', () => {
    expect(getMinDate([])).toBeNull();
  });
});

describe('getMaxDate', () => {
  it('returns latest date', () => {
    expect(getMaxDate(['2024-01-15', '2024-01-10', '2024-01-20'])).toBe('2024-01-20');
  });

  it('returns null for all invalid', () => {
    expect(getMaxDate([null, undefined, 'bad'])).toBeNull();
  });
});

describe('isFutureDate', () => {
  it('returns true for future date', () => {
    expect(isFutureDate('2099-12-31')).toBe(true);
  });

  it('returns false for past date', () => {
    expect(isFutureDate('2020-01-01')).toBe(false);
  });

  it('returns true for today (using explicit todayISO)', () => {
    expect(isFutureDate('2024-06-15', '2024-06-15')).toBe(true);
  });

  it('returns false for invalid date', () => {
    expect(isFutureDate('invalid')).toBe(false);
  });
});
