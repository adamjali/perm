import { describe, expect, it } from 'vitest';

import { FILING_WINDOW_WAIT_DAYS, JOB_ORDER_MIN_DAYS } from '../constants';
import { buildPlan, PLAN_STAGES, RECRUITMENT_MIN_DAYS, type PlanFigures, type PlanInput } from './greenCardPlan';

const FIGURES: PlanFigures = {
  pwdWaitDays: 97,
  recruitmentDays: RECRUITMENT_MIN_DAYS,
  permWaitDays: 290,
  i140Months: 3.9,
  i485Months: 6,
  pace: {
    // 180 days of cutoff movement over 12 months: 15 days a month.
    'EB2|worldwide': { latest: { kind: 'date', iso: '2025-04-01' }, movedDays: 180, spanMonths: 12, retrogressions: [] },
    'EB3|worldwide': { latest: { kind: 'current' }, movedDays: null, spanMonths: null, retrogressions: [] },
    'EB2|india': { latest: { kind: 'unavailable' }, movedDays: null, spanMonths: null, retrogressions: [] },
  },
  bulletinMonth: '2026-11',
};

const base: PlanInput = {
  where: 'start',
  date: '2026-11-02',
  category: 'EB2',
  country: 'worldwide',
  premium: false,
  fees: { petitioner: 'regular', adults: 1 },
  today: '2026-10-28',
};

const last = <T>(xs: readonly T[]): T => xs[xs.length - 1]!;
const step = (plan: ReturnType<typeof buildPlan>, key: string) => plan.steps.find((s) => s.key === key)!;

describe('buildPlan', () => {
  it('chains every step from a wage request filed today, the priority date the PERM filing day', () => {
    const plan = buildPlan(base, FIGURES);
    expect(plan.steps.map((s) => s.key)).toEqual(PLAN_STAGES.map((s) => s.key));
    expect(step(plan, 'pwd').end).toBe('2027-02-07'); // Nov 2 + 97 days
    expect(step(plan, 'recruitment').start).toBe('2027-02-07');
    expect(step(plan, 'recruitment').end).toBe('2027-04-08'); // + 60 days
    expect(plan.priorityDate).toBe('2027-04-08');
    expect(step(plan, 'perm').start).toBe(plan.priorityDate);
  });

  it('takes the shortest recruitment from the job order and the quiet period', () => {
    expect(RECRUITMENT_MIN_DAYS).toBe(JOB_ORDER_MIN_DAYS + FILING_WINDOW_WAIT_DAYS);
  });

  it('starts a certified case at its I-140 with the priority date it was filed on', () => {
    const plan = buildPlan({ ...base, where: 'perm-certified', date: '2026-09-01', priorityDate: '2025-10-20' }, FIGURES);
    expect(plan.steps[0]!.key).toBe('i140');
    expect(plan.steps[0]!.start).toBe('2026-09-01');
    expect(plan.priorityDate).toBe('2025-10-20');
  });

  it('starts at the reader\'s step and keeps the given priority date past PERM', () => {
    const plan = buildPlan({ ...base, where: 'i140-filed', date: '2026-09-01', priorityDate: '2025-12-15' }, FIGURES);
    expect(plan.steps[0]!.key).toBe('i140');
    expect(plan.priorityDate).toBe('2025-12-15');
  });

  it('dates premium processing in business days', () => {
    const plan = buildPlan({ ...base, where: 'i140-filed', date: '2026-11-02', priorityDate: '2025-12-15', premium: true }, FIGURES);
    // 15 business days from Mon Nov 2 2026, Veterans Day (Nov 11) not counted.
    expect(plan.steps[0]!.end).toBe('2026-11-24');
  });

  it('waits on the bulletin at the cutoff\'s measured pace', () => {
    // 2025-12-15 is 258 days past the 2025-04-01 cutoff: 17.2 months at 15 days a month.
    const plan = buildPlan({ ...base, where: 'i140-approved', date: '2025-12-15' }, FIGURES);
    expect(plan.current).toBe(false);
    expect(plan.bulletinMonths).toBe(17.2);
    expect(step(plan, 'visa').end! > '2028-03-01').toBe(true);
    expect(plan.greenCard).not.toBeNull();
  });

  it('files the I-485 with the I-140 when the priority date is already current', () => {
    const plan = buildPlan({ ...base, category: 'EB3', where: 'perm-filed', date: '2026-01-10' }, FIGURES);
    expect(plan.current).toBe(true);
    expect(step(plan, 'i485').start).toBe(step(plan, 'i140').start);
  });

  it('gives no green card date when the line is unavailable', () => {
    const plan = buildPlan({ ...base, country: 'india' }, FIGURES);
    expect(plan.greenCard).toBeNull();
    expect(last(plan.steps).end).toBeNull();
  });

  it('adds premium processing to the fees only when chosen', () => {
    const plain = buildPlan(base, FIGURES).fees.total;
    const premium = buildPlan({ ...base, premium: true }, FIGURES).fees.total;
    expect(premium).toBeGreaterThan(plain);
  });

  it('marks steps done, now or ahead against today', () => {
    expect(buildPlan({ ...base, where: 'pwd-filed', date: '2026-08-01' }, FIGURES).steps[0]!.state).toBe('now');
    expect(buildPlan({ ...base, where: 'pwd-filed', date: '2026-05-01' }, FIGURES).steps[0]!.state).toBe('done');
  });

  describe('the reader\'s own assumptions', () => {
    it('moves every later step when a wait changes', () => {
      const plan = buildPlan(base, { ...FIGURES, permWaitDays: 290 + 30 });
      expect(step(plan, 'i140').start).toBe('2028-02-22'); // 30 days after the measured 2028-01-23
    });

    it('never plans recruitment shorter than the rules allow', () => {
      const plan = buildPlan(base, { ...FIGURES, recruitmentDays: 10 });
      expect(step(plan, 'recruitment').end).toBe('2027-04-08');
    });

    it('uses the reader\'s cutoff pace in place of the measured one', () => {
      // 258 days at 30 days a month is 8.6 months.
      const plan = buildPlan({ ...base, where: 'i140-approved', date: '2025-12-15' }, { ...FIGURES, paceDaysPerMonth: 30 });
      expect(plan.bulletinMonths).toBe(8.6);
    });
  });
});
