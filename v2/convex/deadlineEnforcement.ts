/**
 * Deadline Enforcement Mutations & Queries
 *
 * Provides automatic deadline enforcement functionality:
 * - Check and enforce deadlines on login (mutation)
 * - Close case + notify for cron-based enforcement (internalMutation)
 * - Query for auto-closure alerts (query)
 * - Dismiss alerts — single or all (mutations)
 * - Check if enforcement is enabled (query)
 *
 * @see ./lib/deadlineEnforcementHelpers.ts - Pure enforcement logic
 * @see /perm_flow.md - Source of truth for business rules
 * @module
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  checkDeadlineViolations,
  generateClosureMessage,
  generateClosureTitle,
  mapCaseToEnforcementData,
  VIOLATION_TO_DEADLINE_TYPE,
} from "./lib/deadlineEnforcementHelpers";
import { shouldSendEmail, formatDeadlineType, buildUserNotificationPrefs } from "./lib/notificationHelpers";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";
import { DEFAULT_USER_TIMEZONE } from "./lib/perm/deadlines/timezones";

const log = loggers.deadline;

// ============================================================================
// TYPES
// ============================================================================

/** Summary of enforcement actions taken */
interface EnforcementResult {
  /** Whether enforcement was enabled */
  enabled: boolean;
  /** Number of cases checked */
  casesChecked: number;
  /** Number of cases closed */
  casesClosed: number;
  /** Details of closed cases */
  closedCases: Array<{
    caseId: string;
    employerName: string;
    beneficiaryIdentifier: string;
    violationType: string;
    reason: string;
  }>;
}

/** Auto-closure alert for dashboard display */
export interface AutoClosureAlert {
  notificationId: Id<"notifications">;
  caseId: Id<"cases"> | null;
  title: string;
  message: string;
  closureReason: string;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  createdAt: number;
  isRead: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// violationTypeToDeadlineType and mapCaseToEnforcementData now imported from
// ./lib/deadlineEnforcementHelpers (VIOLATION_TO_DEADLINE_TYPE, mapCaseToEnforcementData)

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Check and enforce deadlines for the current user.
 *
 * Called on login when auto-deadline enforcement is enabled.
 * Checks all active cases for deadline violations and:
 * 1. Closes cases with violations that require closure
 * 2. Creates notifications for each closed case
 *
 * @returns Summary of enforcement actions taken
 */
export const checkAndEnforceDeadlines = mutation({
  args: {},
  handler: async (ctx): Promise<EnforcementResult> => {
    const userId = await getCurrentUserId(ctx);

    // Get user profile to check if enforcement is enabled
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // If no profile or enforcement disabled, return early
    if (!profile || !profile.autoDeadlineEnforcementEnabled) {
      return {
        enabled: false,
        casesChecked: 0,
        casesClosed: 0,
        closedCases: [],
      };
    }

    // Get all active (non-deleted, non-closed) cases for user
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    // Filter to active cases only
    const activeCases = cases.filter(
      (c) => c.deletedAt === undefined && c.caseStatus !== "closed"
    );

    const closedCases: EnforcementResult["closedCases"] = [];
    const now = Date.now();

    // Resolve user timezone from profile
    const userTimezone = profile.timezone || DEFAULT_USER_TIMEZONE;

    // Check each case for violations
    for (const caseDoc of activeCases) {
      const caseData = mapCaseToEnforcementData(caseDoc);
      const violation = checkDeadlineViolations(caseData, undefined, userTimezone);

      // Only process violations that require closure
      if (violation && violation.suggestedAction === "close") {
        // Close the case
        await ctx.db.patch(caseDoc._id, {
          caseStatus: "closed",
          closureReason: violation.type,
          closedAt: now,
          updatedAt: now,
        });

        // Create notification
        const title = generateClosureTitle(violation);
        const message = generateClosureMessage(
          violation,
          caseDoc.employerName,
          caseDoc.beneficiaryIdentifier ?? ""
        );

        const notificationId = await ctx.db.insert("notifications", {
          userId: userId,
          caseId: caseDoc._id,
          type: "auto_closure",
          title,
          message,
          priority: "urgent",
          deadlineType: violation.type,
          isRead: false,
          emailSent: false,
          createdAt: now,
          updatedAt: now,
        });

        // Schedule auto-closure email
        // Auto-closure emails ALWAYS send if master switch is enabled (critical notification)
        try {
          if (shouldSendEmail("auto_closure", "urgent", buildUserNotificationPrefs(profile))) {
            // Get user email from users table
            const user = await ctx.db.get(userId);
            if (user?.email) {
              await ctx.scheduler.runAfter(0, internal.notificationActions.sendAutoClosureEmail, {
                notificationId,
                to: user.email,
                beneficiaryName: caseDoc.beneficiaryIdentifier || "Beneficiary",
                companyName: caseDoc.employerName,
                violationType: formatDeadlineType(VIOLATION_TO_DEADLINE_TYPE[violation.type]),
                reason: violation.reason,
                closedAt: new Date(now).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                caseId: caseDoc._id.toString(),
                caseNumber: caseDoc.internalCaseNumber,
              });
            }
          }
        } catch (emailError) {
          // Log email scheduling failure but don't fail the auto-closure operation
          log.error('Failed to schedule auto-closure email', {
            resourceId: caseDoc._id,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
          await recordError(ctx, "mutation", "deadlineEnforcement.checkAndEnforce.emailSchedule", emailError, { userId, resourceId: caseDoc._id });
        }

        closedCases.push({
          caseId: caseDoc._id,
          employerName: caseDoc.employerName,
          beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
          violationType: violation.type,
          reason: violation.reason,
        });
      }
    }

    return {
      enabled: true,
      casesChecked: activeCases.length,
      casesClosed: closedCases.length,
      closedCases,
    };
  },
});

/**
 * Dismiss a single auto-closure alert by marking it as read.
 */
export const dismissAutoClosureAlert = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get notification and verify ownership
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Access denied");
    }

    if (notification.type !== "auto_closure") {
      throw new Error("Not an auto-closure notification");
    }

    // Mark as read
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Dismiss all auto-closure alerts for the current user.
 */
export const dismissAllAutoClosureAlerts = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Get all unread auto-closure notifications for user
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    // Filter to auto_closure type only
    const autoClosureNotifications = notifications.filter(
      (n) => n.type === "auto_closure"
    );

    // Mark all as read
    let dismissedCount = 0;
    for (const notification of autoClosureNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
      dismissedCount++;
    }

    return { success: true, dismissedCount };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get unread auto-closure alerts for dashboard display.
 *
 * Returns enriched alerts with case information for the alert banner.
 */
export const getAutoClosureAlerts = query({
  args: {},
  handler: async (ctx): Promise<AutoClosureAlert[]> => {
    const userId = await getCurrentUserIdOrNull(ctx);

    if (userId === null) {
      return [];
    }

    // Get all unread notifications for user
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    // Filter to auto_closure type
    const autoClosureNotifications = notifications.filter(
      (n) => n.type === "auto_closure"
    );

    // Enrich with case data
    const alerts: AutoClosureAlert[] = [];

    for (const notification of autoClosureNotifications) {
      let employerName = "Unknown";
      let beneficiaryIdentifier = "Unknown";
      let positionTitle = "Unknown";
      let closureReason = notification.deadlineType || "unknown";

      // Get case data if available
      if (notification.caseId) {
        const caseDoc = await ctx.db.get(notification.caseId);
        if (caseDoc) {
          employerName = caseDoc.employerName;
          beneficiaryIdentifier = caseDoc.beneficiaryIdentifier ?? "";
          positionTitle = caseDoc.positionTitle;
          closureReason = caseDoc.closureReason || closureReason;
        }
      }

      alerts.push({
        notificationId: notification._id,
        caseId: notification.caseId ?? null,
        title: notification.title,
        message: notification.message,
        closureReason,
        employerName,
        beneficiaryIdentifier,
        positionTitle,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
      });
    }

    // Sort by creation date (newest first)
    alerts.sort((a, b) => b.createdAt - a.createdAt);

    return alerts;
  },
});

/**
 * Check if the current user has deadline enforcement enabled.
 * Used by frontend to determine whether to call checkAndEnforceDeadlines.
 */
export const isEnforcementEnabled = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await getCurrentUserIdOrNull(ctx);

    if (userId === null) {
      return false;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile?.autoDeadlineEnforcementEnabled ?? false;
  },
});

// ============================================================================
// INTERNAL MUTATIONS (for cron job)
// ============================================================================

/**
 * Close a case and create its auto-closure notification.
 * Called by the daily enforcement cron (enforceDeadlinesForAllUsers action).
 * Returns the notification ID for email scheduling, or null if already handled.
 *
 * Security: No ownership verification — caller must ensure authorization.
 * Internal-only (not exposed to client).
 */
export const closeCaseAndNotify = internalMutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    violationType: v.union(
      v.literal("pwd_expired"),
      v.literal("recruitment_window_missed"),
      v.literal("filing_window_missed"),
      v.literal("eta9089_expired"),
    ),
    closedAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"notifications"> | null> => {
    // Idempotency guard: skip if already closed or deleted (race with login-triggered enforcement)
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc || caseDoc.caseStatus === "closed" || caseDoc.deletedAt !== undefined) {
      return null;
    }

    await ctx.db.patch(args.caseId, {
      caseStatus: "closed",
      closureReason: args.violationType,
      closedAt: args.closedAt,
      updatedAt: args.closedAt,
    });

    return await ctx.db.insert("notifications", {
      userId: args.userId,
      caseId: args.caseId,
      type: "auto_closure",
      title: args.title,
      message: args.message,
      priority: "urgent",
      deadlineType: args.violationType,
      isRead: false,
      emailSent: false,
      createdAt: args.closedAt,
      updatedAt: args.closedAt,
    });
  },
});
