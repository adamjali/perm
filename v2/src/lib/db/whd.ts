import "server-only";

import { cache } from "react";

import { rows } from "@/lib/db/client";

/**
 * DOL Wage and Hour Division cases joined to an employer's page (scripts/ingest_whd.py writes `whd_cases`).
 *
 * Every figure is DOL's, case by case: violations found, the back wages the employer agreed to pay and to how many
 * workers, the civil money penalties assessed, and the same for H-1B, H-2A and H-2B. DOL's own cautions travel with
 * them: the findings dates aren't when the case opened or closed, "agreed to pay" isn't paid, and a case with no
 * violations is a case, not a finding.
 */

export interface WhdProgramTotals {
  /** Cases with a violation or back wages under this program. */
  cases: number;
  violations: number;
  backWages: number;
  workers: number;
}

export interface WhdCase {
  caseId: string;
  name: string;
  city: string | null;
  state: string | null;
  findingsStart: string | null;
  findingsEnd: string | null;
  violations: number;
  backWages: number;
  workersOwed: number;
  penalties: number;
  /** H-1B, H-2A and H-2B, where the case found anything under them. */
  visa: Array<{ program: "H-1B" | "H-2A" | "H-2B"; violations: number; backWages: number; workers: number }>;
}

export interface WhdSummary {
  cases: number;
  withViolations: number;
  backWages: number;
  workersOwed: number;
  penalties: number;
  h1b: WhdProgramTotals;
  h2a: WhdProgramTotals;
  h2b: WhdProgramTotals;
  firstStart: string | null;
  lastEnd: string | null;
  /** The newest cases by findings end, at most `limit`. */
  newest: WhdCase[];
}

type Row = Record<string, string | number | null>;

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

const PROGRAMS = [
  ["h1b", "H-1B"],
  ["h2a", "H-2A"],
  ["h2b", "H-2B"],
] as const;

function program(row: Row, p: string): WhdProgramTotals {
  return { cases: n(row[`${p}_cases`]), violations: n(row[`${p}_v`]), backWages: n(row[`${p}_bw`]), workers: n(row[`${p}_w`]) };
}

function hydrate(r: Row): WhdCase {
  return {
    caseId: String(r.case_id),
    name: String(r.legal_name || r.trade_name || ""),
    city: s(r.city),
    state: s(r.state),
    findingsStart: s(r.findings_start),
    findingsEnd: s(r.findings_end),
    violations: n(r.violations),
    backWages: n(r.back_wages),
    workersOwed: n(r.workers_owed),
    penalties: n(r.penalties),
    visa: PROGRAMS.map(([p, label]) => ({
      program: label,
      violations: n(r[`${p}_violations`]),
      backWages: n(r[`${p}_back_wages`]),
      workers: n(r[`${p}_workers`]),
    })).filter((v) => v.violations > 0 || v.backWages > 0),
  };
}

const programSums = PROGRAMS.map(
  ([p]) =>
    `SUM(CASE WHEN ${p}_violations > 0 OR ${p}_back_wages > 0 THEN 1 ELSE 0 END) AS ${p}_cases, ` +
    `SUM(${p}_violations) AS ${p}_v, SUM(${p}_back_wages) AS ${p}_bw, SUM(${p}_workers) AS ${p}_w`,
).join(", ");

/**
 * One employer page's cases: the totals over every case, and the newest few. Null before the table's first load
 * (no such table); any other failed read throws, so the page keeps its last good render rather than storing a month
 * of "no cases".
 */
export const whdForSlug = cache(async (slug: string, limit = 10): Promise<WhdSummary | null> => {
  try {
    const [totals, newest] = await Promise.all([
      rows<Row>(
        "SELECT COUNT(*) AS cases, SUM(CASE WHEN violations > 0 THEN 1 ELSE 0 END) AS with_v, SUM(back_wages) AS bw, " +
          `SUM(workers_owed) AS w, SUM(penalties) AS pen, ${programSums}, MIN(findings_start) AS first_start, ` +
          "MAX(findings_end) AS last_end FROM whd_cases WHERE employer_slug = ?",
        [slug],
      ),
      rows<Row>(
        "SELECT * FROM whd_cases WHERE employer_slug = ? ORDER BY findings_end IS NULL, findings_end DESC, case_id DESC LIMIT ?",
        [slug, limit],
      ),
    ]);
    const t = totals[0];
    if (!t || n(t.cases) === 0) return null;
    return {
      cases: n(t.cases),
      withViolations: n(t.with_v),
      backWages: n(t.bw),
      workersOwed: n(t.w),
      penalties: n(t.pen),
      h1b: program(t, "h1b"),
      h2a: program(t, "h2a"),
      h2b: program(t, "h2b"),
      firstStart: s(t.first_start),
      lastEnd: s(t.last_end),
      newest: newest.map(hydrate),
    };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});

export type VisaProgram = "H-1B" | "H-2A" | "H-2B";

export interface WhdBoardRow {
  caseId: string;
  name: string;
  city: string | null;
  state: string | null;
  findingsEnd: string | null;
  violations: number;
  backWages: number;
  workers: number;
  /** The employer page the case joined, or null where none could be named safely. */
  slug: string | null;
}

export interface WhdBoardProgram {
  program: VisaProgram;
  cases: number;
  violations: number;
  backWages: number;
  workers: number;
  /** Cases by the federal fiscal year their findings period ended in (October to September). */
  byYear: Array<{ fy: number; cases: number; backWages: number }>;
  /** The cases with the most back wages under this program. */
  top: WhdBoardRow[];
}

export interface WhdBoard {
  programs: WhdBoardProgram[];
  /** Cases whose findings ended in the newest fiscal year held, and the oldest. */
  firstFy: number | null;
  lastFy: number | null;
}

const BOARD_TOP = 15;
const FY_SQL = "CAST(substr(findings_end, 1, 4) AS INTEGER) + (CAST(substr(findings_end, 6, 2) AS INTEGER) >= 10)";

/** Every H-1B, H-2A and H-2B case in DOL's file: totals, by year, and the largest. A failed read throws. */
export const getWhdVisaBoard = cache(async (): Promise<WhdBoard | null> => {
  try {
    const programs = await Promise.all(
      PROGRAMS.map(async ([p, label]) => {
        const found = `(${p}_violations > 0 OR ${p}_back_wages > 0)`;
        const [totals, years, top] = await Promise.all([
          rows<Row>(
            `SELECT COUNT(*) AS cases, SUM(${p}_violations) AS v, SUM(${p}_back_wages) AS bw, SUM(${p}_workers) AS w FROM whd_cases WHERE ${found}`,
          ),
          rows<Row>(
            `SELECT ${FY_SQL} AS fy, COUNT(*) AS cases, SUM(${p}_back_wages) AS bw FROM whd_cases ` +
              `WHERE ${found} AND findings_end IS NOT NULL GROUP BY fy ORDER BY fy`,
          ),
          rows<Row>(
            `SELECT case_id, legal_name, trade_name, city, state, findings_end, ${p}_violations AS v, ${p}_back_wages AS bw, ` +
              `${p}_workers AS w, employer_slug FROM whd_cases WHERE ${found} ORDER BY ${p}_back_wages DESC, case_id LIMIT ?`,
            [BOARD_TOP],
          ),
        ]);
        const t = totals[0] ?? {};
        return {
          program: label,
          cases: n(t.cases),
          violations: n(t.v),
          backWages: n(t.bw),
          workers: n(t.w),
          byYear: years.map((y) => ({ fy: n(y.fy), cases: n(y.cases), backWages: n(y.bw) })),
          top: top.map((r) => ({
            caseId: String(r.case_id),
            name: String(r.legal_name || r.trade_name || ""),
            city: s(r.city),
            state: s(r.state),
            findingsEnd: s(r.findings_end),
            violations: n(r.v),
            backWages: n(r.bw),
            workers: n(r.w),
            slug: s(r.employer_slug),
          })),
        } satisfies WhdBoardProgram;
      }),
    );
    if (programs.every((p) => p.cases === 0)) return null;
    const fys = programs.flatMap((p) => p.byYear.map((y) => y.fy)).filter((fy) => fy > 0);
    return { programs, firstFy: fys.length ? Math.min(...fys) : null, lastFy: fys.length ? Math.max(...fys) : null };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});
