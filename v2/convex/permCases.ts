import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
  type IndexRange,
} from "convex/server";

import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * The case-level browser's read and write paths.
 *
 * `permDisclosureStats` and `permEntities` hold sums. This holds the rows they
 * were summed from - one document per decided PERM case in DOL's published
 * window, roughly 259,000 of them.
 *
 * Nothing here can identify a person. The disclosure file carries attorney and
 * point-of-contact emails, phone numbers and street addresses; the ingest reads
 * none of those columns and cannot write them. Every field is an organisation,
 * a date, a job, or a wage.
 *
 * ## Why the query surface looks like this
 *
 * Convex counts reads PER FUNCTION EXECUTION and caps them at 4,096. Over a
 * 259,000-row table that makes an unindexed predicate not slow but fatal, and
 * fatal only once the table is full - a filter that scans works perfectly on a
 * test fixture of 200 rows. So the filter argument is a discriminated union
 * that can only express combinations a real index serves, and `planCaseQuery`
 * is a pure function mapping each one to its index. The type system refuses
 * the unservable query; the test asserts the mapping is total.
 *
 * | slice      | no status filter       | with a status filter          |
 * |------------|------------------------|-------------------------------|
 * | all        | `by_decision`          | `by_status_decision`          |
 * | state      | `by_state_decision`    | `by_state_status_decision`    |
 * | occupation | `by_soc_decision`      | `by_soc_status_decision`      |
 * | employer   | `by_employer_decision` | `by_employer_status_decision` |
 * | law firm   | `by_attorney_decision` | `by_attorney_status_decision` |
 *
 * Every one of those ends in `decisionDate`, so the decision-date range comes
 * free on all ten (Convex allows a range comparison only on the final indexed
 * field, and this is what that field is spent on). A fiscal-year filter is a
 * date range, not an equality, which is why there is no `by_fiscalYear` index.
 *
 * ## What is deliberately NOT offered
 *
 * Two slices at once (state AND occupation) needs its own index, and so does
 * every other pair; the honest ceiling is one slice at a time. Sorting by wage
 * or by days across the whole table needs an index per (slice x sort key)
 * pair. Instead the caller asks for up to `MAX_PAGE_ITEMS` rows: when the
 * answer comes back `isDone`, it holds the complete slice and may sort and
 * page it any way it likes, which covers almost every employer and law firm.
 * When it does not, the slice is paged by decision date and the UI says so.
 */

const statusValidator = v.union(
  v.literal("certified"),
  v.literal("denied"),
  v.literal("withdrawn"),
);

export type CaseStatus = "certified" | "denied" | "withdrawn";

/** The row as written by the ingest. Mirrors the `permCases` table exactly. */
const caseInputValidator = v.object({
  caseNumber: v.string(),
  status: statusValidator,
  receivedDate: v.string(),
  decisionDate: v.string(),
  days: v.number(),
  fiscalYear: v.string(),
  employerName: v.string(),
  employerSlug: v.string(),
  state: v.string(),
  jobTitle: v.string(),
  socCode: v.string(),
  socTitle: v.string(),
  attorneyName: v.string(),
  attorneySlug: v.string(),
  wage: v.union(v.number(), v.null()),
});

/** The row as read by the site. */
const caseRowValidator = v.object({
  caseNumber: v.string(),
  status: statusValidator,
  receivedDate: v.string(),
  decisionDate: v.string(),
  days: v.number(),
  employerName: v.string(),
  employerSlug: v.string(),
  state: v.string(),
  jobTitle: v.string(),
  socCode: v.string(),
  socTitle: v.string(),
  attorneyName: v.string(),
  attorneySlug: v.string(),
  wage: v.union(v.number(), v.null()),
});

export type PermCaseRow = {
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
};

function toPublicRow(doc: Doc<"permCases">): PermCaseRow {
  return {
    caseNumber: doc.caseNumber,
    status: doc.status,
    receivedDate: doc.receivedDate,
    decisionDate: doc.decisionDate,
    days: doc.days,
    employerName: doc.employerName,
    employerSlug: doc.employerSlug,
    state: doc.state,
    jobTitle: doc.jobTitle,
    socCode: doc.socCode,
    socTitle: doc.socTitle,
    attorneyName: doc.attorneyName,
    attorneySlug: doc.attorneySlug,
    wage: doc.wage,
  };
}

/**
 * The field names the ingest must write, derived from the validator itself.
 *
 * Derived rather than typed out, so it cannot drift from the validator. The
 * test pins it against a written-out list, and `scripts/store_cases.py` keeps
 * the same list on its side: a field added here without being added there is
 * a row Convex refuses at import time, which is loud, but the test is louder
 * and arrives first.
 */
export const INGEST_ROW_FIELDS: string[] = Object.keys(caseInputValidator.fields).sort();

/**
 * The exactness check the schema cannot do for us.
 *
 * `v.object({...})` binds to nothing: an EXTRA field in the validator
 * typechecks green and blows up at insert time, and a MISSING one silently
 * drops data the ingest computed. Both directions are asserted here, so
 * either mistake is a compile error rather than a quarterly surprise.
 */
type IngestRow = Omit<Doc<"permCases">, "_id" | "_creationTime" | "computedAt">;
type IngestRowIsExact = IngestRow extends typeof caseInputValidator.type
  ? typeof caseInputValidator.type extends IngestRow
    ? true
    : never
  : never;
const _ingestRowIsExact: IngestRowIsExact = true;
void _ingestRowIsExact;

// ---------------------------------------------------------------------------
// The query planner. Pure, exported, and the reason this file is safe.
// ---------------------------------------------------------------------------

/** Which dimension the caller is slicing by. Exactly one, never two. */
export type CaseSlice =
  | { kind: "all" }
  | { kind: "state"; state: string }
  | { kind: "occupation"; socCode: string }
  | { kind: "employer"; employerSlug: string }
  | { kind: "attorney"; attorneySlug: string };

const sliceValidator = v.union(
  v.object({ kind: v.literal("all") }),
  v.object({ kind: v.literal("state"), state: v.string() }),
  v.object({ kind: v.literal("occupation"), socCode: v.string() }),
  v.object({ kind: v.literal("employer"), employerSlug: v.string() }),
  v.object({ kind: v.literal("attorney"), attorneySlug: v.string() }),
);

export interface CaseFilter {
  slice: CaseSlice;
  status?: CaseStatus;
  /** Inclusive lower bound on `decisionDate`, `YYYY-MM-DD`. */
  from?: string;
  /** Inclusive upper bound on `decisionDate`, `YYYY-MM-DD`. */
  to?: string;
}

const filterValidator = v.object({
  slice: sliceValidator,
  status: v.optional(statusValidator),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
});

/**
 * Every index a browse query is allowed to use.
 *
 * The test asserts the schema declares all of them and that no plan can name
 * anything outside this list. A plan naming a nonexistent index is not a type
 * error - `withIndex` would throw at runtime, in production, on the quarter
 * the table finally got big.
 */
export const BROWSE_INDEXES = [
  "by_decision",
  "by_status_decision",
  "by_state_decision",
  "by_state_status_decision",
  "by_soc_decision",
  "by_soc_status_decision",
  "by_employer_decision",
  "by_employer_status_decision",
  "by_attorney_decision",
  "by_attorney_status_decision",
] as const;

export type BrowseIndex = (typeof BROWSE_INDEXES)[number];

export type CaseQueryPlan =
  | { index: "by_decision"; from?: string; to?: string }
  | { index: "by_status_decision"; status: CaseStatus; from?: string; to?: string }
  | { index: "by_state_decision"; state: string; from?: string; to?: string }
  | {
      index: "by_state_status_decision";
      state: string;
      status: CaseStatus;
      from?: string;
      to?: string;
    }
  | { index: "by_soc_decision"; socCode: string; from?: string; to?: string }
  | {
      index: "by_soc_status_decision";
      socCode: string;
      status: CaseStatus;
      from?: string;
      to?: string;
    }
  | { index: "by_employer_decision"; employerSlug: string; from?: string; to?: string }
  | {
      index: "by_employer_status_decision";
      employerSlug: string;
      status: CaseStatus;
      from?: string;
      to?: string;
    }
  | { index: "by_attorney_decision"; attorneySlug: string; from?: string; to?: string }
  | {
      index: "by_attorney_status_decision";
      attorneySlug: string;
      status: CaseStatus;
      from?: string;
      to?: string;
    };

/**
 * Choose the index for a filter. Total by construction: every `CaseSlice`
 * crossed with status-present and status-absent has its own branch, and the
 * switch is exhaustive over the union.
 */
export function planCaseQuery(filter: CaseFilter): CaseQueryPlan {
  const { status, from, to } = filter;
  const bounds = { from, to };
  switch (filter.slice.kind) {
    case "all":
      return status === undefined
        ? { index: "by_decision", ...bounds }
        : { index: "by_status_decision", status, ...bounds };
    case "state": {
      const { state } = filter.slice;
      return status === undefined
        ? { index: "by_state_decision", state, ...bounds }
        : { index: "by_state_status_decision", state, status, ...bounds };
    }
    case "occupation": {
      const { socCode } = filter.slice;
      return status === undefined
        ? { index: "by_soc_decision", socCode, ...bounds }
        : { index: "by_soc_status_decision", socCode, status, ...bounds };
    }
    case "employer": {
      const { employerSlug } = filter.slice;
      return status === undefined
        ? { index: "by_employer_decision", employerSlug, ...bounds }
        : { index: "by_employer_status_decision", employerSlug, status, ...bounds };
    }
    case "attorney": {
      const { attorneySlug } = filter.slice;
      return status === undefined
        ? { index: "by_attorney_decision", attorneySlug, ...bounds }
        : { index: "by_attorney_status_decision", attorneySlug, status, ...bounds };
    }
  }
}

/**
 * The index-range builder as positioned on `decisionDate`.
 *
 * Declared here rather than imported: Convex exports `IndexRange` and
 * `IndexRangeBuilder` but not the intermediate lower-bound interface this
 * actually is, and naming the concrete builder would tie the helper to one
 * index's field list when the whole point is that it works on all ten.
 */
interface DecisionDateLowerBound extends IndexRange {
  gte(field: "decisionDate", value: string): DecisionDateUpperBound;
  lte(field: "decisionDate", value: string): IndexRange;
}

interface DecisionDateUpperBound extends IndexRange {
  lte(field: "decisionDate", value: string): IndexRange;
}

/**
 * Apply the optional decision-date bounds.
 *
 * Works on every browse index because `decisionDate` is the last declared
 * field of all of them, so whatever equalities came first, the builder handed
 * in is positioned exactly here.
 */
function withDateRange(
  q: DecisionDateLowerBound,
  from: string | undefined,
  to: string | undefined,
): IndexRange {
  if (from !== undefined && to !== undefined) {
    return q.gte("decisionDate", from).lte("decisionDate", to);
  }
  if (from !== undefined) return q.gte("decisionDate", from);
  if (to !== undefined) return q.lte("decisionDate", to);
  return q;
}

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

/**
 * The largest page the server will hand out.
 *
 * This doubles as the whole-slice threshold: a caller that asks for this many
 * and gets `isDone: true` holds the complete slice and may sort and page it
 * locally. 500 rows is roughly 200 KB on the wire and about an eighth of the
 * 4,096-document read ceiling.
 */
export const MAX_PAGE_ITEMS = 500;
export const DEFAULT_PAGE_ITEMS = 50;

/**
 * A hard ceiling on rows read, independent of `numItems`.
 *
 * With no post-filter, rows read equals rows returned, so this never fires in
 * normal use. It is here because `numItems` arrives from an unauthenticated
 * caller: if the clamp below were ever loosened by mistake, this still stops
 * one request from trying to read the table.
 */
const MAX_ROWS_READ = 1_000;

/** Clamp a caller-supplied page size into the range the indexes can serve. */
export function clampPageItems(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return DEFAULT_PAGE_ITEMS;
  return Math.min(MAX_PAGE_ITEMS, Math.max(1, Math.floor(requested)));
}

/**
 * Which 1-based page a row offset lands on.
 *
 * Cursor paging has no page numbers, so the client counts the rows it has
 * walked past. These three sums are the whole of the paging arithmetic, and
 * written inline at each call site they are wrong in the obvious ways.
 */
export function pageNumberForOffset(offset: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.floor(Math.max(0, offset) / pageSize) + 1;
}

export function pageRange(
  offset: number,
  rowsOnPage: number,
): { first: number; last: number } {
  const start = Math.max(0, offset);
  // A page with no rows starts and ends nowhere. Reporting `start + 1` would
  // claim a row that is not there, which is how an empty filter ends up
  // reading "showing 1 to 0".
  if (rowsOnPage <= 0) return { first: start, last: start };
  return { first: start + 1, last: start + rowsOnPage };
}

export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

// ---------------------------------------------------------------------------
// Writers. Internal only, and clearing is separate from inserting.
// ---------------------------------------------------------------------------

/**
 * Delete up to `max` case rows, reporting whether more remain.
 *
 * Same shape and the same reason as `permEntities.clearKind`: Convex counts
 * reads per FUNCTION EXECUTION, so 259,000 deletes cannot be batched inside
 * one mutation however the loop is written. The caller repeats this until
 * `done`.
 */
export const clearBatch = internalMutation({
  args: { max: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, { max }) => {
    const take = Math.min(Math.max(1, max ?? 1500), 2000);
    const batch = await ctx.db.query("permCases").take(take);
    for (const row of batch) await ctx.db.delete(row._id);
    return { deleted: batch.length, done: batch.length < take };
  },
});

export const insertChunk = internalMutation({
  args: { rows: v.array(caseInputValidator) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { rows }) => {
    const computedAt = Date.now();
    for (const row of rows) {
      await ctx.db.insert("permCases", { ...row, computedAt });
    }
    return { inserted: rows.length };
  },
});

const stateFacetValidator = v.object({
  state: v.string(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  withdrawn: v.number(),
});

const fiscalYearFacetValidator = v.object({
  fiscalYear: v.string(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  withdrawn: v.number(),
});

const statusFacetValidator = v.object({
  status: statusValidator,
  count: v.number(),
});

/**
 * Replace the coverage document.
 *
 * Written LAST, after every chunk has landed, so a run that dies halfway
 * leaves the previous coverage statement in place rather than advertising a
 * row count the table does not have.
 */
export const storeMeta = internalMutation({
  args: {
    sourceFiles: v.array(v.string()),
    totalCases: v.number(),
    firstDecisionDate: v.string(),
    lastDecisionDate: v.string(),
    firstReceivedDate: v.string(),
    lastReceivedDate: v.string(),
    byStatus: v.array(statusFacetValidator),
    byFiscalYear: v.array(fiscalYearFacetValidator),
    byState: v.array(stateFacetValidator),
    contentHash: v.string(),
  },
  returns: v.object({ stored: v.boolean(), reason: v.string() }),
  handler: async (ctx, args) => {
    // A run that emitted nothing must never replace a good coverage doc. The
    // expensive failure is a page quietly claiming zero cases, not one that
    // errors.
    if (args.totalCases <= 0) {
      return { stored: false, reason: "payload reported no cases" };
    }
    for (const existing of await ctx.db.query("permCasesMeta").take(50)) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("permCasesMeta", { ...args, computedAt: Date.now() });
    return { stored: true, reason: "stored" };
  },
});

// ---------------------------------------------------------------------------
// Readers. Every one bounded.
// ---------------------------------------------------------------------------

const metaValidator = v.object({
  sourceFiles: v.array(v.string()),
  totalCases: v.number(),
  firstDecisionDate: v.string(),
  lastDecisionDate: v.string(),
  firstReceivedDate: v.string(),
  lastReceivedDate: v.string(),
  byStatus: v.array(statusFacetValidator),
  byFiscalYear: v.array(fiscalYearFacetValidator),
  byState: v.array(stateFacetValidator),
  computedAt: v.number(),
});

/**
 * What the browser covers, and the exact counts behind its filters.
 *
 * The page reads this instead of counting rows. Counting a filtered set means
 * reading it, and reading 50,000 rows to print one number is the read-limit
 * failure this whole file is arranged to avoid. The counts were computed by
 * the ingest over exactly the rows it emitted, so a facet total and the rows
 * the browser pages through cannot disagree.
 */
export const getMeta = query({
  args: {},
  returns: v.union(metaValidator, v.null()),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("permCasesMeta")
      .withIndex("by_computed")
      .order("desc")
      .first();
    if (!row) return null;
    return {
      sourceFiles: row.sourceFiles,
      totalCases: row.totalCases,
      firstDecisionDate: row.firstDecisionDate,
      lastDecisionDate: row.lastDecisionDate,
      firstReceivedDate: row.firstReceivedDate,
      lastReceivedDate: row.lastReceivedDate,
      byStatus: row.byStatus,
      byFiscalYear: row.byFiscalYear,
      byState: row.byState,
      computedAt: row.computedAt,
    };
  },
});

/** DOL's longest printed case number is 13 characters (`A-24123-45678`). */
const MAX_CASE_NUMBER_INPUT = 32;

/**
 * Tidy a pasted case number.
 *
 * The length cap runs FIRST, before anything that walks the string, because
 * this is reachable unauthenticated and `v.string()` accepts about a megabyte.
 * Returns "" for anything that cannot be a case number, and the caller treats
 * that as a miss rather than querying with it.
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
export const lookupByCaseNumber = query({
  args: { caseNumber: v.string() },
  returns: v.union(caseRowValidator, v.null()),
  handler: async (ctx, { caseNumber }) => {
    const needle = normalizeCaseNumber(caseNumber);
    if (needle === "") return null;
    const row = await ctx.db
      .query("permCases")
      .withIndex("by_case_number", (q) => q.eq("caseNumber", needle))
      .first();
    return row ? toPublicRow(row) : null;
  },
});

/**
 * A page of cases, ordered by decision date.
 *
 * `newest` is the default because the newest determinations are what someone
 * waiting actually wants to see.
 */
export const listCases = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filter: filterValidator,
    order: v.optional(v.union(v.literal("newest"), v.literal("oldest"))),
  },
  returns: paginationResultValidator(caseRowValidator),
  handler: async (ctx, args) => {
    const plan = planCaseQuery(args.filter);
    const direction = args.order === "oldest" ? "asc" : "desc";
    // Spread rather than rebuild: reconstructing the options field by field
    // drops `endCursor` and the split fields and breaks reactive paging. The
    // two overrides exist because `numItems` arrives from a stranger.
    const opts = {
      ...args.paginationOpts,
      numItems: clampPageItems(args.paginationOpts.numItems),
      maximumRowsRead: MAX_ROWS_READ,
    };

    const q = ctx.db.query("permCases");
    const { from, to } = plan;
    const ordered = (() => {
      switch (plan.index) {
        case "by_decision":
          return q.withIndex("by_decision", (r) => withDateRange(r, from, to));
        case "by_status_decision":
          return q.withIndex("by_status_decision", (r) =>
            withDateRange(r.eq("status", plan.status), from, to),
          );
        case "by_state_decision":
          return q.withIndex("by_state_decision", (r) =>
            withDateRange(r.eq("state", plan.state), from, to),
          );
        case "by_state_status_decision":
          return q.withIndex("by_state_status_decision", (r) =>
            withDateRange(r.eq("state", plan.state).eq("status", plan.status), from, to),
          );
        case "by_soc_decision":
          return q.withIndex("by_soc_decision", (r) =>
            withDateRange(r.eq("socCode", plan.socCode), from, to),
          );
        case "by_soc_status_decision":
          return q.withIndex("by_soc_status_decision", (r) =>
            withDateRange(r.eq("socCode", plan.socCode).eq("status", plan.status), from, to),
          );
        case "by_employer_decision":
          return q.withIndex("by_employer_decision", (r) =>
            withDateRange(r.eq("employerSlug", plan.employerSlug), from, to),
          );
        case "by_employer_status_decision":
          return q.withIndex("by_employer_status_decision", (r) =>
            withDateRange(
              r.eq("employerSlug", plan.employerSlug).eq("status", plan.status),
              from,
              to,
            ),
          );
        case "by_attorney_decision":
          return q.withIndex("by_attorney_decision", (r) =>
            withDateRange(r.eq("attorneySlug", plan.attorneySlug), from, to),
          );
        case "by_attorney_status_decision":
          return q.withIndex("by_attorney_status_decision", (r) =>
            withDateRange(
              r.eq("attorneySlug", plan.attorneySlug).eq("status", plan.status),
              from,
              to,
            ),
          );
      }
    })();

    const result = await ordered.order(direction).paginate(opts);
    return { ...result, page: result.page.map(toPublicRow) };
  },
});

/** The most matches a name search will return. Relevance-ordered, not paged. */
export const MAX_SEARCH_RESULTS = 100;

/**
 * Free-text search over employer or law-firm names.
 *
 * This is the one thing an ordered index cannot do, and it is the only way to
 * reach the long tail: an employer with one or two cases has no `permEntities`
 * row, so there is no slug to slice by and no entity page to arrive from.
 *
 * Results come back by relevance and are capped. They are not paged and not
 * date-ordered, and the page must not present them as though they were -
 * "best matches" is the honest label for what a search index returns.
 */
export const searchCases = query({
  args: {
    field: v.union(v.literal("employer"), v.literal("attorney")),
    text: v.string(),
    status: v.optional(statusValidator),
    state: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(caseRowValidator),
  handler: async (ctx, args) => {
    // Cheap guards first, in cost order. An empty or absurd query never
    // reaches the search index.
    const text = args.text.length > 120 ? "" : args.text.trim();
    if (text.length < 2) return [];
    const take = Math.min(Math.max(1, Math.floor(args.limit ?? 50)), MAX_SEARCH_RESULTS);
    const { status, state } = args;

    const rows =
      args.field === "employer"
        ? await ctx.db
            .query("permCases")
            .withSearchIndex("search_employer", (q) => {
              let s = q.search("employerName", text);
              if (status !== undefined) s = s.eq("status", status);
              if (state !== undefined && state !== "") s = s.eq("state", state);
              return s;
            })
            .take(take)
        : await ctx.db
            .query("permCases")
            .withSearchIndex("search_attorney", (q) => {
              let s = q.search("attorneyName", text);
              if (status !== undefined) s = s.eq("status", status);
              if (state !== undefined && state !== "") s = s.eq("state", state);
              return s;
            })
            .take(take);

    return rows.map(toPublicRow);
  },
});
