/**
 * Google Calendar OAuth - Callback Handler
 *
 * GET /api/google/callback?code=...&state=...
 *
 * Exchanges authorization code for tokens and stores them in Convex.
 *
 * Security measures:
 * - State parameter validation (CSRF protection)
 * - User ID verification (state must match current user)
 * - Tokens are encrypted before storage
 */
import { NextRequest, NextResponse } from "next/server";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import {
  decodeState,
  getOAuthClient,
  exchangeCodeForTokens,
  CALENDAR_SCOPE,
} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial or Google error
  if (error) {
    console.log("[Google OAuth] User denied or error:", error);
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=access_denied", request.url)
    );
  }

  // Verify required params
  if (!code || !state) {
    console.error("[Google OAuth] Missing code or state");
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=missing_params", request.url)
    );
  }

  // Get stored state from cookie
  const storedState = request.cookies.get("google_oauth_state")?.value;
  if (!storedState) {
    console.error("[Google OAuth] No stored state cookie");
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=no_state_cookie", request.url)
    );
  }

  // Verify state for CSRF protection
  if (storedState !== state) {
    console.error("[Google OAuth] State mismatch - possible CSRF attack");
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=state_mismatch", request.url)
    );
  }

  // Decode state to get userId
  const statePayload = decodeState(state);
  if (!statePayload) {
    console.error("[Google OAuth] Invalid state payload");
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=invalid_state", request.url)
    );
  }

  // Verify user is still authenticated
  const isAuthenticated = await isAuthenticatedNextjs();
  if (!isAuthenticated) {
    console.error("[Google OAuth] User not authenticated");
    return NextResponse.redirect(
      new URL("/login?redirect=/settings?tab=calendar-sync", request.url)
    );
  }

  // Get current user and verify it matches state
  const token = await convexAuthNextjsToken();
  const user = await fetchQuery(api.users.currentUser, {}, { token });

  if (!user) {
    console.error("[Google OAuth] No user found");
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=no_user", request.url)
    );
  }

  if (user._id !== statePayload.userId) {
    console.error(
      "[Google OAuth] User mismatch - state userId does not match current user"
    );
    return NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&error=user_mismatch", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const client = getOAuthClient();
    const { accessToken, refreshToken, expiryTime, email } =
      await exchangeCodeForTokens(client, code);

    // Store tokens in Convex (will be encrypted before storage)
    await fetchMutation(
      api.googleAuth.storeGoogleTokens,
      {
        accessToken,
        refreshToken,
        expiryTime,
        email,
        scopes: [CALENDAR_SCOPE],
      },
      { token }
    );

    // Clear state cookie and redirect with success
    const response = NextResponse.redirect(
      new URL("/settings?tab=calendar-sync&connected=true", request.url)
    );
    response.cookies.delete("google_oauth_state");

    return response;
  } catch (err) {
    console.error("[Google OAuth] Token exchange failed:", err);

    // Determine specific error message
    let errorCode = "token_exchange_failed";
    if (err instanceof Error) {
      if (err.message.includes("refresh token")) {
        errorCode = "no_refresh_token";
      } else if (err.message.includes("access token")) {
        errorCode = "no_access_token";
      }
    }

    return NextResponse.redirect(
      new URL(`/settings?tab=calendar-sync&error=${errorCode}`, request.url)
    );
  }
}
