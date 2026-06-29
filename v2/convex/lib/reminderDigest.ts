/**
 * Daily deadline-digest helpers.
 *
 * Consolidation: the daily reminder cron used to send ONE email per (case,
 * deadline) that hit a reminder interval — so a user with N due deadlines got N
 * separate emails (an attorney with many cases could blow Resend's daily cap in
 * one run). These helpers group a user's triggered reminders into a single
 * per-user digest and map each to a display row.
 *
 * The trigger/dedup logic (which deadlines fire today) is UNCHANGED and lives in
 * `scheduledJobs.getCasesNeedingReminders`; this module only reshapes the email
 * output from per-deadline to per-user. The per-(case, deadline) in-app
 * notifications are still created individually — only the emails are batched.
 *
 * @module
 */

import type { Id } from "../_generated/dataModel";
import {
  getDeadlineUrgency,
  formatDeadlineType,
  type DigestDeadline,
} from "./digestHelpers";

/** One deadline row in a user's daily digest. */
export interface DeadlineDigestItem {
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  /** Human-readable deadline type (e.g. "PWD Expiration"). */
  deadlineType: string;
  /** ISO date string (YYYY-MM-DD). */
  deadlineDate: string;
  daysUntil: number;
  urgency: DigestDeadline["urgency"];
}

/** A single user's consolidated daily digest. */
export interface UserDeadlineDigest {
  userId: Id<"users">;
  to: string;
  userName: string;
  items: DeadlineDigestItem[];
}

/**
 * Minimal reminder shape needed to build a digest — a subset of the cron's
 * `DeadlineReminder`. Kept narrow so the grouping logic is trivially testable.
 */
export interface DigestReminderInput {
  userId: Id<"users">;
  to: string;
  /** Recipient's display name, for the digest greeting. */
  userName: string;
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  /** Raw deadline type (formatted on the way into the item). */
  deadlineType: string;
  deadlineDate: string;
  daysUntil: number;
}

/** Map a triggered reminder to a display row (formats type, derives urgency). */
export function reminderToDigestItem(r: DigestReminderInput): DeadlineDigestItem {
  return {
    caseId: r.caseId,
    employerName: r.employerName,
    beneficiaryIdentifier: r.beneficiaryIdentifier,
    deadlineType: formatDeadlineType(r.deadlineType),
    deadlineDate: r.deadlineDate,
    daysUntil: r.daysUntil,
    urgency: getDeadlineUrgency(r.daysUntil),
  };
}

/**
 * Group triggered reminders into one digest per user.
 *
 * Preserves first-seen user order. Within each user, items are sorted
 * overdue-first (most negative `daysUntil`) then by soonest date, so the most
 * urgent deadline leads the email.
 */
export function groupRemindersByUser(
  reminders: DigestReminderInput[]
): UserDeadlineDigest[] {
  const byUser = new Map<string, UserDeadlineDigest>();

  for (const r of reminders) {
    const key = r.userId as unknown as string;
    let bucket = byUser.get(key);
    if (!bucket) {
      bucket = { userId: r.userId, to: r.to, userName: r.userName, items: [] };
      byUser.set(key, bucket);
    }
    bucket.items.push(reminderToDigestItem(r));
  }

  for (const bucket of byUser.values()) {
    bucket.items.sort(
      (a, b) =>
        a.daysUntil - b.daysUntil || a.deadlineDate.localeCompare(b.deadlineDate)
    );
  }

  return Array.from(byUser.values());
}
