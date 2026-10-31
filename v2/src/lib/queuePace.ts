/**
 * How fast DOL's PERM queue has actually moved.
 *
 * DOL publishes where the queue stands today and keeps no archive, so its rate
 * of advance is unreadable from DOL. We keep the snapshots, which makes this
 * arithmetic on two figures DOL published rather than a model: the frontier
 * then, the frontier now, and the time between them.
 *
 * ## The line this must never cross
 *
 * "The queue moved three months in the last six" is a measurement. "So you'll
 * be reached in March" is a projection, and this module deliberately gives a
 * caller nothing to build one from beyond the two numbers themselves. Rate of
 * advance is not constant, DOL reprioritises, and an alert that implied a date
 * would be the exact false certainty the product exists to avoid.
 *
 * Kept out of `dolFormat.ts` on purpose: that module's docstring promises every
 * function in it is presentation only and derives nothing. This derives.
 *
 * @module
 */

import { monthsMoved } from "./dolFormat";

/** One published observation of where the queue stood. */
export interface FrontierSnapshot {
  /** The analyst-review frontier, "YYYY-MM". */
  frontier: string | null | undefined;
  /** DOL's as-of date for that figure, "YYYY-MM-DD". */
  asOf: string | null | undefined;
}

export interface QueuePace {
  /** Whole months the frontier advanced across the window. */
  months: number;
  /** Whole months the window itself spans. */
  overMonths: number;
}

/**
 * Shortest window worth quoting.
 *
 * DOL publishes roughly monthly and the frontier moves in whole-month steps, so
 * over one or two months the figure is one step of quantisation rather than a
 * rate. Three months is the floor at which the number says something.
 */
const MIN_WINDOW_MONTHS = 3;

/**
 * Measure the frontier's advance from a list of snapshots, newest first.
 *
 * Returns null rather than a shaky figure whenever the data cannot support one:
 * fewer than two usable snapshots, an unparseable month, or a window shorter
 * than {@link MIN_WINDOW_MONTHS}. A null is visible to the caller and produces
 * no line; a plausible wrong number is neither.
 *
 * A zero or negative advance is returned as measured, not suppressed. The queue
 * genuinely does stall and DOL genuinely does revise backwards, and it is the
 * caller's job to decide whether a given reading is worth showing.
 */
export function measureQueuePace(
  snapshotsNewestFirst: readonly FrontierSnapshot[],
): QueuePace | null {
  const usable = snapshotsNewestFirst.filter(
    (s): s is { frontier: string; asOf: string } =>
      typeof s.frontier === "string" && typeof s.asOf === "string",
  );
  if (usable.length < 2) return null;

  const newest = usable[0];
  const oldest = usable[usable.length - 1];
  if (!newest || !oldest) return null;

  // The as-of dates are "YYYY-MM-DD" and monthsMoved wants "YYYY-MM".
  const overMonths = monthsMoved(oldest.asOf.slice(0, 7), newest.asOf.slice(0, 7));
  if (overMonths === null || overMonths < MIN_WINDOW_MONTHS) return null;

  const months = monthsMoved(oldest.frontier, newest.frontier);
  if (months === null) return null;

  return { months, overMonths };
}

/**
 * The one sentence a queue email may say about pace, or null for silence.
 *
 * Only a forward advance gets a sentence. A stalled or reversed queue is a real
 * and interesting fact, but it is not one to deliver inside a one-shot alert
 * that a person has waited a year for and cannot reply to.
 */
export function paceSentence(pace: QueuePace | null): string | null {
  if (!pace || pace.months < 1) return null;
  const m = pace.months === 1 ? "1 month" : `${pace.months} months`;
  const w = pace.overMonths === 1 ? "1 month" : `${pace.overMonths} months`;
  return `DOL’s queue has moved ${m} over the last ${w}.`;
}
