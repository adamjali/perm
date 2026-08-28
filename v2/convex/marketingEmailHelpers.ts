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

/**
 * Confirmed, un-unsubscribed product-news opt-ins from anonymous alert
 * subscribers. The sync treats these exactly like active users: their Resend
 * contact is created if missing and protected from orphan removal. The table
 * is small (it grows one row per checkbox tick), so no pagination.
 */
export const listNewsSubscribers = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const out: string[] = [];
    for await (const row of ctx.db.query("newsSubscribers")) {
      if (row.confirmedAt !== undefined && row.unsubscribedAt === undefined) {
        out.push(row.email.toLowerCase());
      }
    }
    return out;
  },
});
