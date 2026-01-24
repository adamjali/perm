/**
 * Admin Mutations
 *
 * These mutations are for administrative tasks like creating test users
 * and copying data between accounts. They should only be run from the
 * Convex dashboard or via CLI.
 *
 * SECURITY: These are internal mutations - not exposed to the client.
 */

import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
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
        emailVerificationTime: user.emailVerificationTime,
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
      emailVerificationTime: Date.now(), // Mark as verified
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
