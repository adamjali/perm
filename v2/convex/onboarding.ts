/**
 * Onboarding Convex Functions
 *
 * Manages the onboarding wizard, product tour, and getting-started checklist state.
 * State is stored on the userProfiles table.
 */

import type { MutationCtx } from "./_generated/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { buildSampleCaseDates } from "./lib/sampleCase";

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

    // An account scheduled for deletion is not onboarded again.
    if (!profile || profile.deletedAt !== undefined) return null;

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
  v.literal("Waiting on my own case"),
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

    // Build PERM-compliant dates relative to today.
    // All dates must pass validateCase() — see convex/lib/perm/validators/.
    const sampleDates = buildSampleCaseDates();

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
        { method: "Company Website", date: sampleDates.additionalMethod1Date, description: "Posted on careers page" },
        { method: "Indeed.com", date: sampleDates.additionalMethod2Date, description: "Online job board posting" },
        { method: "Campus Career Office", date: sampleDates.additionalMethod3Date, description: "University partnership" },
      ],
      tags: ["sample"],
      documents: [],
      calendarSyncEnabled: true,
      showOnTimeline: true,

      // PWD dates (completed)
      pwdFilingDate: sampleDates.pwdFilingDate,
      pwdDeterminationDate: sampleDates.pwdDeterminationDate,
      pwdExpirationDate: sampleDates.pwdExpirationDate,
      pwdCaseNumber: "P-100-00000-000000",
      pwdWageAmount: 155000, // $155,000
      pwdWageLevel: "Level III",

      // Recruitment dates (in progress)
      jobOrderStartDate: sampleDates.jobOrderStartDate,
      jobOrderEndDate: sampleDates.jobOrderEndDate,
      sundayAdFirstDate: sampleDates.sundayAdFirstDate,
      sundayAdSecondDate: sampleDates.sundayAdSecondDate,
      sundayAdNewspaper: "Metro Daily News",
      noticeOfFilingStartDate: sampleDates.noticeOfFilingStartDate,
      noticeOfFilingEndDate: sampleDates.noticeOfFilingEndDate,

      // Derived recruitment dates
      recruitmentStartDate: sampleDates.jobOrderStartDate,
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

// ============================================================================
// Sample Case Migration
// ============================================================================

