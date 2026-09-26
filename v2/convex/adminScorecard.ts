import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getAdminEmail } from "./lib/admin";
import { extractUserIdFromAction } from "./lib/auth";
import { one as mirrorOne } from "./lib/publicMirror";

/**
 * The private competitor scorecard, for the admin page only.
 *
 * `/api/cron/scorecard` grades our daily sample and a few rival predictions
 * for the same cases, and writes every source's summary to
 * `perm_docs['scorecard_rivals']`. The public scorecard reads a different doc
 * that holds ours alone; this one never renders outside `/admin`.
 *
 * An action because reading Turso is a network call; the admin check mirrors
 * `sendAdminEmail`. Returns the doc's JSON as a string for the client to
 * parse, rather than a validator the size of the summary's shape.
 */
export const get = action({
  args: {},
  returns: v.union(v.null(), v.object({ json: v.string(), computedAt: v.number() })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: Not authenticated");
    const userId = extractUserIdFromAction(identity.subject);
    const user = await ctx.runQuery(internal.admin.getUserEmail, { userId });
    if (!user || user.email !== getAdminEmail()) {
      throw new Error("Unauthorized: Admin access required");
    }
    const row = await mirrorOne(
      "SELECT json, computed_at FROM perm_docs WHERE key = 'scorecard_rivals'",
    );
    if (!row) return null;
    return { json: String(row.json), computedAt: Number(row.computed_at) };
  },
});
