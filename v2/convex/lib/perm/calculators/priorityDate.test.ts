import { describe, expect, it } from 'vitest';
import { estimatePriorityDate, parseCutoff, type BulletinMonth } from './priorityDate';

/** The real archived EB-2 India final-action series, June 2025 to July 2026. */
const EB2_INDIA = [
  ['2025-06', '01JAN13'], ['2025-07', '01JAN13'], ['2025-08', '01JAN13'],
  ['2025-09', '01JAN13'], ['2025-10', '01APR13'], ['2025-11', '01APR13'],
  ['2025-12', '15MAY13'], ['2026-01', '15JUL13'], ['2026-02', '15JUL13'],
  ['2026-03', '15SEP13'], ['2026-04', '15JUL14'], ['2026-05', '15JUL14'],
  ['2026-06', '01SEP13'], ['2026-07', 'U'],
] as const;

const BULLETINS: BulletinMonth[] = EB2_INDIA.map(([month, cell]) => ({
  bulletinMonth: month,
  finalAction: { EB2: { india: cell, worldwide: 'C' } },
  datesForFiling: { EB2: { india: '15JAN15', worldwide: 'C' } },
}));

const BASE = { category: 'EB2', country: 'india' as const, chart: 'finalAction' as const, bulletins: BULLETINS };

describe('parseCutoff', () => {
  it.each([
    ['01JAN13', '2013-01-01'],
    ['15SEP13', '2013-09-15'],
    ['22DEC10', '2010-12-22'],
    ['01AUG24', '2024-08-01'],
  ])('parses %s', (cell, iso) => {
    expect(parseCutoff(cell)).toEqual({ kind: 'date', iso });
  });

  it('reads C as current and U as unavailable, not as dates', () => {
    // Treating U as a very old date would tell someone they are nearly there
    // when the category is shut.
    expect(parseCutoff('C')).toEqual({ kind: 'current' });
    expect(parseCutoff('U')).toEqual({ kind: 'unavailable' });
  });

  it.each(['', '  ', 'N/A', '1JAN13', '01XXX13', undefined])('rejects %s', (cell) => {
    expect(parseCutoff(cell as string | undefined)).toBeNull();
  });

  it('resolves the two-digit year against a 50-year window', () => {
    expect(parseCutoff('01JAN98')).toEqual({ kind: 'date', iso: '1998-01-01' });
    expect(parseCutoff('01JAN24')).toEqual({ kind: 'date', iso: '2024-01-01' });
  });
});

describe('estimatePriorityDate: the verdict', () => {
  it('reports the newest bulletin, never today', () => {
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2012-01-01' });
    expect(r.asOfBulletin).toBe('2026-07');
  });

  it('says nobody is current while the category is unavailable', () => {
    // July 2026 is U, so even a 1999 priority date is not current.
    const r = estimatePriorityDate({ ...BASE, priorityDate: '1999-01-01' });
    expect(r.latest).toEqual({ kind: 'unavailable' });
    expect(r.isCurrent).toBe(false);
    expect(r.daysFromCutoff).toBeNull();
    expect(r.caveats.join(' ')).toMatch(/unavailable in the most recent bulletin/i);
  });

  it('is current when the priority date is on or before a real cutoff', () => {
    const upTo2026_06 = BULLETINS.filter((b) => b.bulletinMonth <= '2026-06');
    const r = estimatePriorityDate({
      ...BASE, bulletins: upTo2026_06, priorityDate: '2013-01-01',
    });
    // 2026-06 cutoff is 01SEP13, so a Jan 2013 date clears it.
    expect(r.isCurrent).toBe(true);
    expect(r.daysFromCutoff).toBe(243);
  });

  it('is not current when the priority date is after the cutoff', () => {
    const upTo2026_06 = BULLETINS.filter((b) => b.bulletinMonth <= '2026-06');
    const r = estimatePriorityDate({
      ...BASE, bulletins: upTo2026_06, priorityDate: '2014-01-01',
    });
    expect(r.isCurrent).toBe(false);
    expect(r.daysFromCutoff).toBeLessThan(0);
  });

  it('treats a C cutoff as current for any priority date', () => {
    const r = estimatePriorityDate({ ...BASE, country: 'worldwide', priorityDate: '2024-06-01' });
    expect(r.latest).toEqual({ kind: 'current' });
    expect(r.isCurrent).toBe(true);
  });
});

describe('estimatePriorityDate: movement', () => {
  it('returns the whole series oldest first', () => {
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2013-01-01' });
    expect(r.history).toHaveLength(14);
    expect(r.history[0]!.bulletinMonth).toBe('2025-06');
    expect(r.history[13]!.bulletinMonth).toBe('2026-07');
  });

  it('finds every month the cutoff moved backwards', () => {
    // 2026-06 went 15JUL14 -> 01SEP13, and 2026-07 went to U entirely.
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2013-01-01' });
    expect(r.retrogressions).toEqual(['2026-06', '2026-07']);
  });

  it('counts a drop to unavailable as a retrogression', () => {
    // Shutting the category is the strongest form of moving backwards, and a
    // date-only comparison would miss it entirely.
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2013-01-01' });
    expect(r.retrogressions).toContain('2026-07');
  });

  it('measures net movement over real dates only', () => {
    // 01JAN13 to 01SEP13 across the dated months; the U month is excluded.
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2013-01-01' });
    expect(r.netMovementDays).toBe(243);
  });

  it('warns that a current date can stop being current', () => {
    const r = estimatePriorityDate({ ...BASE, priorityDate: '2013-01-01' });
    expect(r.caveats.join(' ')).toMatch(/can stop being current the next/i);
  });
});

describe('estimatePriorityDate: honest degradation', () => {
  it('reports nothing rather than guessing for an unpublished pairing', () => {
    const r = estimatePriorityDate({ ...BASE, category: 'EB9', priorityDate: '2013-01-01' });
    expect(r.history).toEqual([]);
    expect(r.asOfBulletin).toBeNull();
    expect(r.isCurrent).toBe(false);
    expect(r.caveats.join(' ')).toMatch(/No bulletin in the record/i);
  });

  it('rejects a malformed priority date', () => {
    expect(() => estimatePriorityDate({ ...BASE, priorityDate: '2013-1-1' })).toThrow(/priorityDate/);
  });

  it('reads the dates-for-filing chart when asked', () => {
    const r = estimatePriorityDate({ ...BASE, chart: 'datesForFiling', priorityDate: '2013-01-01' });
    expect(r.latest).toEqual({ kind: 'date', iso: '2015-01-15' });
    expect(r.isCurrent).toBe(true);
  });
});
