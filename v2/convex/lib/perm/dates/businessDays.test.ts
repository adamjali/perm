import { describe, it, expect } from 'vitest';
import { addBusinessDays, subtractBusinessDays, countBusinessDays } from './businessDays';

describe('subtractBusinessDays', () => {
  describe('basic subtraction (no holidays)', () => {
    it('subtracts 1 business day from a Wednesday → Tuesday', () => {
      // 2024-03-13 is Wednesday → 2024-03-12 is Tuesday
      expect(subtractBusinessDays('2024-03-13', 1)).toBe('2024-03-12');
    });

    it('subtracts 5 business days (one full week)', () => {
      // 2024-03-15 is Friday → subtract 5 bdays → 2024-03-08 (Friday)
      expect(subtractBusinessDays('2024-03-15', 5)).toBe('2024-03-08');
    });

    it('skips weekends when subtracting from Monday', () => {
      // 2024-03-11 is Monday → subtract 1 bday → 2024-03-08 (Friday)
      expect(subtractBusinessDays('2024-03-11', 1)).toBe('2024-03-08');
    });

    it('skips weekends when subtracting 2 from Monday', () => {
      // 2024-03-11 is Monday → subtract 2 bdays → 2024-03-07 (Thursday)
      expect(subtractBusinessDays('2024-03-11', 2)).toBe('2024-03-07');
    });

    it('handles 0 business days', () => {
      expect(subtractBusinessDays('2024-03-13', 0)).toBe('2024-03-13');
    });
  });

  describe('holiday handling', () => {
    it('skips MLK Day (3rd Monday in January)', () => {
      // 2025-01-20 is MLK Day (Monday)
      // 2025-01-21 is Tuesday → subtract 1 bday → should skip MLK → 2025-01-17 (Friday)
      expect(subtractBusinessDays('2025-01-21', 1)).toBe('2025-01-17');
    });

    it('skips New Year\'s Day', () => {
      // 2025-01-02 is Thursday → subtract 1 bday → skips 2025-01-01 → 2024-12-31 (Tuesday)
      expect(subtractBusinessDays('2025-01-02', 1)).toBe('2024-12-31');
    });

    it('skips Independence Day', () => {
      // 2025-07-07 is Monday → subtract 1 bday → skips Jul 4 (Fri) and weekend → 2025-07-03 (Thu)
      expect(subtractBusinessDays('2025-07-07', 1)).toBe('2025-07-03');
    });

    it('skips Thanksgiving (4th Thursday in November)', () => {
      // 2024-11-29 is Friday (day after Thanksgiving)
      // Thanksgiving is 2024-11-28 (Thursday)
      // Subtract 1 bday → skip Thanksgiving → 2024-11-27 (Wednesday)
      expect(subtractBusinessDays('2024-11-29', 1)).toBe('2024-11-27');
    });
  });

  describe('multi-week spans with holidays', () => {
    it('subtracts 10 business days spanning MLK Day', () => {
      // 2025-01-30 is Thursday
      // 10 bdays back: skip MLK (Jan 20) + 2 weekends
      // Result should be 2025-01-15 (Wednesday)
      const result = subtractBusinessDays('2025-01-30', 10);
      expect(result).toBe('2025-01-15');
    });
  });

  describe('symmetry with addBusinessDays', () => {
    it('add then subtract returns original date (starting from business day)', () => {
      // 2024-06-14 is Friday (business day) — symmetry holds
      const original = '2024-06-14';
      const added = addBusinessDays(original, 10);
      const result = subtractBusinessDays(added, 10);
      expect(result).toBe(original);
    });

    it('subtract then add returns original date (starting from business day)', () => {
      // 2024-09-20 is Friday (business day) — symmetry holds
      const original = '2024-09-20';
      const subtracted = subtractBusinessDays(original, 5);
      const result = addBusinessDays(subtracted, 5);
      expect(result).toBe(original);
    });
  });
});

describe('countBusinessDays', () => {
  it('counts business days in a normal week', () => {
    // Mon Mar 11 to Fri Mar 15 = 5 business days
    expect(countBusinessDays('2024-03-11', '2024-03-15')).toBe(5);
  });

  it('returns 0 when end is before start', () => {
    expect(countBusinessDays('2024-03-15', '2024-03-11')).toBe(0);
  });

  it('counts single day', () => {
    // Wednesday = 1 business day
    expect(countBusinessDays('2024-03-13', '2024-03-13')).toBe(1);
  });

  it('excludes weekends', () => {
    // Sat Mar 16 to Sun Mar 17 = 0 business days
    expect(countBusinessDays('2024-03-16', '2024-03-17')).toBe(0);
  });
});
