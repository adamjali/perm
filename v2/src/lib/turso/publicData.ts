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

import type { BulletinMonth } from "@/lib/perm";
import { MIN_TOTAL_FOR_PAGE, type EntityKind, type EntityRow } from "@/lib/entityPayload";

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
    // Pageworthy count, so the header's "N employers" matches what the table
    // can actually enumerate; the sub-floor corpus is reachable via search.
    one<{ n: number }>(
      "SELECT count(*) AS n FROM perm_entities WHERE kind = ? AND total >= ?",
      [kind, MIN_TOTAL_FOR_PAGE],
    ),
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
  // Pageworthy rows only. Storage floor dropped to 1 on 2026-08-26 (71,748
  // employers instead of 16,305 - an attorney searched a 2-case firm she
  // knows and found nothing), but this feeds the bulk /api dump and the
  // sitemap: returning every row would quadruple a ~900 KB payload for rows
  // that have no ranked place in the index table. Search reaches the whole
  // corpus through searchByName; a sub-floor entity's page still renders on
  // demand via getEntityBySlug.
  const all = await rows<EntityDbRow>(
    `SELECT ${ENTITY_COLS} FROM perm_entities WHERE kind = ? AND total >= ? ORDER BY rank`,
    [kind, MIN_TOTAL_FOR_PAGE],
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

/**
 * The aggregate document, typed.
 *
 * Mirrors the return validator the Convex query used to declare. Written out
 * rather than inferred from the JSON: `JSON.parse` yields `any`, and a
 * generic default of `Record<string, unknown>` collapses every field to `{}`,
 * which typechecks at the call site and then renders nothing. The nullable
 * percentiles are nullable in the data, not as a formality - a wage ladder is
 * only meaningful if all three rungs exist and ascend.
 */
export interface Cohort {
  cohortMonth: string;
  decided: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}
export interface ClearanceMonth {
  month: string;
  decisions: number;
}
export interface FrontierPoint {
  decisionMonth: string;
  medianFilingMonth: string;
  decisions: number;
}
export interface StateStat {
  state: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
}
export interface SocStat {
  code: string;
  title: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
}
export interface EmployerStat {
  name: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
}
export interface AttorneyStat extends EmployerStat {
  /** Two-letter state, or "" when DOL's cell was unusable. */
  state: string;
}
export interface WageLadder {
  count: number;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}
export interface RiskRow {
  bucket: string;
  decided: number;
  denied: number;
  denialRate: number;
}
export interface Risk {
  baseline: { decided: number; denied: number; denialRate: number };
  byWage: RiskRow[];
  byYear: RiskRow[];
  byFlag: RiskRow[];
}
export interface DisclosureStats {
  sourceFiles: string[];
  uniqueCases: number;
  cohorts: Cohort[];
  clearanceByMonth: ClearanceMonth[];
  frontierHistory: FrontierPoint[];
  byState?: StateStat[];
  topOccupations?: SocStat[];
  topEmployers?: EmployerStat[];
  topAttorneys?: AttorneyStat[];
  wageLadder?: WageLadder | null;
  risk?: Risk;
  computedAt: number;
}

/**
 * How many entity rows the aggregate document carries per kind.
 *
 * THIS NUMBER IS LOAD-BEARING AND MUST NOT BE RAISED CASUALLY.
 * `dataPageFigures.deriveFigures` turns these arrays into "the largest
 * sponsors account for N% of cases". That statistic is only meaningful
 * against a FIXED head of the ranking - hand it all 16,305 employers and the
 * share becomes ~100% and the published figure quietly changes meaning while
 * still rendering a plausible number.
 *
 * 250 is what the Convex aggregate happened to hold, for an unrelated reason
 * (its 1 MB document cap). The cap is gone; the statistic's definition is
 * not, so the number is now an explicit editorial choice rather than an
 * accident of the old backend.
 */
export const STATS_ENTITY_HEAD = 250;

/**
 * The aggregate series: cohorts, clearance, frontier, byState, wage ladder,
 * risk - plus the head of each entity ranking.
 *
 * The entity arrays are hydrated from `perm_entities` rather than stored a
 * second time in the document. Keeping a copy in both places is how the
 * truncated 250-row version became the de-facto source of truth for pages
 * that should have been reading the full table.
 */
export async function getDisclosureStats<T = DisclosureStats>(): Promise<T | null> {
  const base = await doc<Record<string, unknown>>("disclosure_stats");
  if (!base) return null;
  const [employers, attorneys, occupations] = await Promise.all([
    getEntitySeed("employer", STATS_ENTITY_HEAD),
    getEntitySeed("attorney", STATS_ENTITY_HEAD),
    getEntitySeed("occupation", STATS_ENTITY_HEAD),
  ]);
  return {
    ...base,
    topEmployers: employers.rows.map((r) => ({
      name: r.name, total: r.total, certified: r.certified,
      denied: r.denied, medianDays: r.medianDays,
    })),
    topAttorneys: attorneys.rows.map((r) => ({
      name: r.name, total: r.total, certified: r.certified,
      denied: r.denied, medianDays: r.medianDays, state: r.state,
    })),
    topOccupations: occupations.rows.map((r) => ({
      title: r.name, code: r.code, total: r.total, certified: r.certified,
      denied: r.denied, medianDays: r.medianDays,
      medianAnnualWage: r.medianAnnualWage,
    })),
  } as T;
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

/**
 * The bulletin series in the shape the priority-date chart expects: ascending
 * by month, with `archivedAt` and `sourceUrl` as plain strings.
 *
 * Both are non-null for every row the archive ingest writes, but the columns
 * are nullable, so the coercion happens once here instead of at the call
 * site. `getVisaBulletins` above stays honest about the column types.
 */
export async function getVisaBulletinSeries(): Promise<
  Array<BulletinMonth & { archivedAt: string; sourceUrl: string }>
> {
  const all = await getVisaBulletins();
  return all
    .map((b) => ({
      bulletinMonth: b.bulletinMonth,
      archivedAt: b.archivedAt ?? "",
      sourceUrl: b.sourceUrl ?? "",
      finalAction: b.finalAction as BulletinMonth["finalAction"],
      datesForFiling: b.datesForFiling as BulletinMonth["datesForFiling"],
    }))
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
}

/**
 * How many entities of one kind actually HAVE a page.
 *
 * The sitemap index has to know how many child files exist before it can list
 * them, and that count is of PAGEWORTHY rows, not of all rows: everything
 * below the threshold is stored and searchable but has no URL. Counting in
 * SQL rather than fetching 16,305 rows to call .filter().length on them.
 */
export async function countPageworthy(kind: EntityKind): Promise<number> {
  const r = await one<{ n: number }>(
    "SELECT count(*) AS n FROM perm_entities WHERE kind = ? AND total >= ?",
    [kind, MIN_TOTAL_FOR_PAGE],
  );
  return r?.n ?? 0;
}

export interface DatasetFreshness {
  dataset: string;
  asOf: string | null;
  fetchedAt: number;
  source: string;
  cadence: string;
  note: string | null;
  /** Days after which this dataset should be treated as overdue. */
  maxAgeDays: number | null;
  /** Whole days between the as-of date and now, null if unparseable. */
  ageDays: number | null;
  /** ageDays past maxAgeDays. An ingest has probably stopped. */
  stale: boolean;
}

export interface DailyDecisions {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

/**
 * Decisions DOL issued on a single day, ascending.
 *
 * Two sources live in this table and they are not interchangeable.
 * "dol-disclosure" is ours, derived from our own case corpus, and runs to 947
 * days. "permtrack" is the rival's series, backfilled for comparison, and runs
 * to 88. The default is ours; pass the other only when the point IS the
 * comparison.
 */
export async function getDailyDecisions(
  source = "dol-disclosure",
): Promise<DailyDecisions[]> {
  const r = await rows<Record<string, unknown>>(
    "SELECT date, total, certified, denied, withdrawn FROM daily_decisions " +
      "WHERE source = ? ORDER BY date",
    [source],
  );
  return r.map((x) => ({
    date: x.date as string,
    // The columns are nullable, and indexing a Record yields `| undefined`.
    // Both absences collapse to 0 so a caller never has to guard arithmetic.
    total: (x.total as number) ?? 0,
    certified: (x.certified as number) ?? 0,
    denied: (x.denied as number) ?? 0,
    withdrawn: (x.withdrawn as number) ?? 0,
  }));
}

/**
 * The freshness registry: what every dataset is, where it comes from, the
 * date it carries, and how often it moves. Written by the ingest scripts;
 * rendered by <DataProvenance> so provenance sits ON the page instead of in
 * a methodology page nobody visits. A row per dataset, replaced on ingest.
 */
export async function getFreshness(): Promise<Record<string, DatasetFreshness>> {
  const r = await rows<Record<string, unknown>>(
    "SELECT dataset, as_of, fetched_at, source, cadence, note, max_age_days FROM data_freshness",
  );
  const out: Record<string, DatasetFreshness> = {};
  const now = Date.now();
  for (const x of r) {
    const asOf = (x.as_of as string) ?? null;
    const maxAgeDays = (x.max_age_days as number) ?? null;
    // A bare "2026-08" is a month, and Date.parse reads it as the 1st, which
    // makes a fresh monthly dataset look up to 30 days older than it is.
    // Anchor a month to its END so the age is the smallest true value.
    let ageDays: number | null = null;
    if (asOf) {
      const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(asOf);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = m[3] ? Number(m[3]) : new Date(Date.UTC(y, mo, 0)).getUTCDate();
        ageDays = Math.floor((now - Date.UTC(y, mo - 1, d)) / 86_400_000);
      }
    }
    out[x.dataset as string] = {
      dataset: x.dataset as string,
      asOf,
      fetchedAt: (x.fetched_at as number) ?? 0,
      source: (x.source as string) ?? "",
      cadence: (x.cadence as string) ?? "",
      note: (x.note as string) ?? null,
      maxAgeDays,
      ageDays,
      // Only claim stale when BOTH numbers are known. An unknown age is not
      // evidence of freshness, but it is not evidence of staleness either,
      // and a false alarm on every page teaches people to ignore the real one.
      stale: ageDays !== null && maxAgeDays !== null && ageDays > maxAgeDays,
    };
  }
  return out;
}

export interface I485Position {
  asOf: string;
  country: string;
  category: string;
  /** Applications pending with an EARLIER priority date, counted cells only. */
  counted: number;
  /** How many cells USCIS suppressed inside that set (each holds 1-10). */
  suppressedCells: number;
  /** counted + suppressedCells (every suppressed cell at its floor of 1). */
  low: number;
  /** counted + suppressedCells * 10 (every suppressed cell at its ceiling). */
  high: number;
  /** The priority-date range USCIS publishes for this country+category. */
  coverage: { earliest: string; latest: string };
  /** True when the asked-for date sits outside that published range. */
  outsideCoverage: boolean;
  /** Total pending in this country+category, for context. */
  categoryTotal: number;
}

/**
 * How many employment-based adjustment applications sit ahead of a given
 * priority date, from USCIS's own monthly inventory.
 *
 * WE PUBLISH A RANGE, NOT A POINT. USCIS replaces any cell holding 1-10
 * applications with a "D", so an exact total is not knowable from the
 * release. The rival resolves every D to 5 and prints one number with an
 * error bar underneath; on a site that refuses to blend denial factors into
 * a single score because the inputs cannot carry it, a point estimate here
 * would be the same mistake. `low` and `high` are the arithmetic bounds and
 * both are true statements about the published data.
 *
 * "Ahead" counts BOTH pending statuses. A case whose visa number is already
 * available but which USCIS has not adjudicated is still in front of you in
 * the only queue that matters to the asker.
 */
export async function getI485Position(
  country: string,
  category: string,
  pdYear: number,
  pdMonth: number,
): Promise<I485Position | null> {
  const asOf = await one<{ d: string }>(
    "SELECT max(as_of) AS d FROM i485_inventory",
  );
  if (!asOf?.d) return null;

  const agg = await one<{ counted: number; sup: number }>(
    `SELECT coalesce(sum(count), 0) AS counted,
            coalesce(sum(suppressed), 0) AS sup
       FROM i485_inventory
      WHERE as_of = ? AND country = ? AND category = ?
        AND (pd_year = 'prior'
             OR (pd_year <> 'prior' AND CAST(pd_year AS INTEGER) < ?)
             OR (pd_year = ? AND pd_month < ?))`,
    [asOf.d, country, category, pdYear, String(pdYear), pdMonth],
  );
  if (!agg) return null;

  const span = await one<{ lo: string; hi: string; total: number }>(
    `SELECT min(CASE WHEN pd_year = 'prior' THEN '0000' ELSE pd_year END) AS lo,
            max(CASE WHEN pd_year = 'prior' THEN '0000' ELSE pd_year END) AS hi,
            coalesce(sum(count), 0) AS total
       FROM i485_inventory
      WHERE as_of = ? AND country = ? AND category = ?`,
    [asOf.d, country, category],
  );
  if (!span?.hi) return null;

  const counted = Number(agg.counted) || 0;
  const sup = Number(agg.sup) || 0;
  return {
    asOf: asOf.d,
    country,
    category,
    counted,
    suppressedCells: sup,
    low: counted + sup,
    high: counted + sup * 10,
    coverage: { earliest: span.lo === "0000" ? "prior" : span.lo, latest: span.hi },
    outsideCoverage: pdYear > Number(span.hi),
    categoryTotal: Number(span.total) || 0,
  };
}

/** Which country+category pairs USCIS actually publishes, for the form. */
export async function getI485Options(): Promise<
  { country: string; categories: string[] }[]
> {
  const r = await rows<{ country: string; category: string }>(
    `SELECT DISTINCT country, category FROM i485_inventory
      WHERE as_of = (SELECT max(as_of) FROM i485_inventory)
      ORDER BY country, category`,
  );
  const byCountry = new Map<string, string[]>();
  for (const x of r) {
    const list = byCountry.get(x.country) ?? [];
    list.push(x.category);
    byCountry.set(x.country, list);
  }
  return [...byCountry.entries()].map(([country, categories]) => ({ country, categories }));
}

/** Month-over-month movement in the whole pending inventory. */
export async function getI485Trend(): Promise<{ asOf: string; total: number }[]> {
  const r = await rows<{ as_of: string; total: number }>(
    `SELECT as_of, coalesce(sum(count), 0) AS total
       FROM i485_inventory GROUP BY as_of ORDER BY as_of`,
  );
  return r.map((x) => ({ asOf: x.as_of, total: Number(x.total) || 0 }));
}

/**
 * Every published cell in the newest release, keyed by country and category.
 *
 * `getI485Position` answers one question per query, which is the right shape
 * for a server caller. The calculator page needs a different shape: four
 * selects, each of which would otherwise be a database round-trip and a
 * pending state on a figure that ought to be instant. So the page takes the
 * whole table once and computes in the browser, exactly as every other
 * calculator in the suite takes its dataset as a prop.
 *
 * It is affordable because the release is small: 2,424 grouped cells, 38 KB
 * of JSON, about 6 KB over the wire once compressed.
 *
 * The two statuses USCIS reports, `awaiting availability` and `available`,
 * are summed here. Both are pending and both sit ahead of a later priority
 * date, which is the same rule `getI485Position` applies.
 *
 * Shape is `[year, month, count, suppressed]` with year 0 for the "Prior
 * Years" column, which keeps it compact and lets it sort ahead of every real
 * year without special handling. `src/lib/i485/position.ts` consumes it.
 */
export async function getI485Cells(): Promise<Record<string, [number, number, number, number][]>> {
  const r = await rows<{
    country: string;
    category: string;
    pd_year: string;
    pd_month: number;
    c: number;
    s: number;
  }>(
    `SELECT country, category, pd_year, pd_month,
            coalesce(sum(count), 0) AS c, coalesce(sum(suppressed), 0) AS s
       FROM i485_inventory
      WHERE as_of = (SELECT max(as_of) FROM i485_inventory)
      GROUP BY country, category, pd_year, pd_month
      ORDER BY country, category,
               (CASE WHEN pd_year = 'prior' THEN 0 ELSE CAST(pd_year AS INTEGER) END),
               pd_month`,
  );
  const out: Record<string, [number, number, number, number][]> = {};
  for (const x of r) {
    const key = `${x.country}|${x.category}`;
    (out[key] ??= []).push([
      x.pd_year === "prior" ? 0 : Number(x.pd_year),
      Number(x.pd_month),
      Number(x.c) || 0,
      Number(x.s) || 0,
    ]);
  }
  return out;
}

export interface MonthQueueStat {
  filingMonth: string;
  total: number;
  pending: number;
  decided: number;
  analystReview: number;
  rfiIssued: number;
  auditResponse: number;
  appeals: number;
  /** decided / total, 0-100. Null when the month holds nothing. */
  decidedPct: number | null;
}

export interface QueueAhead {
  /** Pending cases filed BEFORE the given month. */
  ahead: number;
  /** Pending cases in the same filing month. */
  sameMonth: number;
  /** Every month's progress, oldest first. */
  months: MonthQueueStat[];
  /** The subject month's own row, when we hold one. */
  subject: MonthQueueStat | null;
  /** Months DOL is visibly working: some decided, not yet finished. */
  activeRange: { from: string; to: string } | null;
  source: string;
}

function toMonthStat(r: Record<string, unknown>): MonthQueueStat {
  const total = Number(r.total) || 0;
  const decided = Number(r.decided) || 0;
  return {
    filingMonth: String(r.filing_month),
    total,
    pending: Number(r.pending) || 0,
    decided,
    analystReview: Number(r.analyst_review) || 0,
    rfiIssued: Number(r.rfi_issued) || 0,
    auditResponse: Number(r.audit_response) || 0,
    appeals: Number(r.appeals) || 0,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

/**
 * How much of the PERM queue sits in front of a given filing month.
 *
 * THIS IS THE ONE THING DOL'S OWN FILES CANNOT ANSWER. The quarterly
 * disclosure release contains no pending rows - every record carries a
 * decision date - so a pending count cannot be derived from it at any level
 * of effort. These counts come from per-case status, mirrored with
 * attribution; `source` is carried through to the page rather than kept in a
 * footnote.
 *
 * "Ahead" counts PENDING cases only. A decided case in an earlier month is
 * no longer in front of anyone, and counting it would inflate the number in
 * exactly the direction that flatters a wait estimate.
 */
export async function getQueueAhead(filingMonth: string): Promise<QueueAhead | null> {
  const all = await rows<Record<string, unknown>>(
    `SELECT filing_month, total, pending, decided, analyst_review, rfi_issued,
            audit_response, appeals, source
       FROM perm_month_stats ORDER BY filing_month`,
  );
  if (all.length === 0) return null;

  const months = all.map(toMonthStat);
  const ahead = months
    .filter((m) => m.filingMonth < filingMonth)
    .reduce((n, m) => n + m.pending, 0);
  const subject = months.find((m) => m.filingMonth === filingMonth) ?? null;

  // The band DOL is visibly working: months that have started but are not
  // finished. A month at 0% has not been reached; one at ~100% is done.
  const working = months.filter(
    (m) => m.decidedPct !== null && m.decidedPct > 0.5 && m.decidedPct < 99,
  );
  const activeRange = working.length
    ? {
        from: working[0]!.filingMonth,
        to: working[working.length - 1]!.filingMonth,
      }
    : null;

  return {
    ahead,
    sameMonth: subject?.pending ?? 0,
    months,
    subject,
    activeRange,
    source: String(all[0]?.source ?? ""),
  };
}

/** Every month's queue progress, for the bar chart. */
export async function getMonthQueueStats(): Promise<MonthQueueStat[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT filing_month, total, pending, decided, analyst_review, rfi_issued,
            audit_response, appeals
       FROM perm_month_stats ORDER BY filing_month`,
  );
  return r.map(toMonthStat);
}

// ---------------------------------------------------------------------------
// Salary explorer
//
// FOLLOW-UP: this file is now ~1,050 lines against cases.ts at 488, and the
// browse-shaped reads below have the same shape as the ones in cases.ts - a
// filtered layer serving an API route. A split into turso/wages.ts is the
// right end state. Deliberately NOT done now: three agents are in this tree
// and a file move buys a merge conflict for no user-visible gain.
// ---------------------------------------------------------------------------

export type WageStatusFilter = "certified" | "denied" | "withdrawn" | "all";

export interface WageFilters {
  /** SOC code, e.g. "15-1252". Null means every occupation. */
  socCode?: string | null;
  /** Two-letter worksite state. Null means the whole country. */
  state?: string | null;
  /** Fiscal year as DOL prints it. Null means the whole window. */
  fiscalYear?: string | null;
  /** Defaults to certified: a denied case's offered wage was never agreed. */
  status?: WageStatusFilter;
}

export interface WagePercentileRow {
  n: number;
  avg: number | null;
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
}

export interface WageStateRow extends WagePercentileRow {
  state: string;
}

export interface WageOption {
  value: string;
  label: string;
  n: number;
}

/**
 * The filtered population, as a WHERE fragment plus its arguments.
 *
 * `wage > 0` is not tidiness. DOL's files carry rows with a null or zero
 * offered wage, and averaging those in drags every figure down by an amount
 * that varies with how many such rows a filter happens to catch, which is the
 * worst kind of wrong: invisible and inconsistent.
 */
function wageWhere(f: WageFilters): { sql: string; args: unknown[] } {
  const parts = ["wage IS NOT NULL", "wage > 0"];
  const args: unknown[] = [];
  const status = f.status ?? "certified";
  if (status !== "all") {
    parts.push("status = ?");
    args.push(status);
  }
  if (f.socCode) {
    parts.push("soc_code = ?");
    args.push(f.socCode);
  }
  if (f.state) {
    parts.push("state = ?");
    args.push(f.state);
  }
  if (f.fiscalYear) {
    parts.push("fiscal_year = ?");
    args.push(f.fiscalYear);
  }
  return { sql: parts.join(" AND "), args };
}

/**
 * Percentile over the SELECTED subset, by LINEAR INTERPOLATION.
 *
 * The whole point of the explorer: a median must describe the rows the reader
 * filtered to, never the corpus. Computed in SQL because doing it in JS means
 * shipping 373,162 wages through the RSC payload to produce five numbers.
 *
 * INTERPOLATED, NOT NEAREST-RANK, AND THAT IS NOT A FREE CHOICE. This project
 * already fixed the definition: `percentile()` in scripts/ingest_perm_disclosure.py
 * uses numpy's default `linear` method and its docstring says so explicitly,
 * so that wage stats and processing-time percentiles agree everywhere on the
 * site. Rank k = (n-1) * p, then interpolate between floor(k) and ceil(k).
 *
 * This first shipped nearest-rank, on the reasoning that interpolating
 * between two middle values invents a wage nobody was offered. That is a fair
 * argument and it is the wrong one to make here: the cost of one figure being
 * computed differently from every other figure on the site is larger than the
 * cost of a median landing between two real offers. The cross-check script
 * caught it - four materialised rows disagreed by $1 to $37 with counts
 * matching exactly, which is the signature of a definition mismatch rather
 * than a stale corpus.
 *
 * Verified: this SQL reproduces perm_wage_stats' own p50 exactly on every row
 * that had diverged. `scripts/cross_check_wage_stats.py` keeps it that way.
 *
 * ONE DIFFERENCE REMAINS AND IT IS A DOLLAR. SQLite's ROUND() rounds halves
 * away from zero; Python's round() rounds them to even, which the upstream
 * percentile() docstring calls out by name. So a percentile landing exactly on
 * a half-dollar can differ by $1 between the two routes - measured on 2 of 8
 * per-state rows, e.g. FL's median at 58638.5. Matching banker's rounding in
 * SQLite is real complexity for a difference no reader of a wage can act on,
 * so the cross-check tolerates exactly $1 and nothing more.
 */
function percentileExpr(p: number, name: string): string {
  const k = `(c.n - 1) * ${p}`;
  const lo = `1 + CAST(${k} AS INTEGER)`;
  return (
    `(SELECT ROUND(lo.wage + (hi.wage - lo.wage) * (${k} - CAST(${k} AS INTEGER)))` +
    `   FROM c JOIN o lo ON lo.rn = ${lo}` +
    `          JOIN o hi ON hi.rn = MIN(${lo} + 1, c.n)) AS ${name}`
  );
}

const PERCENTILE_SELECT = (
  [
    [0.05, "p5"],
    [0.25, "p25"],
    [0.5, "p50"],
    [0.75, "p75"],
    [0.95, "p95"],
  ] as const
)
  .map(([p, name]) => percentileExpr(p, name))
  .join(",\n            ");

/**
 * The same interpolation, per state.
 *
 * A partitioned window rather than the correlated-subquery form above,
 * because one query per state would be 56 round trips to build one table.
 * `n` is constant within a partition, so MAX(n) inside the aggregate is that
 * partition's count rather than a maximum over anything.
 */
function statePercentileExpr(p: number, name: string): string {
  const k = `(n - 1) * ${p}`;
  const loRank = `1 + CAST(${k} AS INTEGER)`;
  const lo = `MAX(CASE WHEN rn = ${loRank} THEN wage END)`;
  const hi = `MAX(CASE WHEN rn = MIN(${loRank} + 1, n) THEN wage END)`;
  const frac = `(MAX(${k}) - CAST(MAX(${k}) AS INTEGER))`;
  return `ROUND(${lo} + (${hi} - ${lo}) * ${frac}) AS ${name}`;
}

const STATE_PERCENTILE_SELECT = (
  [
    [0.05, "p5"],
    [0.25, "p25"],
    [0.5, "p50"],
    [0.75, "p75"],
    [0.95, "p95"],
  ] as const
)
  .map(([p, name]) => statePercentileExpr(p, name))
  .join(",\n            ");

export async function getWageStats(f: WageFilters): Promise<WagePercentileRow> {
  const w = wageWhere(f);
  const r = await one<Record<string, unknown>>(
    `WITH f AS (SELECT wage FROM perm_cases WHERE ${w.sql}),
          c AS (SELECT COUNT(*) AS n FROM f),
          o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f)
     SELECT (SELECT n FROM c) AS n, (SELECT AVG(wage) FROM f) AS avg,
            ${PERCENTILE_SELECT}`,
    w.args,
  );
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
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

/** Every occupied bin at the given width, oldest edge first. */
export async function getWageHistogram(
  f: WageFilters,
  width: number,
): Promise<{ from: number; count: number }[]> {
  const w = wageWhere(f);
  // Width is a number this module computed, never caller text, but it is
  // still bound rather than interpolated so the shape of this query cannot
  // depend on a value at all.
  const r = await rows<Record<string, unknown>>(
    `SELECT CAST(wage / ? AS INTEGER) * ? AS bin, COUNT(*) AS n
       FROM perm_cases WHERE ${w.sql}
      GROUP BY bin ORDER BY bin`,
    [width, width, ...w.args],
  );
  return r.map((x) => ({ from: Number(x.bin), count: Number(x.n) }));
}

/**
 * Per-state percentiles for the same filtered population.
 *
 * One query with a PARTITION rather than one query per state: 56 round trips
 * to build one table is how a page ends up taking eight seconds.
 */
export async function getWageByState(
  f: WageFilters,
  minCases: number,
): Promise<WageStateRow[]> {
  const w = wageWhere({ ...f, state: null });
  const r = await rows<Record<string, unknown>>(
    `WITH o AS (
       SELECT state, wage,
              ROW_NUMBER() OVER (PARTITION BY state ORDER BY wage) AS rn,
              COUNT(*)     OVER (PARTITION BY state)               AS n
         FROM perm_cases WHERE ${w.sql} AND state IS NOT NULL AND state <> ''
     )
     SELECT state, MAX(n) AS n, AVG(wage) AS avg,
            ${STATE_PERCENTILE_SELECT}
       FROM o GROUP BY state HAVING MAX(n) >= ? ORDER BY MAX(n) DESC`,
    [...w.args, minCases],
  );
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
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
 * What the filters may be set to.
 *
 * Occupations carry their case count and are ordered by it, because a list of
 * 4,893 SOC codes in alphabetical order is a list nobody can use. The count
 * also lets the picker show which choices will actually support a figure.
 */
export async function getWageFilterOptions(minCases: number): Promise<{
  occupations: WageOption[];
  states: WageOption[];
  fiscalYears: string[];
}> {
  const [occ, st, fy] = await Promise.all([
    // Labels come from perm_entities, NOT from perm_cases.soc_title.
    //
    // That column holds the EMPLOYER'S free-text job title, not the standard
    // occupation name: soc_code 15-1252.00 carries 263 distinct values across
    // its rows, among them "Software Developers", "SOFTWARE DEVELOPERS",
    // "Senior QA Automation Engineer" and "software engineer". A
    // MAX(soc_title) label would therefore name each occupation after
    // whichever job title happened to sort last, which is arbitrary and looks
    // deliberate. perm_entities carries one canonical name per code and is
    // what the /perm-wages pages already display.
    rows<Record<string, unknown>>(
      `SELECT code AS soc_code, name AS soc_title, total AS n
         FROM perm_entities
        WHERE kind = 'occupation' AND code IS NOT NULL AND code <> ''
          AND total >= ? ORDER BY total DESC`,
      [minCases],
    ),
    rows<Record<string, unknown>>(
      `SELECT state, COUNT(*) AS n
         FROM perm_cases
        WHERE wage IS NOT NULL AND wage > 0 AND state IS NOT NULL AND state <> ''
        GROUP BY state HAVING COUNT(*) >= ? ORDER BY state`,
      [minCases],
    ),
    rows<Record<string, unknown>>(
      `SELECT DISTINCT fiscal_year FROM perm_cases
        WHERE fiscal_year IS NOT NULL AND fiscal_year <> '' ORDER BY fiscal_year DESC`,
    ),
  ]);
  return {
    occupations: occ.map((r) => ({
      value: String(r.soc_code),
      label: String(r.soc_title ?? r.soc_code),
      n: Number(r.n),
    })),
    states: st.map((r) => ({
      value: String(r.state),
      label: String(r.state),
      n: Number(r.n),
    })),
    fiscalYears: fy.map((r) => String(r.fiscal_year)),
  };
}

// ---------------------------------------------------------------------------
// Live queue (per-case mirror)
// ---------------------------------------------------------------------------

export interface LiveCohortMonth {
  month: string;
  total: number;
  pending: number;
  decided: number;
  decidedPct: number | null;
}

export interface LiveStatusCount {
  status: string;
  count: number;
  isFinal: boolean;
}

/**
 * Every filing month in the live mirror, oldest first.
 *
 * PENDING COMES FROM `is_final`, NOT FROM A STATUS LIST. Verified on the
 * settled table: zero integrity violations across all 16 statuses. The count
 * moved from 15 to 16 while this was being built - `DENIED - BALCA DISMISSED`
 * arrived with one case - which is exactly the failure a hardcoded list would
 * have absorbed silently.
 *
 * UPPER() ON `current_status` IS KEPT DELIBERATELY. The table is canonical
 * uppercase now and the ingest ends each run canonical, so it is currently a
 * no-op. It stays because it costs nothing and the last regression here came
 * from a running process holding pre-fix code, which no amount of committing
 * prevents. The pending split does not read this column at all.
 */
export async function getLiveBacklog(): Promise<LiveCohortMonth[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT substr(filing_date, 1, 7) AS month,
            COUNT(*)                                       AS total,
            SUM(CASE WHEN is_final = 0 THEN 1 ELSE 0 END)  AS pending
       FROM perm_case_status
      WHERE filing_date IS NOT NULL AND filing_date <> ''
      GROUP BY month ORDER BY month`,
  );
  return r.map((x) => {
    const total = Number(x.total) || 0;
    const pending = Number(x.pending) || 0;
    const decided = total - pending;
    return {
      month: String(x.month),
      total,
      pending,
      decided,
      decidedPct: total > 0 ? (decided / total) * 100 : null,
    };
  });
}

/** One filing month's status split, normalised and largest first. */
export async function getLiveCohort(month: string): Promise<LiveStatusCount[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT UPPER(current_status) AS status, MAX(is_final) AS is_final, COUNT(*) AS n
       FROM perm_case_status
      WHERE substr(filing_date, 1, 7) = ?
      GROUP BY status ORDER BY n DESC`,
    [month],
  );
  return r.map((x) => ({
    status: String(x.status),
    count: Number(x.n) || 0,
    isFinal: Number(x.is_final) === 1,
  }));
}

/** How many cases the mirror holds, for the provisional banner. */
export async function getLiveMirrorSize(): Promise<number> {
  const r = await one<Record<string, unknown>>(
    "SELECT COUNT(*) AS n FROM perm_case_status",
  );
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------------------
// I-140 trends (USCIS quarterly counts)
// ---------------------------------------------------------------------------

export interface I140TrendRow {
  fiscalYear: number;
  quarter: number;
  category: string;
  categoryLabel: string;
  received: number;
  approved: number;
  denied: number;
  pending: number;
}

/**
 * Every quarter USCIS has reported, oldest first.
 *
 * `category_label` is USCIS'S OWN LABEL and is carried through verbatim. E21
 * is "Professionals with Advanced Degrees", which covers both national-
 * interest-waiver and employer-sponsored EB-2. Relabelling it "National
 * Interest Waiver" - as at least one public tracker does - is wrong, and it
 * is wrong in the direction that misleads this site's readers specifically,
 * since a PERM applicant is employer-sponsored by definition.
 */
export async function getI140Trends(): Promise<I140TrendRow[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT fiscal_year, quarter, category, category_label,
            received, approved, denied, pending
       FROM i140_trends
      ORDER BY fiscal_year, quarter, category`,
  );
  return r.map((x) => ({
    fiscalYear: Number(x.fiscal_year),
    quarter: Number(x.quarter),
    category: String(x.category),
    categoryLabel: String(x.category_label ?? x.category),
    received: Number(x.received) || 0,
    approved: Number(x.approved) || 0,
    denied: Number(x.denied) || 0,
    pending: Number(x.pending) || 0,
  }));
}
