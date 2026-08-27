/**
 * Denial rate by offered wage, at two resolutions, so the page can show that
 * the shape depends on where the bands are drawn.
 *
 * Read at five wide bands the data appears to say the middle of the wage range
 * is the most-denied part of it. At eleven it says something different and
 * truer: the maximum sits at $40k to $50k, inside the bottom coarse band,
 * where averaging hides it. The broad downward slope survives both cuts. The
 * peak does not survive the coarse one, and the rate turns back up above
 * $160k.
 *
 * Both arrays come from `scripts/build_wage_bands.py`, which asserts the fine
 * bands sum to the coarse ones and that the coarse ones equal what the
 * disclosure ingest already published. Two views of one dataset are only safe
 * to publish together while that holds.
 */
import "server-only";

import { one } from "./client";

export interface WageBand {
  bucket: string;
  decided: number;
  denied: number;
  withdrawn: number;
  /** Null only when a band has no decided cases at all. */
  denialRate: number | null;
}

export interface WageDenialBands {
  /** Eleven bands. What the page shows. */
  fine: WageBand[];
  /** The five the disclosure ingest publishes, for the bin-sensitivity point. */
  coarse: WageBand[];
  /** Decided cases whose offered wage could not be annualised, so unbanded. */
  unbandedDecided: number;
  sourceFiles: string[];
}

/**
 * The bands, or null when the build step has not run.
 *
 * Null is a real state: this is written by a post-ingest script, so a fresh
 * database legitimately has no row yet. The page falls back to the coarse
 * bands the aggregate already carries rather than showing nothing.
 */
export async function getWageDenialBands(): Promise<WageDenialBands | null> {
  const r = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'wage_denial_bands'",
  );
  if (!r) return null;
  return JSON.parse(r.json) as WageDenialBands;
}

/**
 * Where the rate peaks, and whether that peak survives the coarse cut.
 *
 * The page needs both halves: naming the maximum is the finding, and saying
 * the coarse view puts it somewhere else is what stops the finding being read
 * as a fact about wages rather than a fact about wages AND bins. Computed, so
 * it follows the data instead of being written into copy that goes stale.
 */
export function peakBand(bands: WageDenialBands): {
  fine: WageBand;
  coarse: WageBand;
  hiddenByCoarse: boolean;
} | null {
  const rated = (b: WageBand[]) => b.filter((x) => x.denialRate !== null);
  const fineRated = rated(bands.fine);
  const coarseRated = rated(bands.coarse);
  if (fineRated.length === 0 || coarseRated.length === 0) return null;
  const top = (b: WageBand[]) =>
    b.reduce((a, x) => ((x.denialRate ?? 0) > (a.denialRate ?? 0) ? x : a));
  const fine = top(fineRated);
  const coarse = top(coarseRated);
  return {
    fine,
    coarse,
    // The peak is "hidden" when the coarse view's own maximum reports a
    // materially lower rate, which is what averaging a peak with its
    // neighbours does. A tenth of a point is not a disagreement worth a
    // sentence; a point and a half is.
    hiddenByCoarse: (fine.denialRate ?? 0) - (coarse.denialRate ?? 0) > 1,
  };
}

/**
 * Whether the rate falls monotonically as the wage rises.
 *
 * The broad decline is robust and worth stating. Calling it a gradient that
 * "runs one way" is not, and this is the check that keeps the copy honest:
 * whichever answer it returns, the page says that one.
 */
export function isMonotonic(bands: WageBand[]): boolean {
  const rated = bands.filter((b) => b.denialRate !== null);
  return rated.every(
    (b, i) => i === 0 || (rated[i - 1]!.denialRate ?? 0) >= (b.denialRate ?? 0),
  );
}
