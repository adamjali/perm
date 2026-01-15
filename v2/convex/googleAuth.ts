/**
 * Google OAuth Token Management
 *
 * Handles storing and clearing Google OAuth tokens for calendar integration.
 * Tokens are encrypted before storage using AES-256-GCM.
 *
 * This is SEPARATE from Convex Auth:
 * - Convex Auth: Handles app authentication (signing in)
 * - This module: Handles Google Calendar API tokens (calendar sync)
 */
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { encryptToken, decryptToken } from "./lib/crypto";
import { isTokenExpired } from "./lib/googleHelpers";
import { loggers } from "./lib/logging";

const log = loggers.googleAuth;
const oauthLog = loggers.googleOAuth;

/**
 * Store Google OAuth tokens after successful authorization
 *
 * Called from /api/google/callback after exchanging authorization code.
 * Encrypts tokens before storing them in the database.
 *
 * @param accessToken - Google access token
 * @param refreshToken - Google refresh token (for token refresh)
 * @param expiryTime - Access token expiry timestamp (ms)
 * @param email - Google account email
 * @param scopes - OAuth scopes granted
 */
export const storeGoogleTokens = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiryTime: v.number(),
    email: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(args.accessToken);
    const encryptedRefreshToken = await encryptToken(args.refreshToken);

    // Update profile with encrypted tokens and connection status
    await ctx.db.patch(profile._id, {
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: args.expiryTime,
      googleEmail: args.email,
      googleScopes: args.scopes,
      googleCalendarConnected: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Clear Google OAuth tokens (disconnect calendar)
 *
 * Called from /api/google/disconnect.
 * Does NOT delete events from Google Calendar - only disconnects sync.
 */
export const clearGoogleTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Clear all Google OAuth fields
    await ctx.db.patch(profile._id, {
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
      googleTokenExpiry: undefined,
      googleEmail: undefined,
      googleScopes: undefined,
      googleCalendarConnected: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get Google connection status for the current user
 *
 * Returns basic connection info (no tokens exposed).
 * Used by settings UI to show connection status.
 */
export const getGoogleConnectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    if (!profile) {
      return null;
    }

    return {
      connected: profile.googleCalendarConnected,
      email: profile.googleEmail ?? null,
      scopes: profile.googleScopes ?? [],
      // Token expiry for debugging (but not the token itself)
      tokenExpiresAt: profile.googleTokenExpiry ?? null,
    };
  },
});

/**
 * Update Google access token after refresh
 *
 * Called internally when access token is refreshed.
 * Only updates access token and expiry - refresh token stays the same.
 */
export const updateGoogleAccessToken = mutation({
  args: {
    accessToken: v.string(),
    expiryTime: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Encrypt new access token
    const encryptedAccessToken = await encryptToken(args.accessToken);

    // Update only access token and expiry
    await ctx.db.patch(profile._id, {
      googleAccessToken: encryptedAccessToken,
      googleTokenExpiry: args.expiryTime,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get decrypted Google tokens for API calls (INTERNAL ONLY)
 *
 * Used by calendar sync actions to get valid tokens.
 * Automatically handles token decryption.
 *
 * NOTE: This is an internal query - not exposed to the client.
 * Only Convex actions/mutations can call this.
 */
export const getGoogleTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile || !profile.googleCalendarConnected) {
      return null;
    }

    // Decrypt tokens
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (profile.googleAccessToken) {
      try {
        accessToken = await decryptToken(profile.googleAccessToken);
      } catch (error) {
        // Token may be unencrypted (legacy) or corrupted
        log.warn('Access token decryption failed', {
          error: error instanceof Error ? error.message : 'unknown error',
        });
        accessToken = profile.googleAccessToken;
      }
    }

    if (profile.googleRefreshToken) {
      try {
        refreshToken = await decryptToken(profile.googleRefreshToken);
      } catch (error) {
        log.warn('Refresh token decryption failed', {
          error: error instanceof Error ? error.message : 'unknown error',
        });
        refreshToken = profile.googleRefreshToken;
      }
    }

    return {
      accessToken,
      refreshToken,
      expiryTime: profile.googleTokenExpiry ?? null,
      email: profile.googleEmail ?? null,
      scopes: profile.googleScopes ?? [],
      isExpired: isTokenExpired(profile.googleTokenExpiry),
    };
  },
});

/**
 * Check if Google Calendar is connected (public query)
 *
 * Simple boolean check for UI to determine if calendar is connected.
 * Does NOT expose any token information.
 */
export const isGoogleCalendarConnected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return false;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    return profile?.googleCalendarConnected ?? false;
  },
});

/**
 * Internal mutation to store updated tokens after refresh
 *
 * Called by googleCalendarActions.refreshAccessToken after getting new tokens.
 * Updates both tokens if a new refresh token was issued, otherwise just access token.
 */
export const storeGoogleTokensInternal = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiryTime: v.number(),
    email: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(args.accessToken);
    const encryptedRefreshToken = await encryptToken(args.refreshToken);

    // Update profile with encrypted tokens and connection status
    await ctx.db.patch(profile._id, {
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: args.expiryTime,
      googleEmail: args.email,
      googleScopes: args.scopes,
      googleCalendarConnected: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to clear tokens (auto-disconnect on revoked token)
 *
 * Called by googleCalendarActions when token refresh fails due to revocation.
 */
export const clearGoogleTokensInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Clear all Google OAuth fields
    await ctx.db.patch(profile._id, {
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
      googleTokenExpiry: undefined,
      googleEmail: undefined,
      googleScopes: undefined,
      googleCalendarConnected: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// SYNC ELIGIBILITY HELPERS
// ============================================================================

/**
 * Result from shouldSyncCalendar check
 */
export interface SyncEligibilityResult {
  /** Whether calendar sync should proceed */
  shouldSync: boolean;
  /** Reason if sync should not proceed */
  reason?: string;
  /** User calendar preferences if sync should proceed */
  preferences?: {
    calendarSyncEnabled: boolean;
    calendarSyncPwd: boolean;
    calendarSyncEta9089: boolean;
    calendarSyncFilingWindow: boolean;
    calendarSyncRecruitment: boolean;
    calendarSyncI140: boolean;
    calendarSyncRfi: boolean;
    calendarSyncRfe: boolean;
  };
}

/**
 * Check if calendar sync should run for a user
 *
 * Internal query to determine if calendar sync should proceed based on:
 * 1. User profile exists
 * 2. Google Calendar is connected (OAuth tokens present)
 * 3. Calendar sync is enabled in user preferences
 *
 * This is used before scheduling sync actions to avoid unnecessary work
 * when the user hasn't connected their calendar or disabled sync.
 *
 * @param userId - The user ID to check
 * @returns SyncEligibilityResult with shouldSync flag and preferences if eligible
 */
export const shouldSyncCalendar = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<SyncEligibilityResult> => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    // Profile must exist
    if (!profile) {
      return {
        shouldSync: false,
        reason: "User profile not found",
      };
    }

    // Google Calendar must be connected (OAuth flow completed)
    if (!profile.googleCalendarConnected) {
      return {
        shouldSync: false,
        reason: "Google Calendar not connected",
      };
    }

    // User must have calendar sync enabled
    if (!profile.calendarSyncEnabled) {
      return {
        shouldSync: false,
        reason: "Calendar sync disabled by user",
      };
    }

    // Sync should proceed - return preferences for sync logic
    return {
      shouldSync: true,
      preferences: {
        calendarSyncEnabled: profile.calendarSyncEnabled,
        calendarSyncPwd: profile.calendarSyncPwd,
        calendarSyncEta9089: profile.calendarSyncEta9089,
        calendarSyncFilingWindow: profile.calendarSyncFilingWindow,
        calendarSyncRecruitment: profile.calendarSyncRecruitment,
        calendarSyncI140: profile.calendarSyncI140,
        calendarSyncRfi: profile.calendarSyncRfi,
        calendarSyncRfe: profile.calendarSyncRfe,
      },
    };
  },
});

// ============================================================================
// TOKEN REVOCATION
// ============================================================================

/**
 * Get encrypted access token for revocation (internal use only)
 *
 * Returns the encrypted token that will be decrypted in the action.
 */
export const getTokenForRevocation = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile || !profile.googleAccessToken) {
      return { hasToken: false, encryptedToken: null };
    }

    return {
      hasToken: true,
      encryptedToken: profile.googleAccessToken,
    };
  },
});

/**
 * Disconnect Google Calendar with OAuth token revocation
 *
 * This action:
 * 1. Gets the current access token
 * 2. Revokes it with Google (so user won't see app in permissions)
 * 3. Clears tokens from Convex
 *
 * Token revocation is best-effort - we still clear tokens even if revocation fails.
 */
export const disconnectWithRevocation = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; revoked: boolean; error?: string }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, revoked: false, error: "Not authenticated" };
    }

    // First element is the primary user ID (when multiple auth methods exist)
    const userId = identity.subject.split("|")[0] as Id<"users">;
    let revoked = false;

    try {
      // Get the current token
      const tokenResult = await ctx.runQuery(internal.googleAuth.getTokenForRevocation, {
        userId,
      });

      if (tokenResult.hasToken && tokenResult.encryptedToken) {
        // Decrypt the token
        const accessToken = await decryptToken(tokenResult.encryptedToken);

        // Revoke the token with Google
        // https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
        try {
          const revokeResponse = await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          if (revokeResponse.ok) {
            revoked = true;
            oauthLog.info('Token revoked successfully');
          } else {
            // Token may already be invalid/expired - that's OK
            const errorText = await revokeResponse.text();
            oauthLog.warn('Token revocation returned', { status: revokeResponse.status, error: errorText });
            // Still count as "revoked" if it's a 400 error (invalid token)
            // as that means the token is no longer valid anyway
            if (revokeResponse.status === 400) {
              revoked = true;
            }
          }
        } catch (revokeError) {
          oauthLog.error('Token revocation error', {
            error: revokeError instanceof Error ? revokeError.message : String(revokeError),
          });
          // Continue to clear tokens even if revocation fails
        }
      }

      // Clear tokens from Convex regardless of revocation result
      await ctx.runMutation(internal.googleAuth.clearGoogleTokensInternal, { userId });

      return { success: true, revoked };
    } catch (error) {
      oauthLog.error('Disconnect error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        revoked: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
