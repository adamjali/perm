import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull, extractUserIdFromAction } from "./lib/auth";
import { encryptToken } from "./lib/crypto";
import { logCreate, logUpdate } from "./lib/audit";
import { validateInputLengths, INPUT_LIMITS } from "./lib/validation";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";
import { buildDefaultProfile } from "./lib/userDefaults";
import { formatDateForNotification } from "./lib/formatDate";

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
 * Check if the current user is an admin.
 * Returns { isAdmin: boolean } — server-side check, no secrets exposed to client.
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return { isAdmin: false };

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return { isAdmin: false };

    const user = await ctx.db.get(userId);
    return { isAdmin: user?.email === adminEmail };
  },
});

/**
 * Check if the current user should be excluded from PostHog analytics.
 * Exclusion list stored in POSTHOG_EXCLUDED_EMAILS env var (comma-separated).
 * Entries starting with "@" match email domains; others are exact matches.
 */
export const isPostHogExcluded = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return false;

    const excludedCsv = process.env.POSTHOG_EXCLUDED_EMAILS;
    if (!excludedCsv) return false;

    const user = await ctx.db.get(userId);
    const email = user?.email?.toLowerCase();
    if (!email) return false;

    const entries = excludedCsv.split(",").map((e) => e.trim().toLowerCase());
    return entries.some((entry) =>
      entry.startsWith("@") ? email.endsWith(entry) : email === entry
    );
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
      return existingProfile._id;
    }

    // Get the user record to copy name and image from auth
    const user = await ctx.db.get(userId);

    // Create new profile with default values
    const profileId = await ctx.db.insert("userProfiles", buildDefaultProfile(
      userId,
      { fullName: user?.name, profilePhotoUrl: user?.image }
    ));

    // Welcome email for new signup
    if (user?.email) {
      try {
        const displayName = user.name || user.email.split("@")[0] || "there";
        await ctx.scheduler.runAfter(0, internal.welcomeEmail.sendWelcomeEmail, {
          to: user.email,
          userName: displayName,
        });
      } catch (welcomeError) {
        log.error("Failed to schedule welcome email", {
          error: welcomeError instanceof Error ? welcomeError.message : String(welcomeError),
        });
        await recordError(ctx, "mutation", "users.ensureUserProfile.welcome", welcomeError, { userId });
      }
    }

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
      await recordError(ctx, "mutation", "users.ensureUserProfile.adminNotif", adminNotifError, { userId });
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
    const defaultProfile = buildDefaultProfile(
      args.userId,
      { fullName: user?.name, profilePhotoUrl: user?.image }
    );
    const profileId = await ctx.db.insert("userProfiles", defaultProfile);

    // Audit: profile creation (explicit userId since internalMutation has no auth context)
    await logCreate(ctx, "userProfiles", profileId, defaultProfile as Record<string, unknown>, undefined, args.userId);

    // Welcome email for new signup
    if (user?.email) {
      try {
        const displayName = user.name || user.email.split("@")[0] || "there";
        await ctx.scheduler.runAfter(0, internal.welcomeEmail.sendWelcomeEmail, {
          to: user.email,
          userName: displayName,
        });
      } catch (welcomeError) {
        log.error("Failed to schedule welcome email", {
          error: welcomeError instanceof Error ? welcomeError.message : String(welcomeError),
        });
        await recordError(ctx, "mutation", "users.ensureUserProfileInternal.welcome", welcomeError, { userId: args.userId });
      }
    }

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
      await recordError(ctx, "mutation", "users.ensureUserProfileInternal.adminNotif", adminNotifError, { userId: args.userId });
    }

    return profileId;
  },
});

/**
 * Public mutation: record login for the current authenticated user.
 * Called from the LoginTracker client component on every sign-in.
 *
 * The Convex Auth library's createOrUpdateUser callback only fires for
 * OAuth and new accounts — it does NOT fire for password sign-ins of
 * existing users (retrieveAccountWithCredentials bypasses it). This
 * public mutation is called client-side to cover ALL auth flows.
 */
export const recordMyLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) return;

    await ctx.db.patch(profile._id, {
      loginCount: (profile.loginCount ?? 0) + 1,
      lastLoginAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Record user activity for server-side inactivity enforcement.
 * Called by the client heartbeat every 5 minutes while the user is active.
 * Same pattern as recordMyLogin — only updates the caller's own profile.
 */
export const recordActivity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) return;

    await ctx.db.patch(profile._id, { lastActiveAt: Date.now() });
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

    // Input length validation (PI1 — Processing Integrity)
    validateInputLengths([
      { value: args.fullName, name: "Full Name", limit: INPUT_LIMITS.SHORT },
      { value: args.company, name: "Company", limit: INPUT_LIMITS.SHORT },
      { value: args.jobTitle, name: "Job Title", limit: INPUT_LIMITS.SHORT },
      { value: args.firmName, name: "Firm Name", limit: INPUT_LIMITS.SHORT },
    ]);

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
        await recordError(ctx, "mutation", "users.updateUserProfile.adminNotif", adminNotifError, { userId });
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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

    // Apply the update with proper typing
    await ctx.db.patch(profile._id, {
      ...updateData,
      updatedAt: Date.now(),
    });

    // Audit: profile update
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

    return profile._id;
  },
});

// ============================================================================
// TERMS ACCEPTANCE MUTATIONS
// ============================================================================

/**
 * Record user acceptance of Terms of Service and Privacy Policy.
 *
 * Terms are now auto-stamped at profile creation via buildDefaultProfile().
 * This mutation is retained for future re-consent flows (e.g., when terms are updated
 * and existing users need to accept a new version).
 *
 * @param termsVersion - The effective date of the ToS being accepted (e.g., "2026-02-17")
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
      const defaultProfile = buildDefaultProfile(
        userId,
        { fullName: user?.name, profilePhotoUrl: user?.image, termsAcceptedAt: Date.now(), termsVersion }
      );
      const profileId = await ctx.db.insert("userProfiles", defaultProfile);

      // Audit: profile creation with terms acceptance
      await logCreate(ctx, "userProfiles", profileId, defaultProfile as Record<string, unknown>);

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
        await recordError(ctx, "mutation", "users.acceptTermsOfService.adminNotif", adminNotifError, { userId });
      }

      return { success: true, profileId };
    }

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

    // Update existing profile with terms acceptance
    await ctx.db.patch(profile._id, {
      termsAcceptedAt: Date.now(),
      termsVersion,
      updatedAt: Date.now(),
    });

    // Audit: terms acceptance (legal record — CRITICAL)
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

    // Update profile with subscription
    await ctx.db.patch(profile._id, {
      pushSubscription: subscription,
      pushNotificationsEnabled: true,
      updatedAt: Date.now(),
    });

    // Audit: push subscription saved
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

    // Clear subscription and disable push
    await ctx.db.patch(profile._id, {
      pushSubscription: undefined,
      pushNotificationsEnabled: false,
      updatedAt: Date.now(),
    });

    // Audit: push subscription removed
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

    await ctx.db.patch(profile._id, {
      actionMode: args.actionMode,
      updatedAt: Date.now(),
    });

    // Audit: action mode change
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

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

    // Audit: account deletion requested (CRITICAL — legal record)
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

    // Get user email to send confirmation
    const user = await ctx.db.get(userId);
    if (user?.email) {
      // Format deletion date for human readability
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

    // Capture old doc for audit
    const oldDoc = { ...profile } as Record<string, unknown>;

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

    // Audit: account deletion cancelled (CRITICAL — legal record)
    const updatedProfile = await ctx.db.get(profile._id);
    if (updatedProfile) {
      await logUpdate(ctx, "userProfiles", profile._id, oldDoc, updatedProfile as Record<string, unknown>);
    }

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
        await recordError(ctx, "action", "users.immediateAccountDeletion.email", emailError, { userId });
      }
    }

    // Permanently delete all user data
    await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
      userId,
    });

    return { success: true, message: "Account permanently deleted" };
  },
});
