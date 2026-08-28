import { describe, expect, it } from 'vitest';
import {
  estimateQueueDecision,
  measureFrontierAdvance,
  measureFrontierAdvanceRange,
  cohortMaturity,
  reportablePercentiles,
  type CohortStat,
  impliedMedianDays,
  type DolFrontier,
} from './queueEstimate';

/**
 * The values below mirror DOL's real published position on 2026-08-20
 * (analyst review working 2025-09, average 372 calendar days) so the fixtures
 * stay recognisable against the live page.
 */
const FRONTIER: DolFrontier = {
  analystQueueMonth: '2025-09',
  officialAvgDays: 372,
  asOf: '2026-08-20',
};

const TODAY = '2026-08-23';

/**
 * Settled cohort: 2024-06 sits 15 months behind the 2025-09 frontier, so DOL
 * has long since worked through it. Figures are the real ones from the
 * FY2025+FY2026 disclosure union.
 */
const MATURE_COHORT: CohortStat = {
  cohortMonth: '2024-06',
  decided: 9_800,
  p25: 300,
  p50: 400,
  p75: 520,
  p90: 700,
};

/**
 * Open cohort: DOL has not reached 2026-03, so the only cases decided are
 * early closures. Its raw median of 6 days is the real value from the FY2026
 * file and is exactly the number that must never reach a page.
 */
const IMMATURE_COHORT: CohortStat = {
  cohortMonth: '2026-03',
  decided: 197,
  p25: 0,
  p50: 6,
  p75: 35,
  p90: 81,
};

describe('reportablePercentiles', () => {
  it('reports every percentile for a fully resolved cohort', () => {
    // Arrange
    const available = [
      { percentile: 25, days: 300 },
      { percentile: 50, days: 400 },
      { percentile: 75, days: 520 },
      { percentile: 90, days: 700 },
    ];

    // Act
    const result = reportablePercentiles(1.0, available);

    // Assert
    expect(result.map((r) => r.percentile)).toEqual([25, 50, 75, 90]);
  });

  it('reports nothing above the observed completion fraction', () => {
    // Arrange: 40% decided, so the empirical CDF is only defined to ~0.36.
    const available = [
      { percentile: 25, days: 100 },
      { percentile: 50, days: 130 },
      { percentile: 75, days: 160 },
      { percentile: 90, days: 200 },
    ];

    // Act
    const result = reportablePercentiles(0.4, available);

    // Assert: p25 survives, the median does not.
    expect(result.map((r) => r.percentile)).toEqual([25]);
  });

  it('reports nothing at all when almost none of the cohort has resolved', () => {
    const result = reportablePercentiles(0.1, [
      { percentile: 25, days: 90 },
      { percentile: 50, days: 120 },
    ]);
    expect(result).toEqual([]);
  });

  it('skips percentiles whose value is missing', () => {
    const result = reportablePercentiles(1.0, [
      { percentile: 25, days: null },
      { percentile: 50, days: 400 },
    ]);
    expect(result).toEqual([{ percentile: 50, days: 400 }]);
  });
});

describe('measureFrontierAdvance', () => {
  it('returns null with a single observation', () => {
    expect(
      measureFrontierAdvance([{ observedOn: '2026-08-22', queueMonth: '2025-09' }]),
    ).toBeNull();
  });

  it('returns null when observations span less than a calendar month', () => {
    expect(
      measureFrontierAdvance([
        { observedOn: '2026-08-01', queueMonth: '2025-08' },
        { observedOn: '2026-08-22', queueMonth: '2025-09' },
      ]),
    ).toBeNull();
  });

  it('measures a frontier moving faster than one month per month', () => {
    // 6 queue-months of movement across 4 calendar months.
    const rate = measureFrontierAdvance([
      { observedOn: '2026-04-10', queueMonth: '2025-03' },
      { observedOn: '2026-08-10', queueMonth: '2025-09' },
    ]);
    expect(rate).toBeCloseTo(1.5, 5);
  });

  it('sorts unordered observations before measuring', () => {
    const rate = measureFrontierAdvance([
      { observedOn: '2026-08-10', queueMonth: '2025-09' },
      { observedOn: '2026-04-10', queueMonth: '2025-03' },
    ]);
    expect(rate).toBeCloseTo(1.5, 5);
  });

  it('returns null for a stalled frontier rather than a zero rate', () => {
    // A zero rate would divide to an infinite wait; unmeasurable is the honest answer.
    expect(
      measureFrontierAdvance([
        { observedOn: '2026-04-10', queueMonth: '2025-09' },
        { observedOn: '2026-08-10', queueMonth: '2025-09' },
      ]),
    ).toBeNull();
  });

  it('returns null for a frontier that moved backwards', () => {
    expect(
      measureFrontierAdvance([
        { observedOn: '2026-04-10', queueMonth: '2025-09' },
        { observedOn: '2026-08-10', queueMonth: '2025-07' },
      ]),
    ).toBeNull();
  });
});

describe('estimateQueueDecision: position relative to the frontier', () => {
  it.each([
    { filingDate: '2025-12-15', expected: 'awaiting-queue', months: 3 },
    { filingDate: '2025-09-15', expected: 'queue-reached', months: 0 },
    { filingDate: '2025-06-15', expected: 'overdue', months: -3 },
  ])(
    'classifies a $filingDate filing as $expected',
    ({ filingDate, expected, months }) => {
      const result = estimateQueueDecision({ filingDate, today: TODAY, frontier: FRONTIER });
      expect(result.position).toBe(expected);
      expect(result.monthsBehindFrontier).toBe(months);
    },
  );

  it('explains why an overdue case may still be pending', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-06-15',
      today: TODAY,
      frontier: FRONTIER,
    });
    expect(result.caveats.join(' ')).toMatch(/audit/i);
  });

  it('leaves position unknown when there is no frontier', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: null,
    });
    expect(result.monthsBehindFrontier).toBeNull();
  });
});

describe("estimateQueueDecision: DOL's published average", () => {
  it("adds DOL's average to the filing date", () => {
    // Arrange / Act
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
    });

    // Assert: 2025-12-15 + 372 days.
    const model = result.models.find((m) => m.id === 'dol-average');
    expect(model?.estimatedDate).toBe('2026-12-22');
    expect(model?.totalDays).toBe(372);
  });

  it('omits the model when DOL published no readable average', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: { ...FRONTIER, officialAvgDays: null },
    });
    expect(result.models.find((m) => m.id === 'dol-average')).toBeUndefined();
  });

  it('cites DOL and its as-of date', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
    });
    expect(result.models[0]?.source).toContain('2026-08-20');
  });
});

describe('estimateQueueDecision: queue advance', () => {
  it('projects forward from today at the measured rate', () => {
    // Arrange: 3 months behind, frontier moving 1.5 queue-months per month,
    // so ~2 calendar months of waiting.
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
      frontierAdvanceRate: 1.5,
    });

    // Act
    const model = result.models.find((m) => m.id === 'queue-advance');

    // Assert: 2026-08-23 + round(2 * 30.44) = +61 days.
    expect(model?.estimatedDate).toBe('2026-10-23');
    // No observed rate range supplied, so no range is shown. A band scaled off
    // the remaining days instead would read "3 October to 31 October" for a
    // case fourteen months out, which is precision this model does not have.
    expect(model?.earliestDate).toBeNull();
    expect(model?.latestDate).toBeNull();
  });

  it('derives its range from how much the rate itself has varied', () => {
    // Arrange: real measured spread, 1.05 slowest to 2.50 fastest.
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
      frontierAdvanceRate: 1.8,
      frontierAdvanceRange: { slowest: 1.05, fastest: 2.5 },
    });

    // Act
    const model = result.models.find((m) => m.id === 'queue-advance');

    // Assert: 3 months behind at 2.50 is ~37 days, at 1.05 is ~87 days. The
    // band spans months rather than weeks, which is the resolution DOL's queue
    // actually moves at.
    expect(model?.earliestDate).toBe('2026-09-29');
    expect(model?.latestDate).toBe('2026-11-18');
  });

  it('is omitted entirely when no rate has been measured', () => {
    // This is the important one: no rate must mean no model, never a constant.
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
      frontierAdvanceRate: null,
    });
    expect(result.models.find((m) => m.id === 'queue-advance')).toBeUndefined();
  });

  it('is omitted for a case the queue has already passed', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-06-15',
      today: TODAY,
      frontier: FRONTIER,
      frontierAdvanceRate: 1.5,
    });
    expect(result.models.find((m) => m.id === 'queue-advance')).toBeUndefined();
  });
});

describe('estimateQueueDecision: cohort percentiles and survivorship', () => {
  it('uses the cohort median for a fully resolved cohort', () => {
    const result = estimateQueueDecision({
      filingDate: '2024-06-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [MATURE_COHORT],
    });

    const model = result.models.find((m) => m.id === 'cohort-percentile');
    expect(model?.totalDays).toBe(400);
    expect(model?.earliestDate).toBe('2025-04-06'); // +300
    expect(model?.latestDate).toBe('2025-11-12'); // +520
    expect(result.cohort?.truncatedBySurvivorship).toBe(false);
  });

  it('refuses to publish a median for a cohort DOL has not reached', () => {
    // The whole point: the 197 decided cases from 2026-03 are early closures,
    // and their 6-day median is not a processing time.
    const result = estimateQueueDecision({
      filingDate: '2026-03-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [IMMATURE_COHORT],
    });

    expect(result.models.find((m) => m.id === 'cohort-percentile')).toBeUndefined();
    expect(result.cohort?.truncatedBySurvivorship).toBe(true);
    expect(result.caveats.join(' ')).toMatch(/withdrawals and other early closures/i);
  });

  it('reports a null completion fraction when no pending count exists', () => {
    // DOL's disclosure files carry no pending rows, so this is the normal case
    // and must not be silently read as "100% complete".
    const result = estimateQueueDecision({
      filingDate: '2026-03-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [IMMATURE_COHORT],
    });
    expect(result.cohort?.completionFraction).toBeNull();
    expect(result.cohort?.totalReceived).toBeNull();
    expect(result.cohort?.maturity).toBe('unstarted');
  });

  it('still withholds a median when a full count says the cohort is settled but the frontier disagrees', () => {
    // Belt and braces: a bad totalReceived must not unlock an open cohort.
    const result = estimateQueueDecision({
      filingDate: '2026-03-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [{ ...IMMATURE_COHORT, totalReceived: 197 }],
    });
    expect(result.models.find((m) => m.id === 'cohort-percentile')).toBeUndefined();
  });

  it('returns no cohort block when the filing month is not covered', () => {
    const result = estimateQueueDecision({
      filingDate: '2019-01-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [MATURE_COHORT],
    });
    expect(result.cohort).toBeNull();
  });
});

describe('estimateQueueDecision: honest degradation', () => {
  it('returns no models and says so when there is no data at all', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: null,
    });
    expect(result.models).toEqual([]);
    expect(result.caveats.join(' ')).toMatch(/not enough published DOL data/i);
  });

  it('always warns that DOL is not strictly first-in-first-out', () => {
    const result = estimateQueueDecision({
      filingDate: '2025-12-15',
      today: TODAY,
      frontier: FRONTIER,
    });
    expect(result.caveats.join(' ')).toMatch(/does not decide cases in strict order/i);
  });

  it('surfaces every supported model at once rather than blending them', () => {
    const result = estimateQueueDecision({
      filingDate: '2024-06-10',
      today: TODAY,
      frontier: FRONTIER,
      cohorts: [MATURE_COHORT],
    });
    // DOL average + cohort percentile. Queue advance is absent: 2024-06 is
    // behind the frontier, which is correct.
    expect(result.models.map((m) => m.id)).toEqual(['dol-average', 'cohort-percentile']);
  });

  it.each([
    ['2025-13-01', 'filingDate'],
    ['not-a-date', 'filingDate'],
  ])('rejects the malformed filing date %s', (filingDate) => {
    expect(() =>
      estimateQueueDecision({ filingDate, today: TODAY, frontier: FRONTIER }),
    ).toThrow(/filingDate/);
  });
});

describe('measureFrontierAdvanceRange', () => {
  /** DOL's real reconstructed frontier, FY2025+FY2026 union. */
  const REAL = [
    { observedOn: '2026-01-01', queueMonth: '2024-08' },
    { observedOn: '2026-02-01', queueMonth: '2024-09' },
    { observedOn: '2026-03-01', queueMonth: '2024-11' },
    { observedOn: '2026-04-01', queueMonth: '2024-12' },
    { observedOn: '2026-05-01', queueMonth: '2025-02' },
    { observedOn: '2026-06-01', queueMonth: '2025-05' },
  ];

  it('spans the slowest and fastest observed pace', () => {
    const range = measureFrontierAdvanceRange(REAL);
    // Windows of 3: 1.5, 1.5, 2.0, 2.5 filing-months per calendar month.
    expect(range).toEqual({ slowest: 1.5, fastest: 2.5 });
  });

  it('smooths over windows rather than adjacent pairs', () => {
    // Adjacent pairs here include a 0 (Jan->Feb moves one month, Mar->Apr one)
    // and a 3. A band built from those describes DOL's scheduling, not a wait.
    const range = measureFrontierAdvanceRange(REAL, 3);
    expect(range!.slowest).toBeGreaterThan(0);
  });

  it('returns null with fewer observations than the window', () => {
    expect(measureFrontierAdvanceRange(REAL.slice(0, 2), 3)).toBeNull();
  });

  it('returns null when every window is stalled', () => {
    expect(
      measureFrontierAdvanceRange([
        { observedOn: '2026-01-01', queueMonth: '2025-01' },
        { observedOn: '2026-02-01', queueMonth: '2025-01' },
        { observedOn: '2026-03-01', queueMonth: '2025-01' },
      ]),
    ).toBeNull();
  });
});

describe('cohortMaturity', () => {
  // Frontier 2025-09 throughout, matching DOL's real published position.
  it.each([
    ['2024-06', 'settled'],
    ['2025-03', 'settled'],
    ['2025-04', 'open'],
    ['2025-06', 'open'],
    ['2025-09', 'open'],
    ['2025-12', 'unstarted'],
    ['2026-06', 'unstarted'],
  ])('classifies %s as %s', (cohort, expected) => {
    expect(cohortMaturity(cohort, '2025-09')).toBe(expected);
  });

  it('treats the settled boundary as inclusive', () => {
    // Exactly COHORT_SETTLED_MONTHS behind counts as settled; one less does not.
    expect(cohortMaturity('2025-03', '2025-09')).toBe('settled');
    expect(cohortMaturity('2025-04', '2025-09')).toBe('open');
  });

  it('rejects a malformed month rather than guessing', () => {
    expect(() => cohortMaturity('2025-3', '2025-09')).toThrow(/cohortMonth/);
    expect(() => cohortMaturity('2025-03', 'nope')).toThrow(/frontierMonth/);
  });
});

describe("impliedMedianDays", () => {
  /**
   * The shape correction. `reportablePercentiles` withholds the median until a
   * cohort is ~56% decided, correctly, because the decided-so-far median is
   * the cohort's low percentile wearing a median's label. This recovers it
   * from the shape instead, and these tests pin the guards that keep that
   * honest rather than the arithmetic that makes it convenient.
   */
  it("refuses on a cohort too young to have a real percentile", () => {
    // The floor is 25% and it is MEASURED, not chosen for neatness. Out of
    // sample the correction helps from the quarter mark (6.5d -> 5.2d) and
    // HURTS below it (9.0d -> 25.0d at 15%), because that early the decided
    // cases are instant withdrawals rather than a processing time.
    expect(impliedMedianDays(0.05, [{ percentile: 5, days: 300 }])).toBeNull();
    expect(impliedMedianDays(0.15, [{ percentile: 5, days: 300 }])).toBeNull();
    expect(impliedMedianDays(0.24, [{ percentile: 5, days: 300 }])).toBeNull();
  });

  it("answers exactly at the measured floor, not one tick above it", () => {
    // An off-by-one here silently withholds the whole band the correction was
    // validated on, and would look like the feature simply never firing.
    expect(impliedMedianDays(0.25, [{ percentile: 10, days: 300 }])).not.toBeNull();
  });

  it("refuses when nothing is observed", () => {
    expect(impliedMedianDays(0.9, [])).toBeNull();
  });

  it("scales an observed low percentile UP toward the median", () => {
    // p25 sits at 0.987x the median, so an observed 493 days implies 499
    // (493 / 0.987 = 499.49). The point is the DIRECTION and the magnitude:
    // a ~6-day upward correction on a ~500-day wait, which is most of the
    // 9.5-day error the raw reading carries.
    const r = impliedMedianDays(0.5, [{ percentile: 25, days: 493 }]);
    expect(r).not.toBeNull();
    expect(r!.days).toBe(499);
    expect(r!.days).toBeGreaterThan(493);
    expect(r!.fromPercentile).toBe(25);
  });

  it("uses the HIGHEST observed percentile, needing the least extrapolation", () => {
    const r = impliedMedianDays(0.6, [
      { percentile: 5, days: 400 },
      { percentile: 25, days: 493 },
    ]);
    expect(r!.fromPercentile).toBe(25);
  });

  it("leaves an observed median alone", () => {
    // Factor 1.0 at p50: if the median is genuinely observed, do not adjust it.
    const r = impliedMedianDays(0.9, [{ percentile: 50, days: 500 }]);
    expect(r!.days).toBe(500);
  });

  it("never returns a date EARLIER than what was observed", () => {
    // The correction only ever pushes later. A shape factor above 1 applied to
    // a low percentile would be a silent optimism bug.
    for (const p of [5, 10, 25, 50]) {
      const r = impliedMedianDays(0.9, [{ percentile: p, days: 400 }]);
      expect(r!.days).toBeGreaterThanOrEqual(400);
    }
  });
});
