/**
 * Per-state PERM profiles: the questions a choropleth cannot answer.
 *
 * A map shaded by volume says California is big and Alabama is small. It
 * cannot say that a quarter of California's filings are one job title, that
 * 58% of Alabama's are meat cutters, or that Washington's biggest employer
 * accounts for more than a third of the state on its own. Those are the
 * facts that make a state page worth opening, and they are all concentration
 * figures the map has no channel for.
 *
 * Written by `scripts/build_state_profiles.py` into `perm_docs`, for the same
 * reason `disclosure_stats` is: the underlying aggregation is a GROUP BY over
 * every row in `perm_cases` and takes up to a minute and a half. This module
 * is the read side only and does no arithmetic the writer did not already do,
 * so the floor and the rates cannot drift between them.
 */
import "server-only";

import { one } from "./client";

export interface StateLeader {
  /** The identity: a SOC code, or an employer slug. Never the label. */
  key: string;
  /** The spelling to print: the most common one DOL used. */
  label: string;
  count: number;
}

export interface StateProfile {
  state: string;
  total: number;
  decided: number;
  denied: number;
  withdrawn: number;
  /** Null below the population floor, never a number computed on too little. */
  denialRate: number | null;
  topOccupations: StateLeader[];
  topEmployers: StateLeader[];
  /** Percent of the state's filings in its single biggest occupation. */
  topOccupationShare: number | null;
  /** Percent of the state's filings at its single biggest employer. */
  topEmployerShare: number | null;
}

export interface StateProfiles {
  rateFloor: number;
  fieldDecided: number;
  fieldDenied: number;
  fieldDenialRate: number | null;
  states: StateProfile[];
  /** The disclosure files this was built from, for comparison with the page's. */
  sourceFiles: string[];
  uniqueCases: number | null;
}

/**
 * The precomputed profiles, or null when the build step has not run.
 *
 * Null is a real state and the page renders without this section rather than
 * failing: the document is written by a post-ingest script, so there is a
 * window after a fresh database in which it legitimately does not exist.
 */
export async function getStateProfiles(): Promise<StateProfiles | null> {
  const r = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'state_profiles'",
  );
  if (!r) return null;
  return JSON.parse(r.json) as StateProfiles;
}
