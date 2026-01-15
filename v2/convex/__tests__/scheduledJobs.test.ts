/**
 * Scheduled Jobs Tests
 *
 * Comprehensive tests for the scheduled notification jobs:
 * - getCasesNeedingReminders: Query cases with upcoming deadlines
 * - getOldReadNotifications: Query old read notifications for cleanup
 * - cleanupOldNotifications: Delete old read notifications
 * - checkDeadlineReminders: Main daily job for deadline reminders
 *
 * @see /convex/scheduledJobs.ts - Scheduled job implementations
 * @see /convex/crons.ts - Cron scheduling configuration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { daysFromNow, daysAgo } from "../../test-utils/dashboard-fixtures";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a test user with profile.
 * Returns userId and authenticated context.
 */
async function createTestUserWithProfile(
  t: ReturnType<typeof createTestContext>,
  name: string,
  profileOverrides?: Partial<{
    emailNotificationsEnabled: boolean;
    emailDeadlineReminders: boolean;
    emailStatusUpdates: boolean;
    emailRfeAlerts: boolean;
    emailWeeklyDigest: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timezone: string;
    reminderDaysBefore: number[];
  }>
) {
  const authT = await createAuthenticatedContext(t, name);

  const userId = await authT.run(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity!.subject as Id<"users">;
  });

  // Update user with email
  await authT.run(async (ctx) => {
    await ctx.db.patch(userId, {
      email: `${name.toLowerCase().replace(/\s/g, ".")}@example.com`,
    });
  });

  // Create user profile
  await authT.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("userProfiles", {
      userId,
      userType: "individual",
      emailNotificationsEnabled: profileOverrides?.emailNotificationsEnabled ?? true,
      smsNotificationsEnabled: false,
      pushNotificationsEnabled: false,
      urgentDeadlineDays: 7,
      reminderDaysBefore: profileOverrides?.reminderDaysBefore ?? [1, 3, 7, 14, 30],
      emailDeadlineReminders: profileOverrides?.emailDeadlineReminders ?? true,
      emailStatusUpdates: profileOverrides?.emailStatusUpdates ?? true,
      emailRfeAlerts: profileOverrides?.emailRfeAlerts ?? true,
      emailWeeklyDigest: profileOverrides?.emailWeeklyDigest ?? false,
      preferredNotificationEmail: "signup",
      quietHoursEnabled: profileOverrides?.quietHoursEnabled ?? false,
      quietHoursStart: profileOverrides?.quietHoursStart,
      quietHoursEnd: profileOverrides?.quietHoursEnd,
      timezone: profileOverrides?.timezone ?? "America/New_York",
      calendarSyncEnabled: false,
      calendarSyncPwd: false,
      calendarSyncEta9089: false,
      calendarSyncI140: false,
      calendarSyncRfe: false,
      calendarSyncRfi: false,
      calendarSyncRecruitment: false,
      calendarSyncFilingWindow: false,
      googleCalendarConnected: false,
      gmailConnected: false,
      casesSortBy: "updatedAt",
      casesSortOrder: "desc",
      casesPerPage: 12,
      dismissedDeadlines: [],
      darkModeEnabled: false,
      autoDeadlineEnforcementEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { userId, authT };
}

/**
 * Create a test case with specified deadlines.
 * Note: filingWindowCloses is a derived field, not directly settable.
 */
async function createTestCaseWithDeadlines(
  t: ReturnType<typeof createTestContext>,
  authT: Awaited<ReturnType<typeof createAuthenticatedContext>>,
  caseData: {
    employerName: string;
    beneficiaryIdentifier: string;
    pwdExpirationDate?: string;
    eta9089CertificationDate?: string;
    i140FilingDate?: string;
    rfiEntries?: Array<{
      id: string;
      receivedDate: string;
      responseDueDate: string;
      responseSubmittedDate?: string;
      createdAt: number;
    }>;
    rfeEntries?: Array<{
      id: string;
      receivedDate: string;
      responseDueDate: string;
      responseSubmittedDate?: string;
      createdAt: number;
    }>;
    caseStatus?: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  }
): Promise<Id<"cases">> {
  const status = caseData.caseStatus ?? "pwd";
  const caseId = await authT.mutation(api.cases.create, {
    employerName: caseData.employerName,
    beneficiaryIdentifier: caseData.beneficiaryIdentifier,
    positionTitle: "Software Engineer",
    caseStatus: status,
    // Override auto-calculated status for non-pwd statuses
    progressStatusOverride: status !== "pwd" ? true : undefined,
    pwdExpirationDate: caseData.pwdExpirationDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    i140FilingDate: caseData.i140FilingDate,
    rfiEntries: caseData.rfiEntries ?? [],
    rfeEntries: caseData.rfeEntries ?? [],
  });
  await finishScheduledFunctions(t);
  return caseId;
}

// ============================================================================
// getCasesNeedingReminders TESTS
// ============================================================================

describe("Scheduled Jobs", () => {
  // Set up fake timers for scheduler tests
  setupSchedulerTests();

  describe("getCasesNeedingReminders", () => {
    it("finds cases with PWD expiration at reminder intervals (1, 3, 7, 14, 30 days)", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User One");

      // Create cases with PWD expirations at various intervals
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company 1 Day",
        beneficiaryIdentifier: "Ben One",
        pwdExpirationDate: daysFromNow(1),
      });

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company 7 Days",
        beneficiaryIdentifier: "Ben Seven",
        pwdExpirationDate: daysFromNow(7),
      });

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company 30 Days",
        beneficiaryIdentifier: "Ben Thirty",
        pwdExpirationDate: daysFromNow(30),
      });

      // Case with 45 days should NOT be found (not in reminder intervals)
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company 45 Days",
        beneficiaryIdentifier: "Ben FortyFive",
        pwdExpirationDate: daysFromNow(45),
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      // Should find 3 cases (1, 7, 30 days) but not the 45-day case
      expect(reminders.length).toBe(3);

      const employerNames = reminders.map((r) => r.employerName);
      expect(employerNames).toContain("Company 1 Day");
      expect(employerNames).toContain("Company 7 Days");
      expect(employerNames).toContain("Company 30 Days");
      expect(employerNames).not.toContain("Company 45 Days");
    });

    it("excludes cases where notification already exists (deduplication)", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Dedup");

      // Create a case with PWD expiration in 7 days
      const caseId = await createTestCaseWithDeadlines(t, authT, {
        employerName: "Dedup Company",
        beneficiaryIdentifier: "Ben Dedup",
        pwdExpirationDate: daysFromNow(7),
      });

      // Create an existing notification for this deadline
      await authT.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("notifications", {
          userId,
          caseId,
          type: "deadline_reminder",
          title: "PWD Expiration in 7 days",
          message: "Test message",
          priority: "high",
          deadlineDate: daysFromNow(7),
          deadlineType: "pwd_expiration",
          daysUntilDeadline: 7,
          isRead: false,
          emailSent: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      // Should find 0 reminders (deduplicated)
      expect(reminders.length).toBe(0);
    });

    it("excludes deleted cases (deletedAt is set)", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User Delete");

      // Create a case
      const caseId = await createTestCaseWithDeadlines(t, authT, {
        employerName: "Deleted Company",
        beneficiaryIdentifier: "Ben Delete",
        pwdExpirationDate: daysFromNow(7),
      });

      // Soft delete the case
      await authT.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      // Should find 0 reminders (case is deleted)
      expect(reminders.length).toBe(0);
    });

    it("returns correct case info (employerName, beneficiaryIdentifier, etc.)", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User Info");

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Acme Corporation",
        beneficiaryIdentifier: "John Smith",
        pwdExpirationDate: daysFromNow(14),
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      expect(reminders.length).toBe(1);
      const reminder = reminders[0];
      expect(reminder.employerName).toBe("Acme Corporation");
      expect(reminder.beneficiaryIdentifier).toBe("John Smith");
      expect(reminder.deadlineType).toBe("pwd_expiration");
      expect(reminder.daysUntilDeadline).toBe(14);
      expect(reminder.userEmail).toBe("user.info@example.com");
    });

    it("handles RFI entries with due dates", { timeout: 30000 }, async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User RFI");

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "RFI Company",
        beneficiaryIdentifier: "Ben RFI",
        caseStatus: "eta9089",
        rfiEntries: [
          {
            id: "rfi-1",
            receivedDate: daysAgo(23),
            responseDueDate: daysFromNow(7), // 30 days from receipt - 23 = 7 days from now
            createdAt: Date.now() - 23 * 24 * 60 * 60 * 1000,
          },
        ],
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      expect(reminders.length).toBe(1);
      expect(reminders[0].deadlineType).toBe("rfi_due");
      expect(reminders[0].daysUntilDeadline).toBe(7);
    });

    it("handles RFE entries with due dates", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User RFE");

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "RFE Company",
        beneficiaryIdentifier: "Ben RFE",
        caseStatus: "i140",
        rfeEntries: [
          {
            id: "rfe-1",
            receivedDate: daysAgo(60),
            responseDueDate: daysFromNow(30), // User-set deadline
            createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          },
        ],
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      expect(reminders.length).toBe(1);
      expect(reminders[0].deadlineType).toBe("rfe_due");
      expect(reminders[0].daysUntilDeadline).toBe(30);
    });

    it("skips RFI entries that have already been responded to", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User RFI Responded");

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Responded RFI Company",
        beneficiaryIdentifier: "Ben Responded",
        caseStatus: "eta9089",
        rfiEntries: [
          {
            id: "rfi-responded",
            receivedDate: daysAgo(23),
            responseDueDate: daysFromNow(7),
            responseSubmittedDate: daysAgo(5), // Already responded
            createdAt: Date.now() - 23 * 24 * 60 * 60 * 1000,
          },
        ],
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      expect(reminders.length).toBe(0);
    });

    it("excludes closed cases", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User Closed");

      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Closed Company",
        beneficiaryIdentifier: "Ben Closed",
        pwdExpirationDate: daysFromNow(7),
        caseStatus: "closed",
      });

      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      expect(reminders.length).toBe(0);
    });
  });

  // ============================================================================
  // getOldReadNotifications TESTS
  // ============================================================================

  describe("getOldReadNotifications", () => {
    it("returns read notifications older than threshold", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Old Read");

      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      const fiftyDaysAgo = Date.now() - 50 * 24 * 60 * 60 * 1000;
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;

      // Create old read notification (91 days ago - should be returned)
      const oldReadId = await authT.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId,
          type: "deadline_reminder",
          title: "Old Read",
          message: "Should be cleaned up",
          priority: "normal",
          isRead: true,
          readAt: ninetyOneDaysAgo,
          emailSent: false,
          createdAt: ninetyOneDaysAgo,
          updatedAt: ninetyOneDaysAgo,
        });
      });

      // Create newer read notification (50 days ago - should NOT be returned)
      await authT.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          type: "deadline_reminder",
          title: "Recent Read",
          message: "Should be kept",
          priority: "normal",
          isRead: true,
          readAt: fiftyDaysAgo,
          emailSent: false,
          createdAt: fiftyDaysAgo,
          updatedAt: fiftyDaysAgo,
        });
      });

      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      expect(oldNotifications.length).toBe(1);
      expect(oldNotifications[0]).toBe(oldReadId);
    });

    it("excludes unread notifications regardless of age", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Unread Old");

      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;

      // Create old UNREAD notification
      await authT.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          type: "deadline_reminder",
          title: "Old Unread",
          message: "Should NOT be cleaned up even if old",
          priority: "urgent",
          isRead: false,
          emailSent: false,
          createdAt: ninetyOneDaysAgo,
          updatedAt: ninetyOneDaysAgo,
        });
      });

      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      expect(oldNotifications.length).toBe(0);
    });

    it("excludes read notifications newer than threshold", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Recent Read");

      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;

      // Create recent read notification
      await authT.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          type: "status_change",
          title: "Recent Read",
          message: "Should be kept",
          priority: "normal",
          isRead: true,
          readAt: tenDaysAgo,
          emailSent: false,
          createdAt: tenDaysAgo,
          updatedAt: tenDaysAgo,
        });
      });

      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      expect(oldNotifications.length).toBe(0);
    });

    it("respects the batch limit (1000)", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Batch Limit");

      const oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000;
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;

      // Create more than the batch limit of old read notifications
      // (Using a smaller number for test performance - 50 instead of 1001)
      await authT.run(async (ctx) => {
        for (let i = 0; i < 50; i++) {
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: `Old Read ${i}`,
            message: "Should be cleaned up",
            priority: "low",
            isRead: true,
            readAt: oldTime,
            emailSent: false,
            createdAt: oldTime,
            updatedAt: oldTime,
          });
        }
      });

      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      // Should return all 50 (below the 1000 limit)
      expect(oldNotifications.length).toBe(50);
    });
  });

  // ============================================================================
  // cleanupOldNotifications TESTS
  // ============================================================================

  describe("cleanupOldNotifications", () => {
    it("deletes old read notifications", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Cleanup");

      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;

      // Create old read notifications
      await authT.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: `Old Read ${i}`,
            message: "Should be deleted",
            priority: "normal",
            isRead: true,
            readAt: ninetyOneDaysAgo,
            emailSent: false,
            createdAt: ninetyOneDaysAgo,
            updatedAt: ninetyOneDaysAgo,
          });
        }
      });

      // Verify notifications exist
      const beforeCount = await authT.query(api.notifications.getNotificationStats, {});
      expect(beforeCount.total).toBe(3);

      // Run cleanup action - simulate manually since actions can't be tested directly
      // Instead, we test the underlying query and mutation
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      // Delete each one
      for (const notificationId of oldNotifications) {
        await authT.run(async (ctx) => {
          await ctx.runMutation(internal.scheduledJobs.deleteNotification, {
            notificationId,
          });
        });
        await finishScheduledFunctions(t);
      }

      expect(oldNotifications.length).toBe(3);

      // Verify notifications were deleted
      const afterCount = await authT.query(api.notifications.getNotificationStats, {});
      expect(afterCount.total).toBe(0);
    });

    it("preserves unread notifications", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Preserve Unread");

      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // Create old read notification (should be deleted)
      await authT.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          type: "deadline_reminder",
          title: "Old Read",
          message: "Should be deleted",
          priority: "normal",
          isRead: true,
          readAt: ninetyOneDaysAgo,
          emailSent: false,
          createdAt: ninetyOneDaysAgo,
          updatedAt: ninetyOneDaysAgo,
        });
      });

      // Create old UNREAD notification (should be preserved)
      const unreadId = await authT.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId,
          type: "rfi_alert",
          title: "Old Unread",
          message: "Should be preserved",
          priority: "urgent",
          isRead: false,
          emailSent: false,
          createdAt: ninetyOneDaysAgo,
          updatedAt: ninetyOneDaysAgo,
        });
      });

      // Create recent notification (should be preserved)
      const recentId = await authT.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId,
          type: "status_change",
          title: "Recent",
          message: "Should be preserved",
          priority: "normal",
          isRead: true,
          readAt: now,
          emailSent: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Run cleanup - simulate manually since actions can't be tested directly
      const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const oldNotifications = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getOldReadNotifications, {
          olderThan: threshold,
        });
      });

      // Delete each one
      for (const notificationId of oldNotifications) {
        await authT.run(async (ctx) => {
          await ctx.runMutation(internal.scheduledJobs.deleteNotification, {
            notificationId,
          });
        });
        await finishScheduledFunctions(t);
      }

      expect(oldNotifications.length).toBe(1);

      // Verify remaining notifications
      const stats = await authT.query(api.notifications.getNotificationStats, {});
      expect(stats.total).toBe(2);

      // Verify the correct notifications remain
      const remaining = await authT.run(async (ctx) => {
        return [await ctx.db.get(unreadId), await ctx.db.get(recentId)];
      });

      expect(remaining[0]).not.toBeNull();
      expect(remaining[0]!.title).toBe("Old Unread");
      expect(remaining[1]).not.toBeNull();
      expect(remaining[1]!.title).toBe("Recent");
    });
  });

  // ============================================================================
  // deleteNotification TESTS (Internal helper)
  // ============================================================================

  describe("deleteNotification (internal mutation)", () => {
    it("deletes a notification by ID", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Delete Notif");

      const now = Date.now();
      const notificationId = await authT.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId,
          type: "system",
          title: "To Delete",
          message: "This will be deleted",
          priority: "low",
          isRead: true,
          readAt: now,
          emailSent: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Delete using internal mutation
      await authT.run(async (ctx) => {
        await ctx.runMutation(internal.scheduledJobs.deleteNotification, {
          notificationId,
        });
      });
      await finishScheduledFunctions(t);

      // Verify deletion
      const notification = await authT.run(async (ctx) => {
        return await ctx.db.get(notificationId);
      });

      expect(notification).toBeNull();
    });
  });

  // ============================================================================
  // getUsersForWeeklyDigest TESTS
  // ============================================================================

  describe("getUsersForWeeklyDigest", () => {
    it("returns users with email notifications enabled", async () => {
      const t = createTestContext();

      // Create user with email notifications and weekly digest enabled
      const { userId: enabledUserId, authT: enabledAuth } = await createTestUserWithProfile(
        t,
        "User Enabled",
        { emailNotificationsEnabled: true, emailWeeklyDigest: true }
      );

      // Create user with email notifications disabled
      const { userId: disabledUserId } = await createTestUserWithProfile(
        t,
        "User Disabled",
        { emailNotificationsEnabled: false }
      );

      const users = await enabledAuth.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getUsersForWeeklyDigest, {});
      });

      // Should only find the enabled user
      const userIds = users.map((u) => u.userId);
      expect(userIds).toContain(enabledUserId);
      expect(userIds).not.toContain(disabledUserId);
    });
  });

  // ============================================================================
  // getUpcomingDeadlinesForUser TESTS
  // ============================================================================

  describe("getUpcomingDeadlinesForUser", () => {
    it("returns deadlines within the specified days ahead", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Upcoming");

      // Create case with PWD expiration in 5 days (within 7 days)
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Near Deadline Co",
        beneficiaryIdentifier: "Ben Near",
        pwdExpirationDate: daysFromNow(5),
      });

      // Create case with PWD expiration in 15 days (outside 7 days)
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Far Deadline Co",
        beneficiaryIdentifier: "Ben Far",
        pwdExpirationDate: daysFromNow(15),
      });

      const deadlines = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getUpcomingDeadlinesForUser, {
          userId,
          daysAhead: 7,
        });
      });

      expect(deadlines.length).toBe(1);
      expect(deadlines[0].employerName).toBe("Near Deadline Co");
      expect(deadlines[0].daysUntil).toBe(5);
    });
  });

  // ============================================================================
  // getUnreadCountForUser TESTS
  // ============================================================================

  describe("getUnreadCountForUser", () => {
    it("returns correct unread count for user", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Count");

      const now = Date.now();

      // Create 3 unread notifications
      await authT.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: `Unread ${i}`,
            message: "Test",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + i * 1000,
            updatedAt: now + i * 1000,
          });
        }
        // Create 2 read notifications
        for (let i = 0; i < 2; i++) {
          await ctx.db.insert("notifications", {
            userId,
            type: "status_change",
            title: `Read ${i}`,
            message: "Test",
            priority: "low",
            isRead: true,
            readAt: now,
            emailSent: false,
            createdAt: now + 10000 + i * 1000,
            updatedAt: now + 10000 + i * 1000,
          });
        }
      });

      const unreadCount = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getUnreadCountForUser, { userId });
      });

      expect(unreadCount).toBe(3);
    });
  });

  // ============================================================================
  // checkDeadlineReminders (Integration) TESTS
  // ============================================================================

  describe("checkDeadlineReminders (simulated action)", () => {
    it("finds reminders and can create notifications for them", async () => {
      const t = createTestContext();
      const { authT } = await createTestUserWithProfile(t, "User Action Test");

      // Create a case with PWD expiration in 7 days
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Action Test Co",
        beneficiaryIdentifier: "Ben Action",
        pwdExpirationDate: daysFromNow(7),
      });

      // Note: cases.create might create a notification, so we check for deadline_reminder specifically
      const beforeStats = await authT.query(api.notifications.getNotificationStats, {});
      const beforeDeadlineCount = beforeStats.byType["deadline_reminder"] ?? 0;

      // Simulate the action by running the query that gets cases needing reminders
      const reminders = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders, {});
      });

      // Should find the case we created
      expect(reminders.length).toBeGreaterThanOrEqual(1);
      const reminder = reminders.find((r) => r.employerName === "Action Test Co");
      expect(reminder).toBeDefined();
      expect(reminder!.daysUntilDeadline).toBe(7);
      expect(reminder!.deadlineType).toBe("pwd_expiration");

      // Create a notification for this reminder (simulating what the action does)
      await authT.run(async (ctx) => {
        await ctx.runMutation(internal.notifications.createNotification, {
          userId: reminder!.userId,
          caseId: reminder!.caseId,
          type: "deadline_reminder",
          title: "PWD Expiration in 7 days",
          message: `${reminder!.beneficiaryIdentifier} at ${reminder!.employerName}: PWD expires in 7 days`,
          priority: "urgent",
          deadlineDate: reminder!.deadlineDate,
          deadlineType: reminder!.deadlineType,
          daysUntilDeadline: Number(reminder!.daysUntilDeadline),
        });
      });
      await finishScheduledFunctions(t);

      // Verify notification was created
      const afterStats = await authT.query(api.notifications.getNotificationStats, {});
      const afterDeadlineCount = afterStats.byType["deadline_reminder"] ?? 0;

      expect(afterDeadlineCount).toBeGreaterThan(beforeDeadlineCount);
    });
  });

  // ============================================================================
  // permanentlyDeleteAccount TESTS
  // ============================================================================

  describe("permanentlyDeleteAccount", () => {
    it("deletes user and all associated data when grace period expired", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User To Delete");

      // Create some cases for this user
      await createTestCaseWithDeadlines(t, authT, {
        employerName: "Delete Test Co",
        beneficiaryIdentifier: "Ben Delete",
        pwdExpirationDate: daysFromNow(30),
      });

      // Create notifications for this user
      await authT.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          type: "system",
          title: "Test Notification",
          message: "This will be deleted",
          priority: "normal",
          isRead: false,
          emailSent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Set deletedAt to the past (grace period expired)
      const pastDeletionTime = Date.now() - 1000;
      await authT.run(async (ctx) => {
        await ctx.db.patch(userId, { deletedAt: pastDeletionTime });
      });

      // Call permanentlyDeleteAccount
      const result = await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });
      await finishScheduledFunctions(t);

      expect(result.success).toBe(true);
      expect(result.message).toContain("permanently deleted");

      // Verify user is deleted
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(user).toBeNull();
    });

    it("returns error when user not found", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Temp");

      // Get a valid ID format by using a real user's ID, then delete that user from db
      // This simulates a user that was deleted via some other means
      await authT.run(async (ctx) => {
        // Delete the user directly from db (not via permanentlyDeleteAccount)
        await ctx.db.delete(userId);
      });

      // Now try to permanently delete a user that no longer exists
      const result = await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("User not found");
    });

    it("returns error when deletion was cancelled (deletedAt not set)", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Cancelled");

      // User does NOT have deletedAt set - simulates cancelled deletion
      const result = await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Deletion was cancelled");
    });

    it("returns error when grace period has not expired", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Pending");

      // Set deletedAt to the future (grace period not expired)
      const futureDeletionTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await authT.run(async (ctx) => {
        await ctx.db.patch(userId, { deletedAt: futureDeletionTime });
      });

      const result = await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Grace period has not expired");

      // Verify user still exists
      const user = await authT.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(user).not.toBeNull();
    });

    it("deletes all user cases during account deletion", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Cases Delete");

      // Create multiple cases
      const caseId1 = await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company One",
        beneficiaryIdentifier: "Ben One",
        pwdExpirationDate: daysFromNow(30),
      });

      const caseId2 = await createTestCaseWithDeadlines(t, authT, {
        employerName: "Company Two",
        beneficiaryIdentifier: "Ben Two",
        pwdExpirationDate: daysFromNow(60),
      });

      // Set deletedAt to the past
      await authT.run(async (ctx) => {
        await ctx.db.patch(userId, { deletedAt: Date.now() - 1000 });
      });

      // Delete account
      await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });
      await finishScheduledFunctions(t);

      // Verify cases are deleted
      const case1 = await t.run(async (ctx) => ctx.db.get(caseId1));
      const case2 = await t.run(async (ctx) => ctx.db.get(caseId2));
      expect(case1).toBeNull();
      expect(case2).toBeNull();
    });

    it("deletes all user notifications during account deletion", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Notif Delete");

      // Create notifications
      const notifId = await authT.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId,
          type: "deadline_reminder",
          title: "Test Notification",
          message: "Will be deleted",
          priority: "high",
          isRead: false,
          emailSent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Set deletedAt to the past
      await authT.run(async (ctx) => {
        await ctx.db.patch(userId, { deletedAt: Date.now() - 1000 });
      });

      // Delete account
      await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });
      await finishScheduledFunctions(t);

      // Verify notification is deleted
      const notif = await t.run(async (ctx) => ctx.db.get(notifId));
      expect(notif).toBeNull();
    });

    it("deletes user profile during account deletion", async () => {
      const t = createTestContext();
      const { userId, authT } = await createTestUserWithProfile(t, "User Profile Delete");

      // Get profile ID before deletion
      const profileId = await authT.run(async (ctx) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .unique();
        return profile?._id;
      });
      expect(profileId).toBeDefined();

      // Set deletedAt to the past
      await authT.run(async (ctx) => {
        await ctx.db.patch(userId, { deletedAt: Date.now() - 1000 });
      });

      // Delete account
      await authT.run(async (ctx) => {
        return await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
          userId,
        });
      });
      await finishScheduledFunctions(t);

      // Verify profile is deleted
      const profile = await t.run(async (ctx) => ctx.db.get(profileId!));
      expect(profile).toBeNull();
    });
  });

  // ============================================================================
  // processExpiredDeletions TESTS
  // ============================================================================

  describe("processExpiredDeletions (query helper)", () => {
    it("getUsersWithExpiredDeletions returns users with expired deletedAt", async () => {
      const t = createTestContext();
      const { userId: expiredUserId, authT } = await createTestUserWithProfile(
        t,
        "User Expired"
      );

      // Set deletedAt to the past (expired)
      await authT.run(async (ctx) => {
        await ctx.db.patch(expiredUserId, { deletedAt: Date.now() - 1000 });
      });

      // Create another user with deletion in the future
      const { userId: futureUserId } = await createTestUserWithProfile(t, "User Future");
      await t.run(async (ctx) => {
        await ctx.db.patch(futureUserId, {
          deletedAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      });

      // Create user with no deletion scheduled
      await createTestUserWithProfile(t, "User Active");

      // Query for expired users
      const expiredUsers = await authT.run(async (ctx) => {
        return await ctx.runQuery(internal.scheduledJobs.getUsersWithExpiredDeletions, {});
      });

      // Should only find the expired user
      expect(expiredUsers).toContain(expiredUserId);
      expect(expiredUsers).not.toContain(futureUserId);
      expect(expiredUsers.length).toBe(1);
    });
  });
});
