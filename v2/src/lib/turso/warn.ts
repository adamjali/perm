import "server-only";

import { cache } from "react";

import { rows } from "@/lib/turso/client";

/**
 * WARN notices, as the states publish them, matched to PERM sponsors by the
 * entity merge key. California only so far (scripts/ingest_warn.py says why).
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

/** The newest notices, matched and unmatched, for the layoffs page. Indexed on notice_date. */
export const recentWarn = cache(async (limit = 300): Promise<WarnNotice[]> => {
  const r = await rows<DbRow>(`SELECT ${COLS} FROM warn_notices ORDER BY notice_date DESC, company LIMIT ?`, [Math.min(limit, 1000)]).catch(
    () => [] as DbRow[],
  );
  return r.map(hydrate);
});
