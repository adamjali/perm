import "server-only";

import { cache } from "react";

import { one } from "./client";

/**
 * What each review stage looks like right now, measured rather than typed.
 *
 * `queueForecast.ts` carries a per-stage table, and its `observedAgeDays`
 * values were hardcoded once and never revisited. Checked against the live
 * table on 2026-09-10 they had drifted, one of them by nearly three months:
 *
 *     ANALYST REVIEW            170 -> 162
 *     APPLICATION ON HOLD       223 -> 229
 *     RFI ISSUED                375 -> 362
 *     NORD ISSUED               697 -> 684
 *     BALCA APPEALS             714 -> 716
 *     RECONSIDERATION APPEALS   624 -> 539
 *     REQUEST FOR REVIEW          - -> 506   (absent from the table entirely)
 *
 * A figure that only changes when somebody edits it is not a measurement, and
 * "self-updating" was the explicit ask.
 *
 * WHAT DOES NOT MOVE: the percentile each stage maps to. That says what a
 * stage MEANS - an RFI sits in the slow tail of its filing month, an appeal is
 * a separate proceeding no percentile of that month describes - and it is
 * editorial judgement, not something a nightly aggregate should decide.
 */
export interface StageStat {
  status: string;
  pending: number;
  /** Days cases at this stage have ALREADY waited since filing. Never remaining. */
  meanAgeDays: number;
}

export interface StageMove {
  from: string;
  to: string;
  n: number;
}

/** One point on a stage's survival curve: of those old enough to reach `days`, how many had left. */
export interface StageCurvePoint {
  days: number;
  /** Entrants observed for at least this long. */
  eligible: number;
  /** How many of THOSE had left by then. */
  left: number;
}

/** How long a stage lasts, over the cases we watched enter it. */
export interface StageDuration {
  stage: string;
  /** Cases we watched ENTER. Only these can be timed. */
  entered: number;
  /** How many days the oldest watched entrant has been observed. */
  observedDays: number;
  curve: StageCurvePoint[];
}

export interface StageStats {
  asOf: string;
  source: string;
  stages: StageStat[];
  exits: StageMove[];
  durations?: StageDuration[];
}

/**
 * Older than this and the doc is treated as absent.
 *
 * The sweep writes it twice a day, so a fortnight is a long silence. A stale
 * stage age is worse than no stage age: it is a specific number, presented as
 * current, that nobody has a reason to doubt.
 */
const MAX_AGE_DAYS = 14;

export const getStageStats = cache(async (): Promise<StageStats | null> => {
  const row = await one<{ json: string; computed_at: number }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = 'stage_stats'",
  ).catch(() => null);
  if (!row?.json) return null;
  const ageDays = (Date.now() - Number(row.computed_at ?? 0)) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > MAX_AGE_DAYS) return null;
  try {
    const doc = JSON.parse(row.json) as StageStats;
    if (!Array.isArray(doc.stages) || doc.stages.length === 0) return null;
    return {
      ...doc,
      exits: Array.isArray(doc.exits) ? doc.exits : [],
      durations: Array.isArray(doc.durations) ? doc.durations : [],
    };
  } catch {
    return null;
  }
});

/** Measured ages keyed by status, for `queueForecast` to prefer over its table. */
export function ageByStatusFrom(stats: StageStats | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of stats?.stages ?? []) {
    if (s.meanAgeDays > 0) out.set(s.status.toUpperCase(), s.meanAgeDays);
  }
  return out;
}

/**
 * Where a stage's cases actually go, as a share of the exits we have watched.
 *
 * THIS IS THE PART NOBODY IS TOLD. Of the RFI exits observed, about nine in
 * ten return to ANALYST REVIEW rather than to a decision: an RFI is a detour
 * back into the ordinary queue, not an endpoint. For a reader whose case sits
 * at an RFI with no date attached, that is the most useful true thing
 * available.
 *
 * DESTINATIONS ONLY, NEVER DURATION. The event log opens 2026-08-26 and cannot
 * see an entry before it, so the exits we watch are biased toward stages that
 * were already running - fine for "where does it go", useless for "how long
 * does it take". Measured 2026-09-10: 422 RFI entries watched, 3 exits seen.
 */
export function exitMixFor(
  stats: StageStats | null,
  status: string,
): { to: string; share: number; observed: number } | null {
  const key = status.trim().toUpperCase();
  const rows = (stats?.exits ?? []).filter((e) => e.from.toUpperCase() === key);
  const total = rows.reduce((sum, e) => sum + e.n, 0);
  // Two floors, and the second is the one that matters. The writer's SQL drops
  // destinations seen fewer than 3 times, so a stage with only ONE surviving
  // row reports a 100% share that is an artifact of that cutoff rather than a
  // finding - NORD ISSUED reads 37/37 to DENIED purely because its other
  // destinations fell below the threshold. A share needs something to be a
  // share OF.
  if (total < 20 || rows.length < 2) return null;
  const top = rows.reduce((best, e) => (e.n > best.n ? e : best), rows[0]!);
  return { to: top.to, share: top.n / total, observed: total };
}

/**
 * A stage needs this many watched entrants before any percentile is offered.
 *
 * Separate from the completion rule below and doing a different job: that rule
 * says whether a percentile has been OBSERVED, this one says whether the
 * sample is big enough to mean anything. REQUEST FOR REVIEW currently sits at
 * 25 entrants with 80% exited - it clears the completion rule comfortably and
 * should still say nothing, because twenty-five cases is an anecdote.
 */
const MIN_ENTRANTS = 60;

/**
 * Stages whose duration is measurable but whose NUMBER would mislead.
 *
 * A duration here is time from a status change INTO a stage to the next change
 * out of it, so a case only enters the sample if we watched it arrive. That is
 * a real event for a stage you are DIVERTED into - an RFI, a hold, a NORD, an
 * appeal. It is not one for ANALYST REVIEW, which is where a case sits from
 * filing: those arrivals happened before the log existed, so the only analyst
 * review entries we can see are RE-entries, mostly cases coming back from an
 * RFI and being decided soon after.
 *
 * On 2026-09-10 the curve made ANALYST REVIEW reportable at a median of 4 days
 * while the mean age of a pending analyst-review case was 162 days. Both
 * numbers are correct and the sentence built from the first one would not be:
 * a reader sees "about 4 days" against their own months of waiting and either
 * disbelieves the site or, worse, believes it.
 */
const NOT_A_DIVERSION = new Set(["ANALYST REVIEW", "IN PROCESS"]);

/**
 * How long a stage takes, or null while that is not yet answerable.
 *
 * THE SWITCH IS THE DATA, NOT A FLAG. Percentiles here are computed over the
 * exits seen so far, which is biased low because short stays finish first, so
 * a percentile may only be shown once more than that share has actually left.
 * Below the line the stage reports nothing and the page keeps its current
 * behaviour; above it the stage turns itself on. Nobody has to notice.
 *
 * Measured 2026-09-10, entered / exited:
 *
 *     ANALYST REVIEW           345 / 236  (68%)  -> median reportable now
 *     REQUEST FOR REVIEW        25 /  20  (80%)  -> too few entrants
 *     RECONSIDERATION APPEALS 2338 /  84  (3.6%) -> not yet
 *     RFI ISSUED               422 /   3  (0.7%) -> not yet
 *     APPLICATION ON HOLD      218 /   0  (0%)   -> not yet
 *
 * The RFI line is the one worth reading twice. 327 RFI exits have been
 * observed, and they say nothing about duration: those cases were already at
 * an RFI when the log opened on 2026-08-26, so their start is unknown. Only
 * the 3 we watched both enter and leave can be timed.
 */
export function stageDurationFor(
  stats: StageStats | null,
  status: string,
): { p50: number; entered: number; eligible: number; windowDays: number } | null {
  const key = status.trim().toUpperCase();
  if (NOT_A_DIVERSION.has(key)) return null;
  const row = (stats?.durations ?? []).find((d) => d.stage.toUpperCase() === key);
  if (!row || row.entered < MIN_ENTRANTS) return null;

  // The median is the FIRST day by which at least half of the entrants old
  // enough to have reached it had left. Reading it off the curve is what makes
  // this censoring-safe: a day nobody has been observed long enough to reach
  // has no point on the curve at all, so no median longer than the window can
  // be produced, and none has to be excluded by hand.
  for (const pt of row.curve) {
    if (pt.eligible >= MIN_ENTRANTS && pt.left / pt.eligible >= 0.5) {
      return {
        p50: pt.days,
        entered: row.entered,
        eligible: pt.eligible,
        windowDays: row.observedDays,
      };
    }
  }
  return null;
}

