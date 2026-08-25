/**
 * Reads for the public data pages, backed by Turso.
 *
 * Everything here is public DOL data. No user data is reachable from this
 * module - see client.ts for why that boundary is enforced rather than
 * merely intended.
 *
 * A NOTE ON ERROR HANDLING, BECAUSE THE PREVIOUS VERSION GOT IT WRONG.
 * The Convex call sites wrapped every fetch in `.catch(() => [])`. When the
 * deployment was disabled, /perm-employers, /perm-wages and /perm-cases each
 * returned HTTP 200 carrying nav and footer and about 1,300 characters of
 * visible text - an outage rendered as an empty state, which is
 * indistinguishable from a genuinely empty table and so passed every status
 * check. These functions THROW. A page that cannot load its data should fail
 * visibly, and Next's error boundary is the right place to decide what the
 * reader sees.
 */
import "server-only";

import type { EntityKind, EntityRow } from "@/lib/entityPayload";

import { one, rows } from "./client";

interface EntityDbRow {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number | null;
  denied: number | null;
  median_days: number | null;
  median_annual_wage: number | null;
  state: string | null;
  code: string | null;
}

function toEntityRow(r: EntityDbRow): EntityRow {
  return {
    slug: r.slug,
    name: r.name,
    rank: r.rank,
    total: r.total,
    certified: r.certified ?? 0,
    denied: r.denied ?? 0,
    medianDays: r.median_days,
    medianAnnualWage: r.median_annual_wage,
    state: r.state,
    code: r.code,
  };
}

const ENTITY_COLS =
  "slug, name, rank, total, certified, denied, median_days, median_annual_wage, state, code";

/** The head of one kind, plus how many exist in total. */
export async function getEntitySeed(
  kind: EntityKind,
  limit = 250,
): Promise<{ rows: EntityRow[]; total: number }> {
  const [head, count] = await Promise.all([
    rows<EntityDbRow>(
      `SELECT ${ENTITY_COLS} FROM perm_entities WHERE kind = ? ORDER BY rank LIMIT ?`,
      [kind, limit],
    ),
    one<{ n: number }>("SELECT count(*) AS n FROM perm_entities WHERE kind = ?", [kind]),
  ]);
  return { rows: head.map(toEntityRow), total: count?.n ?? head.length };
}

/**
 * Every row of one kind, in one query.
 *
 * The Convex version paged in 2,000-row batches with a rank cursor, a
 * 40,000-row runaway guard and a duplicate-rank check, because that backend
 * capped a single read. None of that is needed here, and the guards went with
 * it rather than being carried over as decoration.
 */
export async function getAllEntities(kind: EntityKind): Promise<EntityRow[]> {
  const all = await rows<EntityDbRow>(
    `SELECT ${ENTITY_COLS} FROM perm_entities WHERE kind = ? ORDER BY rank`,
    [kind],
  );
  return all.map(toEntityRow);
}

/** One entity by slug. `null` means no such page, which callers turn into a 404. */
export async function getEntityBySlug(
  kind: EntityKind,
  slug: string,
): Promise<EntityRow | null> {
  const r = await one<EntityDbRow>(
    `SELECT ${ENTITY_COLS} FROM perm_entities WHERE kind = ? AND slug = ?`,
    [kind, slug],
  );
  return r ? toEntityRow(r) : null;
}

async function doc<T>(key: string): Promise<T | null> {
  const r = await one<{ json: string; computed_at: number }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = ?",
    [key],
  );
  if (!r) return null;
  return { ...(JSON.parse(r.json) as object), computedAt: r.computed_at } as T;
}

/** The aggregate series: cohorts, clearance, frontier, byState, wage ladder, risk. */
export function getDisclosureStats<T = Record<string, unknown>>(): Promise<T | null> {
  return doc<T>("disclosure_stats");
}

/** Corpus metadata: totals, date span, byStatus / byFiscalYear / byState. */
export function getCasesMeta<T = Record<string, unknown>>(): Promise<T | null> {
  return doc<T>("cases_meta");
}

export function getWageMeta<T = Record<string, unknown>>(): Promise<T | null> {
  return doc<T>("wage_meta");
}

export interface WageCell {
  kind: string;
  key: string;
  socCode: string | null;
  socTitle: string | null;
  state: string | null;
  fiscalYear: string;
  count: number;
  p5: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  mean: number | null;
  histogram: unknown;
}

/**
 * Wage cells for one key.
 *
 * `fiscalYear` is part of the identity, not a filter you may omit: a key has
 * a row per year AND an 'all' rollup. Collapsing them cost 57% of the table
 * on the first load of this data and would have served one year's median as
 * the all-time figure.
 */
export async function getWageCells(
  kind: string,
  key: string,
  fiscalYear?: string,
): Promise<WageCell[]> {
  const sql =
    "SELECT kind, key, soc_code, soc_title, state, fiscal_year, count, p5, p10, p25, p50, p75, p90, p95, mean, histogram " +
    "FROM perm_wage_stats WHERE kind = ? AND key = ?" +
    (fiscalYear ? " AND fiscal_year = ?" : "") +
    " ORDER BY fiscal_year";
  const args = fiscalYear ? [kind, key, fiscalYear] : [kind, key];
  const r = await rows<Record<string, never>>(sql, args);
  return r.map((x) => {
    const o = x as unknown as Record<string, unknown>;
    return {
      kind: o.kind as string,
      key: o.key as string,
      socCode: (o.soc_code as string) ?? null,
      socTitle: (o.soc_title as string) ?? null,
      state: (o.state as string) ?? null,
      fiscalYear: o.fiscal_year as string,
      count: (o.count as number) ?? 0,
      p5: (o.p5 as number) ?? null,
      p10: (o.p10 as number) ?? null,
      p25: (o.p25 as number) ?? null,
      p50: (o.p50 as number) ?? null,
      p75: (o.p75 as number) ?? null,
      p90: (o.p90 as number) ?? null,
      p95: (o.p95 as number) ?? null,
      mean: (o.mean as number) ?? null,
      histogram: o.histogram ? JSON.parse(o.histogram as string) : null,
    };
  });
}

export async function getVisaBulletins(): Promise<
  Array<{
    bulletinMonth: string;
    sourceUrl: string | null;
    archivedAt: string | null;
    finalAction: unknown;
    datesForFiling: unknown;
  }>
> {
  const r = await rows<Record<string, string | null>>(
    "SELECT bulletin_month, source_url, archived_at, final_action, dates_for_filing " +
      "FROM visa_bulletins ORDER BY bulletin_month",
  );
  return r.map((x) => ({
    bulletinMonth: x.bulletin_month as string,
    // `?? null` rather than a cast: indexing a Record yields `| undefined`,
    // and the column is nullable, so both absences collapse to one.
    sourceUrl: x.source_url ?? null,
    archivedAt: x.archived_at ?? null,
    finalAction: x.final_action ? JSON.parse(x.final_action) : null,
    datesForFiling: x.dates_for_filing ? JSON.parse(x.dates_for_filing) : null,
  }));
}
