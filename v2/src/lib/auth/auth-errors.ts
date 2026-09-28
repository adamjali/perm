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
// The auth proxy answered with a page instead of JSON: a firewall challenge
// ("<!DOCTYPE"), a rate-limit reply ("Too Many Requests"), or Safari's
// wording for the same parse failure. Sentry 4A, 4D, 4G.
const BLOCKED_RE = /is not valid JSON|unexpected token|unexpected end of JSON|did not match the expected pattern/i;
// Convex masks every error thrown inside a production function as
// "[Request ID: <hex>] Server Error". Convex Auth's own "Could not verify
// code" (signIn.js) arrives this way, so at a code step a masked error is a
// wrong or stale code far more often than a server fault. Sentry 2Q, 44.
const MASKED_SERVER_RE = /\[Request ID: [0-9a-f]+\] Server Error/i;

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

/**
 * True when the auth request was answered by something other than the auth
 * proxy (a challenge or rate-limit page), so the reply wasn't JSON. Check it
 * FIRST: "Too Many R..." also matches the rate-limit pattern.
 */
export function isBlockedResponseError(message: string): boolean {
  return BLOCKED_RE.test(message);
}

/** True for Convex's production mask over a thrown server error. */
export function isMaskedServerError(message: string): boolean {
  return MASKED_SERVER_RE.test(message);
}

/** What to tell the person when the auth reply wasn't JSON. */
export function blockedResponseMessage(message: string): string {
  return /too many r/i.test(message)
    ? "Too many attempts from this network. Wait a minute and try again."
    : "Our security check stopped this request. Reload the page and try again. If it keeps happening, email support@permtracker.app.";
}
