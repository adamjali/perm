import { NAICS_SECTORS } from "@/lib/naicsSectors";

/**
 * The salary explorer's worksite-city and industry filters, and the rule that
 * keeps them affordable.
 *
 * The explorer computes its percentiles per request over the rows the reader
 * selected, and Turso bills rows read. `perm_cases` has no index on the city
 * or the industry, so either one alone walks the whole table (about 373,000
 * rows) for five numbers. Both are therefore NARROWINGS of a slice an index
 * already serves: a city inside its state (`idx_pc_state_st_dec`), an industry
 * inside a state or an occupation (`idx_pc_state_st_dec`, `idx_pc_socg_dec`).
 * Measured on production 2026-09-26: state plus city plans as
 * `SEARCH perm_cases USING INDEX idx_pc_state_st_dec (state=? AND status=?)`,
 * so the added filter costs no more rows than the state alone already does.
 *
 * The city-wide and industry-wide national figures are precomputed on the
 * city and industry pages instead, which is where a reader asking "what does
 * Seattle pay" without a state is sent.
 *
 * Plain module: the route enforces the rule and the browser disables the
 * control by the same function, so the two can't disagree.
 */

/** Longer than any city DOL prints; a cap before anything parses it. */
export const MAX_CITY = 60;

export interface WageSector {
  /** The first two-digit code in the sector; the value the URL carries. */
  value: string;
  label: string;
  /** Every two-digit code the sector spans (Manufacturing is 31, 32 and 33). */
  codes: string[];
}

/** One option per Census sector, in code order. */
export const WAGE_SECTORS: readonly WageSector[] = (() => {
  const byTitle = new Map<string, WageSector>();
  for (const [code, label] of Object.entries(NAICS_SECTORS).sort(([a], [b]) => a.localeCompare(b))) {
    const s = byTitle.get(label);
    if (s) s.codes.push(code);
    else byTitle.set(label, { value: code, label, codes: [code] });
  }
  return [...byTitle.values()];
})();

/** The two-digit codes a sector value stands for, or null for an unknown one. */
export function sectorCodes(value: string): string[] | null {
  return WAGE_SECTORS.find((s) => s.value === value)?.codes ?? null;
}

/** Why a city or industry filter can't run with this selection, or null when it can. */
export function placeFilterRefusal(f: {
  state?: string | null;
  soc?: string | null;
  city?: string | null;
  sector?: string | null;
}): string | null {
  if (f.city && !f.state) return "a city filter needs a state";
  if (f.sector && !f.state && !f.soc) return "an industry filter needs a state or an occupation";
  return null;
}
