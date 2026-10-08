import { describe, expect, it } from 'vitest';
import { estimateRfiCase, type RfiClock } from './rfiClock';

const clock: RfiClock = {
  leaveDays: { p25: 31, p50: 31, p75: 31 },
  afterLeaveDays: { p25: 2, p50: 4, p75: 7, p90: null },
  slowEndDays: 14,
  slowEndFrom: "an immigration attorney's estimate",
  watched: 1021,
  watchedFrom: '2026-08-27',
  test: null,
};

describe('estimateRfiCase', () => {
  it('dates a case from its own RFI day: the 30 days, then a few more', () => {
    const r = estimateRfiCase({ enteredOn: '2026-10-01', today: '2026-10-08', clock });
    expect(r).toEqual({ kind: 'estimate', date: '2026-11-05', earliest: '2026-11-03', latest: '2026-11-15', daysInRfi: 7 });
  });

  it('never dates it before today, and keeps the range open from today', () => {
    const r = estimateRfiCase({ enteredOn: '2026-09-01', today: '2026-10-08', clock });
    if (r.kind !== 'estimate') throw new Error('expected a date');
    expect(r.date).toBe('2026-10-08');
    expect(r.earliest).toBe('2026-10-08');
    expect(r.latest).toBe('2026-10-16');
  });

  it("says when the RFI has run past the window, instead of a date", () => {
    const r = estimateRfiCase({ enteredOn: '2026-08-28', today: '2026-10-20', clock });
    expect(r.kind).toBe('refused');
    expect(r.kind === 'refused' && r.reason).toBe('past-window');
  });

  it("won't count from a day it doesn't know: an RFI begun before our record", () => {
    expect(estimateRfiCase({ enteredOn: '2026-08-27', today: '2026-09-10', clock }).kind).toBe('refused');
    expect(estimateRfiCase({ enteredOn: null, today: '2026-09-10', clock }).kind).toBe('refused');
  });

  it("uses the record's own slow end once measured", () => {
    const measured = { ...clock, afterLeaveDays: { ...clock.afterLeaveDays, p90: 9 }, slowEndDays: 9, slowEndFrom: 'measured' as const };
    const r = estimateRfiCase({ enteredOn: '2026-10-01', today: '2026-10-08', clock: measured });
    if (r.kind !== 'estimate') throw new Error('expected a date');
    expect(r.latest).toBe('2026-11-10');
  });
});
