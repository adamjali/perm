/**
 * Google Calendar Actions
 *
 * Convex actions for Google Calendar API operations.
 * Actions can make external API calls (unlike mutations/queries).
 *
 * This module handles:
 * - Token refresh when access token expires
 * - Getting valid access tokens for calendar operations
 * - Calendar event CRUD (create, update, delete)
 *
 * Uses Google Calendar REST API v3 directly with fetch.
 * All events are created as all-day events on the user's primary calendar.
 *
 * @see https://developers.google.com/calendar/api/v3/reference/events
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { OAuth2Client } from "google-auth-library";
import {
  calculateTokenExpiry,
} from "./lib/googleHelpers";
import type { Id } from "./_generated/dataModel";
import { extractUserIdFromAction } from "./lib/auth";
import { loggers } from "./lib/logging";

const log = loggers.calendar;

/**
 * Create an OAuth2 client with the refresh token set
 *
 * Used internally to refresh access tokens.
 */
function createOAuth2Client(refreshToken: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar OAuth credentials not configured. " +
        "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET."
    );
  }

  const oauth2Client = new OAuth2Client({
    clientId,
    clientSecret,
  });

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

/**
 * Refresh the access token for a user
 *
 * Called internally when the access token is expired or about to expire.
 * Updates the stored tokens and returns the new access token.
 *
 * If refresh fails due to token revocation, auto-disconnects the user
 * and throws an error.
 *
 * @param userId - The user ID to refresh tokens for
 * @returns The new access token
 * @throws Error if no refresh token or refresh fails
 */
export const refreshAccessToken = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    // 1. Get current tokens via internal query
    const tokens = await ctx.runQuery(internal.googleAuth.getGoogleTokens, {
      userId: args.userId,
    });

    if (!tokens || !tokens.refreshToken) {
      throw new Error(
        "No refresh token available. User needs to reconnect Google Calendar."
      );
    }

    // 2. Check if token is still valid (with 5 min buffer)
    if (!tokens.isExpired && tokens.accessToken) {
      // Token is still valid, no refresh needed
      return tokens.accessToken;
    }

    // 3. Refresh the token using Google OAuth
    log.info('Refreshing access token', { resourceId: args.userId });

    try {
      const oauth2Client = createOAuth2Client(tokens.refreshToken);
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error("No access token received from refresh");
      }

      // 4. Store new tokens
      // Note: refresh_token is usually not included in refresh response,
      // but if it is, we should store the new one
      const newRefreshToken = credentials.refresh_token || tokens.refreshToken;
      const newExpiryTime = credentials.expiry_date
        ? credentials.expiry_date
        : calculateTokenExpiry(3600); // Default 1 hour

      await ctx.runMutation(internal.googleAuth.storeGoogleTokensInternal, {
        userId: args.userId,
        accessToken: credentials.access_token,
        refreshToken: newRefreshToken,
        expiryTime: newExpiryTime,
        email: tokens.email || "unknown",
        scopes: tokens.scopes || [],
      });

      log.info('Token refreshed successfully', { resourceId: args.userId });
      return credentials.access_token;
    } catch (error) {
      // Token revoked or invalid - auto-disconnect
      log.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Clear tokens to auto-disconnect
      await ctx.runMutation(internal.googleAuth.clearGoogleTokensInternal, {
        userId: args.userId,
      });

      throw new Error(
        "Token refresh failed - Google Calendar has been disconnected. " +
          "Please reconnect in Settings."
      );
    }
  },
});

/**
 * Get a valid access token for making Google Calendar API calls
 *
 * This action:
 * 1. Gets the current stored tokens
 * 2. If token is expired, refreshes it
 * 3. Returns the valid access token
 *
 * Use this before making any Google Calendar API calls.
 *
 * @param userId - The user ID to get token for
 * @returns Valid access token or null if not connected
 * @throws Error if token refresh fails
 */
export const getValidAccessToken = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string | null> => {
    // Get current tokens
    const tokens = await ctx.runQuery(internal.googleAuth.getGoogleTokens, {
      userId: args.userId,
    });

    if (!tokens) {
      // Not connected
      return null;
    }

    // Check if token is valid
    if (tokens.accessToken && !tokens.isExpired) {
      return tokens.accessToken;
    }

    // Token is expired or missing, need to refresh
    if (!tokens.refreshToken) {
      log.error('No refresh token, cannot refresh', { resourceId: args.userId });
      return null;
    }

    // Refresh the token
    const newAccessToken = await ctx.runAction(
      internal.googleCalendarActions.refreshAccessToken,
      { userId: args.userId }
    );

    return newAccessToken;
  },
});

/**
 * Check if Google Calendar is properly connected for a user
 *
 * Verifies:
 * 1. User has tokens stored
 * 2. Tokens are valid (or can be refreshed)
 *
 * Used by case mutations before attempting sync operations.
 *
 * @param userId - The user ID to check
 * @returns true if connected and tokens are valid
 */
export const isCalendarConnectedAndValid = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    try {
      const token = await ctx.runAction(
        internal.googleCalendarActions.getValidAccessToken,
        { userId: args.userId }
      );
      return token !== null;
    } catch {
      // Token refresh failed, not valid
      return false;
    }
  },
});

// ============================================================================
// CALENDAR EVENT CRUD OPERATIONS
// ============================================================================

import {
  formatCalendarEvent,
  isFutureDate,
  withExponentialBackoff,
} from "./lib/calendarHelpers";
import type {
  CalendarEventType,
  CalendarEventInput,
} from "./lib/calendarTypes";

/** Google Calendar API base URL */
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Result of a calendar event operation
 */
interface CalendarEventOperationResult {
  /** The Google Calendar event ID (empty string if failed) */
  eventId: string;
  /** The event type that was processed */
  type: CalendarEventType;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Create a single calendar event in Google Calendar
 *
 * Creates an all-day event on the user's primary calendar.
 * Skips past dates (only syncs future deadlines).
 *
 * @param userId - The user ID to create event for
 * @param event - The event data to create
 * @returns Result with event ID or error
 */
export const createCalendarEvent = internalAction({
  args: {
    userId: v.id("users"),
    event: v.object({
      eventType: v.string(),
      date: v.string(),
      caseId: v.id("cases"),
      employerName: v.string(),
      beneficiaryIdentifier: v.string(),
      caseNumber: v.optional(v.string()),
      internalCaseNumber: v.optional(v.string()),
      entryId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<CalendarEventOperationResult> => {
    const { userId, event } = args;
    const eventType = event.eventType as CalendarEventType;

    // Skip past dates - only sync future deadlines
    if (!isFutureDate(event.date)) {
      log.debug('Skipping past date', { date: event.date, eventType });
      return {
        eventId: "",
        type: eventType,
        success: false,
        error: "Past date skipped - only future deadlines are synced",
      };
    }

    try {
      // Get valid access token (refreshes if needed)
      const accessToken = await ctx.runAction(
        internal.googleCalendarActions.getValidAccessToken,
        { userId }
      );

      if (!accessToken) {
        return {
          eventId: "",
          type: eventType,
          success: false,
          error: "Not connected to Google Calendar",
        };
      }

      // Format the event for Google Calendar
      const eventInput: CalendarEventInput = {
        eventType,
        date: event.date,
        caseId: event.caseId,
        employerName: event.employerName,
        beneficiaryIdentifier: event.beneficiaryIdentifier,
        caseNumber: event.caseNumber,
        internalCaseNumber: event.internalCaseNumber,
        entryId: event.entryId,
      };
      const formattedEvent = formatCalendarEvent(eventInput);

      // Create event via Google Calendar REST API with exponential backoff
      const createdEvent = await withExponentialBackoff(async () => {
        const response = await fetch(
          `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: formattedEvent.summary,
              description: formattedEvent.description,
              start: formattedEvent.start,
              end: formattedEvent.end,
              // Disable default reminders for calendar sync events
              reminders: { useDefault: false },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          log.error('Failed to create event', {
            status: response.status,
            error: errorBody,
          });

          // Create error with status code for retry logic
          const error = new Error(`Google Calendar API error: ${response.status}`) as Error & { status?: number };
          error.status = response.status;

          // Handle specific non-retryable error codes
          if (response.status === 401) {
            // Token invalid - this shouldn't happen as we just refreshed
            throw new Error("Authentication failed - please reconnect Google Calendar");
          }

          throw error;
        }

        return await response.json();
      });
      log.info('Created event', {
        eventId: createdEvent.id,
        eventType,
        date: event.date,
      });

      return {
        eventId: createdEvent.id,
        type: eventType,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error('Failed to create event', { error: message });
      return {
        eventId: "",
        type: eventType,
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Delete a calendar event from Google Calendar
 *
 * Handles 404 errors gracefully (event already deleted).
 * This is a best-effort operation - errors are logged but don't block sync.
 *
 * @param userId - The user ID to delete event for
 * @param eventId - The Google Calendar event ID to delete
 * @returns Result indicating success or failure
 */
export const deleteCalendarEvent = internalAction({
  args: {
    userId: v.id("users"),
    eventId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string }> => {
    const { userId, eventId } = args;

    if (!eventId) {
      return { success: true }; // Nothing to delete
    }

    try {
      // Get valid access token (refreshes if needed)
      const accessToken = await ctx.runAction(
        internal.googleCalendarActions.getValidAccessToken,
        { userId }
      );

      if (!accessToken) {
        return {
          success: false,
          error: "Not connected to Google Calendar",
        };
      }

      // Delete event via Google Calendar REST API with exponential backoff
      // Note: 404 is handled as success (stale event ID, already deleted)
      try {
        await withExponentialBackoff(async () => {
          const response = await fetch(
            `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          // 204 No Content = successful delete
          if (response.status === 204) {
            log.info('Deleted event', { eventId });
            return { deleted: true };
          }

          // 404 Not Found = event already deleted (stale event ID)
          // Treat as success, don't throw - this is expected when syncing
          if (response.status === 404) {
            log.debug('Stale event ID, already deleted from Google Calendar', { eventId });
            return { deleted: true, stale: true };
          }

          // Handle other error codes
          const errorBody = await response.text();
          log.error('Failed to delete event', {
            eventId,
            status: response.status,
            error: errorBody,
          });

          // Create error with status code for retry logic
          const error = new Error(`Google Calendar API error: ${response.status}`) as Error & { status?: number };
          error.status = response.status;

          // Handle specific non-retryable error codes
          if (response.status === 401) {
            throw new Error("Authentication failed - please reconnect Google Calendar");
          }

          throw error;
        });

        return { success: true };
      } catch (error) {
        // Re-throw auth errors with proper message
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          return {
            success: false,
            error: error.message,
          };
        }
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error('Failed to delete event', { eventId, error: message });
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Update a calendar event by deleting the old one and creating a new one
 *
 * This simple delete-and-recreate approach:
 * - Is more reliable than PATCH operations
 * - Matches the v1 implementation pattern
 * - Handles date changes cleanly (event moves to new date)
 *
 * @param userId - The user ID to update event for
 * @param oldEventId - The existing event ID to delete (optional)
 * @param event - The new event data to create
 * @returns Result with new event ID or error
 */
export const updateCalendarEvent = internalAction({
  args: {
    userId: v.id("users"),
    oldEventId: v.optional(v.string()),
    event: v.object({
      eventType: v.string(),
      date: v.string(),
      caseId: v.id("cases"),
      employerName: v.string(),
      beneficiaryIdentifier: v.string(),
      caseNumber: v.optional(v.string()),
      internalCaseNumber: v.optional(v.string()),
      entryId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<CalendarEventOperationResult> => {
    const { userId, oldEventId, event } = args;

    // Delete old event if it exists
    if (oldEventId) {
      const deleteResult = await ctx.runAction(
        internal.googleCalendarActions.deleteCalendarEvent,
        { userId, eventId: oldEventId }
      );

      if (!deleteResult.success) {
        // Log but don't block - continue with creating new event
        log.warn('Failed to delete old event', {
          eventId: oldEventId,
          error: deleteResult.error,
        });
      }
    }

    // Create new event
    return await ctx.runAction(
      internal.googleCalendarActions.createCalendarEvent,
      { userId, event }
    );
  },
});

// ============================================================================
// BULK SYNC ACTION
// ============================================================================

// Note: Internal queries and mutations for calendar sync are in googleCalendarSync.ts
// This separation is required because this file uses "use node" runtime,
// and Convex only allows actions in Node.js files.

import { extractCalendarEvents } from "./lib/calendarEventExtractor";

// ============================================================================
// BULK SYNC ACTION
// ============================================================================

/**
 * Map CalendarEventType to schema field names
 *
 * The schema uses slightly different field names than CalendarEventType.
 * This maps the event type to the schema field.
 */
const EVENT_TYPE_TO_SCHEMA_FIELD: Record<CalendarEventType, string> = {
  pwd_expiration: "pwd_expiration",
  eta9089_filing: "eta9089_filing_window", // Reuses filing window field
  eta9089_expiration: "eta9089_expiration",
  filing_window_opens: "eta9089_filing_window",
  recruitment_expires: "recruitment_end",
  i140_deadline: "i140_filing_deadline",
  rfi_due: "rfi_due",
  rfe_due: "rfe_due",
};

/**
 * Sync result for a single case
 */
interface SyncCaseResult {
  caseId: Id<"cases">;
  success: boolean;
  eventsCreated: number;
  eventsDeleted: number;
  error?: string;
}

/**
 * Delete all calendar events for a case
 *
 * This action is called when:
 * - A case is soft-deleted (remove mutation)
 * - Calendar sync is disabled for a case
 *
 * It deletes all existing calendar events from Google Calendar
 * and clears the calendarEventIds on the case.
 *
 * @param userId - The user ID for calendar API access
 * @param caseId - The case to delete events for
 * @returns Result with count of deleted events
 */
export const deleteCaseCalendarEvents = internalAction({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    eventsDeleted: number;
    error?: string;
  }> => {
    const { userId, caseId } = args;

    try {
      // 1. Get existing event IDs for this case
      const existingEventIds = await ctx.runQuery(
        internal.googleCalendarSync.getCaseCalendarEventIds,
        { caseId }
      );

      if (!existingEventIds) {
        // No events to delete
        return {
          success: true,
          eventsDeleted: 0,
        };
      }

      // 2. Delete each event from Google Calendar
      let eventsDeleted = 0;
      const eventIdEntries = Object.entries(existingEventIds).filter(
        ([_, eventId]) => eventId
      );

      for (const [_, eventId] of eventIdEntries) {
        if (eventId) {
          const deleteResult = await ctx.runAction(
            internal.googleCalendarActions.deleteCalendarEvent,
            { userId, eventId }
          );
          if (deleteResult.success) {
            eventsDeleted++;
          }
        }
      }

      // 3. Clear event IDs on the case
      await ctx.runMutation(
        internal.googleCalendarSync.clearCaseCalendarEventIds,
        { caseId }
      );

      log.info('Deleted events for case', { resourceId: caseId, eventsDeleted });

      return {
        success: true,
        eventsDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error('Failed to delete events for case', { resourceId: caseId, error: message });
      return {
        success: false,
        eventsDeleted: 0,
        error: message,
      };
    }
  },
});

/**
 * Bulk delete calendar events by type across all user's cases.
 *
 * This action is called when a calendar sync preference is toggled OFF.
 * It deletes all events of the specified type(s) from Google Calendar
 * and clears the corresponding event IDs from all user's cases.
 *
 * @param userId - The user ID for calendar API access
 * @param eventSchemaFields - Array of schema field names (e.g., ["pwd_expiration", "rfi_due"])
 * @returns Result with count of events deleted
 */
export const bulkDeleteEventsByType = internalAction({
  args: {
    userId: v.id("users"),
    eventSchemaFields: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    eventsDeleted: number;
    casesProcessed: number;
    error?: string;
  }> => {
    const { userId, eventSchemaFields } = args;

    if (eventSchemaFields.length === 0) {
      return {
        success: true,
        eventsDeleted: 0,
        casesProcessed: 0,
      };
    }

    try {
      // 1. Get all cases for this user that have calendar events
      const cases = await ctx.runQuery(
        internal.googleCalendarSync.getCasesWithCalendarEvents,
        { userId }
      );

      if (!cases || cases.length === 0) {
        return {
          success: true,
          eventsDeleted: 0,
          casesProcessed: 0,
        };
      }

      let eventsDeleted = 0;
      let casesProcessed = 0;

      // 2. Process each case
      for (const caseDoc of cases) {
        const eventIds = caseDoc.calendarEventIds;
        if (!eventIds) continue;

        const eventsToDelete: Array<{ field: string; eventId: string }> = [];
        const updatedEventIds: Record<string, string | undefined> = { ...eventIds };

        // Find events that match the schema fields to delete
        for (const field of eventSchemaFields) {
          const eventId = eventIds[field as keyof typeof eventIds];
          if (eventId) {
            eventsToDelete.push({ field, eventId });
            updatedEventIds[field] = undefined;
          }
        }

        if (eventsToDelete.length === 0) continue;

        // 3. Delete each event from Google Calendar
        for (const { eventId } of eventsToDelete) {
          const deleteResult = await ctx.runAction(
            internal.googleCalendarActions.deleteCalendarEvent,
            { userId, eventId }
          );
          if (deleteResult.success) {
            eventsDeleted++;
          }
        }

        // 4. Update the case to clear the deleted event IDs
        await ctx.runMutation(
          internal.googleCalendarSync.updateCaseCalendarEventIds,
          {
            caseId: caseDoc._id,
            calendarEventIds: {
              pwd_expiration: updatedEventIds.pwd_expiration,
              eta9089_filing_window: updatedEventIds.eta9089_filing_window,
              eta9089_expiration: updatedEventIds.eta9089_expiration,
              i140_filing_deadline: updatedEventIds.i140_filing_deadline,
              rfi_due: updatedEventIds.rfi_due,
              rfe_due: updatedEventIds.rfe_due,
              recruitment_end: updatedEventIds.recruitment_end,
            },
          }
        );

        casesProcessed++;

        // Rate limit protection: Small delay between cases
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      log.info('Bulk deleted events by type', {
        userId,
        eventSchemaFields,
        eventsDeleted,
        casesProcessed,
      });

      return {
        success: true,
        eventsDeleted,
        casesProcessed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error('Failed to bulk delete events by type', {
        userId,
        eventSchemaFields,
        error: message,
      });
      return {
        success: false,
        eventsDeleted: 0,
        casesProcessed: 0,
        error: message,
      };
    }
  },
});

/**
 * Sync all calendar events for a case
 *
 * This action:
 * 1. Gets case data via internal query
 * 2. Gets user calendar preferences from userProfiles
 * 3. Deletes existing calendar events for this case
 * 4. Extracts new events based on preferences
 * 5. Creates new events and collects IDs
 * 6. Updates case with new calendarEventIds via internal mutation
 *
 * @param userId - The user ID for calendar API access
 * @param caseId - The case to sync
 * @returns Sync result with counts
 */
export const syncCaseCalendarEvents = internalAction({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<SyncCaseResult> => {
    const { userId, caseId } = args;

    try {
      // 1. Get case data (from googleCalendarSync module)
      const caseData = await ctx.runQuery(
        internal.googleCalendarSync.getCaseForCalendarSync,
        { caseId }
      );

      if (!caseData) {
        return {
          caseId,
          success: false,
          eventsCreated: 0,
          eventsDeleted: 0,
          error: "Case not found or deleted",
        };
      }

      // 2. Get user preferences (from googleCalendarSync module)
      const preferences = await ctx.runQuery(
        internal.googleCalendarSync.getUserCalendarPreferences,
        { userId }
      );

      // 3. Get existing event IDs for deletion (from googleCalendarSync module)
      const existingEventIds = await ctx.runQuery(
        internal.googleCalendarSync.getCaseCalendarEventIds,
        { caseId }
      );

      // 4. Delete existing events
      let eventsDeleted = 0;
      if (existingEventIds) {
        const eventIdEntries = Object.entries(existingEventIds).filter(
          ([_, eventId]) => eventId
        );

        for (const [_, eventId] of eventIdEntries) {
          if (eventId) {
            const deleteResult = await ctx.runAction(
              internal.googleCalendarActions.deleteCalendarEvent,
              { userId, eventId }
            );
            if (deleteResult.success) {
              eventsDeleted++;
            }
          }
        }
      }

      // 5. Extract events based on preferences
      const extractionResult = extractCalendarEvents(caseData, preferences);

      // 6. Create new events and collect IDs
      const newEventIds: Record<string, string | undefined> = {};
      let eventsCreated = 0;

      for (const event of extractionResult.events) {
        const createResult = await ctx.runAction(
          internal.googleCalendarActions.createCalendarEvent,
          {
            userId,
            event: {
              eventType: event.eventType,
              date: event.date,
              caseId: event.caseId,
              employerName: event.employerName,
              beneficiaryIdentifier: event.beneficiaryIdentifier,
              caseNumber: event.caseNumber,
              internalCaseNumber: event.internalCaseNumber,
              entryId: event.entryId,
            },
          }
        );

        if (createResult.success && createResult.eventId) {
          // Map event type to schema field
          const schemaField = EVENT_TYPE_TO_SCHEMA_FIELD[event.eventType];
          newEventIds[schemaField] = createResult.eventId;
          eventsCreated++;
        }
      }

      // 7. Update case with new event IDs
      await ctx.runMutation(
        internal.googleCalendarSync.updateCaseCalendarEventIds,
        {
          caseId,
          calendarEventIds: {
            pwd_expiration: newEventIds["pwd_expiration"],
            eta9089_filing_window: newEventIds["eta9089_filing_window"],
            eta9089_expiration: newEventIds["eta9089_expiration"],
            i140_filing_deadline: newEventIds["i140_filing_deadline"],
            rfi_due: newEventIds["rfi_due"],
            rfe_due: newEventIds["rfe_due"],
            recruitment_end: newEventIds["recruitment_end"],
          },
        }
      );

      log.info('Synced case', { resourceId: caseId, eventsDeleted, eventsCreated });

      return {
        caseId,
        success: true,
        eventsCreated,
        eventsDeleted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error('Failed to sync case', { resourceId: caseId, error: message });
      return {
        caseId,
        success: false,
        eventsCreated: 0,
        eventsDeleted: 0,
        error: message,
      };
    }
  },
});

// ============================================================================
// PUBLIC BULK SYNC ACTION
// ============================================================================

/**
 * Result from syncAllCases action
 */
interface SyncAllCasesResult {
  /** Whether the overall operation succeeded */
  success: boolean;
  /** Total number of cases processed */
  total: number;
  /** Number of cases successfully synced */
  synced: number;
  /** Number of cases that failed to sync */
  failed: number;
  /** Error message if operation completely failed */
  error?: string;
}

/**
 * Sync all cases to Google Calendar
 *
 * This is a public action (callable from frontend) that:
 * 1. Gets the authenticated user from context
 * 2. Checks if Google Calendar is connected
 * 3. Gets all user's cases with sync enabled
 * 4. Syncs each case sequentially
 * 5. Returns progress stats
 *
 * Used by the "Sync All" button in Calendar Settings.
 */
/**
 * Clear all calendar events for a user
 *
 * This internal action is called during Google Calendar disconnect flow.
 * It removes ALL calendar events for the user from Google Calendar
 * and clears the calendarEventIds from all their cases.
 *
 * Handles:
 * - Token expiration (attempts refresh first)
 * - Already-deleted events (404 from Google → success)
 * - Rate limiting (100ms delay between delete calls)
 *
 * @param userId - The user ID to clear events for
 * @returns Stats on events deleted, cases cleaned, and errors encountered
 */
export const clearAllCalendarEvents = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    eventsDeleted: number;
    casesCleaned: number;
    errors: number;
    error?: string;
  }> => {
    const { userId } = args;

    try {
      // 1. Get valid access token (will refresh if expired)
      const accessToken = await ctx.runAction(
        internal.googleCalendarActions.getValidAccessToken,
        { userId }
      );

      if (!accessToken) {
        log.warn("clearAllCalendarEvents: No valid access token", { resourceId: userId });
        // Still proceed to clear calendarEventIds from cases even if we can't delete from Google
        // This handles the case where token is revoked but we still want to clean up local state
      }

      // 2. Get all cases with calendar events for this user
      const cases = await ctx.runQuery(
        internal.googleCalendarSync.getCasesWithCalendarEvents,
        { userId }
      );

      if (!cases || cases.length === 0) {
        log.info("clearAllCalendarEvents: No cases with calendar events", { resourceId: userId });
        return {
          success: true,
          eventsDeleted: 0,
          casesCleaned: 0,
          errors: 0,
        };
      }

      let eventsDeleted = 0;
      let casesCleaned = 0;
      let errors = 0;

      // 3. Process each case
      for (const caseDoc of cases) {
        const eventIds = caseDoc.calendarEventIds;
        if (!eventIds) continue;

        // Get all non-empty event IDs from the case
        const eventIdEntries = Object.entries(eventIds).filter(
          ([_, eventId]) => eventId
        );

        // 4. Delete each event from Google Calendar
        for (const [field, eventId] of eventIdEntries) {
          if (!eventId) continue;

          // Only attempt delete if we have a valid access token
          if (accessToken) {
            try {
              const deleteResult = await ctx.runAction(
                internal.googleCalendarActions.deleteCalendarEvent,
                { userId, eventId }
              );

              if (deleteResult.success) {
                eventsDeleted++;
              } else {
                // Log but continue - don't fail the whole operation
                log.warn("clearAllCalendarEvents: Failed to delete event", {
                  resourceId: caseDoc._id,
                  field,
                  eventId,
                  error: deleteResult.error,
                });
                errors++;
              }
            } catch (error) {
              log.error("clearAllCalendarEvents: Error deleting event", {
                resourceId: caseDoc._id,
                field,
                eventId,
                error: error instanceof Error ? error.message : String(error),
              });
              errors++;
            }

            // Rate limiting: 100ms delay between delete calls
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // 5. Clear calendarEventIds on the case (always do this, even if Google deletes failed)
        await ctx.runMutation(
          internal.googleCalendarSync.clearCaseCalendarEventIds,
          { caseId: caseDoc._id }
        );
        casesCleaned++;

        // Additional rate limit protection between cases
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      log.info("clearAllCalendarEvents: Completed", {
        resourceId: userId,
        eventsDeleted,
        casesCleaned,
        errors,
      });

      return {
        success: true,
        eventsDeleted,
        casesCleaned,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("clearAllCalendarEvents: Failed", {
        resourceId: userId,
        error: message,
      });
      return {
        success: false,
        eventsDeleted: 0,
        casesCleaned: 0,
        errors: 1,
        error: message,
      };
    }
  },
});

/**
 * Clear all calendar events (public action)
 *
 * This is a public action callable from the frontend that:
 * 1. Gets the authenticated user
 * 2. Deletes ALL calendar events from Google Calendar
 * 3. Clears calendarEventIds from all user's cases
 *
 * Used by:
 * - "Clear All Calendar Events" button in Calendar Settings
 * - Called before disconnect to clean up calendar events
 */
export const clearAllEvents = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    eventsDeleted: number;
    casesCleaned: number;
    errors: number;
    error?: string;
  }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        eventsDeleted: 0,
        casesCleaned: 0,
        errors: 0,
        error: "Not authenticated",
      };
    }

    const userId = extractUserIdFromAction(identity.subject);

    // Check if Google Calendar is connected
    const tokens = await ctx.runQuery(internal.googleAuth.getGoogleTokens, {
      userId,
    });

    if (!tokens) {
      return {
        success: false,
        eventsDeleted: 0,
        casesCleaned: 0,
        errors: 0,
        error: "Google Calendar not connected",
      };
    }

    // Call the internal action to do the actual work
    const result = await ctx.runAction(
      internal.googleCalendarActions.clearAllCalendarEvents,
      { userId }
    );

    return result;
  },
});

export const syncAllCases = action({
  args: {},
  handler: async (ctx): Promise<SyncAllCasesResult> => {
    // 1. Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        error: "Not authenticated",
      };
    }

    const userId = extractUserIdFromAction(identity.subject);

    // 2. Check if Google Calendar is connected
    const eligibility = await ctx.runQuery(
      internal.googleAuth.shouldSyncCalendar,
      { userId }
    );

    if (!eligibility.shouldSync) {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        error: eligibility.reason || "Calendar sync is not enabled",
      };
    }

    // 3. Get all cases for this user
    const cases = await ctx.runQuery(internal.cases.listForSync, {
      userId,
    });

    // Filter to only cases with sync enabled (calendarSyncEnabled !== false)
    const casesToSync = cases.filter((c) => c.calendarSyncEnabled !== false);

    if (casesToSync.length === 0) {
      return {
        success: true,
        total: 0,
        synced: 0,
        failed: 0,
      };
    }

    // 4. Sync each case
    let synced = 0;
    let failed = 0;

    for (const caseItem of casesToSync) {
      try {
        const result = await ctx.runAction(
          internal.googleCalendarActions.syncCaseCalendarEvents,
          {
            userId,
            caseId: caseItem._id,
          }
        );

        if (result.success) {
          synced++;
        } else {
          failed++;
          log.warn('Failed to sync case', {
            resourceId: caseItem._id,
            error: result.error,
          });
        }
      } catch (error) {
        failed++;
        log.error('Error syncing case', {
          resourceId: caseItem._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Rate limit protection: Add small delay between case syncs
      // to avoid hitting Google Calendar API rate limits (429 errors)
      // 100ms delay allows ~10 cases/second, well under Google's limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    log.info('Bulk sync complete', {
      synced,
      total: casesToSync.length,
      failed,
    });

    return {
      success: true,
      total: casesToSync.length,
      synced,
      failed,
    };
  },
});
