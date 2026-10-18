import { describe, expect, it } from 'vitest';
import { isValidMonth, monthStart, monthsBetween } from './monthUtils';
import { fiscalYearOf, fiscalYearSpan, monthFromIndex, monthIndex, monthTick, shiftMonth } from '../../months';

describe('isValidMonth', () => {
  it.each(['2026-01', '2026-12', '1999-08'])('accepts %s', (m) => {
    expect(isValidMonth(m)).toBe(true);
  });

  it.each([
    ['2026-1', 'unpadded month'],
    ['2026-13', 'month 13'],
    ['2026-00', 'month 0'],
    ['26-01', 'two-digit year'],
    ['2026-01-15', 'a full date'],
    ['', 'empty'],
  ])('rejects %s (%s)', (m) => {
    expect(isValidMonth(m)).toBe(false);
  });
});

describe('monthStart', () => {
  it('parses to the first day of the month', () => {
    expect(monthStart('2026-08', 'test').toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('names the field in the error so a bad value is traceable', () => {
    expect(() => monthStart('2026-13', 'analystQueueMonth')).toThrow(/analystQueueMonth/);
  });
});

describe('monthsBetween', () => {
  it.each([
    ['2025-09', '2025-12', 3],
    ['2025-09', '2025-09', 0],
    ['2025-09', '2025-06', -3],
    ['2024-11', '2025-02', 3],
    ['2024-01', '2026-01', 24],
  ])('%s to %s is %i months', (from, to, expected) => {
    expect(monthsBetween(from, to)).toBe(expected);
  });
});

describe('shiftMonth', () => {
  it.each([
    ['2026-05', 4, '2026-09'],
    ['2026-01', 0, '2026-01'],
    ['2026-11', 3, '2027-02'],
    ['2026-02', -3, '2025-11'],
    ['2026-01', -1, '2025-12'],
    ['2026-06', 24, '2028-06'],
    ['2026-06', -24, '2024-06'],
  ])('%s + %i = %s', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected);
  });

  it('never routes through a Date, so it is timezone-independent', () => {
    // The regression this guards: Date.UTC(2026, 8, 1) rendered through a
    // local-time formatter returns "2026-08" west of UTC.
    expect(shiftMonth('2026-05', 4)).toBe('2026-09');
  });
});

describe('fiscalYearOf and fiscalYearSpan', () => {
  it('starts the federal year in October', () => {
    expect(fiscalYearOf('2025-09')).toBe(2025);
    expect(fiscalYearOf('2025-10')).toBe(2026);
    expect(fiscalYearOf('2026-02-12')).toBe(2026);
    expect(fiscalYearSpan(2026)).toEqual({ from: '2025-10', to: '2026-09' });
  });
});

describe('monthIndex and monthFromIndex', () => {
  it('count months across a year, and read back', () => {
    expect(monthIndex('2026-01') - monthIndex('2025-12')).toBe(1);
    expect(monthIndex('2024-11-01')).toBe(monthIndex('2024-11'));
    expect(monthFromIndex(monthIndex('2025-12') + 1)).toBe('2026-01');
    expect(monthFromIndex(monthIndex('2026-01') - 13)).toBe('2024-12');
  });
});

describe('monthTick', () => {
  it('writes a year so it cannot read as a day', () => {
    expect(monthTick('2025-06')).toBe('Jun ’25');
    expect(monthTick('2026-01-15')).toBe('Jan ’26');
    expect(monthTick('nope')).toBeNull();
  });
});
