import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

/**
 * The entity table's read and write paths.
 *
 * Entities moved out of the aggregate document because the uncapped set does
 * not fit in one: 12,000 employer rows measured 1.14 MB against Convex's 1 MB
 * limit. That made the old top-100 cap an architectural constraint wearing an
 * editorial disguise, which is the worst kind.
 *
 * Writes are chunked and internal. A quarterly ingest replaces a whole kind,
 * so `replaceChunk` takes an explicit `first` flag: the first chunk clears
 * the kind, the rest append. Doing the clear inside every chunk would delete
 * the rows the previous chunk just wrote.
 */

const entityValidator = v.object({
  slug: v.string(),
  name: v.string(),
  rank: v.number(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  medianDays: v.union(v.number(), v.null()),
  medianAnnualWage: v.optional(v.union(v.number(), v.null())),
  state: v.optional(v.string()),
  code: v.optional(v.string()),
});

const kindValidator = v.union(
  v.literal("employer"),
  v.literal("attorney"),
  v.literal("occupation"),
);

export const replaceChunk = internalMutation({
  args: {
    kind: kindValidator,
    /** True only for the first chunk of a run: clears the existing rows. */
    first: v.boolean(),
    rows: v.array(entityValidator),
  },
  returns: v.object({ deleted: v.number(), inserted: v.number() }),
  handler: async (ctx, { kind, first, rows }) => {
    let deleted = 0;
    if (first) {
      // Bounded by the index rather than a table scan, and paged so a large
      // kind cannot blow the mutation's read limit in one go.
      for (;;) {
        const batch = await ctx.db
          .query("permEntities")
          .withIndex("by_kind_rank", (q) => q.eq("kind", kind))
          .take(400);
        if (batch.length === 0) break;
        for (const row of batch) await ctx.db.delete(row._id);
        deleted += batch.length;
        if (batch.length < 400) break;
      }
    }
    const computedAt = Date.now();
    for (const row of rows) {
      await ctx.db.insert("permEntities", { ...row, kind, computedAt });
    }
    return { deleted, inserted: rows.length };
  },
});

/** One entity, for its detail page. */
export const getBySlug = query({
  args: { kind: kindValidator, slug: v.string() },
  returns: v.union(
    v.object({
      slug: v.string(),
      name: v.string(),
      rank: v.number(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      medianDays: v.union(v.number(), v.null()),
      medianAnnualWage: v.optional(v.union(v.number(), v.null())),
      state: v.optional(v.string()),
      code: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, { kind, slug }) => {
    const row = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_slug", (q) => q.eq("kind", kind).eq("slug", slug))
      .first();
    if (!row) return null;
    return {
      slug: row.slug,
      name: row.name,
      rank: row.rank,
      total: row.total,
      certified: row.certified,
      denied: row.denied,
      medianDays: row.medianDays,
      medianAnnualWage: row.medianAnnualWage,
      state: row.state,
      code: row.code,
    };
  },
});

/**
 * A ranked page of one kind.
 *
 * `limit` is capped server-side: an uncapped caller could otherwise ask for
 * every row and turn a bounded read into a table scan.
 */
export const listByKind = query({
  args: {
    kind: kindValidator,
    limit: v.optional(v.number()),
    /** Rank to start after, for paging deeper than the first page. */
    afterRank: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      name: v.string(),
      rank: v.number(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      medianDays: v.union(v.number(), v.null()),
      medianAnnualWage: v.optional(v.union(v.number(), v.null())),
      state: v.optional(v.string()),
      code: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { kind, limit, afterRank }) => {
    const take = Math.min(Math.max(1, limit ?? 250), 2000);
    const rows = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) =>
        afterRank === undefined
          ? q.eq("kind", kind)
          : q.eq("kind", kind).gt("rank", afterRank),
      )
      .take(take);
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      rank: row.rank,
      total: row.total,
      certified: row.certified,
      denied: row.denied,
      medianDays: row.medianDays,
      medianAnnualWage: row.medianAnnualWage,
      state: row.state,
      code: row.code,
    }));
  },
});

/** How many rows a kind holds. Cheap, and the pages print it. */
export const countByKind = query({
  args: { kind: kindValidator },
  returns: v.number(),
  handler: async (ctx, { kind }) => {
    // The rank index is dense and 1-based, so the highest rank IS the count
    // and finding it costs one row instead of reading the whole kind.
    const last = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) => q.eq("kind", kind))
      .order("desc")
      .first();
    return last?.rank ?? 0;
  },
});
