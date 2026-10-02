/**
 * What an auth form says when a sign-in, sign-up or reset is refused as "too
 * many". The server states how long to wait, and the form says so: "wait a
 * moment" would send people back within seconds to a refusal lasting an hour.
 */
import { AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY } from "@convex/lib/authMailGate";

/** Convex Auth's failed-attempt limit: 10 an hour per account, one back every 6 minutes. */
const FAILED_ATTEMPTS_TEXT =
  "Too many wrong passwords or codes for this account. Wait about 6 minutes and try again.";

export function authRateLimitText(message: string): string {
  for (const said of [AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY]) {
    if (message.includes(said)) return said;
  }
  if (/toomanyfailedattempts/i.test(message)) return FAILED_ATTEMPTS_TEXT;
  return "Too many attempts. Wait a minute and try again.";
}
