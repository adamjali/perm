/**
 * Convex Cron Jobs Configuration
 *
 * Scheduled jobs for automated notification tasks:
 * - Daily deadline reminder checks (9 AM EST / 14:00 UTC)
 * - Hourly cleanup of old read notifications (90+ days old)
 * - Weekly digest emails (Mondays at 9 AM EST / 14:00 UTC)
 *
 * IMPORTANT: All cron handlers use `internal` functions for security.
 * Never expose scheduled job handlers to the public API.
 *
 * Time Reference:
 * - EST = UTC - 5 hours (standard time)
 * - 9 AM EST = 14:00 UTC
 *
 * @see https://docs.convex.dev/scheduling/cron-jobs
 * @module
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============================================================================
// DEADLINE REMINDERS
// ============================================================================

/**
 * Daily deadline reminder check at 9 AM EST (14:00 UTC)
 *
 * Checks all active cases for upcoming deadlines and creates notifications
 * at user-configured intervals (default: 1, 3, 7, 14, 30 days before).
 * Sends email reminders for users with email notifications enabled.
 *
 * Idempotent: Uses deduplication to prevent duplicate notifications
 * for the same deadline + interval combination.
 */
crons.daily(
  "deadline-reminders",
  { hourUTC: 14, minuteUTC: 0 },
  internal.scheduledJobs.checkDeadlineReminders
);

// ============================================================================
// NOTIFICATION CLEANUP
// ============================================================================

/**
 * Hourly cleanup of old read notifications (older than 90 days)
 *
 * Removes read notifications older than 90 days to keep the database
 * clean and maintain performance. Unread notifications are preserved
 * regardless of age.
 *
 * Runs at :30 past each hour to avoid collision with other hourly tasks.
 */
crons.hourly(
  "notification-cleanup",
  { minuteUTC: 30 },
  internal.scheduledJobs.cleanupOldNotifications
);

// ============================================================================
// WEEKLY DIGEST
// ============================================================================

/**
 * Weekly digest email (Mondays at 9 AM EST / 14:00 UTC)
 *
 * Sends a summary email to users with daily digest enabled, containing:
 * - All upcoming deadlines for the week
 * - Any unread notifications
 * - Summary of recent case status changes
 *
 * Only sent to users who have opted in via notification preferences.
 */
crons.weekly(
  "weekly-digest",
  { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 },
  internal.scheduledJobs.sendWeeklyDigest
);

// ============================================================================
// ACCOUNT DELETION CLEANUP
// ============================================================================

/**
 * Hourly check for expired account deletions (safety net)
 *
 * Catches any accounts where the scheduled deletion job failed or was missed.
 * Finds users where deletedAt timestamp is in the past and processes
 * their permanent deletion.
 *
 * Runs at :45 past each hour to avoid collision with other hourly tasks.
 */
crons.hourly(
  "account-deletion-cleanup",
  { minuteUTC: 45 },
  internal.scheduledJobs.processExpiredDeletions
);

// ============================================================================
// RATE LIMIT CLEANUP
// ============================================================================

/**
 * Hourly cleanup of old rate limit records (older than 24 hours)
 *
 * Removes rate limit entries to prevent the rateLimits table from growing
 * unbounded. Records are processed in batches.
 *
 * Runs at :15 past each hour to avoid collision with other hourly tasks.
 */
crons.hourly(
  "rate-limit-cleanup",
  { minuteUTC: 15 },
  internal.scheduledJobs.cleanupRateLimits
);

export default crons;
