/**
 * Auth Error Detection
 *
 * Shared pattern for identifying session-expiry errors across error boundaries.
 * When matched, error boundaries redirect to /login instead of showing an error page.
 */

/** Errors that indicate session expiry, not real crashes */
export const AUTH_ERROR_PATTERN = /not authenticated|User profile not found/i;

/** Check if an error message indicates an expired session */
export function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERN.test(message);
}
