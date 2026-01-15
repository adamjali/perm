/**
 * User Case Order Management
 * Handles custom drag-drop reordering of cases.
 *
 * Features:
 * - Save custom case order with filter snapshot
 * - Retrieve custom case order
 * - Delete custom case order
 * - Apply custom order with smart placement for new cases
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Save custom case order.
 * Stores the ordered array of case IDs along with active filters and base sort method.
 */
export const saveCaseOrder = mutation({
  args: {
    caseIds: v.array(v.id("cases")),
    filters: v.object({
      status: v.optional(v.union(
        v.literal("pwd"),
        v.literal("recruitment"),
        v.literal("eta9089"),
        v.literal("i140"),
        v.literal("closed")
      )),
      progressStatus: v.optional(v.union(
        v.literal("working"),
        v.literal("waiting_intake"),
        v.literal("filed"),
        v.literal("approved"),
        v.literal("under_review"),
        v.literal("rfi_rfe")
      )),
      searchQuery: v.optional(v.string()),
      favoritesOnly: v.optional(v.boolean()),
    }),
    baseSortMethod: v.union(
      v.literal("deadline"),
      v.literal("updated"),
      v.literal("employer"),
      v.literal("status"),
      v.literal("pwdFiled"),
      v.literal("etaFiled"),
      v.literal("i140Filed")
    ),
    baseSortOrder: v.union(v.literal("asc"), v.literal("desc")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    // Check if user already has a custom order
    const existing = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing custom order
      await ctx.db.patch(existing._id, {
        caseIds: args.caseIds,
        filters: args.filters,
        baseSortMethod: args.baseSortMethod,
        baseSortOrder: args.baseSortOrder,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new custom order
      const id = await ctx.db.insert("userCaseOrder", {
        userId,
        caseIds: args.caseIds,
        filters: args.filters,
        baseSortMethod: args.baseSortMethod,
        baseSortOrder: args.baseSortOrder,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }
  },
});

/**
 * Get custom case order for the authenticated user.
 * Returns null if no custom order exists or user is not authenticated.
 * Gracefully handles unauthenticated state (sign-out transitions, token refresh).
 */
export const getCaseOrder = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null; // Graceful handling for auth transitions
    }

    const customOrder = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    return customOrder;
  },
});

/**
 * Delete custom case order.
 * Resets to default sorting.
 */
export const deleteCaseOrder = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});
