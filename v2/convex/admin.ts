/**
 * Admin Functions
 *
 * Contains both internal admin utilities (test user creation, data copying)
 * and public admin endpoints (dashboard data, user management, notification
 * settings, email sending).
 *
 * SECURITY: Public functions enforce admin access via requireAdmin() guard.
 * Internal functions use internalQuery/internalMutation/internalAction
 * and are only callable server-side.
 */

import { internalMutation, internalAction, internalQuery, query, mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { Scrypt } from "lucia";
import { requireAdmin, getAdminProfile, getAdminDashboardDataHelper, ADMIN_EMAIL } from "./lib/admin";
import { getCurrentUserId, extractUserIdFromAction } from "./lib/auth";
import { buildDefaultProfile } from "./lib/userDefaults";
import { render } from "@react-email/render";
import { AdminEmail } from "../src/emails/AdminEmail";

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
 * Does NOT copy (by design):
 * - Google OAuth tokens (must re-authenticate)
 * - Push subscriptions (device-specific)
 * - Tool cache (ephemeral)
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
        const {
          _id,
          _creationTime,
          userId: _userId,
          createdAt: _createdAt,
          deletedAt: _deletedAt,
          scheduledDeletionJobId: _scheduledDeletionJobId,
          // Don't copy Google OAuth tokens - they're user-specific
          googleEmail: _googleEmail,
          googleRefreshToken: _googleRefreshToken,
          googleAccessToken: _googleAccessToken,
          googleTokenExpiry: _googleTokenExpiry,
          googleScopes: _googleScopes,
          googleCalendarConnected: _googleCalendarConnected,
          gmailConnected: _gmailConnected,
          // Don't copy push subscription - device specific
          pushSubscription: _pushSubscription,
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
    await ctx.db.insert("userProfiles", buildDefaultProfile(
      userId,
      { fullName: args.name, termsAcceptedAt: Date.now(), termsVersion: "2025-01-01" }
    ));

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
    // Use shared helper from lib/admin.ts
    return await getAdminDashboardDataHelper(ctx);
  },
});

// ============================================================================
// ADMIN NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Get admin notification preferences (internal query).
 *
 * Looks up the admin user by ADMIN_EMAIL and returns notification prefs.
 * Must be internalQuery because it's called from non-admin user context
 * (e.g., during signup or case creation by any user).
 */
export const getAdminNotificationPrefs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const adminUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), ADMIN_EMAIL))
      .first();

    if (!adminUser) {
      console.warn(`[admin] getAdminNotificationPrefs: admin user not found for email ${ADMIN_EMAIL}`);
      return { adminNotifyNewUser: false, adminNotifyFirstCase: false, adminNotifyAnyCase: false };
    }

    const adminProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", adminUser._id))
      .first();

    if (!adminProfile) {
      console.warn(`[admin] getAdminNotificationPrefs: admin profile not found for user ${adminUser._id}`);
      return { adminNotifyNewUser: false, adminNotifyFirstCase: false, adminNotifyAnyCase: false };
    }

    return {
      adminNotifyNewUser: adminProfile.adminNotifyNewUser ?? false,
      adminNotifyFirstCase: adminProfile.adminNotifyFirstCase ?? false,
      adminNotifyAnyCase: adminProfile.adminNotifyAnyCase ?? false,
    };
  },
});

// ============================================================================
// PUBLIC ADMIN QUERIES/MUTATIONS/ACTIONS
// ============================================================================

/**
 * Get admin dashboard data (public query for admin UI)
 *
 * Returns comprehensive user summary with stats:
 * - Total users, active, deleted, pending deletion
 * - Per-user: email, name, cases, sessions, auth providers
 * - Sorted by last activity
 *
 * @throws {Error} If not admin
 */
export const getAdminDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const adminProfile = await getAdminProfile(ctx);
    const data = await getAdminDashboardDataHelper(ctx);

    return {
      ...data,
      adminSortPreference: {
        sortBy: adminProfile.adminSortBy ?? "lastActivity",
        sortOrder: adminProfile.adminSortOrder ?? "desc",
      },
      adminNotificationPreferences: {
        adminNotifyNewUser: adminProfile.adminNotifyNewUser ?? false,
        adminNotifyFirstCase: adminProfile.adminNotifyFirstCase ?? false,
        adminNotifyAnyCase: adminProfile.adminNotifyAnyCase ?? false,
      },
    };
  },
});

/**
 * Save admin notification preferences to DB (admin only)
 */
export const saveAdminNotificationPreferences = mutation({
  args: {
    adminNotifyNewUser: v.boolean(),
    adminNotifyFirstCase: v.boolean(),
    adminNotifyAnyCase: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await getAdminProfile(ctx);

    await ctx.db.patch(profile._id, {
      adminNotifyNewUser: args.adminNotifyNewUser,
      adminNotifyFirstCase: args.adminNotifyFirstCase,
      adminNotifyAnyCase: args.adminNotifyAnyCase,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Save admin sort preference to DB (admin only)
 */
export const saveAdminSortPreference = mutation({
  args: {
    sortBy: v.union(
      v.literal("lastActivity"), v.literal("email"), v.literal("name"),
      v.literal("accountStatus"), v.literal("totalCases"), v.literal("activeCases"),
      v.literal("totalLogins"), v.literal("accountCreated"), v.literal("lastLoginTime"),
      v.literal("userType"), v.literal("emailVerified"), v.literal("verificationMethod"),
      v.literal("deletedCases"), v.literal("firmName"), v.literal("termsVersion"),
      v.literal("termsAccepted"), v.literal("lastCaseUpdate"), v.literal("deletedAt"),
      v.literal("userId"), v.literal("authProviders")
    ),
    sortOrder: v.union(v.literal("asc"), v.literal("desc")),
  },
  handler: async (ctx, args) => {
    const profile = await getAdminProfile(ctx);

    await ctx.db.patch(profile._id, {
      adminSortBy: args.sortBy,
      adminSortOrder: args.sortOrder,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update user profile fields (admin only)
 *
 * Can update:
 * - fullName (also syncs to users table name field)
 * - userType (individual | firm_admin | firm_member)
 *
 * @throws {Error} If not admin or user/profile not found
 */
export const updateUserAdmin = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    userType: v.optional(v.union(
      v.literal("individual"),
      v.literal("firm_admin"),
      v.literal("firm_member")
    )),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Build patch object
    const profilePatch: Partial<{
      fullName: string;
      userType: "individual" | "firm_admin" | "firm_member";
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.fullName !== undefined) {
      profilePatch.fullName = args.fullName;
    }

    if (args.userType !== undefined) {
      profilePatch.userType = args.userType;
    }

    await ctx.db.patch(profile._id, profilePatch);

    // Sync name to users table
    if (args.fullName !== undefined) {
      await ctx.db.patch(args.userId, {
        name: args.fullName,
      });
    }

    return { success: true };
  },
});

/**
 * Delete user account (admin only)
 *
 * Permanently deletes user and all associated data:
 * - All cases
 * - All notifications
 * - All conversations, messages, and tool cache
 * - All audit logs
 * - User case order
 * - Timeline preferences
 * - Job description templates
 * - User profile
 * - Auth accounts and sessions
 * - User record
 *
 * NO grace period - immediate deletion (admin bypass)
 *
 * @throws {Error} If not admin or user not found
 */
export const deleteUserAdmin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Prevent admin from deleting their own account
    const currentUserId = await getCurrentUserId(ctx);
    if (args.userId === currentUserId) {
      throw new Error("Cannot delete your own admin account");
    }

    const userId = args.userId;

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete all user's cases
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const caseDoc of cases) {
      await ctx.db.delete(caseDoc._id);
    }

    // Delete all user's notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const notif of notifications) {
      await ctx.db.delete(notif._id);
    }

    // Delete conversations, messages, and tool cache
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const conv of conversations) {
      const messages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) => q.eq("conversationId", conv._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }

      const cacheEntries = await ctx.db
        .query("toolCache")
        .withIndex("by_conversation_tool_hash", (q) => q.eq("conversationId", conv._id))
        .collect();
      for (const entry of cacheEntries) {
        await ctx.db.delete(entry._id);
      }

      await ctx.db.delete(conv._id);
    }

    // Delete audit logs
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const logEntry of auditLogs) {
      await ctx.db.delete(logEntry._id);
    }

    // Delete custom case order
    const caseOrders = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const order of caseOrders) {
      await ctx.db.delete(order._id);
    }

    // Delete timeline preferences
    const timelinePrefs = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const pref of timelinePrefs) {
      await ctx.db.delete(pref._id);
    }

    // Delete job description templates
    const templates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const template of templates) {
      await ctx.db.delete(template._id);
    }

    // Delete user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.delete(profile._id);
    }

    // Delete auth accounts
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    // Delete auth sessions
    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    // Finally delete the user record
    await ctx.db.delete(userId);

    console.info(`[admin] deleteUserAdmin: permanently deleted user ${user.email}`, {
      cases: cases.length,
      notifications: notifications.length,
      conversations: conversations.length,
      auditLogs: auditLogs.length,
      caseOrders: caseOrders.length,
      timelinePrefs: timelinePrefs.length,
      templates: templates.length,
      authAccounts: authAccounts.length,
      authSessions: authSessions.length,
    });

    return { success: true, message: `User ${user.email} permanently deleted` };
  },
});

/**
 * Get user email by ID (internal helper for action admin checks)
 */
export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return { email: user.email };
  },
});

/**
 * Send email as admin (admin only)
 *
 * Renders a branded HTML email using the AdminEmail template
 * with a plain text fallback, and sends via Resend.
 *
 * @throws {Error} If not admin or email fails
 */
export const sendAdminEmail = action({
  args: {
    toEmail: v.string(),
    toName: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin: get userId from identity token, then check via DB
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }
    const userId = extractUserIdFromAction(identity.subject);
    const user = await ctx.runQuery(internal.admin.getUserEmail, { userId });
    if (!user || user.email !== ADMIN_EMAIL) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Render branded HTML email
    const html = await render(
      AdminEmail({
        recipientName: args.toName ?? args.toEmail.split("@")[0] ?? args.toEmail,
        subject: args.subject,
        body: args.body,
      })
    );

    // Initialize Resend
    const { getResend, FROM_EMAIL } = await import("./lib/email");
    const resend = getResend();

    // Send email with both HTML and plain text fallback
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.toEmail],
      subject: args.subject,
      html,
      text: args.body,
    });

    if (error) {
      throw new Error(`Email failed: ${error.message}`);
    }

    return { success: true };
  },
});
