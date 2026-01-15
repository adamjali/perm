/**
 * Google OAuth utilities for Calendar integration
 *
 * This is SEPARATE from Convex Auth Google login.
 * This handles OAuth for calendar API access only.
 *
 * Authentication flow:
 * 1. User clicks "Connect Google Calendar" in settings
 * 2. /api/google/connect generates OAuth URL with state
 * 3. User authorizes on Google consent screen
 * 4. Google redirects to /api/google/callback with code
 * 5. We exchange code for tokens and store in Convex
 */

import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

/**
 * Google Calendar events scope only - no Gmail access
 * This scope allows creating, reading, and modifying calendar events
 */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/**
 * State payload structure for OAuth flow
 * Contains information needed to validate the callback
 */
export interface StatePayload {
  userId: string;
  scopes: string[];
  nonce: string;
}

/**
 * Encode state parameter for OAuth
 * Contains userId and scopes for validation in callback
 *
 * @param userId - The Convex user ID
 * @param scopes - Array of OAuth scopes being requested
 * @returns Base64url-encoded state string
 */
export function encodeState(userId: string, scopes: string[]): string {
  const payload: StatePayload = {
    userId,
    scopes,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decode and validate state parameter from callback
 *
 * @param state - Base64url-encoded state string from callback
 * @returns Decoded state payload or null if invalid
 */
export function decodeState(state: string): StatePayload | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const payload = JSON.parse(decoded) as StatePayload;

    // Validate structure has required fields
    if (!payload.userId || !payload.scopes || !payload.nonce) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create OAuth2 client with credentials from environment
 *
 * Uses GOOGLE_CALENDAR_* env vars (separate from AUTH_GOOGLE_* for Convex Auth)
 *
 * @throws Error if credentials are not configured
 * @returns Configured OAuth2Client
 */
export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured. " +
        "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables."
    );
  }

  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri,
  });
}

/**
 * Generate authorization URL for Google OAuth consent screen
 *
 * @param client - Configured OAuth2Client
 * @param state - State parameter for CSRF protection
 * @returns Full authorization URL to redirect user to
 */
export function getAuthUrl(client: OAuth2Client, state: string): string {
  return client.generateAuthUrl({
    access_type: "offline", // Request refresh token
    scope: [CALENDAR_SCOPE],
    state,
    prompt: "consent", // Always show consent to ensure refresh token
    include_granted_scopes: true,
  });
}

/**
 * Token response from Google OAuth
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiryTime: number;
  email: string;
}

/**
 * Exchange authorization code for access and refresh tokens
 *
 * @param client - Configured OAuth2Client
 * @param code - Authorization code from callback
 * @returns Token response with access token, refresh token, expiry, and email
 * @throws Error if token exchange fails or required tokens are missing
 */
export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string
): Promise<TokenResponse> {
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("No access token received from Google");
  }

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. User may need to revoke access at " +
        "https://myaccount.google.com/permissions and reconnect."
    );
  }

  // Set credentials to get user info
  client.setCredentials(tokens);

  // Try to extract email from id_token if available
  let email = "unknown";
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload?.email) {
        email = payload.email;
      }
    } catch (err) {
      // id_token verification failed, email will remain "unknown"
      // NOTE: In production, consider monitoring this - frequent failures may indicate
      // Google API changes or misconfiguration. Track via error monitoring service.
      console.warn("Failed to verify id_token:", err);
    }
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryTime: tokens.expiry_date || Date.now() + 3600 * 1000, // Default 1 hour
    email,
  };
}

/**
 * Refresh an access token using a refresh token
 *
 * @param refreshToken - Valid refresh token
 * @returns New access token and expiry time
 * @throws Error if refresh fails
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiryTime: number;
}> {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }

  return {
    accessToken: credentials.access_token,
    expiryTime: credentials.expiry_date || Date.now() + 3600 * 1000,
  };
}
