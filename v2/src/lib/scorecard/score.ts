/**
 * Grading recorded predictions, and summarising the grades.
 *
 * WHY A SAMPLE AND NOT HAND-PICKED CASES (2026-09-26). The scorecard used to
 * grade five cases somebody chose. Two had been decided, from two different
 * models, and the page printed their median as "the" miss. A daily random
 * sample across every filing month, recorded before the outcome and graded
 * when DOL decides, is the only version of this that can't be cherry-picked.
 *
 * SURVIVORSHIP IS THE TRAP. Grading only the cases already decided favours
 * whichever predictions called an EARLY decision, because those resolve first.
 * So besides the error on decided cases, every summary carries a "settled"
 * figure: of the predictions whose date passed more than `SETTLE_DAYS` ago,
 * how many were decided within that many days of it. A case still pending
 * then counts as a miss, which is what it is.
 *
 * Plain module, pure functions, so the unit project tests every rule.
 */

export type Source = "ours" | "rival-a" | "rival-b" | "rival-c";

export interface PredictionRow {
  source: Source;
  program: "perm" | "pwd";
  model: string;
  recordedOn: string;
  predicted: string;
  bandEarly: string | null;
  bandLate: string | null;
  /** First day the sweep saw the case final, `YYYY-MM-DD` (Eastern). */
  decidedOn: string | null;
  /** The final status word, when decided. */
  outcome: string | null;
}

/** Days after a predicted date before an undecided case counts as a miss. */
export const SETTLE_DAYS = 30;

const DAY = 86_400_000;
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export type Horizon = "0-30" | "31-90" | "91-180" | "181+";
export const HORIZONS: readonly Horizon[] = ["0-30", "31-90", "91-180", "181+"];

/** How far ahead the prediction reached, from the day it was recorded. */
export function horizonOf(recordedOn: string, predicted: string): Horizon {
  const d = daysBetween(recordedOn, predicted);
  if (d <= 30) return "0-30";
  if (d <= 90) return "31-90";
  if (d <= 180) return "91-180";
  return "181+";
}

/**
 * A withdrawal is not a decision on DOL's clock. The employer pulled the case,
 * often within days of filing, and scoring it would reward any model that
 * guessed early. Recorded, never graded.
 */
export function isGradedOutcome(outcome: string | null): boolean {
  if (!outcome) return false;
  return !/WITHDRAWN/i.test(outcome);
}

export interface Grade {
  /** decided minus predicted: positive means DOL decided LATER than predicted. */
  errorDays: number;
  /** Null when the prediction carried no band. */
  inBand: boolean | null;
}

export function grade(row: Pick<PredictionRow, "predicted" | "bandEarly" | "bandLate">, decidedOn: string): Grade {
  const errorDays = daysBetween(row.predicted, decidedOn);
  const inBand =
    row.bandEarly && row.bandLate
      ? decidedOn >= row.bandEarly && decidedOn <= row.bandLate
      : null;
  return { errorDays, inBand };
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export interface Cell {
  recorded: number;
  graded: number;
  /** Median of |decided - predicted| over graded cases. */
  typicalMissDays: number | null;
  /** Median of decided - predicted: positive = decided later than predicted. */
  biasDays: number | null;
  /** Share of graded cases decided inside the band, when bands exist. */
  inBandShare: number | null;
  /** Share of graded cases within 14 days either way. */
  within14Share: number | null;
  /** Predictions whose date passed more than SETTLE_DAYS ago. */
  settled: number;
  /** Of those, decided within SETTLE_DAYS of the date (pending counts as a miss). */
  settledHitShare: number | null;
}

export function summariseCell(rows: readonly PredictionRow[], today: string): Cell {
  const graded = rows.filter((r) => r.decidedOn && isGradedOutcome(r.outcome));
  const errs = graded.map((r) => grade(r, r.decidedOn!).errorDays);
  const banded = graded.filter((r) => r.bandEarly && r.bandLate);
  const inBand = banded.filter((r) => grade(r, r.decidedOn!).inBand).length;
  const settledRows = rows.filter(
    (r) => daysBetween(r.predicted, today) > SETTLE_DAYS && !(r.outcome && !isGradedOutcome(r.outcome)),
  );
  const hits = settledRows.filter(
    (r) => r.decidedOn && Math.abs(daysBetween(r.predicted, r.decidedOn)) <= SETTLE_DAYS,
  ).length;
  return {
    recorded: rows.length,
    graded: graded.length,
    typicalMissDays: median(errs.map(Math.abs)),
    biasDays: median(errs),
    inBandShare: banded.length ? inBand / banded.length : null,
    within14Share: graded.length ? errs.filter((e) => Math.abs(e) <= 14).length / graded.length : null,
    settled: settledRows.length,
    settledHitShare: settledRows.length ? hits / settledRows.length : null,
  };
}

export interface Summary {
  computedOn: string;
  /** Oldest recording day, so the page can say how long this has been running. */
  since: string | null;
  bySource: Record<string, {
    all: Cell;
    byModel: Record<string, Cell>;
    byHorizon: Record<Horizon, Cell>;
  }>;
}

export function summarise(rows: readonly PredictionRow[], today: string, program: "perm" | "pwd" = "perm"): Summary {
  const mine = rows.filter((r) => r.program === program);
  const since = mine.reduce<string | null>((a, r) => (a === null || r.recordedOn < a ? r.recordedOn : a), null);
  const bySource: Summary["bySource"] = {};
  const sources = [...new Set(mine.map((r) => r.source))].sort();
  for (const src of sources) {
    const s = mine.filter((r) => r.source === src);
    const byModel: Record<string, Cell> = {};
    for (const m of [...new Set(s.map((r) => r.model))].sort()) {
      byModel[m] = summariseCell(s.filter((r) => r.model === m), today);
    }
    const byHorizon = Object.fromEntries(
      HORIZONS.map((h) => [h, summariseCell(s.filter((r) => horizonOf(r.recordedOn, r.predicted) === h), today)]),
    ) as Record<Horizon, Cell>;
    bySource[src] = { all: summariseCell(s, today), byModel, byHorizon };
  }
  return { computedOn: today, since, bySource };
}

/** A small, seeded generator, so a day's sample can be reproduced from its date. */
export function rngFor(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to `k` distinct items, uniformly, without replacement. */
export function pick<T>(items: readonly T[], k: number, rng: () => number): T[] {
  const a = [...items];
  const n = Math.min(k, a.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (a.length - i));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}
