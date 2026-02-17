/**
 * Scheduled Jobs for Notification System
 *
 * Internal actions and queries called by crons.ts for automated notification tasks.
 * These functions are NOT exposed to the client API.
 *
 * JOBS:
 * - checkDeadlineReminders: Daily check for upcoming deadlines, creates notifications + emails
 * - cleanupOldNotifications: Hourly cleanup of read notifications older than 90 days
 * - sendWeeklyDigest: Weekly summary email for opted-in users
 *
 * QUERIES:
 * - getCasesNeedingReminders: Find cases with upcoming deadlines that need notifications
 * - getUsersForWeeklyDigest: Find users who want weekly digest emails
 *
 * All functions use `internal` prefix for security - never exposed to clients.
 *
 * @see crons.ts for scheduling configuration
 * @see notificationActions.ts for email sending actions
 * @see lib/notificationHelpers.ts for helper functions
 * @module
 */

import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = loggers.scheduler;
import {
  generateNotificationTitle,
  generateNotificationMessage,
  calculatePriority,
  formatDeadlineType,
  shouldSendEmail,
  type NotificationType,
  type DeadlineNotificationType,
  type UserNotificationPrefs,
} from "./lib/notificationHelpers";
import {
  shouldRemindForDeadline,
  getActiveRfiEntry,
  getActiveRfeEntry,
  extractActiveDeadlines,
  type CaseDataForDeadlines,
} from "./lib/perm/deadlines";
import {
  getTodayForDeadline,
  DEFAULT_USER_TIMEZONE,
} from "./lib/perm/deadlines/timezones";
import type { DeadlineType } from "./lib/perm/deadlines";
import {
  buildDigestContent,
  type RawDeadlineData,
  type RawCaseUpdateData,
} from "./lib/digestHelpers";
import { purgeAllUserData } from "./lib/deletion";
import { DEFAULT_NOTIFICATION_PREFS } from "./lib/userDefaults";

// ============================================================================
// TYPES
// ============================================================================

/**
 * A reminder that needs to be created for a deadline.
 */
interface DeadlineReminder {
  userId: Id<"users">;
  caseId: Id<"cases">;
  deadlineType: DeadlineNotificationType;
  deadlineDate: string; // ISO date string
  daysUntilDeadline: number;
  employerName: string;
  beneficiaryIdentifier: string;
  userEmail: string;
  userPrefs: UserNotificationPrefs;
}

/**
 * Get default notification preferences from the canonical factory.
 */
function getDefaultPrefs(): UserNotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

/**
 * Build UserNotificationPrefs from a userProfile document.
 */
function buildUserPrefs(profile: Doc<"userProfiles">): UserNotificationPrefs {
  return {
    emailNotificationsEnabled: profile.emailNotificationsEnabled,
    emailDeadlineReminders: profile.emailDeadlineReminders,
    emailStatusUpdates: profile.emailStatusUpdates,
    emailRfeAlerts: profile.emailRfeAlerts,
    pushNotificationsEnabled: profile.pushNotificationsEnabled ?? false,
    quietHoursEnabled: profile.quietHoursEnabled,
    quietHoursStart: profile.quietHoursStart,
    quietHoursEnd: profile.quietHoursEnd,
    timezone: profile.timezone,
  };
}

/**
 * Get current time in user's timezone as HH:MM format.
 */
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    return formatter.format(now);
  } catch (error) {
    // Log invalid timezone for debugging - this indicates data corruption or invalid user preference
    log.warn('Invalid timezone, falling back to UTC', {
      timezone,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    // Note: no ctx available for error recording
    const now = new Date();
    return `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`;
  }
}

/**
 * Format a date string to a human-readable format.
 */
function formatDateForEmail(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Calculate days until a deadline using timezone-aware "today" resolution.
 *
 * @param deadlineDate - ISO date string (YYYY-MM-DD)
 * @param deadlineType - The deadline type (determines timezone rule)
 * @param userTimezone - User's IANA timezone
 * @returns Number of days until the deadline (negative = overdue)
 */
function daysUntilDeadline(
  deadlineDate: string,
  deadlineType: DeadlineType,
  userTimezone: string
): number {
  const todayStr = getTodayForDeadline(deadlineType, userTimezone);
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
  const deadlineMs = new Date(deadlineDate + "T00:00:00Z").getTime();
  return Math.ceil((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all cases with upcoming deadlines that need reminder notifications.
 *
 * Checks the following deadline types:
 * - PWD expiration (pwdExpirationDate)
 * - Filing window closes (filingWindowCloses)
 * - I-140 filing deadline (180 days from ETA 9089 certification)
 * - RFI response due dates (rfiEntries[].responseDueDate)
 * - RFE response due dates (rfeEntries[].responseDueDate)
 *
 * Deduplication: Excludes deadlines that already have a notification for the
 * same (caseId, deadlineType, daysUntilDeadline) combination.
 */
export const getCasesNeedingReminders = internalQuery({
  args: {},
  handler: async (ctx): Promise<DeadlineReminder[]> => {
    const reminders: DeadlineReminder[] = [];

    // Get all user profiles with their settings
    const userProfiles = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Build a map of userId -> profile for quick lookup
    const profilesByUserId = new Map<Id<"users">, Doc<"userProfiles">>();
    for (const profile of userProfiles) {
      profilesByUserId.set(profile.userId, profile);
    }

    // Get all users to find their emails
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const userEmailById = new Map<Id<"users">, string>();
    for (const user of users) {
      if (user.email) {
        userEmailById.set(user._id, user.email);
      }
    }

    // Get all existing notifications for deduplication
    const existingNotifications = await ctx.db
      .query("notifications")
      .filter((q) => q.eq(q.field("type"), "deadline_reminder"))
      .collect();

    // Build a set of existing notification keys for O(1) lookup
    const existingKeys = new Set<string>();
    for (const notif of existingNotifications) {
      if (notif.caseId && notif.deadlineType && notif.daysUntilDeadline !== undefined) {
        existingKeys.add(`${notif.caseId}:${notif.deadlineType}:${notif.daysUntilDeadline}`);
      }
    }

    // Get all active cases (not deleted, not closed)
    const cases = await ctx.db
      .query("cases")
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.neq(q.field("caseStatus"), "closed")
        )
      )
      .collect();

    // Process each case for deadlines
    for (const caseDoc of cases) {
      const profile = profilesByUserId.get(caseDoc.userId);
      const userEmail = userEmailById.get(caseDoc.userId);

      // Skip if no email address
      if (!userEmail) continue;

      const userPrefs = profile ? buildUserPrefs(profile) : getDefaultPrefs();
      const reminderDays = profile?.reminderDaysBefore ?? [1, 3, 7, 14, 30];
      const userTz = profile?.timezone || DEFAULT_USER_TIMEZONE;

      // Helper to check and add deadline reminders.
      // Uses timezone-aware "today" based on the deadline type's timezone rule.
      const checkDeadline = (
        deadlineDate: string | undefined,
        deadlineType: DeadlineNotificationType,
        tzDeadlineType: DeadlineType
      ) => {
        if (!deadlineDate) return;

        const daysUntil = daysUntilDeadline(deadlineDate, tzDeadlineType, userTz);

        // Check if this matches any reminder interval
        for (const daysBefore of reminderDays) {
          if (daysUntil === Number(daysBefore) || daysUntil === 0 || daysUntil < 0) {
            // For overdue, only send once (at days = -1 to avoid spam)
            if (daysUntil < 0 && daysUntil !== -1) continue;

            // Check for deduplication
            const key = `${caseDoc._id}:${deadlineType}:${daysUntil}`;
            if (existingKeys.has(key)) continue;

            reminders.push({
              userId: caseDoc.userId,
              caseId: caseDoc._id,
              deadlineType,
              deadlineDate,
              daysUntilDeadline: daysUntil,
              employerName: caseDoc.employerName,
              beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
              userEmail,
              userPrefs,
            });

            // Only add once per deadline type (use the closest matching interval)
            break;
          }
        }
      };

      // Convert case to CaseDataForDeadlines for supersession checks
      const caseDataForDeadlines: CaseDataForDeadlines = {
        _id: caseDoc._id,
        caseStatus: caseDoc.caseStatus,
        deletedAt: caseDoc.deletedAt,
        pwdExpirationDate: caseDoc.pwdExpirationDate,
        eta9089FilingDate: caseDoc.eta9089FilingDate,
        eta9089CertificationDate: caseDoc.eta9089CertificationDate,
        eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
        i140FilingDate: caseDoc.i140FilingDate,
        filingWindowOpens: caseDoc.filingWindowOpens,
        filingWindowCloses: caseDoc.filingWindowCloses,
        recruitmentWindowCloses: caseDoc.recruitmentWindowCloses,
        sundayAdFirstDate: caseDoc.sundayAdFirstDate,
        sundayAdSecondDate: caseDoc.sundayAdSecondDate,
        jobOrderStartDate: caseDoc.jobOrderStartDate,
        noticeOfFilingStartDate: caseDoc.noticeOfFilingStartDate,
        rfiEntries: caseDoc.rfiEntries,
        rfeEntries: caseDoc.rfeEntries,
      };

      // Check PWD expiration (superseded when ETA 9089 filed)
      if (shouldRemindForDeadline("pwd_expiration", caseDataForDeadlines)) {
        checkDeadline(caseDoc.pwdExpirationDate, "pwd_expiration", "pwd_expiration");
      }

      // Check filing window closes (superseded when ETA 9089 filed)
      if (shouldRemindForDeadline("filing_window_closes", caseDataForDeadlines)) {
        checkDeadline(caseDoc.filingWindowCloses, "filing_window_closes", "filing_window_closes");
      }

      // Check I-140 filing deadline (superseded when I-140 filed)
      // Uses eta9089ExpirationDate as the deadline (180 days from certification)
      if (shouldRemindForDeadline("i140_filing_deadline", caseDataForDeadlines)) {
        checkDeadline(caseDoc.eta9089ExpirationDate, "i140_filing_deadline", "i140_filing_deadline");
      }

      // Check RFI due dates (superseded when response submitted)
      if (shouldRemindForDeadline("rfi_due", caseDataForDeadlines)) {
        const activeRfi = getActiveRfiEntry(caseDoc.rfiEntries ?? []);
        if (activeRfi?.responseDueDate) {
          checkDeadline(activeRfi.responseDueDate, "rfi_due", "rfi_due");
        }
      }

      // Check RFE due dates (superseded when response submitted)
      if (shouldRemindForDeadline("rfe_due", caseDataForDeadlines)) {
        const activeRfe = getActiveRfeEntry(caseDoc.rfeEntries ?? []);
        if (activeRfe?.responseDueDate) {
          checkDeadline(activeRfe.responseDueDate, "rfe_due", "rfe_due");
        }
      }

      // Check recruitment window closes (superseded when ETA 9089 filed)
      if (shouldRemindForDeadline("recruitment_window_closes", caseDataForDeadlines)) {
        checkDeadline(caseDoc.recruitmentWindowCloses, "recruitment_window_closes", "recruitment_window_closes");
      }

      // Per-step recruitment deadlines (computed from central system)
      // Extract once, then check each per-step type
      const perStepTypes = [
        "job_order_start_deadline",
        "notice_of_filing_start_deadline",
        "first_sunday_ad_deadline",
        "second_sunday_ad_deadline",
      ] as const;
      const needsPerStep = perStepTypes.some((t) => shouldRemindForDeadline(t, caseDataForDeadlines));
      if (needsPerStep) {
        const extracted = extractActiveDeadlines(caseDataForDeadlines);
        for (const pType of perStepTypes) {
          if (shouldRemindForDeadline(pType, caseDataForDeadlines)) {
            const match = extracted.find((d) => d.type === pType);
            if (match) {
              checkDeadline(match.date, pType, pType);
            }
          }
        }
      }
    }

    return reminders;
  },
});

/**
 * Get users who have opted into weekly digest emails.
 * Filters by emailWeeklyDigest preference (defaults to true for new users).
 */
export const getUsersForWeeklyDigest = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<{
    userId: Id<"users">;
    email: string;
    userName: string;
    profile: Doc<"userProfiles">;
  }>> => {
    // Get profiles with weekly digest enabled
    const profiles = await ctx.db
      .query("userProfiles")
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.eq(q.field("emailNotificationsEnabled"), true),
          // emailWeeklyDigest defaults to true, so we check for !== false
          q.neq(q.field("emailWeeklyDigest"), false)
        )
      )
      .collect();

    const results: Array<{
      userId: Id<"users">;
      email: string;
      userName: string;
      profile: Doc<"userProfiles">;
    }> = [];

    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (user?.email && !user.deletedAt) {
        results.push({
          userId: profile.userId,
          email: user.email,
          userName: profile.fullName ?? user.name ?? user.email.split("@")[0] ?? "there",
          profile,
        });
      }
    }

    return results;
  },
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Main daily job: Check all cases for upcoming deadlines and create notifications.
 *
 * Process:
 * 1. Query all cases needing reminders (with deduplication)
 * 2. For each reminder:
 *    a. Create notification in database
 *    b. If user has email enabled, schedule email action
 *    c. If push enabled (future), schedule push action
 *
 * Idempotent: Uses deduplication query to prevent duplicate notifications.
 */
export const checkDeadlineReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; emailsScheduled: number }> => {
    // Get all reminders that need to be created
    const reminders = await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders);

    let processed = 0;
    let emailsScheduled = 0;

    // Stagger emails by 600ms each to stay under Resend's 2 req/sec rate limit
    let emailIndex = 0;

    for (const reminder of reminders) {
      // Determine notification type based on deadline type
      let notificationType: NotificationType = "deadline_reminder";
      if (reminder.deadlineType === "rfi_due") {
        notificationType = "rfi_alert";
      } else if (reminder.deadlineType === "rfe_due") {
        notificationType = "rfe_alert";
      }

      // Build case label for messages
      const caseLabel = `${reminder.beneficiaryIdentifier} at ${reminder.employerName}`;

      // Generate title and message
      const title = generateNotificationTitle(notificationType, {
        deadlineType: reminder.deadlineType,
        daysUntilDeadline: reminder.daysUntilDeadline,
        caseLabel,
      });

      const message = generateNotificationMessage(notificationType, {
        deadlineType: reminder.deadlineType,
        daysUntilDeadline: reminder.daysUntilDeadline,
        caseLabel,
        deadlineDate: reminder.deadlineDate,
        employerName: reminder.employerName,
        beneficiaryIdentifier: reminder.beneficiaryIdentifier,
      });

      // Calculate priority
      const priority = calculatePriority(reminder.daysUntilDeadline, notificationType);

      // Create the notification
      const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
        userId: reminder.userId,
        caseId: reminder.caseId,
        type: notificationType,
        title,
        message,
        priority,
        deadlineDate: reminder.deadlineDate,
        deadlineType: reminder.deadlineType,
        daysUntilDeadline: Number(reminder.daysUntilDeadline),
      });

      processed++;

      // Check if email should be sent
      const currentTime = getCurrentTimeInTimezone(reminder.userPrefs.timezone);
      const sendEmail = shouldSendEmail(
        notificationType,
        priority,
        reminder.userPrefs,
        currentTime
      );

      if (sendEmail) {
        // Schedule appropriate email based on notification type
        // Stagger by 600ms to stay under Resend's 2 req/sec rate limit
        const formattedDate = formatDateForEmail(reminder.deadlineDate);
        const formattedDeadlineType = formatDeadlineType(reminder.deadlineType);
        const delayMs = emailIndex * 600;

        if (notificationType === "rfi_alert") {
          await ctx.scheduler.runAfter(delayMs, internal.notificationActions.sendRfiAlertEmail, {
            notificationId,
            to: reminder.userEmail,
            beneficiaryName: reminder.beneficiaryIdentifier,
            companyName: reminder.employerName,
            dueDate: formattedDate,
            daysRemaining: reminder.daysUntilDeadline,
            receivedDate: formattedDate, // We don't have this, use deadline as fallback
            alertType: "reminder" as const,
            caseId: reminder.caseId,
          });
        } else if (notificationType === "rfe_alert") {
          await ctx.scheduler.runAfter(delayMs, internal.notificationActions.sendRfeAlertEmail, {
            notificationId,
            to: reminder.userEmail,
            beneficiaryName: reminder.beneficiaryIdentifier,
            companyName: reminder.employerName,
            dueDate: formattedDate,
            daysRemaining: reminder.daysUntilDeadline,
            receivedDate: formattedDate, // We don't have this, use deadline as fallback
            alertType: "reminder" as const,
            caseId: reminder.caseId,
          });
        } else {
          // Standard deadline reminder email
          await ctx.scheduler.runAfter(delayMs, internal.notificationActions.sendDeadlineReminderEmail, {
            notificationId,
            to: reminder.userEmail,
            employerName: reminder.employerName,
            beneficiaryName: reminder.beneficiaryIdentifier,
            deadlineType: formattedDeadlineType,
            deadlineDate: formattedDate,
            daysUntil: reminder.daysUntilDeadline,
            caseId: reminder.caseId,
          });
        }

        emailIndex++;
        emailsScheduled++;
      }

      // Schedule push notification if user has push enabled
      // Push follows same quiet hours logic as email
      if (reminder.userPrefs.pushNotificationsEnabled && sendEmail) {
        await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPushNotification, {
          userId: reminder.userId,
          title,
          body: message,
          url: `/cases/${reminder.caseId}`,
          tag: `deadline-${reminder.caseId}-${reminder.deadlineType}`,
        });
      }
    }

    return { processed, emailsScheduled };
  },
});

/**
 * Hourly cleanup: Delete read notifications older than 90 days.
 *
 * Keeps:
 * - All unread notifications (regardless of age)
 * - Read notifications newer than 90 days
 *
 * Deletes:
 * - Read notifications older than 90 days
 */
export const cleanupOldNotifications = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // Get old read notifications
    const oldNotifications = await ctx.runQuery(
      internal.scheduledJobs.getOldReadNotifications,
      { olderThan: ninetyDaysAgo }
    );

    let deleted = 0;
    for (const notificationId of oldNotifications) {
      await ctx.runMutation(internal.scheduledJobs.deleteNotification, {
        notificationId,
      });
      deleted++;
    }

    return { deleted };
  },
});

/**
 * Query for old read notifications (helper for cleanup action).
 */
export const getOldReadNotifications = internalQuery({
  args: {
    olderThan: v.number(),
  },
  handler: async (ctx, { olderThan }): Promise<Id<"notifications">[]> => {
    const notifications = await ctx.db
      .query("notifications")
      .filter((q) =>
        q.and(
          q.eq(q.field("isRead"), true),
          q.lt(q.field("createdAt"), olderThan)
        )
      )
      .take(1000); // Batch limit to prevent timeout

    return notifications.map((n) => n._id);
  },
});

/**
 * Delete a single notification (helper for cleanup action).
 */
export const deleteNotification = internalMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.delete(notificationId);
  },
});

/**
 * Weekly digest email sender.
 *
 * Sends a summary email containing:
 * - Overdue deadlines (past due)
 * - Upcoming deadlines (next 7 days)
 * - Later deadlines (days 8-14)
 * - Recent case updates (last 7 days)
 * - Unread notification count
 *
 * Always sends to opted-in users, even if empty (shows "No urgent deadlines!" message).
 */
export const sendWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; skipped: number }> => {
    // Get users who should receive digest
    const users = await ctx.runQuery(internal.scheduledJobs.getUsersForWeeklyDigest);

    let sent = 0;
    let skipped = 0;

    // Stagger emails by 600ms each to stay under Resend's 2 req/sec rate limit
    let emailIndex = 0;

    for (const { userId, email, userName } of users) {
      let step = "initializing";
      try {
        // Get all deadlines for digest (overdue + next 14 days)
        step = "fetching deadlines";
        const rawDeadlines = await ctx.runQuery(
          internal.scheduledJobs.getDeadlinesForDigest,
          { userId }
        );

        // Get recently updated cases (last 7 days)
        step = "fetching case updates";
        const rawCaseUpdates = await ctx.runQuery(
          internal.scheduledJobs.getRecentlyUpdatedCases,
          { userId }
        );

        // Get active case count
        step = "fetching active case count";
        const totalActiveCases = await ctx.runQuery(
          internal.scheduledJobs.getActiveCaseCountForUser,
          { userId }
        );

        // Get unread notification count
        step = "fetching unread count";
        const unreadNotificationCount = await ctx.runQuery(
          internal.scheduledJobs.getUnreadCountForUser,
          { userId }
        );

        // Build digest content
        step = "building digest content";
        const digestContent = buildDigestContent({
          userName,
          userEmail: email,
          totalActiveCases,
          unreadNotificationCount,
          rawDeadlines,
          rawCaseUpdates,
        });

        // Schedule the email with staggered delay (600ms apart to stay under 2 req/sec)
        step = "scheduling email";
        const delayMs = emailIndex * 600;
        await ctx.scheduler.runAfter(delayMs, internal.notificationActions.sendWeeklyDigestEmail, {
          to: email,
          digestContent,
        });

        emailIndex++;
        sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Weekly digest failed for user', {
          resourceId: userId,
          step,
          error: errorMessage,
        });
        await recordError(ctx, "cron", "scheduledJobs.sendWeeklyDigest.process", error, { userId, extra: step });
        skipped++;
      }
    }

    log.info('Weekly digest complete', { sent, skipped });
    return { sent, skipped };
  },
});

/**
 * Get all deadlines for digest (overdue + next 14 days).
 * Returns raw deadline data for transformation by digestHelpers.
 */
export const getDeadlinesForDigest = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<RawDeadlineData[]> => {
    // Look up user timezone for timezone-aware "today" resolution
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const userTz = userProfile?.timezone || DEFAULT_USER_TIMEZONE;

    // Use the most conservative "today" (UTC) for date range filtering.
    // Per-deadline timezone resolution happens in daysUntil calculation.
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    // Include deadlines from 30 days ago (to capture overdue) to 14 days ahead
    const pastDate = new Date(todayUtc.getTime() - 30 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(todayUtc.getTime() + 14 * 24 * 60 * 60 * 1000);
    const pastDateStr = pastDate.toISOString().split("T")[0]!;
    const futureDateStr = futureDate.toISOString().split("T")[0]!;

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.neq(q.field("caseStatus"), "closed")
        )
      )
      .collect();

    const deadlines: RawDeadlineData[] = [];

    for (const caseDoc of cases) {
      const addDeadline = (date: string | undefined, type: string, tzType: DeadlineType) => {
        if (!date) return;
        if (date >= pastDateStr && date <= futureDateStr) {
          const daysUntil = daysUntilDeadline(date, tzType, userTz);
          deadlines.push({
            caseId: caseDoc._id,
            employerName: caseDoc.employerName,
            beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
            deadlineType: type,
            deadlineDate: date,
            daysUntil,
          });
        }
      };

      // Build case data for centralized supersession checks
      const caseDataForDeadlines: CaseDataForDeadlines = {
        _id: caseDoc._id,
        caseStatus: caseDoc.caseStatus,
        deletedAt: caseDoc.deletedAt,
        pwdExpirationDate: caseDoc.pwdExpirationDate,
        eta9089FilingDate: caseDoc.eta9089FilingDate,
        eta9089CertificationDate: caseDoc.eta9089CertificationDate,
        eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
        i140FilingDate: caseDoc.i140FilingDate,
        filingWindowOpens: caseDoc.filingWindowOpens,
        filingWindowCloses: caseDoc.filingWindowCloses,
        recruitmentWindowCloses: caseDoc.recruitmentWindowCloses,
        sundayAdFirstDate: caseDoc.sundayAdFirstDate,
        sundayAdSecondDate: caseDoc.sundayAdSecondDate,
        jobOrderStartDate: caseDoc.jobOrderStartDate,
        noticeOfFilingStartDate: caseDoc.noticeOfFilingStartDate,
        rfiEntries: caseDoc.rfiEntries,
        rfeEntries: caseDoc.rfeEntries,
      };

      if (shouldRemindForDeadline("pwd_expiration", caseDataForDeadlines)) {
        addDeadline(caseDoc.pwdExpirationDate, "PWD Expiration", "pwd_expiration");
      }

      if (shouldRemindForDeadline("filing_window_closes", caseDataForDeadlines)) {
        addDeadline(caseDoc.filingWindowCloses, "Filing Window Closes", "filing_window_closes");
      }

      if (shouldRemindForDeadline("i140_filing_deadline", caseDataForDeadlines)) {
        addDeadline(caseDoc.eta9089ExpirationDate, "I-140 Filing Deadline", "i140_filing_deadline");
      }

      if (shouldRemindForDeadline("rfi_due", caseDataForDeadlines)) {
        const activeRfi = getActiveRfiEntry(caseDoc.rfiEntries ?? []);
        if (activeRfi?.responseDueDate) {
          addDeadline(activeRfi.responseDueDate, "RFI Response Due", "rfi_due");
        }
      }

      if (shouldRemindForDeadline("rfe_due", caseDataForDeadlines)) {
        const activeRfe = getActiveRfeEntry(caseDoc.rfeEntries ?? []);
        if (activeRfe?.responseDueDate) {
          addDeadline(activeRfe.responseDueDate, "RFE Response Due", "rfe_due");
        }
      }

      // Per-step recruitment deadlines for digest
      if (shouldRemindForDeadline("recruitment_window_closes", caseDataForDeadlines)) {
        addDeadline(caseDoc.recruitmentWindowCloses, "Recruitment Window Closes", "recruitment_window_closes");
      }
      const digestPerStepTypes = [
        "job_order_start_deadline",
        "notice_of_filing_start_deadline",
        "first_sunday_ad_deadline",
        "second_sunday_ad_deadline",
      ] as const;
      const digestNeedsPerStep = digestPerStepTypes.some((t) => shouldRemindForDeadline(t, caseDataForDeadlines));
      if (digestNeedsPerStep) {
        const extracted = extractActiveDeadlines(caseDataForDeadlines);
        for (const pType of digestPerStepTypes) {
          const match = extracted.find((d) => d.type === pType);
          if (match) {
            addDeadline(match.date, match.label, pType);
          }
        }
      }
    }

    // Sort by deadline date
    deadlines.sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));

    return deadlines;
  },
});

/**
 * Get cases updated in the last 7 days for the weekly digest.
 */
export const getRecentlyUpdatedCases = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<RawCaseUpdateData[]> => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.gt(q.field("updatedAt"), sevenDaysAgo)
        )
      )
      .collect();

    return cases.map((c) => ({
      caseId: c._id,
      employerName: c.employerName,
      beneficiaryIdentifier: c.beneficiaryIdentifier ?? "",
      caseStatus: c.caseStatus,
      progressStatus: c.progressStatus,
      updatedAt: c.updatedAt,
    }));
  },
});

/**
 * Get count of active cases for a user.
 */
export const getActiveCaseCountForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<number> => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.neq(q.field("caseStatus"), "closed")
        )
      )
      .collect();

    return cases.length;
  },
});

/**
 * Get unread notification count for a specific user (helper for weekly digest).
 */
export const getUnreadCountForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<number> => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .take(1000);

    return unread.length;
  },
});

// ============================================================================
// ACCOUNT DELETION
// ============================================================================

/**
 * Permanently delete a user account after grace period has expired.
 *
 * This is scheduled by requestAccountDeletion to run after 30 days.
 * Deletes all user data:
 * - All cases and related data
 * - All notifications
 * - User profile
 * - Auth sessions and accounts
 * - User record
 *
 * IMPORTANT: This is irreversible. Only called by scheduler after grace period.
 */
export const permanentlyDeleteAccount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }): Promise<{ success: boolean; message: string }> => {
    // First verify the user still has deletedAt set and grace period has passed
    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // If deletedAt is not set, user cancelled deletion
    if (!user.deletedAt) {
      return { success: false, message: "Deletion was cancelled" };
    }

    // If deletedAt is in the future, grace period hasn't passed yet
    if (user.deletedAt > Date.now()) {
      return { success: false, message: "Grace period has not expired" };
    }

    await purgeAllUserData(ctx, userId);

    return {
      success: true,
      message: `Account ${userId} permanently deleted`,
    };
  },
});

/**
 * Process expired account deletions (safety net cron job).
 *
 * Runs hourly to catch any accounts where the scheduled deletion
 * job failed or was missed. Finds users where deletedAt < now and
 * processes their permanent deletion.
 */
export const processExpiredDeletions = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    // Get all users with expired deletion timestamps
    const expiredUsers = await ctx.runQuery(
      internal.scheduledJobs.getUsersWithExpiredDeletions
    );

    let processed = 0;

    for (const userId of expiredUsers) {
      const result = await ctx.runMutation(
        internal.scheduledJobs.permanentlyDeleteAccount,
        { userId }
      );

      if (result.success) {
        processed++;
        log.info('Account deletion processed', { resourceId: userId });
      } else {
        log.info('Account deletion skipped', { resourceId: userId, reason: result.message });
      }
    }

    return { processed };
  },
});

/**
 * Get users whose deletion grace period has expired.
 */
export const getUsersWithExpiredDeletions = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">[]> => {
    const now = Date.now();

    // Find users where deletedAt is set and in the past
    const users = await ctx.db
      .query("users")
      .withIndex("by_deleted_at")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), now)
        )
      )
      .take(100); // Process in batches

    return users.map((u) => u._id);
  },
});

// ============================================================================
// RATE LIMIT CLEANUP
// ============================================================================

/**
 * Clean up old rate limit records.
 *
 * Runs hourly to remove rate limit entries older than 24 hours.
 * This prevents the rateLimits table from growing unbounded.
 *
 * Records are processed in batches of 100 to avoid timeouts.
 */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAgeMs;

    // Find old rate limit records
    const oldRecords = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(100);

    // Delete them
    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }

    if (oldRecords.length > 0) {
      log.info('Rate limit cleanup complete', { deleted: oldRecords.length });
    }

    return { deleted: oldRecords.length };
  },
});

// ============================================================================
// CONVERSATION TTL CLEANUP
// ============================================================================

/**
 * Delete AI conversations older than 90 days.
 *
 * Removes conversations (and their messages) where updatedAt is older than 90 days.
 * Processes in batches to avoid timeout. Returns count and hasMore for re-scheduling.
 *
 * SOC 2 C1 — Confidentiality: Limit retention of AI conversation data.
 */
export const cleanupExpiredConversations = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; hasMore: boolean }> => {
    const RETENTION_DAYS = 90;
    const BATCH_SIZE = 50;
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Find conversations older than retention period
    const oldConversations = await ctx.db
      .query("conversations")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .take(BATCH_SIZE + 1);

    const hasMore = oldConversations.length > BATCH_SIZE;
    const toProcess = oldConversations.slice(0, BATCH_SIZE);

    let deleted = 0;
    for (const conversation of toProcess) {
      // Delete all messages in this conversation
      const messages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete the conversation itself
      await ctx.db.delete(conversation._id);
      deleted++;
    }

    if (deleted > 0) {
      log.info("Conversation TTL cleanup complete", { deleted, hasMore });
    }

    return { deleted, hasMore };
  },
});
