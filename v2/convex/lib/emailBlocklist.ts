/**
 * Email Blocklist
 *
 * Set of email addresses that must never receive ANY email from PERM Tracker,
 * whether transactional, marketing, or auth. Treat this as a safety switch:
 * once an address is on the list, no code path can send to it.
 *
 * Enforcement points:
 *   - `convex/lib/email.ts:sendEmailWithRetry` — catches all paths that use
 *     the helper (welcome, notifications, digest, admin, support replies)
 *   - `convex/ResendOTP.ts` — direct resend.emails.send (bypasses helper)
 *   - `convex/ResendPasswordReset.ts` — direct resend.emails.send (bypasses helper)
 *   - `convex/marketingEmail.ts:syncContacts` — removes from Resend contacts
 *     if somehow present, prevents re-adding
 *   - `convex/marketingEmail.ts:backfillMarketingEvents` — skips audit rows
 *
 * Lookup is case-insensitive and whitespace-trimmed to defeat trivial bypass.
 *
 * The list lives in the `BLOCKED_EMAILS` Convex environment variable as a
 * comma-separated string, NOT in this file. These are real people's addresses,
 * and this repository is public, so hardcoding them would publish the very
 * personal data the blocklist exists to protect. Entries are normalized on
 * read, so `BLOCKED_EMAILS=" Foo@Example.com , bar@example.com "` works.
 *
 * Trade-off to be aware of: the previous hardcoded list could only change via
 * a reviewed commit. An environment variable can change without review, and an
 * unset variable silently disables the switch. `assertBlocklistConfigured()`
 * exists to make that failure loud rather than silent; call it from a health
 * check or deploy verification if you want an active guard.
 *
 * @module convex/lib/emailBlocklist
 */

import { createLogger } from "./logging";

const log = createLogger("emailBlocklist");

/**
 * Normalize an email address for blocklist comparison.
 * Lowercase + trim whitespace. Returns empty string for null/undefined.
 */
function normalizeEmail(email: string | undefined | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Parse the blocklist from the environment on every call so that changing the
 * `BLOCKED_EMAILS` variable takes effect immediately, without waiting for
 * isolates to recycle. The list is a handful of entries and this runs once per
 * email send, so the parse cost is irrelevant next to the network call it
 * guards.
 */
function loadBlocklist(): ReadonlySet<string> {
  const raw = process.env.BLOCKED_EMAILS || "";
  const entries = raw
    .split(",")
    .map(normalizeEmail)
    .filter((entry) => entry.length > 0);
  return new Set(entries);
}

/**
 * Returns true if the address is on the blocklist (case-insensitive).
 * Safe for undefined/null/empty inputs — all return false.
 *
 * Note: passed directly to `Array.prototype.filter` in `lib/email.ts`, so it
 * must stay tolerant of the extra (index, array) arguments filter supplies.
 */
export function isEmailBlocked(email: string | undefined | null): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && loadBlocklist().has(normalized);
}

/**
 * Returns the list of blocked emails (for inspection, tests, admin views).
 * A copy, never the backing Set.
 */
export function getBlockedEmails(): readonly string[] {
  return Array.from(loadBlocklist());
}

/**
 * Throws when `BLOCKED_EMAILS` is unset or empty.
 *
 * The blocklist fails open by design: an empty list must not stop the app from
 * sending mail, because that would turn a config mistake into a total outage.
 * The cost of failing open is that a missing variable silently disables the
 * safety switch. Call this from a health check or post-deploy verification to
 * convert that silence into an alarm.
 */
export function assertBlocklistConfigured(): void {
  if (loadBlocklist().size === 0) {
    const message =
      "BLOCKED_EMAILS is unset or empty — the email blocklist is inert and " +
      "previously blocked recipients can now receive mail.";
    log.error(message);
    throw new Error(message);
  }
}
