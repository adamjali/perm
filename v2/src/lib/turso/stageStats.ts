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

export interface StageStats {
  asOf: string;
  source: string;
  stages: StageStat[];
  exits: StageMove[];
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
    return { ...doc, exits: Array.isArray(doc.exits) ? doc.exits : [] };
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
