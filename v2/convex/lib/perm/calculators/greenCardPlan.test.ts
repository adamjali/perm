import { describe, expect, it } from 'vitest';

import { FILING_WINDOW_WAIT_DAYS, JOB_ORDER_MIN_DAYS } from '../constants';
import {
  buildPlan,
  I140_FILE_BY_DAYS,
  MILESTONE_ORDER,
  orderedSpan,
  PLAN_STAGES,
  RECRUITMENT_MIN_DAYS,
  type PlanFigures,
  type PlanInput,
} from './greenCardPlan';

const even = (n: number) => ({ low: n, mid: n, high: n });

const FIGURES: PlanFigures = {
  spans: {
    pwd: { low: 90, mid: 97, high: 110 },
    recruitment: { low: 73, mid: 120, high: 176 },
    perm: { low: 280, mid: 290, high: 300 },
    i140Prep: even(30),
    i140: { EB2: { low: 91, mid: 119, high: 119 }, EB3: { low: 119, mid: 122, high: 122 } },
    i485: { low: 180, mid: 183, high: 200 },
    ead: { low: 170, mid: 195, high: 230 },
    ap: { low: 160, mid: 177, high: 260 },
  },
  pace: {
    // 180 days of cutoff movement over 12 months: 15 days a month.
    'EB2|worldwide': { latest: { kind: 'date', iso: '2025-04-01' }, movedDays: 180, spanMonths: 12, retrogressions: [] },
    'EB3|worldwide': { latest: { kind: 'current' }, movedDays: null, spanMonths: null, retrogressions: [] },
    'EB2|india': { latest: { kind: 'unavailable' }, movedDays: null, spanMonths: null, retrogressions: [] },
  },
  bulletinMonth: '2026-11',
};

const base: PlanInput = {
  known: {},
  startOn: '2026-11-02',
  category: 'EB2',
  country: 'worldwide',
  premium: false,
  fees: { petitioner: 'regular', adults: 1 },
  today: '2026-10-28',
};

const step = (plan: ReturnType<typeof buildPlan>, key: string) => plan.steps.find((s) => s.key === key)!;

describe('buildPlan', () => {
  describe('the chain of steps', () => {
    it('chains every step from a wage request to be filed, each a range', () => {
      const plan = buildPlan(base, FIGURES);
      expect(plan.steps.map((s) => s.key)).toEqual(PLAN_STAGES.map((s) => s.key));
      expect(step(plan, 'pwd').end).toEqual({ low: '2027-01-31', mid: '2027-02-07', high: '2027-02-20' });
      expect(step(plan, 'recruitment').start).toEqual(step(plan, 'pwd').end);
      // The priority date is the PERM filing day, on each track.
      expect(plan.priorityDate).toEqual(step(plan, 'recruitment').end);
      expect(plan.priorityDate!.mid).toBe('2027-06-07'); // Feb 7 + 120
    });

    it('never plans recruitment shorter than the rules allow', () => {
      expect(RECRUITMENT_MIN_DAYS).toBe(JOB_ORDER_MIN_DAYS + FILING_WINDOW_WAIT_DAYS);
      const plan = buildPlan(base, { ...FIGURES, spans: { ...FIGURES.spans, recruitment: { low: 5, mid: 10, high: 20 } } });
      // Every track is held to the 60 days, from each track's own wage determination.
      expect(step(plan, 'recruitment').end).toEqual({ low: '2027-04-01', mid: '2027-04-08', high: '2027-04-21' });
    });

    it('orders a span the reader typed backwards, and never lets it go negative', () => {
      expect(orderedSpan({ low: 30, mid: -5, high: 10 })).toEqual({ low: 0, mid: 10, high: 30 });
    });

    it('marks steps done, now or ahead against today', () => {
      expect(buildPlan({ ...base, known: { pwdFiled: '2026-08-01' } }, FIGURES).steps[0]!.state).toBe('now');
      expect(buildPlan({ ...base, known: { pwdFiled: '2026-05-01' } }, FIGURES).steps[0]!.state).toBe('done');
    });
  });

  describe('the dates the reader knows', () => {
    it('runs end to end from any date: the steps before the first one are dated back from it, as done', () => {
      const plan = buildPlan({ ...base, known: { permFiled: '2025-10-20', permCertified: '2026-09-01' } }, FIGURES);
      expect(plan.steps.map((s) => s.key)).toEqual(PLAN_STAGES.map((s) => s.key));
      expect(plan.priorityDate).toEqual({ low: '2025-10-20', mid: '2025-10-20', high: '2025-10-20' });
      expect(step(plan, 'perm').known).toEqual({ start: true, end: true });
      expect(step(plan, 'perm').state).toBe('done');
      // Recruitment took 73 to 176 days (typically 120) before the priority date; the wage request 90 to 110 before that.
      expect(step(plan, 'recruitment')).toMatchObject({ state: 'done', known: { start: false, end: true }, end: plan.priorityDate });
      expect(plan.milestones.pwdIssued).toEqual({ low: '2025-04-27', mid: '2025-06-22', high: '2025-08-08' });
      expect(plan.milestones.pwdFiled).toEqual({ low: '2025-01-07', mid: '2025-03-17', high: '2025-05-10' });
      expect(step(plan, 'pwd').state).toBe('done');
      expect(step(plan, 'pwd').basis).toMatch(/dated back/);
    });

    it('pins a later known date and moves every step after it from there', () => {
      const guessed = buildPlan({ ...base, known: { pwdFiled: '2026-01-05' } }, FIGURES);
      const pinned = buildPlan({ ...base, known: { pwdFiled: '2026-01-05', pwdIssued: '2026-06-01' } }, FIGURES);
      expect(step(pinned, 'pwd').end).toEqual({ low: '2026-06-01', mid: '2026-06-01', high: '2026-06-01' });
      expect(step(pinned, 'recruitment').end!.mid).toBe('2026-09-29'); // Jun 1 + 120
      expect(step(pinned, 'recruitment').end!.mid).not.toBe(step(guessed, 'recruitment').end!.mid);
    });

    it('refuses dates out of order, naming both', () => {
      const plan = buildPlan({ ...base, known: { permFiled: '2026-05-01', permCertified: '2026-04-01' } }, FIGURES);
      expect(plan.problems).toHaveLength(1);
      expect(plan.problems[0]).toBe('PERM certified (Apr 1, 2026) is before PERM filed (May 1, 2026).');
    });

    it('never estimates a step past a later date the reader gave', () => {
      // The PERM wait (280 to 300 days) would put certification in May; the reader's I-140 was approved in March.
      const plan = buildPlan({ ...base, known: { permFiled: '2025-08-01', i140Approved: '2026-03-01' } }, FIGURES);
      for (const m of ['permCertified', 'i140Filed'] as const) {
        expect(plan.milestones[m]!.high <= '2026-03-01').toBe(true);
        expect(plan.milestones[m]!.low >= '2025-08-01').toBe(true);
      }
      expect(plan.milestones.i140Approved).toEqual({ low: '2026-03-01', mid: '2026-03-01', high: '2026-03-01' });
    });

    it('says an I-140 filed past the certification\'s 180 days was late', () => {
      const plan = buildPlan({ ...base, known: { permCertified: '2026-01-01', i140Filed: '2026-07-15' } }, FIGURES);
      expect(plan.problems.join(' ')).toMatch(/within 180 days/);
      expect(I140_FILE_BY_DAYS).toBe(179);
    });

    it('never plans the I-140 past the certification\'s last day', () => {
      const plan = buildPlan({ ...base, known: { permCertified: '2026-09-01' } }, { ...FIGURES, spans: { ...FIGURES.spans, i140Prep: even(400) } });
      expect(step(plan, 'i140Prep').end!.high).toBe('2027-02-27'); // Sep 1 + 179
    });
  });

  describe('the PERM decision', () => {
    it('dates a filed case from the cases ahead of it when the page has them', () => {
      const byQueue = { low: '2026-12-01', mid: '2026-12-20', high: '2027-01-15', casesAhead: 18_000, perDay: 625 };
      const plan = buildPlan({ ...base, known: { permFiled: '2026-02-10' } }, { ...FIGURES, permByQueue: byQueue });
      expect(step(plan, 'perm').end).toEqual({ low: '2026-12-01', mid: '2026-12-20', high: '2027-01-15' });
      expect(step(plan, 'perm').basis).toBe("18,000 cases ahead of yours, at DOL's pace of 625 a day");
    });

    it('uses the plain wait for a PERM not yet filed, even with the queue known', () => {
      const byQueue = { low: '2026-12-01', mid: '2026-12-20', high: '2027-01-15', casesAhead: 18_000, perDay: 625 };
      const plan = buildPlan(base, { ...FIGURES, permByQueue: byQueue });
      expect(step(plan, 'perm').end!.mid).toBe('2028-03-23'); // Jun 7 2027 + 290
    });
  });

  describe('the wage request', () => {
    const byQueue = { low: '2026-11-20', mid: '2026-11-24', high: '2026-11-30', casesAhead: 41_000.5, perDay: 760 };

    it('dates a filed request still waiting from the requests ahead of it', () => {
      const plan = buildPlan({ ...base, known: { pwdFiled: '2026-07-10' } }, { ...FIGURES, pwdByQueue: byQueue });
      expect(step(plan, 'pwd').end).toEqual({ low: '2026-11-20', mid: '2026-11-24', high: '2026-11-30' });
      expect(step(plan, 'pwd').basis).toBe("41,001 wage requests ahead of yours, at DOL's pace of 760 a day");
    });

    it('uses the plain wait for a request not yet filed, and the reader\'s own issue date when known', () => {
      expect(step(buildPlan(base, { ...FIGURES, pwdByQueue: byQueue }), 'pwd').end!.mid).toBe('2027-02-07');
      const issued = buildPlan({ ...base, known: { pwdFiled: '2026-07-10', pwdIssued: '2026-10-01' } }, { ...FIGURES, pwdByQueue: byQueue });
      expect(step(issued, 'pwd').end!.mid).toBe('2026-10-01');
    });
  });

  describe('the I-140', () => {
    it('dates premium processing in business days, the same on every track', () => {
      const plan = buildPlan({ ...base, premium: true, known: { permFiled: '2025-12-15', i140Filed: '2026-11-02' } }, FIGURES);
      // 15 business days from Mon Nov 2 2026, Veterans Day (Nov 11) not counted.
      expect(step(plan, 'i140').end).toEqual({ low: '2026-11-24', mid: '2026-11-24', high: '2026-11-24' });
    });

    it('uses the category\'s own regular span', () => {
      const eb2 = buildPlan({ ...base, known: { permFiled: '2025-12-15', i140Filed: '2026-11-02' } }, FIGURES);
      expect(step(eb2, 'i140').end!.low).toBe('2027-02-01'); // Nov 2 + 91
    });
  });

  describe('the bulletin', () => {
    const past = { ...base, known: { permFiled: '2025-12-15', i140Approved: '2026-03-01' } };

    it('waits at the cutoff\'s measured pace, widened by how far off the pace has been', () => {
      // 2025-12-15 is 258 days past the 2025-04-01 cutoff: 17.2 months at 15 days a month.
      const plan = buildPlan(past, { ...FIGURES, missMonthsAt: () => 3 });
      expect(plan.current).toBe(false);
      expect(plan.bulletin.byPace).toEqual({ low: 14.2, mid: 17.2, high: 20.2 });
      expect(plan.bulletin.gapDays).toBe(258);
      expect(step(plan, 'visa').end!.mid > '2028-03-01').toBe(true);
      expect(plan.greenCard).not.toBeNull();
    });

    it('can wait by the people ahead at the line\'s yearly issuance instead', () => {
      const supply = { peopleAhead: { low: 20_000, mid: 30_000, high: 40_000 }, perYear: 40_000 };
      const plan = buildPlan(past, { ...FIGURES, supply, bulletinMethod: 'supply' });
      expect(plan.bulletin.method).toBe('supply');
      expect(plan.bulletin.bySupply).toEqual({ low: 6, mid: 9, high: 12 });
      expect(plan.bulletin.reach!.mid).toBe('2027-08-02'); // Nov 1 2026 + 9 months of 30.44 days (274)
      // Both ways are always worked out, with their dates, so the page can set them side by side.
      expect(plan.bulletin.byPace!.mid).toBe(17.2);
      expect(plan.bulletin.reachBySupply).toEqual(plan.bulletin.reach);
      expect(plan.bulletin.reachByPace!.mid > plan.bulletin.reachBySupply!.mid).toBe(true);
    });

    it('uses the reader\'s cutoff pace in place of the measured one', () => {
      // 258 days at 30 days a month is 8.6 months.
      const plan = buildPlan(past, { ...FIGURES, paceDaysPerMonth: 30 });
      expect(plan.bulletin.byPace!.mid).toBe(8.6);
    });

    it('files the I-485 with the I-140 when the priority date is already current', () => {
      const plan = buildPlan({ ...base, category: 'EB3', known: { permFiled: '2026-01-10' } }, FIGURES);
      expect(plan.current).toBe(true);
      expect(step(plan, 'i485').start).toEqual(step(plan, 'i140').start);
      expect(step(plan, 'visa').start).toEqual(step(plan, 'visa').end);
    });

    it('gives no green card date when the line is unavailable, and says the I-485 waits', () => {
      const plan = buildPlan({ ...base, country: 'india' }, FIGURES);
      expect(plan.greenCard).toBeNull();
      expect(step(plan, 'i485').end).toBeNull();
      expect(plan.sideSteps).toEqual([]);
    });
  });

  describe('what the I-485 brings', () => {
    it('dates the work permit and travel document from the I-485 filing', () => {
      const plan = buildPlan({ ...base, known: { permFiled: '2025-12-15', i485Filed: '2026-06-01' } }, FIGURES);
      expect(plan.sideSteps.map((s) => s.key)).toEqual(['ead', 'ap']);
      expect(plan.sideSteps[0]!.end).toEqual({ low: '2026-11-18', mid: '2026-12-13', high: '2027-01-17' });
    });
  });

  describe('the costs', () => {
    it('dates each government fee to the day its step starts', () => {
      const plan = buildPlan({ ...base, known: { permFiled: '2025-12-15', i140Filed: '2026-11-02' } }, FIGURES);
      const i140 = plan.costs.find((c) => c.form === 'I-140')!;
      expect(i140.due!.mid).toBe('2026-11-02');
      const i485 = plan.costs.find((c) => c.form === 'I-485')!;
      expect(i485.due).toEqual(plan.milestones.i485Filed);
    });

    it('adds the reader\'s own costs, the PERM\'s for the employer, the medical exam per person', () => {
      const plan = buildPlan(
        { ...base, fees: { petitioner: 'regular', adults: 2, children: 1 }, own: { permAttorney: 4000, recruitment: 1500, medicalEach: 300 } },
        FIGURES,
      );
      const medical = plan.costs.find((c) => c.key === 'medicalEach')!;
      expect(medical.count).toBe(3);
      expect(medical.amount).toBe(900);
      expect(plan.totals.employer).toBe(5500);
      expect(plan.totals.all).toBe(plan.fees.total + 5500 + 900);
    });

    it('leaves out a cost the reader left at zero', () => {
      const plan = buildPlan({ ...base, own: { permAttorney: 0 } }, FIGURES);
      expect(plan.costs.some((c) => c.source === 'own')).toBe(false);
    });

    it('adds premium processing to the fees only when chosen', () => {
      expect(buildPlan({ ...base, premium: true }, FIGURES).fees.total).toBeGreaterThan(buildPlan(base, FIGURES).fees.total);
    });
  });

  it('knows every milestone in order', () => {
    expect(MILESTONE_ORDER).toEqual(['pwdFiled', 'pwdIssued', 'permFiled', 'permCertified', 'i140Filed', 'i140Approved', 'i485Filed', 'greenCard']);
  });
});
