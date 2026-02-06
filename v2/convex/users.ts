import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull, extractUserIdFromAction } from "./lib/auth";
import { encryptToken, decryptToken } from "./lib/crypto";
import { loggers } from "./lib/logging";
import { buildDefaultProfile } from "./lib/userDefaults";

const log = loggers.auth;

/**
 * Get the currently authenticated user
 * Returns null if not authenticated, otherwise returns the user document
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get(userId);
    return user;
  },
});

/**
 * Get the current user's profile
 * Returns null if not authenticated or if profile doesn't exist
 */
export const currentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return null;
    }

    // Query userProfiles by userId index
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

/**
 * Ensure a user profile exists for the current user
 * Called after successful login/signup
 * Idempotent: does nothing if profile already exists
 *
 * On first creation, copies name and image from the users table
 * (populated from Google OAuth or manual signup)
 */
export const ensureUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile) {
      // Profile already exists, nothing to do
      return existingProfile._id;
    }

    // Get the user record to copy name and image from auth
    const user = await ctx.db.get(userId);

    // Create new profile with default values
    const profileId = await ctx.db.insert("userProfiles", buildDefaultProfile(
      userId,
      { fullName: user?.name, profilePhotoUrl: user?.image }
    ));

    // Admin notification: new user signup
    // Also here (not just ensureUserProfileInternal) because PendingTermsHandler
    // may create the profile before the auth callback does, racing the internal path
    try {
      const adminPrefs = await ctx.runQuery(internal.admin.getAdminNotificationPrefs, {});
      if (adminPrefs.adminNotifyNewUser) {
        const signupTime = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
          subject: "New User Signup",
          body: `A new user has signed up for PERM Tracker.\n\nEmail: ${user?.email ?? "unknown"}\nName: ${user?.name ?? "Not provided"}\nTime: ${signupTime}`,
        });
      }
    } catch (adminNotifError) {
      log.error("Failed to send admin signup notification", {
        error: adminNotifError instanceof Error ? adminNotifError.message : String(adminNotifError),
      });
    }

    return profileId;
  },
});

/**
 * Internal mutation to ensure user profile exists
 * Called from auth callback after signup/signin
 * Takes userId as arg since auth callback doesn't have auth context
 */
export const ensureUserProfileInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Check if profile already exists (idempotent)
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (existingProfile) {
      // Profile already exists, nothing to do
      return existingProfile._id;
    }

    // Get the user record to copy name and image from auth
    const user = await ctx.db.get(args.userId);

    // Create new profile with default values
    const profileId = await ctx.db.insert("userProfiles", buildDefaultProfile(
      args.userId,
      { fullName: user?.name, profilePhotoUrl: user?.image }
    ));

    // Admin notification: new user signup
    try {
      const adminPrefs = await ctx.runQuery(internal.admin.getAdminNotificationPrefs, {});
      if (adminPrefs.adminNotifyNewUser) {
        const signupTime = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
          subject: "New User Signup",
          body: `A new user has signed up for PERM Tracker.\n\nEmail: ${user?.email ?? "unknown"}\nName: ${user?.name ?? "Not provided"}\nTime: ${signupTime}`,
        });
      }
    } catch (adminNotifError) {
      log.error("Failed to send admin signup notification", {
        error: adminNotifError instanceof Error ? adminNotifError.message : String(adminNotifError),
      });
    }

    return profileId;
  },
});

/**
 * Update the current user's profile
 * Allows partial updates to profile fields
 */
export const updateUserProfile = mutation({
  args: {
    // User type
    userType: v.optional(v.union(
      v.literal("individual"),
      v.literal("firm_admin"),
      v.literal("firm_member")
    )),
    firmId: v.optional(v.id("users")),
    firmName: v.optional(v.string()),
    // Profile section
    fullName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    company: v.optional(v.string()),
    profilePhotoUrl: v.optional(v.string()),
    // Notification settings
    emailNotificationsEnabled: v.optional(v.boolean()),
    smsNotificationsEnabled: v.optional(v.boolean()),
    pushNotificationsEnabled: v.optional(v.boolean()),
    urgentDeadlineDays: v.optional(v.number()),
    reminderDaysBefore: v.optional(v.array(v.number())),
    // Email preferences
    emailDeadlineReminders: v.optional(v.boolean()),
    emailDeadlineReminderPwd: v.optional(v.boolean()),
    emailDeadlineReminderRecruitment: v.optional(v.boolean()),
    emailDeadlineReminderEta9089: v.optional(v.boolean()),
    emailDeadlineReminderI140: v.optional(v.boolean()),
    emailDeadlineReminderRfi: v.optional(v.boolean()),
    emailDeadlineReminderRfe: v.optional(v.boolean()),
    emailStatusUpdates: v.optional(v.boolean()),
    emailRfeAlerts: v.optional(v.boolean()),
    emailWeeklyDigest: v.optional(v.boolean()),
    preferredNotificationEmail: v.optional(v.union(
      v.literal("signup"),
      v.literal("google"),
      v.literal("both")
    )),
    // Quiet hours
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()), // HH:MM format
    quietHoursEnd: v.optional(v.string()),
    timezone: v.optional(v.string()),
    // Calendar sync
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarSyncPwd: v.optional(v.boolean()),
    calendarSyncEta9089: v.optional(v.boolean()),
    calendarSyncI140: v.optional(v.boolean()),
    calendarSyncRfe: v.optional(v.boolean()),
    calendarSyncRfi: v.optional(v.boolean()),
    calendarSyncRecruitment: v.optional(v.boolean()),
    calendarSyncFilingWindow: v.optional(v.boolean()),
    // Google OAuth
    googleEmail: v.optional(v.string()),
    googleRefreshToken: v.optional(v.string()),
    googleAccessToken: v.optional(v.string()),
    googleTokenExpiry: v.optional(v.number()),
    googleScopes: v.optional(v.array(v.string())),
    googleCalendarConnected: v.optional(v.boolean()),
    gmailConnected: v.optional(v.boolean()),
    // UI preferences
    casesSortBy: v.optional(v.string()), // "updatedAt", "createdAt", "nextDeadline", etc.
    casesSortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    casesPerPage: v.optional(v.number()),
    dismissedDeadlines: v.optional(v.array(
      v.object({
        caseId: v.id("cases"),
        deadlineType: v.string(),
        dismissedAt: v.number(),
      })
    )),
    darkModeEnabled: v.optional(v.boolean()),
    // Deadline Enforcement
    autoDeadlineEnforcementEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get current profile or create one if it doesn't exist (upsert pattern)
    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      // Auto-create profile with defaults (same as ensureUserProfile)
      const user = await ctx.db.get(userId);
      const profileId = await ctx.db.insert("userProfiles", buildDefaultProfile(
        userId,
        { fullName: user?.name, profilePhotoUrl: user?.image }
      ));
      profile = await ctx.db.get(profileId);
      if (!profile) {
        throw new Error("Failed to create user profile");
      }

      // Admin notification: new user signup (safety net path)
      try {
        const adminPrefs = await ctx.runQuery(internal.admin.getAdminNotificationPrefs, {});
        if (adminPrefs.adminNotifyNewUser) {
          const signupTime = new Date().toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
          await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
            subject: "New User Signup",
            body: `A new user has signed up for PERM Tracker.\n\nEmail: ${user?.email ?? "unknown"}\nName: ${user?.name ?? "Not provided"}\nTime: ${signupTime}`,
          });
        }
      } catch (adminNotifError) {
        log.error("Failed to send admin signup notification", {
          error: adminNotifError instanceof Error ? adminNotifError.message : String(adminNotifError),
        });
      }
    }

    // Filter out undefined values from args and add updatedAt
    // Type is inferred from the mutation's args definition
    const definedArgs = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    ) as Partial<typeof args>;

    // Encrypt OAuth tokens before storing
    // This protects sensitive credentials at rest
    const updateData: Record<string, unknown> = { ...definedArgs };

    if (args.googleAccessToken !== undefined) {
      updateData.googleAccessToken = args.googleAccessToken
        ? await encryptToken(args.googleAccessToken)
        : undefined;
    }

    if (args.googleRefreshToken !== undefined) {
      updateData.googleRefreshToken = args.googleRefreshToken
        ? await encryptToken(args.googleRefreshToken)
        : undefined;
    }

    // Apply the update with proper typing
    await ctx.db.patch(profile._id, {
      ...updateData,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

/**
 * Get decrypted Google OAuth tokens for API calls
 * Only returns tokens if they exist and are encrypted
 * Used internally for Google Calendar/Gmail API integration
 */
export const getDecryptedGoogleTokens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    // Decrypt tokens if they exist
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (profile.googleAccessToken) {
      try {
        accessToken = await decryptToken(profile.googleAccessToken);
      } catch (error) {
        // Token may be unencrypted (legacy) or corrupted
        // Log for migration tracking - helps identify when migration is complete
        log.warn('Access token decryption failed, using as-is for backwards compatibility', {
          error: error instanceof Error ? error.message : 'unknown error',
        });
        accessToken = profile.googleAccessToken;
      }
    }

    if (profile.googleRefreshToken) {
      try {
        refreshToken = await decryptToken(profile.googleRefreshToken);
      } catch (error) {
        // Token may be unencrypted (legacy) or corrupted
        log.warn('Refresh token decryption failed, using as-is for backwards compatibility', {
          error: error instanceof Error ? error.message : 'unknown error',
        });
        refreshToken = profile.googleRefreshToken;
      }
    }

    return {
      accessToken,
      refreshToken,
      tokenExpiry: profile.googleTokenExpiry ?? null,
      googleEmail: profile.googleEmail ?? null,
    };
  },
});

// ============================================================================
// TERMS ACCEPTANCE MUTATIONS
// ============================================================================

/**
 * Record user acceptance of Terms of Service and Privacy Policy.
 *
 * Called after successful signup when user has checked the terms acceptance checkbox.
 * Stores the timestamp and version of terms accepted.
 *
 * @param termsVersion - The effective date of the ToS being accepted (e.g., "2025-01-03")
 * @returns Success indicator
 */
export const acceptTermsOfService = mutation({
  args: {
    termsVersion: v.string(), // Effective date of ToS, e.g., "2025-01-03"
  },
  handler: async (ctx, { termsVersion }) => {
    const userId = await getCurrentUserId(ctx);

    // Get or create user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      // Create profile first if it doesn't exist
      const user = await ctx.db.get(userId);
      const profileId = await ctx.db.insert("userProfiles", buildDefaultProfile(
        userId,
        { fullName: user?.name, profilePhotoUrl: user?.image, termsAcceptedAt: Date.now(), termsVersion }
      ));

      // Admin notification: new user signup (terms acceptance path)
      try {
        const adminPrefs = await ctx.runQuery(internal.admin.getAdminNotificationPrefs, {});
        if (adminPrefs.adminNotifyNewUser) {
          const signupTime = new Date().toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
          await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
            subject: "New User Signup",
            body: `A new user has signed up for PERM Tracker.\n\nEmail: ${user?.email ?? "unknown"}\nName: ${user?.name ?? "Not provided"}\nTime: ${signupTime}`,
          });
        }
      } catch (adminNotifError) {
        log.error("Failed to send admin signup notification", {
          error: adminNotifError instanceof Error ? adminNotifError.message : String(adminNotifError),
        });
      }

      return { success: true, profileId };
    }

    // Update existing profile with terms acceptance
    await ctx.db.patch(profile._id, {
      termsAcceptedAt: Date.now(),
      termsVersion,
      updatedAt: Date.now(),
    });

    return { success: true, profileId: profile._id };
  },
});

// ============================================================================
// PUSH SUBSCRIPTION MUTATIONS
// ============================================================================

/**
 * Save push subscription for current user.
 *
 * Called from browser when user enables push notifications.
 * Stores the subscription JSON string and enables push notifications.
 *
 * @param subscription - JSON stringified PushSubscription object from browser
 * @returns Success indicator
 */
export const savePushSubscription = mutation({
  args: {
    subscription: v.string(),
  },
  handler: async (ctx, { subscription }) => {
    const userId = await getCurrentUserId(ctx);

    // Get current profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Validate that subscription is valid JSON with required fields
    try {
      const parsed = JSON.parse(subscription);
      if (!parsed.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) {
        throw new Error("Invalid push subscription: missing required fields (endpoint, keys.p256dh, keys.auth)");
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error("Invalid push subscription format: not valid JSON");
      }
      throw e;
    }

    // Update profile with subscription
    await ctx.db.patch(profile._id, {
      pushSubscription: subscription,
      pushNotificationsEnabled: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Remove push subscription for current user.
 *
 * Called when user disables push notifications.
 * Clears the subscription and disables push notifications.
 *
 * @returns Success indicator
 */
export const removePushSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get current profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Clear subscription and disable push
    await ctx.db.patch(profile._id, {
      pushSubscription: undefined,
      pushNotificationsEnabled: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// ACTION MODE (CHATBOT BEHAVIOR)
// ============================================================================

/**
 * Action mode type for chatbot behavior control.
 * - "off": Chatbot cannot execute actions, only provides information
 * - "confirm": Chatbot proposes actions and waits for user confirmation (safest, default)
 * - "auto": Chatbot executes actions automatically without confirmation
 */
export type ActionMode = "off" | "confirm" | "auto";

/**
 * Get the current user's action mode preference.
 *
 * Returns the action mode for the authenticated user, or "confirm" as the
 * default for unauthenticated users or users without a profile.
 *
 * @returns The action mode ("off" | "confirm" | "auto")
 */
export const getActionMode = query({
  args: {},
  handler: async (ctx): Promise<ActionMode> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return "confirm"; // Default for unauthenticated users
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile?.actionMode ?? "confirm"; // Default to "confirm" (safest)
  },
});

/**
 * Update the current user's action mode preference.
 *
 * Controls how the chatbot handles actions that modify case data:
 * - "off": Chatbot cannot execute actions, only provides information
 * - "confirm": Chatbot proposes actions and waits for user confirmation (safest)
 * - "auto": Chatbot executes actions automatically without confirmation
 *
 * @param actionMode - The new action mode to set
 * @returns Object with success status and the new action mode
 */
export const updateActionMode = mutation({
  args: {
    actionMode: v.union(v.literal("off"), v.literal("confirm"), v.literal("auto")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found. Please ensure your profile exists.");
    }

    await ctx.db.patch(profile._id, {
      actionMode: args.actionMode,
      updatedAt: Date.now(),
    });

    return { success: true, actionMode: args.actionMode };
  },
});

// ============================================================================
// ACCOUNT DELETION MUTATIONS
// ============================================================================

/**
 * Request account deletion with 30-day grace period.
 *
 * This initiates a soft delete by setting deletedAt to 30 days in the future.
 * The user can cancel the deletion within the grace period.
 * After the grace period, a scheduled job will permanently delete the data.
 *
 * @returns Object with success status and scheduled deletion date
 */
export const requestAccountDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Calculate grace period (30 days from now)
    const gracePeriodMs = 30 * 24 * 60 * 60 * 1000;
    const deletionDate = Date.now() + gracePeriodMs;

    // Schedule the permanent deletion job to run after the grace period
    const scheduledJobId = await ctx.scheduler.runAt(
      deletionDate,
      internal.scheduledJobs.permanentlyDeleteAccount,
      { userId: userId }
    );

    // Set deletedAt and save the scheduled job ID on the user profile
    await ctx.db.patch(profile._id, {
      deletedAt: deletionDate,
      updatedAt: Date.now(),
      scheduledDeletionJobId: scheduledJobId,
    });

    // Also set deletedAt on the users table
    await ctx.db.patch(userId, {
      deletedAt: deletionDate,
    });

    // Get user email to send confirmation
    const user = await ctx.db.get(userId);
    if (user?.email) {
      // Format deletion date for human readability
      const { formatDateForNotification } = await import("./lib/formatDate");
      const deletionDateFormatted = formatDateForNotification(deletionDate, true);

      // Schedule deletion confirmation email (runs immediately via runAfter(0))
      await ctx.scheduler.runAfter(
        0,
        internal.notificationActions.sendAccountDeletionEmail,
        {
          to: user.email,
          userName: profile.fullName || user.name || user.email,
          deletionDate: deletionDateFormatted,
        }
      );
    }

    return {
      success: true,
      deletionDate,
      message: `Account will be permanently deleted after ${new Date(deletionDate).toISOString()}`,
    };
  },
});

/**
 * Cancel a scheduled account deletion.
 *
 * This removes the deletedAt timestamp, effectively canceling the scheduled deletion.
 * Can only be called during the grace period before permanent deletion.
 *
 * @returns Object with success status
 */
export const cancelAccountDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Verify deletion was actually scheduled
    if (!profile.deletedAt) {
      throw new Error("No deletion scheduled for this account");
    }

    // Verify we're still within the grace period
    if (profile.deletedAt < Date.now()) {
      throw new Error("Grace period has expired. Account deletion cannot be cancelled.");
    }

    // Cancel the scheduled deletion job if it exists
    if (profile.scheduledDeletionJobId) {
      await ctx.scheduler.cancel(profile.scheduledDeletionJobId);
    }

    // Clear deletedAt and scheduledDeletionJobId on the user profile
    await ctx.db.patch(profile._id, {
      deletedAt: undefined,
      scheduledDeletionJobId: undefined,
      updatedAt: Date.now(),
    });

    // Also clear deletedAt on the users table
    await ctx.db.patch(userId, {
      deletedAt: undefined,
    });

    return { success: true };
  },
});

/**
 * Internal helper to prepare an account for immediate deletion.
 *
 * Cancels the scheduled job, sets deletedAt to the past so the
 * permanentlyDeleteAccount guard passes, and returns user info for email.
 */
export const prepareImmediateDeletion = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    if (!profile.deletedAt) {
      throw new Error("No deletion scheduled for this account");
    }

    if (profile.deletedAt < Date.now()) {
      throw new Error("Grace period has expired. Account is being deleted automatically.");
    }

    // Cancel the existing scheduled deletion job
    if (profile.scheduledDeletionJobId) {
      await ctx.scheduler.cancel(profile.scheduledDeletionJobId);
    }

    // Get user info for email before deletion
    const user = await ctx.db.get(userId);
    const email = user?.email;
    const userName = profile.fullName || user?.name || user?.email || "User";

    // Set deletedAt to past so permanentlyDeleteAccount guard passes
    await ctx.db.patch(userId, {
      deletedAt: Date.now() - 1000,
    });
    await ctx.db.patch(profile._id, {
      deletedAt: Date.now() - 1000,
      scheduledDeletionJobId: undefined,
      updatedAt: Date.now(),
    });

    return { email, userName };
  },
});

/**
 * Immediately delete a user's account.
 *
 * This bypasses the 30-day grace period for users who have already
 * scheduled deletion. Sends a confirmation email, then permanently
 * deletes all user data.
 *
 * Precondition: User must have an active scheduled deletion (deletedAt set and in future).
 *
 * @returns Object with success status
 */
export const immediateAccountDeletion = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = extractUserIdFromAction(identity.subject);

    // Prepare: cancel scheduled job, set deletedAt to past, get user info
    const { email, userName } = await ctx.runMutation(
      internal.users.prepareImmediateDeletion,
      { userId }
    );

    // Send confirmation email before deletion
    if (email) {
      try {
        await ctx.runAction(
          internal.notificationActions.sendAccountDeletionEmail,
          { to: email, userName, immediate: true }
        );
      } catch (emailError) {
        // Log but don't block deletion on email failure
        log.error("Failed to send immediate deletion email", {
          error: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    // Permanently delete all user data
    await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
      userId,
    });

    return { success: true, message: "Account permanently deleted" };
  },
});
