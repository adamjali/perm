import "server-only";

import { rows } from "./client";
import { keepLinkableSlugs } from "./entityLinks";
// ONE slug-range implementation, shared with the case search. A prefix
// computed differently in two readers is an employer whose cases answer
// differently depending on which page asked.
import { slugRange } from "./flagCases";
import { CHANGE_PROGRAMS, type ChangeProgram } from "@/lib/changeProgram";
// The pure half lives in a plain module so the browser can run the same
// coverage arithmetic this file's queries are bounded by.
import {
  daysInRange,
  isIsoDate,
  narrowIsIndexed,
  type DateRange,
  type CoverageWindows,
  type DecidedNarrow,
} from "@/lib/dateCoverage";

export * from "@/lib/dateCoverage";

/**
 * What DOL DECIDED on a given day, from the quarterly disclosure files.
 *
 * WHY THIS EXISTS BESIDE `changes.ts`. That module answers "which cases did we
 * OBSERVE change status on this day", from our own sweep's event log. It is
 * the only record of anything recent, and it cannot reach back before we
 * started watching: 2026-08-26 for PERM, 2026-09-02 for wage requests and
 * LCAs. Nothing can extend it backwards, because DOL returns a case's CURRENT
 * status and never says when it changed.
 *
 * But the published files carry an indexed `decision_date` on every decided
 * case, going back to 2023-10-01. So "what did DOL do on 12 March 2025" IS
 * answerable, in full detail, with the wage and the worksite and the
 * occupation attached.
 *
 * THE TWO DIMENSIONS ARE NEVER SILENTLY MERGED. "Decided on this day" and
 * "changed status on this day" are different questions with different
 * coverage, and a decision is only one of the things the event log records -
 * it also carries RFIs issued, cases put on hold, and appeals opening.
 * Blending them into one undated feed would misstate both. Each is labelled,
 * and `coverageFor` says which one a given date can answer.
 *
 * ## Cost
 *
 * Every row read costs the database time, and a range over the corpus can
 * read millions. Two rules keep this module bounded:
 *
 * **No `COUNT(*)` over a range.** Counting a year of decisions walks every
 * index entry in it, which is millions of rows for one headline number. An
 * exact count runs only for a SINGLE day, where it is at most a few thousand
 * index entries. A range reports what it fetched and says so.
 *
 * **Every fetch is `LIMIT`-capped and ordered by the indexed column.** The
 * index is on `decision_date`, so SQLite delivers rows already in order and
 * stops at the limit. A ten-year range therefore costs the same as a one-day
 * range - as long as the filter itself is indexed, which is what
 * `RANGE_MAX_DAYS_UNINDEXED` guards.
 */

/** One decided case, as the published file records it. */
export interface DecidedCase {
  caseNumber: string;
  program: ChangeProgram;
  /** The outcome DOL recorded. */
  status: string;
  /** ISO date DOL decided it. */
  decidedOn: string;
  /** ISO date DOL received it, when the file carries one. */
  receivedOn: string | null;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  socCode: string | null;
  socTitle: string | null;
  /** Worksite state. `perm_cases` calls the column `state`. */
  state: string | null;
  /** Offered or prevailing wage, as filed. Annualised is NOT attempted here. */
  wage: number | null;
  /**
   * The period the wage is quoted per: Year, Hour, Week, Bi-Weekly, Month.
   *
   * CARRIED, NOT ASSUMED. An hourly 45 and a yearly 95,000 render identically
   * without it, and DOL files quote both. `perm_cases` has no such column, so
   * PERM rows are null and the page says "as filed" rather than inventing
   * "per year".
   */
  wageUnit: string | null;
  /** The law firm on the filing (all three programs). */
  attorneyName: string | null;
  attorneySlug: string | null;
  /** Worksite city. PERM only. */
  worksiteCity: string | null;
  /** The employer's NAICS code. PERM only. */
  naics: string | null;
  /** Worker's country of citizenship. PERM, DOL's old form only. */
  citizenship: string | null;
  /**
   * PERM: the worker's class of admission when the case was filed (H-1B, L-1).
   * LCA and wage requests: the visa the filing is for. Same column name in DOL's
   * files, different question, and the page says which.
   */
  visaClass: string | null;
  /** Worker's highest education. PERM, DOL's old form only. */
  education: string | null;
}

export interface DecidedFeed {
  range: DateRange;
  cases: DecidedCase[];
  /**
   * Exact per-program totals, or null when the selection is too wide to count
   * without an unbounded read. Null means "more than we listed", never zero.
   */
  totals: Record<ChangeProgram, number> | null;
  /** True when a program's rows were cut at the cap. */
  capped: boolean;
  /** Set when the range was refused for cost, with the reason in words. */
  refused: string | null;
}

/**
 * Rows per program per fetch.
 *
 * Nobody reads past a thousand rows, and the cap is what keeps a wide range
 * from turning into a several-megabyte response. The busiest single day in the
 * published record holds 3,581 LCA decisions, so a day CAN exceed this and the
 * page says when it did.
 */
export const DECIDED_ROW_CAP = 1000;

/**
 * How wide a range may be when a filter cannot ride an index.
 *
 * A wage bound is a comparison, not an equality, and no index leads with it,
 * so SQLite walks the whole date range testing each row. Bounding that walk to
 * a quarter keeps the worst case near a single busy day's cost. Filters that
 * DO have an index - employer, state, occupation, attorney - are unaffected
 * and may span the whole record.
 */
export const RANGE_MAX_DAYS_UNINDEXED = 92;

/**
 * The narrows that live in an optional column, and the column each reads.
 * `citizenship` and `education` exist on PERM rows only; `city` and `naics`
 * on every published file since the Oct 7 2026 backfill; `visa_class` on all. A table that has not gained a column yet (a load
 * still to run) is detected by `columnsOf` and treated as not carrying it.
 */
const OPTIONAL: Record<"city" | "naics" | "citizenship" | "visaClass" | "education", string> = {
  city: "worksite_city",
  naics: "naics",
  citizenship: "citizenship",
  visaClass: "visa_class",
  education: "education",
};

/** Column names differ across the three published tables. One map, not three. */
const PUBLISHED: Record<
  ChangeProgram,
  {
    /** Newest first; PERM's older decisions live in their own table. */
    tables: readonly string[];
    status: string;
    state: string;
    hasWageUnit: boolean;
    /** Which optional narrows this program can be asked at all. */
    optional: readonly (keyof typeof OPTIONAL)[];
  }
> = {
  perm: {
    tables: ["perm_cases", "perm_cases_history"],
    status: "status",
    state: "state",
    hasWageUnit: false,
    optional: ["city", "naics", "citizenship", "visaClass", "education"],
  },
  pwd: {
    tables: ["pwd_cases"],
    status: "case_status",
    state: "worksite_state",
    hasWageUnit: true,
    optional: ["city", "naics", "visaClass"],
  },
  lca: {
    tables: ["lca_cases"],
    status: "case_status",
    state: "worksite_state",
    hasWageUnit: true,
    optional: ["city", "naics", "visaClass"],
  },
  // H-2A, H-2B and CW-1, one table with the visa on each row.
  seasonal: {
    tables: ["seasonal_cases"],
    status: "case_status",
    state: "worksite_state",
    hasWageUnit: true,
    optional: ["city", "naics", "visaClass"],
  },
};

/**
 * The last decision date `perm_cases_history` can hold (FY2023's end). The
 * current table starts the next day, so a range entirely after this never
 * asks the history table at all.
 */
export const PERM_HISTORY_LAST = "2023-09-30";

/**
 * A table's columns, from its schema. `PRAGMA table_info` reads the schema,
 * not the rows, so it costs no row reads; memoised per process for
 * ten minutes so a busy page asks once.
 *
 * WHY PROBE AT ALL. The optional columns arrive with loads that run on their
 * own schedule. Selecting a column a table doesn't have yet is an error, and
 * the feed catches errors as "no rows", so a deploy that landed before its
 * load would have emptied the PERM half without a word.
 */
const columnCache = new Map<string, { at: number; cols: Promise<Set<string>> }>();

export function columnsOf(table: string): Promise<Set<string>> {
  const hit = columnCache.get(table);
  if (hit && Date.now() - hit.at < 600_000) return hit.cols;
  const cols = rows<{ name: string }>(`PRAGMA table_info(${table})`)
    .then((r) => new Set(r.map((c) => String(c.name))))
    .catch(() => new Set<string>());
  columnCache.set(table, { at: Date.now(), cols });
  return cols;
}

/** Test seam: forget the memoised schemas. */
export function resetColumnCache(): void {
  columnCache.clear();
}

/** The tables a program's range touches, newest first. */
function tablesFor(program: ChangeProgram, range: DateRange): string[] {
  const meta = PUBLISHED[program];
  return meta.tables.filter((t) => t !== "perm_cases_history" || range.from <= PERM_HISTORY_LAST);
}

/**
 * The two windows, measured rather than assumed.
 *
 * ONE AGGREGATE PER STATEMENT, and that is the whole trick. SQLite rewrites a
 * LONE `MIN(x)` or `MAX(x)` over an indexed column into a seek at one end of
 * the index; put BOTH in the same statement and it can no longer do that and
 * scans the whole covering index instead. Measured against production:
 *
 *     SELECT MIN(decision_date), MAX(decision_date) FROM perm_cases
 *       -> SCAN, 373,939 rows read
 *     SELECT MIN(decision_date) FROM perm_cases
 *       -> SEARCH, 1 row read
 *
 * This function asks six tables, so the combined form was reading about 1.45
 * million rows every time `/perm-decision-activity` regenerated - the exact
 * shape that took this database to 11.6 billion rows read in August. Twelve
 * one-row statements cost twelve rows.
 *
 * An earlier version of this comment asserted the combined form was "a seek at
 * each end, not a scan". It is not, and only an EXPLAIN said so.
 *
 * It is deliberately measured on every regeneration rather than hardcoded: the
 * decided window moves when a quarterly file lands, and a fixed date would
 * silently under-report coverage for months.
 */
export async function getCoverageWindows(): Promise<CoverageWindows> {
  const [decided, observed, historyFrom] = await Promise.all([
    Promise.all(
      CHANGE_PROGRAMS.map(async (p) => {
        const table = PUBLISHED[p].tables[0]!;
        const [lo, hi] = await Promise.all([
          rows<{ v: string | null }>(
            `SELECT MIN(decision_date) AS v FROM ${table}`,
          ).catch(() => []),
          rows<{ v: string | null }>(
            `SELECT MAX(decision_date) AS v FROM ${table}`,
          ).catch(() => []),
        ]);
        return [{ lo: lo[0]?.v ?? null, hi: hi[0]?.v ?? null }];
      }),
    ),
    Promise.all(
      CHANGE_PROGRAMS.map(async (p) => {
        const [lo, hi] = await Promise.all([
          rows<{ v: number | null }>(
            `SELECT MIN(changed_at) AS v FROM ${p}_case_events`,
          ).catch(() => []),
          rows<{ v: number | null }>(
            `SELECT MAX(changed_at) AS v FROM ${p}_case_events`,
          ).catch(() => []),
        ]);
        return [{ lo: lo[0]?.v ?? null, hi: hi[0]?.v ?? null }];
      }),
    ),
    historyStart(),
  ]);

  // PERM's own window reaches into the history table. Its start comes from the
  // ingest's record (one point read), not from MIN over ~870,000 rows.
  const byProgram: Partial<Record<ChangeProgram, DateRange>> = {};
  CHANGE_PROGRAMS.forEach((p, i) => {
    const lo = decided[i]?.[0]?.lo ?? null;
    const hi = decided[i]?.[0]?.hi ?? null;
    const from = p === "perm" && historyFrom && (!lo || historyFrom < lo) ? historyFrom : lo;
    if (from && hi) byProgram[p] = { from, to: hi };
  });

  let dLo: string | null = null;
  let dHi: string | null = null;
  for (const w of Object.values(byProgram)) {
    if (!w) continue;
    if (!dLo || w.from < dLo) dLo = w.from;
    if (!dHi || w.to > dHi) dHi = w.to;
  }

  let oLo: number | null = null;
  let oHi: number | null = null;
  for (const r of observed) {
    const lo = r[0]?.lo == null ? null : Number(r[0].lo);
    const hi = r[0]?.hi == null ? null : Number(r[0].hi);
    if (lo !== null && (oLo === null || lo < oLo)) oLo = lo;
    if (hi !== null && (oHi === null || hi > oHi)) oHi = hi;
  }

  return {
    decided: dLo && dHi ? { from: dLo, to: dHi } : null,
    decidedByProgram: byProgram,
    observed:
      oLo !== null && oHi !== null
        ? {
            from: new Date(oLo).toISOString().slice(0, 10),
            to: new Date(oHi).toISOString().slice(0, 10),
          }
        : null,
  };
}

/**
 * The first day `perm_cases_history` holds rows for, from the history ingest's
 * record in `perm_docs['perm_history']`: the earliest fiscal year it stored
 * case rows for starts the October before. Null when nothing is loaded.
 */
async function historyStart(): Promise<string | null> {
  const r = await rows<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'perm_history'",
  ).catch(() => []);
  try {
    const doc = JSON.parse(r[0]?.json ?? "{}") as {
      files?: Record<string, { fy?: number; caseRows?: number }>;
    };
    const years = Object.values(doc.files ?? {})
      .filter((f) => (f.caseRows ?? 0) > 0 && Number.isFinite(f.fy))
      .map((f) => Number(f.fy));
    if (years.length === 0) return null;
    return `${Math.min(...years) - 1}-10-01`;
  } catch {
    return null;
  }
}

/**
 * Build the WHERE tail and its arguments for one program and table.
 *
 * Three answers: a clause; `"refuse"` when a needle can't be served at all (an
 * employer too short for a prefix range), which the caller turns into a 400;
 * and `"skip"` when THIS table can't answer a filter that was asked (a wage
 * request has no citizenship). Skipping returns nothing for that table. The
 * old behaviour ignored the filter instead, and a law-firm filter on the wage
 * requests returned every wage request of the day under the firm's name.
 */
function narrowClause(
  program: ChangeProgram,
  n: DecidedNarrow,
  cols: Set<string>,
): { sql: string; args: unknown[] } | "refuse" | "skip" {
  const meta = PUBLISHED[program];
  const parts: string[] = [];
  const args: unknown[] = [];
  if (n.employer) {
    // A PREFIX RANGE, NOT `LIKE`. LIKE is case-insensitive by default and so
    // cannot use an index on a BINARY-collated column; a range can. `null`
    // means the needle was too short or too long to be served, and the caller
    // turns that into a refusal rather than dropping the filter silently.
    const r = slugRange(n.employer);
    if (!r) return "refuse";
    parts.push("employer_slug >= ? AND employer_slug < ?");
    args.push(r.lo, r.hi);
  }
  if (n.state) {
    parts.push(`${meta.state} = ?`);
    args.push(n.state);
  }
  if (n.socCode) {
    parts.push("soc_code = ?");
    args.push(n.socCode);
  }
  if (n.attorney) {
    if (!cols.has("attorney_slug")) return "skip";
    parts.push("attorney_slug = ?");
    args.push(n.attorney);
  }
  if (n.status) {
    parts.push(`${meta.status} = ?`);
    args.push(n.status);
  }
  if (n.minWage !== undefined) {
    parts.push("wage IS NOT NULL AND wage >= ?");
    args.push(n.minWage);
  }
  if (n.maxWage !== undefined) {
    parts.push("wage IS NOT NULL AND wage <= ?");
    args.push(n.maxWage);
  }
  for (const key of Object.keys(OPTIONAL) as (keyof typeof OPTIONAL)[]) {
    const v = n[key];
    if (v === undefined) continue;
    const col = OPTIONAL[key];
    if (!meta.optional.includes(key) || !cols.has(col)) return "skip";
    if (key === "naics") {
      // Leading digits: "5415" is the whole computer-systems group.
      parts.push("naics LIKE ?");
      args.push(`${v}%`);
    } else {
      parts.push(`${col} = ? COLLATE NOCASE`);
      args.push(v);
    }
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", args };
}

function selectFor(program: ChangeProgram, table: string, cols: Set<string>): string {
  const meta = PUBLISHED[program];
  const has = (c: string) => (cols.has(c) ? c : `NULL AS ${c}`);
  const unit = meta.hasWageUnit ? "wage_unit" : "NULL AS wage_unit";
  const optional = ["attorney_name", "attorney_slug", ...Object.values(OPTIONAL)]
    .map(has)
    .join(", ");
  return `SELECT case_number, ${meta.status} AS status, decision_date,
                 received_date, employer_name, employer_slug, job_title,
                 soc_code, soc_title, ${meta.state} AS state, wage, ${unit}, ${optional}
            FROM ${table}
           WHERE decision_date >= ? AND decision_date <= ?`;
}

function toCase(program: ChangeProgram, r: Record<string, unknown>): DecidedCase {
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s === "" ? null : s;
  };
  return {
    caseNumber: String(r.case_number ?? ""),
    program,
    status: String(r.status ?? ""),
    decidedOn: String(r.decision_date ?? ""),
    receivedOn: str(r.received_date),
    employerName: str(r.employer_name),
    employerSlug: str(r.employer_slug),
    jobTitle: str(r.job_title),
    socCode: str(r.soc_code),
    socTitle: str(r.soc_title),
    state: str(r.state),
    wage: num(r.wage),
    wageUnit: str(r.wage_unit),
    attorneyName: str(r.attorney_name),
    attorneySlug: str(r.attorney_slug),
    worksiteCity: str(r.worksite_city),
    naics: str(r.naics),
    citizenship: str(r.citizenship),
    visaClass: str(r.visa_class),
    education: str(r.education),
  };
}

/**
 * The decided cases in a date range, across the requested programs.
 *
 * Ordered newest decision first, then by case number so the order is total and
 * a capped page is reproducible rather than arbitrary.
 */
export async function getDecidedFeed(args: {
  range: DateRange;
  programs?: readonly ChangeProgram[];
  narrow?: DecidedNarrow;
  cap?: number;
}): Promise<DecidedFeed> {
  const { range } = args;
  const narrow = args.narrow ?? {};
  const programs = args.programs ?? CHANGE_PROGRAMS;
  const cap = args.cap ?? DECIDED_ROW_CAP;

  if (!isIsoDate(range.from) || !isIsoDate(range.to) || range.to < range.from) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused: "That is not a valid date range.",
    };
  }

  const span = daysInRange(range);
  if (!narrowIsIndexed(narrow) && span > RANGE_MAX_DAYS_UNINDEXED) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused:
        `A wage filter has to be checked on every case in the range, so it is ` +
        `limited to ${RANGE_MAX_DAYS_UNINDEXED} days. This range is ${span}. ` +
        `Narrow the dates, or drop the wage filter.`,
    };
  }

  // An unservable needle is a REFUSAL, not a dropped filter. Silently ignoring
  // it returns every case in the range under a heading naming one employer,
  // which is worse than an error because it looks like an answer.
  if (narrow.employer && !slugRange(narrow.employer)) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused: "That employer name is too short to search. Try two or more characters.",
    };
  }

  const fetched = await Promise.all(
    programs.map(async (p) => {
      const perTable = await Promise.all(
        tablesFor(p, range).map(async (table) => {
          const cols = await columnsOf(table);
          const clause = narrowClause(p, narrow, cols);
          if (clause === "refuse" || clause === "skip") return [] as Record<string, unknown>[];
          const { sql, args: nArgs } = clause;
          // cap + 1 so a full page is distinguishable from an exactly-full one.
          return rows<Record<string, unknown>>(
            `${selectFor(p, table, cols)}${sql}
              ORDER BY decision_date DESC, case_number DESC
              LIMIT ?`,
            [range.from, range.to, ...nArgs, cap + 1],
          ).catch(() => []);
        }),
      );
      // Two tables for PERM are merged newest first before the cap applies,
      // so the cap cuts the oldest rows of the whole range, not of each table.
      const r = perTable
        .flat()
        .sort((a, b) =>
          String(b.decision_date) === String(a.decision_date)
            ? String(b.case_number).localeCompare(String(a.case_number))
            : String(b.decision_date).localeCompare(String(a.decision_date)),
        );
      return { program: p, r };
    }),
  );

  let capped = false;
  const cases: DecidedCase[] = [];
  for (const { program, r } of fetched) {
    if (r.length > cap) capped = true;
    for (const row of r.slice(0, cap)) cases.push(toCase(program, row));
  }
  cases.sort((a, b) =>
    a.decidedOn === b.decidedOn
      ? b.caseNumber.localeCompare(a.caseNumber)
      : b.decidedOn.localeCompare(a.decidedOn),
  );

  // A wage request or LCA employer that never filed a PERM, and a law firm
  // from an older file, has no page: print those names as text, not 404 links.
  const linked = await keepLinkableSlugs(
    cases,
    (c) => c.attorneySlug,
    (c) => ({ ...c, attorneySlug: null }),
  );

  return {
    range,
    cases: linked,
    totals: span === 1 ? await countDay(range.from, programs, narrow) : null,
    capped,
    refused: null,
  };
}

/**
 * Exact per-program totals for ONE day.
 *
 * A single day is at most a few thousand index entries, so this is affordable
 * and the headline figure ("793 PERM decisions on 25 June") is worth being
 * exact. It is deliberately NOT offered for a range: counting a year walks
 * millions of index entries for one number, which is the read pattern that got
 * this database's reads blocked in August.
 */
async function countDay(
  date: string,
  programs: readonly ChangeProgram[],
  narrow: DecidedNarrow,
): Promise<Record<ChangeProgram, number>> {
  const out: Record<ChangeProgram, number> = { perm: 0, pwd: 0, lca: 0, seasonal: 0 };
  await Promise.all(
    programs.map(async (p) => {
      for (const table of tablesFor(p, { from: date, to: date })) {
        const cols = await columnsOf(table);
        const clause = narrowClause(p, narrow, cols);
        if (clause === "refuse" || clause === "skip") continue;
        const { sql, args } = clause;
        const r = await rows<{ n: number }>(
          `SELECT COUNT(*) AS n FROM ${table}
            WHERE decision_date >= ? AND decision_date <= ?${sql}`,
          [date, date, ...args],
        ).catch(() => []);
        out[p] += Number(r[0]?.n ?? 0);
      }
    }),
  );
  return out;
}
