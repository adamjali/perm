/**
 * Reading the weekly backtest's measurement of the printed pace range
 * (perm_docs['estimator_backtest']). Plain module so the unit project tests
 * the rules; the reader is src/lib/turso/rangeCoverage.ts.
 */

import type { RangeCoverage } from "@/lib/perm";
import { MS_PER_DAY } from "@/lib/time";

/** Older than this, the weekly test has stopped and its figure is not quoted. */
export const RANGE_COVERAGE_MAX_AGE_DAYS = 21;

export function parseRangeCoverage(json: string, today: string): RangeCoverage | null {
  try {
    const d = JSON.parse(json) as {
      end?: string;
      current?: { within7Share?: number | null } | null;
      rangeCoverage?: { judged?: number; insideShare?: number | null } | null;
    };
    const judged = d.rangeCoverage?.judged ?? 0;
    const inside = d.rangeCoverage?.insideShare;
    if (!d.end || !(judged > 0) || typeof inside !== "number") return null;
    const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.end}T00:00:00Z`)) / MS_PER_DAY;
    if (!(age <= RANGE_COVERAGE_MAX_AGE_DAYS)) return null;
    const within7 = d.current?.within7Share;
    return { insideShare: inside, judged, within7Share: typeof within7 === "number" ? within7 : null, through: d.end };
  } catch {
    return null;
  }
}
