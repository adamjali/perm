/**
 * The per-case decision estimate: cohort models, adjusted for the stage the
 * case is actually at.
 *
 * COMPOSITION, NOT A NEW MODEL. The models come from the canonical
 * `estimateQueueDecision` (the same composite the timeline calculator
 * renders); the stage placement comes from `queueForecast`'s measured
 * percentile table (RFI sits at its cohort's p90, a hold at p75, appeals get
 * no percentile at all). This file only decides which piece speaks for one
 * concrete case, and where the honest answer is a refusal.
 *
 * THE ESTIMATE IS LABELED AS AN ESTIMATE, EVERYWHERE IT RENDERS. The case
 * page's first block is still the federal record; this is the block after
 * it, and it never upgrades a cohort statistic into a promise about the
 * case. The page's remaining structural refusal - no odds scoring - stands:
 * a date window from a named model is checkable, "87% chance of approval"
 * is not.
 */

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { estimateQueueDecision } from "@/lib/perm";
import {
  COHORT_PERCENTILE_FACTOR,
  placeCaseInCohort,
} from "@/lib/queueForecast";
import type { EstimatorData } from "@/lib/turso/estimate";

export interface CaseEstimateInput {
  /**
   * Measured stage ages from `stage_stats`, keyed by status. Optional: absent,
   * `placeCaseInCohort` falls back to its own table, which is what shipped
   * before this existed.
   */
  measuredStageAges?: ReadonlyMap<string, number>;
  /**
   * Where cases at this status have actually been observed to go next, as a
   * share of the exits we watched. Optional and often absent.
   */
  stageExit?: { to: string; share: number; observed: number } | null;
  /**
   * How long this stage has actually been taking, or null while too few of the
   * cases we watched enter it have left for the median to be observed. Turns
   * itself on when the data supports it; nothing here needs a flag.
   */
  stageDuration?: {
    p50: number;
    eligible: number;
    entered: number;
    windowDays: number;
  } | null;
  /** The case's filing date, `YYYY-MM-DD`, or null when unknown. */
  filingDate: string | null;
  /** Live DOL status, or null. */
  status: string | null;
  isFinal: boolean;
  estimator: Pick<
    EstimatorData,
    "frontier" | "cohorts" | "frontierAdvance"
  > | null;
  /**
   * Days to shift for the employer's initial, MEASURED, or null.
   *
   * The case page knows the employer because DOL names it, so this costs the
   * reader no extra input: the initial is derived from a fact already on
   * screen. It is looked up from `perm_docs.alphabet` and never invented.
   */
  letterDeltaDays?: number | null;
  /** `YYYY-MM-DD`, injected so the function stays pure. */
  today: string;
}

export type CaseEstimate =
  | {
      kind: "date";
      /** Stage-adjusted central estimate, `YYYY-MM-DD`. */
      estimatedDate: string;
      /** The unadjusted model date, for the delta line. */
      modelDate: string;
      earliestDate: string | null;
      latestDate: string | null;
      /** Stage-adjusted calendar days from filing. */
      totalDays: number;
      /** Which model produced the base figure. */
      modelLabel: string;
      basis: string;
      source: string;
      /** Null when the status is unmeasured and the estimate is unadjusted. */
      stage: { percentile: number; note: string } | null;
      caveats: string[];
    }
  | {
      kind: "no-date";
      /** Why no date exists for this case, in one sentence. */
      note: string;
      /**
       * A measured waiting time, and WHOSE it is.
       *
       * This used to be a bare `observedAgeDays` documented as "mean days
       * cases at this stage have already been pending", with two producers
       * that meant different things: the stage branch put the measured
       * population mean in it (170 to 714 days, from queueForecast), and the
       * overdue branch put `today - this case's filing date` in it. The panel
       * rendered one sentence for both - "Cases at this stage have been
       * pending a measured average of N days" - so for every overdue case it
       * presented that one case's own wait as a population average.
       *
       * It was invisible because both numbers are in the same range and both
       * look plausible. The discriminator is here so the copy cannot claim
       * more than the number is.
       */
      age:
        | { of: "stage"; days: number }
        | { of: "this-case"; days: number };
      /**
       * What usually happens NEXT at this stage, when we have watched enough
       * exits to say. This is the most useful true thing available to a reader
       * whose case has no date: of the RFI exits observed, about nine in ten
       * return to ANALYST REVIEW rather than to a decision, so an RFI is a
       * detour back into the ordinary queue and not an endpoint.
       *
       * Destinations only. The event log opens 2026-08-26 and cannot see an
       * entry before it, so it can say WHERE a case goes and nothing about how
       * long it takes to get there.
       */
      nextStep?: { to: string; share: number; observed: number } | null;
      /** Measured time at this stage, once enough watched entrants have left. */
      stageDuration?: {
        p50: number;
        eligible: number;
        entered: number;
        windowDays: number;
      } | null;
    };

/**
 * Build the estimate for one case, or null when nothing defensible exists.
 *
 * Null - never a guess - for: a decided case (nothing left to estimate), a
 * case with no filing date (A- numbers cannot be date-decoded), missing
 * estimator data (deploy skew), or a month no model can speak to.
 */
export function buildCaseEstimate(input: CaseEstimateInput): CaseEstimate | null {
  if (input.isFinal) return null;
  if (!input.filingDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.filingDate)) return null;

  // A decision already EXISTS for this case - the outcome just hasn't
  // settled into the live status yet. Offering "when could this be decided"
  // here would estimate an event that has already happened, which is the
  // most checkably-wrong sentence this page could print. Caught on the first
  // rendered QA pass against a real case in exactly this state.
  const canon = input.status?.trim().toUpperCase().replace(/\s+/g, " ");
  if (canon === "DETERMINATION ISSUED") return null;

  // Appeals first: they are a different proceeding, and even a perfect cohort
  // model has no standing to date them. The measured age is the honest read.
  const place = placeCaseInCohort(input.status, input.measuredStageAges);
  if (place && place.percentile === null) {
    return {
      kind: "no-date",
      note: place.note,
      age: { of: "stage", days: place.observedAgeDays },
      nextStep: input.stageExit ?? null,
      stageDuration: input.stageDuration ?? null,
    };
  }

  if (!input.estimator) return null;

  const est = estimateQueueDecision({
    filingDate: input.filingDate,
    today: input.today,
    frontier: input.estimator.frontier,
    cohorts: input.estimator.cohorts,
    letterDeltaDays: input.letterDeltaDays ?? null,
    frontierAdvanceRate: input.estimator.frontierAdvance
      ? input.estimator.frontierAdvance.rate
      : null,
    frontierAdvanceRange:
      input.estimator.frontierAdvance &&
      input.estimator.frontierAdvance.slowest &&
      input.estimator.frontierAdvance.fastest
        ? {
            slowest: input.estimator.frontierAdvance.slowest,
            fastest: input.estimator.frontierAdvance.fastest,
          }
        : null,
  });

  // Models arrive most-defensible-first; the head is the one the timeline
  // page leads with too. No models means no answer, not a made-up one -
  // except the overdue case, where the absence IS the answer: the calculator
  // withholds every filing-anchored model once the frontier has passed the
  // month (their dates have already elapsed), and what remains true is that
  // a case still pending here is out of filing order.
  const model = est.models[0];
  if (!model) {
    if (est.position === "overdue") {
      const passedBy =
        est.monthsBehindFrontier !== null
          ? Math.abs(est.monthsBehindFrontier)
          : null;
      return {
        kind: "no-date",
        nextStep: input.stageExit ?? null,
        stageDuration: input.stageDuration ?? null,
        note:
          `DOL's queue ${passedBy ? `passed this filing month ${passedBy} month${passedBy === 1 ? "" : "s"} ago` : "has passed this filing month"}. ` +
          "A case still pending at that point has usually been taken out of filing order by an audit, a request for information, or a hold, and none of those can be dated from the filing month. The live status above is the accurate read.",
        // THIS case's own wait, not a population statistic. The overdue
        // branch has no measured stage to average over - that is what makes
        // it the overdue branch.
        age: {
          of: "this-case",
          days: differenceInCalendarDays(
            parseISO(input.today),
            parseISO(input.filingDate),
          ),
        },
      };
    }
    return null;
  }

  const factor =
    place && place.percentile !== null
      ? (COHORT_PERCENTILE_FACTOR[place.percentile] ?? 1)
      : 1;

  const filing = parseISO(input.filingDate);
  const shiftDate = (iso: string | null): string | null => {
    if (!iso) return null;
    const days = differenceInCalendarDays(parseISO(iso), filing);
    return format(addDays(filing, Math.round(days * factor)), "yyyy-MM-dd");
  };

  const totalDays = Math.round(model.totalDays * factor);
  const caveats = [...est.caveats];
  if (!place && input.status) {
    caveats.push(
      "This status hasn't been measured against its filing month, so the estimate reads the middle of the month rather than adjusting for the stage.",
    );
  }

  return {
    kind: "date",
    estimatedDate: format(addDays(filing, totalDays), "yyyy-MM-dd"),
    modelDate: model.estimatedDate,
    earliestDate: shiftDate(model.earliestDate),
    latestDate: shiftDate(model.latestDate),
    totalDays,
    modelLabel: model.label,
    basis: model.basis,
    source: model.source,
    stage:
      place && place.percentile !== null
        ? { percentile: place.percentile, note: place.note }
        : null,
    caveats,
  };
}
