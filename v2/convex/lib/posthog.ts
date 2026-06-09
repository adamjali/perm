/**
 * Shared PostHog helpers.
 */

/**
 * Returns true if `email` is opted out of PostHog via the POSTHOG_EXCLUDED_EMAILS
 * env var (comma-separated). Entries starting with "@" match email DOMAINS (suffix);
 * all others are exact matches. Case-insensitive.
 *
 * Single source of truth for the exclusion rule — used by both the client opt-out
 * (users.isPostHogExcluded) and the server-side capture (analytics.captureServerEvent)
 * so the two can never drift.
 */
export function isEmailPostHogExcluded(
  email: string | undefined,
  excludedCsv: string | undefined
): boolean {
  if (!email || !excludedCsv) return false;
  const lower = email.toLowerCase();
  const entries = excludedCsv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.some((entry) =>
    entry.startsWith("@") ? lower.endsWith(entry) : lower === entry
  );
}
