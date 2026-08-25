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
 * Writes are chunked and internal, and CLEARING IS SEPARATE FROM INSERTING.
 * Convex caps reads at 4,096 per function execution, so a clear-then-insert
 * mutation cannot delete 12,250 rows however it batches them internally. The
 * caller loops `clearKind` until it reports done, then sends `insertChunk`.
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

/**
 * Delete up to `max` rows of one kind, reporting whether more remain.
 *
 * Clearing has to be its own repeated call, not a loop inside the insert.
 * Convex caps reads at 4,096 PER FUNCTION EXECUTION, so paging inside a
 * single mutation buys nothing — 12,250 employers is 12,250 reads however
 * they are batched, and the first real ingest failed exactly there. The
 * caller loops on `done`.
 */
export const clearKind = internalMutation({
  args: { kind: kindValidator, max: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, { kind, max }) => {
    const take = Math.min(Math.max(1, max ?? 1500), 2000);
    const batch = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) => q.eq("kind", kind))
      .take(take);
    for (const row of batch) await ctx.db.delete(row._id);
    return { deleted: batch.length, done: batch.length < take };
  },
});

export const insertChunk = internalMutation({
  args: { kind: kindValidator, rows: v.array(entityValidator) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { kind, rows }) => {
    const computedAt = Date.now();
    for (const row of rows) {
      await ctx.db.insert("permEntities", { ...row, kind, computedAt });
    }
    return { inserted: rows.length };
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
