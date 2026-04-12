/**
 * Internal query helpers for marketing email sync.
 * Separated from marketingEmail.ts because "use node" files
 * can only contain actions, not queries.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Page through all users in the users table.
 * Returns email, name, and deletedAt for Resend contact sync.
 */
export const listAllUsers = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx) => {
    const results = await ctx.db.query("users").order("asc").take(500);
    return {
      page: results.map((u) => ({
        email: u.email,
        name: u.name,
        deletedAt: u.deletedAt,
      })),
      isDone: results.length < 500,
      continueCursor: results.length > 0 ? results[results.length - 1]!._id : "",
    };
  },
});
