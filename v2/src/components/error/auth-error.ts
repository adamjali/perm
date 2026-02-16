/**
 * Auth & Deployment Error Detection
 *
 * Shared patterns for identifying recoverable errors across error boundaries.
 * - Auth errors: redirect to /login
 * - Stale deployment: reload to pick up new Server Action hashes
 */

/** Errors that indicate session expiry, not real crashes */
export const AUTH_ERROR_PATTERN = /not authenticated|User profile not found/i;

/** Check if an error message indicates an expired session */
export function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERN.test(message);
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
