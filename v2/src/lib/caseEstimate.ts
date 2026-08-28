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
  /** The case's filing date, `YYYY-MM-DD`, or null when unknown. */
  filingDate: string | null;
  /** Live DOL status, or null. */
  status: string | null;
  isFinal: boolean;
  estimator: Pick<
    EstimatorData,
    "frontier" | "cohorts" | "frontierAdvance"
  > | null;
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
      /** Mean days cases at this stage have already been pending. Measured. */
      observedAgeDays: number;
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

  // Appeals first: they are a different proceeding, and even a perfect cohort
  // model has no standing to date them. The measured age is the honest read.
  const place = placeCaseInCohort(input.status);
  if (place && place.percentile === null) {
    return {
      kind: "no-date",
      note: place.note,
      observedAgeDays: place.observedAgeDays,
    };
  }

  if (!input.estimator) return null;

  const est = estimateQueueDecision({
    filingDate: input.filingDate,
    today: input.today,
    frontier: input.estimator.frontier,
    cohorts: input.estimator.cohorts,
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
  // page leads with too. No models means no answer, not a made-up one.
  const model = est.models[0];
  if (!model) return null;

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
