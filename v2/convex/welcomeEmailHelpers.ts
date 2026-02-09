/**
 * Welcome Email Helpers
 *
 * Internal queries used by welcome email actions.
 * Separated because actions can't directly query the database.
 *
 * @module
 */

import { internalQuery } from "./_generated/server";

/**
 * Get all users with email addresses for the welcome blast.
 * Returns display name and email for each user.
 */
export const getAllUsersForBlast = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const results: { email: string; displayName: string }[] = [];

    for (const user of users) {
      if (!user.email || user.deletedAt) continue;

      // Try to get their profile for a better display name
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();

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
