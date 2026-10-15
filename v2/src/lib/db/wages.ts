/**
 * Wage-distribution reads, on top of `perm_wage_stats`.
 *
 * WHY A SECOND MODULE RATHER THAN MORE OF publicData.ts. Two wage routes
 * already exist and they answer different questions:
 *
 *   getWageStats / getWageByState / getWageHistogram  (publicData.ts)
 *       percentiles computed IN SQL over whatever subset the reader filtered
 *       to. Arbitrary filters, five rungs, recomputed per view.
 *
 *   perm_wage_stats                                   (this module)
 *       2,190 pre-materialised cells with SEVEN rungs (p5 p10 p25 p50 p75
 *       p90 p95) per occupation, per state, per occupation-and-state, and per
 *       fiscal year plus an all-years rollup. Fixed subjects, but it carries
 *       the two rungs the SQL route does not compute and it is the only place
 *       a subject's ladder can be read for three separate years in one query.
 *
 * The table had been written, indexed and left unread: `getWageCells` and
 * `getWageMeta` were exported from publicData.ts and nothing imported either.
 * This module is what reads them.
 *
 * NO PERCENTILE ARITHMETIC LIVES HERE. publicData.ts owns the one copy of that
 * SQL and `scripts/cross_check_wage_stats.py` already proves the two routes
 * agree to the dollar. A second implementation would be a third definition of
 * "median" on one site. Derivations that are not queries live in
 * src/lib/wageLadder.ts so they can be tested without `server-only`.
 */
import "server-only";

import { toBands, type Ladder, type WageBandRate, type WageBandSeries } from "@/lib/wageLadder";
import { WAGE_BAND_EDGES_FINE } from "@/lib/wageLadder";

import { rows } from "./client";
import { getWageCells, getWageMeta, type WageCell } from "./publicData";

export { getWageMeta };

/**
 * The floor under a ladder that is DRAWN.
 *
 * The ingest's own floor is 50 cases for a single-facet cell and 100 for a
 * pair (`wage_meta.floors`), so every row in the table clears one of those.
 * This is the drawing's floor rather than the table's: a comb of ladders
 * invites comparison between its rows, and a row resting on 50 cases beside
 * one resting on 73,058 reads as equally solid when it is not.
 */
export const MIN_CASES_FOR_LADDER = 250;

const LADDER_COLS = "count, p5, p10, p25, p50, p75, p90, p95, mean";

function toLadder(r: Record<string, unknown>, label: string, key: string): Ladder {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    label,
    key,
    count: Number(r.count ?? 0),
    p5: num(r.p5),
    p10: num(r.p10),
    p25: num(r.p25),
    p50: num(r.p50),
    p75: num(r.p75),
    p90: num(r.p90),
    p95: num(r.p95),
    mean: num(r.mean),
  };
}

function cellToLadder(c: WageCell, label: string, key: string): Ladder {
  return {
    label,
    key,
    count: c.count,
    p5: c.p5,
    p10: c.p10,
    p25: c.p25,
    p50: c.p50,
    p75: c.p75,
    p90: c.p90,
    p95: c.p95,
    mean: c.mean,
  };
}

/**
 * The busiest occupations with their full ladders, ORDERED BY FILING VOLUME.
 *
 * The ordering is the finding, so it is not a caller's choice. Sorted by wage
 * this is a ranked list of the obvious; sorted by volume the rows alternate
 * between roughly $139k and roughly $26k, and the two clusters do not overlap
 * at any rung. That alternation only survives if the sort stays put.
 *
 * The join is against `perm_entities`, which carries one canonical name per
 * occupation. `perm_cases.soc_title` is the EMPLOYER'S free-text job title
 * (263 distinct strings on SOC 15-1252.00 alone), so labelling from it names
 * each occupation after whichever filing happened to sort last.
 */
export async function getVolumeLadders(limit = 12): Promise<Ladder[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT e.code AS code, e.name AS name, ${LADDER_COLS}
       FROM perm_entities e
       JOIN perm_wage_stats w
         ON w.kind = 'occupation' AND w.key = e.code AND w.fiscal_year = 'all'
      WHERE e.kind = 'occupation' AND w.count >= ?
      ORDER BY e.total DESC
      LIMIT ?`,
    [MIN_CASES_FOR_LADDER, limit],
  );
  return r.map((x) => toLadder(x, String(x.name), String(x.code)));
}

/** Every state that carries a ladder, busiest first. */
export async function getStateLadders(limit = 60): Promise<Ladder[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT key, ${LADDER_COLS} FROM perm_wage_stats
      WHERE kind = 'state' AND fiscal_year = 'all' AND count >= ?
      ORDER BY count DESC LIMIT ?`,
    [MIN_CASES_FOR_LADDER, limit],
  );
  return r.map((x) => toLadder(x, String(x.key), String(x.key)));
}

/**
 * One occupation's ladder in each state that files enough of it.
 *
 * The question a person actually has is not "what does this job pay" but
 * "what does it pay HERE", and the spread is large: Software Developers run a
 * $167,149 median in California against $99,549 in Iowa on the same SOC code.
 * A national median answers neither.
 */
export async function getOccupationStateLadders(
  socCode: string,
  limit = 16,
): Promise<Ladder[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT state, ${LADDER_COLS} FROM perm_wage_stats
      WHERE kind = 'occupationState' AND fiscal_year = 'all'
        AND soc_code = ? AND count >= ?
      ORDER BY count DESC LIMIT ?`,
    [socCode, MIN_CASES_FOR_LADDER, limit],
  );
  return r.map((x) => toLadder(x, String(x.state), String(x.state)));
}

/**
 * One subject's ladder per fiscal year, oldest first, with the rollup dropped.
 *
 * `fiscal_year` is part of a cell's identity rather than a filter that may be
 * omitted: every key carries a row per year AND an `all` row, so a query that
 * ignores the column returns both and a caller taking the first row gets one
 * year's ladder presented as the all-time figure.
 *
 * Reads through `getWageCells`, which is the function this table was given and
 * then never used with.
 */
export async function getLadderByYear(
  kind: "occupation" | "state" | "occupationState",
  key: string,
): Promise<Ladder[]> {
  const cells = await getWageCells(kind, key);
  return cells
    .filter((c) => c.fiscalYear !== "all")
    .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
    .map((c) => cellToLadder(c, `FY${c.fiscalYear}`, c.fiscalYear));
}

/** The all-years rollup for one subject, or null when it carries no cell. */
export async function getLadder(
  kind: "occupation" | "state" | "occupationState",
  key: string,
  label: string,
): Promise<Ladder | null> {
  const c = (await getWageCells(kind, key, "all"))[0];
  return c ? cellToLadder(c, label, key) : null;
}

// ---------------------------------------------------------------------------
// Wage against outcome
// ---------------------------------------------------------------------------

/**
 * The `CASE` that assigns a wage to a FINE band.
 *
 * Built from the edge list rather than written out, so the SQL cannot drift
 * from the constant the page derives its summary against. Interpolated because
 * the edges are module constants and never caller input; every real parameter
 * below is bound.
 *
 * The query is always at the fine resolution. The coarse view is summed from
 * these rows by `coarsenBands`, never queried separately, so a summary can
 * never disagree with the structure under it.
 */
const BAND_CASE = `CASE
    ${WAGE_BAND_EDGES_FINE.map(
      (e, i) => `WHEN wage < ${e} THEN ${i === 0 ? 0 : WAGE_BAND_EDGES_FINE[i - 1]}`,
    ).join("\n    ")}
    ELSE ${WAGE_BAND_EDGES_FINE[WAGE_BAND_EDGES_FINE.length - 1]} END`;

/**
 * WHY WITHDRAWN IS NOT IN THE DENOMINATOR.
 *
 * A withdrawn case was never decided against; the employer pulled it. Leaving
 * it in dilutes every band by a different amount, because the withdrawal rate
 * is not flat across the range: measured at 4.49% under $60k, 5.93% at
 * $60k-$80k and 5.49% over $130k. Certified plus denied is the population in
 * which "denied" is a decision somebody actually made.
 */
const BAND_WHERE = "wage IS NOT NULL AND wage > 0 AND status IN ('certified','denied')";

function shape(r: Record<string, unknown>[]) {
  return r.map((x) => ({
    from: Number(x.band),
    decided: Number(x.decided ?? 0),
    denied: Number(x.denied ?? 0),
  }));
}

/** Denial rate by wage band over the whole disclosure window. */
export async function getWageBandRates(): Promise<WageBandRate[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT ${BAND_CASE} AS band, COUNT(*) AS decided,
            SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) AS denied
       FROM perm_cases WHERE ${BAND_WHERE} GROUP BY band ORDER BY band`,
  );
  return toBands(shape(r));
}

/**
 * The same bands, split by fiscal year.
 *
 * THE SPLIT IS NOT A DETAIL, IT IS THE FINDING. Pooled across FY2024-FY2026
 * the bottom two bands are a dead heat (5.22% under $60k against 5.21% at
 * $60k-$80k) and the shape reads as a plateau then a decline. Split by year,
 * FY2024 falls at every step from 9.44%, while FY2025 and FY2026 both RISE
 * into $60k-$80k and fall from there. Publishing only the pooled figure hides
 * that the hump is recent; publishing only a recent year implies it has always
 * been there.
 */
export async function getWageBandRatesByYear(): Promise<WageBandSeries[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT fiscal_year AS fy, ${BAND_CASE} AS band, COUNT(*) AS decided,
            SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) AS denied
       FROM perm_cases
      WHERE ${BAND_WHERE} AND fiscal_year IS NOT NULL AND fiscal_year <> ''
      GROUP BY fy, band ORDER BY fy, band`,
  );
  const years = [...new Set(r.map((x) => String(x.fy)))].sort();
  return years.map((fy) => ({
    fiscalYear: fy,
    bands: toBands(shape(r.filter((x) => String(x.fy) === fy))),
  }));
}
