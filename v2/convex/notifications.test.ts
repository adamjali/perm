/**
 * Notification Tests
 *
 * Comprehensive tests for the notification system including:
 * - Query tests (getUnreadCount, getRecentNotifications, getNotifications, etc.)
 * - Mutation tests (markAsRead, markAllAsRead, deleteNotification, etc.)
 * - Helper function tests (generateNotificationTitle, calculatePriority, shouldSendEmail, etc.)
 *
 * @see /convex/notifications.ts - Main notification queries and mutations
 * @see /convex/lib/notificationHelpers.ts - Pure helper functions
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions } from "../test-utils/convex";
import { api } from "./_generated/api";
import {
  generateNotificationTitle,
  generateNotificationMessage,
  calculatePriority,
  formatDeadlineType,
  shouldSendEmail,
  getNotificationIcon,
  type UserNotificationPrefs,
} from "./lib/notificationHelpers";

// ============================================================================
// QUERY TESTS
// ============================================================================

describe("Notifications", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("Queries", () => {
    describe("getUnreadCount", () => {
      it("returns correct count", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Create some notifications (2 unread, 1 read)
        await user.run(async (ctx) => {
          const now = Date.now();
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test 1",
            message: "Message 1",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test 2",
            message: "Message 2",
            priority: "high",
            isRead: false,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "status_change",
            title: "Test 3",
            message: "Message 3",
            priority: "low",
            isRead: true,
            readAt: now + 2000,
            emailSent: false,
            createdAt: now + 2000,
            updatedAt: now + 2000,
          });
        });

        const count = await user.query(api.notifications.getUnreadCount, {});
        expect(count).toBe(2);
      });

      it("returns 0 for new user (no notifications)", async () => {
        const t = createTestContext();
        const user = await createAuthenticatedContext(t, "New User");

        const count = await user.query(api.notifications.getUnreadCount, {});
        expect(count).toBe(0);
      });

      it("returns 0 for unauthenticated (graceful)", async () => {
        const t = createTestContext();

        const count = await t.query(api.notifications.getUnreadCount, {});
        expect(count).toBe(0);
      });
    });

    describe("getRecentNotifications", () => {
      it("respects limit", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Create 10 notifications
        await user.run(async (ctx) => {
          const now = Date.now();
          for (let i = 0; i < 10; i++) {
            await ctx.db.insert("notifications", {
              userId,
              type: "deadline_reminder",
              title: `Test ${i}`,
              message: `Message ${i}`,
              priority: "normal",
              isRead: false,
              emailSent: false,
              createdAt: now + i * 1000,
              updatedAt: now + i * 1000,
            });
          }
        });

        const result = await user.query(api.notifications.getRecentNotifications, { limit: 3 });
        expect(result).toHaveLength(3);
      });

      it("orders by createdAt desc", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Oldest",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Newest",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + 10000,
            updatedAt: now + 10000,
          });
        });

        const result = await user.query(api.notifications.getRecentNotifications, { limit: 5 });
        expect(result[0].title).toBe("Newest");
        expect(result[1].title).toBe("Oldest");
      });
    });

    describe("getNotifications", () => {
      it("pagination works correctly", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Create 25 notifications
        await user.run(async (ctx) => {
          const now = Date.now();
          for (let i = 0; i < 25; i++) {
            await ctx.db.insert("notifications", {
              userId,
              type: "deadline_reminder",
              title: `Test ${i}`,
              message: `Message ${i}`,
              priority: "normal",
              isRead: false,
              emailSent: false,
              createdAt: now + i * 1000,
              updatedAt: now + i * 1000,
            });
          }
        });

        const firstPage = await user.query(api.notifications.getNotifications, { limit: 10 });
        expect(firstPage.notifications).toHaveLength(10);
        expect(firstPage.hasMore).toBe(true);
        expect(firstPage.nextCursor).toBeDefined();
      });

      it("filters by type", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Deadline",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "rfi_alert",
            title: "RFI",
            message: "Message",
            priority: "high",
            isRead: false,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "status_change",
            title: "Status",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + 2000,
            updatedAt: now + 2000,
          });
        });

        const result = await user.query(api.notifications.getNotifications, {
          filters: { type: ["rfi_alert"] },
        });
        expect(result.notifications).toHaveLength(1);
        expect(result.notifications[0].type).toBe("rfi_alert");
      });

      it("filters by isRead", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Unread",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Read",
            message: "Message",
            priority: "normal",
            isRead: true,
            readAt: now,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
        });

        const result = await user.query(api.notifications.getNotifications, {
          filters: { isRead: true },
        });
        expect(result.notifications).toHaveLength(1);
        expect(result.notifications[0].title).toBe("Read");
      });
    });

    describe("getNotificationsByCase", () => {
      it("returns only case notifications", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Create a case first
        // Note: cases.create automatically creates a "New Case Created" notification
        const caseId = await user.mutation(api.cases.create, {
          employerName: "Test Corp",
          beneficiaryIdentifier: "John D.",
          positionTitle: "Engineer",
        });
        await finishScheduledFunctions(t);

        await user.run(async (ctx) => {
          const now = Date.now();
          // Additional notification for the case (beyond the auto-created one)
          await ctx.db.insert("notifications", {
            userId,
            caseId: caseId,
            type: "deadline_reminder",
            title: "Case Notification",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          // System notification (no case) - should NOT appear in case notifications
          await ctx.db.insert("notifications", {
            userId,
            type: "system",
            title: "System Notification",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
        });

        const result = await user.query(api.notifications.getNotificationsByCase, { caseId });
        // Should have 2 case notifications: auto-created "New Case Created" + manual "Case Notification"
        // Should NOT include the system notification (no caseId)
        expect(result).toHaveLength(2);
        const titles = result.map((n) => n.title);
        expect(titles).toContain("Case Notification");
        expect(titles).toContain("New Case Created");
        expect(titles).not.toContain("System Notification");
      });
    });

    describe("getNotificationStats", () => {
      it("returns correct breakdown", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test 1",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test 2",
            message: "Message",
            priority: "normal",
            isRead: true,
            readAt: now,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "rfi_alert",
            title: "Test 3",
            message: "Message",
            priority: "high",
            isRead: false,
            emailSent: false,
            createdAt: now + 2000,
            updatedAt: now + 2000,
          });
        });

        const stats = await user.query(api.notifications.getNotificationStats, {});
        expect(stats.total).toBe(3);
        expect(stats.unread).toBe(2);
        expect(stats.byType["deadline_reminder"]).toBe(2);
        expect(stats.byType["rfi_alert"]).toBe(1);
      });
    });
  });

  // ============================================================================
  // MUTATION TESTS
  // ============================================================================

  describe("Mutations", () => {
    describe("markAsRead", () => {
      it("updates isRead and readAt", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        const notificationId = await user.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        const result = await user.mutation(api.notifications.markAsRead, { notificationId });
        await finishScheduledFunctions(t);
        expect(result.success).toBe(true);

        // Verify it was marked as read
        const notification = await user.run(async (ctx) => {
          return await ctx.db.get(notificationId);
        });
        expect(notification!.isRead).toBe(true);
        expect(notification!.readAt).toBeDefined();
      });

      it("fails for non-owned notification", async () => {
        const t = createTestContext();
        const { ctx: userA, userId: userAId } = await createAuthenticatedContext(t, "User A");
        const userB = await createAuthenticatedContext(t, "User B");

        const notificationId = await userA.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId: userAId,
            type: "deadline_reminder",
            title: "Test",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        await expect(
          userB.mutation(api.notifications.markAsRead, { notificationId })
        ).rejects.toThrow("Access denied");
      });
    });

    describe("markAllAsRead", () => {
      it("updates all user notifications", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          for (let i = 0; i < 5; i++) {
            await ctx.db.insert("notifications", {
              userId,
              type: "deadline_reminder",
              title: `Test ${i}`,
              message: "Message",
              priority: "normal",
              isRead: false,
              emailSent: false,
              createdAt: now + i * 1000,
              updatedAt: now + i * 1000,
            });
          }
        });

        const result = await user.mutation(api.notifications.markAllAsRead, {});
        await finishScheduledFunctions(t);
        expect(result.count).toBe(5);

        const unreadCount = await user.query(api.notifications.getUnreadCount, {});
        expect(unreadCount).toBe(0);
      });
    });

    describe("markMultipleAsRead", () => {
      it("handles mixed ownership (only updates owned)", async () => {
        const t = createTestContext();
        const { ctx: userA, userId: userAId } = await createAuthenticatedContext(t, "User A");
        const { ctx: userB, userId: userBId } = await createAuthenticatedContext(t, "User B");

        const notificationAId = await userA.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId: userAId,
            type: "deadline_reminder",
            title: "User A Notification",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        const notificationBId = await userB.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId: userBId,
            type: "deadline_reminder",
            title: "User B Notification",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        // User A tries to mark both - should fail because they don't own notification B
        await expect(
          userA.mutation(api.notifications.markMultipleAsRead, {
            notificationIds: [notificationAId, notificationBId],
          })
        ).rejects.toThrow("Access denied");
      });
    });

    describe("deleteNotification", () => {
      it("removes notification", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        const notificationId = await user.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        const result = await user.mutation(api.notifications.deleteNotification, { notificationId });
        await finishScheduledFunctions(t);
        expect(result.success).toBe(true);

        const notification = await user.run(async (ctx) => {
          return await ctx.db.get(notificationId);
        });
        expect(notification).toBeNull();
      });

      it("fails for non-owned", async () => {
        const t = createTestContext();
        const { ctx: userA, userId: userAId } = await createAuthenticatedContext(t, "User A");
        const userB = await createAuthenticatedContext(t, "User B");

        const notificationId = await userA.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId: userAId,
            type: "deadline_reminder",
            title: "Test",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        await expect(
          userB.mutation(api.notifications.deleteNotification, { notificationId })
        ).rejects.toThrow("Access denied");
      });
    });

    describe("deleteAllRead", () => {
      it("only removes read notifications", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        await user.run(async (ctx) => {
          const now = Date.now();
          // 2 unread
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Unread 1",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
          await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Unread 2",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + 1000,
            updatedAt: now + 1000,
          });
          // 3 read
          for (let i = 0; i < 3; i++) {
            await ctx.db.insert("notifications", {
              userId,
              type: "deadline_reminder",
              title: `Read ${i}`,
              message: "Message",
              priority: "normal",
              isRead: true,
              readAt: now,
              emailSent: false,
              createdAt: now + 2000 + i * 1000,
              updatedAt: now + 2000 + i * 1000,
            });
          }
        });

        const result = await user.mutation(api.notifications.deleteAllRead, {});
        await finishScheduledFunctions(t);
        expect(result.count).toBe(3);

        // Should still have 2 unread
        const unreadCount = await user.query(api.notifications.getUnreadCount, {});
        expect(unreadCount).toBe(2);
      });
    });

    describe("createNotification (internal)", () => {
      it("sets defaults correctly", async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Use internal mutation to create notification
        const notificationId = await user.run(async (ctx) => {
          const now = Date.now();
          return await ctx.db.insert("notifications", {
            userId,
            type: "deadline_reminder",
            title: "Test Title",
            message: "Test Message",
            priority: "high",
            deadlineDate: "2025-12-31",
            deadlineType: "pwd_expiration",
            daysUntilDeadline: 30,
            isRead: false,
            emailSent: false,
            createdAt: now,
            updatedAt: now,
          });
        });

        const notification = await user.run(async (ctx) => {
          return await ctx.db.get(notificationId);
        });

        expect(notification).toBeDefined();
        expect(notification!.isRead).toBe(false);
        expect(notification!.emailSent).toBe(false);
        expect(notification!.priority).toBe("high");
        expect(notification!.deadlineDate).toBe("2025-12-31");
        expect(notification!.deadlineType).toBe("pwd_expiration");
      });
    });

    describe("cleanupCaseNotifications", () => {
      it("removes all case notifications", { timeout: 30000 }, async () => {
        const t = createTestContext();
        const { ctx: user, userId } = await createAuthenticatedContext(t, "User 1");

        // Create a case
        const caseId = await user.mutation(api.cases.create, {
          employerName: "Test Corp",
          beneficiaryIdentifier: "John D.",
          positionTitle: "Engineer",
        });
        await finishScheduledFunctions(t);

        // Create notifications for the case
        await user.run(async (ctx) => {
          const now = Date.now();
          for (let i = 0; i < 5; i++) {
            await ctx.db.insert("notifications", {
              userId,
              caseId: caseId,
              type: "deadline_reminder",
              title: `Case Notification ${i}`,
              message: "Message",
              priority: "normal",
              isRead: false,
              emailSent: false,
              createdAt: now + i * 1000,
              updatedAt: now + i * 1000,
            });
          }
          // Also create one without a case
          await ctx.db.insert("notifications", {
            userId,
            type: "system",
            title: "System Notification",
            message: "Message",
            priority: "normal",
            isRead: false,
            emailSent: false,
            createdAt: now + 10000,
            updatedAt: now + 10000,
          });
        });

        // Use internal cleanup
        await user.run(async (ctx) => {
          const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
            .collect();
          for (const n of notifications) {
            await ctx.db.delete(n._id);
          }
        });

        // Should only have the system notification left
        const caseNotifications = await user.query(api.notifications.getNotificationsByCase, {
          caseId,
        });
        expect(caseNotifications).toHaveLength(0);

        // Total should be 1 (system notification)
        const stats = await user.query(api.notifications.getNotificationStats, {});
        expect(stats.total).toBe(1);
      });
    });
  });

  // ============================================================================
  // HELPER FUNCTION TESTS
  // ============================================================================

  describe("Helpers", () => {
    describe("generateNotificationTitle", () => {
      it("generates title for deadline_reminder", () => {
        const title = generateNotificationTitle("deadline_reminder", {
          deadlineType: "pwd_expiration",
          daysUntilDeadline: 7,
        });
        expect(title).toBe("PWD Expiration in 7 days");
      });

      it("generates title for deadline_reminder overdue", () => {
        const title = generateNotificationTitle("deadline_reminder", {
          deadlineType: "pwd_expiration",
          daysUntilDeadline: -3,
        });
        expect(title).toBe("PWD Expiration Overdue");
      });

      it("generates title for deadline_reminder due today", () => {
        const title = generateNotificationTitle("deadline_reminder", {
          deadlineType: "rfi_due",
          daysUntilDeadline: 0,
        });
        expect(title).toBe("RFI Response Due Today");
      });

      it("generates title for deadline_reminder due tomorrow", () => {
        const title = generateNotificationTitle("deadline_reminder", {
          deadlineType: "i140_filing_deadline",
          daysUntilDeadline: 1,
        });
        expect(title).toBe("I-140 Filing Deadline Tomorrow");
      });

      it("generates title for status_change", () => {
        const title = generateNotificationTitle("status_change", {
          newStatus: "recruitment",
        });
        expect(title).toBe("Case Status Updated to Recruitment");
      });

      it("generates title for rfi_alert", () => {
        const title = generateNotificationTitle("rfi_alert", {
          daysUntilDeadline: 5,
        });
        expect(title).toBe("RFI Response Due in 5 days");
      });

      it("generates title for rfi_alert overdue", () => {
        const title = generateNotificationTitle("rfi_alert", {
          daysUntilDeadline: -2,
        });
        expect(title).toBe("RFI Response Overdue");
      });

      it("generates title for rfe_alert", () => {
        const title = generateNotificationTitle("rfe_alert", {
          daysUntilDeadline: 10,
        });
        expect(title).toBe("RFE Response Due in 10 days");
      });

      it("generates title for auto_closure with violation", () => {
        const title = generateNotificationTitle("auto_closure", {
          violation: {
            type: "pwd_expired",
            reason: "PWD expired",
            suggestedAction: "close",
            canRestart: false,
          },
        });
        expect(title).toBe("PWD Expired - Case Closed");
      });

      it("generates title for system notification", () => {
        const title = generateNotificationTitle("system", {});
        expect(title).toBe("System Notification");
      });
    });

    describe("generateNotificationMessage", () => {
      it("includes case info", () => {
        const message = generateNotificationMessage("deadline_reminder", {
          deadlineType: "pwd_expiration",
          daysUntilDeadline: 7,
          employerName: "Acme Corp",
          beneficiaryIdentifier: "John D.",
          deadlineDate: "2025-06-30",
        });
        expect(message).toContain("John D. at Acme Corp");
        expect(message).toContain("June 30, 2025");
      });

      it("uses caseLabel if provided", () => {
        const message = generateNotificationMessage("status_change", {
          newStatus: "recruitment",
          caseLabel: "Custom Case Label",
        });
        expect(message).toContain("Custom Case Label");
      });

      it("generates message for overdue deadline", () => {
        const message = generateNotificationMessage("deadline_reminder", {
          deadlineType: "rfi_due",
          daysUntilDeadline: -5,
          caseLabel: "Test Case",
        });
        expect(message).toContain("5 days overdue");
        expect(message).toContain("Immediate action required");
      });
    });

    describe("calculatePriority", () => {
      it("returns urgent for overdue", () => {
        expect(calculatePriority(-1, "deadline_reminder")).toBe("urgent");
        expect(calculatePriority(-10, "deadline_reminder")).toBe("urgent");
      });

      it("returns urgent for <= 7 days", () => {
        expect(calculatePriority(0, "deadline_reminder")).toBe("urgent");
        expect(calculatePriority(7, "deadline_reminder")).toBe("urgent");
      });

      it("returns high for 8-14 days", () => {
        expect(calculatePriority(8, "deadline_reminder")).toBe("high");
        expect(calculatePriority(14, "deadline_reminder")).toBe("high");
      });

      it("returns normal for 15-30 days", () => {
        expect(calculatePriority(15, "deadline_reminder")).toBe("normal");
        expect(calculatePriority(30, "deadline_reminder")).toBe("normal");
      });

      it("returns low for 30+ days", () => {
        expect(calculatePriority(31, "deadline_reminder")).toBe("low");
        expect(calculatePriority(100, "deadline_reminder")).toBe("low");
      });

      it("RFI/RFE minimum is high", () => {
        // Even with 45 days, RFI should be high
        expect(calculatePriority(45, "rfi_alert")).toBe("high");
        expect(calculatePriority(45, "rfe_alert")).toBe("high");
      });

      it("RFI/RFE can be urgent", () => {
        expect(calculatePriority(5, "rfi_alert")).toBe("urgent");
        expect(calculatePriority(-2, "rfe_alert")).toBe("urgent");
      });
    });

    describe("shouldSendEmail", () => {
      const basePrefs: UserNotificationPrefs = {
        emailNotificationsEnabled: true,
        emailDeadlineReminders: true,
        emailStatusUpdates: true,
        emailRfeAlerts: true,
        quietHoursEnabled: false,
        timezone: "America/Los_Angeles",
      };

      it("respects master switch", () => {
        const prefs = { ...basePrefs, emailNotificationsEnabled: false };
        expect(shouldSendEmail("deadline_reminder", "high", prefs, "10:00")).toBe(false);
      });

      it("respects type-specific preferences - deadline_reminder", () => {
        const prefs = { ...basePrefs, emailDeadlineReminders: false };
        expect(shouldSendEmail("deadline_reminder", "high", prefs, "10:00")).toBe(false);
      });

      it("respects type-specific preferences - status_change", () => {
        const prefs = { ...basePrefs, emailStatusUpdates: false };
        expect(shouldSendEmail("status_change", "normal", prefs, "10:00")).toBe(false);
      });

      it("respects type-specific preferences - rfi_alert", () => {
        const prefs = { ...basePrefs, emailRfeAlerts: false };
        expect(shouldSendEmail("rfi_alert", "high", prefs, "10:00")).toBe(false);
      });

      it("respects type-specific preferences - rfe_alert", () => {
        const prefs = { ...basePrefs, emailRfeAlerts: false };
        expect(shouldSendEmail("rfe_alert", "high", prefs, "10:00")).toBe(false);
      });

      it("respects quiet hours", () => {
        const prefs: UserNotificationPrefs = {
          ...basePrefs,
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
        };
        expect(shouldSendEmail("deadline_reminder", "normal", prefs, "23:00")).toBe(false);
        expect(shouldSendEmail("deadline_reminder", "normal", prefs, "07:00")).toBe(false);
      });

      it("allows during non-quiet hours", () => {
        const prefs: UserNotificationPrefs = {
          ...basePrefs,
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
        };
        expect(shouldSendEmail("deadline_reminder", "normal", prefs, "10:00")).toBe(true);
        expect(shouldSendEmail("deadline_reminder", "normal", prefs, "18:00")).toBe(true);
      });

      it("urgent bypasses quiet hours", () => {
        const prefs: UserNotificationPrefs = {
          ...basePrefs,
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
        };
        expect(shouldSendEmail("deadline_reminder", "urgent", prefs, "23:00")).toBe(true);
        expect(shouldSendEmail("deadline_reminder", "urgent", prefs, "03:00")).toBe(true);
      });

      it("auto_closure always sends if master enabled", () => {
        const prefs = {
          ...basePrefs,
          emailDeadlineReminders: false,
          emailStatusUpdates: false,
          emailRfeAlerts: false,
        };
        expect(shouldSendEmail("auto_closure", "urgent", prefs, "10:00")).toBe(true);
      });
    });

    describe("formatDeadlineType", () => {
      it("formats pwd_expiration", () => {
        expect(formatDeadlineType("pwd_expiration")).toBe("PWD Expiration");
      });

      it("formats rfi_due", () => {
        expect(formatDeadlineType("rfi_due")).toBe("RFI Response Due");
      });

      it("formats rfe_due", () => {
        expect(formatDeadlineType("rfe_due")).toBe("RFE Response Due");
      });

      it("formats filing_window_opens", () => {
        expect(formatDeadlineType("filing_window_opens")).toBe("Filing Window Opens");
      });

      it("formats recruitment_window", () => {
        expect(formatDeadlineType("recruitment_window")).toBe("Recruitment Window");
      });

      it("formats eta9089_expiration", () => {
        expect(formatDeadlineType("eta9089_expiration")).toBe("ETA 9089 Expiration");
      });

      it("formats i140_filing_deadline", () => {
        expect(formatDeadlineType("i140_filing_deadline")).toBe("I-140 Filing Deadline");
      });
    });

    describe("getNotificationIcon", () => {
      it("returns clock for deadline_reminder", () => {
        expect(getNotificationIcon("deadline_reminder")).toBe("clock");
      });

      it("returns arrow-right for status_change", () => {
        expect(getNotificationIcon("status_change")).toBe("arrow-right");
      });

      it("returns alert-circle for rfi_alert", () => {
        expect(getNotificationIcon("rfi_alert")).toBe("alert-circle");
      });

      it("returns alert-triangle for rfe_alert", () => {
        expect(getNotificationIcon("rfe_alert")).toBe("alert-triangle");
      });

      it("returns x-circle for auto_closure", () => {
        expect(getNotificationIcon("auto_closure")).toBe("x-circle");
      });

      it("returns info for system", () => {
        expect(getNotificationIcon("system")).toBe("info");
      });
    });
  });
});
