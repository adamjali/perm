/**
 * Data Migration Functions for PERM Tracker
 * ==========================================
 *
 * This file contains migrations for:
 * 1. ID Resolution - Resolving legacy PostgreSQL UUIDs to Convex IDs
 * 2. Legacy Field Cleanup - Removing legacy fields after verification
 *
 * Usage:
 *   # Run ID resolution (after import)
 *   npx convex run migrations:resolveUserIds
 *
 *   # Clear legacy fields (after verification)
 *   npx convex run migrations:clearLegacyFields
 *
 *   # Get migration stats
 *   npx convex run migrations:getMigrationStats
 *
 * @see scripts/migration/README.md for full migration guide
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// Helper: Get Table Count (for verification)
// ============================================================================

/**
 * Get the count of documents in a table
 * Used by import script for verification
 */
export const getTableCount = query({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    switch (args.table) {
      case "userProfiles":
        return (await ctx.db.query("userProfiles").collect()).length;
      case "cases":
        return (await ctx.db.query("cases").collect()).length;
      case "users":
        return (await ctx.db.query("users").collect()).length;
      default:
        return 0;
    }
  },
});

/**
 * Get migration statistics
 * Shows how many records need migration vs completed
 */
export const getMigrationStats = query({
  args: {},
  handler: async (ctx) => {
    // Count cases with legacyUserId (need migration)
    const casesWithLegacyUserId = await ctx.db
      .query("cases")
      .withIndex("by_legacy_user_id")
      .filter((q) => q.neq(q.field("legacyUserId"), undefined))
      .collect();

    // Count cases without userId (not yet resolved)
    const allCases = await ctx.db.query("cases").collect();
    const casesWithoutUserId = allCases.filter((c) => !c.userId);

    // Count userProfiles with legacyId
    const profilesWithLegacyId = await ctx.db
      .query("userProfiles")
      .withIndex("by_legacy_id")
      .filter((q) => q.neq(q.field("legacyId"), undefined))
      .collect();

    return {
      cases: {
        total: allCases.length,
        withLegacyUserId: casesWithLegacyUserId.length,
        withoutUserId: casesWithoutUserId.length,
        needsResolution: casesWithLegacyUserId.filter((c) => !c.userId).length,
      },
      userProfiles: {
        total: (await ctx.db.query("userProfiles").collect()).length,
        withLegacyId: profilesWithLegacyId.length,
      },
    };
  },
});

// ============================================================================
// Migration: Resolve User IDs
// ============================================================================

/**
 * Resolve legacyUserId on cases to actual Convex userId
 *
 * Strategy:
 * 1. Look up userProfile by legacyId (matching legacy user UUID)
 * 2. Get the userId from the userProfile
 * 3. Set userId on the case
 *
 * Processes in batches of 100 to avoid transaction limits.
 * Run multiple times until stats show 0 needsResolution.
 */
export const resolveUserIds = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    let resolved = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get cases with legacyUserId that don't have userId resolved
    const casesToProcess = await ctx.db
      .query("cases")
      .withIndex("by_legacy_user_id")
      .filter((q) => q.neq(q.field("legacyUserId"), undefined))
      .take(batchSize);

    for (const caseDoc of casesToProcess) {
      // Skip if already has userId
      if (caseDoc.userId) {
        skipped++;
        continue;
      }

      const legacyUserId = caseDoc.legacyUserId;
      if (!legacyUserId) {
        skipped++;
        continue;
      }

      // Find the userProfile with matching legacyId
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", legacyUserId))
        .first();

      if (!userProfile) {
        errors.push(`Case ${caseDoc._id}: No userProfile found for legacyUserId ${legacyUserId}`);
        continue;
      }

      // Update the case with resolved userId
      await ctx.db.patch(caseDoc._id, {
        userId: userProfile.userId,
      });
      resolved++;
    }

    return {
      processed: casesToProcess.length,
      resolved,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message:
        resolved > 0
          ? `Resolved ${resolved} case(s). Run again to process more.`
          : "No cases needed resolution in this batch.",
    };
  },
});

// ============================================================================
// Migration: Clear Legacy Fields
// ============================================================================

/**
 * Clear legacy fields from userProfiles after verification
 *
 * WARNING: Only run after verifying migration success!
 */
export const clearLegacyFieldsFromProfiles = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    let cleared = 0;

    // Get profiles with legacyId
    const profilesToProcess = await ctx.db
      .query("userProfiles")
      .withIndex("by_legacy_id")
      .filter((q) => q.neq(q.field("legacyId"), undefined))
      .take(batchSize);

    for (const profile of profilesToProcess) {
      await ctx.db.patch(profile._id, {
        legacyId: undefined,
        legacyAuthId: undefined,
      });
      cleared++;
    }

    return {
      processed: profilesToProcess.length,
      cleared,
      message:
        cleared > 0
          ? `Cleared ${cleared} profile(s). Run again to process more.`
          : "No profiles had legacy fields to clear.",
    };
  },
});

/**
 * Clear legacy fields from cases after verification
 *
 * WARNING: Only run after verifying migration success!
 */
export const clearLegacyFieldsFromCases = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    let cleared = 0;

    // Get cases with legacyId
    const casesToProcess = await ctx.db
      .query("cases")
      .withIndex("by_legacy_id")
      .filter((q) => q.neq(q.field("legacyId"), undefined))
      .take(batchSize);

    for (const caseDoc of casesToProcess) {
      await ctx.db.patch(caseDoc._id, {
        legacyId: undefined,
        legacyUserId: undefined,
      });
      cleared++;
    }

    return {
      processed: casesToProcess.length,
      cleared,
      message:
        cleared > 0
          ? `Cleared ${cleared} case(s). Run again to process more.`
          : "No cases had legacy fields to clear.",
    };
  },
});

/**
 * Clear all legacy fields (runs both profile and case cleanup)
 *
 * WARNING: Only run after verifying migration success!
 */
export const clearLegacyFields = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    // Clear from profiles first
    const profilesWithLegacy = await ctx.db
      .query("userProfiles")
      .withIndex("by_legacy_id")
      .filter((q) => q.neq(q.field("legacyId"), undefined))
      .take(batchSize);

    let profilesCleared = 0;
    for (const profile of profilesWithLegacy) {
      await ctx.db.patch(profile._id, {
        legacyId: undefined,
        legacyAuthId: undefined,
      });
      profilesCleared++;
    }

    // Clear from cases
    const casesWithLegacy = await ctx.db
      .query("cases")
      .withIndex("by_legacy_id")
      .filter((q) => q.neq(q.field("legacyId"), undefined))
      .take(batchSize);

    let casesCleared = 0;
    for (const caseDoc of casesWithLegacy) {
      await ctx.db.patch(caseDoc._id, {
        legacyId: undefined,
        legacyUserId: undefined,
      });
      casesCleared++;
    }

    return {
      profilesCleared,
      casesCleared,
      message: `Cleared ${profilesCleared} profile(s) and ${casesCleared} case(s). Run again to process more.`,
    };
  },
});

// ============================================================================
// Verification Queries (used by 04_verify_migration.ts)
// ============================================================================

/**
 * Get a case by its legacy PostgreSQL UUID
 * Used by verification script to compare source and target data
 */
export const getCaseByLegacyId = query({
  args: { legacyId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();
  },
});

/**
 * Get a userProfile by its Convex userId
 * Used by verification script to verify foreign key references
 */
export const getUserProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get a userProfile by its legacy PostgreSQL UUID
 * Used by verification script to compare source and target data
 */
export const getUserProfileByLegacyId = query({
  args: { legacyId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();
  },
});

// ============================================================================
// Migration: Import Users and Profiles (v1 → v2)
// ============================================================================

/**
 * Import a single user and their profile from v1 data.
 *
 * This mutation:
 * 1. Creates a user in the users table (if not exists by email)
 * 2. Creates a userProfile linked to that user
 *
 * This is needed because `convex import` cannot create users - they're
 * managed by @convex-dev/auth. We need to create users first so that
 * userProfiles can reference them with valid userId.
 *
 * Usage:
 *   npx convex run migrations:importUserWithProfile '{"email": "...", "profile": {...}}'
 */
export const importUserWithProfile = mutation({
  args: {
    // User fields
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    // Profile fields (from transformed userProfiles.jsonl)
    profile: v.object({
      legacyId: v.optional(v.string()),
      legacyAuthId: v.optional(v.string()),
      fullName: v.optional(v.string()),
      jobTitle: v.optional(v.string()),
      company: v.optional(v.string()),
      profilePhotoUrl: v.optional(v.string()),
      userType: v.union(
        v.literal("individual"),
        v.literal("firm_admin"),
        v.literal("firm_member")
      ),
      firmName: v.optional(v.string()),
      emailNotificationsEnabled: v.boolean(),
      smsNotificationsEnabled: v.boolean(),
      pushNotificationsEnabled: v.boolean(),
      urgentDeadlineDays: v.number(),
      reminderDaysBefore: v.array(v.number()),
      emailDeadlineReminders: v.boolean(),
      emailStatusUpdates: v.boolean(),
      emailRfeAlerts: v.boolean(),
      preferredNotificationEmail: v.union(
        v.literal("signup"),
        v.literal("google"),
        v.literal("both")
      ),
      quietHoursEnabled: v.boolean(),
      quietHoursStart: v.optional(v.string()),
      quietHoursEnd: v.optional(v.string()),
      timezone: v.string(),
      calendarSyncEnabled: v.boolean(),
      calendarSyncPwd: v.boolean(),
      calendarSyncEta9089: v.boolean(),
      calendarSyncI140: v.boolean(),
      calendarSyncRfe: v.boolean(),
      calendarSyncRfi: v.boolean(),
      calendarSyncRecruitment: v.boolean(),
      calendarSyncFilingWindow: v.boolean(),
      googleEmail: v.optional(v.string()),
      googleRefreshToken: v.optional(v.string()),
      googleAccessToken: v.optional(v.string()),
      googleTokenExpiry: v.optional(v.number()),
      googleScopes: v.optional(v.array(v.string())),
      googleCalendarConnected: v.boolean(),
      gmailConnected: v.boolean(),
      casesSortBy: v.string(),
      casesSortOrder: v.union(v.literal("asc"), v.literal("desc")),
      casesPerPage: v.number(),
      darkModeEnabled: v.boolean(),
      privacyModeEnabled: v.optional(v.boolean()),
      autoDeadlineEnforcementEnabled: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // 1. Check if user already exists by email
    let existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    let userId = existingUser?._id;

    // 2. Create user if not exists
    if (!userId) {
      userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name ?? args.profile.fullName,
        image: args.image ?? args.profile.profilePhotoUrl,
        emailVerificationTime: Date.now(), // Mark as verified (migrated user)
      });
    }

    // 3. Check if profile already exists for this user
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId!))
      .first();

    // 4. Also check by legacyId to prevent duplicates
    let profileByLegacyId = null;
    if (args.profile.legacyId) {
      profileByLegacyId = await ctx.db
        .query("userProfiles")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.profile.legacyId!))
        .first();
    }

    if (existingProfile || profileByLegacyId) {
      // Profile already exists, return the existing one
      return {
        userId,
        profileId: existingProfile?._id ?? profileByLegacyId?._id,
        created: false,
        message: "Profile already exists",
      };
    }

    // 5. Create new profile
    const profileId = await ctx.db.insert("userProfiles", {
      userId: userId!,
      // Legacy tracking
      legacyId: args.profile.legacyId,
      legacyAuthId: args.profile.legacyAuthId,
      // Profile section
      fullName: args.profile.fullName,
      jobTitle: args.profile.jobTitle,
      company: args.profile.company,
      profilePhotoUrl: args.profile.profilePhotoUrl,
      // Organization
      userType: args.profile.userType,
      firmName: args.profile.firmName,
      // Notification settings
      emailNotificationsEnabled: args.profile.emailNotificationsEnabled,
      smsNotificationsEnabled: args.profile.smsNotificationsEnabled,
      pushNotificationsEnabled: args.profile.pushNotificationsEnabled,
      urgentDeadlineDays: args.profile.urgentDeadlineDays,
      reminderDaysBefore: args.profile.reminderDaysBefore,
      // Email preferences
      emailDeadlineReminders: args.profile.emailDeadlineReminders,
      emailStatusUpdates: args.profile.emailStatusUpdates,
      emailRfeAlerts: args.profile.emailRfeAlerts,
      preferredNotificationEmail: args.profile.preferredNotificationEmail,
      // Quiet hours
      quietHoursEnabled: args.profile.quietHoursEnabled,
      quietHoursStart: args.profile.quietHoursStart,
      quietHoursEnd: args.profile.quietHoursEnd,
      timezone: args.profile.timezone,
      // Calendar sync
      calendarSyncEnabled: args.profile.calendarSyncEnabled,
      calendarSyncPwd: args.profile.calendarSyncPwd,
      calendarSyncEta9089: args.profile.calendarSyncEta9089,
      calendarSyncI140: args.profile.calendarSyncI140,
      calendarSyncRfe: args.profile.calendarSyncRfe,
      calendarSyncRfi: args.profile.calendarSyncRfi,
      calendarSyncRecruitment: args.profile.calendarSyncRecruitment,
      calendarSyncFilingWindow: args.profile.calendarSyncFilingWindow,
      // Google OAuth
      googleEmail: args.profile.googleEmail,
      googleRefreshToken: args.profile.googleRefreshToken,
      googleAccessToken: args.profile.googleAccessToken,
      googleTokenExpiry: args.profile.googleTokenExpiry,
      googleScopes: args.profile.googleScopes,
      googleCalendarConnected: args.profile.googleCalendarConnected,
      gmailConnected: args.profile.gmailConnected,
      // UI preferences
      casesSortBy: args.profile.casesSortBy,
      casesSortOrder: args.profile.casesSortOrder,
      casesPerPage: args.profile.casesPerPage,
      dismissedDeadlines: [],
      darkModeEnabled: args.profile.darkModeEnabled,
      privacyModeEnabled: args.profile.privacyModeEnabled,
      // Deadline Enforcement
      autoDeadlineEnforcementEnabled: args.profile.autoDeadlineEnforcementEnabled,
      // Timestamps (use original timestamps from v1)
      createdAt: args.profile.createdAt,
      updatedAt: args.profile.updatedAt,
    });

    return {
      userId,
      profileId,
      created: true,
      message: "User and profile created successfully",
    };
  },
});

/**
 * Batch import multiple users and profiles.
 * Processes up to 10 users per call to stay within transaction limits.
 *
 * Usage:
 *   npx convex run migrations:importUsersWithProfiles '{"users": [...]}'
 */
// ============================================================================
// Migration: Import Cases with User Resolution
// ============================================================================

/**
 * Case data structure for import (from transformed cases.jsonl)
 */
const importCaseArgs = v.object({
  legacyId: v.optional(v.string()),
  legacyUserId: v.optional(v.string()),
  caseNumber: v.optional(v.string()),
  employerName: v.string(),
  beneficiaryIdentifier: v.string(),
  positionTitle: v.string(),
  caseStatus: v.union(
    v.literal("pwd"),
    v.literal("recruitment"),
    v.literal("eta9089"),
    v.literal("i140"),
    v.literal("closed")
  ),
  progressStatus: v.union(
    v.literal("working"),
    v.literal("waiting_intake"),
    v.literal("filed"),
    v.literal("approved"),
    v.literal("under_review"),
    v.literal("rfi_rfe")
  ),
  // PWD phase
  pwdFilingDate: v.optional(v.string()),
  pwdDeterminationDate: v.optional(v.string()),
  pwdExpirationDate: v.optional(v.string()),
  // Recruitment
  jobOrderStartDate: v.optional(v.string()),
  jobOrderEndDate: v.optional(v.string()),
  sundayAdFirstDate: v.optional(v.string()),
  sundayAdSecondDate: v.optional(v.string()),
  sundayAdNewspaper: v.optional(v.string()),
  additionalRecruitmentMethods: v.array(
    v.object({
      method: v.string(),
      date: v.string(),
      description: v.optional(v.string()),
    })
  ),
  isProfessionalOccupation: v.boolean(),
  recruitmentApplicantsCount: v.number(),
  recruitmentSummaryCustom: v.optional(v.string()),
  noticeOfFilingStartDate: v.optional(v.string()),
  noticeOfFilingEndDate: v.optional(v.string()),
  // ETA 9089
  eta9089FilingDate: v.optional(v.string()),
  eta9089CertificationDate: v.optional(v.string()),
  eta9089ExpirationDate: v.optional(v.string()),
  // RFI/RFE entries
  rfiEntries: v.optional(v.array(
    v.object({
      id: v.string(),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      notes: v.optional(v.string()),
      receivedDate: v.string(),
      responseDueDate: v.string(),
      responseSubmittedDate: v.optional(v.string()),
      createdAt: v.number(),
    })
  )),
  rfeEntries: v.optional(v.array(
    v.object({
      id: v.string(),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      notes: v.optional(v.string()),
      receivedDate: v.string(),
      responseDueDate: v.string(),
      responseSubmittedDate: v.optional(v.string()),
      createdAt: v.number(),
    })
  )),
  // I-140
  i140FilingDate: v.optional(v.string()),
  i140ApprovalDate: v.optional(v.string()),
  // Organization
  priorityLevel: v.union(
    v.literal("low"),
    v.literal("normal"),
    v.literal("high"),
    v.literal("urgent")
  ),
  isFavorite: v.boolean(),
  isPinned: v.optional(v.boolean()),
  notes: v.optional(
    v.array(
      v.object({
        id: v.string(),
        content: v.string(),
        createdAt: v.number(),
        status: v.union(
          v.literal("pending"),
          v.literal("done"),
          v.literal("deleted")
        ),
      })
    )
  ),
  tags: v.array(v.string()),
  // Accept any calendar event IDs (we'll filter to supported fields in handler)
  calendarEventIds: v.optional(v.record(v.string(), v.string())),
  calendarSyncEnabled: v.boolean(),
  showOnTimeline: v.optional(v.boolean()),
  documents: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      url: v.string(),
      mimeType: v.string(),
      size: v.number(),
      uploadedAt: v.number(),
    })
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Import a batch of cases, resolving legacyUserId to Convex userId.
 *
 * Strategy:
 * 1. Look up userProfile by legacyId (which equals case.legacyUserId)
 * 2. Get the userId from that userProfile
 * 3. Insert case with resolved userId
 *
 * Processes up to 10 cases per call to stay within transaction limits.
 */
export const importCasesWithUserResolution = mutation({
  args: {
    cases: v.array(importCaseArgs),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const caseData of args.cases) {
      try {
        // 1. Check if case already exists by legacyId
        if (caseData.legacyId) {
          const existingCase = await ctx.db
            .query("cases")
            .withIndex("by_legacy_id", (q) => q.eq("legacyId", caseData.legacyId!))
            .first();

          if (existingCase) {
            skipped++;
            continue;
          }
        }

        // 2. Resolve userId from legacyUserId
        if (!caseData.legacyUserId) {
          errors.push(`Case ${caseData.legacyId || 'unknown'}: Missing legacyUserId`);
          continue;
        }

        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_legacy_id", (q) => q.eq("legacyId", caseData.legacyUserId!))
          .first();

        if (!userProfile) {
          errors.push(`Case ${caseData.legacyId || 'unknown'}: No userProfile found for legacyUserId ${caseData.legacyUserId}`);
          continue;
        }

        const userId = userProfile.userId;

        // 3. Transform calendarEventIds to match schema
        // v1 used eta9089_filing, v2 uses eta9089_filing_window
        // Also filter out unsupported fields like recruitment_expiration, eta9089_filing_window_opens
        let transformedCalendarEventIds: {
          pwd_expiration?: string;
          eta9089_filing_window?: string;
          eta9089_expiration?: string;
          i140_filing_deadline?: string;
          rfi_due?: string;
          rfe_due?: string;
          recruitment_end?: string;
        } | undefined = undefined;

        if (caseData.calendarEventIds && Object.keys(caseData.calendarEventIds).length > 0) {
          const source = caseData.calendarEventIds as Record<string, string | undefined>;
          // Only extract supported fields, mapping eta9089_filing → eta9089_filing_window
          const result: {
            pwd_expiration?: string;
            eta9089_filing_window?: string;
            eta9089_expiration?: string;
            i140_filing_deadline?: string;
            rfi_due?: string;
            rfe_due?: string;
            recruitment_end?: string;
          } = {};
          if (source.pwd_expiration) result.pwd_expiration = source.pwd_expiration;
          if (source.eta9089_filing) result.eta9089_filing_window = source.eta9089_filing;
          else if (source.eta9089_filing_window) result.eta9089_filing_window = source.eta9089_filing_window;
          if (source.eta9089_expiration) result.eta9089_expiration = source.eta9089_expiration;
          if (source.i140_filing_deadline) result.i140_filing_deadline = source.i140_filing_deadline;
          if (source.rfi_due) result.rfi_due = source.rfi_due;
          if (source.rfe_due) result.rfe_due = source.rfe_due;
          if (source.recruitment_end) result.recruitment_end = source.recruitment_end;
          // Only set if we have any valid fields
          if (Object.keys(result).length > 0) {
            transformedCalendarEventIds = result;
          }
        }

        // 4. Insert case with resolved userId
        await ctx.db.insert("cases", {
          userId,
          legacyId: caseData.legacyId,
          legacyUserId: caseData.legacyUserId,
          caseNumber: caseData.caseNumber,
          employerName: caseData.employerName,
          beneficiaryIdentifier: caseData.beneficiaryIdentifier,
          positionTitle: caseData.positionTitle,
          caseStatus: caseData.caseStatus,
          progressStatus: caseData.progressStatus,
          // PWD
          pwdFilingDate: caseData.pwdFilingDate,
          pwdDeterminationDate: caseData.pwdDeterminationDate,
          pwdExpirationDate: caseData.pwdExpirationDate,
          // Recruitment
          jobOrderStartDate: caseData.jobOrderStartDate,
          jobOrderEndDate: caseData.jobOrderEndDate,
          sundayAdFirstDate: caseData.sundayAdFirstDate,
          sundayAdSecondDate: caseData.sundayAdSecondDate,
          sundayAdNewspaper: caseData.sundayAdNewspaper,
          additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
          isProfessionalOccupation: caseData.isProfessionalOccupation,
          recruitmentApplicantsCount: caseData.recruitmentApplicantsCount,
          recruitmentSummaryCustom: caseData.recruitmentSummaryCustom,
          noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
          noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
          // ETA 9089
          eta9089FilingDate: caseData.eta9089FilingDate,
          eta9089CertificationDate: caseData.eta9089CertificationDate,
          eta9089ExpirationDate: caseData.eta9089ExpirationDate,
          // RFI/RFE
          rfiEntries: caseData.rfiEntries ?? [],
          rfeEntries: caseData.rfeEntries ?? [],
          // I-140
          i140FilingDate: caseData.i140FilingDate,
          i140ApprovalDate: caseData.i140ApprovalDate,
          // Organization
          priorityLevel: caseData.priorityLevel,
          isFavorite: caseData.isFavorite,
          isPinned: caseData.isPinned,
          notes: caseData.notes,
          tags: caseData.tags,
          calendarEventIds: transformedCalendarEventIds,
          calendarSyncEnabled: caseData.calendarSyncEnabled,
          showOnTimeline: caseData.showOnTimeline ?? true,
          documents: caseData.documents,
          // Timestamps
          createdAt: caseData.createdAt,
          updatedAt: caseData.updatedAt,
        });

        created++;
      } catch (error) {
        const errorMsg = error instanceof Error
          ? error.message + (error.stack ? `\n${error.stack.slice(0, 200)}` : '')
          : String(error);
        errors.push(`Case ${caseData.legacyId || 'unknown'}: ${errorMsg}`);
      }
    }

    return {
      processed: args.cases.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${created} case(s), skipped ${skipped} existing.`,
    };
  },
});

export const importUsersWithProfiles = mutation({
  args: {
    users: v.array(v.object({
      email: v.string(),
      name: v.optional(v.string()),
      profile: v.object({
        legacyId: v.optional(v.string()),
        legacyAuthId: v.optional(v.string()),
        fullName: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        company: v.optional(v.string()),
        profilePhotoUrl: v.optional(v.string()),
        userType: v.union(
          v.literal("individual"),
          v.literal("firm_admin"),
          v.literal("firm_member")
        ),
        firmName: v.optional(v.string()),
        emailNotificationsEnabled: v.boolean(),
        smsNotificationsEnabled: v.boolean(),
        pushNotificationsEnabled: v.boolean(),
        urgentDeadlineDays: v.number(),
        reminderDaysBefore: v.array(v.number()),
        emailDeadlineReminders: v.boolean(),
        emailStatusUpdates: v.boolean(),
        emailRfeAlerts: v.boolean(),
        preferredNotificationEmail: v.union(
          v.literal("signup"),
          v.literal("google"),
          v.literal("both")
        ),
        quietHoursEnabled: v.boolean(),
        quietHoursStart: v.optional(v.string()),
        quietHoursEnd: v.optional(v.string()),
        timezone: v.string(),
        calendarSyncEnabled: v.boolean(),
        calendarSyncPwd: v.boolean(),
        calendarSyncEta9089: v.boolean(),
        calendarSyncI140: v.boolean(),
        calendarSyncRfe: v.boolean(),
        calendarSyncRfi: v.boolean(),
        calendarSyncRecruitment: v.boolean(),
        calendarSyncFilingWindow: v.boolean(),
        googleEmail: v.optional(v.string()),
        googleRefreshToken: v.optional(v.string()),
        googleAccessToken: v.optional(v.string()),
        googleTokenExpiry: v.optional(v.number()),
        googleScopes: v.optional(v.array(v.string())),
        googleCalendarConnected: v.boolean(),
        gmailConnected: v.boolean(),
        casesSortBy: v.string(),
        casesSortOrder: v.union(v.literal("asc"), v.literal("desc")),
        casesPerPage: v.number(),
        darkModeEnabled: v.boolean(),
        privacyModeEnabled: v.optional(v.boolean()),
        autoDeadlineEnforcementEnabled: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    })),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const userData of args.users) {
      try {
        // 1. Check/Create user
        let existingUser = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", userData.email))
          .first();

        let userId = existingUser?._id;

        if (!userId) {
          userId = await ctx.db.insert("users", {
            email: userData.email,
            name: userData.name ?? userData.profile.fullName,
            emailVerificationTime: Date.now(),
          });
        }

        // 2. Check if profile exists
        const existingProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", userId!))
          .first();

        if (existingProfile) {
          skipped++;
          continue;
        }

        // Also check by legacyId
        if (userData.profile.legacyId) {
          const profileByLegacyId = await ctx.db
            .query("userProfiles")
            .withIndex("by_legacy_id", (q) => q.eq("legacyId", userData.profile.legacyId!))
            .first();

          if (profileByLegacyId) {
            skipped++;
            continue;
          }
        }

        // 3. Create profile
        await ctx.db.insert("userProfiles", {
          userId: userId!,
          legacyId: userData.profile.legacyId,
          legacyAuthId: userData.profile.legacyAuthId,
          fullName: userData.profile.fullName,
          jobTitle: userData.profile.jobTitle,
          company: userData.profile.company,
          profilePhotoUrl: userData.profile.profilePhotoUrl,
          userType: userData.profile.userType,
          firmName: userData.profile.firmName,
          emailNotificationsEnabled: userData.profile.emailNotificationsEnabled,
          smsNotificationsEnabled: userData.profile.smsNotificationsEnabled,
          pushNotificationsEnabled: userData.profile.pushNotificationsEnabled,
          urgentDeadlineDays: userData.profile.urgentDeadlineDays,
          reminderDaysBefore: userData.profile.reminderDaysBefore,
          emailDeadlineReminders: userData.profile.emailDeadlineReminders,
          emailStatusUpdates: userData.profile.emailStatusUpdates,
          emailRfeAlerts: userData.profile.emailRfeAlerts,
          preferredNotificationEmail: userData.profile.preferredNotificationEmail,
          quietHoursEnabled: userData.profile.quietHoursEnabled,
          quietHoursStart: userData.profile.quietHoursStart,
          quietHoursEnd: userData.profile.quietHoursEnd,
          timezone: userData.profile.timezone,
          calendarSyncEnabled: userData.profile.calendarSyncEnabled,
          calendarSyncPwd: userData.profile.calendarSyncPwd,
          calendarSyncEta9089: userData.profile.calendarSyncEta9089,
          calendarSyncI140: userData.profile.calendarSyncI140,
          calendarSyncRfe: userData.profile.calendarSyncRfe,
          calendarSyncRfi: userData.profile.calendarSyncRfi,
          calendarSyncRecruitment: userData.profile.calendarSyncRecruitment,
          calendarSyncFilingWindow: userData.profile.calendarSyncFilingWindow,
          googleEmail: userData.profile.googleEmail,
          googleRefreshToken: userData.profile.googleRefreshToken,
          googleAccessToken: userData.profile.googleAccessToken,
          googleTokenExpiry: userData.profile.googleTokenExpiry,
          googleScopes: userData.profile.googleScopes,
          googleCalendarConnected: userData.profile.googleCalendarConnected,
          gmailConnected: userData.profile.gmailConnected,
          casesSortBy: userData.profile.casesSortBy,
          casesSortOrder: userData.profile.casesSortOrder,
          casesPerPage: userData.profile.casesPerPage,
          dismissedDeadlines: [],
          darkModeEnabled: userData.profile.darkModeEnabled,
          privacyModeEnabled: userData.profile.privacyModeEnabled,
          autoDeadlineEnforcementEnabled: userData.profile.autoDeadlineEnforcementEnabled,
          createdAt: userData.profile.createdAt,
          updatedAt: userData.profile.updatedAt,
        });

        created++;
      } catch (error) {
        errors.push(`${userData.email}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      processed: args.users.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${created} profile(s), skipped ${skipped} existing.`,
    };
  },
});

// ============================================================================
// Fix Google Refresh Token Migration
// ============================================================================

/**
 * Fix Google refresh token for a specific user by legacy ID.
 * Use this if the transformation didn't properly migrate the refresh token.
 */
export const fixGoogleRefreshToken = mutation({
  args: {
    legacyId: v.string(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (!profile) {
      return { success: false, message: `No userProfile found for legacyId: ${args.legacyId}` };
    }

    await ctx.db.patch(profile._id, {
      googleRefreshToken: args.refreshToken,
    });

    return { success: true, message: `Updated googleRefreshToken for user with legacyId: ${args.legacyId}` };
  },
});

// ============================================================================
// Derived Fields Diagnostics and Backfill
// ============================================================================

import { calculateDerivedDates } from "./lib/derivedCalculations";

/**
 * Check which cases are missing derived fields (recruitmentStartDate, filingWindowOpens, etc.)
 * Use this to diagnose post-migration data issues.
 */
export const checkDerivedFieldsStatus = query({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query("cases").collect();

    let missingDerivedFields = 0;
    let hasDerivedFields = 0;
    let noDatesForCalculation = 0;
    const sampleMissing: Array<{ id: string; employer: string; hasSourceDates: boolean }> = [];

    for (const c of cases) {
      // Check if case has source dates that could produce derived dates
      const hasSourceDates = !!(
        c.sundayAdFirstDate ||
        c.jobOrderStartDate ||
        c.noticeOfFilingStartDate
      );

      // Check if derived fields are populated
      const hasDerived = !!(c.recruitmentStartDate || c.filingWindowOpens);

      if (hasDerived) {
        hasDerivedFields++;
      } else if (hasSourceDates) {
        missingDerivedFields++;
        if (sampleMissing.length < 5) {
          sampleMissing.push({
            id: c._id,
            employer: c.employerName,
            hasSourceDates,
          });
        }
      } else {
        noDatesForCalculation++;
      }
    }

    return {
      total: cases.length,
      hasDerivedFields,
      missingDerivedFields,
      noDatesForCalculation,
      sampleMissing,
      needsBackfill: missingDerivedFields > 0,
    };
  },
});

/**
 * Backfill derived fields for all cases that have source dates but missing derived dates.
 * This fixes cases imported via migration that bypassed the normal create/update path.
 *
 * Run after migration: npx convex run migrations:backfillDerivedFields
 */
export const backfillDerivedFields = mutation({
  args: {
    batchSize: v.optional(v.number()), // Default 50
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50;
    const cases = await ctx.db.query("cases").collect();

    let updated = 0;
    let skipped = 0;
    let noData = 0;
    const errors: string[] = [];

    for (const c of cases) {
      // Only process cases missing derived fields
      if (c.recruitmentStartDate || c.filingWindowOpens) {
        skipped++;
        continue;
      }

      // Check if we have source dates to calculate from
      const hasSourceDates = !!(
        c.sundayAdFirstDate ||
        c.jobOrderStartDate ||
        c.noticeOfFilingStartDate
      );

      if (!hasSourceDates) {
        noData++;
        continue;
      }

      try {
        // Calculate derived dates
        const derivedDates = calculateDerivedDates({
          sundayAdFirstDate: c.sundayAdFirstDate,
          sundayAdSecondDate: c.sundayAdSecondDate,
          jobOrderStartDate: c.jobOrderStartDate,
          jobOrderEndDate: c.jobOrderEndDate,
          noticeOfFilingStartDate: c.noticeOfFilingStartDate,
          noticeOfFilingEndDate: c.noticeOfFilingEndDate,
          additionalRecruitmentEndDate: c.additionalRecruitmentEndDate,
          additionalRecruitmentMethods: c.additionalRecruitmentMethods,
          pwdExpirationDate: c.pwdExpirationDate,
          isProfessionalOccupation: c.isProfessionalOccupation ?? false,
        });

        // Update the case with derived dates
        await ctx.db.patch(c._id, {
          recruitmentStartDate: derivedDates.recruitmentStartDate ?? undefined,
          recruitmentEndDate: derivedDates.recruitmentEndDate ?? undefined,
          filingWindowOpens: derivedDates.filingWindowOpens ?? undefined,
          filingWindowCloses: derivedDates.filingWindowCloses ?? undefined,
          recruitmentWindowCloses: derivedDates.recruitmentWindowCloses ?? undefined,
        });

        updated++;
      } catch (error) {
        errors.push(`Case ${c._id}: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Batch limit to avoid transaction timeouts
      if (updated >= batchSize) {
        break;
      }
    }

    return {
      processed: updated + skipped + noData,
      updated,
      skipped,
      noData,
      errors: errors.length > 0 ? errors : undefined,
      complete: updated < batchSize,
      message: updated < batchSize
        ? `Backfill complete. Updated ${updated} case(s).`
        : `Batch complete. Updated ${updated} case(s). Run again to continue.`,
    };
  },
});
