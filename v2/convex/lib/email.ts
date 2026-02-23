/**
 * Shared email configuration and helpers.
 *
 * Centralizes Resend client creation, email constants, and retry logic
 * used across 10 of 12 email-sending paths (ResendOTP and ResendPasswordReset
 * use direct sends within the @convex-dev/auth provider framework).
 *
 * @module
 */
import { Resend } from "resend";
import { createLogger } from "./logging";

const log = createLogger("Email");

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

/** Params accepted by sendEmailWithRetry — matches Resend's send() signature. */
type SendEmailParams = Parameters<Resend["emails"]["send"]>[0];

/** Discriminated union: either success with data, or failure with error. */
export type EmailSendResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { message: string; name: string } };

/**
 * Send an email via Resend with automatic retry on transient errors.
 *
 * Retries on:
 * - Rate limit errors (HTTP 429 / "too many requests" / "rate limit")
 * - Network errors (ECONNREFUSED, ETIMEDOUT, ECONNRESET, ENOTFOUND, fetch failed)
 *
 * Non-retryable: auth failures, validation errors, programming errors.
 *
 * Uses exponential backoff with jitter:
 *   Attempt 0: immediate
 *   Attempt 1: ~1s  (1000ms + 0-500ms jitter)
 *   Attempt 2: ~2s  (2000ms + 0-500ms jitter)
 *   Attempt 3: ~4s  (4000ms + 0-500ms jitter)
 *
 * Non-retryable Resend API errors (invalid params, auth failures) are
 * returned immediately on the first attempt.
 */
export async function sendEmailWithRetry(
  resend: Resend,
  params: SendEmailParams,
  maxRetries = 3
): Promise<EmailSendResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let result;
    try {
      result = await resend.emails.send(params);
    } catch (thrown) {
      const errMsg = thrown instanceof Error ? thrown.message : String(thrown);
      const isNetworkError = /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|socket hang up/i.test(errMsg);

      if (isNetworkError && attempt < maxRetries) {
        await backoff(attempt, maxRetries, `network error: ${errMsg}`);
        continue;
      }
      return {
        error: {
          message: errMsg,
          name: thrown instanceof Error ? thrown.name : "UnknownError",
        },
      };
    }

    if (!result.error) {
      return { data: result.data! };
    }

    const msg = result.error.message.toLowerCase();
    const isRetryable = msg.includes("too many requests") || msg.includes("rate limit");
    if (!isRetryable || attempt === maxRetries) {
      return { error: { message: result.error.message, name: result.error.name } };
    }

    await backoff(attempt, maxRetries, `rate limit: ${result.error.message}`);
  }

  // Unreachable, but satisfies TypeScript
  return { error: { message: "Max retries exceeded", name: "RetryError" } };
}

/** Exponential backoff with jitter. Logs the retry reason. */
async function backoff(attempt: number, maxRetries: number, reason: string): Promise<void> {
  const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
  log.warn(`Retry ${attempt + 1}/${maxRetries} after ${reason}`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
