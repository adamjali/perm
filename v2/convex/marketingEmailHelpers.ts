/**
 * Internal query helpers for marketing email sync.
 * Separated from marketingEmail.ts because "use node" files
 * can only contain actions, not queries.
 */

import { internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

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
