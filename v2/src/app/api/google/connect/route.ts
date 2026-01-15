/**
 * Google Calendar OAuth - Initiate Connection
 *
 * GET /api/google/connect
 *
 * Redirects authenticated user to Google OAuth consent screen.
 * State parameter contains userId for validation in callback.
 *
 * This is SEPARATE from Convex Auth Google login:
 * - Convex Auth: Used for app authentication (signing in)
 * - This route: Used for calendar API access (connecting calendar)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import {
  encodeState,
  getOAuthClient,
  getAuthUrl,
  CALENDAR_SCOPE,
} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated via Convex Auth
    const isAuthenticated = await isAuthenticatedNextjs();
    console.log("[Google OAuth] isAuthenticated:", isAuthenticated);

    if (!isAuthenticated) {
      // Not authenticated - redirect to login with return URL
      console.log("[Google OAuth] Not authenticated, redirecting to login");
      const returnUrl = encodeURIComponent("/settings?tab=calendar-sync");
      return NextResponse.redirect(
        new URL(`/login?redirect=${returnUrl}`, request.url)
      );
    }

    // Get current user from Convex
    const token = await convexAuthNextjsToken();
    console.log("[Google OAuth] Got token:", token ? "yes" : "no");

    const user = await fetchQuery(api.users.currentUser, {}, { token });
    console.log("[Google OAuth] Got user:", user ? user._id : "null");

    if (!user) {
      // User authenticated but no user record - redirect to login
      return NextResponse.redirect(
        new URL("/login?error=no_user", request.url)
      );
    }

    // Create OAuth client
    const client = getOAuthClient();

    // Generate state with userId for CSRF protection and callback validation
    const state = encodeState(user._id, [CALENDAR_SCOPE]);

    // Generate authorization URL
    const authUrl = getAuthUrl(client, state);
    console.log("[Google OAuth] Redirecting to:", authUrl);

    // Create response with redirect to Google
    const response = NextResponse.redirect(authUrl);

    // Store state in httpOnly cookie for verification in callback
    // Expires in 10 minutes - enough time for user to complete OAuth
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Google OAuth] Connect error:", error);

    // Determine specific error code based on error message
    let errorCode = "oauth_init_failed";
    let errorDetails = "";

    if (error instanceof Error) {
      if (error.message.includes("credentials not configured")) {
        errorCode = "credentials_not_configured";
        errorDetails = encodeURIComponent(
          "Google Calendar OAuth credentials are not set up. Contact support."
        );
      } else if (error.message.includes("GOOGLE_CALENDAR")) {
        errorCode = "missing_env_vars";
        errorDetails = encodeURIComponent(
          "Server configuration error: Missing Google Calendar environment variables."
        );
      } else {
        errorDetails = encodeURIComponent(error.message);
      }
    }

    // Redirect back to settings with specific error
    const errorUrl = new URL("/settings", request.url);
    errorUrl.searchParams.set("tab", "calendar-sync");
    errorUrl.searchParams.set("error", errorCode);
    if (errorDetails) {
      errorUrl.searchParams.set("error_details", errorDetails);
    }

    return NextResponse.redirect(errorUrl);
  }
}
