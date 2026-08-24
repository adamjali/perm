import { addDays, differenceInCalendarDays } from 'date-fns';
import { formatUTC, validateISODate } from '../dates/dateUtils';
import { calculatePWDExpiration } from './pwd';
import { calculateETA9089Window } from './eta9089';

/**
 * The employment-based green card, end to end.
 *
 * Composes the stages rather than modelling anything new: the prevailing wage
 * queue, the statutory recruitment and filing windows, DOL's decision queue,
 * and the I-140. Its job is to show how they chain, and in particular that the
 * two stages people can actually control sit between two they cannot.
 *
 * Every stage carries its own certainty, and they differ enormously:
 *
 *   - `statutory`  fixed by 20 CFR 656. A wrong date here is a bug.
 *   - `queue`      a forecast over a government backlog, wrong by construction.
 *   - `unknown`    genuinely not knowable from published data.
 *
 * Collapsing those into one number would produce a total that looks precise
 * and is not. A caller must render the certainty alongside the duration.
 *
 * The visa bulletin stage is deliberately absent. Cutoff dates come only from
 * travel.state.gov, which refuses automated clients, and inventing or
 * second-sourcing them would put a legally consequential date on the page
 * without a source we can stand behind.
 */

// ============================================================================
// TYPES
// ============================================================================

export type StageCertainty = 'statutory' | 'queue' | 'unknown';

export interface TimelineStage {
  id: string;
  label: string;
  /** What actually happens in this stage, in plain words. */
  detail: string;
  certainty: StageCertainty;
  /** Typical months for this stage, or null when it is not knowable. */
  months: number | null;
  /** Who controls the pace here. */
  controlledBy: 'employer' | 'government';
}

export interface GreenCardTimelineInput {
  /**
   * Typical months waiting on a prevailing wage determination.
   * Measured from DOL's published backlog, or null when unmeasurable.
   */
  pwdQueueMonths: number | null;
  /**
   * Typical months from ETA-9089 filing to a DOL decision.
   * From DOL's published average, or null.
   */
  permDecisionMonths: number | null;
  /** Typical months for the I-140, from USCIS's published figures, or null. */
  i140Months: number | null;
}

export interface GreenCardTimeline {
  stages: TimelineStage[];
  /** Months across every stage with a figure. Null if none have one. */
  totalKnownMonths: number | null;
  /** Stages whose duration is not knowable, named so the total reads honestly. */
  unknownStages: string[];
  /** Months of the total that the employer, rather than a queue, controls. */
  employerControlledMonths: number;
}

// The statutory windows, which are the same for every case and are the reason
// this stage is `statutory` rather than `queue`. Recruitment must run at least
// 30 days, then a 30-day quiet period, and the whole thing expires at 180 days
// from the first recruitment step.
const RECRUITMENT_MIN_MONTHS = 2;

/**
 * Build the stage list.
 *
 * A stage with no figure is still returned, with `months: null`. Dropping it
 * would make the timeline read as though the step does not exist, which is the
 * opposite of the honest outcome.
 */
export function buildGreenCardTimeline(
  input: GreenCardTimelineInput,
): GreenCardTimeline {
  const stages: TimelineStage[] = [
    {
      id: 'pwd',
      label: 'Prevailing wage determination',
      detail:
        'DOL rules on the minimum wage the job must pay. Nothing else can start until it is issued, and the date it is issued sets every deadline that follows.',
      certainty: 'queue',
      months: input.pwdQueueMonths,
      controlledBy: 'government',
    },
    {
      id: 'recruitment',
      label: 'Recruitment and the quiet period',
      detail:
        'A job order, two Sunday advertisements and a notice of filing, then 30 days in which no application may be filed. Both windows are fixed by regulation and both are on the employer.',
      certainty: 'statutory',
      months: RECRUITMENT_MIN_MONTHS,
      controlledBy: 'employer',
    },
    {
      id: 'perm',
      label: 'PERM decision',
      detail:
        'DOL works through filing months in order and goes alphabetically by employer within a month. An audit or a request for information takes a case out of that order.',
      certainty: 'queue',
      months: input.permDecisionMonths,
      controlledBy: 'government',
    },
    {
      id: 'i140',
      label: 'I-140 petition',
      detail:
        'USCIS decides the immigrant petition. Premium processing buys a first review in 15 business days for most categories, or 45 for EB-1C and national interest waivers.',
      certainty: 'queue',
      months: input.i140Months,
      controlledBy: 'government',
    },
    {
      id: 'priority-date',
      label: 'Waiting for a visa number',
      detail:
        'How long depends on the category and the country of birth, and for some it is the longest stage by far. The cutoff dates come only from the monthly visa bulletin, which is not something this can read.',
      certainty: 'unknown',
      months: null,
      controlledBy: 'government',
    },
  ];

  const known = stages.filter((s) => s.months !== null);
  const totalKnownMonths =
    known.length > 0 ? known.reduce((sum, s) => sum + (s.months as number), 0) : null;

  return {
    stages,
    totalKnownMonths,
    unknownStages: stages.filter((s) => s.months === null).map((s) => s.label),
    employerControlledMonths: known
      .filter((s) => s.controlledBy === 'employer')
      .reduce((sum, s) => sum + (s.months as number), 0),
  };
}

/**
 * The statutory dates a prevailing wage determination fixes.
 *
 * Separate from the stage list because these are exact. Everything above is a
 * duration; this returns actual dates a case has to hit.
 */
export function keyDatesFromPwd(determinationDate: string): {
  pwdExpires: string;
  latestRecruitmentStart: string;
  filingWindowClosesIfRecruitmentStartsToday: string;
} {
  const determined = validateISODate(determinationDate, 'determinationDate');
  const pwdExpires = calculatePWDExpiration(determinationDate);

  // Recruitment has to finish inside the determination's validity, and the
  // filing window closes 180 days after it starts, so the last useful start is
  // bounded by both.
  const expiry = validateISODate(pwdExpires, 'pwdExpires');
  const daysToExpiry = differenceInCalendarDays(expiry, determined);
  const latestStart = addDays(determined, Math.max(daysToExpiry - 60, 0));

  const window = calculateETA9089Window(determined, determined);

  return {
    pwdExpires,
    latestRecruitmentStart: formatUTC(latestStart),
    filingWindowClosesIfRecruitmentStartsToday: formatUTC(window.closes),
  };
}
