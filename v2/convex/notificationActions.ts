/**
 * Notification Email Actions
 *
 * Actions for sending notification emails via Resend.
 * Each action renders a React Email template to HTML and sends via Resend,
 * then marks the notification as emailed on success.
 *
 * INTERNAL ACTIONS (server-side only):
 * - sendDeadlineReminderEmail: Send deadline reminder email
 * - sendStatusChangeEmail: Send status change email
 * - sendRfiAlertEmail: Send RFI alert email
 * - sendRfeAlertEmail: Send RFE alert email
 * - sendAutoClosureEmail: Send auto-closure notification email
 * - sendAdminNotificationEmail: Send admin notification (non-throwing)
 *
 * PUBLIC ACTIONS (exposed to client):
 * - sendTestEmail: Send a test email to verify configuration
 *
 * Environment variables required:
 * - AUTH_RESEND_KEY: Resend API key
 *
 * @module
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { loggers } from "./lib/logging";
import { getResend, FROM_EMAIL } from "./lib/email";
import { recordError } from "./lib/errorRecording";

const log = loggers.email;
import { DeadlineReminder } from "../src/emails/DeadlineReminder";
import { StatusChange } from "../src/emails/StatusChange";
import { RfiAlert } from "../src/emails/RfiAlert";
import { RfeAlert } from "../src/emails/RfeAlert";
import { AutoClosure } from "../src/emails/AutoClosure";
import { WeeklyDigest } from "../src/emails/WeeklyDigest";
import type { DigestContent } from "./lib/digestHelpers";

// App URL for generating links (falls back to production URL)
function getAppUrl(): string {
  return process.env.APP_URL || "https://permtracker.app";
}

/**
 * Build common URLs used in notification emails.
 */
function buildEmailUrls(caseId?: string): { appUrl: string; caseUrl?: string; settingsUrl: string } {
  const appUrl = getAppUrl();
  return {
    appUrl,
    caseUrl: caseId ? `${appUrl}/cases/${caseId}` : undefined,
    settingsUrl: `${appUrl}/settings/notifications`,
  };
}


/**
 * Send an email via Resend and optionally mark notification as sent.
 *
 * This helper centralizes the email sending pattern used across all notification types:
 * 1. Guard: verify notification still exists (user may have been deleted)
 * 2. Initialize Resend client
 * 3. Send the email
 * 4. Log errors if any
 * 5. Mark notification as emailed (if notificationId provided)
 *
 * @throws Error if email sending fails
 */
async function sendNotificationEmail(
  ctx: {
    runMutation: (fn: typeof internal.notifications.markEmailSent, args: { notificationId: Id<"notifications"> }) => Promise<unknown>;
    runQuery: (fn: typeof internal.notifications.isNotificationValid, args: { notificationId: Id<"notifications"> }) => Promise<boolean>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scheduler: { runAfter: (delay: number, fn: any, args: any) => Promise<any> };
  },
  params: {
    to: string;
    subject: string;
    html: string;
    notificationId?: Id<"notifications">;
    logContext: string;
  }
): Promise<void> {
  // Guard: if we have a notificationId, verify it still exists (user may have been deleted)
  if (params.notificationId) {
    const isValid = await ctx.runQuery(internal.notifications.isNotificationValid, {
      notificationId: params.notificationId,
    });
    if (!isValid) {
      log.info(`Skipping ${params.logContext} email: notification deleted (user may have been deleted)`, {
        to: params.to,
      });
      return;
    }
  }

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    log.error(`Failed to send ${params.logContext} email`, { error: error.message, to: params.to });
    await recordError(ctx, "action", `notificationActions.${params.logContext}`, new Error(`Email failed: ${error.message}`));
    throw new Error(`Email failed: ${error.message}`);
  }

  if (params.notificationId) {
    await ctx.runMutation(internal.notifications.markEmailSent, {
      notificationId: params.notificationId,
    });
  }
}

/**
 * Generate email subject for deadline reminders based on urgency.
 */
function generateDeadlineSubject(deadlineType: string, employerName: string, daysUntil: number): string {
  if (daysUntil <= 0) {
    return `OVERDUE: ${deadlineType} for ${employerName}`;
  }
  if (daysUntil <= 7) {
    return `Urgent: ${deadlineType} in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
  }
  return `Reminder: ${deadlineType} in ${daysUntil} days`;
}

/**
 * Generate email subject for RFI/RFE alerts based on urgency.
 */
function generateAlertSubject(
  type: "RFI" | "RFE",
  beneficiaryName: string,
  daysRemaining: number,
  alertType: "new" | "reminder",
  urgentThreshold: number = 7
): string {
  if (daysRemaining <= 0) {
    return `OVERDUE: ${type} Response for ${beneficiaryName}`;
  }
  if (daysRemaining <= urgentThreshold) {
    return `Urgent: ${type} Response Due in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} - ${beneficiaryName}`;
  }
  if (alertType === "new") {
    return `New ${type} Received - ${beneficiaryName}`;
  }
  return `${type} Response Due in ${daysRemaining} days - ${beneficiaryName}`;
}

// ============================================================================
// DEADLINE REMINDER EMAIL
// ============================================================================

/**
 * Send a deadline reminder email.
 */
export const sendDeadlineReminderEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    employerName: v.string(),
    beneficiaryName: v.string(),
    deadlineType: v.string(),
    deadlineDate: v.string(),
    daysUntil: v.number(),
    caseId: v.string(),
  },
  handler: async (ctx, args) => {
    const { caseUrl, settingsUrl } = buildEmailUrls(args.caseId);

    const html = await render(
      DeadlineReminder({
        employerName: args.employerName,
        beneficiaryName: args.beneficiaryName,
        deadlineType: args.deadlineType,
        deadlineDate: args.deadlineDate,
        daysUntil: args.daysUntil,
        caseUrl: caseUrl!,
        settingsUrl,
      })
    );

    const subject = generateDeadlineSubject(args.deadlineType, args.employerName, args.daysUntil);

    await sendNotificationEmail(ctx, {
      to: args.to,
      subject,
      html,
      notificationId: args.notificationId,
      logContext: "deadline reminder",
    });
  },
});

// ============================================================================
// STATUS CHANGE EMAIL
// ============================================================================

/**
 * Send a status change email.
 */
export const sendStatusChangeEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    beneficiaryName: v.string(),
    companyName: v.string(),
    previousStatus: v.string(),
    newStatus: v.string(),
    changeType: v.union(v.literal("stage"), v.literal("progress")),
    changedAt: v.string(),
    caseId: v.string(),
    caseNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { caseUrl } = buildEmailUrls(args.caseId);

    const html = await render(
      StatusChange({
        beneficiaryName: args.beneficiaryName,
        companyName: args.companyName,
        previousStatus: args.previousStatus,
        newStatus: args.newStatus,
        changeType: args.changeType,
        changedAt: args.changedAt,
        caseUrl: caseUrl!,
        caseNumber: args.caseNumber,
      })
    );

    const changeLabel = args.changeType === "stage" ? "Stage" : "Progress";
    const subject = `Case ${changeLabel} Updated: ${args.previousStatus} to ${args.newStatus} - ${args.beneficiaryName}`;

    await sendNotificationEmail(ctx, {
      to: args.to,
      subject,
      html,
      notificationId: args.notificationId,
      logContext: "status change",
    });
  },
});

// ============================================================================
// RFI ALERT EMAIL
// ============================================================================

/**
 * Send an RFI alert email.
 */
export const sendRfiAlertEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    beneficiaryName: v.string(),
    companyName: v.string(),
    dueDate: v.string(),
    daysRemaining: v.number(),
    receivedDate: v.string(),
    alertType: v.union(v.literal("new"), v.literal("reminder")),
    caseId: v.string(),
    caseNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { caseUrl } = buildEmailUrls(args.caseId);

    const html = await render(
      RfiAlert({
        beneficiaryName: args.beneficiaryName,
        companyName: args.companyName,
        dueDate: args.dueDate,
        daysRemaining: args.daysRemaining,
        receivedDate: args.receivedDate,
        alertType: args.alertType,
        caseUrl: caseUrl!,
        caseNumber: args.caseNumber,
      })
    );

    const subject = generateAlertSubject("RFI", args.beneficiaryName, args.daysRemaining, args.alertType);

    await sendNotificationEmail(ctx, {
      to: args.to,
      subject,
      html,
      notificationId: args.notificationId,
      logContext: "RFI alert",
    });
  },
});

// ============================================================================
// RFE ALERT EMAIL
// ============================================================================

/**
 * Send an RFE alert email.
 */
export const sendRfeAlertEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    beneficiaryName: v.string(),
    companyName: v.string(),
    dueDate: v.string(),
    daysRemaining: v.number(),
    receivedDate: v.string(),
    alertType: v.union(v.literal("new"), v.literal("reminder")),
    caseId: v.string(),
    caseNumber: v.optional(v.string()),
    i140FilingDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { caseUrl } = buildEmailUrls(args.caseId);

    const html = await render(
      RfeAlert({
        beneficiaryName: args.beneficiaryName,
        companyName: args.companyName,
        dueDate: args.dueDate,
        daysRemaining: args.daysRemaining,
        receivedDate: args.receivedDate,
        alertType: args.alertType,
        caseUrl: caseUrl!,
        caseNumber: args.caseNumber,
        i140FilingDate: args.i140FilingDate,
      })
    );

    // RFE uses 14-day urgent threshold (vs 7 for RFI)
    const subject = generateAlertSubject("RFE", args.beneficiaryName, args.daysRemaining, args.alertType, 14);

    await sendNotificationEmail(ctx, {
      to: args.to,
      subject,
      html,
      notificationId: args.notificationId,
      logContext: "RFE alert",
    });
  },
});

// ============================================================================
// AUTO-CLOSURE EMAIL
// ============================================================================

/**
 * Send an auto-closure email.
 */
export const sendAutoClosureEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    beneficiaryName: v.string(),
    companyName: v.string(),
    violationType: v.string(),
    reason: v.string(),
    closedAt: v.string(),
    caseId: v.string(),
    caseNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { caseUrl } = buildEmailUrls(args.caseId);

    const html = await render(
      AutoClosure({
        beneficiaryName: args.beneficiaryName,
        companyName: args.companyName,
        violationType: args.violationType,
        reason: args.reason,
        closedAt: args.closedAt,
        caseUrl: caseUrl!,
        caseNumber: args.caseNumber,
      })
    );

    const subject = `CASE CLOSED: ${args.beneficiaryName} at ${args.companyName} - ${args.violationType}`;

    await sendNotificationEmail(ctx, {
      to: args.to,
      subject,
      html,
      notificationId: args.notificationId,
      logContext: "auto-closure",
    });
  },
});

// ============================================================================
// ACCOUNT DELETION CONFIRMATION EMAIL
// ============================================================================

/**
 * Send an account deletion confirmation email.
 *
 * Handles both scheduled and immediate deletions via the `immediate` flag.
 * - Scheduled: shows deletionDate and cancel link
 * - Immediate: shows today's date and no cancel link
 *
 * @param to - Recipient email address
 * @param userName - User's display name or email
 * @param deletionDate - Human-readable deletion date (scheduled only)
 * @param immediate - Whether deletion is immediate (bypasses grace period)
 */
export const sendAccountDeletionEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    deletionDate: v.optional(v.string()),
    immediate: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const appUrl = getAppUrl();
    const isImmediate = args.immediate ?? false;
    const supportUrl = "mailto:support@permtracker.app";

    const { AccountDeletionConfirm } = await import(
      "../src/emails/AccountDeletionConfirm"
    );

    const { formatDateForNotification } = await import("./lib/formatDate");
    const deletionDate = isImmediate
      ? formatDateForNotification(Date.now(), true)
      : args.deletionDate!;

    const html = await render(
      AccountDeletionConfirm({
        userName: args.userName,
        deletionDate,
        cancelUrl: `${appUrl}/settings`,
        supportUrl,
        ...(isImmediate ? { immediate: true } : {}),
      })
    );

    const subject = isImmediate
      ? "Account Deleted - PERM Tracker"
      : "Account Deletion Scheduled - PERM Tracker";

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.to],
      subject,
      html,
    });

    if (error) {
      log.error('Failed to send account deletion email', { error: error.message, to: args.to, immediate: isImmediate });
      throw new Error(`Email failed: ${error.message}`);
    }

    log.info('Account deletion email sent', { to: args.to, immediate: isImmediate });
  },
});


// ============================================================================
// WEEKLY DIGEST EMAIL
// ============================================================================

/**
 * Convex validator for DigestDeadline type.
 */
const digestDeadlineValidator = v.object({
  caseId: v.id("cases"),
  employerName: v.string(),
  beneficiaryIdentifier: v.string(),
  deadlineType: v.string(),
  deadlineDate: v.string(),
  daysUntil: v.number(),
  urgency: v.union(
    v.literal("overdue"),
    v.literal("urgent"),
    v.literal("upcoming"),
    v.literal("later")
  ),
});

/**
 * Convex validator for DigestCaseUpdate type.
 */
const digestCaseUpdateValidator = v.object({
  caseId: v.id("cases"),
  employerName: v.string(),
  beneficiaryIdentifier: v.string(),
  caseStatus: v.string(),
  updatedAt: v.number(),
  changeDescription: v.string(),
});

/**
 * Convex validator for DigestStats type.
 */
const digestStatsValidator = v.object({
  totalActiveCases: v.number(),
  overdueCount: v.number(),
  urgentCount: v.number(),
  unreadNotificationCount: v.number(),
});

/**
 * Convex validator for DigestContent type.
 */
const digestContentValidator = v.object({
  userName: v.string(),
  userEmail: v.string(),
  weekStartDate: v.string(),
  weekEndDate: v.string(),
  stats: digestStatsValidator,
  overdueDeadlines: v.array(digestDeadlineValidator),
  next7DaysDeadlines: v.array(digestDeadlineValidator),
  next14DaysDeadlines: v.array(digestDeadlineValidator),
  recentCaseUpdates: v.array(digestCaseUpdateValidator),
  isEmpty: v.boolean(),
  emptyMessage: v.string(),
});

/**
 * Send a weekly digest email.
 *
 * @param to - Recipient email address
 * @param digestContent - Complete digest content built by digestHelpers
 */
export const sendWeeklyDigestEmail = internalAction({
  args: {
    to: v.string(),
    digestContent: digestContentValidator,
  },
  handler: async (ctx, args) => {
    // Guard: verify user still exists before sending digest
    const userActive = await ctx.runQuery(internal.notifications.isUserActiveByEmail, {
      email: args.to,
    });
    if (!userActive) {
      log.info('Skipping weekly digest email: user no longer exists', { to: args.to });
      return;
    }

    const appUrl = getAppUrl();
    const settingsUrl = `${appUrl}/settings`;

    // Cast to DigestContent type (validators ensure correct shape)
    const digestContent = args.digestContent as DigestContent;

    // Render React Email template to HTML
    const html = await render(
      WeeklyDigest({
        digestContent,
        baseUrl: appUrl,
        settingsUrl,
      })
    );

    // Generate subject based on content
    const { stats, isEmpty } = digestContent;
    let subject: string;
    if (isEmpty) {
      subject = "Your Weekly PERM Summary - All Clear!";
    } else if (stats.overdueCount > 0) {
      subject = `Weekly PERM Summary: ${stats.overdueCount} Overdue, ${stats.urgentCount} This Week`;
    } else if (stats.urgentCount > 0) {
      subject = `Weekly PERM Summary: ${stats.urgentCount} Deadline${stats.urgentCount !== 1 ? "s" : ""} This Week`;
    } else {
      subject = "Your Weekly PERM Summary";
    }

    // Send email via Resend
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.to],
      subject,
      html,
    });

    if (error) {
      log.error('Failed to send weekly digest email', { error: error.message, to: args.to });
      throw new Error(`Email failed: ${error.message}`);
    }

    log.info('Weekly digest email sent', { to: args.to });
  },
});

// ============================================================================
// TEST EMAIL
// ============================================================================

/**
 * Send a test email to verify email configuration.
 *
 * This action is exposed to the client (not internal) so users can
 * test their email notification setup from the settings page.
 *
 * @param email - Email address to send test to
 */
export const sendTestEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (_ctx, args) => {
    const appUrl = getAppUrl();
    const settingsUrl = `${appUrl}/settings/notifications`;

    // Render branded test email template
    const { render } = await import("@react-email/render");
    const { TestEmail } = await import("../src/emails/TestEmail");
    const html = await render(TestEmail({ settingsUrl }));

    // Send email via Resend
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.email],
      subject: "PERM Tracker: Test email successful",
      html,
    });

    if (error) {
      log.error('Failed to send test email', { error: error.message, to: args.email });
      throw new Error(`Email failed: ${error.message}`);
    }

    return { success: true };
  },
});

// ============================================================================
// ADMIN NOTIFICATION EMAIL
// ============================================================================

/**
 * Send an admin notification email (e.g., new user signup, case created).
 *
 * Uses the branded AdminEmail template and sends to the admin email address.
 *
 * INTENTIONALLY non-throwing: admin notifications must never block user
 * operations (signup, case creation). Errors are logged but swallowed so
 * the calling action can continue normally.
 */
export const sendAdminNotificationEmail = internalAction({
  args: {
    subject: v.string(),
    body: v.string(),
    to: v.optional(v.string()),
    recipientName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { ADMIN_EMAIL } = await import("./lib/admin");
    const { AdminEmail } = await import("../src/emails/AdminEmail");

    const toEmail = args.to || ADMIN_EMAIL;
    if (!toEmail) {
      log.error("No recipient email for admin notification (ADMIN_EMAIL not configured)");
      return;
    }
    const name = args.recipientName || "Admin";

    const html = await render(
      AdminEmail({
        recipientName: name,
        subject: args.subject,
        body: args.body,
      })
    );

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: args.subject,
      html,
    });

    if (error) {
      log.error("Failed to send admin notification email", {
        error: error.message,
        subject: args.subject,
      });
      return;
    }

    log.info("Admin notification email sent", { subject: args.subject });
  },
});
