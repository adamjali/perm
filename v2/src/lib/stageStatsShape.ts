/**
 * The SHAPE of the measured stage statistics, plus the pure transforms over it.
 *
 * Split out of `src/lib/db/stageStats.ts` so the signed-in app can read these
 * client-side. The loader there carries `import "server-only"` (it reads the
 * public mirror), which would otherwise pull the whole module, and these three
 * transforms with it, out of reach of a client component. The transforms are
 * pure functions over a plain `StageStats` object, so they belong here and the
 * loader re-exports them, leaving every existing `@/lib/db/stageStats` importer
 * unchanged.
 *
 * The reasoning behind each rule (why a percentile does not move, why a stage
 * stays silent until it has the entrants, why ANALYST REVIEW's duration would
 * mislead) lives in the loader's docstring and is not repeated here.
 *
 * @module
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
  /** The RFIs the sweep watched DOL issue; read through `parseRfiPath` (`src/lib/stageMoves.ts`). */
  rfiPath?: unknown;
}

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
 * Destinations only, never duration. See the loader's docstring.
 */
export function exitMixFor(
  stats: StageStats | null,
  status: string,
): { to: string; share: number; observed: number } | null {
  const key = status.trim().toUpperCase();
  const rows = (stats?.exits ?? []).filter((e) => e.from.toUpperCase() === key);
  const total = rows.reduce((sum, e) => sum + e.n, 0);
  // Two floors: a total to be a share of, and at least two destinations, so a
  // stage with one surviving row cannot report a 100% that is really the
  // writer's own below-3 cutoff talking.
  if (total < 20 || rows.length < 2) return null;
  const top = rows.reduce((best, e) => (e.n > best.n ? e : best), rows[0]!);
  return { to: top.to, share: top.n / total, observed: total };
}

/**
 * A stage needs this many watched entrants before any percentile is offered.
 * Says whether the sample means anything, distinct from whether a percentile
 * has been observed (which the curve decides).
 */
const MIN_ENTRANTS = 60;

/**
 * Stages whose duration is measurable but whose NUMBER would mislead, because
 * the only entries the log can see are re-entries. See the loader's docstring.
 */
const NOT_A_DIVERSION = new Set(["ANALYST REVIEW", "IN PROCESS"]);

/**
 * How long a stage takes, or null while that is not yet answerable. The switch
 * is the data, not a flag: a median is read off the survival curve, so a day
 * nobody has been observed long enough to reach has no point and no median
 * longer than the window can be produced.
 */
export function stageDurationFor(
  stats: StageStats | null,
  status: string,
): { p50: number; entered: number; eligible: number; windowDays: number } | null {
  const key = status.trim().toUpperCase();
  if (NOT_A_DIVERSION.has(key)) return null;
  const row = (stats?.durations ?? []).find((d) => d.stage.toUpperCase() === key);
  if (!row || row.entered < MIN_ENTRANTS) return null;

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
