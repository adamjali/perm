import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

/**
 * The salary explorer's read and write paths.
 *
 * Precomputed percentile cells, because the alternative is computing them from
 * 259,000 rows at query time and Convex caps a function execution at 4,096
 * document reads. A median over an occupation is not a query this database can
 * answer live; it is a query the ingest answers once a quarter.
 *
 * ## What a cell is
 *
 * One row per (partition, key, fiscal year). Three partitions - `occupation`,
 * `state`, `occupationState` - each emitted per fiscal year and once more
 * pooled as `"all"`. Per-year exists because a five-year ingest pooled into
 * one median publishes a rate that was never the market rate in any year of
 * it.
 *
 * ## Every read here is bounded by an index, and one of them by arithmetic
 *
 * `getCell` is an exact three-field lookup. `listTop` walks
 * `by_kind_year_count` in descending order and takes a capped page. Neither
 * can grow with the table, which matters more here than it looks: the cell
 * count has a hard ceiling of N/F per partition (a cell needs F values to be
 * published and each case is in exactly one cell), so the table is bounded,
 * but a query that read all of it would still be reading thousands of rows to
 * render a page of twenty.
 */

const kindValidator = v.union(
  v.literal("occupation"),
  v.literal("state"),
  v.literal("occupationState"),
);

const cellInputValidator = v.object({
  kind: kindValidator,
  key: v.string(),
  socCode: v.string(),
  socTitle: v.string(),
  state: v.string(),
  fiscalYear: v.string(),
  count: v.number(),
  p5: v.number(),
  p10: v.number(),
  p25: v.number(),
  p50: v.number(),
  p75: v.number(),
  p90: v.number(),
  p95: v.number(),
  mean: v.number(),
  histogram: v.array(v.number()),
});

/**
 * The exactness check the schema cannot do for us. Same trick and same reason
 * as `permCases.ts`: an EXTRA validator field typechecks green and fails at
 * insert time, a MISSING one silently drops data the ingest computed.
 */
type WageCellRow = Omit<
  import("./_generated/dataModel").Doc<"permWageStats">,
  "_id" | "_creationTime" | "computedAt"
>;
type WageCellIsExact = WageCellRow extends typeof cellInputValidator.type
  ? typeof cellInputValidator.type extends WageCellRow
    ? true
    : never
  : never;
const _wageCellIsExact: WageCellIsExact = true;
void _wageCellIsExact;

/** The field names the ingest must write, derived from the validator itself. */
export const WAGE_CELL_FIELDS: string[] = Object.keys(cellInputValidator.fields).sort();

const policyValidator = v.object({
  rule: v.string(),
  min: v.number(),
  max: v.number(),
  considered: v.number(),
  kept: v.number(),
  excluded: v.number(),
  excludedByReason: v.array(v.object({ reason: v.string(), count: v.number() })),
  population: v.string(),
  percentileMethod: v.string(),
});

const metaValidator = v.object({
  sourceFiles: v.array(v.string()),
  binEdges: v.array(v.number()),
  floors: v.object({ single: v.number(), pair: v.number() }),
  policy: policyValidator,
  cells: v.number(),
  fiscalYears: v.array(v.string()),
  computedAt: v.number(),
});

// ---------------------------------------------------------------------------
// Writers. Internal only, clear split from insert.
// ---------------------------------------------------------------------------

/**
 * Delete up to `max` cells, reporting whether more remain.
 *
 * Separate from the insert for the reason `permEntities` and `permCases`
 * document: Convex counts reads PER FUNCTION EXECUTION, so a clear-then-insert
 * mutation cannot delete thousands of rows however it batches internally. The
 * caller loops on `done`.
 */
export const clearBatch = internalMutation({
  args: { max: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, { max }) => {
    const take = Math.min(Math.max(1, max ?? 1500), 2000);
    const batch = await ctx.db.query("permWageStats").take(take);
    for (const row of batch) await ctx.db.delete(row._id);
    return { deleted: batch.length, done: batch.length < take };
  },
});

export const insertChunk = internalMutation({
  args: { rows: v.array(cellInputValidator) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { rows }) => {
    const computedAt = Date.now();
    for (const row of rows) {
      await ctx.db.insert("permWageStats", { ...row, computedAt });
    }
    return { inserted: rows.length };
  },
});

/**
 * Replace the axis-and-policy document.
 *
 * Written LAST, after every cell has landed, so a run that dies partway leaves
 * the previous policy statement standing rather than describing rows that are
 * not there.
 */
export const storeMeta = internalMutation({
  args: {
    sourceFiles: v.array(v.string()),
    binEdges: v.array(v.number()),
    floors: v.object({ single: v.number(), pair: v.number() }),
    policy: policyValidator,
    cells: v.number(),
    fiscalYears: v.array(v.string()),
    contentHash: v.string(),
  },
  returns: v.object({ stored: v.boolean(), reason: v.string() }),
  handler: async (ctx, args) => {
    if (args.cells <= 0) {
      return { stored: false, reason: "payload reported no cells" };
    }
    // A histogram whose axis has no bins cannot be drawn, and an empty
    // `binEdges` would render as a chart with no scale rather than an error.
    if (args.binEdges.length === 0) {
      return { stored: false, reason: "payload carried no histogram bin edges" };
    }
    for (const existing of await ctx.db.query("permWageMeta").take(50)) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("permWageMeta", { ...args, computedAt: Date.now() });
    return { stored: true, reason: "stored" };
  },
});

// ---------------------------------------------------------------------------
// Readers.
// ---------------------------------------------------------------------------

/** The shared histogram axis, the floors, and the outlier policy. */
export const getMeta = query({
  args: {},
  returns: v.union(metaValidator, v.null()),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("permWageMeta")
      .withIndex("by_computed")
      .order("desc")
      .first();
    if (!row) return null;
    return {
      sourceFiles: row.sourceFiles,
      binEdges: row.binEdges,
      floors: row.floors,
      policy: row.policy,
      cells: row.cells,
      fiscalYears: row.fiscalYears,
      computedAt: row.computedAt,
    };
  },
});

const cellValidator = v.object({
  kind: kindValidator,
  key: v.string(),
  socCode: v.string(),
  socTitle: v.string(),
  state: v.string(),
  fiscalYear: v.string(),
  count: v.number(),
  p5: v.number(),
  p10: v.number(),
  p25: v.number(),
  p50: v.number(),
  p75: v.number(),
  p90: v.number(),
  p95: v.number(),
  mean: v.number(),
  histogram: v.array(v.number()),
});

/**
 * One cell.
 *
 * `null` means the cell was never published, which for this table means the
 * combination did not clear its floor. That is not the same as "nobody in that
 * job in that state" and a page must not render it as zero.
 */
export const getCell = query({
  args: { kind: kindValidator, key: v.string(), fiscalYear: v.optional(v.string()) },
  returns: v.union(cellValidator, v.null()),
  handler: async (ctx, { kind, key, fiscalYear }) => {
    const row = await ctx.db
      .query("permWageStats")
      .withIndex("by_kind_year_key", (q) =>
        q.eq("kind", kind).eq("fiscalYear", fiscalYear ?? "all").eq("key", key),
      )
      .first();
    if (!row) return null;
    const { _id, _creationTime, computedAt, ...cell } = row;
    void _id;
    void _creationTime;
    void computedAt;
    return cell;
  },
});

/** The busiest cells in one partition and year. Bounded and capped. */
export const listTop = query({
  args: {
    kind: kindValidator,
    fiscalYear: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(cellValidator),
  handler: async (ctx, { kind, fiscalYear, limit }) => {
    const take = Math.min(Math.max(1, limit ?? 50), 500);
    const rows = await ctx.db
      .query("permWageStats")
      .withIndex("by_kind_year_count", (q) =>
        q.eq("kind", kind).eq("fiscalYear", fiscalYear ?? "all"),
      )
      .order("desc")
      .take(take);
    return rows.map((row) => {
      const { _id, _creationTime, computedAt, ...cell } = row;
      void _id;
      void _creationTime;
      void computedAt;
      return cell;
    });
  },
});
