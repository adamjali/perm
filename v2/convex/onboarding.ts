/**
 * Onboarding Convex Functions
 *
 * Manages the onboarding wizard, product tour, and getting-started checklist state.
 * State is stored on the userProfiles table.
 */

import type { MutationCtx } from "./_generated/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

/** Lookup the authenticated user's profile. Throws if not found. */
async function requireProfile(ctx: MutationCtx) {
  const userId = await getCurrentUserId(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) throw new Error("User profile not found");
  return profile;
}

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
      onboardingChecklistDismissed: profile.onboardingChecklistDismissed ?? false,
      termsAcceptedAt: profile.termsAcceptedAt ?? null,
      fullName: profile.fullName ?? null,
    };
  },
});

/**
 * Update onboarding step (wizard/tour progress).
 */
/** Valid onboarding step values */
const onboardingStepValidator = v.union(
  v.literal("welcome"),
  v.literal("role"),
  v.literal("create_case"),
  v.literal("value_preview"),
  v.literal("completion"),
  v.literal("tour_pending"),
  v.literal("tour_completed"),
  v.literal("done")
);

/** Valid checklist item IDs */
const checklistItemValidator = v.union(
  v.literal("create_case"),
  v.literal("add_dates"),
  v.literal("explore_calendar"),
  v.literal("setup_notifications"),
  v.literal("try_assistant"),
  v.literal("explore_settings")
);

/** Valid role values */
const roleValidator = v.union(
  v.literal("Immigration Attorney"),
  v.literal("Paralegal"),
  v.literal("HR Professional"),
  v.literal("Employer/Petitioner"),
  v.literal("Other")
);

export const updateOnboardingStep = mutation({
  args: {
    step: onboardingStepValidator,
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);

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
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);

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
    itemId: checklistItemValidator,
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);

    if (profile.onboardingChecklistDismissed) return;

    const currentItems = profile.onboardingChecklist ?? [];
    if (currentItems.includes(args.itemId)) return;

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
    const profile = await requireProfile(ctx);

    await ctx.db.patch(profile._id, {
      onboardingStep: "welcome",
      onboardingCompletedAt: undefined,
      onboardingChecklist: undefined,
      onboardingChecklistDismissed: undefined,
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
      onboardingChecklistDismissed: undefined,
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
    const profile = await requireProfile(ctx);

    await ctx.db.patch(profile._id, {
      onboardingChecklistDismissed: true,
      onboardingStep: "done",
      updatedAt: Date.now(),
    });
  },
});
