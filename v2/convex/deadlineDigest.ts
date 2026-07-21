/**
 * Consolidated daily deadline digest cron.
 *
 * Replaces the old one-email-per-deadline blast (which let a single attorney's
 * many cases blow Resend's daily cap in one run). It creates the per-(case,
 * deadline) in-app notifications EXACTLY as before, but consolidates the EMAILS
 * into ONE digest per user.
 *
 * The trigger/dedup logic is unchanged — it calls the existing
 * `scheduledJobs.getCasesNeedingReminders` query. This lives in its own file to
 * avoid expanding scheduledJobs.ts, which is large and full of un-indexed
 * full-table `.filter` scans (see CONCERNS.md) we don't want to risk touching.
 *
 * Wired from crons.ts ("deadline-reminders").
 *
 * @module
 */

import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { loggers } from "./lib/logging";
import { assertBlocklistConfigured } from "./lib/emailBlocklist";
import { recordError } from "./lib/errorRecording";
import {
  generateNotificationTitle,
  generateNotificationMessage,
  calculatePriority,
  shouldSendEmail,
  type NotificationType,
} from "./lib/notificationHelpers";
import { groupRemindersByUser, type DigestReminderInput } from "./lib/reminderDigest";

const log = loggers.scheduler;

/** Current time as HH:MM in a given IANA timezone (for quiet-hours checks). */
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`;
  }
}

/** Resolve first names for a set of users, for the digest greeting. */
export const getDisplayNames = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const out: Record<string, string> = {};
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      out[userId] = (user?.name || "").trim().split(/\s+/)[0] || "there";
    }
    return out;
  },
});

/**
 * Daily: create per-deadline in-app notifications and send ONE consolidated
 * digest email per user. Trigger + dedup come from getCasesNeedingReminders;
 * this only reshapes the email output from per-deadline to per-user.
 */
export const runDeadlineReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; emailsScheduled: number }> => {
    // Config health check. The email blocklist is a permanent suppression list
    // sourced from the BLOCKED_EMAILS env var; if that var goes missing the
    // list silently empties and previously blocked people start receiving mail
    // again. This is the largest scheduled send in the system, so it is the
    // right place to notice. Reported, never fatal: an inert blocklist must not
    // stop the digest, or a config typo becomes a mail outage.
    try {
      assertBlocklistConfigured();
    } catch (error) {
      await recordError(ctx, "cron", "deadlineDigest.blocklistConfig", error);
    }

    const reminders = await ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders);

    let processed = 0;
    const emailWorthy: Array<{
      userId: Id<"users">;
      to: string;
      caseId: Id<"cases">;
      employerName: string;
      beneficiaryIdentifier: string;
      deadlineType: string;
      deadlineDate: string;
      daysUntil: number;
    }> = [];

    for (const reminder of reminders) {
      let notificationType: NotificationType = "deadline_reminder";
      if (reminder.deadlineType === "rfi_due") notificationType = "rfi_alert";
      else if (reminder.deadlineType === "rfe_due") notificationType = "rfe_alert";

      const caseLabel = `${reminder.beneficiaryIdentifier} at ${reminder.employerName}`;
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
      const priority = calculatePriority(reminder.daysUntilDeadline, notificationType);

      // In-app notification stays per (case, deadline) — only the email consolidates.
      await ctx.runMutation(internal.notifications.createNotification, {
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

      const currentTime = getCurrentTimeInTimezone(reminder.userPrefs.timezone);
      const sendEmail = shouldSendEmail(notificationType, priority, reminder.userPrefs, currentTime);

      if (sendEmail) {
        emailWorthy.push({
          userId: reminder.userId,
          to: reminder.userEmail,
          caseId: reminder.caseId,
          employerName: reminder.employerName,
          beneficiaryIdentifier: reminder.beneficiaryIdentifier,
          deadlineType: reminder.deadlineType,
          deadlineDate: reminder.deadlineDate,
          daysUntil: reminder.daysUntilDeadline,
        });
      }

      // Push notification per reminder (unchanged), gated like email.
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

    // Consolidate: ONE digest email per user.
    let emailsScheduled = 0;
    if (emailWorthy.length > 0) {
      const uniqueUserIds = [...new Set(emailWorthy.map((e) => e.userId))] as Id<"users">[];
      const names = await ctx.runQuery(internal.deadlineDigest.getDisplayNames, {
        userIds: uniqueUserIds,
      });

      const inputs: DigestReminderInput[] = emailWorthy.map((e) => ({
        userId: e.userId,
        to: e.to,
        userName: names[e.userId] ?? "there",
        caseId: e.caseId,
        employerName: e.employerName,
        beneficiaryIdentifier: e.beneficiaryIdentifier,
        deadlineType: e.deadlineType,
        deadlineDate: e.deadlineDate,
        daysUntil: e.daysUntil,
      }));

      const digests = groupRemindersByUser(inputs);
      let emailIndex = 0;
      for (const digest of digests) {
        // Stagger one digest per user, ~1/sec, to stay under Resend's rate limit.
        await ctx.scheduler.runAfter(
          emailIndex * 1000,
          internal.notificationActions.sendDeadlineDigestEmail,
          { to: digest.to, userName: digest.userName, items: digest.items }
        );
        emailIndex++;
        emailsScheduled++;
      }
    }

    log.info("Deadline reminders processed", { processed, emailsScheduled });
    return { processed, emailsScheduled };
  },
});
