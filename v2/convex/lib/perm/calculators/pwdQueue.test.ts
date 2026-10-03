import { describe, expect, it } from 'vitest';
import {
  estimatePwdQueue,
  measurePwdClearance,
  type PwdBacklogMonth,
} from './pwdQueue';

/**
 * DOL's real published PERM prevailing-wage backlog as of 2026-06-30, taken
 * from the live snapshot. Total pending is 50,300.
 */
const BACKLOG: PwdBacklogMonth[] = [
  { receiptMonth: '2025-12', remainingRequests: 11 },
  { receiptMonth: '2026-01', remainingRequests: 63 },
  { receiptMonth: '2026-02', remainingRequests: 106 },
  { receiptMonth: '2026-03', remainingRequests: 627 },
  { receiptMonth: '2026-04', remainingRequests: 14_386 },
  { receiptMonth: '2026-05', remainingRequests: 18_310 },
  { receiptMonth: '2026-06', remainingRequests: 16_797 },
];

const BASE = { backlog: BACKLOG, frontierMonth: '2026-04', asOf: '2026-06-30' };

describe('estimatePwdQueue: counting the real queue', () => {
  it('counts only requests received in earlier months as ahead', () => {
    // Arrange / Act
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2026-05' });

    // Assert: 11 + 63 + 106 + 627 + 14,386.
    expect(result.requestsAhead).toBe(15_193);
    expect(result.requestsSameMonth).toBe(18_310);
    expect(result.totalPending).toBe(50_300);
  });

  it('counts nothing ahead for the oldest month in the backlog', () => {
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2025-12' });
    expect(result.requestsAhead).toBe(0);
    expect(result.requestsSameMonth).toBe(11);
  });

  it('counts the whole backlog as ahead for a month past its end', () => {
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2026-07' });
    expect(result.requestsAhead).toBe(50_300);
    expect(result.requestsSameMonth).toBe(0);
  });

  it('reports position against the frontier', () => {
    expect(estimatePwdQueue({ ...BASE, requestMonth: '2026-06' }).monthsBehindFrontier).toBe(2);
    expect(estimatePwdQueue({ ...BASE, requestMonth: '2026-04' }).monthsBehindFrontier).toBe(0);
    expect(estimatePwdQueue({ ...BASE, requestMonth: '2026-02' }).monthsBehindFrontier).toBe(-2);
  });

  it('rejects a malformed request month', () => {
    expect(() => estimatePwdQueue({ ...BASE, requestMonth: '2026-5' })).toThrow(/requestMonth/);
  });
});

describe('estimatePwdQueue: refusing to guess the drain rate', () => {
  it('shows no wait at all when the clearance rate is unknown', () => {
    // The count of requests ahead is a fact; the wait it implies is not,
    // and a constant here would scale the whole answer.
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2026-05' });
    expect(result.estimatedMonthsRemaining).toBeNull();
    expect(result.estimatedMonth).toBeNull();
    expect(result.caveats.join(' ')).toMatch(/will not guess/i);
  });

  it('still reports the exact count when it cannot report a wait', () => {
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2026-05' });
    expect(result.requestsAhead).toBe(15_193);
  });

  it('computes a wait once a rate is supplied', () => {
    // 15,193 ahead + half of 18,310 same-month = 24,348 at 8,000/month.
    const result = estimatePwdQueue({
      ...BASE,
      requestMonth: '2026-05',
      clearancePerMonth: 8_000,
    });
    expect(result.estimatedMonthsRemaining).toBeCloseTo(3.0435, 3);
    // From DOL's as-of (June 30), not from the request month (May): June 30
    // plus 3.04 months is early October. Until Oct 3 2026 this test pinned
    // '2026-09', the request-month arithmetic.
    expect(result.estimatedMonth).toBe('2026-10');
  });

  it('never names a month before the counts it is built on', () => {
    // Sep 30 2026, as published: a June request with 1,810 effectively ahead
    // at 15,306 a month is days away, not "July 2026".
    const live = {
      asOf: '2026-09-30',
      frontierMonth: '2026-06',
      clearancePerMonth: 15_306,
      backlog: [
        { receiptMonth: '2026-04', remainingRequests: 8 },
        { receiptMonth: '2026-05', remainingRequests: 36 },
        { receiptMonth: '2026-06', remainingRequests: 3_532 },
        { receiptMonth: '2026-07', remainingRequests: 15_959 },
        { receiptMonth: '2026-08', remainingRequests: 14_980 },
        { receiptMonth: '2026-09', remainingRequests: 14_519 },
      ],
    };
    const month = (requestMonth: string) => estimatePwdQueue({ ...live, requestMonth }).estimatedMonth;
    expect(month('2026-06')).toBe('2026-10');
    expect(month('2026-07')).toBe('2026-10');
    expect(month('2026-08')).toBe('2026-11');
    expect(month('2026-09')).toBe('2026-12');
    for (const m of ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) {
      expect(month(m)! >= '2026-09').toBe(true);
    }
  });

  it('reads a mid-month as-of date as half the month gone', () => {
    // Sep 15 plus 0.4 months is late September; plus 0.6 is early October.
    const at = (clear: number) =>
      estimatePwdQueue({
        asOf: '2026-09-15',
        frontierMonth: '2026-06',
        requestMonth: '2026-06',
        clearancePerMonth: clear,
        backlog: [{ receiptMonth: '2026-06', remainingRequests: 2_000 }],
      }).estimatedMonth;
    expect(at(2_500)).toBe('2026-09'); // 1,000 effective / 2,500 = 0.4
    expect(at(1_666)).toBe('2026-10'); // 0.6
  });

  it.each([0, -5, null, undefined])('ignores a rate of %s', (rate) => {
    const result = estimatePwdQueue({
      ...BASE,
      requestMonth: '2026-05',
      clearancePerMonth: rate as number | null | undefined,
    });
    expect(result.estimatedMonth).toBeNull();
  });

  it('always says the PWD is only the first step', () => {
    const result = estimatePwdQueue({ ...BASE, requestMonth: '2026-05' });
    expect(result.caveats.join(' ')).toMatch(/first step of a PERM/i);
  });

  it('flags a request DOL has worked past with nothing left ahead of it', () => {
    const result = estimatePwdQueue({
      ...BASE,
      requestMonth: '2025-11',
      backlog: BACKLOG.filter((b) => b.receiptMonth >= '2026-01'),
    });
    expect(result.requestsAhead).toBe(0);
    expect(result.caveats.join(' ')).toMatch(/problem with the filing itself/i);
  });
});

describe('measurePwdClearance', () => {
  const EARLIER = {
    asOf: '2026-04-30',
    backlog: [
      { receiptMonth: '2026-01', remainingRequests: 5_000 },
      { receiptMonth: '2026-02', remainingRequests: 8_000 },
    ],
  };

  it('sums how far each shared month fell, per month elapsed', () => {
    // 5,000 -> 63 and 8,000 -> 106 across 2 months = 12,831 / 2.
    const rate = measurePwdClearance(EARLIER, {
      asOf: '2026-06-30',
      backlog: [
        { receiptMonth: '2026-01', remainingRequests: 63 },
        { receiptMonth: '2026-02', remainingRequests: 106 },
      ],
    });
    expect(rate).toBeCloseTo(6_415.5, 1);
  });

  it('ignores months that appear only in the later snapshot', () => {
    // A month absent from the earlier snapshot is new intake. Counting it
    // would subtract from clearance and understate what DOL processed.
    const rate = measurePwdClearance(EARLIER, {
      asOf: '2026-06-30',
      backlog: [
        { receiptMonth: '2026-01', remainingRequests: 63 },
        { receiptMonth: '2026-02', remainingRequests: 106 },
        { receiptMonth: '2026-06', remainingRequests: 16_797 },
      ],
    });
    expect(rate).toBeCloseTo(6_415.5, 1);
  });

  it('returns null when the snapshots are less than a month apart', () => {
    expect(
      measurePwdClearance(EARLIER, { asOf: '2026-05-10', backlog: EARLIER.backlog }),
    ).toBeNull();
  });

  it('returns null when nothing was cleared', () => {
    expect(
      measurePwdClearance(EARLIER, { asOf: '2026-06-30', backlog: EARLIER.backlog }),
    ).toBeNull();
  });

  it('returns null when the backlog grew', () => {
    expect(
      measurePwdClearance(EARLIER, {
        asOf: '2026-06-30',
        backlog: [
          { receiptMonth: '2026-01', remainingRequests: 9_000 },
          { receiptMonth: '2026-02', remainingRequests: 12_000 },
        ],
      }),
    ).toBeNull();
  });
});
