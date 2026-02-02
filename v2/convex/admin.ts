/**
 * Admin Mutations
 *
 * These mutations are for administrative tasks like creating test users
 * and copying data between accounts. They should only be run from the
 * Convex dashboard or via CLI.
 *
 * SECURITY: These are internal mutations - not exposed to the client.
 */

import { internalMutation, internalAction, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { Scrypt } from "lucia";

/**
 * Test password verification for debugging.
 */
export const testPasswordVerification = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{
    success: boolean;
    email: string;
    secretLength?: number;
    secretPrefix?: string;
    error?: string;
  }> => {
    // Get the auth account
    const result = await ctx.runQuery(internal.admin.getAuthAccountSecret, {
      email: args.email,
    }) as { found: boolean; secret?: string; provider?: string };

    if (!result.secret) {
      return { success: false, error: "No secret found", email: args.email };
    }

    // Try to verify the password
    const scrypt = new Scrypt();
    const isValid = await scrypt.verify(result.secret, args.password);

    return {
      success: isValid,
      email: args.email,
      secretLength: result.secret.length,
      secretPrefix: result.secret.substring(0, 20),
    };
  },
});

/**
 * Helper query to get auth account secret.
 */
export const getAuthAccountSecret = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("providerAccountId"), args.email))
      .first();

    return {
      found: !!authAccount,
      secret: authAccount?.secret,
      provider: authAccount?.provider,
    };
  },
});

/**
 * Debug query to check auth accounts for a given email.
 */
export const debugAuthAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return { error: "User not found", email: args.email };
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    const authAccountByEmail = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("providerAccountId"), args.email))
      .collect();

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
      authAccountsByUserId: authAccounts.map((a) => ({
        _id: a._id,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        hasSecret: !!a.secret,
        secretLength: a.secret?.length,
        emailVerified: a.emailVerified,
      })),
      authAccountsByEmail: authAccountByEmail.map((a) => ({
        _id: a._id,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        hasSecret: !!a.secret,
        secretLength: a.secret?.length,
        emailVerified: a.emailVerified,
      })),
    };
  },
});

/**
 * Copy all data from one user to another.
 *
 * This copies:
 * - All cases (with new IDs, updating references)
 * - User profile settings (preferences, notification settings)
 * - Conversations and messages
 * - Notifications
 * - User case order preferences
 * - Timeline preferences
 *
 * Usage from Convex Dashboard:
 * 1. Go to Functions > admin > copyUserData
 * 2. Enter sourceUserEmail and targetUserEmail
 * 3. Run the mutation
 *
 * Or via CLI:
 * npx convex run admin:copyUserData '{"sourceUserEmail": "you@email.com", "targetUserEmail": "test@email.com"}'
 */
export const copyUserData = internalMutation({
  args: {
    sourceUserEmail: v.string(),
    targetUserEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find source user
    const sourceUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.sourceUserEmail))
      .first();

    if (!sourceUser) {
      throw new Error(`Source user not found: ${args.sourceUserEmail}`);
    }

    // Find target user
    const targetUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.targetUserEmail))
      .first();

    if (!targetUser) {
      throw new Error(
        `Target user not found: ${args.targetUserEmail}. Please sign up the test user first via the app.`
      );
    }

    console.log(`Copying data from ${sourceUser.email} to ${targetUser.email}`);

    // Build case ID mapping: oldId -> newId
    const caseIdMap = new Map<Id<"cases">, Id<"cases">>();

    // ========================================
    // 1. Copy all cases
    // ========================================
    const sourceCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .collect();

    console.log(`Found ${sourceCases.length} cases to copy`);

    for (const sourceCase of sourceCases) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, userId, duplicateOf, ...caseData } =
        sourceCase;

      // Create new case for target user
      const newCaseId = await ctx.db.insert("cases", {
        ...caseData,
        userId: targetUser._id,
        // Clear duplicate reference (it would point to wrong user's case)
        duplicateOf: undefined,
        // Clear calendar event IDs (they belong to source user's calendar)
        calendarEventIds: undefined,
        // Update timestamps
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      caseIdMap.set(_id, newCaseId);
    }

    console.log(`Copied ${caseIdMap.size} cases`);

    // ========================================
    // 2. Copy user profile settings
    // ========================================
    const sourceProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .first();

    if (sourceProfile) {
      const targetProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", targetUser._id))
        .first();

      if (targetProfile) {
        // Update target profile with source settings
        // Keep target's userId and timestamps
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          _id,
          _creationTime,
          userId,
          createdAt,
          deletedAt,
          scheduledDeletionJobId,
          // Don't copy Google OAuth tokens - they're user-specific
          googleEmail,
          googleRefreshToken,
          googleAccessToken,
          googleTokenExpiry,
          googleScopes,
          googleCalendarConnected,
          gmailConnected,
          // Don't copy push subscription - device specific
          pushSubscription,
          // Map case IDs in arrays
          calendarHiddenCases,
          dismissedDeadlines,
          ...profileSettings
        } = sourceProfile;

        // Map case IDs in calendarHiddenCases
        const mappedHiddenCases = calendarHiddenCases
          ?.map((oldId) => caseIdMap.get(oldId))
          .filter((id): id is Id<"cases"> => id !== undefined);

        // Map case IDs in dismissedDeadlines
        const mappedDismissedDeadlines = dismissedDeadlines
          ?.map((dd) => {
            const newCaseId = caseIdMap.get(dd.caseId);
            if (!newCaseId) return null;
            return { ...dd, caseId: newCaseId };
          })
          .filter(
            (
              dd
            ): dd is {
              caseId: Id<"cases">;
              deadlineType: string;
              dismissedAt: number;
            } => dd !== null
          );

        await ctx.db.patch(targetProfile._id, {
          ...profileSettings,
          calendarHiddenCases: mappedHiddenCases || [],
          dismissedDeadlines: mappedDismissedDeadlines || [],
          // Reset Google calendar (target user needs to connect their own)
          googleCalendarConnected: false,
          gmailConnected: false,
          updatedAt: Date.now(),
        });

        console.log("Copied user profile settings");
      }
    }

    // ========================================
    // 3. Copy conversations and messages
    // ========================================
    const conversationIdMap = new Map<
      Id<"conversations">,
      Id<"conversations">
    >();

    const sourceConversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .collect();

    console.log(`Found ${sourceConversations.length} conversations to copy`);

    for (const conv of sourceConversations) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, userId, metadata, ...convData } = conv;

      // Map relatedCaseId if present
      let mappedMetadata = metadata;
      if (metadata?.relatedCaseId) {
        const newCaseId = caseIdMap.get(metadata.relatedCaseId);
        if (newCaseId) {
          mappedMetadata = { ...metadata, relatedCaseId: newCaseId };
        }
      }

      const newConvId = await ctx.db.insert("conversations", {
        ...convData,
        userId: targetUser._id,
        metadata: mappedMetadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      conversationIdMap.set(_id, newConvId);

      // Copy all messages for this conversation
      const messages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) => q.eq("conversationId", _id))
        .collect();

      for (const msg of messages) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id: msgId, _creationTime: msgCreation, conversationId, ...msgData } =
          msg;

        await ctx.db.insert("conversationMessages", {
          ...msgData,
          conversationId: newConvId,
        });
      }
    }

    console.log(
      `Copied ${conversationIdMap.size} conversations with messages`
    );

    // ========================================
    // 4. Copy notifications (only case-related ones)
    // ========================================
    const sourceNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .collect();

    let notifCount = 0;
    for (const notif of sourceNotifications) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, userId, caseId, ...notifData } = notif;

      // Map caseId if present
      let newCaseId: Id<"cases"> | undefined;
      if (caseId) {
        newCaseId = caseIdMap.get(caseId);
        if (!newCaseId) continue; // Skip if case wasn't copied
      }

      await ctx.db.insert("notifications", {
        ...notifData,
        userId: targetUser._id,
        caseId: newCaseId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      notifCount++;
    }

    console.log(`Copied ${notifCount} notifications`);

    // ========================================
    // 5. Copy user case order
    // ========================================
    const sourceOrder = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .first();

    if (sourceOrder) {
      // Delete existing order for target user
      const existingOrder = await ctx.db
        .query("userCaseOrder")
        .withIndex("by_user_id", (q) => q.eq("userId", targetUser._id))
        .first();

      if (existingOrder) {
        await ctx.db.delete(existingOrder._id);
      }

      // Map case IDs
      const mappedCaseIds = sourceOrder.caseIds
        .map((oldId) => caseIdMap.get(oldId))
        .filter((id): id is Id<"cases"> => id !== undefined);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, userId, caseIds, ...orderData } = sourceOrder;

      await ctx.db.insert("userCaseOrder", {
        ...orderData,
        userId: targetUser._id,
        caseIds: mappedCaseIds,
      });

      console.log("Copied user case order");
    }

    // ========================================
    // 6. Copy timeline preferences
    // ========================================
    const sourceTimeline = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .first();

    if (sourceTimeline) {
      // Delete existing timeline prefs for target user
      const existingTimeline = await ctx.db
        .query("timelinePreferences")
        .withIndex("by_user_id", (q) => q.eq("userId", targetUser._id))
        .first();

      if (existingTimeline) {
        await ctx.db.delete(existingTimeline._id);
      }

      // Map selectedCaseIds if present
      const mappedSelectedCaseIds = sourceTimeline.selectedCaseIds
        ?.map((oldId) => caseIdMap.get(oldId))
        .filter((id): id is Id<"cases"> => id !== undefined);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, userId, selectedCaseIds, ...timelineData } =
        sourceTimeline;

      await ctx.db.insert("timelinePreferences", {
        ...timelineData,
        userId: targetUser._id,
        selectedCaseIds: mappedSelectedCaseIds,
      });

      console.log("Copied timeline preferences");
    }

    // ========================================
    // Summary
    // ========================================
    return {
      success: true,
      sourceUser: sourceUser.email,
      targetUser: targetUser.email,
      copiedCases: caseIdMap.size,
      copiedConversations: conversationIdMap.size,
      copiedNotifications: notifCount,
    };
  },
});

/**
 * Create a test user with email/password authentication.
 * This creates:
 * 1. A user in the users table
 * 2. An authAccount entry with hashed password
 * 3. A userProfile with default settings
 *
 * Usage:
 * npx convex run admin:createTestUserInternal '{"email": "test@example.com", "password": "TestPassword123!", "name": "Test User"}'
 */
export const createTestUserInternal = internalMutation({
  args: {
    email: v.string(),
    password: v.string(), // Will be hashed before storage
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      throw new Error(`User already exists with email: ${args.email}`);
    }

    // Validate password
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Hash the password using Scrypt (same as Convex Auth Password provider)
    const scrypt = new Scrypt();
    const hashedPassword = await scrypt.hash(args.password);

    // Create user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
    });

    // Create authAccount entry for password auth
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: args.email, // Email is the account ID for password provider
      secret: hashedPassword,
      emailVerified: args.email, // Mark email as verified
    });

    // Create userProfile with default settings
    const now = Date.now();
    await ctx.db.insert("userProfiles", {
      userId,
      fullName: args.name,
      userType: "individual",
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      pushNotificationsEnabled: false,
      urgentDeadlineDays: 7,
      reminderDaysBefore: [1, 3, 7, 14, 30],
      emailDeadlineReminders: true,
      emailStatusUpdates: true,
      emailRfeAlerts: true,
      emailWeeklyDigest: true,
      preferredNotificationEmail: "signup",
      quietHoursEnabled: false,
      timezone: "America/New_York",
      calendarSyncEnabled: false,
      calendarSyncPwd: true,
      calendarSyncEta9089: true,
      calendarSyncI140: true,
      calendarSyncRfe: true,
      calendarSyncRfi: true,
      calendarSyncRecruitment: true,
      calendarSyncFilingWindow: true,
      googleCalendarConnected: false,
      gmailConnected: false,
      casesSortBy: "updatedAt",
      casesSortOrder: "desc",
      casesPerPage: 10,
      dismissedDeadlines: [],
      darkModeEnabled: false,
      autoDeadlineEnforcementEnabled: true,
      termsAcceptedAt: now,
      termsVersion: "2025-01-01",
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Created test user: ${args.email} with ID: ${userId}`);

    return {
      success: true,
      userId,
      email: args.email,
      name: args.name,
    };
  },
});

/**
 * Complete flow: Create test user and copy all data from source user.
 *
 * This is the main entry point - run this from CLI or Dashboard:
 * npx convex run admin:createTestUserAndCopyData '{"sourceUserEmail": "you@email.com", "testEmail": "demo@permtracker.app", "testPassword": "DemoPass2024!", "testName": "Demo User"}'
 */
export const createTestUserAndCopyData = internalAction({
  args: {
    sourceUserEmail: v.string(),
    testEmail: v.string(),
    testPassword: v.string(),
    testName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    testUser: { email: string; password: string; name: string };
    copied: { cases: number; conversations: number; notifications: number };
  }> => {
    console.log("=".repeat(50));
    console.log("Creating test user and copying data");
    console.log("=".repeat(50));

    // Step 1: Create the test user
    console.log(`\n1. Creating test user: ${args.testEmail}`);
    try {
      await ctx.runMutation(internal.admin.createTestUserInternal, {
        email: args.testEmail,
        password: args.testPassword,
        name: args.testName,
      });
      console.log("   ✓ Test user created");
    } catch (error) {
      // User might already exist, that's okay
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("already exists")) {
        console.log("   ℹ Test user already exists, proceeding with copy");
      } else {
        throw error;
      }
    }

    // Step 2: Copy all data from source user to test user
    console.log(`\n2. Copying data from ${args.sourceUserEmail} to ${args.testEmail}`);
    const copyResult = await ctx.runMutation(internal.admin.copyUserData, {
      sourceUserEmail: args.sourceUserEmail,
      targetUserEmail: args.testEmail,
    }) as { copiedCases: number; copiedConversations: number; copiedNotifications: number };

    console.log("\n" + "=".repeat(50));
    console.log("DONE! Test account created successfully.");
    console.log("=".repeat(50));
    console.log(`\nLogin credentials:`);
    console.log(`  Email: ${args.testEmail}`);
    console.log(`  Password: ${args.testPassword}`);
    console.log(`\nCopied data:`);
    console.log(`  Cases: ${copyResult.copiedCases}`);
    console.log(`  Conversations: ${copyResult.copiedConversations}`);
    console.log(`  Notifications: ${copyResult.copiedNotifications}`);

    return {
      success: true,
      testUser: {
        email: args.testEmail,
        password: args.testPassword,
        name: args.testName,
      },
      copied: {
        cases: copyResult.copiedCases,
        conversations: copyResult.copiedConversations,
        notifications: copyResult.copiedNotifications,
      },
    };
  },
});

/**
 * Debug query to mimic listFiltered exactly.
 * Run via: npx convex run admin:debugListFiltered '{"email": "admin@yahoo.com"}'
 */
export const debugListFiltered = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return { error: "User not found", email: args.email };
    }

    // Exact same query as listFiltered
    const allCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(1000);

    const beforeDeleteFilter = allCases.length;

    // Filter out soft-deleted cases
    const filteredCases = allCases.filter((c) => c.deletedAt === undefined);
    const afterDeleteFilter = filteredCases.length;

    // Check for any cases with deletedAt set
    const deletedCases = allCases.filter((c) => c.deletedAt !== undefined);

    // Check for duplicates
    const duplicateCases = filteredCases.filter((c) => c.duplicateOf !== undefined);

    // Check for the mystery userId
    const mysteryUserId = "md717vgz2vwh83c3drbgd8daz57z9nnt";
    const mysteryCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", mysteryUserId as Id<"users">))
      .collect();

    // Check if mystery user exists in users table
    let mysteryUserExists = false;
    try {
      const mysteryUser = await ctx.db.get(mysteryUserId as Id<"users">);
      mysteryUserExists = mysteryUser !== null;
    } catch (e) {
      mysteryUserExists = false;
    }

    return {
      email: args.email,
      userId: user._id,
      rawQueryCount: beforeDeleteFilter,
      afterSoftDeleteFilter: afterDeleteFilter,
      softDeletedCount: deletedCases.length,
      deletedCaseIds: deletedCases.map(c => c._id),
      duplicateCount: duplicateCases.length,
      duplicateCaseIds: duplicateCases.map(c => c._id),
      // Mystery user debug
      mysteryUserId,
      mysteryCasesCount: mysteryCases.length,
      mysteryUserExists,
    };
  },
});

/**
 * Debug query to get case counts by status for a user.
 * Run via: npx convex run admin:debugCaseCounts '{"email": "admin@yahoo.com"}'
 */
export const debugCaseCounts = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return { error: "User not found", email: args.email };
    }

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Also get ALL cases to find unique userIds
    const allCasesInDb = await ctx.db.query("cases").collect();
    const uniqueUserIds: Record<string, number> = {};
    for (const c of allCasesInDb) {
      const uid = c.userId as string;
      uniqueUserIds[uid] = (uniqueUserIds[uid] || 0) + 1;
    }
    const sortedUserIds = Object.entries(uniqueUserIds)
      .sort((a, b) => b[1] - a[1])
      .map(([uid, count]) => ({ userId: uid, caseCount: count }));

    // Group by status
    const byStatus: Record<string, number> = {};
    const byStatusProgress: Record<string, number> = {};
    let deleted = 0;
    let active = 0; // not closed, not completed
    let completed = 0; // i140 + approved
    let closed = 0;

    for (const c of cases) {
      if (c.deletedAt) {
        deleted++;
        continue;
      }

      const status = c.caseStatus || "unknown";
      const progress = c.progressStatus || "unknown";
      const combo = `${status}/${progress}`;

      byStatus[status] = (byStatus[status] || 0) + 1;
      byStatusProgress[combo] = (byStatusProgress[combo] || 0) + 1;

      if (c.caseStatus === "closed") {
        closed++;
      } else if (c.caseStatus === "i140" && c.progressStatus === "approved") {
        completed++;
      } else {
        active++;
      }
    }

    return {
      userId: user._id,
      email: user.email,
      totalCases: cases.length,
      deleted,
      active, // Excludes closed AND completed
      completed,
      closed,
      activeByOldDefinition: cases.filter(c => !c.deletedAt && c.caseStatus !== "closed").length, // Old definition (only excludes closed)
      byStatus,
      byStatusProgress,
      // All unique userIds in cases table with counts
      allUniqueUserIds: sortedUserIds,
      totalCasesInDb: allCasesInDb.length,
    };
  },
});

/**
 * Debug query to list all users with their case counts.
 * Run via: npx convex run admin:listUsersWithCaseCounts '{}'
 */
export const listUsersWithCaseCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const results = [];
    for (const user of users) {
      const cases = await ctx.db
        .query("cases")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();

      const activeCases = cases.filter(c =>
        !c.deletedAt &&
        c.caseStatus !== "closed" &&
        !(c.caseStatus === "i140" && c.progressStatus === "approved")
      );

      results.push({
        userId: user._id,
        email: user.email,
        name: user.name,
        totalCases: cases.length,
        activeCases: activeCases.length,
        deletedCases: cases.filter(c => c.deletedAt).length,
      });
    }

    // Sort by totalCases descending
    results.sort((a, b) => b.totalCases - a.totalCases);

    return results;
  },
});

/**
 * Debug query to get all unique userIds in cases table with counts.
 * Run via: npx convex run admin:debugAllCaseUserIds '{}'
 */
export const debugAllCaseUserIds = query({
  args: {},
  handler: async (ctx) => {
    const allCases = await ctx.db.query("cases").collect();

    const userIdCounts: Record<string, { total: number; active: number }> = {};

    for (const c of allCases) {
      const uid = c.userId as string;
      if (!userIdCounts[uid]) {
        userIdCounts[uid] = { total: 0, active: 0 };
      }
      userIdCounts[uid].total++;
      if (!c.deletedAt && c.caseStatus !== "closed") {
        userIdCounts[uid].active++;
      }
    }

    // Sort by total descending
    const sorted = Object.entries(userIdCounts)
      .map(([userId, counts]) => ({ userId, ...counts }))
      .sort((a, b) => b.total - a.total);

    return {
      totalCasesInTable: allCases.length,
      uniqueUserIds: sorted.length,
      userIdCounts: sorted,
    };
  },
});

/**
 * Debug query to test case counts for a specific userId string.
 * Run via: npx convex run admin:debugCasesByUserIdPublic '{"userId": "md717vgz2vwh83c3drbgd8daz57z9nnt"}'
 */
export const debugCasesByUserIdPublic = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Try querying with the userId as-is
    const casesWithIndex = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId as Id<"users">))
      .take(1000);

    // Also try without index (full table scan) for comparison
    const allCases = await ctx.db.query("cases").collect();
    const casesWithFilter = allCases.filter(c => c.userId === args.userId);

    return {
      inputUserId: args.userId,
      casesWithIndex: casesWithIndex.length,
      casesWithFilter: casesWithFilter.length,
      totalCasesInTable: allCases.length,
      uniqueUserIdsInCases: Array.from(new Set(allCases.map(c => c.userId))),
    };
  },
});

/**
 * Debug query to test case counts for a specific userId string.
 * Run via: npx convex run admin:debugCasesByUserId '{"userId": "md717vgz2vwh83c3drbgd8daz57z9nnt"}'
 */
export const debugCasesByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Try querying with the userId as-is
    const casesWithIndex = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId as Id<"users">))
      .take(1000);

    // Also try without index (full table scan) for comparison
    const allCases = await ctx.db.query("cases").take(1000);
    const casesWithFilter = allCases.filter(c => c.userId === args.userId);

    return {
      inputUserId: args.userId,
      casesWithIndex: casesWithIndex.length,
      casesWithFilter: casesWithFilter.length,
      totalCasesInTable: allCases.length,
      sampleUserIds: Array.from(new Set(allCases.slice(0, 20).map(c => c.userId))),
    };
  },
});

/**
 * Comprehensive admin summary joining users + authAccounts + authSessions + userProfiles + cases.
 *
 * Bulk-loads all 5 tables, builds lookup maps, assembles per-user summary in one pass.
 * Sorted by lastActivity descending (most recently active first).
 *
 * Run via: npx convex run admin:getUserSummary '{}'
 */
export const getUserSummary = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Bulk-load all 5 tables
    const [users, authAccounts, authSessions, userProfiles, cases] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("authAccounts").collect(),
      ctx.db.query("authSessions").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("cases").collect(),
    ]);

    // Build lookup maps: userId -> docs[]
    const accountsByUserId = new Map<Id<"users">, Doc<"authAccounts">[]>();
    for (const account of authAccounts) {
      const existing = accountsByUserId.get(account.userId) ?? [];
      existing.push(account);
      accountsByUserId.set(account.userId, existing);
    }

    const sessionsByUserId = new Map<Id<"users">, Doc<"authSessions">[]>();
    for (const session of authSessions) {
      const existing = sessionsByUserId.get(session.userId) ?? [];
      existing.push(session);
      sessionsByUserId.set(session.userId, existing);
    }

    const profileByUserId = new Map<Id<"users">, Doc<"userProfiles">>();
    for (const profile of userProfiles) {
      profileByUserId.set(profile.userId, profile);
    }

    const casesByUserId = new Map<Id<"users">, Doc<"cases">[]>();
    for (const c of cases) {
      const existing = casesByUserId.get(c.userId) ?? [];
      existing.push(c);
      casesByUserId.set(c.userId, existing);
    }

    // Aggregate stats
    let totalUsers = 0;
    let activeUsers = 0;
    let deletedUsers = 0;
    let pendingDeletion = 0;
    let usersWithCases = 0;

    // Assemble per-user summary
    const userSummaries = users.map((user) => {
      const accounts = accountsByUserId.get(user._id) ?? [];
      const sessions = sessionsByUserId.get(user._id) ?? [];
      const profile = profileByUserId.get(user._id);
      const userCases = casesByUserId.get(user._id) ?? [];

      // Auth providers
      const authProviders = accounts.map((a) => a.provider);

      // Email verification: Google = always verified; password = check emailVerified field
      const hasGoogle = accounts.some((a) => a.provider === "google");
      const hasPasswordVerified = accounts.some(
        (a) => a.provider === "password" && a.emailVerified !== undefined
      );
      const emailVerified = hasGoogle || hasPasswordVerified;

      // Verification method
      let verificationMethod: string;
      if (accounts.length === 0) {
        verificationMethod = "no_auth_account";
      } else if (hasGoogle) {
        verificationMethod = "google";
      } else if (hasPasswordVerified) {
        verificationMethod = "password_otp";
      } else {
        verificationMethod = "unverified";
      }

      // Session stats
      const lastLoginTime = sessions.length > 0
        ? Math.max(...sessions.map((s) => s._creationTime))
        : null;
      const totalLogins = sessions.length;

      // Case stats
      const totalCasesCount = userCases.length;
      const activeCases = userCases.filter(
        (c) =>
          c.deletedAt === undefined &&
          c.caseStatus !== "closed" &&
          !(c.caseStatus === "i140" && c.progressStatus === "approved")
      ).length;
      const deletedCases = userCases.filter((c) => c.deletedAt !== undefined).length;
      const lastCaseUpdate = userCases.length > 0
        ? Math.max(...userCases.map((c) => c.updatedAt))
        : null;

      // Account status
      let accountStatus: "active" | "pending_deletion" | "deleted";
      if (user.deletedAt !== undefined) {
        accountStatus = "deleted";
      } else if (profile?.deletedAt !== undefined) {
        accountStatus = "pending_deletion";
      } else {
        accountStatus = "active";
      }

      // Last activity: max of (lastLogin, lastCaseUpdate, profile updatedAt)
      const activityCandidates: number[] = [];
      if (lastLoginTime !== null) activityCandidates.push(lastLoginTime);
      if (lastCaseUpdate !== null) activityCandidates.push(lastCaseUpdate);
      if (profile?.updatedAt) activityCandidates.push(profile.updatedAt);
      const lastActivity = activityCandidates.length > 0
        ? Math.max(...activityCandidates)
        : user._creationTime;

      // Aggregate counters
      totalUsers++;
      if (accountStatus === "active") activeUsers++;
      if (accountStatus === "deleted") deletedUsers++;
      if (accountStatus === "pending_deletion") pendingDeletion++;
      if (totalCasesCount > 0) usersWithCases++;

      return {
        userId: user._id,
        email: user.email ?? "(no email)",
        name: profile?.fullName ?? user.name ?? "(no name)",
        emailVerified,
        verificationMethod,
        authProviders,
        accountCreated: user._creationTime,
        lastLoginTime,
        totalLogins,
        totalCases: totalCasesCount,
        activeCases,
        deletedCases,
        lastCaseUpdate,
        userType: profile ? profile.userType : "(no profile)",
        firmName: profile?.firmName ?? null,
        accountStatus,
        deletedAt: user.deletedAt ?? null,
        termsAccepted: profile?.termsAcceptedAt ?? null,
        termsVersion: profile?.termsVersion ?? null,
        lastActivity,
      };
    });

    // Sort by lastActivity descending
    userSummaries.sort((a, b) => b.lastActivity - a.lastActivity);

    return {
      generatedAt: Date.now(),
      totalUsers,
      activeUsers,
      deletedUsers,
      pendingDeletion,
      usersWithCases,
      totalCasesInSystem: cases.length,
      users: userSummaries,
    };
  },
});
