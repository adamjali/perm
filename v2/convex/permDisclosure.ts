import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Derived statistics from DOL's quarterly PERM disclosure files.
 *
 * There is no action here and there cannot be. A single quarterly file is
 * 156 MB compressed and 1.21 GB of XML uncompressed, which no Convex action
 * can download, hold or parse inside its limits. `scripts/ingest_perm_disclosure.py`
 * stream-parses it outside and hands back a few KB of aggregates, which
 * `storeStats` writes.
 *
 * Nothing on this table can identify a case or a person. The source rows carry
 * attorney and point-of-contact emails, phone numbers and street addresses for
 * roughly 112,000 people; the ingest reads five columns, none of them contact
 * fields, and keeps only counts and percentiles.
 */

const cohortValidator = v.object({
  cohortMonth: v.string(),
  decided: v.number(),
  p25: v.union(v.number(), v.null()),
  p50: v.union(v.number(), v.null()),
  p75: v.union(v.number(), v.null()),
  p90: v.union(v.number(), v.null()),
});

const clearanceValidator = v.object({
  month: v.string(),
  decisions: v.number(),
});

const frontierValidator = v.object({
  decisionMonth: v.string(),
  medianFilingMonth: v.string(),
  decisions: v.number(),
});

const stateStatValidator = v.object({
  /** Two-letter worksite state/territory. */
  state: v.string(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  withdrawn: v.number(),
  medianDays: v.union(v.number(), v.null()),
  medianAnnualWage: v.union(v.number(), v.null()),
});

const socStatValidator = v.object({
  code: v.string(),
  title: v.string(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  medianDays: v.union(v.number(), v.null()),
  medianAnnualWage: v.union(v.number(), v.null()),
});

const employerStatValidator = v.object({
  /** As printed in DOL's public disclosure file. */
  name: v.string(),
  total: v.number(),
  certified: v.number(),
  denied: v.number(),
  medianDays: v.union(v.number(), v.null()),
});


/**
 * Store a computed snapshot.
 *
 * `internalMutation`, not `mutation`. A public mutation here would be a second
 * entry point that anyone could call to overwrite the figures the public pages
 * cite, with no way to tell a real ingest from a forged one.
 *
 * Insert-only-on-change, matching `dolProcessingTimes.store`. Re-running the
 * ingest against unchanged DOL files is the normal case (the quarterly file
 * does not move between quarters) and must not append a duplicate row every
 * time the workflow fires.
 */
export const storeStats = internalMutation({
  args: {
    sourceFiles: v.array(v.string()),
    uniqueCases: v.number(),
    cohorts: v.array(cohortValidator),
    clearanceByMonth: v.array(clearanceValidator),
    frontierHistory: v.array(frontierValidator),
    /**
     * The analytical dimensions, added 2026-08-24. Optional so payloads from
     * the previous script version still validate. Aggregate-only by
     * construction: the ingest never lets a row survive its parse loop.
     */
    byState: v.optional(v.array(stateStatValidator)),
    topOccupations: v.optional(v.array(socStatValidator)),
    topEmployers: v.optional(v.array(employerStatValidator)),
    contentHash: v.string(),
  },
  returns: v.object({
    stored: v.boolean(),
    reason: v.string(),
    uniqueCases: v.number(),
    cohorts: v.number(),
  }),
  handler: async (ctx, args) => {
    // An ingest that parsed nothing must never replace a good snapshot. The
    // script already refuses to write an empty payload; this is the second
    // gate, because the expensive failure is a page that silently loses its
    // numbers rather than one that errors.
    if (args.cohorts.length === 0 || args.frontierHistory.length === 0) {
      return {
        stored: false,
        reason: "payload had no cohorts or no frontier history",
        uniqueCases: args.uniqueCases,
        cohorts: args.cohorts.length,
      };
    }

    const duplicate = await ctx.db
      .query("permDisclosureStats")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (duplicate) {
      return {
        stored: false,
        reason: "content unchanged since the last ingest",
        uniqueCases: args.uniqueCases,
        cohorts: args.cohorts.length,
      };
    }

    await ctx.db.insert("permDisclosureStats", {
      sourceFiles: args.sourceFiles,
      uniqueCases: args.uniqueCases,
      cohorts: args.cohorts,
      clearanceByMonth: args.clearanceByMonth,
      frontierHistory: args.frontierHistory,
      computedAt: Date.now(),
      contentHash: args.contentHash,
          byState: args.byState,
      topOccupations: args.topOccupations,
      topEmployers: args.topEmployers,
    });

    return {
      stored: true,
      reason: "stored",
      uniqueCases: args.uniqueCases,
      cohorts: args.cohorts.length,
    };
  },
});

/** The newest snapshot, or null before the first ingest has run. */
export const getLatest = query({
  args: {},
  returns: v.union(
    v.object({
      sourceFiles: v.array(v.string()),
      uniqueCases: v.number(),
      cohorts: v.array(cohortValidator),
      clearanceByMonth: v.array(clearanceValidator),
      frontierHistory: v.array(frontierValidator),
      byState: v.optional(v.array(stateStatValidator)),
      topOccupations: v.optional(v.array(socStatValidator)),
      topEmployers: v.optional(v.array(employerStatValidator)),
      computedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const row: Doc<"permDisclosureStats"> | null = await ctx.db
      .query("permDisclosureStats")
      .withIndex("by_computed")
      .order("desc")
      .first();

    if (!row) return null;

    return {
      sourceFiles: row.sourceFiles,
      uniqueCases: row.uniqueCases,
      cohorts: row.cohorts,
      clearanceByMonth: row.clearanceByMonth,
      frontierHistory: row.frontierHistory,
      byState: row.byState,
      topOccupations: row.topOccupations,
      topEmployers: row.topEmployers,
      computedAt: row.computedAt,
    };
  },
});
