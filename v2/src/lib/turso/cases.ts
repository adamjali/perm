/**
 * The case-level browser's read path, backed by Turso.
 *
 * Replaces `convex/permCases.ts`'s four public queries. Nothing here can
 * identify a person: DOL's disclosure files carry attorney and
 * point-of-contact emails, phones and street addresses, and the ingest reads
 * none of those columns, so every field below is an organisation, a date, a
 * job, or a wage.
 *
 * ## What changed with the move, and what deliberately did not
 *
 * The Convex version's whole shape was dictated by a 4,096-document read
 * ceiling PER FUNCTION EXECUTION, which made an unindexed predicate not slow
 * but fatal. SQLite has no such ceiling, but the discipline is kept anyway:
 * the filter is still a discriminated union that can only express
 * combinations a real index serves, because an unindexed predicate over
 * 373,939 rows is still a full scan someone unauthenticated can ask for.
 *
 * `planCaseSql` below is the same decision `planCaseQuery` made in
 * `convex/permCases.ts`, translated from a Convex index name to a WHERE
 * clause plus the SQLite index expected to serve it. The mapping is
 * one-for-one:
 *
 * | slice      | no status              | with a status                  | SQLite index          |
 * |------------|------------------------|--------------------------------|-----------------------|
 * | all        | `by_decision`          | `by_status_decision`           | `idx_pc_decision` / `idx_pc_status_dec` |
 * | state      | `by_state_decision`    | `by_state_status_decision`     | `idx_pc_state_dec` / `idx_pc_state_st_dec` |
 * | occupation | `by_soc_decision`      | `by_soc_status_decision`       | `idx_pc_soc_dec` / `idx_pc_soc_st_dec` |
 * | employer   | `by_employer_decision` | `by_employer_status_decision`  | `idx_pc_emp_dec` / `idx_pc_emp_st_dec` |
 * | law firm   | `by_attorney_decision` | `by_attorney_status_decision`  | `idx_pc_att_dec` / `idx_pc_att_st_dec` |
 *
 * Every one of those indexes ends in `decision_date`, so the decision-date
 * range and the ordering come free on all ten.
 *
 * ERRORS ARE NOT SWALLOWED. See publicData.ts: a `.catch(() => [])` turned a
 * disabled backend into an HTTP 200 carrying an empty state, which is
 * indistinguishable from a genuinely empty table and passed every status
 * check. These throw.
 */
import "server-only";

import { slugify } from "@/lib/entitySlug";

import { getCasesMeta } from "./publicData";
import { one, rows } from "./client";

export type CaseStatus = "certified" | "denied" | "withdrawn";

const STATUSES: readonly CaseStatus[] = ["certified", "denied", "withdrawn"];

export function isCaseStatus(v: string): v is CaseStatus {
  return (STATUSES as readonly string[]).includes(v);
}

/** The row as the site reads it. Mirrors Convex's `caseRowValidator` exactly. */
export interface PermCaseRow {
  caseNumber: string;
  status: CaseStatus;
  receivedDate: string;
  decisionDate: string;
  days: number;
  employerName: string;
  employerSlug: string;
  state: string;
  jobTitle: string;
  socCode: string;
  socTitle: string;
  attorneyName: string;
  attorneySlug: string;
  wage: number | null;
}

/**
 * The row as SQLite hands it back.
 *
 * Every text column is nullable in the DDL and several genuinely are:
 * measured on the live table, `attorney_name` is NULL on 38,644 of 373,939
 * rows and `wage` on 777. Convex's validator declared those fields as plain
 * strings, so the mapper below collapses an absent name to "" and keeps only
 * `wage` nullable - which is what every caller already renders.
 */
interface CaseDbRow {
  case_number: string;
  status: string;
  received_date: string | null;
  decision_date: string | null;
  days: number | null;
  employer_name: string | null;
  employer_slug: string | null;
  state: string | null;
  job_title: string | null;
  soc_code: string | null;
  soc_title: string | null;
  attorney_name: string | null;
  attorney_slug: string | null;
  wage: number | null;
}

const CASE_COLS =
  "case_number, status, received_date, decision_date, days, employer_name, " +
  "employer_slug, state, job_title, soc_code, soc_title, attorney_name, " +
  "attorney_slug, wage";

function toCaseRow(r: CaseDbRow): PermCaseRow {
  // A status outside the three is corrupt data, not a rendering problem. The
  // Convex validator would have refused the row at read time; throwing keeps
  // that guarantee rather than quietly widening the union at the call site.
  if (!isCaseStatus(r.status)) {
    throw new Error(`perm_cases.${r.case_number} has status "${r.status}"`);
  }
  return {
    caseNumber: r.case_number,
    status: r.status,
    receivedDate: r.received_date ?? "",
    decisionDate: r.decision_date ?? "",
    days: r.days ?? 0,
    employerName: r.employer_name ?? "",
    employerSlug: r.employer_slug ?? "",
    state: r.state ?? "",
    jobTitle: r.job_title ?? "",
    socCode: r.soc_code ?? "",
    socTitle: r.soc_title ?? "",
    attorneyName: r.attorney_name ?? "",
    attorneySlug: r.attorney_slug ?? "",
    wage: r.wage ?? null,
  };
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export interface StatusFacet {
  status: CaseStatus;
  count: number;
}
export interface FiscalYearFacet {
  fiscalYear: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}
export interface StateFacet {
  state: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

/**
 * What the browser covers, and the exact counts behind its filters.
 *
 * TYPED OUT RATHER THAN INFERRED. `getCasesMeta` parses JSON, and a generic
 * defaulting to `Record<string, unknown>` collapses every field to `{}` -
 * which typechecks at the call site and then renders blank.
 *
 * The counts are read here rather than computed, and that is the point: the
 * ingest counted them over exactly the rows it emitted, so a facet total and
 * the rows the browser pages through cannot disagree. Counting a filtered set
 * would mean reading it.
 */
export interface CasesMeta {
  sourceFiles: string[];
  totalCases: number;
  firstDecisionDate: string;
  lastDecisionDate: string;
  firstReceivedDate: string;
  lastReceivedDate: string;
  byStatus: StatusFacet[];
  byFiscalYear: FiscalYearFacet[];
  byState: StateFacet[];
  /** Epoch millis, added by the doc reader from the row's own column. */
  computedAt: number;
}

export function getMeta(): Promise<CasesMeta | null> {
  return getCasesMeta<CasesMeta>();
}

// ---------------------------------------------------------------------------
// The query planner
// ---------------------------------------------------------------------------

/** Which dimension the caller is slicing by. Exactly one, never two. */
export type CaseSlice =
  | { kind: "all" }
  | { kind: "state"; state: string }
  | { kind: "occupation"; socCode: string }
  | { kind: "employer"; employerSlug: string }
  | { kind: "attorney"; attorneySlug: string };

export interface CaseFilter {
  slice: CaseSlice;
  status?: CaseStatus;
  /** Inclusive lower bound on `decision_date`, `YYYY-MM-DD`. */
  from?: string;
  /** Inclusive upper bound on `decision_date`, `YYYY-MM-DD`. */
  to?: string;
}

/**
 * The ten indexes a browse query is allowed to lean on.
 *
 * SQLite serves any PREFIX of a composite index, so `(state, status,
 * decision_date)` also answers "by state" - which is why the table carries
 * ten and not more. Naming the expected index here is documentation the
 * planner can be checked against with EXPLAIN QUERY PLAN; SQLite chooses for
 * itself and is not told.
 */
export const BROWSE_INDEXES = [
  "idx_pc_decision",
  "idx_pc_status_dec",
  "idx_pc_state_dec",
  "idx_pc_state_st_dec",
  "idx_pc_soc_dec",
  "idx_pc_soc_st_dec",
  "idx_pc_emp_dec",
  "idx_pc_emp_st_dec",
  "idx_pc_att_dec",
  "idx_pc_att_st_dec",
] as const;

export type BrowseIndex = (typeof BROWSE_INDEXES)[number];

export interface CaseSqlPlan {
  /** The index expected to serve this shape. */
  index: BrowseIndex;
  /** Everything after WHERE, already parameterised. Never empty. */
  where: string;
  args: (string | number)[];
}

/**
 * Turn a filter into a WHERE clause. Total by construction: every `CaseSlice`
 * crossed with status-present and status-absent has a branch, and the switch
 * is exhaustive over the union.
 */
export function planCaseSql(filter: CaseFilter): CaseSqlPlan {
  const { status, from, to } = filter;
  const conds: string[] = [];
  const args: (string | number)[] = [];

  let index: BrowseIndex;
  switch (filter.slice.kind) {
    case "all":
      index = status === undefined ? "idx_pc_decision" : "idx_pc_status_dec";
      break;
    case "state":
      index = status === undefined ? "idx_pc_state_dec" : "idx_pc_state_st_dec";
      conds.push("state = ?");
      args.push(filter.slice.state);
      break;
    case "occupation":
      index = status === undefined ? "idx_pc_soc_dec" : "idx_pc_soc_st_dec";
      conds.push("soc_code = ?");
      args.push(filter.slice.socCode);
      break;
    case "employer":
      index = status === undefined ? "idx_pc_emp_dec" : "idx_pc_emp_st_dec";
      conds.push("employer_slug = ?");
      args.push(filter.slice.employerSlug);
      break;
    case "attorney":
      index = status === undefined ? "idx_pc_att_dec" : "idx_pc_att_st_dec";
      conds.push("attorney_slug = ?");
      args.push(filter.slice.attorneySlug);
      break;
  }

  if (status !== undefined) {
    conds.push("status = ?");
    args.push(status);
  }
  if (from !== undefined) {
    conds.push("decision_date >= ?");
    args.push(from);
  }
  if (to !== undefined) {
    conds.push("decision_date <= ?");
    args.push(to);
  }

  // "1" rather than an empty string so every caller can write `WHERE ${where}`
  // without a conditional, and so a bug that drops a condition is visible as
  // a literal rather than as valid SQL that scans the table.
  return { index, where: conds.length > 0 ? conds.join(" AND ") : "1", args };
}

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

/**
 * The largest page the server will hand out.
 *
 * Doubles as the whole-slice threshold: a caller that asks for this many and
 * gets `isDone: true` holds the complete slice and may sort and page it
 * locally, which is the only condition under which the browser's sortable
 * column headers are a true statement about the slice.
 */
export const MAX_PAGE_ITEMS = 500;
export const DEFAULT_PAGE_ITEMS = 50;

/**
 * How deep an offset the server will honour.
 *
 * Offset paging costs one index step per row skipped, so this is a real
 * bound and not a formality: measured on the live table, offset 100,000 is
 * 324 ms against 78 ms at offset 5,000. 400,000 sits just past the 373,939
 * rows in the window, so it stops a hostile caller asking for offset 10^9
 * without cutting the browser off from the end of its own table.
 */
const MAX_OFFSET = 400_000;

/** Clamp a caller-supplied page size into the range the indexes can serve. */
export function clampPageItems(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return DEFAULT_PAGE_ITEMS;
  return Math.min(MAX_PAGE_ITEMS, Math.max(1, Math.floor(requested)));
}

/**
 * A cursor is a row offset.
 *
 * Convex handed out opaque cursors; this hands out a decimal offset, which is
 * still opaque to the browser (it only ever pushes what it was given onto a
 * stack). Anything unparseable is treated as the start rather than as an
 * error: a stale cursor from a previous ingest should reset the view, not
 * break the page.
 *
 * Stability: `ORDER BY decision_date` alone has many ties, but SQLite's
 * b-tree index keys are (decision_date, rowid), so a scan of one index is a
 * deterministic total order and LIMIT/OFFSET over it cannot repeat or skip a
 * row within one state of the database.
 */
function parseCursor(cursor: string | null | undefined): number {
  if (typeof cursor !== "string" || !/^\d{1,9}$/.test(cursor)) return 0;
  return Math.min(MAX_OFFSET, Number(cursor));
}

export interface ListCasesArgs {
  filter: CaseFilter;
  order?: "newest" | "oldest";
  cursor?: string | null;
  numItems?: number;
}

/** Mirrors Convex's pagination result, in the three fields the browser reads. */
export interface CasePage {
  page: PermCaseRow[];
  isDone: boolean;
  continueCursor: string;
}

/**
 * A page of cases, ordered by decision date.
 *
 * `newest` is the default because the newest determinations are what someone
 * waiting actually wants to see.
 *
 * `isDone` comes from asking for one row more than the caller wanted, so it
 * costs one row rather than a COUNT over the whole slice.
 */
export async function listCases(args: ListCasesArgs): Promise<CasePage> {
  const plan = planCaseSql(args.filter);
  const take = clampPageItems(args.numItems);
  const offset = parseCursor(args.cursor);
  const direction = args.order === "oldest" ? "ASC" : "DESC";

  const found = await rows<CaseDbRow>(
    `SELECT ${CASE_COLS} FROM perm_cases WHERE ${plan.where} ` +
      `ORDER BY decision_date ${direction} LIMIT ? OFFSET ?`,
    [...plan.args, take + 1, offset],
  );

  const page = found.slice(0, take).map(toCaseRow);
  return {
    page,
    isDone: found.length <= take,
    continueCursor: String(offset + page.length),
  };
}

// ---------------------------------------------------------------------------
// The two lookups that are not the browse table
// ---------------------------------------------------------------------------

/** DOL's longest printed case number is 18 characters (`G-100-25273-349207`). */
const MAX_CASE_NUMBER_INPUT = 32;

/**
 * Tidy a pasted case number.
 *
 * The length cap runs FIRST, before anything that walks the string, because
 * this is reachable unauthenticated. Returns "" for anything that cannot be a
 * case number, and the caller treats that as a miss rather than querying.
 */
export function normalizeCaseNumber(raw: string): string {
  if (raw.length > MAX_CASE_NUMBER_INPUT) return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * One case by its number.
 *
 * A miss is `null`, and `null` means "not in this window" - emphatically not
 * "no such case". DOL's disclosure files carry decided cases only, so every
 * pending case in the country misses here. The page has to say that, or the
 * most common lookup on the site reads as bad news about someone's petition.
 */
export async function lookupByCaseNumber(caseNumber: string): Promise<PermCaseRow | null> {
  const needle = normalizeCaseNumber(caseNumber);
  if (needle === "") return null;
  const row = await one<CaseDbRow>(
    `SELECT ${CASE_COLS} FROM perm_cases WHERE case_number = ?`,
    [needle],
  );
  return row ? toCaseRow(row) : null;
}

/** The most matches a name search will return. */
export const MAX_SEARCH_RESULTS = 100;

export interface SearchCasesArgs {
  field: "employer" | "attorney";
  text: string;
  status?: CaseStatus;
  state?: string;
  limit?: number;
}

/**
 * Find cases by employer or law-firm name.
 *
 * THIS IS A PREFIX SEARCH, NOT FULL TEXT, AND THERE IS NO RELEVANCE ORDER.
 * `perm_cases` has no FTS table - the migration drops `perm_cases_fts` and
 * never builds it - so the Convex search index is gone and nothing here
 * ranks. Results come back newest first, and typing a word from the middle of
 * a name finds nothing: "fragomen" reaches FRAGOMEN, DEL REY, BERNSEN &
 * LOEWY, LLP and "del rey" does not. The page must say so.
 *
 * The match runs on the indexed SLUG column as a half-open range rather than
 * on the name with LIKE, and that is a measured decision rather than a
 * stylistic one. SQLite's LIKE is case-insensitive by default while the
 * columns collate BINARY, so `name LIKE 'micro%'` cannot use an index at all:
 * on the live table a needle that matches nothing took 506 ms because it
 * scanned all 373,939 rows, and `%contains%` took 801 ms. The same search as
 * a slug range is index-served and returned in 39 ms. On an endpoint a
 * stranger can call, that difference is the whole argument.
 *
 * `slugify` is the same function the ingest slugged these columns with, so
 * the prefix a visitor types and the prefix stored here are computed one way.
 */
export async function searchCases(args: SearchCasesArgs): Promise<PermCaseRow[]> {
  // Guards in cost order. The length cap is first because everything after it
  // walks the string, and `text` arrives from a stranger.
  if (args.text.length > 120) return [];
  const needle = slugify(args.text.trim());
  if (needle.length < 2) return [];

  const take = Math.min(Math.max(1, Math.floor(args.limit ?? 50)), MAX_SEARCH_RESULTS);
  const column = args.field === "employer" ? "employer_slug" : "attorney_slug";

  // The successor of a prefix, for a half-open range. Incrementing the last
  // character is correct whatever that character is: the comparison decides
  // at that position, so `needle + anything` sorts below it.
  const upper =
    needle.slice(0, -1) + String.fromCharCode(needle.charCodeAt(needle.length - 1) + 1);

  const conds = [`${column} >= ?`, `${column} < ?`];
  const sqlArgs: (string | number)[] = [needle, upper];
  if (args.status !== undefined) {
    conds.push("status = ?");
    sqlArgs.push(args.status);
  }
  if (args.state !== undefined && args.state !== "") {
    conds.push("state = ?");
    sqlArgs.push(args.state);
  }

  const found = await rows<CaseDbRow>(
    `SELECT ${CASE_COLS} FROM perm_cases WHERE ${conds.join(" AND ")} ` +
      "ORDER BY decision_date DESC LIMIT ?",
    [...sqlArgs, take],
  );
  return found.map(toCaseRow);
}
