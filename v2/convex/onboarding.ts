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
 * Restart just the product tour (not the full wizard).
 * Keeps onboardingCompletedAt so wizard doesn't re-show.
 */
export const restartTour = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    await ctx.db.patch(profile._id, {
      onboardingStep: "tour_pending",
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
 * Backfill migration: set termsAcceptedAt + reset onboarding for ALL users
 * who haven't completed it. Run once via CLI:
 *   npx convex run onboarding:backfillOnboardingForAllUsers '{}' --prod
 */
export const backfillOnboardingForAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    let termsBackfilled = 0;
    let onboardingReset = 0;

    for (const profile of profiles) {
      const updates: Record<string, unknown> = {};

      // Backfill termsAcceptedAt if missing
      if (!profile.termsAcceptedAt) {
        updates.termsAcceptedAt = Date.now();
        updates.termsVersion = "2026-01-03";
        termsBackfilled++;
      }

      // Reset onboarding if not completed
      if (!profile.onboardingCompletedAt) {
        updates.onboardingStep = "welcome";
        updates.onboardingChecklist = undefined;
        updates.onboardingChecklistDismissed = undefined;
        onboardingReset++;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        await ctx.db.patch(profile._id, updates);
      }
    }

    return {
      totalProfiles: profiles.length,
      termsBackfilled,
      onboardingReset,
    };
  },
});

/**
 * Create a sample case for onboarding.
 * Pre-populates a realistic PERM case filled through Recruitment stage.
 * Called when user completes or skips the onboarding wizard.
 */
export const createSampleCase = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Check if user already has a sample case (idempotent)
    const existingSample = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isSample"), true))
      .first();
    if (existingSample) return existingSample._id;

    const now = Date.now();

    // Build realistic dates relative to today
    // Scenario: PWD completed, recruitment in progress (halfway through PERM)
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0]!;
    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return formatDate(d);
    };
    const daysFromNow = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return formatDate(d);
    };

    const pwdFilingDate = daysAgo(120);
    const pwdDeterminationDate = daysAgo(45);
    const pwdExpirationDate = daysFromNow(320); // ~1 year from determination
    const jobOrderStartDate = daysAgo(25);
    const jobOrderEndDate = daysAgo(5);
    const sundayAdFirstDate = daysAgo(20);
    const sundayAdSecondDate = daysAgo(13);
    const noticeOfFilingStartDate = daysAgo(18);
    const noticeOfFilingEndDate = daysAgo(8);

    const caseId = await ctx.db.insert("cases", {
      userId,
      isSample: true,
      employerName: "Acme Technology Inc.",
      positionTitle: "Senior Software Engineer",
      beneficiaryIdentifier: "Sample Beneficiary",
      caseStatus: "recruitment",
      progressStatus: "working",
      progressStatusOverride: true,
      priorityLevel: "normal",
      isFavorite: false,
      isPinned: false,
      isProfessionalOccupation: true,
      recruitmentApplicantsCount: 3,
      additionalRecruitmentMethods: [
        { method: "Company Website", date: daysAgo(22), description: "Posted on careers page" },
        { method: "Indeed.com", date: daysAgo(20), description: "Online job board posting" },
        { method: "Campus Career Office", date: daysAgo(18), description: "University partnership" },
      ],
      tags: ["sample"],
      documents: [],
      calendarSyncEnabled: true,
      showOnTimeline: true,

      // PWD dates (completed)
      pwdFilingDate,
      pwdDeterminationDate,
      pwdExpirationDate,
      pwdCaseNumber: "P-100-00000-000000",
      pwdWageAmount: 15500000, // $155,000 in cents
      pwdWageLevel: "Level III",

      // Recruitment dates (in progress)
      jobOrderStartDate,
      jobOrderEndDate,
      sundayAdFirstDate,
      sundayAdSecondDate,
      sundayAdNewspaper: "Metro Daily News",
      noticeOfFilingStartDate,
      noticeOfFilingEndDate,

      // Derived recruitment dates
      recruitmentStartDate: jobOrderStartDate,
      recruitmentEndDate: undefined, // Still in progress
      recruitmentWindowCloses: undefined,
      filingWindowOpens: undefined,
      filingWindowCloses: undefined,

      // No ETA 9089 or I-140 yet (not that far along)
      rfiEntries: [],
      rfeEntries: [],

      socCode: "15-1252",
      socTitle: "Software Developers",
      jobOrderState: "CA",

      notes: [
        {
          id: "sample-note-1",
          content: "This is a sample case showing what a PERM case looks like mid-recruitment. Delete it anytime from the case menu.",
          createdAt: now,
          status: "pending" as const,
          category: "internal" as const,
        },
      ],

      createdAt: now,
      updatedAt: now,
    });

    return caseId;
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
