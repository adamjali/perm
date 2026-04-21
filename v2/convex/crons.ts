/**
 * Convex Cron Jobs Configuration
 *
 * Scheduled jobs (7 total):
 * - Daily deadline enforcement (6 AM EST / 10:00 UTC)
 * - Daily deadline reminder checks (9 AM EST / 14:00 UTC)
 * - Hourly cleanup of old read notifications (90+ days, at :30)
 * - Weekly digest emails (Mondays at 9 AM EST / 14:00 UTC)
 * - Hourly account deletion cleanup (safety net, at :45)
 * - Hourly rate limit record cleanup (24h+ old, at :15)
 * - Daily AI conversation TTL cleanup (90+ days, 3:00 AM UTC)
 *
 * IMPORTANT: All cron handlers use `internal` functions for security.
 * Never expose scheduled job handlers to the public API.
 *
 * Time Reference:
 * - EST (Nov–Mar) = UTC - 5 hours | EDT (Mar–Nov) = UTC - 4 hours
 * - 9 AM EST = 14:00 UTC | 9 AM EDT = 13:00 UTC
 * - Cron times are fixed UTC; local wall-clock shifts with DST
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
// DEADLINE ENFORCEMENT
// ============================================================================

/**
 * Daily deadline enforcement at 6 AM EST (10:00 UTC)
 *
 * Closes cases with deadline violations for users who have
 * autoDeadlineEnforcementEnabled = true. Creates notifications and
 * sends auto-closure emails immediately (not waiting for user login).
 *
 * Runs before US business hours so enforcement is complete before users
 * log in. The login-triggered checkAndEnforceDeadlines mutation remains
 * as a same-day fallback — it naturally no-ops for already-closed cases.
 */
crons.daily(
  "deadline-enforcement",
  { hourUTC: 10, minuteUTC: 0 },
  internal.scheduledJobs.enforceDeadlinesForAllUsers
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
 * Sends a summary email to users with weekly digest enabled, containing:
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

// ============================================================================
// CONVERSATION TTL CLEANUP
// ============================================================================

/**
 * Daily cleanup of expired AI conversations (older than 90 days)
 *
 * Removes conversations and their messages to limit retention of
 * AI chat data per SOC 2 C1 — Confidentiality.
 *
 * Runs at 3:00 AM UTC to minimize user impact.
 */
crons.daily(
  "conversation-ttl-cleanup",
  { hourUTC: 3, minuteUTC: 0 },
  internal.scheduledJobs.cleanupExpiredConversations
);

// ============================================================================
// ABUSE BLOCKLIST CLEANUP
// ============================================================================

/**
 * Hourly cleanup of expired abuse blocklist entries.
 *
 * Keeps the abuseBlocklist table bounded — most blocks are 24h auto-ban
 * from IP rate-limit abuse. Cron runs at :40 past each hour to avoid
 * collisions with other hourly tasks.
 */
crons.hourly(
  "abuse-blocklist-cleanup",
  { minuteUTC: 40 },
  internal.abuseBlocklist.cleanupExpiredBlocks
);

export default crons;
