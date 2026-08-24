import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * USCIS I-140 quarterly counts.
 *
 * Ingested by `scripts/ingest_uscis_i140.py` from www.uscis.gov, which serves
 * automated clients. The processing-time figures people usually want sit on
 * egov.uscis.gov behind a Cloudflare challenge and are deliberately not
 * fetched by anything here; they live as a small dated table in
 * `src/lib/processing-times/i140ProcessingTimes.ts` with a test that fails
 * when they age out.
 */

const subtypeValidator = v.object({
  code: v.string(),
  label: v.string(),
  received: v.number(),
  approved: v.number(),
  denied: v.number(),
  pending: v.number(),
});

/**
 * Store a quarter's counts.
 *
 * `internalMutation`, not `mutation`: a public one would be a second entry
 * point letting anyone overwrite figures the public pages cite.
 */
export const storeStats = internalMutation({
  args: {
    sourceFile: v.string(),
    asOfQuarter: v.string(),
    subtypes: v.array(subtypeValidator),
    contentHash: v.string(),
  },
  returns: v.object({
    stored: v.boolean(),
    reason: v.string(),
    subtypes: v.number(),
    totalPending: v.number(),
  }),
  handler: async (ctx, args) => {
    const totalPending = args.subtypes.reduce((sum, s) => sum + s.pending, 0);

    // An ingest that parsed nothing must never replace a good snapshot. The
    // script refuses to write a partial payload; this is the second gate,
    // because the expensive failure is a page quietly losing its numbers.
    if (args.subtypes.length === 0 || totalPending <= 0) {
      return {
        stored: false,
        reason: "payload had no subtypes or no pending petitions",
        subtypes: args.subtypes.length,
        totalPending,
      };
    }

    const duplicate = await ctx.db
      .query("uscisI140Stats")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (duplicate) {
      return {
        stored: false,
        reason: "content unchanged since the last ingest",
        subtypes: args.subtypes.length,
        totalPending,
      };
    }

    await ctx.db.insert("uscisI140Stats", {
      sourceFile: args.sourceFile,
      asOfQuarter: args.asOfQuarter,
      subtypes: args.subtypes,
      computedAt: Date.now(),
      contentHash: args.contentHash,
    });

    return { stored: true, reason: "stored", subtypes: args.subtypes.length, totalPending };
  },
});

/** The newest quarter, or null before the first ingest has run. */
export const getLatest = query({
  args: {},
  returns: v.union(
    v.object({
      sourceFile: v.string(),
      asOfQuarter: v.string(),
      subtypes: v.array(subtypeValidator),
      computedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const row: Doc<"uscisI140Stats"> | null = await ctx.db
      .query("uscisI140Stats")
      .withIndex("by_computed")
      .order("desc")
      .first();

    if (!row) return null;
    return {
      sourceFile: row.sourceFile,
      asOfQuarter: row.asOfQuarter,
      subtypes: row.subtypes,
      computedAt: row.computedAt,
    };
  },
});
