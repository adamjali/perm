/**
 * Shared email configuration and helpers.
 *
 * Centralizes Resend client creation, email constants, and retry logic. Every
 * sender goes through `sendOrQueue`: it checks the day's count
 * against Resend's quota, sends, records the count, and keeps a send that
 * failed for a fixable reason in the retry queue (convex/emailLedger.ts), so
 * no email is refused and dropped. ResendOTP and ResendPasswordReset send
 * directly inside the @convex-dev/auth providers: a sign-in code that arrives
 * late is useless, so those are counted but never queued.
 *
 * @module
 */
import { Resend } from "resend";
import { createLogger } from "./logging";
import { isEmailBlocked } from "./emailBlocklist";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  LIST_CEILING,
  RESEND_DAILY_CAP,
  isQuotaError,
  isRetryableSendError,
} from "./emailLimits";

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
export type SendEmailParams = Parameters<Resend["emails"]["send"]>[0];

/**
 * Discriminated union: either success with data, or failure with error.
 * `quota` is Resend's own count of today's sends, from the response's
 * `x-resend-daily-quota` header, when it sent one (free plan only).
 */
export type EmailSendResult =
  | { data: { id: string }; error?: undefined; quota?: number }
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
  // Fail-safe: any blocklisted recipient (to/cc/bcc) aborts the send entirely.
  // Returns an EmailBlocked error so existing callers log it naturally.
  const recipients = [
    ...toRecipientArray(params.to),
    ...toRecipientArray(params.cc),
    ...toRecipientArray(params.bcc),
  ];
  const blocked = recipients.filter(isEmailBlocked);
  if (blocked.length > 0) {
    log.warn(`Skipping send: blocklisted recipient(s) ${blocked.join(", ")}`);
    return {
      error: {
        message: `Blocklisted recipient(s): ${blocked.join(", ")}`,
        name: "EmailBlocked",
      },
    };
  }

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
      return { data: result.data!, quota: quotaHeader(result) };
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

/** Resend's `x-resend-daily-quota` header off an SDK response, when present. */
function quotaHeader(result: unknown): number | undefined {
  const headers = (result as { headers?: Record<string, string> | null }).headers;
  const raw = headers?.["x-resend-daily-quota"];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** What an action needs to send through the ledger. */
export type SendCtx = Pick<ActionCtx, "runMutation" | "runQuery">;

/** A send that went, a send that failed for good, or one kept to retry. */
export type SendOutcome =
  | EmailSendResult
  | { data?: undefined; error?: undefined; queued: true };

/**
 * Send one email through the day's count and the retry queue. Use this for
 * every send except sign-in codes.
 *
 * 1. At the day's ceiling (85 of Resend's 100 for list mail; the full 100 for
 *    `priority: "high"` admin mail), it doesn't try: the email waits for the
 *    next UTC day in the retry queue.
 * 2. A success records the send (and Resend's own count, when it gave one).
 * 3. A failure a retry can fix (Resend's limits or outages, the network, a key
 *    or domain problem) is kept and retried; the caller sees `queued: true`
 *    and no error, because the email is no longer its to lose.
 * 4. A failure no retry can fix (a blocklisted recipient, a malformed request)
 *    comes back as an error, as before.
 */
export async function sendOrQueue(
  ctx: SendCtx,
  kind: string,
  resend: Resend,
  params: SendEmailParams,
  opts: { priority?: "high" } = {},
): Promise<SendOutcome> {
  const recipients = [...toRecipientArray(params.to), ...toRecipientArray(params.cc), ...toRecipientArray(params.bcc)];
  const firstTo = recipients[0] ?? "";
  const keep = async (error: { name: string; message: string }, quota: boolean): Promise<SendOutcome | null> => {
    const r: { ok: boolean; reason?: string } = await ctx.runMutation(internal.emailLedger.enqueueRetry, {
      kind,
      to: firstTo,
      payload: JSON.stringify(params),
      error: `${error.name}: ${error.message}`,
      quota,
    });
    return r.ok ? { queued: true } : null;
  };

  if (!recipients.some(isEmailBlocked)) {
    const used: number = await ctx.runQuery(internal.emailLedger.accountUsed, {});
    const ceiling = opts.priority === "high" ? RESEND_DAILY_CAP : LIST_CEILING;
    if (used >= ceiling) {
      const kept = await keep({ name: "daily_ceiling", message: `today's count is ${used} of ${ceiling}` }, true);
      if (kept) return kept;
      return { error: { name: "daily_ceiling", message: "today's email count is full and the retry queue could not keep it" } };
    }
  }

  const result = await sendEmailWithRetry(resend, params);
  if (!result.error) {
    try {
      await ctx.runMutation(internal.emailLedger.recordSend, { quota: result.quota });
    } catch (e) {
      log.warn("sent, but the day's count was not recorded", { kind, error: e instanceof Error ? e.message : String(e) });
    }
    return result;
  }
  if (!isRetryableSendError(result.error)) return result;
  const kept = await keep(result.error, isQuotaError(result.error));
  return kept ?? result;
}

/**
 * Normalize Resend recipient field (string | string[] | undefined) to string[].
 * Used for blocklist checks across to/cc/bcc.
 */
function toRecipientArray(field: string | string[] | undefined): string[] {
  if (!field) return [];
  return Array.isArray(field) ? field : [field];
}

/** Exponential backoff with jitter. Logs the retry reason. */
async function backoff(attempt: number, maxRetries: number, reason: string): Promise<void> {
  const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
  log.warn(`Retry ${attempt + 1}/${maxRetries} after ${reason}`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
