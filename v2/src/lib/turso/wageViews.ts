import "server-only";

import { cache } from "react";

import { one } from "./client";

/**
 * Precomputed wage selections, one row per filter combination big enough to
 * be slow.
 *
 * The PERM salary explorer and the LCA wage explorer compute percentiles, a
 * histogram and a per-state table over the reader's filters with window
 * functions. On a big selection that is millions of rows read per page
 * rebuild and, on the LCA side, deadline failures of /api/lca-wages.
 * `scripts/build_wage_views.py`
 * computes every combination of status x occupation group x state x fiscal
 * year holding at least 5,000 filings, in the same arithmetic as the SQL,
 * after each disclosure load, into `wage_views`.
 *
 * A lookup is one primary-key read. A miss means the selection is small (or
 * the table isn't there yet on a fresh database) and the caller runs its live
 * query, which an index keeps fast at that size.
 */

export type WageProgram = "perm" | "lca";

export interface WageViewStats {
  n: number;
  avg: number | null;
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
}

export interface WageView {
  stats: WageViewStats;
  /** The width the histogram was binned at: binWidth(p5, p95). */
  binWidth: number;
  /** [from, count], every occupied bin, lowest first. */
  histogram: [number, number][];
  /** The per-state floor the by-state table was cut at (MIN_FOR_MEDIAN). */
  minCases: number;
  /** Only on a key with no state filter. */
  byState: Array<WageViewStats & { state: string }> | null;
}

export interface WageViewFilters {
  status?: string | null;
  socCode?: string | null;
  state?: string | null;
  fiscalYear?: string | number | null;
}

/**
 * `program|status|soc|state|fy`, empty for an unset filter. MUST MATCH key()
 * in scripts/build_wage_views.py, which test_wage_views.py checks against
 * this function's template. Each part is normalised exactly as the live query
 * normalises its argument, so a key names the same rows the query would read.
 */
export function wageViewKey(program: WageProgram, f: WageViewFilters): string {
  const status = f.status || "certified";
  const soc = f.socCode ? f.socCode.trim().slice(0, 7) : "";
  const state = f.state ? (program === "lca" ? f.state.toUpperCase() : f.state) : "";
  const fy = f.fiscalYear ? String(f.fiscalYear) : "";
  return `${program}|${status}|${soc}|${state}|${fy}`;
}

const readView = cache(async (key: string): Promise<WageView | null> => {
  try {
    const r = await one<{ json: string }>("SELECT json FROM wage_views WHERE key = ?", [key]);
    return r ? (JSON.parse(r.json) as WageView) : null;
  } catch {
    // A missing table (a fresh database) or a transient failure: the caller's
    // live query answers instead, degraded to slow rather than to empty.
    return null;
  }
});

/** The precomputed view for this selection, or null to run the live query. */
export function wageView(program: WageProgram, f: WageViewFilters): Promise<WageView | null> {
  return readView(wageViewKey(program, f));
}
