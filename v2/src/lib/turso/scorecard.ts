import "server-only";

import { cache } from "react";

import { PREDICTIONS, scorePrediction, type Prediction, type Score } from "@/lib/predictionLedger";
import { one } from "@/lib/turso/client";

/**
 * Each recorded prediction against what DOL's index shows for the case now.
 *
 * A decision date is the day the sweep first saw the case in a final status,
 * read from the event log, so the score writes itself the morning after DOL
 * decides and nobody has to remember to update a page. A case the log has
 * not seen decide is still pending, whatever the anchor says.
 */

export interface ScoredPrediction {
  prediction: Prediction;
  /** DOL's current status word, or null when the index does not hold the case. */
  status: string | null;
  /** ISO date the sweep first observed a final status, or null while pending. */
  decidedOn: string | null;
  score: Score | null;
}

export const getScorecard = cache(async (): Promise<ScoredPrediction[]> => {
  const out: ScoredPrediction[] = [];
  for (const prediction of PREDICTIONS) {
    const status = await one<{ current_status: string }>(
      "SELECT current_status FROM perm_case_status WHERE case_number = ?",
      [prediction.caseNumber],
    ).catch(() => null);
    const ev = await one<{ changed_at: number | string }>(
      "SELECT changed_at FROM perm_case_events WHERE case_number = ? AND to_final = 1 ORDER BY changed_at LIMIT 1",
      [prediction.caseNumber],
    ).catch(() => null);
    const ms = ev ? Number(ev.changed_at) : NaN;
    const decidedOn = Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
    out.push({
      prediction,
      status: status?.current_status ?? null,
      decidedOn,
      score: decidedOn ? scorePrediction(prediction, decidedOn) : null,
    });
  }
  return out;
});
