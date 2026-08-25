import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
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
 * The slice of an entity a link needs: enough to render a card, nothing more.
 *
 * Deliberately narrower than the full row. A comparables list renders six to
 * eight of these, and shipping every field would put a second copy of the
 * detail page's payload on the page for each one.
 */
const neighborValidator = v.object({
  slug: v.string(),
  name: v.string(),
  rank: v.number(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  medianDays: v.union(v.number(), v.null()),
  medianAnnualWage: v.union(v.number(), v.null()),
  state: v.union(v.string(), v.null()),
});

type Neighbor = {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
  state: string | null;
};

function toNeighbor(row: Doc<"permEntities">): Neighbor {
  return {
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    total: row.total,
    certified: row.certified,
    denied: row.denied,
    medianDays: row.medianDays,
    // The table leaves these off the kinds that do not have them; the wire
    // shape uses null throughout so a consumer has one absent-value to handle.
    medianAnnualWage: row.medianAnnualWage ?? null,
    state: row.state ?? null,
  };
}

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

/**
 * The cohort a rate can honestly be compared against, and its distribution.
 *
 * The detail pages used to draw their "position in the field" histogram from
 * the aggregate document's top-250 list, which meant a sponsor ranked 4,000th
 * was placed against 250 of its 12,240 peers and the page printed "#4000 of
 * 250". Worse, it put an employer with three cases on the same axis as one
 * with four thousand, where a spotless three-case record reads as best in
 * class.
 *
 * So the population is defined by whether the measure can carry a number at
 * all: entities with at least `minDecided` decided cases. Withdrawals are in
 * neither numerator nor denominator, matching `permDisclosure`'s risk tables.
 *
 * THE READ IS BOUNDED AND THE COHORT IS STILL COMPLETE, which is the whole
 * trick. Rank is assigned by `total` descending and `total >= decided`, so
 * every entity with `minDecided` decided cases has `total >= minDecided` and
 * therefore sits above every entity that does not. Scanning the head of the
 * rank index until `total` drops below the threshold reaches all of them.
 * Measured at minDecided=30 over FY2025+FY2026 (12,240 employers): the last
 * qualifying employer was rank 980, the last law firm 933, the last
 * occupation 373. Re-measured after FY2024 landed (16,305 employers): 1,338,
 * 1,134 and 535. One extra fiscal year moved the employer cohort by 358, so
 * the scan needs real headroom rather than a bound that fits today.
 *
 * `complete` reports whether that proof held on this run. A quarter where the
 * distribution shifts far enough to fill the scan is a partial denominator,
 * and the pages say so rather than publishing a percentile computed against
 * a truncated field.
 *
 * Args are just `{ kind, minDecided }`, identical for every page of a kind, so
 * Convex's query cache serves all 12,240 employer pages from one execution
 * until the next quarterly ingest writes the table.
 */
/**
 * 3,000, not 1,500.
 *
 * At 1,500 the employer cohort was already 1,338 after one extra fiscal year,
 * 89% of the bound. Crossing it does not break anything, because `complete`
 * goes false and the pages withhold the percentile rather than compute one
 * against a truncated field, but it would silently turn the feature off for
 * a quarter and nobody would know why. 3,001 reads is still comfortably under
 * Convex's 4,096-per-execution limit.
 */
const COHORT_SCAN = 3000;

export const fieldDistribution = query({
  args: { kind: kindValidator, minDecided: v.number() },
  returns: v.object({
    /** How many entities cleared the bar. */
    cohort: v.number(),
    /** How many exist in the kind, cohort or not. */
    kindTotal: v.number(),
    /** The bar itself, echoed so the page and the query cannot disagree. */
    minDecided: v.number(),
    /** True when the scan reached past the last entity that could qualify. */
    complete: v.boolean(),
    /** Approval percentages, one per cohort member. */
    approval: v.array(v.number()),
    /** Median days, one per cohort member that has one. */
    medianDays: v.array(v.number()),
    /** Median offered wages, one per cohort member that has one. */
    wages: v.array(v.number()),
  }),
  handler: async (ctx, { kind, minDecided }) => {
    const bar = Math.max(1, Math.min(minDecided, 500));
    const rows = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) => q.eq("kind", kind))
      .take(COHORT_SCAN);

    const approval: number[] = [];
    const medianDays: number[] = [];
    const wages: number[] = [];
    for (const row of rows) {
      const decided = row.certified + row.denied;
      if (decided < bar) continue;
      approval.push((row.certified / decided) * 100);
      if (row.medianDays !== null) medianDays.push(row.medianDays);
      const wage = row.medianAnnualWage;
      if (wage !== undefined && wage !== null) wages.push(wage);
    }

    // The scan proved it reached everything only if it ran out of rows, or if
    // the last row it read already sits below the bar on `total` alone.
    const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
    const complete = rows.length < COHORT_SCAN || (last !== undefined && last.total < bar);

    const highest = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) => q.eq("kind", kind))
      .order("desc")
      .first();

    return {
      cohort: approval.length,
      kindTotal: highest?.rank ?? 0,
      minDecided: bar,
      complete,
      approval,
      medianDays,
      wages,
    };
  },
});

/**
 * The entities either side of one rank, and the peers worth linking to.
 *
 * This is what turns 16,210 pages from a flat list of orphans into a graph.
 * A visitor who reaches one sponsor almost always wants the next thing along:
 * others of the same size, or in the same state, or in the same line of work.
 *
 * `state` and `codePrefix` are passed by the caller rather than derived here,
 * because the SOC major-group lookup lives in `src/lib/socGroups.ts` and one
 * copy of a mapping is the only safe number of copies. Employers carry
 * neither field in DOL's aggregate rows, so their peers are volume peers.
 *
 * READ COST is `span * 2 + 1` rows, capped at 1,001. A rank window IS a volume
 * window, because rank is assigned by volume, so the nearest ranks are exactly
 * the entities filing at a similar rate.
 */
export const comparables = query({
  args: {
    kind: kindValidator,
    rank: v.number(),
    /** Ranks either side to read. Wider when a facet will thin the result. */
    span: v.optional(v.number()),
    /** Keep only rows filed from this state. */
    state: v.optional(v.string()),
    /** Keep only rows whose SOC code starts with this. */
    codePrefix: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    above: v.union(neighborValidator, v.null()),
    below: v.union(neighborValidator, v.null()),
    peers: v.array(neighborValidator),
    /**
     * Which set `peers` actually came from. A facet that matches nothing falls
     * back to volume peers rather than returning an empty list, and the page
     * has to word its heading from this rather than from what it asked for -
     * "other Wyoming firms" over six firms from anywhere is a false caption.
     */
    matched: v.union(v.literal("facet"), v.literal("volume")),
    /** How many rows the window actually held. Printed, so the reach is visible. */
    scanned: v.number(),
  }),
  handler: async (ctx, { kind, rank, span, state, codePrefix, limit }) => {
    const reach = Math.min(Math.max(1, span ?? 60), 500);
    const want = Math.min(Math.max(1, limit ?? 6), 12);
    const lo = Math.max(1, rank - reach);
    const hi = rank + reach;

    const rows = await ctx.db
      .query("permEntities")
      .withIndex("by_kind_rank", (q) => q.eq("kind", kind).gte("rank", lo).lte("rank", hi))
      .take(reach * 2 + 2);

    let above: Neighbor | null = null;
    let below: Neighbor | null = null;
    const matching: Neighbor[] = [];
    const anyRank: Neighbor[] = [];
    for (const row of rows) {
      const lite = toNeighbor(row);
      if (row.rank === rank - 1) above = lite;
      if (row.rank === rank + 1) below = lite;
      if (row.rank === rank) continue;
      anyRank.push(lite);
      if (state !== undefined && row.state !== state) continue;
      if (codePrefix !== undefined && !(row.code ?? "").startsWith(codePrefix)) continue;
      matching.push(lite);
    }

    // A facet that matched nothing is a real outcome, not an error: a firm may
    // be the only one filing from its state. Returning an empty list would
    // silently drop the module off the page, so fall back to volume peers and
    // SAY which happened, so the caller's heading can stay true.
    const faceted = state !== undefined || codePrefix !== undefined;
    const useFacet = faceted && matching.length > 0;
    const candidates = useFacet ? matching : anyRank;

    // Nearest by rank is nearest by volume, and taking from both sides keeps
    // the list from being six entities that are all bigger than the subject.
    candidates.sort((a, b) => Math.abs(a.rank - rank) - Math.abs(b.rank - rank));

    return {
      above,
      below,
      peers: candidates.slice(0, want),
      matched: (useFacet ? "facet" : "volume") as "facet" | "volume",
      scanned: rows.length,
    };
  },
});

/**
 * Find entities by name, anywhere in the corpus.
 *
 * The index pages server-render a head and lazily fetch a bounded slice of
 * the rank order, so a client-side search can only ever see what was
 * downloaded. For a corpus of 16,000 sponsors that is most of them; the
 * moment the floor drops it is a small minority, and "no match" for a row
 * that exists is a worse answer than a slow one.
 *
 * Bounded by construction: a search index read is not a scan, and `limit` is
 * clamped server-side so a caller cannot ask for the table.
 */
export const searchByName = query({
  args: {
    kind: kindValidator,
    text: v.string(),
    limit: v.optional(v.number()),
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
  handler: async (ctx, { kind, text, limit }) => {
    // Cheap guard first. A search index will happily accept a megabyte of
    // text; v.string() allows roughly that, and this route is reachable by
    // anyone. Length before anything that scales with length.
    const q = text.trim().slice(0, 120);
    if (q.length < 2) return [];
    const take = Math.min(Math.max(1, limit ?? 50), 200);
    const rows = await ctx.db
      .query("permEntities")
      .withSearchIndex("search_name", (s) =>
        s.search("name", q).eq("kind", kind),
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
