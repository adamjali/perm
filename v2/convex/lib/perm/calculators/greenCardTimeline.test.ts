import { describe, expect, it } from 'vitest';
import { buildGreenCardTimeline, keyDatesFromPwd } from './greenCardTimeline';

const FULL = { pwdQueueMonths: 5, permDecisionMonths: 12, i140Months: 8 };

describe('buildGreenCardTimeline', () => {
  it('returns every stage, including ones with no figure', () => {
    // Dropping an unmeasurable stage would read as though the step does not
    // exist, which is worse than showing it as unknown.
    const t = buildGreenCardTimeline(FULL);
    expect(t.stages.map((s) => s.id)).toEqual([
      'pwd', 'recruitment', 'perm', 'i140', 'priority-date',
    ]);
  });

  it('totals only the stages that have a figure', () => {
    // 5 + 2 recruitment + 12 + 8. The visa number stage is excluded.
    expect(buildGreenCardTimeline(FULL).totalKnownMonths).toBe(27);
  });

  it('names the stages it could not measure', () => {
    const t = buildGreenCardTimeline(FULL);
    expect(t.unknownStages).toEqual(['Waiting for a visa number']);
  });

  it('separates what the employer controls from what a queue does', () => {
    // Only recruitment. This is the whole point of the page: 2 months of 27.
    expect(buildGreenCardTimeline(FULL).employerControlledMonths).toBe(2);
  });

  it('marks the recruitment window statutory and the queues as forecasts', () => {
    const t = buildGreenCardTimeline(FULL);
    const by = Object.fromEntries(t.stages.map((s) => [s.id, s.certainty]));
    expect(by).toEqual({
      pwd: 'queue', recruitment: 'statutory', perm: 'queue',
      i140: 'queue', 'priority-date': 'unknown',
    });
  });

  it('still totals what it can when a queue figure is missing', () => {
    const t = buildGreenCardTimeline({ ...FULL, permDecisionMonths: null });
    expect(t.totalKnownMonths).toBe(15);
    expect(t.unknownStages).toContain('PERM decision');
  });

  it('reports a null total when nothing is measurable', () => {
    const t = buildGreenCardTimeline({
      pwdQueueMonths: null, permDecisionMonths: null, i140Months: null,
    });
    // Recruitment is statutory, so it survives even with no queue data.
    expect(t.totalKnownMonths).toBe(2);
    expect(t.unknownStages).toHaveLength(4);
  });
});

describe('keyDatesFromPwd', () => {
  it.each([
    ['2026-05-15', '2026-08-13'],
    ['2026-09-10', '2027-06-30'],
    ['2026-02-05', '2026-06-30'],
  ])('expires a %s determination on %s', (determined, expires) => {
    // The three cases in 20 CFR 656.40(c).
    expect(keyDatesFromPwd(determined).pwdExpires).toBe(expires);
  });

  it('closes the filing window 180 days after recruitment starts', () => {
    expect(
      keyDatesFromPwd('2026-05-15').filingWindowClosesIfRecruitmentStartsToday,
    ).toBe('2026-11-11');
  });

  it('rejects a malformed determination date', () => {
    expect(() => keyDatesFromPwd('2026-5-15')).toThrow(/determinationDate/);
  });
});
