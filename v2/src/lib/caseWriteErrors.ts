/**
 * What to tell someone when a write to their case is refused for a reason the
 * server stated.
 *
 * The case form, the edit page, quick edit and document upload each showed a
 * fixed "Failed to save, try again" for every refusal (silent-limit audit,
 * Sep 29 2026). Two of those refusals have a reason worth reading:
 *   - the per-user write limit (`caseCreate` / `caseUpdate` in
 *     convex/rateLimitConfig.ts), which the rate limiter throws as
 *     `ConvexError({ kind: "RateLimited", name, retryAfter })`, where a retry
 *     straight away fails again;
 *   - a plain-text `ConvexError` (the 50-document cap, a file over 20 MB), whose
 *     text already says what happened.
 * Anything else keeps the caller's fallback.
 */
import { ConvexError } from "convex/values";

/** Milliseconds until the rate limiter lets the write through, when that's the refusal. */
export function rateLimitRetryMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object" && (data as { kind?: unknown }).kind === "RateLimited") {
    const retry = (data as { retryAfter?: unknown }).retryAfter;
    return typeof retry === "number" && retry > 0 ? retry : 0;
  }
  // A wrapped or re-thrown error can carry only the text; the JSON is in it.
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  const match = message.match(/\{[^{}]*"kind"\s*:\s*"RateLimited"[^{}]*\}/);
  if (!match) return null;
  try {
    const retry = (JSON.parse(match[0]) as { retryAfter?: unknown }).retryAfter;
    return typeof retry === "number" && retry > 0 ? retry : 0;
  } catch {
    return 0;
  }
}

export function caseWriteErrorMessage(error: unknown, fallback: string): string {
  const retryMs = rateLimitRetryMs(error);
  if (retryMs !== null) {
    const seconds = Math.max(1, Math.ceil(retryMs / 1000));
    return `Too many changes in a minute. Wait ${seconds} ${seconds === 1 ? "second" : "seconds"} and save again.`;
  }
  if (error instanceof ConvexError && typeof error.data === "string" && error.data.trim()) {
    return error.data;
  }
  return fallback;
}
