import "server-only";

import { cache } from "react";

import { MS_PER_DAY } from "@/lib/time";

import { one } from "./client";
import type { StageStats } from "@/lib/stageStatsShape";

/**
 * The server loader for the measured stage statistics.
 *
 * The SHAPE and the pure transforms (`ageByStatusFrom`, `exitMixFor`,
 * `stageDurationFor`) moved to `@/lib/stageStatsShape` so the signed-in app can
 * read them client-side without dragging this `server-only` loader along. They
 * are re-exported here unchanged, so every `@/lib/db/stageStats` importer keeps
 * working. The reasoning behind each rule lives beside the transforms.
 *
 * WHAT EACH STAGE LOOKS LIKE RIGHT NOW, measured rather than typed:
 * `queueForecast.ts` carries a per-stage table whose `observedAgeDays` are
 * typed by hand, and a hand-typed age drifts. These read from the data and stay
 * current on their own. The percentile each stage maps to does NOT move: that
 * says what a stage MEANS and is editorial judgement, not a nightly aggregate.
 */
export type {
  StageStat,
  StageMove,
  StageCurvePoint,
  StageDuration,
  StageStats,
} from "@/lib/stageStatsShape";
export { ageByStatusFrom, exitMixFor, stageDurationFor } from "@/lib/stageStatsShape";

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
  const ageDays = (Date.now() - Number(row.computed_at ?? 0)) / MS_PER_DAY;
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
