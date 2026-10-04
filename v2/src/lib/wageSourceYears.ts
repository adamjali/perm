/**
 * The years of the H-1B wage-source chart: pure, so the page and its test
 * share one rule (scripts/build_wage_sources.py writes the counts).
 */

export interface WageSourceYear {
  fy: number;
  /** LCAs whose wage source has been read. */
  total: number;
  /** Every LCA held for the year, read or not; absent on a doc built before Oct 4 2026. */
  all?: number;
  OES: number;
  Survey: number;
  CBA: number;
  SCA: number;
  DBA: number;
  Other: number;
}

/** At least this share of a year's LCAs read before the year is drawn; a partial year reads as the whole one. */
export const YEAR_READ_FLOOR = 0.9;

/** The years to draw, and the ones held back until the backfill reaches them. */
export function splitYears(years: WageSourceYear[]): { shown: WageSourceYear[]; pending: number[] } {
  const shown: WageSourceYear[] = [];
  const pending: number[] = [];
  for (const y of years) {
    if (y.total < 100) continue;
    if (y.all != null && y.all > 0 && y.total < YEAR_READ_FLOOR * y.all) pending.push(y.fy);
    else shown.push(y);
  }
  return { shown, pending };
}
