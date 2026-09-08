import "server-only";

import { one, rows } from "./client";
import { PERCENTILE_SELECT, STATE_PERCENTILE_SELECT, type WageOption } from "./publicData";

/**
 * H-1B LCA wages: the same five-point ladder the PERM salary explorer draws,
 * computed over `lca_cases`.
 *
 * TWO THINGS DIFFER FROM THE PERM MODULE, AND BOTH ARE THE DATA'S. An LCA
 * wage carries a unit (403,531 yearly, 32,839 hourly, then monthly, weekly
 * and bi-weekly rows in the FY2026 files), so every figure here is
 * annualised in SQL first: 2,080 hours, 12 months, 52 weeks, 26 fortnights.
 * A real row on the first test day was 9.75 HOURLY, which printed beside
 * six-figure salaries as "$10" until the unit was carried. And the window is
 * the FY2026 disclosure files, decisions from Oct 1 2025, because that is
 * what is loaded; earlier fiscal years are a one-year-at-a-time load
 * (`ingest_flag_disclosure.py --program lca --fy 2025`) that costs about a
 * million writes each, so they are a budget decision, not a code change.
 *
 * Every filter is an equality on an indexed column (`lca_cases_soc_st_dec`,
 * `lca_cases_state_st_dec`), and a selection under thirty rows publishes no
 * median, the same floor as the PERM explorer (`wageStats.ts`).
 */

export type LcaWageStatusFilter = "certified" | "denied" | "withdrawn" | "all";

export interface LcaWageFilters {
  socCode?: string | null;
  state?: string | null;
  fiscalYear?: string | null;
  status: LcaWageStatusFilter;
}

export interface LcaWagePercentileRow {
  n: number;
  avg: number | null;
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
}

export interface LcaWageStateRow extends LcaWagePercentileRow {
  state: string;
}

/** Annual dollars from whatever unit the filing quoted. NULL for a unit not listed. */
export const ANNUAL_WAGE_SQL =
  "CASE wage_unit WHEN 'YEAR' THEN wage WHEN 'HOUR' THEN wage * 2080 " +
  "WHEN 'MONTH' THEN wage * 12 WHEN 'WEEK' THEN wage * 52 WHEN 'BI-WEEKLY' THEN wage * 26 END";

/** Rows outside this band are data defects (a wage of 1, or 15,000,000), not offers. */
const MIN_ANNUAL = 10_000;
const MAX_ANNUAL = 1_500_000;

/** The first seven characters, `15-1252`, which is how the index is keyed. */
export function socGroup(code: string): string {
  return code.trim().slice(0, 7);
}

function where(f: LcaWageFilters): { sql: string; args: (string | number)[] } {
  const parts = [`wage IS NOT NULL AND wage > 0 AND (${ANNUAL_WAGE_SQL}) BETWEEN ${MIN_ANNUAL} AND ${MAX_ANNUAL}`];
  const args: (string | number)[] = [];
  switch (f.status) {
    case "certified":
      parts.push("case_status = 'CERTIFIED'");
      break;
    case "denied":
      parts.push("case_status = 'DENIED'");
      break;
    case "withdrawn":
      parts.push("case_status IN ('WITHDRAWN', 'CERTIFIED - WITHDRAWN')");
      break;
    default:
      break;
  }
  if (f.socCode) {
    parts.push("substr(soc_code, 1, 7) = ?");
    args.push(socGroup(f.socCode));
  }
  if (f.state) {
    parts.push("worksite_state = ?");
    args.push(f.state.toUpperCase());
  }
  if (f.fiscalYear) {
    parts.push("fiscal_year = ?");
    args.push(Number(f.fiscalYear));
  }
  return { sql: parts.join(" AND "), args };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getLcaWageStats(f: LcaWageFilters): Promise<LcaWagePercentileRow> {
  const w = where(f);
  const r = await one<Record<string, unknown>>(
    `WITH f AS (SELECT (${ANNUAL_WAGE_SQL}) AS wage FROM lca_cases WHERE ${w.sql}),
          c AS (SELECT COUNT(*) AS n FROM f),
          o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f)
     SELECT (SELECT n FROM c) AS n, (SELECT AVG(wage) FROM f) AS avg,
            ${PERCENTILE_SELECT}`,
    w.args,
  );
  return {
    n: Number(r?.n ?? 0),
    avg: num(r?.avg),
    p5: num(r?.p5),
    p25: num(r?.p25),
    p50: num(r?.p50),
    p75: num(r?.p75),
    p95: num(r?.p95),
  };
}

export async function getLcaWageHistogram(
  f: LcaWageFilters,
  width: number,
): Promise<{ from: number; count: number }[]> {
  const w = where(f);
  const r = await rows<Record<string, unknown>>(
    `SELECT CAST((${ANNUAL_WAGE_SQL}) / ? AS INTEGER) * ? AS bin, COUNT(*) AS n
       FROM lca_cases WHERE ${w.sql}
      GROUP BY bin ORDER BY bin`,
    [width, width, ...w.args],
  );
  return r.map((x) => ({ from: Number(x.bin), count: Number(x.n) }));
}

export async function getLcaWageByState(
  f: LcaWageFilters,
  minCases: number,
): Promise<LcaWageStateRow[]> {
  const w = where({ ...f, state: null });
  const r = await rows<Record<string, unknown>>(
    `WITH o AS (
       SELECT worksite_state AS state, (${ANNUAL_WAGE_SQL}) AS wage,
              ROW_NUMBER() OVER (PARTITION BY worksite_state ORDER BY (${ANNUAL_WAGE_SQL})) AS rn,
              COUNT(*)     OVER (PARTITION BY worksite_state)                                AS n
         FROM lca_cases WHERE ${w.sql} AND worksite_state IS NOT NULL AND worksite_state <> ''
     )
     SELECT state, MAX(n) AS n, AVG(wage) AS avg,
            ${STATE_PERCENTILE_SELECT}
       FROM o GROUP BY state HAVING MAX(n) >= ? ORDER BY MAX(n) DESC`,
    [...w.args, minCases],
  );
  return r.map((x) => ({
    state: String(x.state),
    n: Number(x.n),
    avg: num(x.avg),
    p5: num(x.p5),
    p25: num(x.p25),
    p50: num(x.p50),
    p75: num(x.p75),
    p95: num(x.p95),
  }));
}

/**
 * The selector contents: occupations and states with enough certified rows
 * to publish a median, and the fiscal years loaded. Read on the weekly
 * page render, not per request.
 */
export async function getLcaWageFilterOptions(minCases: number): Promise<{
  occupations: WageOption[];
  states: WageOption[];
  fiscalYears: string[];
}> {
  const base = where({ status: "certified" });
  const [occ, st, fy] = await Promise.all([
    // The label is the title MOST rows carry for the code, not the first one
    // alphabetically: MIN(soc_title) named 15-1252 "Computer Programmers"
    // because a few filings still use the old title, while 119,000 say
    // "Software Developers". SQLite returns the bare column from the row
    // that holds MAX(n), which is what picks the modal title.
    rows<Record<string, unknown>>(
      `WITH t AS (SELECT substr(soc_code, 1, 7) AS code, soc_title AS title, COUNT(*) AS n
                    FROM lca_cases WHERE ${base.sql} AND soc_code IS NOT NULL AND soc_code <> ''
                   GROUP BY code, title),
            tot AS (SELECT code, SUM(n) AS n FROM t GROUP BY code HAVING SUM(n) >= ?),
            top AS (SELECT code, title, MAX(n) AS m FROM t GROUP BY code)
       SELECT tot.code AS code, top.title AS title, tot.n AS n
         FROM tot JOIN top ON top.code = tot.code
        ORDER BY tot.n DESC LIMIT 400`,
      [...base.args, minCases],
    ),
    rows<Record<string, unknown>>(
      `SELECT worksite_state AS state, COUNT(*) AS n
         FROM lca_cases WHERE ${base.sql} AND worksite_state IS NOT NULL AND worksite_state <> ''
        GROUP BY state HAVING n >= ? ORDER BY state`,
      [...base.args, minCases],
    ),
    rows<Record<string, unknown>>(
      "SELECT DISTINCT fiscal_year AS fy FROM lca_cases WHERE fiscal_year IS NOT NULL ORDER BY fy DESC",
    ),
  ]);
  return {
    occupations: occ.map((x) => ({
      value: String(x.code),
      label: `${String(x.title ?? x.code)} (${String(x.code)})`,
      n: Number(x.n),
    })),
    states: st.map((x) => ({ value: String(x.state), label: String(x.state), n: Number(x.n) })),
    fiscalYears: fy.map((x) => String(x.fy)),
  };
}
