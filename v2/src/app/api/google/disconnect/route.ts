/**
 * Google Calendar OAuth - Disconnect
 *
 * POST /api/google/disconnect
 *
 * Disconnects Google Calendar integration:
 * 1. Clears ALL calendar events from Google Calendar
 * 2. Revokes OAuth token with Google (removes from user's Google permissions)
 * 3. Clears stored tokens from Convex database
 *
 * Query params:
 * - clearEvents=false: Skip clearing calendar events (just disconnect)
 *
 * Token revocation is best-effort - we still clear tokens even if
 * revocation fails (e.g., token already expired or revoked).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const isAuthenticated = await isAuthenticatedNextjs();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get auth token for Convex
    const token = await convexAuthNextjsToken();

    // Check if we should clear events (default: true)
    const { searchParams } = new URL(request.url);
    const clearEvents = searchParams.get("clearEvents") !== "false";

    let eventsCleared = {
      eventsDeleted: 0,
      casesCleaned: 0,
      errors: 0,
    };

    // Step 1: Clear all calendar events from Google Calendar (if requested)
    if (clearEvents) {
      try {
        const clearResult = await fetchAction(
          api.googleCalendarActions.clearAllEvents,
          {},
          { token }
        );

        if (clearResult.success) {
          eventsCleared = {
            eventsDeleted: clearResult.eventsDeleted,
            casesCleaned: clearResult.casesCleaned,
            errors: clearResult.errors,
          };
          console.log(
            `[Google OAuth] Cleared ${clearResult.eventsDeleted} events from ${clearResult.casesCleaned} cases`
          );
        } else {
          // Log but continue - we still want to disconnect even if event clearing fails
          console.warn(
            "[Google OAuth] Failed to clear events:",
            clearResult.error
          );
        }
      } catch (clearError) {
        // Log but continue - we still want to disconnect even if event clearing fails
        console.warn("[Google OAuth] Error clearing events:", clearError);
      }
    }

    // Step 2: Disconnect with OAuth token revocation
    const result = await fetchAction(
      api.googleAuth.disconnectWithRevocation,
      {},
      { token }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to disconnect" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      revoked: result.revoked,
      eventsCleared: clearEvents ? eventsCleared : null,
      message: result.revoked
        ? clearEvents
          ? `Google Calendar disconnected: ${eventsCleared.eventsDeleted} events removed from calendar`
          : "Google Calendar disconnected and OAuth token revoked"
        : "Google Calendar disconnected (token may have already been revoked)",
    });
  } catch (error) {
    console.error("[Google OAuth] Disconnect error:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS for CORS preflight (if needed)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
