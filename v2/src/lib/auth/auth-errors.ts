/**
 * Auth-flow error-string classification.
 *
 * Single source of truth for the substring-matching rules used by the login,
 * signup, and reset-password clients to decide how to handle a thrown error
 * (network blip vs rate limit vs bad OTP/code vs expired). Each predicate
 * takes the raw error message and returns a boolean.
 *
 * Convex Auth and Cloudflare surface errors as opaque strings, so substring
 * matching is the only signal available client-side. Centralizing it here
 * keeps the three auth clients from drifting apart.
 */

const NETWORK_RE = /network|offline|failed to fetch|load failed/i;
const RATE_LIMIT_RE = /toomanyfailedattempts|rate limit|too many/i;
const INVALID_CODE_RE = /invalid|incorrect|could not verify/i;
const EXPIRED_RE = /expired/i;

/** True for transient connectivity failures (retry-friendly). */
export function isNetworkError(message: string): boolean {
  return NETWORK_RE.test(message);
}

/** True when the user/IP has been rate limited. */
export function isRateLimitError(message: string): boolean {
  return RATE_LIMIT_RE.test(message);
}

/** True for a rejected OTP / reset code (wrong or unverifiable). */
export function isInvalidCodeError(message: string): boolean {
  return INVALID_CODE_RE.test(message);
}

/** True when a verification / reset code has expired. */
export function isExpiredError(message: string): boolean {
  return EXPIRED_RE.test(message);
}
