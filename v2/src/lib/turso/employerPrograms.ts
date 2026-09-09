import "server-only";

import { cache } from "react";

import { medianOffset, type ProgramLine } from "../employerPrograms";
import { one } from "./client";
import { slugRange } from "./flagCases";
import { ANNUAL_WAGE_SQL } from "./lcaWages";

/**
 * One employer's wage-request and LCA record, as counts and a median.
 *
 * Every read is bounded by the employer's own slug range on the table's
 * employer index (`pwd_cases_emp`, `lca_cases_emp`, `pwd_case_status_emp`,
 * `lca_case_status_emp`), so the cost is the employer's rows and nothing
 * else: for the largest H-1B filer that is a few thousand LCA rows sorted
 * once for the median, on a page that regenerates monthly. The PERM line is
 * not read here; the employer page already holds it from `perm_entities`.
 */

/** The wage-request file spells its units three ways more than the LCA file does. */
const PWD_ANNUAL_WAGE_SQL =
  "CASE wage_unit WHEN 'YEAR' THEN wage WHEN 'ANNUAL' THEN wage WHEN 'HOUR' THEN wage * 2080 " +
  "WHEN 'HOURLY' THEN wage * 2080 WHEN 'MONTH' THEN wage * 12 WHEN 'WEEK' THEN wage * 52 WHEN 'BI-WEEKLY' THEN wage * 26 END";
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

async function programLine(program: "perm" | "pwd" | "lca", range: { lo: string; hi: string }): Promise<ProgramLine> {
  const t = TABLES[program];
  const where = "employer_slug >= ? AND employer_slug < ?";
  const [counts, live] = await Promise.all([
    one<{ n: number | string; wage_n: number | string }>(
      `SELECT COUNT(*) AS n, ` +
        `SUM(CASE WHEN (${t.annual}) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS wage_n ` +
        `FROM ${t.published} INDEXED BY ${EMP_INDEX[program]} WHERE ${where}`,
      [MIN_ANNUAL, MAX_ANNUAL, range.lo, range.hi],
    ),
    t.live
      ? one<{ n: number | string }>(
          `SELECT COUNT(*) AS n FROM ${t.live} INDEXED BY ${t.live}_emp WHERE ${where} AND is_final = 0` +
            (t.visaType ? " AND visa_type = ?" : ""),
          t.visaType ? [range.lo, range.hi, t.visaType] : [range.lo, range.hi],
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
      [range.lo, range.hi, MIN_ANNUAL, MAX_ANNUAL, medianOffset(wageN)],
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

export interface EmployerPrograms {
  perm: ProgramLine;
  pwd: ProgramLine;
  lca: ProgramLine;
  /** The slug prefix every read was bounded by. */
  matchedPrefix: string;
}

/**
 * All three programs for one employer.
 *
 * THE THREE FILES SPELL ONE EMPLOYER THREE WAYS. Measured Sep 8 2026: the
 * PERM entity is `cognizant-technology-solutions-us-corporation`, its 5,779
 * LCAs sit under `...-us-corp`, its wage requests under `...-corporation`.
 * The entity's own slug range found the LCAs of nobody. The join key that
 * works is the entity's `merge_key` - the normalised name the PERM entity
 * builder already uses to fold spellings, with the corporate suffix dropped -
 * slugified and used as the prefix. Where an entity has no merge key the
 * slug itself is the prefix, as before.
 */
export const getEmployerPrograms = cache(async (slug: string): Promise<EmployerPrograms | null> => {
  const entity = await one<{ merge_key: string | null }>(
    "SELECT merge_key FROM perm_entities WHERE kind = 'employer' AND slug = ?",
    [slug],
  ).catch(() => null);
  const prefixSource = entity?.merge_key ? String(entity.merge_key) : slug;
  const range = slugRange(prefixSource);
  if (!range) return null;
  const [perm, pwd, lca] = await Promise.all([
    programLine("perm", range),
    programLine("pwd", range),
    programLine("lca", range),
  ]);
  return { perm, pwd, lca, matchedPrefix: range.lo };
});
