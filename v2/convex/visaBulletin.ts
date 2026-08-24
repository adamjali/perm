import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/**
 * The employment-based visa bulletin series.
 *
 * Ingested by `scripts/ingest_visa_bulletin.py` from the Internet Archive.
 * travel.state.gov refuses automated clients, so this can never hold the
 * current month; every consumer labels its figures with the bulletin month.
 */

const chartValidator = v.any();

/**
 * Upsert a run of bulletins, keyed by the bulletin's own month.
 *
 * Upsert rather than insert-only-on-change, because the archive backfills: a
 * month already stored can later gain a better snapshot, and the series is
 * addressed by month rather than by content.
 */
export const storeBulletins = internalMutation({
  args: {
    bulletins: v.array(
      v.object({
        bulletinMonth: v.string(),
        archivedAt: v.string(),
        sourceUrl: v.string(),
        finalAction: chartValidator,
        datesForFiling: chartValidator,
      }),
    ),
    contentHash: v.string(),
  },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
    skipped: v.number(),
    newest: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // An ingest that parsed almost nothing must not quietly replace a good
    // series. The script refuses below three; this is the second gate.
    if (args.bulletins.length < 3) {
      return { inserted: 0, updated: 0, skipped: args.bulletins.length, newest: null };
    }

    let inserted = 0;
    let updated = 0;
    const now = Date.now();

    for (const b of args.bulletins) {
      const existing = await ctx.db
        .query("visaBulletins")
        .withIndex("by_month", (q) => q.eq("bulletinMonth", b.bulletinMonth))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...b, computedAt: now });
        updated += 1;
      } else {
        await ctx.db.insert("visaBulletins", { ...b, computedAt: now });
        inserted += 1;
      }
    }

    const months = args.bulletins.map((b) => b.bulletinMonth).sort();
    return {
      inserted,
      updated,
      skipped: 0,
      newest: months[months.length - 1] ?? null,
    };
  },
});

/** The whole series, oldest first. Small enough to send in full. */
export const getSeries = query({
  args: {},
  returns: v.array(
    v.object({
      bulletinMonth: v.string(),
      archivedAt: v.string(),
      sourceUrl: v.string(),
      finalAction: chartValidator,
      datesForFiling: chartValidator,
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("visaBulletins").withIndex("by_month").collect();
    return rows
      .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth))
      .map((r) => ({
        bulletinMonth: r.bulletinMonth,
        archivedAt: r.archivedAt,
        sourceUrl: r.sourceUrl,
        finalAction: r.finalAction,
        datesForFiling: r.datesForFiling,
      }));
  },
});
