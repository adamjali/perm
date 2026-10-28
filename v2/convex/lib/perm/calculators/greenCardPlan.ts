import { addDays, format, parseISO } from 'date-fns';

import { DAYS_PER_MONTH_2DP } from '../../time';
import { FILING_WINDOW_WAIT_DAYS, JOB_ORDER_MIN_DAYS, PREMIUM_I140_BUSINESS_DAYS } from '../constants';
import { addBusinessDays } from '../dates/businessDays';
import { calculateGreenCardFees, type FeeInput, type FeeResult } from './greenCardFees';
import { monthsToReach, type PaceBasis } from './priorityDate';

/**
 * The employment-based green card, end to end, dated.
 *
 * From where a case stands and its dates, every step to the green card with the day
 * it should start and end, and the government's fees for the whole way (owner, Oct 27
 * 2026: "you put in dates and change stuff as you like but it maps out full process
 * and full price").
 *
 * It composes the other calculators and models nothing new. Every length is an
 * assumption passed in as `PlanFigures`: the measured figure by default, the reader's
 * own when they change one. The statutory step (recruitment) is fixed arithmetic; the
 * queues are what DOL and USCIS measured; the bulletin wait is the line's own cutoff
 * pace, and when a line is unavailable or hasn't moved, nothing dates it.
 */

// ============================================================================
// THE STEPS
// ============================================================================

export type PlanStage = 'pwd' | 'recruitment' | 'perm' | 'i140' | 'visa' | 'i485';

/** Who sets the pace of a step. */
export type StageOwner = 'employer' | 'dol' | 'uscis' | 'state';

export interface StageInfo {
  key: PlanStage;
  name: string;
  owner: StageOwner;
  /** What happens in the step, in one plain sentence. */
  detail: string;
}

/** Every step, in order. */
export const PLAN_STAGES: readonly StageInfo[] = [
  {
    key: 'pwd',
    name: 'Wage request',
    owner: 'dol',
    detail: 'DOL sets the lowest wage the job may pay. Nothing else can start until it is issued.',
  },
  {
    key: 'recruitment',
    name: 'Recruitment',
    owner: 'employer',
    detail: 'A job order, two Sunday ads and a notice of filing, then 30 days before the PERM may be filed.',
  },
  {
    key: 'perm',
    name: 'PERM',
    owner: 'dol',
    detail: 'DOL decides cases in order of filing month. An audit or a request for information takes a case out of line.',
  },
  {
    key: 'i140',
    name: 'I-140',
    owner: 'uscis',
    detail: 'USCIS decides the immigrant petition. Premium processing buys a decision in 15 business days.',
  },
  {
    key: 'visa',
    name: 'Waiting for the visa bulletin',
    owner: 'state',
    detail: "The State Department's monthly cutoff has to pass your priority date before the I-485 can be filed.",
  },
  {
    key: 'i485',
    name: 'I-485 and the green card',
    owner: 'uscis',
    detail: 'USCIS decides the adjustment of status and issues the green card.',
  },
];

const ORDER: readonly PlanStage[] = PLAN_STAGES.map((s) => s.key);
const stageInfo = (key: PlanStage): StageInfo => PLAN_STAGES.find((s) => s.key === key)!;

/** Where a case can stand, in order. The date the reader gives means what `dateLabel` says. */
export const WHERE = [
  { key: 'start', label: 'Not started yet', dateLabel: 'Wage request to be filed on', from: 'pwd' },
  { key: 'pwd-filed', label: 'Wage request filed', dateLabel: 'Wage request filed on', from: 'pwd' },
  { key: 'recruiting', label: 'Wage determination in, recruiting', dateLabel: 'Determination issued on', from: 'recruitment' },
  { key: 'perm-filed', label: 'PERM filed', dateLabel: 'PERM filed on (your priority date)', from: 'perm' },
  { key: 'perm-certified', label: 'PERM certified', dateLabel: 'PERM certified on', from: 'i140' },
  { key: 'i140-filed', label: 'I-140 filed', dateLabel: 'I-140 filed on', from: 'i140' },
  { key: 'i140-approved', label: 'I-140 approved, waiting on the bulletin', dateLabel: 'PERM filed on (your priority date)', from: 'visa' },
] as const satisfies readonly { key: string; label: string; dateLabel: string; from: PlanStage }[];
export type Where = (typeof WHERE)[number]['key'];

/** The starting points whose date isn't the priority date, so the reader gives it as well. */
export const NEEDS_PRIORITY_DATE: ReadonlySet<Where> = new Set<Where>(['perm-certified', 'i140-filed']);

/** The shortest recruitment the rules allow: the 30-day job order, then the 30-day quiet period. */
export const RECRUITMENT_MIN_DAYS = JOB_ORDER_MIN_DAYS + FILING_WINDOW_WAIT_DAYS;

// ============================================================================
// INPUTS AND OUTPUT
// ============================================================================

/** Every length the plan assumes. The page passes the measured ones; a reader may change any. */
export interface PlanFigures {
  /** Days from filing to decision for DOL's middle wage-request decision on its last working day. */
  pwdWaitDays: number | null;
  /** Days of recruitment, at least the rules' minimum. */
  recruitmentDays: number;
  /** The same as `pwdWaitDays`, for PERM. */
  permWaitDays: number | null;
  /** USCIS's median months for an I-140. */
  i140Months: number | null;
  /** USCIS's median months for an employment-based I-485. */
  i485Months: number | null;
  /** Each line's final action cutoff and its measured pace, keyed `EB2|india`. */
  pace: Record<string, PaceBasis>;
  /** Days the cutoff moves in a month, when the reader sets it; otherwise the line's measured pace. */
  paceDaysPerMonth?: number | null;
  /** The bulletin the cutoffs come from, `YYYY-MM`. */
  bulletinMonth: string | null;
}

export interface PlanInput {
  where: Where;
  /** The date the reader gave for where the case stands. */
  date: string;
  /** For a case past PERM, the priority date when it differs from `date`. */
  priorityDate?: string;
  category: 'EB2' | 'EB3';
  country: string;
  premium: boolean;
  fees: Omit<FeeInput, 'premium'>;
  /** Today, ISO. */
  today: string;
}

export interface PlanStep extends StageInfo {
  /** When the step starts and should end; `end` is null where nothing measured supports a date. */
  start: string;
  end: string | null;
  /** Where the step stands against today. */
  state: 'done' | 'now' | 'ahead';
  /** What the length rests on, in a few words. */
  basis: string;
}

export interface Plan {
  steps: PlanStep[];
  /** The priority date the plan used. */
  priorityDate: string;
  /** The day the green card should come, or null when the bulletin wait can't be measured. */
  greenCard: string | null;
  /** True when the priority date is already current in the newest bulletin. */
  current: boolean;
  /** Months the bulletin wait adds, or null. */
  bulletinMonths: number | null;
  /** Days between the priority date and the cutoff, for the check sentence. */
  gapDays: number | null;
  fees: FeeResult;
}

// ============================================================================
// THE PLAN
// ============================================================================

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const plusDays = (day: string, n: number) => iso(addDays(parseISO(day), Math.round(n)));
const plusMonths = (day: string, months: number) => plusDays(day, months * DAYS_PER_MONTH_2DP);
const later = (a: string, b: string) => (a > b ? a : b);

/** The line's pace, or the reader's own days a month in its place. */
function paceOf(figures: PlanFigures, key: string): PaceBasis | null {
  const cell = figures.pace[key] ?? null;
  if (!cell || !figures.paceDaysPerMonth || figures.paceDaysPerMonth <= 0) return cell;
  return { ...cell, movedDays: figures.paceDaysPerMonth, spanMonths: 1 };
}

export function buildPlan(input: PlanInput, figures: PlanFigures): Plan {
  const from = WHERE.find((w) => w.key === input.where)?.from ?? 'pwd';
  const startAt = ORDER.indexOf(from);
  const runs = (key: PlanStage) => startAt <= ORDER.indexOf(key);
  const state = (start: string, end: string | null): PlanStep['state'] =>
    end && end <= input.today ? 'done' : start <= input.today ? 'now' : 'ahead';

  const steps: PlanStep[] = [];
  // Each step starts where the one before ends; the reader's date anchors the first.
  let cursor = input.date;
  let priorityDate = input.priorityDate || input.date;
  const push = (key: PlanStage, end: string | null, basis: string, start = cursor) => {
    steps.push({ ...stageInfo(key), start, end, state: state(start, end), basis });
    if (end) cursor = end;
  };

  if (runs('pwd')) {
    const end = figures.pwdWaitDays !== null ? plusDays(cursor, figures.pwdWaitDays) : null;
    push('pwd', end, "DOL's typical wait now, filed to decided");
  }
  if (runs('recruitment')) {
    const days = Math.max(figures.recruitmentDays, RECRUITMENT_MIN_DAYS);
    push('recruitment', plusDays(cursor, days), days === RECRUITMENT_MIN_DAYS ? 'The shortest the rules allow' : `${days} days`);
  }
  if (runs('perm')) {
    // The priority date is the day the PERM is filed.
    if (startAt < ORDER.indexOf('perm')) priorityDate = cursor;
    const end = figures.permWaitDays !== null ? plusDays(cursor, figures.permWaitDays) : null;
    push('perm', end, "DOL's typical wait now, filed to decided");
  }
  let i140Start: string | null = null;
  if (runs('i140')) {
    i140Start = cursor;
    const end = input.premium
      ? addBusinessDays(cursor, PREMIUM_I140_BUSINESS_DAYS)
      : figures.i140Months !== null
        ? plusMonths(cursor, figures.i140Months)
        : null;
    push('i140', end, input.premium ? `Premium processing, ${PREMIUM_I140_BUSINESS_DAYS} business days` : "USCIS's median");
  }

  // The visa wait: the priority date against the line's final action cutoff, at its pace.
  const cell = paceOf(figures, `${input.category}|${input.country}`);
  const latest = cell?.latest ?? null;
  const current = latest?.kind === 'current' || (latest?.kind === 'date' && priorityDate < latest.iso);
  const reach = cell && !current ? monthsToReach(cell, priorityDate) : null;
  const visaFrom = figures.bulletinMonth ? `${figures.bulletinMonth}-01` : input.today;
  // A current date files the I-485 with the I-140 (concurrent filing).
  const visaEnd = current ? (i140Start ?? cursor) : reach ? later(cursor, plusMonths(visaFrom, reach.months)) : null;
  if (runs('visa')) {
    if (current) push('visa', visaEnd, 'Current in the newest bulletin: no wait', visaEnd!);
    else push('visa', visaEnd, figures.paceDaysPerMonth ? `Your pace, ${figures.paceDaysPerMonth} days a month` : "The cutoff's measured pace");
  }
  const greenCard = visaEnd && figures.i485Months !== null ? plusMonths(visaEnd, figures.i485Months) : null;
  if (visaEnd) push('i485', greenCard, "USCIS's median for employment-based cases", visaEnd);
  else push('i485', null, 'Waits on the bulletin');

  return {
    steps,
    priorityDate,
    greenCard,
    current,
    bulletinMonths: current ? 0 : reach ? reach.months : null,
    gapDays: reach ? reach.gapDays : current ? 0 : null,
    fees: calculateGreenCardFees({ ...input.fees, premium: input.premium }),
  };
}
