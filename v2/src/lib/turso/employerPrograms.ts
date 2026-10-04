import "server-only";

import { cache } from "react";

import { medianOffset, type ProgramLine } from "../employerPrograms";
import { one } from "./client";
import { employerMatch, type EmployerMatch } from "./employerSlugs";
import { ANNUAL_WAGE_SQL, FLAG_ANNUAL_WAGE_SQL } from "./lcaWages";

/**
 * One employer's wage-request and LCA record, as counts and a median.
 *
 * Every read is bounded by the employer's own spellings (`employerMatch`,
 * from the nightly `employer_page_map`) on the table's employer index (`pwd_cases_emp`, `lca_cases_emp`, `pwd_case_status_emp`,
 * `lca_case_status_emp`), so the cost is the employer's rows and nothing
 * else: for the largest H-1B filer that is a few thousand LCA rows sorted
 * once for the median, on a page that regenerates monthly. The PERM line is
 * not read here; the employer page already holds it from `perm_entities`.
 */

/** The wage-request file spells its units more ways than the LCA file does. */
const PWD_ANNUAL_WAGE_SQL = FLAG_ANNUAL_WAGE_SQL;
const MIN_ANNUAL = 10_000;
const MAX_ANNUAL = 1_500_000;

interface Tables {
  published: string;
  live: string;
  annual: string;
  visaType: string | null;
}

const TABLES: Record<"perm" | "pwd" | "lca", Tables> = {
  // The PERM file's wage is already annual (DOL normalises it at publication), so the expression is the column.
  perm: { published: "perm_cases", live: "", annual: "wage", visaType: null },
  pwd: { published: "pwd_cases", live: "pwd_case_status", annual: PWD_ANNUAL_WAGE_SQL, visaType: "PERM" },
  lca: { published: "lca_cases", live: "lca_case_status", annual: ANNUAL_WAGE_SQL, visaType: null },
};

/** The employer index on each published table, by name. */
const EMP_INDEX: Record<"perm" | "pwd" | "lca", string> = {
  perm: "idx_pc_emp_dec",
  pwd: "pwd_cases_emp",
  lca: "lca_cases_emp",
};

async function programLine(program: "perm" | "pwd" | "lca", match: EmployerMatch): Promise<ProgramLine> {
  const t = TABLES[program];
  const where = match.where;
  const [counts, live] = await Promise.all([
    one<{ n: number | string; wage_n: number | string }>(
      `SELECT COUNT(*) AS n, ` +
        `SUM(CASE WHEN (${t.annual}) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS wage_n ` +
        `FROM ${t.published} INDEXED BY ${EMP_INDEX[program]} WHERE ${where}`,
      [MIN_ANNUAL, MAX_ANNUAL, ...match.args],
    ),
    t.live
      ? one<{ n: number | string }>(
          `SELECT COUNT(*) AS n FROM ${t.live} INDEXED BY ${t.live}_emp WHERE ${where} AND is_final = 0` +
            (t.visaType ? " AND visa_type = ?" : ""),
          t.visaType ? [...match.args, t.visaType] : match.args,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);
  const published = Number(counts?.n ?? 0);
  const wageN = Number(counts?.wage_n ?? 0);
  let median: number | null = null;
  if (wageN > 0) {
    const mid = await one<{ annual: number | string }>(
      `SELECT (${t.annual}) AS annual FROM ${t.published} INDEXED BY ${EMP_INDEX[program]} ` +
        `WHERE ${where} AND (${t.annual}) BETWEEN ? AND ? ORDER BY annual LIMIT 1 OFFSET ?`,
      [...match.args, MIN_ANNUAL, MAX_ANNUAL, medianOffset(wageN)],
    );
    median = mid ? Number(mid.annual) : null;
  }
  return {
    program,
    published,
    pending: live ? Number(live.n) : null,
    medianAnnualWage: median,
    wageN,
  };
}

/** An hourly wage outside this range is a typo or another unit, not a seasonal wage. */
const MIN_HOURLY = 5;
const MAX_HOURLY = 200;

/**
 * One employer's H-2A, H-2B and CW-1 record: the applications DOL published
 * (`seasonal_cases`), those still open in the live record, the workers DOL
 * certified, and the median hourly wage offered. Null when it has none, so
 * the page shows no empty seasonal line for the many employers that never
 * file one.
 */
async function seasonalLine(match: EmployerMatch): Promise<ProgramLine | null> {
  const where = match.where;
  const hourly = "wage_unit IN ('HOUR', 'HOURLY') AND wage BETWEEN ? AND ?";
  const [counts, live] = await Promise.all([
    one<{ n: number | string; wage_n: number | string; certified: number | string | null }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN ${hourly} THEN 1 ELSE 0 END) AS wage_n, ` +
        `SUM(workers_certified) AS certified FROM seasonal_cases INDEXED BY seasonal_cases_emp WHERE ${where}`,
      [MIN_HOURLY, MAX_HOURLY, ...match.args],
    ),
    one<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM seasonal_case_status INDEXED BY seasonal_case_status_emp WHERE ${where} AND is_final = 0`,
      match.args,
    ).catch(() => null),
  ]);
  const published = Number(counts?.n ?? 0);
  const pending = live ? Number(live.n) : null;
  if (published === 0 && !pending) return null;
  const wageN = Number(counts?.wage_n ?? 0);
  let median: number | null = null;
  if (wageN > 0) {
    const mid = await one<{ wage: number | string }>(
      `SELECT wage FROM seasonal_cases INDEXED BY seasonal_cases_emp WHERE ${where} AND ${hourly} ` +
        "ORDER BY wage LIMIT 1 OFFSET ?",
      [...match.args, MIN_HOURLY, MAX_HOURLY, medianOffset(wageN)],
    );
    median = mid ? Number(mid.wage) : null;
  }
  return {
    program: "seasonal",
    published,
    pending,
    medianAnnualWage: null,
    wageN,
    medianHourlyWage: median,
    workersCertified: counts?.certified === null || counts?.certified === undefined ? null : Number(counts.certified),
  };
}

export interface EmployerPrograms {
  perm: ProgramLine;
  pwd: ProgramLine;
  lca: ProgramLine;
  /** H-2A, H-2B and CW-1, from `seasonal_cases` and the live table; null when the employer has none. */
  seasonal: ProgramLine | null;
  /** How the rows were matched to this employer: its mapped spellings, its own slug, or the old name prefix. */
  match: Pick<EmployerMatch, "basis" | "spellings">;
}

/** Every program for one employer, over its spellings. */
export const getEmployerPrograms = cache(async (slug: string): Promise<EmployerPrograms | null> => {
  const match = await employerMatch(slug);
  if (!match) return null;
  const [perm, pwd, lca, seasonal] = await Promise.all([
    programLine("perm", match),
    programLine("pwd", match),
    programLine("lca", match),
    seasonalLine(match).catch(() => null),
  ]);
  return { perm, pwd, lca, seasonal, match: { basis: match.basis, spellings: match.spellings } };
});
