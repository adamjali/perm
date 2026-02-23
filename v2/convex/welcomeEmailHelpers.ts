/**
 * Welcome Email Helpers
 *
 * Internal queries used by welcome email actions.
 * Separated because actions can't directly query the database.
 *
 * @module
 */

import { internalQuery } from "./_generated/server";
import { getVerifiedUserIds } from "./lib/auth";

/**
 * Get all users with verified email addresses for the welcome blast.
 *
 * Filters out: users without email, soft-deleted users, users without
 * a verified auth method (Google or password+OTP), and users whose
 * profile has pending deletion.
 *
 * Returns display name and email for each eligible user.
 */
export const getAllUsersForBlast = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [users, verifiedUserIds] = await Promise.all([
      ctx.db.query("users").collect(),
      getVerifiedUserIds(ctx),
    ]);

    const results: { email: string; displayName: string }[] = [];

    for (const user of users) {
      if (!user.email || user.deletedAt || !verifiedUserIds.has(user._id)) continue;

      // Try to get their profile for a better display name
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();

      // Skip users with pending deletion on their profile
      if (profile?.deletedAt) continue;

      const displayName =
        profile?.fullName || user.name || user.email.split("@")[0] || "there";

      results.push({
        email: user.email,
        displayName,
      });
    }

    return results;
  },
});
