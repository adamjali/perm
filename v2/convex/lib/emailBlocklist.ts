/**
 * Email Blocklist
 *
 * Hardcoded set of email addresses that must never receive ANY email from
 * PERM Tracker — transactional, marketing, or auth. Treat this as a safety
 * switch: once an entry is here, no code path can send to that address.
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
 * Entries are hardcoded (not DB-backed) — changes require a commit + deploy
 * for review, which is the safety feature.
 *
 * @module convex/lib/emailBlocklist
 */

const BLOCKED_EMAILS = new Set<string>([
  "blocked@gmail.com",
]);

/**
 * Normalize an email address for blocklist comparison.
 * Lowercase + trim whitespace. Returns empty string for null/undefined.
 */
function normalizeEmail(email: string | undefined | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Returns true if the address is on the blocklist (case-insensitive).
 * Safe for undefined/null/empty inputs — all return false.
 */
export function isEmailBlocked(email: string | undefined | null): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && BLOCKED_EMAILS.has(normalized);
}

/**
 * Returns the list of blocked emails (for inspection, tests, admin views).
 * Copy, not the original Set.
 */
export function getBlockedEmails(): readonly string[] {
  return Array.from(BLOCKED_EMAILS);
}
