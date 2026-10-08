/**
 * The estimates besides PERM's decision date, one row per method, for the
 * public scorecard and the admin panel alike: what has been written down,
 * what has been graded, and how the method did when tested on the past.
 *
 * Plain module, pure functions.
 */

import type { SeasonalCheck } from "@/lib/seasonalTiming";
import type { SeasonalVisa } from "@/lib/seasonalForms";

import { PWD_MODEL, type Summary } from "./score";

export interface OtherEstimateRow {
  /** The method's id as recorded (`estimate_predictions.model`). */
  model: string;
  label: string;
  recorded: number;
  graded: number;
  typicalMissDays: number | null;
  /** Share of graded cases decided inside the printed range. */
  inRangeShare: number | null;
  /** What the range is: a named month, or a middle half that should hold half. */
  range: "the month" | "the middle half";
  /** The page method's result on past filings, from the weekly backtest; null when there is none. */
  tested: { share: number; cases: number } | null;
}

const SEASONAL_LABEL: Record<string, { label: string; visa: SeasonalVisa; tested: boolean }> = {
  // `tested` marks the method the weekly backtest grades for that visa
  // (PAGE_METHOD in scripts/backtest_seasonal.py).
  "H-2A-start": { label: "H-2A, counted back from the first day of work", visa: "H-2A", tested: true },
  "H-2A-filed": { label: "H-2A with no first day known, counted from filing", visa: "H-2A", tested: false },
  "H-2B-filed-season": { label: "H-2B, from the same season a year earlier", visa: "H-2B", tested: true },
  "H-2B-filed": { label: "H-2B, every season pooled (no season a year earlier)", visa: "H-2B", tested: false },
  "CW-1-filed": { label: "CW-1, counted from filing", visa: "CW-1", tested: true },
};

export function otherEstimateRows(
  pwd: Summary | null | undefined,
  seasonal: Summary | null | undefined,
  checks: SeasonalCheck | null = null,
): OtherEstimateRow[] {
  const out: OtherEstimateRow[] = [];
  const wage = pwd?.bySource.ours?.byModel[PWD_MODEL];
  if (wage && wage.recorded > 0) {
    out.push({
      model: PWD_MODEL,
      label: "Wage-request month",
      recorded: wage.recorded,
      graded: wage.graded,
      typicalMissDays: wage.typicalMissDays,
      inRangeShare: wage.inBandShare,
      range: "the month",
      tested: null,
    });
  }
  const byModel = seasonal?.bySource.ours?.byModel ?? {};
  for (const [model, meta] of Object.entries(SEASONAL_LABEL)) {
    const cell = byModel[model];
    if (!cell || cell.recorded === 0) continue;
    const check = meta.tested ? checks?.[meta.visa] : undefined;
    out.push({
      model,
      label: meta.label,
      recorded: cell.recorded,
      graded: cell.graded,
      typicalMissDays: cell.typicalMissDays,
      inRangeShare: cell.inBandShare,
      range: "the middle half",
      tested: check ? { share: check.share, cases: check.cases } : null,
    });
  }
  return out;
}
