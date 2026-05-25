/**
 * Internal query helpers for marketing email sync.
 * Separated from marketingEmail.ts because "use node" files
 * can only contain actions, not queries.
 */

import { internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const listAllUsers = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("users").order("asc").paginate(paginationOpts);
    return {
      page: result.page.map((u) => ({
        email: u.email,
        name: u.name,
        deletedAt: u.deletedAt,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Resolve the caller's own email from their user record.
 *
 * The marketing-subscription actions run in a "use node" runtime and so can't
 * touch ctx.db directly; they call this to derive the authenticated user's
 * email server-side rather than trusting a client-supplied address (IDOR).
 * Returns null if the user has no email (e.g. password auth before backfill)
 * or the user record is missing/soft-deleted.
 */
export const getUserEmailById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<string | null> => {
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) return null;
    return user.email ?? null;
  },
});
