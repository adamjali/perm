import { addDays, format, parseISO } from 'date-fns';

import { shortDate } from '../../months';
import { DAYS_PER_MONTH_2DP, MS_PER_DAY } from '../../time';
import {
  ETA9089_EXPIRATION_DAYS,
  FILING_WINDOW_WAIT_DAYS,
  JOB_ORDER_MIN_DAYS,
  PREMIUM_I140_BUSINESS_DAYS,
} from '../constants';
import { addBusinessDays } from '../dates/businessDays';
import { calculateGreenCardFees, type FeeInput, type FeeLine, type FeeResult, type GreenCardRoute } from './greenCardFees';
import { monthsToReach, type PaceBasis } from './priorityDate';

/**
 * The employment-based green card, end to end, dated as a range.
 *
 * From the dates a case already has, every step to the green card with the earliest,
 * typical and latest day it should start and end, the work permit and travel document
 * after the I-485, and every cost on the day it falls due (owner, Oct 27 and Oct 28
 * 2026: "you put in dates and change stuff as you like but it maps out full process and
 * full price"; "can change assumptions and numbers and rates ... any and all steps").
 *
 * It composes the other calculators and models nothing new. Every length is a `Span`
 * passed in as `PlanFigures`: the measured figures by default, the reader's own when
 * they change one. A date the reader knows replaces the estimate at that point, and
 * every step after it moves from there. Each step runs three tracks at once (quick,
 * typical, slow), so a range is the honest answer at every step, never only the end.
 */

// ============================================================================
// THE MILESTONES AND THE STEPS BETWEEN THEM
// ============================================================================

/** The dates a case can have, in the order they happen. */
export const MILESTONES = [
  { key: 'pwdFiled', label: 'Wage request filed' },
  { key: 'pwdIssued', label: 'Wage determination issued' },
  { key: 'permFiled', label: 'PERM filed (your priority date)' },
  { key: 'permCertified', label: 'PERM certified' },
  { key: 'i140Filed', label: 'I-140 filed' },
  { key: 'i140Approved', label: 'I-140 approved' },
  { key: 'i485Filed', label: 'I-485 filed' },
  { key: 'greenCard', label: 'Green card approved' },
] as const;
export type Milestone = (typeof MILESTONES)[number]['key'];
export const MILESTONE_ORDER: readonly Milestone[] = MILESTONES.map((m) => m.key);

export type PlanStage = 'pwd' | 'recruitment' | 'perm' | 'i140Prep' | 'i140' | 'visa' | 'i485' | 'consular';
/** What the I-485 brings while it waits: the work permit and the travel document. */
export type SideStage = 'ead' | 'ap';

/** Who sets the pace of a step. */
export type StageOwner = 'employer' | 'dol' | 'uscis' | 'state';

export interface StageInfo {
  key: PlanStage;
  name: string;
  owner: StageOwner;
  /** What happens in the step, in one plain sentence. */
  detail: string;
  /** The milestone it starts at and the one it ends at. */
  from: Milestone;
  to: Milestone;
}

/** Every step, in order. */
export const PLAN_STAGES: readonly StageInfo[] = [
  {
    key: 'pwd',
    name: 'Wage request',
    owner: 'dol',
    detail: 'DOL sets the lowest wage the job may pay. Nothing else can start until it is issued.',
    from: 'pwdFiled',
    to: 'pwdIssued',
  },
  {
    key: 'recruitment',
    name: 'Recruitment',
    owner: 'employer',
    detail: 'A job order, two Sunday ads and a notice of filing, then 30 days before the PERM may be filed.',
    from: 'pwdIssued',
    to: 'permFiled',
  },
  {
    key: 'perm',
    name: 'PERM',
    owner: 'dol',
    detail: 'DOL decides cases in order of filing day. An audit or a request for information takes a case out of line.',
    from: 'permFiled',
    to: 'permCertified',
  },
  {
    key: 'i140Prep',
    name: 'Preparing the I-140',
    owner: 'employer',
    detail: 'The employer files the I-140 with the certified PERM, which is valid for 180 days from certification.',
    from: 'permCertified',
    to: 'i140Filed',
  },
  {
    key: 'i140',
    name: 'I-140',
    owner: 'uscis',
    detail: 'USCIS decides the immigrant petition. Premium processing buys a decision in 15 business days.',
    from: 'i140Filed',
    to: 'i140Approved',
  },
  {
    key: 'visa',
    name: 'Visa bulletin',
    owner: 'state',
    detail:
      "The State Department's monthly final action cutoff has to pass your priority date. The I-485 goes in then, or with the I-140 when the date is already current.",
    from: 'i140Approved',
    to: 'i485Filed',
  },
  {
    key: 'i485',
    name: 'I-485 and the green card',
    owner: 'uscis',
    detail: 'USCIS decides the adjustment of status and issues the green card.',
    from: 'i485Filed',
    to: 'greenCard',
  },
];

/**
 * Through a consulate the last step is the National Visa Center and the consulate's interview,
 * in place of the I-485. It runs from the documents going in at NVC to the immigrant visa.
 */
export const CONSULAR_STAGE: StageInfo = {
  key: 'consular',
  name: 'NVC and the consulate',
  owner: 'state',
  detail:
    'The National Visa Center reviews the fees, the DS-260 and the documents, then the consulate interviews you and issues the immigrant visa. You become a permanent resident when you enter the US on it; the green card follows by mail.',
  from: 'i485Filed',
  to: 'greenCard',
};

/** Every step for a route: the I-485 inside the US, or the consulate abroad. */
export function planStages(route: GreenCardRoute = 'aos'): readonly StageInfo[] {
  if (route === 'aos') return PLAN_STAGES;
  return PLAN_STAGES.map((s) =>
    s.key === 'i485'
      ? CONSULAR_STAGE
      : s.key === 'visa'
        ? {
            ...s,
            detail:
              "The State Department's monthly final action cutoff has to pass your priority date, and the I-140 must be approved. The visa application then goes in at the National Visa Center.",
          }
        : s,
  );
}

/** What a milestone is called on a route: through a consulate, the last two are NVC's and the visa's. */
const CONSULAR_MILESTONE_LABEL: Partial<Record<Milestone, string>> = {
  i485Filed: 'Documents in at the National Visa Center',
  greenCard: 'Immigrant visa issued',
};
export function milestoneLabel(m: Milestone, route: GreenCardRoute = 'aos'): string {
  return (route === 'cp' ? CONSULAR_MILESTONE_LABEL[m] : undefined) ?? MILESTONES.find((x) => x.key === m)!.label;
}

/** The two things a pending I-485 brings, each its own form. */
export const SIDE_STAGES: readonly { key: SideStage; name: string; form: string }[] = [
  { key: 'ead', name: 'Work permit', form: 'I-765' },
  { key: 'ap', name: 'Travel document', form: 'I-131' },
];

const stageInfo = (key: PlanStage): StageInfo => [...PLAN_STAGES, CONSULAR_STAGE].find((s) => s.key === key)!;

/** The shortest recruitment the rules allow: the 30-day job order, then the 30-day quiet period. */
export const RECRUITMENT_MIN_DAYS = JOB_ORDER_MIN_DAYS + FILING_WINDOW_WAIT_DAYS;

/**
 * Days from certification to filing the I-140 when the reader hasn't said. Nothing
 * measures this (no public file dates an I-140's filing), so it's an assumption the
 * page names as one and the reader changes; the rule only says it must be inside the
 * 180 days a certification is valid (20 CFR 656.30(b)(1)).
 */
export const I140_PREP_DAYS_ASSUMED = 30;
/**
 * Days from the documents going in at the National Visa Center to the immigrant visa, past NVC's
 * own review: the consulate's interview wait. State publishes no wait for immigrant visa
 * interviews (NVC's review time it does publish, weekly, and the plan reads it), so this is an
 * assumption the page names as one and the reader sets to their consulate's.
 */
export const CONSULAR_INTERVIEW_DAYS_ASSUMED: Span = { low: 30, mid: 90, high: 180 };

/** The last day an I-140 can be filed on a certification, counted from certification. */
export const I140_FILE_BY_DAYS = ETA9089_EXPIRATION_DAYS;

// ============================================================================
// INPUTS AND OUTPUT
// ============================================================================

/** A length in days at the quick end, the typical, and the slow end. */
export interface Span {
  low: number;
  mid: number;
  high: number;
}

/** A date at the quick end, the typical, and the slow end, ISO. */
export interface DayRange {
  low: string;
  mid: string;
  high: string;
}

export type BulletinMethod = 'pace' | 'supply';

/** A step dated by its own queue: the cases ahead at DOL's measured pace, as the case pages date it. */
export type QueueDating = DayRange & { casesAhead: number; perDay: number };

/** Every length the plan assumes. The page passes the measured ones; a reader may change any. */
export interface PlanFigures {
  /** Each step's length in days; null where nothing measured supports one. */
  spans: {
    pwd: Span | null;
    recruitment: Span;
    perm: Span | null;
    i140Prep: Span;
    /** A regular I-140, by category. Premium processing is fixed in business days. */
    i140: Record<'EB2' | 'EB3', Span | null>;
    i485: Span | null;
    ead: Span | null;
    ap: Span | null;
    /** Through a consulate: NVC's document review and the consulate's interview, to the visa. */
    consular: Span | null;
  };
  /** Through a consulate: days from the I-140's approval until NVC has created the case (NVC's own weekly figure). */
  nvcCreation?: Span | null;
  /**
   * For a PERM filed on or before today: its decision from the cases still ahead of it
   * and DOL's measured pace, the case page's own model. It replaces the plain wait.
   */
  permByQueue?: QueueDating | null;
  /** The same for a wage request filed on or before today: the wage-request page's model. */
  pwdByQueue?: QueueDating | null;
  /** Each line's final action cutoff and its measured pace, keyed `EB2|india`. */
  pace: Record<string, PaceBasis>;
  /** Days the cutoff moves in a month, when the reader sets it; otherwise the line's measured pace. */
  paceDaysPerMonth?: number | null;
  /** The bulletin the cutoffs come from, `YYYY-MM`. */
  bulletinMonth: string | null;
  /** Which way the bulletin wait is worked out. Default the cutoff's own pace. */
  bulletinMethod?: BulletinMethod;
  /** How far off the pace has been, in months, at a distance past the cutoff (the bulletin backtest). */
  missMonthsAt?: ((gapDays: number) => number | null) | null;
  /** People ahead of the priority date in the line, and green cards issued in it a year. */
  supply?: { peopleAhead: Span; perYear: number } | null;
}

/** The costs a reader adds that no government schedule fixes, in dollars. */
export interface OwnCosts {
  /** The attorney for the wage request and the PERM. The employer must pay it (20 CFR 656.12(b)). */
  permAttorney?: number;
  /** The job order, ads and any other recruitment. The employer must pay them too. */
  recruitment?: number;
  /** The attorney for the I-140. */
  i140Attorney?: number;
  /** The attorney for the I-485 and its forms, or for consular processing. */
  i485Attorney?: number;
  /** The medical exam, each person: the civil surgeon's (Form I-693), or a panel physician's abroad. */
  medicalEach?: number;
}

export interface PlanInput {
  /** The dates the reader knows. The earliest one starts the plan; each later one pins its step. */
  known: Partial<Record<Milestone, string>>;
  /** With no date known, the day the wage request will be filed. */
  startOn: string;
  category: 'EB2' | 'EB3';
  country: string;
  premium: boolean;
  /** Adjustment of status inside the US (the default) or consular processing abroad. */
  route?: GreenCardRoute;
  fees: Omit<FeeInput, 'premium' | 'route'>;
  own?: OwnCosts;
  /** Today, ISO. */
  today: string;
  /**
   * Where the case stands: every milestone up to this one has happened, so none of them is
   * dated after today, whether the reader gave its date or not. A certified PERM with no date
   * typed is done, never drawn as still waiting.
   */
  reached?: Milestone;
}

export type StepState = 'done' | 'now' | 'ahead';

/** A step's basis when the reader says it happened and gave no date (counted as today at the latest). */
export const DONE_UNDATED = 'Done, date not given: counted as today at the latest';

export interface PlanStep extends Omit<StageInfo, 'key'> {
  key: PlanStage | SideStage;
  start: DayRange;
  /** Null where nothing supports a date (an unavailable line, an unmeasured wait). */
  end: DayRange | null;
  /** Whether each end came from the reader's own date. */
  known: { start: boolean; end: boolean };
  state: StepState;
  /** What the length rests on, in a few words. */
  basis: string;
}

/** Who pays a cost. The PERM's costs are the employer's by law; the rest is for the two to agree. */
export type Payer = 'employer' | 'agreed';

export interface PlanCost {
  key: string;
  /** The form the fee is for, when it's a government fee. */
  form?: string;
  label: string;
  /** Each, and how many. */
  each: number;
  count: number;
  amount: number;
  step: PlanStage;
  payer: Payer;
  /** When it's paid: the day its step starts. */
  due: DayRange | null;
  /** A government fee from the schedule, or one the reader added. */
  source: 'schedule' | 'own';
}

export interface BulletinReading {
  method: BulletinMethod;
  /** Months the cutoff takes to reach the priority date, each way; null where it can't be worked out. */
  byPace: Span | null;
  bySupply: Span | null;
  /** Days between the priority date and the cutoff now. */
  gapDays: number | null;
  /** The day the cutoff should reach the priority date, by the chosen way. */
  reach: DayRange | null;
  /** The same day each way, so the page can set them side by side. */
  reachByPace: DayRange | null;
  reachBySupply: DayRange | null;
}

export interface Plan {
  /** Every milestone's date, known or estimated; null where nothing dates it. */
  milestones: Record<Milestone, DayRange | null>;
  knownMilestones: ReadonlySet<Milestone>;
  steps: PlanStep[];
  /** The work permit and travel document, once the I-485 is dated (none through a consulate). */
  sideSteps: PlanStep[];
  route: GreenCardRoute;
  priorityDate: DayRange | null;
  greenCard: DayRange | null;
  /** True when the priority date is already current in the newest bulletin. */
  current: boolean;
  bulletin: BulletinReading;
  fees: FeeResult;
  costs: PlanCost[];
  totals: { all: number; employer: number; agreed: number };
  /** Dates that can't go together, in plain words. When any, the plan isn't drawn. */
  problems: string[];
}

// ============================================================================
// DATES
// ============================================================================

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const plusDays = (day: string, n: number) => iso(addDays(parseISO(day), Math.round(n)));
const daysFrom = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);
const fixed = (day: string): DayRange => ({ low: day, mid: day, high: day });
const shift = (r: DayRange, s: Span): DayRange => ({ low: plusDays(r.low, s.low), mid: plusDays(r.mid, s.mid), high: plusDays(r.high, s.high) });
const laterRange = (a: DayRange, b: DayRange): DayRange => ({ low: later(a.low, b.low), mid: later(a.mid, b.mid), high: later(a.high, b.high) });
export const monthsToDays = (months: number) => months * DAYS_PER_MONTH_2DP;

/** A span with its ends in order and never negative. */
export function orderedSpan(s: Span): Span {
  const [low, mid, high] = [s.low, s.mid, s.high].map((n) => Math.max(0, n)).sort((a, b) => a - b) as [number, number, number];
  return { low, mid, high };
}

// ============================================================================
// THE BULLETIN
// ============================================================================

/** The line's pace, or the reader's own days a month in its place. */
function paceOf(figures: PlanFigures, key: string): PaceBasis | null {
  const cell = figures.pace[key] ?? null;
  if (!cell || !figures.paceDaysPerMonth || figures.paceDaysPerMonth <= 0) return cell;
  return { ...cell, movedDays: figures.paceDaysPerMonth, spanMonths: 1 };
}

/** Months the cutoff takes to reach `pd` at its pace, widened by how far off the pace has been there. */
function paceMonths(cell: PaceBasis, pd: string, missAt: PlanFigures['missMonthsAt']): { months: Span; gapDays: number } | null {
  const r = monthsToReach(cell, pd);
  if (!r) return null;
  const miss = r.months > 0 ? (missAt?.(r.gapDays) ?? 0) : 0;
  return { months: orderedSpan({ low: r.months - miss, mid: r.months, high: r.months + miss }), gapDays: r.gapDays };
}

/** Months to clear the people ahead at the line's yearly issuance. */
function supplyMonths(supply: PlanFigures['supply']): Span | null {
  if (!supply || !(supply.perYear > 0)) return null;
  const months = (people: number) => (people / supply.perYear) * 12;
  return orderedSpan({ low: months(supply.peopleAhead.low), mid: months(supply.peopleAhead.mid), high: months(supply.peopleAhead.high) });
}

// ============================================================================
// THE PLAN
// ============================================================================

const SCHEDULE_STEP: Record<string, PlanStage> = {
  'I-140': 'i140',
  'Asylum Program Fee': 'i140',
  'I-907': 'i140',
  'I-485': 'i485',
  'I-765': 'i485',
  'I-131': 'i485',
  'DS-260': 'consular',
  'USCIS Immigrant Fee': 'consular',
};
/** A fee paid at a step's end, not its start: USCIS's immigrant fee goes in once the visa is issued, before travel. */
const FEE_DUE_AT: Record<string, Milestone> = { 'USCIS Immigrant Fee': 'greenCard' };

/** Where each own cost falls due, who pays it, and how it's named. */
const OWN_COSTS: readonly {
  key: keyof OwnCosts;
  label: string;
  /** The name through a consulate, where it differs. */
  cpLabel?: string;
  step: PlanStage;
  at: Milestone;
  payer: Payer;
  perPerson?: true;
}[] = [
  { key: 'permAttorney', label: 'Attorney, wage request and PERM', step: 'pwd', at: 'pwdFiled', payer: 'employer' },
  { key: 'recruitment', label: 'Job order, ads and recruitment', step: 'recruitment', at: 'pwdIssued', payer: 'employer' },
  { key: 'i140Attorney', label: 'Attorney, I-140', step: 'i140', at: 'i140Filed', payer: 'agreed' },
  { key: 'i485Attorney', label: 'Attorney, I-485 and its forms', cpLabel: 'Attorney, consular processing', step: 'i485', at: 'i485Filed', payer: 'agreed' },
  {
    key: 'medicalEach',
    label: 'Medical exam (I-693), civil surgeon',
    cpLabel: 'Medical exam, panel physician abroad',
    step: 'i485',
    at: 'i485Filed',
    payer: 'agreed',
    perPerson: true,
  },
];

/** "18,000 cases ahead of yours, at DOL's pace of 625 a day". */
function queueBasis(q: QueueDating, what: string): string {
  return `${Math.round(q.casesAhead).toLocaleString('en-US')} ${what} ahead of yours, at DOL's pace of ${Math.round(q.perDay)} a day`;
}

/** A milestone's name inside a sentence: its label without the note in brackets. */
const nameOf = (label: string) => label.replace(/ \(.*\)$/, '');

/** Dates the reader gave that can't go together, in plain words. */
function checkKnown(known: PlanInput['known']): string[] {
  const out: string[] = [];
  const given = MILESTONES.filter((m) => known[m.key]);
  for (let i = 1; i < given.length; i++) {
    const a = given[i - 1]!;
    const b = given[i]!;
    if (known[b.key]! < known[a.key]!) {
      out.push(`${nameOf(b.label)} (${shortDate(known[b.key])}) is before ${nameOf(a.label)} (${shortDate(known[a.key])}).`);
    }
  }
  const cert = known.permCertified;
  const filed = known.i140Filed;
  if (cert && filed && daysFrom(cert, filed) > I140_FILE_BY_DAYS) {
    out.push(`The I-140 was filed ${daysFrom(cert, filed)} days after certification; it had to go in within 180 days.`);
  }
  return out;
}

/** An estimate never lands after a date the reader gave for a later milestone. */
function holdUnderKnown(at: Record<Milestone, DayRange | null>, known: PlanInput['known']): void {
  let ceiling: string | null = null;
  for (let i = MILESTONE_ORDER.length - 1; i >= 0; i--) {
    const m = MILESTONE_ORDER[i]!;
    const r = at[m];
    if (known[m]) ceiling = known[m]!;
    else if (r && ceiling) at[m] = { low: earlier(r.low, ceiling), mid: earlier(r.mid, ceiling), high: earlier(r.high, ceiling) };
  }
}

export function buildPlan(input: PlanInput, figures: PlanFigures): Plan {
  const { known, today } = input;
  const route: GreenCardRoute = input.route ?? 'aos';
  const stages = planStages(route);
  const last: PlanStage = route === 'cp' ? 'consular' : 'i485';
  const problems = checkKnown(known);
  const knownSet = new Set(MILESTONE_ORDER.filter((k) => known[k]));
  const first = MILESTONE_ORDER.find((k) => known[k]) ?? null;
  // With nothing known the plan starts at the wage request, on the day it'll be filed.
  const startAt: Milestone = first ?? 'pwdFiled';
  const startIdx = MILESTONE_ORDER.indexOf(startAt);

  const at: Record<Milestone, DayRange | null> = Object.fromEntries(MILESTONE_ORDER.map((k) => [k, null])) as Record<Milestone, DayRange | null>;
  at[startAt] = fixed(known[startAt] ?? input.startOn);
  const basis: Partial<Record<PlanStage, string>> = {};

  // Each step's length as the plan uses it: recruitment never under the rules' minimum, the
  // I-140's preparation never past the certification's last day.
  const rec = orderedSpan(figures.spans.recruitment);
  const recruitmentSpan: Span = { low: Math.max(rec.low, RECRUITMENT_MIN_DAYS), mid: Math.max(rec.mid, RECRUITMENT_MIN_DAYS), high: Math.max(rec.high, RECRUITMENT_MIN_DAYS) };
  const prep = orderedSpan(figures.spans.i140Prep);
  const prepSpan: Span = { low: Math.min(prep.low, I140_FILE_BY_DAYS), mid: Math.min(prep.mid, I140_FILE_BY_DAYS), high: Math.min(prep.high, I140_FILE_BY_DAYS) };
  const spanOf: Partial<Record<PlanStage, Span | null>> = { pwd: figures.spans.pwd, recruitment: recruitmentSpan, perm: figures.spans.perm, i140Prep: prepSpan };

  // The steps before the first date the reader gave have happened: each is dated back from it
  // with today's lengths, an estimate the page marks as one, so the plan always runs end to end.
  for (let i = startIdx - 1; i >= 0; i--) {
    const stage = PLAN_STAGES.find((s) => s.from === MILESTONE_ORDER[i] && s.to === MILESTONE_ORDER[i + 1]);
    const span = stage ? spanOf[stage.key] : null;
    const next = at[MILESTONE_ORDER[i + 1]!];
    if (!stage || !span || !next) break;
    const o = orderedSpan(span);
    at[MILESTONE_ORDER[i]!] = { low: plusDays(next.low, -o.high), mid: plusDays(next.mid, -o.mid), high: plusDays(next.high, -o.low) };
    basis[stage.key] = "Before your first date: dated back from it with today's lengths";
  }

  // The steps up to the I-140's decision chain one after another.
  // A milestone the reader says has happened but gave no date for. The one the case stands at is
  // counted as reached today, so every step after it starts now (dated from an estimate in the
  // past, a certified case would show its I-140 long done). One before it is on or before today.
  const reachedIdx = input.reached ? MILESTONE_ORDER.indexOf(input.reached) : -1;
  const settle = (m: Milestone): boolean => {
    const r = at[m];
    const idx = MILESTONE_ORDER.indexOf(m);
    if (known[m] || !r || idx > reachedIdx) return false;
    if (idx === reachedIdx) at[m] = fixed(today);
    else {
      const notAfterToday = (d: string) => (d > today ? today : d);
      at[m] = { low: notAfterToday(r.low), mid: notAfterToday(r.mid), high: notAfterToday(r.high) };
    }
    return true;
  };
  const chain = (stage: PlanStage, span: Span | null, why: string) => {
    const s = stageInfo(stage);
    if (MILESTONE_ORDER.indexOf(s.to) <= startIdx) return;
    const from = at[s.from];
    if (known[s.to]) at[s.to] = fixed(known[s.to]!);
    else if (from && span) at[s.to] = shift(from, orderedSpan(span));
    basis[stage] = knownSet.has(s.to) ? 'Your date' : settle(s.to) ? DONE_UNDATED : why;
  };

  // A filed wage request still waiting is dated by the requests ahead of it, when known.
  const pwdQueue =
    figures.pwdByQueue && known.pwdFiled && known.pwdFiled <= today && !known.pwdIssued && reachedIdx < MILESTONE_ORDER.indexOf('pwdIssued')
      ? figures.pwdByQueue
      : null;
  if (pwdQueue) {
    at.pwdIssued = { low: pwdQueue.low, mid: pwdQueue.mid, high: pwdQueue.high };
    basis.pwd = queueBasis(pwdQueue, 'wage requests');
  } else {
    chain('pwd', figures.spans.pwd, "DOL's wait now, from the filing days it decided last");
  }
  chain('recruitment', recruitmentSpan, 'The time employers took, first recruitment step to filing');

  // The PERM: a case already filed is dated from the cases still ahead of it, when known.
  const pd = at.permFiled;
  const byQueue =
    figures.permByQueue && known.permFiled && known.permFiled <= today && !known.permCertified && reachedIdx < MILESTONE_ORDER.indexOf('permCertified')
      ? figures.permByQueue
      : null;
  if (byQueue) {
    at.permCertified = { low: byQueue.low, mid: byQueue.mid, high: byQueue.high };
    basis.perm = queueBasis(byQueue, 'cases');
  } else {
    chain('perm', figures.spans.perm, "DOL's wait now, from the filing days it decided last");
  }

  chain('i140Prep', prepSpan, "Your attorney's timing, inside the 180 days");

  // The I-140: premium processing is fixed in business days.
  const i140Info = stageInfo('i140');
  if (MILESTONE_ORDER.indexOf(i140Info.to) > startIdx) {
    if (known.i140Approved) at.i140Approved = fixed(known.i140Approved);
    else if (at.i140Filed && input.premium) {
      const f = at.i140Filed;
      at.i140Approved = {
        low: addBusinessDays(f.low, PREMIUM_I140_BUSINESS_DAYS),
        mid: addBusinessDays(f.mid, PREMIUM_I140_BUSINESS_DAYS),
        high: addBusinessDays(f.high, PREMIUM_I140_BUSINESS_DAYS),
      };
    } else if (at.i140Filed && figures.spans.i140[input.category]) {
      at.i140Approved = shift(at.i140Filed, orderedSpan(figures.spans.i140[input.category]!));
    }
    basis.i140 = known.i140Approved
      ? 'Your date'
      : settle('i140Approved')
        ? DONE_UNDATED
        : input.premium
          ? `Premium processing, ${PREMIUM_I140_BUSINESS_DAYS} business days`
          : "USCIS's medians and its 80% figure";
  }
  holdUnderKnown(at, known);

  // The bulletin: the cutoff has to pass the priority date, by its pace or by the people ahead.
  const cell = paceOf(figures, `${input.category}|${input.country}`);
  const latest = cell?.latest ?? null;
  const pdMid = pd?.mid ?? null;
  const current = !!pdMid && (latest?.kind === 'current' || (latest?.kind === 'date' && pdMid < latest.iso));
  const method: BulletinMethod = figures.bulletinMethod ?? 'pace';
  const byPace = cell && pdMid && !current ? paceMonths(cell, pdMid, figures.missMonthsAt) : null;
  const bySupply = pdMid && !current ? supplyMonths(figures.supply) : null;
  const bulletinFrom = figures.bulletinMonth ? `${figures.bulletinMonth}-01` : today;
  const reachIn = (m: Span | null): DayRange | null =>
    m ? { low: plusDays(bulletinFrom, monthsToDays(m.low)), mid: plusDays(bulletinFrom, monthsToDays(m.mid)), high: plusDays(bulletinFrom, monthsToDays(m.high)) } : null;
  const reachByPace = current ? null : reachIn(byPace?.months ?? null);
  const reachBySupply = current ? null : reachIn(bySupply);
  const reach: DayRange | null = current ? fixed(bulletinFrom) : method === 'supply' ? reachBySupply : reachByPace;

  // The I-485 goes in once the cutoff passes the priority date and the I-140 is in:
  // with the I-140 when the date is already current (concurrent filing). Through a consulate
  // there's no concurrent filing: NVC takes the case only after the I-140 is approved, creates
  // it (its own weekly figure), and the documents go in once the date is current.
  if (known.i485Filed) at.i485Filed = fixed(known.i485Filed);
  else if (route === 'cp') {
    const created = at.i140Approved && figures.nvcCreation ? shift(at.i140Approved, orderedSpan(figures.nvcCreation)) : at.i140Approved;
    if (reach && created) at.i485Filed = laterRange(reach, created);
  } else if (reach && at.i140Filed) at.i485Filed = laterRange(reach, at.i140Filed);
  else if (reach && startIdx >= MILESTONE_ORDER.indexOf('i140Approved') && at.i140Approved) at.i485Filed = laterRange(reach, at.i140Approved);
  basis.visa = knownSet.has('i485Filed')
    ? 'Your date'
    : settle('i485Filed')
      ? DONE_UNDATED
      : current
      ? 'Current in the newest bulletin: no wait'
      : method === 'supply'
        ? 'People ahead of you, at the green cards issued in your line a year'
        : figures.paceDaysPerMonth
          ? `Your pace, ${figures.paceDaysPerMonth} days a month`
          : "The cutoff's measured pace";

  const lastSpan = route === 'cp' ? figures.spans.consular : figures.spans.i485;
  if (known.greenCard) at.greenCard = fixed(known.greenCard);
  else if (at.i485Filed && lastSpan) at.greenCard = shift(at.i485Filed, orderedSpan(lastSpan));
  basis[last] = knownSet.has('greenCard')
    ? 'Your date'
    : route === 'cp'
      ? "NVC's document review this week, then the consulate's interview wait, an assumption"
      : "USCIS's employment-based medians, the last four quarters";
  holdUnderKnown(at, known);

  // Every step, end to end: the ones before the first date the reader gave are done.
  const state = (start: DayRange, end: DayRange | null): StepState =>
    end && end.mid <= today ? 'done' : start.mid <= today ? 'now' : 'ahead';
  const steps: PlanStep[] = [];
  for (const s of stages) {
    if (MILESTONE_ORDER.indexOf(s.to) <= startIdx) {
      const [start, end] = [at[s.from], at[s.to]];
      if (start && end) {
        steps.push({ ...s, start, end, known: { start: knownSet.has(s.from), end: knownSet.has(s.to) }, state: 'done', basis: basis[s.key] ?? '' });
      }
      continue;
    }
    // The visa wait runs from the I-140's decision to the I-485; a current date has none,
    // so it sits on the day the I-485 goes in.
    const start =
      s.key !== 'visa'
        ? at[s.from]
        : current
          ? (at.i485Filed ?? (route === 'cp' ? at.i140Approved : at.i140Filed))
          : (at.i140Approved ?? at.i140Filed ?? at[startAt]);
    if (!start) {
      steps.push({ ...s, start: at[startAt]!, end: null, known: { start: false, end: false }, state: 'ahead', basis: basis[s.key] ?? 'Waits on the step before' });
      continue;
    }
    const end = at[s.to];
    steps.push({
      ...s,
      start,
      end,
      known: { start: knownSet.has(s.from), end: knownSet.has(s.to) },
      state: knownSet.has(s.to) ? 'done' : state(start, end),
      basis: basis[s.key] ?? '',
    });
  }

  // The work permit and travel document ride the pending I-485; a consulate has neither.
  const sideSteps: PlanStep[] = [];
  if (at.i485Filed && route === 'aos') {
    for (const side of SIDE_STAGES) {
      const span = figures.spans[side.key];
      const end = span ? shift(at.i485Filed, orderedSpan(span)) : null;
      sideSteps.push({
        key: side.key,
        name: side.name,
        owner: 'uscis',
        detail: `Filed with the I-485 on Form ${side.form}, decided while it waits.`,
        from: 'i485Filed',
        to: 'greenCard',
        start: at.i485Filed,
        end,
        known: { start: knownSet.has('i485Filed'), end: false },
        state: state(at.i485Filed, end),
        basis: `USCIS's ${side.form} medians, the last four quarters`,
      });
    }
  }

  // Every cost, on the day its step starts.
  const fees = calculateGreenCardFees({ ...input.fees, premium: input.premium, route });
  const due = (m: Milestone) => at[m];
  const costs: PlanCost[] = fees.lines.map((l: FeeLine) => {
    const step = SCHEDULE_STEP[l.form] ?? last;
    return {
      key: `${l.form} ${l.label}`,
      form: l.form,
      label: l.label,
      each: l.each,
      count: l.count,
      amount: l.total,
      step,
      payer: 'agreed' as const,
      due: due(FEE_DUE_AT[l.form] ?? stageInfo(step).from),
      source: 'schedule' as const,
    };
  });
  const people = input.fees.adults + (input.fees.children ?? 0);
  for (const c of OWN_COSTS) {
    const each = input.own?.[c.key] ?? 0;
    if (!(each > 0)) continue;
    const count = c.perPerson ? people : 1;
    const label = route === 'cp' ? (c.cpLabel ?? c.label) : c.label;
    const step = c.step === 'i485' ? last : c.step;
    costs.push({ key: c.key, label, each, count, amount: each * count, step, payer: c.payer, due: due(c.at), source: 'own' });
  }
  const sum = (p?: Payer) => costs.filter((c) => !p || c.payer === p).reduce((n, c) => n + c.amount, 0);

  return {
    milestones: at,
    knownMilestones: knownSet,
    steps,
    sideSteps,
    route,
    priorityDate: pd,
    greenCard: at.greenCard,
    current,
    bulletin: { method, byPace: byPace?.months ?? null, bySupply, gapDays: byPace?.gapDays ?? (current ? 0 : null), reach, reachByPace, reachBySupply },
    fees,
    costs,
    totals: { all: sum(), employer: sum('employer'), agreed: sum('agreed') },
    problems,
  };
}
