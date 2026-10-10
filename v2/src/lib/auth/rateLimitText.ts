/**
 * What an auth form says when a sign-in, sign-up or reset is refused as "too
 * many". The server states how long to wait, and the form says so: "wait a
 * moment" would send people back within seconds to a refusal lasting an hour.
 */
import { AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY } from "@convex/lib/authMailGate";

/** Convex Auth's failed-attempt limit: 10 an hour per account, one back every 6 minutes. */
const FAILED_ATTEMPTS_TEXT =
  "Too many wrong passwords or codes for this account. Wait about 6 minutes and try again.";

/** How the site's server words a refusal by the per-email limit (src/lib/auth/authGate.ts). */
const EMAIL_LIMIT_PREFIX = "Too many sign-in attempts for this email address.";

export function emailLimitText(retryMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryMs / 60_000));
  return `${EMAIL_LIMIT_PREFIX} Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function authRateLimitText(message: string): string {
  // Our own refusal already says how long to wait.
  const own = message.indexOf(EMAIL_LIMIT_PREFIX);
  if (own >= 0) return message.slice(own);
  for (const said of [AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY]) {
    if (message.includes(said)) return said;
  }
  if (/toomanyfailedattempts/i.test(message)) return FAILED_ATTEMPTS_TEXT;
  return "Too many attempts. Wait a minute and try again.";
}
