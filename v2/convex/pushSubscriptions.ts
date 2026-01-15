/**
 * Push Subscription Queries and Mutations
 *
 * Internal queries and mutations for managing push notification subscriptions.
 * These support the pushNotifications.ts action which uses Node.js runtime.
 *
 * QUERIES:
 * - getUserProfileById: Get user profile for push subscription lookup
 *
 * MUTATIONS:
 * - clearPushSubscription: Clear expired/invalid push subscription
 *
 * @module
 */

import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get current user's push subscription profile info.
 *
 * Used by sendTestPush action to get current user's subscription.
 * Returns userId and profile for authenticated users.
 */
export const getCurrentUserPushProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .unique();

    if (!profile) {
      return null;
    }

    return {
      userId: userId as Id<"users">,
      pushSubscription: profile.pushSubscription,
      pushNotificationsEnabled: profile.pushNotificationsEnabled,
    };
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get user profile by user ID (internal use only).
 *
 * Used by sendPushNotification action to get push subscription.
 * Not exposed to the client API.
 */
export const getUserProfileById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .unique();
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Clear push subscription for a user (internal use only).
 *
 * Called when a push subscription expires or becomes invalid.
 * Removes the subscription and disables push notifications.
 */
export const clearPushSubscription = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        pushSubscription: undefined,
        pushNotificationsEnabled: false,
        updatedAt: Date.now(),
      });
    }
  },
});
