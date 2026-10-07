import "server-only";

import { cache } from "react";

import type { RangeCoverage } from "@/lib/perm";
import { parseRangeCoverage } from "@/lib/rangeCoverage";
import { one } from "./client";

/**
 * How often the printed pace range has held, from the weekly backtest's stored
 * result (scripts/backtest_queue.py -> perm_docs['estimator_backtest']).
 * Every surface that prints the range quotes this one figure, so none of them
 * carries a typed number that ages. Null when the doc is missing, unreadable,
 * judged nothing, or is older than three weeks.
 */
export const getRangeCoverage = cache(async (): Promise<RangeCoverage | null> => {
  const r = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'estimator_backtest'",
  ).catch(() => null);
  if (!r) return null;
  return parseRangeCoverage(r.json, new Date().toISOString().slice(0, 10));
});
