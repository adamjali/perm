/**
 * Auth & Deployment Error Detection
 *
 * Shared patterns for identifying recoverable errors across error boundaries.
 * - Auth errors: redirect to /login
 * - Stale deployment: reload to pick up new Server Action hashes
 */

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
 * catches that race: if last activity was >15 min ago, treat the error
 * as a session timeout and redirect gracefully.
 */
export function isLikelySessionTimeout(): boolean {
  try {
    const stored = localStorage.getItem("perm-tracker-last-activity");
    if (!stored) return false;
    const elapsed = Date.now() - parseInt(stored, 10);
    // 15 minutes = inactivity timeout
    return elapsed >= 15 * 60 * 1000;
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
