/**
 * Admin Functions
 *
 * Contains both internal admin utilities (test user creation, data copying)
 * and public admin endpoints (dashboard data with server-side pagination, user management, notification
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
import { requireAdmin, getAdminProfile, getAdminDashboardDataHelper, getAdminEmail } from "./lib/admin";
import { getCurrentUserId, extractUserIdFromAction } from "./lib/auth";
import { logUpdate, logDelete } from "./lib/audit";
import { createLogger } from "./lib/logging";

const log = createLogger("Admin");
import { recordError } from "./lib/errorRecording";
import { purgeAllUserData } from "./lib/deletion";
import { buildDefaultProfile } from "./lib/userDefaults";
import { render } from "@react-email/render";
import { AdminEmail } from "../src/emails/AdminEmail";

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

    log.info(`Copying data from ${sourceUser.email} to ${targetUser.email}`);

    // Build case ID mapping: oldId -> newId
    const caseIdMap = new Map<Id<"cases">, Id<"cases">>();

    // ========================================
    // 1. Copy all cases
    // ========================================
    const sourceCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", sourceUser._id))
      .collect();

    log.info(`Found ${sourceCases.length} cases to copy`);

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

    log.info(`Copied ${caseIdMap.size} cases`);

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

        log.info("Copied user profile settings");
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

    log.info(`Found ${sourceConversations.length} conversations to copy`);

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

    log.info(
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

    log.info(`Copied ${notifCount} notifications`);

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

      log.info("Copied user case order");
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

      log.info("Copied timeline preferences");
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

    log.info(`Created test user: ${args.email} with ID: ${userId}`);

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
    log.info("=".repeat(50));
    log.info("Creating test user and copying data");
    log.info("=".repeat(50));

    // Step 1: Create the test user
    log.info(`\n1. Creating test user: ${args.testEmail}`);
    try {
      await ctx.runMutation(internal.admin.createTestUserInternal, {
        email: args.testEmail,
        password: args.testPassword,
        name: args.testName,
      });
      log.info("   ✓ Test user created");
    } catch (error) {
      // User might already exist, that's okay
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("already exists")) {
        log.info("   ℹ Test user already exists, proceeding with copy");
      } else {
        await recordError(ctx, "action", "admin.createTestUserAndCopyData.createUser", error);
        throw error;
      }
    }

    // Step 2: Copy all data from source user to test user
    log.info(`\n2. Copying data from ${args.sourceUserEmail} to ${args.testEmail}`);
    const copyResult = await ctx.runMutation(internal.admin.copyUserData, {
      sourceUserEmail: args.sourceUserEmail,
      targetUserEmail: args.testEmail,
    }) as { copiedCases: number; copiedConversations: number; copiedNotifications: number };

    log.info("Test account created successfully", {
      email: args.testEmail,
      copiedCases: copyResult.copiedCases,
      copiedConversations: copyResult.copiedConversations,
      copiedNotifications: copyResult.copiedNotifications,
    });

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
 * Looks up the admin user by getAdminEmail() and returns notification prefs.
 * Must be internalQuery because it's called from non-admin user context
 * (e.g., during signup or case creation by any user).
 */
export const getAdminNotificationPrefs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const adminUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), getAdminEmail()))
      .first();

    if (!adminUser) {
      console.warn(`[admin] getAdminNotificationPrefs: admin user not found for email ${getAdminEmail()}`);
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
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminProfile = await getAdminProfile(ctx);
    const data = await getAdminDashboardDataHelper(ctx, {
      page: args.page ?? 0,
      pageSize: Math.min(args.pageSize ?? 25, 100),
      sortBy: args.sortBy ?? adminProfile.adminSortBy ?? "lastActivity",
      sortOrder: args.sortOrder ?? adminProfile.adminSortOrder ?? "desc",
      search: args.search,
    });

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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

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

    // Audit: admin user update
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
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

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Audit: admin user deletion (log BEFORE purge destroys data)
    await logDelete(ctx, "users", args.userId, {
      email: user.email,
      name: user.name,
      adminAction: true,
    });

    const result = await purgeAllUserData(ctx, args.userId);

    console.info(`[admin] deleteUserAdmin: permanently deleted user ${user.email}`, result);

    return { success: true, message: `User ${user.email} permanently deleted` };
  },
});

/**
 * Delete orphaned userProfiles whose userId points to a deleted user.
 * Safety net for incomplete deletion flows.
 */
export const cleanupOrphanedProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    let deleted = 0;

    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (!user) {
        await ctx.db.delete(profile._id);
        deleted++;
        console.info(`[admin] Deleted orphaned profile ${profile._id} (userId: ${profile.userId})`);
      }
    }

    return { deleted, totalChecked: profiles.length };
  },
});

/**
 * Purge a user by ID from CLI. Calls the centralized purgeAllUserData.
 * Use for cleaning up incomplete signups or manual admin deletion.
 */
export const purgeUserInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { error: "User not found" };
    }
    const result = await purgeAllUserData(ctx, args.userId);
    console.info(`[admin] Purged user ${args.userId} (${user.email})`, result);
    return result;
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
    if (!user || user.email !== getAdminEmail()) {
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
