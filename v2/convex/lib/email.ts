/**
 * Shared email configuration and helpers.
 *
 * Centralizes Resend client creation and email constants
 * used by notificationActions.ts and admin.ts.
 */
import { Resend } from "resend";

/** From email address for all PERM Tracker notifications */
export const FROM_EMAIL = "PERM Tracker <notifications@permtracker.app>";

/**
 * Create a Resend client for sending emails.
 *
 * @throws {Error} If AUTH_RESEND_KEY is not configured
 */
export function getResend(): Resend {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) {
    throw new Error("AUTH_RESEND_KEY environment variable is not configured");
  }
  return new Resend(key);
}
