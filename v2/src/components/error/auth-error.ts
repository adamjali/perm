/**
 * Auth & Deployment Error Detection
 *
 * Shared patterns for identifying recoverable errors across error boundaries.
 * - Auth errors: redirect to /login
 * - Stale deployment: reload to pick up new Server Action hashes
 */

import { TIMEOUT_CONFIG } from "@/hooks/useInactivityTimeout";

/** Errors that indicate session expiry, not real crashes */
export const AUTH_ERROR_PATTERN = /not authenticated|User profile not found|Unauthenticated|could not verify identity/i;

/** Check if an error message indicates an expired session */
export function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERN.test(message);
}

/**
 * Check if user has been inactive long enough that an error is likely
 * caused by session expiry rather than a real crash.
 *
 * When a laptop sleeps, JS timers freeze. On wake, Convex reconnects and
 * queries may throw before the inactivity timeout handler runs. This
 * catches that race: if last activity was at least the idle sign-out's time
 * ago (TIMEOUT_CONFIG.INACTIVITY_TIMEOUT), treat the error as a session
 * timeout and redirect gracefully. Read from the hook so the two can't
 * disagree: a copy of the old 15 minutes sent people to the sign-in page for
 * errors 15 to 30 minutes into an idle session that was still signed in.
 */
export function isLikelySessionTimeout(): boolean {
  try {
    const stored = localStorage.getItem("perm-tracker-last-activity");
    if (!stored) return false;
    const elapsed = Date.now() - parseInt(stored, 10);
    return elapsed >= TIMEOUT_CONFIG.INACTIVITY_TIMEOUT;
  } catch {
    return false;
  }
}

/** Check if an error is from a stale deployment (Server Action hash mismatch) */
export function isStaleDeploymentError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    msg.includes("Server Action") &&
    msg.includes("was not found on the server")
  );
}

/** Handle stale deployment by reloading. Returns true if handled. */
export function handleStaleDeployment(error: unknown): boolean {
  if (isStaleDeploymentError(error)) {
    window.location.reload();
    return true;
  }
  return false;
}
