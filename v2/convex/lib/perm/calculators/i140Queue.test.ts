import { describe, expect, it } from 'vitest';
import { estimateI140Queue, type I140QuarterStats } from './i140Queue';

/**
 * USCIS's real published figures for FY2026 Q2, from
 * i140_fy2026_q2_v1.xlsx. Total pending across every subtype is 184,209.
 */
const STATS: I140QuarterStats[] = [
  { code: 'E11', label: 'Extraordinary ability', pending: 27_024, received: 6_647, approved: 1_723, denied: 2_405 },
  { code: 'E12', label: 'Outstanding professor or researcher', pending: 1_901, received: 1_334, approved: 1_546, denied: 103 },
  { code: 'E13', label: 'Multinational executive or manager', pending: 12_801, received: 3_648, approved: 3_338, denied: 104 },
  { code: 'E21', label: 'Advanced degree or exceptional ability', pending: 5_280, received: 10_922, approved: 10_958, denied: 693 },
  { code: 'NIW', label: 'National interest waiver', pending: 89_215, received: 12_641, approved: 3_042, denied: 3_283 },
  { code: 'E31', label: 'Skilled worker', pending: 35_847, received: 5_658, approved: 5_981, denied: 219 },
  { code: 'E32', label: 'Professional with a bachelor’s degree', pending: 3_861, received: 5_839, approved: 5_947, denied: 190 },
  { code: 'EW3', label: 'Unskilled worker', pending: 8_280, received: 4_421, approved: 14_871, denied: 244 },
];

const BASE = { stats: STATS, asOfQuarter: 'FY2026 Q2' };

describe('estimateI140Queue: counting the pile', () => {
  it('reports the published pending count unchanged', () => {
    expect(estimateI140Queue({ ...BASE, code: 'NIW' }).pending).toBe(89_215);
  });

  it('counts denials as completions, not just approvals', () => {
    // A denial clears a petition exactly as an approval does. Counting only
    // approvals turned fourteen quarters into twenty-nine for NIW.
    const niw = estimateI140Queue({ ...BASE, code: 'NIW' });
    expect(niw.completedInQuarter).toBe(6_325); // 3,042 + 3,283
    expect(niw.quartersToClear).toBeCloseTo(14.1, 1);
    expect(niw.monthsToClear).toBe(42);
  });

  it('computes each subtype share of all pending petitions', () => {
    // 89,215 of 184,209.
    expect(estimateI140Queue({ ...BASE, code: 'NIW' }).shareOfAllPending).toBeCloseTo(0.4843, 3);
  });

  it('throws for a subtype USCIS does not publish', () => {
    expect(() => estimateI140Queue({ ...BASE, code: 'E99' })).toThrow(/E99/);
  });
});

describe('estimateI140Queue: whether the queue is growing', () => {
  it('flags a subtype taking in more than it clears', () => {
    // NIW: 12,641 in against 6,325 out.
    const niw = estimateI140Queue({ ...BASE, code: 'NIW' });
    expect(niw.backlogGrowing).toBe(true);
    expect(niw.netChange).toBe(6_316);
    expect(niw.caveats.join(' ')).toMatch(/queue grew by 6,316/);
  });

  it('does not flag a subtype clearing faster than it fills', () => {
    // EW3: 4,421 in against 15,115 out.
    const ew3 = estimateI140Queue({ ...BASE, code: 'EW3' });
    expect(ew3.backlogGrowing).toBe(false);
    expect(ew3.netChange).toBe(-10_694);
    expect(ew3.caveats.join(' ')).not.toMatch(/queue grew/);
  });

  it.each([
    ['E11', true],
    ['E12', false],
    ['E13', true],
    ['E21', false],
  ])('classifies %s growth as %s', (code, growing) => {
    expect(estimateI140Queue({ ...BASE, code }).backlogGrowing).toBe(growing);
  });
});

describe('estimateI140Queue: refusing to divide by nothing', () => {
  it('reports no clearing time when nothing completed', () => {
    const stalled: I140QuarterStats[] = [
      { code: 'X', label: 'Stalled', pending: 5_000, received: 100, approved: 0, denied: 0 },
    ];
    const r = estimateI140Queue({ code: 'X', stats: stalled, asOfQuarter: 'FY2026 Q2' });
    expect(r.quartersToClear).toBeNull();
    expect(r.monthsToClear).toBeNull();
    expect(r.caveats.join(' ')).toMatch(/no rate to divide by/);
  });

  it('still reports the pending count when it cannot report a wait', () => {
    const stalled: I140QuarterStats[] = [
      { code: 'X', label: 'Stalled', pending: 5_000, received: 100, approved: 0, denied: 0 },
    ];
    expect(estimateI140Queue({ code: 'X', stats: stalled, asOfQuarter: 'FY2026 Q2' }).pending).toBe(5_000);
  });

  it('always says receipt-month ordering is not published', () => {
    const r = estimateI140Queue({ ...BASE, code: 'E21' });
    expect(r.caveats.join(' ')).toMatch(/not publish pending petitions by month of receipt/i);
  });
});
