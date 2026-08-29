/**
 * Convex Cron Jobs Configuration
 *
 * Scheduled jobs (11 total):
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
  // Consolidated: ONE digest email per user (replaces the per-deadline blast).
  // Per-(case, deadline) in-app notifications are unchanged.
  internal.deadlineDigest.runDeadlineReminders
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
 * Weekly digest email (Mondays at 15:00 UTC / ~11 AM ET)
 *
 * Staggered one hour AFTER the daily deadline-reminders job (14:00 UTC) so the
 * two bulk sends never collide in the same minute on Mondays.
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
  { dayOfWeek: "monday", hourUTC: 15, minuteUTC: 0 },
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
  // Routes through the cleanup wrapper so the cron path also deletes Google
  // Calendar events + the Resend contact, not just the DB rows.
  internal.accountDeletion.processExpiredDeletions
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

// ============================================================================
// ORPHANED PROFILE CLEANUP
// ============================================================================

/**
 * Daily safety net for userProfiles whose userId points to a deleted user.
 *
 * The account-deletion cascade (purgeAllUserData) deletes the profile with the
 * user, so this should normally find nothing — it's insurance against a partial
 * deletion. Runs at 3:30 AM UTC, near the other low-traffic daily cleanups.
 */
crons.daily(
  "orphaned-profile-cleanup",
  { hourUTC: 3, minuteUTC: 30 },
  internal.admin.cleanupOrphanedProfiles
);

// ============================================================================
// RE-ENGAGEMENT NUDGE
// ============================================================================

/**
 * Daily re-engagement pass: emails inactive users who still have the weekly
 * digest on, and pauses the digest if the nudge goes unanswered. Runs at 16:00
 * UTC (noon ET) — separate from the other bulk email jobs.
 */
crons.daily(
  "reengagement-check",
  { hourUTC: 16, minuteUTC: 0 },
  internal.reengagement.runReengagementCheck
);

// ============================================================================
// DOL PROCESSING TIMES
// ============================================================================

/**
 * Weekly capture of https://flag.dol.gov/processingtimes.
 *
 * DOL overwrites this page rather than archiving it, so anything we miss is
 * gone. Weekly rather than monthly on purpose: the PERM and prevailing-wage
 * sections update on different cadences, DOL occasionally corrects a figure
 * out of band, and "first work week" is not a fixed date. The run is one
 * ~160 KB GET, and `store` inserts only when the content hash changes, so
 * extra runs cost almost nothing and cannot pollute the series.
 *
 * Wednesday 15:00 UTC (11:00 ET) sits after DOL's first-work-week refresh has
 * reliably landed in any given month.
 */
// DAILY, not weekly (changed 2026-08-29). The public site reads the DOL
// frontier from Turso, refreshed daily by processing-times-ingest.yml; this
// Convex snapshot is what the QUEUE-MONTH ALERTS read. Weekly, the two
// diverged: on 2026-08-29 Turso had advanced to analyst-review month 2025-11
// while this table was still on 2025-09, so a real subscriber whose filing
// month was 2025-11 was overdue an email that never fired — the alert system
// judged them not-yet-reached off stale data. Daily keeps the alert source
// within a day of the site, matching the case-status alert SLA. store is
// insert-only-on-content-hash-change, so the extra runs cost a ~160KB GET and
// nothing else on the ~29 days DOL does not move.
crons.daily(
  "dol-processing-times-refresh",
  { hourUTC: 15, minuteUTC: 0 },
  internal.dolProcessingTimes.refresh
);

// ============================================================================
// PER-CASE STATUS ALERTS
// ============================================================================

/**
 * Look at every live case subscription and mail the ones whose case has moved.
 *
 * Twice a day rather than hourly. The upstream that feeds it
 * (`scripts/mirror_case_status.py`) refreshes at most daily, so a more frequent
 * sweep would re-read the same rows for no new information, and the sweep's own
 * cost is one bounded SQL query against the mirror plus at most
 * ALERT_BATCH_LIMIT sends. Twice a day keeps the worst-case lag between the
 * mirror recording a change and the subscriber hearing about it under twelve
 * hours, which is well inside the resolution of the underlying data: DOL
 * publishes no timestamp for a status change at all.
 *
 * 11:00 and 23:00 UTC (7am and 7pm ET), deliberately clear of the 14:00, 15:00
 * and 16:00 UTC bulk email jobs above so the two never contend for the shared
 * Resend quota in the same minute.
 *
 * The sweep reschedules ITSELF when work remains, so these two ticks are the
 * floor rather than the ceiling.
 */
crons.cron(
  "case-status-alerts",
  "0 11,23 * * *",
  internal.caseAlerts.sweepCaseChanges,
  {}
);

// ============================================================================
// VISA BULLETIN ALERTS
// ============================================================================

/**
 * Compare every bulletin subscription against the newest bulletin in the
 * archive and mail the ones whose cutoff moved.
 *
 * Daily because the archive is fed by a monthly ingest whose landing day
 * varies (a saved page or an Archive capture, whenever it arrives); on the
 * ~29 quiet days this is one Turso row read and zero sends. 17:30 UTC sits
 * clear of every bulk email job above.
 */
crons.daily(
  "bulletin-alerts",
  { hourUTC: 17, minuteUTC: 30 },
  internal.bulletinAlerts.sweep,
  {}
);

export default crons;
