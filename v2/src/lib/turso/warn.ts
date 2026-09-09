import "server-only";

import { cache } from "react";

import { rows } from "@/lib/turso/client";

/**
 * WARN notices, as the states publish them, matched to PERM sponsors by the
 * entity merge key. California, Texas, New York and Washington, each from the
 * record its state publishes (scripts/ingest_warn.py names the sources).
 * A notice is one filing with the state's own numbers; nothing here is a
 * layoff count for a company.
 */

export interface WarnNotice {
  id: string;
  state: string;
  noticeDate: string;
  effectiveDate: string | null;
  company: string;
  kind: string | null;
  employees: number | null;
  county: string | null;
  industry: string | null;
  employerSlug: string | null;
  sourceUrl: string;
}

interface DbRow {
  id: string;
  state: string;
  notice_date: string;
  effective_date: string | null;
  company: string;
  kind: string | null;
  employees: number | string | null;
  county: string | null;
  industry: string | null;
  employer_slug: string | null;
  source_url: string;
}

const COLS = "id, state, notice_date, effective_date, company, kind, employees, county, industry, employer_slug, source_url";

function hydrate(r: DbRow): WarnNotice {
  const n = r.employees === null || r.employees === undefined ? null : Number(r.employees);
  return {
    id: r.id,
    state: r.state,
    noticeDate: r.notice_date,
    effectiveDate: r.effective_date ?? null,
    company: r.company,
    kind: r.kind ?? null,
    employees: n !== null && Number.isFinite(n) ? n : null,
    county: r.county ?? null,
    industry: r.industry ?? null,
    employerSlug: r.employer_slug ?? null,
    sourceUrl: r.source_url,
  };
}

/** Notices matched to one sponsor, newest first. Indexed on (employer_slug, notice_date). */
export const warnForSlug = cache(async (slug: string, limit = 10): Promise<WarnNotice[]> => {
  const r = await rows<DbRow>(`SELECT ${COLS} FROM warn_notices WHERE employer_slug = ? ORDER BY notice_date DESC LIMIT ?`, [slug, limit]).catch(
    () => [] as DbRow[],
  );
  return r.map(hydrate);
});

export interface WarnTotals {
  notices: number;
  matched: number;
  employees: number;
}

/**
 * What the table HOLDS, which is not what the page lists.
 *
 * The page shows the newest few hundred notices, and until 2026-09-09 its
 * three headline figures were computed from that slice. That was accurate
 * while the corpus was one state's current report and became false the moment
 * Texas brought 2,367 notices back to 2019: a card reading "notices read: 400"
 * over a table holding 2,969 understates the record by a factor of seven.
 * Three aggregates over a few thousand indexed rows cost nothing; a wrong
 * figure on a page whose whole claim is checkable facts costs the page.
 *
 * `employees` counts only notices matched to a sponsor, because the card that
 * carries it reads "employees in those notices" directly under the sponsor
 * count. Summing every state's notices there would answer a question nobody
 * asked with a number four times larger.
 */
export const warnTotals = cache(async (): Promise<WarnTotals> => {
  const r = await rows<{ notices: number; matched: number; employees: number }>(
    `SELECT COUNT(*) AS notices,
            COUNT(employer_slug) AS matched,
            COALESCE(SUM(CASE WHEN employer_slug IS NOT NULL THEN employees END), 0) AS employees
       FROM warn_notices`,
  ).catch(() => [] as { notices: number; matched: number; employees: number }[]);
  const row = r[0];
  return {
    notices: Number(row?.notices ?? 0),
    matched: Number(row?.matched ?? 0),
    employees: Number(row?.employees ?? 0),
  };
});

/** The newest notices, matched and unmatched, for the layoffs page. Indexed on notice_date. */
export const recentWarn = cache(async (limit = 300): Promise<WarnNotice[]> => {
  const r = await rows<DbRow>(`SELECT ${COLS} FROM warn_notices ORDER BY notice_date DESC, company LIMIT ?`, [Math.min(limit, 1000)]).catch(
    () => [] as DbRow[],
  );
  return r.map(hydrate);
});
