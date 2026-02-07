/**
 * Onboarding Convex Functions
 *
 * Manages the onboarding wizard, product tour, and getting-started checklist state.
 * State is stored on the userProfiles table (3 fields: onboardingStep, onboardingCompletedAt, onboardingChecklist).
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

/**
 * Get current user's onboarding state.
 * Returns null if not authenticated or no profile exists.
 */
export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) return null;

    return {
      onboardingStep: (profile.onboardingStep as string | undefined) ?? null,
      onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
      onboardingChecklist: profile.onboardingChecklist ?? [],
      termsAcceptedAt: profile.termsAcceptedAt ?? null,
      fullName: profile.fullName ?? null,
    };
  },
});

/**
 * Update onboarding step (wizard/tour progress).
 */
export const updateOnboardingStep = mutation({
  args: {
    step: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    const update: Record<string, unknown> = {
      onboardingStep: args.step,
      updatedAt: Date.now(),
    };

    // Set completedAt when wizard finishes (entering tour or skipping directly to done)
    if (
      (args.step === "tour_pending" || args.step === "tour_completed" || args.step === "done") &&
      !profile.onboardingCompletedAt
    ) {
      update.onboardingCompletedAt = Date.now();
    }

    await ctx.db.patch(profile._id, update);
  },
});

/**
 * Save role selection during onboarding.
 * Updates jobTitle field on the user profile.
 */
export const saveOnboardingRole = mutation({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      jobTitle: args.role,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark a checklist item as complete.
 */
export const completeChecklistItem = mutation({
  args: {
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    const currentItems = profile.onboardingChecklist ?? [];
    // Don't add duplicates, and don't modify if dismissed
    if (currentItems.includes(args.itemId) || currentItems.includes("dismissed")) {
      return;
    }

    await ctx.db.patch(profile._id, {
      onboardingChecklist: [...currentItems, args.itemId],
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reset onboarding state to trigger the wizard again (authenticated).
 */
export const resetOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      onboardingStep: "welcome",
      onboardingCompletedAt: undefined,
      onboardingChecklist: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reset onboarding by email — internal, for CLI testing.
 */
export const resetOnboardingByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Find user by email in users table
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) throw new Error(`No user found for ${args.email}`);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) throw new Error(`No profile found for user ${user._id}`);

    await ctx.db.patch(profile._id, {
      onboardingStep: "welcome",
      onboardingCompletedAt: undefined,
      onboardingChecklist: undefined,
      updatedAt: Date.now(),
    });
    return { success: true, userId: profile.userId };
  },
});

/**
 * Dismiss the entire onboarding checklist.
 */
export const dismissChecklist = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      onboardingChecklist: ["dismissed"],
      onboardingStep: "done",
      updatedAt: Date.now(),
    });
  },
});
