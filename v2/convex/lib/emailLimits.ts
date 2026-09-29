/**
 * The account-level email limits, and the arithmetic every sender shares.
 *
 * Resend's free plan allows 100 emails a day, sent and received together,
 * counted over a UTC calendar day that resets at midnight UTC (8 PM Eastern in
 * summer), plus 3,000 a month (resend.com/docs/api-reference/rate-limit, read
 * Sep 29 2026). That 100 is the only limit that can't be raised for free, so it
 * is guarded ONCE, here, by what was actually sent, instead of by fixed shares
 * that each had to stay small enough to add up under it.
 *
 * - List mail (confirmations, alerts, digests, reminders, reports) stops at
 *   LIST_CEILING. Past it, a send waits in the retry queue for the next UTC day.
 * - The last RESEND_DAILY_CAP - LIST_CEILING are kept for sign-in and reset
 *   codes, which lock a person out when they don't arrive.
 *
 * The day's count (`emailDays`) is fed three ways and keeps the highest: this
 * app's own count after each send, the `x-resend-daily-quota` header Resend
 * returns on each send, and Resend's own list of sent mail, read by the drain.
 *
 * Plain module (no Convex function definitions) so mutations, actions and
 * tests can all import it.
 */
import type { QueryCtx } from "../_generated/server";

/** Resend's free-plan daily limit, sent and received together. */
export const RESEND_DAILY_CAP = 100;
/** List mail stops here; the rest of the day is kept for sign-in codes. */
export const LIST_CEILING = 85;
/** Received mail counts toward the quota but isn't in Resend's list of sent mail. */
export const RECEIVED_MARGIN = 5;

/** Failed sends the retry queue holds in all. */
export const RETRY_MAX_ROWS = 1000;
/** A failed send is retried for two weeks, then counted as lost and the admin told. */
export const RETRY_EXPIRE_MS = 14 * 24 * 60 * 60 * 1000;
/** A stored email bigger than this (an inbound message with attachments) can't be kept. */
export const RETRY_MAX_PAYLOAD = 900_000;
/** Waits between retries: 5 min, 15 min, 1 h, 3 h, then every 8 h. */
export const RETRY_BACKOFF_MS = [5, 15, 60, 180, 480].map((m) => m * 60 * 1000);

/** The UTC calendar day Resend counts against, as YYYY-MM-DD. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Milliseconds until the next UTC midnight, when Resend's daily count resets. */
export function msToNextUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

interface SendError {
  name: string;
  message: string;
}

/**
 * Errors a retry can't fix: a recipient we never mail, and a malformed
 * request. Everything else (Resend's limits, its outages, the network, a key
 * or domain problem someone can fix) is kept and retried.
 */
const PERMANENT = new Set([
  "EmailBlocked",
  "validation_error",
  "missing_required_field",
  "invalid_parameter",
  "invalid_idempotency_key",
]);

export function isRetryableSendError(error: SendError): boolean {
  return !PERMANENT.has(error.name);
}

/** A daily or monthly quota refusal: retrying before the count resets is pointless. */
export function isQuotaError(error: SendError): boolean {
  return /quota/i.test(error.name) || /quota/i.test(error.message);
}

/** When to try a failed send again. */
export function nextRetryAt(attempts: number, now: number, quota: boolean): number {
  if (quota) return now + msToNextUtcDay(now) + 5 * 60 * 1000;
  const i = Math.min(Math.max(attempts, 0), RETRY_BACKOFF_MS.length - 1);
  return now + (RETRY_BACKOFF_MS[i] ?? 0);
}

/** What the account has used today, by the highest count any source reported. */
export async function usedToday(ctx: Pick<QueryCtx, "db">, now: number): Promise<number> {
  const row = await ctx.db
    .query("emailDays")
    .withIndex("by_day", (q) => q.eq("day", utcDay(now)))
    .unique();
  if (!row) return 0;
  return Math.max(row.sent, row.reported ?? 0);
}
