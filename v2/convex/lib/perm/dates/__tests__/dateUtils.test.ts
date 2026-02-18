import { describe, it, expect } from 'vitest';
import {
  isValidISODate,
  addDaysUTC,
  validateISODate,
  formatUTC,
  lastSundayOnOrBefore,
} from '../dateUtils';

describe('isValidISODate', () => {
  it.each([
    ['2024-01-15', true],
    ['2024-12-31', true],
    ['invalid', false],
    ['2024-1-5', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('isValidISODate(%s) → %s', (input, expected) => {
    expect(isValidISODate(input)).toBe(expected);
  });
});

describe('addDaysUTC', () => {
  it('adds days in UTC', () => {
    const base = new Date(Date.UTC(2024, 0, 1)); // Jan 1
    const result = addDaysUTC(base, 10);
    expect(result.getUTCDate()).toBe(11);
    expect(result.getUTCMonth()).toBe(0);
  });

  it('handles month boundary', () => {
    const base = new Date(Date.UTC(2024, 0, 31)); // Jan 31
    const result = addDaysUTC(base, 1);
    expect(result.getUTCMonth()).toBe(1); // Feb
    expect(result.getUTCDate()).toBe(1);
  });

  it('does not mutate original', () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    addDaysUTC(base, 10);
    expect(base.getUTCDate()).toBe(1);
  });
});

describe('validateISODate', () => {
  it('returns parsed Date for valid input', () => {
    const result = validateISODate('2024-06-15', 'test');
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5); // 0-indexed
  });

  it('throws for invalid format', () => {
    expect(() => validateISODate('06/15/2024', 'test')).toThrow('Invalid date format for test');
  });

  it('throws for invalid date value', () => {
    expect(() => validateISODate('2024-13-45', 'test')).toThrow('Invalid date value for test');
  });
});

describe('formatUTC', () => {
  it('formats Date to ISO string', () => {
    const date = new Date(Date.UTC(2024, 0, 5));
    expect(formatUTC(date)).toBe('2024-01-05');
  });

  it('pads month and day', () => {
    const date = new Date(Date.UTC(2024, 0, 1));
    expect(formatUTC(date)).toBe('2024-01-01');
  });
});

describe('lastSundayOnOrBefore', () => {
  it('returns same date if already Sunday', () => {
    // Jan 14, 2024 is a Sunday
    expect(lastSundayOnOrBefore('2024-01-14')).toBe('2024-01-14');
  });

  it('returns previous Sunday for Monday', () => {
    // Jan 15, 2024 is Monday → Jan 14 (Sunday)
    expect(lastSundayOnOrBefore('2024-01-15')).toBe('2024-01-14');
  });

  it('returns previous Sunday for Saturday', () => {
    // Jan 20, 2024 is Saturday → Jan 14 (Sunday)
    expect(lastSundayOnOrBefore('2024-01-20')).toBe('2024-01-14');
  });

  it('returns previous Sunday for Wednesday', () => {
    // Jan 17, 2024 is Wednesday → Jan 14 (Sunday)
    expect(lastSundayOnOrBefore('2024-01-17')).toBe('2024-01-14');
  });
});
