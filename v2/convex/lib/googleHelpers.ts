/**
 * Google OAuth Helper Utilities
 *
 * Shared utilities for Google Calendar token management.
 * Used by googleAuth.ts and googleCalendarActions.ts
 */

/**
 * Time buffer (in milliseconds) before token expiry to trigger refresh
 * 5 minutes = 300,000 ms
 *
 * This ensures we don't make API calls with a token that's about to expire
 */
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Check if a token is expired or about to expire
 *
 * Uses a 5-minute buffer to prevent mid-request token expiry.
 *
 * @param expiryTime - Token expiry timestamp in milliseconds
 * @returns true if token is expired or will expire within 5 minutes
 */
export function isTokenExpired(expiryTime: number | undefined): boolean {
  if (expiryTime === undefined) {
    return true;
  }
  return Date.now() >= expiryTime - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Calculate token expiry timestamp from Google's expires_in value
 *
 * Google returns expires_in as seconds until expiry.
 * We convert to absolute timestamp in milliseconds.
 *
 * @param expiresIn - Seconds until token expires (typically 3600)
 * @returns Expiry timestamp in milliseconds
 */
export function calculateTokenExpiry(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

/**
 * Google Calendar scopes we request
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
] as const;

/**
 * Check if the granted scopes include all required calendar scopes
 *
 * @param grantedScopes - Scopes returned from Google OAuth
 * @returns true if all required scopes were granted
 */
export function hasRequiredScopes(grantedScopes: string[]): boolean {
  return GOOGLE_CALENDAR_SCOPES.every((scope) => grantedScopes.includes(scope));
}
