import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import { keepLinkableSlugs } from "./entityLinks";
import { tableColumns } from "./tableColumns";

/**
 * One law firm's work outside PERM: the H-1B LCAs, prevailing wage requests
 * and H-2A, H-2B and CW-1 applications it filed for clients, and the employers
 * it filed them for.
 *
 * DOL names the representing firm on each filing, keyed here by its printed
 * name (`attorney_slug`). `scripts/build_employer_map.py` writes
 * `firm_page_map` nightly: every printed spelling that belongs to a firm with
 * a PERM page, matched by name and by the attorney typo rules, so
 * "Fragomen Del Rey Bernsen & LoewyLLP" on an LCA counts on Fragomen's page.
 * Before that table's first build, the page's own slug stands in.
 *
 * Every read runs on `<table>_att_dec (attorney_slug, decision_date)`.
 * Measured Oct 4 2026 on the largest firm (527,135 LCAs): the counts in 0.7 s
 * and the top employers in 1 s, on a page rebuilt monthly.
 */

export interface FirmEmployer {
  name: string;
  /** The employer's page, or null when it has none. */
  slug: string | null;
  filings: number;
}

export interface FirmProgramLine {
  filings: number;
  /** LCAs or seasonal applications DOL certified; null for wage requests, whose outcome is a wage, not a yes or no. */
  certified: number | null;
  firstDecided: string | null;
  lastDecided: string | null;
  employers: FirmEmployer[];
}

export interface FirmPrograms {
  lca: FirmProgramLine | null;
  pwd: FirmProgramLine | null;
  /** H-2A, H-2B and CW-1 applications (Oct 7 2026 on). */
  seasonal: FirmProgramLine | null;
  /** How many printed spellings of the firm's name the files were read under. */
  spellings: number;
}

const MAP = "firm_page_map";
export const FIRM_TOP_EMPLOYERS = 8;

async function firmSlugs(slug: string): Promise<string[]> {
  if (!(await tableColumns(MAP)).has("page_slug")) return [slug];
  const found = await rows<{ source_slug: string }>(
    `SELECT source_slug FROM ${MAP} WHERE page_slug = ? ORDER BY source_slug LIMIT 2000`,
    [slug],
  );
  return found.length ? found.map((r) => String(r.source_slug)) : [slug];
}

const CERTIFIED_SQL: Record<"lca_cases" | "pwd_cases" | "seasonal_cases", string> = {
  lca_cases: "SUM(CASE WHEN case_status = 'CERTIFIED' THEN 1 ELSE 0 END)",
  pwd_cases: "NULL",
  // Full and partial certifications, as the seasonal case page counts a grant.
  seasonal_cases:
    "SUM(CASE WHEN case_status LIKE '%CERTIFICATION%' AND case_status NOT LIKE '%WITHDRAWN%' THEN 1 ELSE 0 END)",
};

async function line(table: "lca_cases" | "pwd_cases" | "seasonal_cases", slugs: string[]): Promise<FirmProgramLine | null> {
  const where = `attorney_slug IN (${slugs.map(() => "?").join(", ")})`;
  const certified = CERTIFIED_SQL[table];
  const [counts, top] = await Promise.all([
    one<{ n: number | string; certified: number | string | null; first: string | null; last: string | null }>(
      `SELECT COUNT(*) AS n, ${certified} AS certified, MIN(decision_date) AS first, MAX(decision_date) AS last ` +
        `FROM ${table} INDEXED BY ${table}_att_dec WHERE ${where}`,
      slugs,
    ),
    rows<{ employer_slug: string | null; name: string | null; n: number | string }>(
      `SELECT employer_slug, MAX(employer_name) AS name, COUNT(*) AS n FROM ${table} INDEXED BY ${table}_att_dec ` +
        `WHERE ${where} GROUP BY employer_slug ORDER BY n DESC LIMIT ${FIRM_TOP_EMPLOYERS}`,
      slugs,
    ),
  ]);
  const filings = Number(counts?.n ?? 0);
  if (filings === 0) return null;
  const linked = await keepLinkableSlugs(
    top.map((r) => ({ employerSlug: r.employer_slug ? String(r.employer_slug) : null, name: String(r.name ?? ""), n: Number(r.n) })),
  );
  return {
    filings,
    certified: counts?.certified === null || counts?.certified === undefined ? null : Number(counts.certified),
    firstDecided: counts?.first ? String(counts.first).slice(0, 10) : null,
    lastDecided: counts?.last ? String(counts.last).slice(0, 10) : null,
    employers: linked.map((r) => ({ name: r.name, slug: r.employerSlug, filings: r.n })),
  };
}

export const getFirmPrograms = cache(async (slug: string): Promise<FirmPrograms | null> => {
  const slugs = await firmSlugs(slug);
  const [lca, pwd, seasonal] = await Promise.all([
    line("lca_cases", slugs).catch(() => null),
    line("pwd_cases", slugs).catch(() => null),
    line("seasonal_cases", slugs).catch(() => null),
  ]);
  if (!lca && !pwd && !seasonal) return null;
  return { lca, pwd, seasonal, spellings: slugs.length };
});
