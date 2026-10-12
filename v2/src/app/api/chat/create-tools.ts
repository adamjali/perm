/**
 * Chat Tool Factory
 *
 * Creates the tool registry for the AI chat streaming endpoint.
 * Each tool has a description, input schema, and execute function.
 *
 * Tools are organized by permission tier:
 * - AUTONOMOUS: Read-only/navigation, no confirmation needed
 * - CONFIRM: Modifies data, requires confirmation in confirm mode
 * - DESTRUCTIVE: Always requires confirmation, even in auto mode
 */

import { z } from 'zod';
import { type Tool, type ModelMessage } from 'ai';
import { fetchQuery, fetchAction, fetchMutation } from 'convex/nextjs';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  QueryCasesInputSchema,
  SearchKnowledgeInputSchema,
  SearchWebInputSchema,
  NavigateInputSchema,
  ViewCaseInputSchema,
  ScrollToInputSchema,
  RefreshPageInputSchema,
  CreateCaseInputSchema,
  UpdateCaseInputSchema,
  ArchiveCaseInputSchema,
  ReopenCaseInputSchema,
  DeleteCaseInputSchema,
  SyncToCalendarInputSchema,
  UnsyncFromCalendarInputSchema,
  MarkNotificationReadInputSchema,
  MarkAllNotificationsReadInputSchema,
  DeleteNotificationInputSchema,
  ClearAllNotificationsInputSchema,
  UpdateSettingsInputSchema,
  GetSettingsInputSchema,
  BulkUpdateStatusInputSchema,
  BulkArchiveCasesInputSchema,
  BulkDeleteCasesInputSchema,
  BulkCalendarSyncInputSchema,
  ListJobDescriptionTemplatesInputSchema,
  CreateJobDescriptionTemplateInputSchema,
  UpdateJobDescriptionTemplateInputSchema,
  DeleteJobDescriptionTemplateInputSchema,
  type QueryCasesInput,
  type SearchKnowledgeInput,
  type SearchWebInput,
  type NavigateInput,
  type ViewCaseInput,
  type ScrollToInput,
  type RefreshPageInput,
  type GetSettingsInput,
  type ListJobDescriptionTemplatesInput,
  createCaseTool,
  updateCaseTool,
  archiveCaseTool,
  reopenCaseTool,
  deleteCaseTool,
} from '@/lib/ai/tools';
import type { ActionMode } from '@/lib/ai/tool-permissions';
import { executeWithCache, createCacheStats, type CacheableToolName } from '@/lib/ai/cache';
import { captureError } from '@/lib/sentry';
import { annotateCaseQuery, rateLimitedToolResult, webSearchUnavailableResult } from '@/lib/ai/limits';
import {
  buildConfirmationResponse,
  buildToolError,
  checkToolAllowed,
  validateConvexId,
} from '@/lib/ai/tool-helpers';
import { requiresConfirmation } from '@/lib/ai/tool-permissions';
import { hashAction, prepareAction, runAction, type ActionTool, type Prepared } from '@/lib/ai/caseActions';

// =============================================================================
// TYPES & UTILITIES
// =============================================================================

/** Tool execution options provided by AI SDK */
export interface ToolExecutionOptions {
  toolCallId: string;
  messages?: ModelMessage[];
  abortSignal?: AbortSignal;
}

const LOG_PREVIEW_LENGTH = 500;
const VERBOSE_LOGGING = process.env.CHAT_LOG_VERBOSE === 'true';

/**
 * Chat debug logging, OFF in production unless CHAT_LOG_VERBOSE is set.
 *
 * These traces carry a signed-in user's own case data — employer, job title,
 * wage, SOC, filing dates — through the tool params and results. Left on by
 * default they land, unredacted, in the server and Convex logs, which are
 * retained. `truncateForLog` caps length, it does not drop fields, so the gate
 * is what keeps that data out of prod logs. Verbose stays available for
 * on-demand debugging by flipping one env var.
 */
export const chatDebug: (...args: unknown[]) => void = VERBOSE_LOGGING
  ? (...args) => console.log(...args)
  : () => {};

/** Truncate data for logging (unless verbose mode enabled) */
export function truncateForLog(data: unknown, maxLength: number = LOG_PREVIEW_LENGTH): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 0);
  if (VERBOSE_LOGGING || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + `... [+${str.length - maxLength} chars]`;
}

/**
 * Recursively sanitize BigInt values to numbers/strings for JSON serialization.
 * Convex returns BigInt for some internal values (_creationTime, etc.)
 */
function sanitizeBigInts<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') {
    return (Number.isSafeInteger(Number(data)) ? Number(data) : data.toString()) as T;
  }
  if (Array.isArray(data)) return data.map(sanitizeBigInts) as T;
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeBigInts(value);
    }
    return result as T;
  }
  return data;
}

// =============================================================================
// TOOL DESCRIPTIONS (shorter route-specific versions)
// =============================================================================

const QUERY_CASES_DESCRIPTION = `Query the user's PERM cases with flexible filters and field projection.
Use for: listing/counting cases, finding by employer/beneficiary/status, deadline inquiries, RFI/RFE tracking, professional occupation cases.
Parameters: caseStatus, progressStatus, hasRfi/hasRfe, hasOverdueDeadline, deadlineWithinDays, searchText, isProfessionalOccupation, countOnly, limit.`;

const SEARCH_KNOWLEDGE_DESCRIPTION = `Search the PERM knowledge base for regulatory information, deadlines, and procedures.
Use for: PERM regulation questions, deadline rules, process questions, CFR lookups.
Parameter: query (natural language question).`;

const SEARCH_WEB_DESCRIPTION = `Search the web for current PERM information, processing times, news, and updates.
Use for: current processing times, recent DOL/USCIS announcements, trends not in knowledge base.
Parameter: query (search query, include "PERM" for relevance).`;

const NAVIGATE_DESCRIPTION = `Navigate to a specific page in the PERM Tracker application.
Use for: going to dashboard, cases list, calendar, settings, or creating a new case.
Parameters: path (required), reason (optional).`;

const VIEW_CASE_DESCRIPTION = `Navigate to view a specific PERM case's detail page.
Use for: showing case details after finding a case via queryCases, editing a case.
Parameters: caseId (required), section (optional: overview, edit).`;

const SCROLL_TO_DESCRIPTION = `Scroll to a specific section on the current page.
Use for: highlighting deadlines section, jumping to form sections, navigating within long pages.
Parameters: target (required: top, bottom, deadlines, recent-activity, form-section, timeline), smooth (optional).`;

const REFRESH_PAGE_DESCRIPTION = `Refresh the current page to get the latest data.
Use for: refreshing after changes, when user reports stale data, after external updates.
Parameters: reason (optional).`;

const SYNC_TO_CALENDAR_DESCRIPTION = `Enable Google Calendar sync for a PERM case.
Use for: syncing case deadlines to calendar, adding case to user's calendar.
Parameters: caseId (required).`;

const UNSYNC_FROM_CALENDAR_DESCRIPTION = `Disable Google Calendar sync for a PERM case.
Use for: removing case from calendar, stopping deadline sync.
Parameters: caseId (required).`;

const MARK_NOTIFICATION_READ_DESCRIPTION = `Mark a single notification as read.
Use for: dismissing specific notification, acknowledging alerts.
Parameters: notificationId (required).`;

const MARK_ALL_NOTIFICATIONS_READ_DESCRIPTION = `Mark ALL notifications as read. Batch operation.
Use for: clearing all unread notifications at once.
Parameters: none.`;

const DELETE_NOTIFICATION_DESCRIPTION = `Delete a single notification permanently.
Use for: removing specific notification from history.
Parameters: notificationId (required).`;

const CLEAR_ALL_NOTIFICATIONS_DESCRIPTION = `Delete every read notification for good (unread ones stay). Always shows a card.
Use for: cleaning up notification history, clearing old notifications.
Parameters: none.`;

const UPDATE_SETTINGS_DESCRIPTION = `Update user settings and preferences.
Use for: changing notification settings, calendar settings, UI preferences.
Parameters: settings object with fields to change.`;

const GET_SETTINGS_DESCRIPTION = `Get current user settings and preferences.
Use for: checking current settings before suggesting changes.
Parameters: category (optional: all, notifications, calendar, preferences).`;

const BULK_UPDATE_STATUS_DESCRIPTION = `Change the stage of several cases at once. Always shows a card.
"closed" closes them; any other stage reopens closed cases at the stage their dates support, and sets it by hand on open ones.
Pass caseIds (for "the selected cases", selectedCaseIds from getPageContext). all: true only when the person means every case.`;

const BULK_ARCHIVE_CASES_DESCRIPTION = `Close (archive) several cases at once. Always shows a card. Nothing is deleted; each can be reopened.
Pass caseIds (for "the selected cases", selectedCaseIds from getPageContext). all: true only when the person means every case.`;

const BULK_DELETE_CASES_DESCRIPTION = `Delete several cases for good. Can't be undone; always shows a card. Only when the person explicitly asks to delete; otherwise close them (bulkArchiveCases).
Pass caseIds (for "the selected cases", selectedCaseIds from getPageContext). all: true only when the person means every case.`;

const BULK_CALENDAR_SYNC_DESCRIPTION = `Turn Google Calendar sync on or off for several cases. Always shows a card.
Pass caseIds (for "the selected cases", selectedCaseIds from getPageContext). all: true only when the person means every case.`;

const LIST_JOB_DESC_TEMPLATES_DESCRIPTION = `List the user's job description templates.
Use for: showing templates, finding template by name, suggesting templates.
Parameters: searchQuery (optional, filter by name).`;

const CREATE_JOB_DESC_TEMPLATE_DESCRIPTION = `Create a new job description template.
Use for: saving a job description for reuse, creating template from position title.
Parameters: name (position title), description (job description text).`;

const UPDATE_JOB_DESC_TEMPLATE_DESCRIPTION = `Update an existing job description template.
Use for: modifying template name or description.
Parameters: templateId, name (optional), description (optional).`;

const DELETE_JOB_DESC_TEMPLATE_DESCRIPTION = `Delete a job description template. Cases that used it keep their job description.
Parameters: templateId.`;

// =============================================================================
// PAGE CONTEXT TYPE
// =============================================================================

export interface PageContext {
  path?: string;
  pageType?: string;
  currentCaseId?: string;
  visibleCaseIds?: string[];
  filters?: Record<string, unknown>;
  pagination?: { page?: number; pageSize?: number; totalCount?: number };
  selectedCaseIds?: string[];
  timestamp?: string;
  [key: string]: unknown;
}

// =============================================================================
// TOOL FACTORY
// =============================================================================

/**
 * Create tools object with execute functions that call Convex.
 * Tools are defined as plain objects with description, parameters, and execute.
 */
export function createTools(
  token: string,
  conversationId: Id<'conversations'> | null = null,
  cacheStats?: ReturnType<typeof createCacheStats>,
  actionMode: ActionMode = 'confirm',
  pageContext?: PageContext
): Record<string, Tool> {
  chatDebug(`[Chat API] Creating tools with actionMode: ${actionMode}`);

  // One reply's memory of what it proposed or ran, so a model that calls the
  // same change twice in a reply gets one card or one write, not two.
  const proposedInReply = new Set<string>();
  const ranInReply = new Map<string, Record<string, unknown>>();

  /**
   * Every write tool: prepare the change against the case as it is now
   * (src/lib/ai/caseActions.ts). A request that can't be made as asked is
   * answered with what's missing and changes nothing. Otherwise confirm mode
   * records the exact change as a card the person approves once
   * (convex/chatConfirmations.ts); auto mode makes it and reads it back.
   */
  async function proposeOrRun(toolName: ActionTool, params: unknown, toolCallId: string): Promise<Record<string, unknown>> {
    const disabled = checkToolAllowed(toolName, actionMode, 'Actions are switched off', 'make changes from the chat');
    if (disabled) return disabled;

    let prepared: Prepared;
    try {
      prepared = await prepareAction(toolName, params, token);
    } catch (error) {
      captureError(error);
      return buildToolError(toolName, error);
    }
    if (prepared.kind === 'answer') return prepared.response;

    const hash = hashAction(prepared.toolName, prepared.args);
    if (requiresConfirmation(toolName, actionMode)) {
      if (proposedInReply.has(hash)) {
        return {
          error: 'A card for this exact change is already showing.',
          suggestion: 'Wait for the person to approve or cancel it; do not propose it again.',
        };
      }
      try {
        await fetchMutation(
          api.chatConfirmations.issue,
          {
            toolCallId,
            toolName: prepared.toolName,
            args: JSON.stringify(prepared.args),
            argsHash: hash,
            description: prepared.description,
            ...(prepared.caseId ? { caseId: prepared.caseId as Id<'cases'> } : {}),
            ...(prepared.caseUpdatedAt !== undefined ? { caseUpdatedAt: prepared.caseUpdatedAt } : {}),
          },
          { token },
        );
      } catch (error) {
        captureError(error);
        return buildToolError(toolName, error);
      }
      proposedInReply.add(hash);
      return buildConfirmationResponse(prepared.toolName, toolCallId, prepared.args, prepared.description, {
        permissionType: prepared.permissionType,
        warning: prepared.warning,
        preview: { changes: prepared.changes },
      });
    }

    const earlier = ranInReply.get(hash);
    if (earlier) return { ...earlier, note: 'This exact change was already made earlier in this reply, so it was not made again.' };
    try {
      const done = await runAction(prepared.toolName, prepared.args, token);
      ranInReply.set(hash, done.result);
      return done.result;
    } catch (error) {
      captureError(error);
      return buildToolError(toolName, error);
    }
  }

  const text = (d: unknown): string => (typeof d === 'string' ? d : '');

  const actionTool = <S extends z.ZodTypeAny>(toolName: ActionTool, description: string, inputSchema: S) => ({
    description,
    inputSchema,
    execute: async (params: z.infer<S>, { toolCallId }: ToolExecutionOptions) => {
      chatDebug(`[Chat API] ${toolName} called with:`, truncateForLog(params));
      return proposeOrRun(toolName, params, toolCallId);
    },
  });

  const toolsObj = {
    // =========================================================================
    // READ-ONLY TOOLS (AUTONOMOUS)
    // =========================================================================

    queryCases: {
      description: QUERY_CASES_DESCRIPTION,
      inputSchema: QueryCasesInputSchema,
      execute: async (params: QueryCasesInput) => {
        const startTime = Date.now();
        chatDebug(`[Chat API] queryCases called with:`, truncateForLog(params));

        try {
          // Not cached: the person edits cases in the form between questions,
          // and a 5-minute-old answer read as the case's current state.
          let result: unknown;
          try {
            result = sanitizeBigInts(await fetchQuery(api.chatCaseData.queryCases, params, { token }));
          } catch (error) {
            console.error(`[Chat API] queryCases error:`, error instanceof Error ? error.message : String(error));
            captureError(error);
            result = {
              error: "The cases couldn't be read just now.",
              suggestion: 'Tell the person and try again in a moment.',
            };
          }

          const duration = Date.now() - startTime;
          chatDebug(`[Chat API] queryCases result (${duration}ms):`, truncateForLog(result));
          // A list that stopped at its cap says so ("showing 100 of 340").
          // Applied after the cache, so a cached result carries it too.
          return annotateCaseQuery(result);
        } catch (error) {
          console.error(`[Chat API] queryCases error:`, error instanceof Error ? error.message : String(error));
          captureError(error);
          return {
            error: 'Failed to execute query',
            details: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },

    searchKnowledge: {
      description: SEARCH_KNOWLEDGE_DESCRIPTION,
      inputSchema: SearchKnowledgeInputSchema,
      execute: async (params: SearchKnowledgeInput) => {
        const startTime = Date.now();
        chatDebug(`[Chat API] searchKnowledge called with:`, truncateForLog(params));

        const result = await executeWithCache({
          conversationId,
          toolName: 'search_knowledge' as CacheableToolName,
          params: params as Record<string, unknown>,
          token,
          execute: async () => {
            try {
              cacheStats?.recordMiss();
              const result = await fetchAction(api.knowledge.searchKnowledge, params, { token });
              return sanitizeBigInts(result);
            } catch (error) {
              // The per-user search limit (knowledgeSearch in rateLimitConfig)
              // is a wait, not a bad question: say so, with the wait. It used
              // to come back as "try rephrasing your question".
              const limited = rateLimitedToolResult(error, 'knowledge-base searches');
              if (limited) return limited;
              console.error(`[Chat API] searchKnowledge error:`, {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                params: truncateForLog(params),
              });
              captureError(error);
              return {
                error: "The knowledge base didn't answer just now.",
                suggestion: "Tell the person the knowledge base didn't answer just now, and answer from what you know, saying so.",
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
              };
            }
          },
        });

        const duration = Date.now() - startTime;
        const typedResult = result as { context?: string; sources?: unknown[] };
        const preview = {
          contextLength: typedResult?.context?.length || 0,
          sourcesCount: typedResult?.sources?.length || 0,
        };
        chatDebug(`[Chat API] searchKnowledge result (${duration}ms):`, preview);
        chatDebug(`[Chat API] searchKnowledge context preview:`, truncateForLog(typedResult?.context || ''));
        return result;
      },
    },

    searchWeb: {
      description: SEARCH_WEB_DESCRIPTION,
      inputSchema: SearchWebInputSchema,
      execute: async (params: SearchWebInput) => {
        const startTime = Date.now();
        chatDebug(`[Chat API] searchWeb called with:`, truncateForLog(params));

        const result = await executeWithCache({
          conversationId,
          toolName: 'search_web' as CacheableToolName,
          params: params as Record<string, unknown>,
          token,
          execute: async () => {
            try {
              cacheStats?.recordMiss();
              const result = await fetchAction(api.webSearch.searchWeb, params, { token });
              // No provider answered: a spent daily quota or a failure. Say
              // which (and when the quota comes back) instead of handing the
              // model an empty list it reads as "the web has nothing". The
              // result carries an `error` key, so the cache never keeps it.
              const unavailable = webSearchUnavailableResult(result, new Date());
              if (unavailable) return unavailable;
              return sanitizeBigInts(result);
            } catch (error) {
              console.error(`[Chat API] searchWeb error:`, {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                params: truncateForLog(params),
              });
              captureError(error);
              return {
                error: 'Web search temporarily unavailable',
                suggestion: 'I can still answer using my knowledge base. Try asking a different way.',
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
              };
            }
          },
        });

        const duration = Date.now() - startTime;
        const typedResult = result as { source?: string; results?: unknown[]; answer?: string | null };
        const preview = {
          source: typedResult?.source || 'unknown',
          resultsCount: typedResult?.results?.length || 0,
          hasAnswer: !!typedResult?.answer,
        };
        chatDebug(`[Chat API] searchWeb result (${duration}ms):`, preview);
        return result;
      },
    },

    getPageContext: {
      description: `Get detailed information about what the user is currently viewing.
Use when user says "this case", "these cases", "what I'm looking at", "visible cases", etc.
Returns current page, visible items, active filters, and context.
AUTONOMOUS: No confirmation needed.`,
      inputSchema: z.object({
        includeVisibleCaseData: z.boolean().optional()
          .describe('If true, fetch full data for visible cases (increases response size)'),
      }),
      execute: async (params: { includeVisibleCaseData?: boolean }) => {
        chatDebug(`[Chat API] getPageContext called with:`, truncateForLog(params));

        if (!pageContext) {
          return {
            error: 'Page context not available',
            suggestion: 'Page context is only available when the chat widget is open on a page.',
          };
        }

        const result: Record<string, unknown> = {
          path: pageContext.path,
          pageType: pageContext.pageType,
          timestamp: pageContext.timestamp,
        };

        if (pageContext.currentCaseId) {
          result.currentCaseId = pageContext.currentCaseId;
          result.hint = 'User is viewing a specific case. Use this ID for operations on "this case".';

          if (params.includeVisibleCaseData && !validateConvexId(pageContext.currentCaseId, 'case ID')) {
            try {
              const caseData = await fetchQuery(
                api.cases.get,
                { id: pageContext.currentCaseId as Id<'cases'> },
                { token }
              );
              result.currentCaseData = caseData;
            } catch (e) {
              console.error('[Chat API] Error fetching current case data:', e);
              captureError(e);
            }
          }
        }

        if (pageContext.visibleCaseIds && pageContext.visibleCaseIds.length > 0) {
          result.visibleCaseIds = pageContext.visibleCaseIds;
          result.visibleCaseCount = pageContext.visibleCaseIds.length;
          result.hint = `User sees ${pageContext.visibleCaseIds.length} cases on screen. Use these IDs for operations on "visible cases" or "these cases".`;
        }

        if (pageContext.selectedCaseIds && pageContext.selectedCaseIds.length > 0) {
          result.selectedCaseIds = pageContext.selectedCaseIds;
          result.selectedCaseCount = pageContext.selectedCaseIds.length;
        }

        if (pageContext.filters) result.activeFilters = pageContext.filters;
        if (pageContext.pagination) result.pagination = pageContext.pagination;

        return { success: true, pageContext: result };
      },
    },

    // =========================================================================
    // NAVIGATION TOOLS (AUTONOMOUS)
    // =========================================================================

    navigate: {
      description: NAVIGATE_DESCRIPTION,
      inputSchema: NavigateInputSchema,
      execute: async (params: NavigateInput) => {
        chatDebug(`[Chat API] navigate called with:`, truncateForLog(params));
        return {
          success: true,
          clientAction: { type: 'navigate' as const, payload: { path: params.path, reason: params.reason } },
          message: params.reason || `Navigating to ${params.path}`,
        };
      },
    },

    viewCase: {
      description: VIEW_CASE_DESCRIPTION,
      inputSchema: ViewCaseInputSchema,
      execute: async (params: ViewCaseInput) => {
        chatDebug(`[Chat API] viewCase called with:`, truncateForLog(params));
        const idError = validateConvexId(params.caseId, 'case ID');
        if (idError) return idError;
        return {
          success: true,
          clientAction: { type: 'viewCase' as const, payload: { caseId: params.caseId, section: params.section } },
          message: `Opening case ${params.caseId}${params.section ? ` (${params.section})` : ''}`,
        };
      },
    },

    scrollTo: {
      description: SCROLL_TO_DESCRIPTION,
      inputSchema: ScrollToInputSchema,
      execute: async (params: ScrollToInput) => {
        chatDebug(`[Chat API] scrollTo called with:`, truncateForLog(params));
        return {
          success: true,
          clientAction: { type: 'scrollTo' as const, payload: { target: params.target, smooth: params.smooth !== undefined ? params.smooth : true } },
          message: `Scrolling to ${params.target}`,
        };
      },
    },

    refreshPage: {
      description: REFRESH_PAGE_DESCRIPTION,
      inputSchema: RefreshPageInputSchema,
      execute: async (params: RefreshPageInput) => {
        chatDebug(`[Chat API] refreshPage called with:`, truncateForLog(params));
        return {
          success: true,
          clientAction: { type: 'refreshPage' as const, payload: { reason: params.reason } },
          message: params.reason || 'Refreshing page',
        };
      },
    },

    // =========================================================================
    // CASE CRUD TOOLS (CONFIRM tier)
    // =========================================================================

    createCase: actionTool('createCase', text(createCaseTool.description), CreateCaseInputSchema),
    updateCase: actionTool('updateCase', text(updateCaseTool.description), UpdateCaseInputSchema),
    archiveCase: actionTool('archiveCase', text(archiveCaseTool.description), ArchiveCaseInputSchema),
    reopenCase: actionTool('reopenCase', text(reopenCaseTool.description), ReopenCaseInputSchema),
    deleteCase: actionTool('deleteCase', text(deleteCaseTool.description), DeleteCaseInputSchema),

    // =========================================================================
    // CALENDAR, NOTIFICATIONS, SETTINGS
    // =========================================================================

    syncToCalendar: actionTool('syncToCalendar', SYNC_TO_CALENDAR_DESCRIPTION, SyncToCalendarInputSchema),
    unsyncFromCalendar: actionTool('unsyncFromCalendar', UNSYNC_FROM_CALENDAR_DESCRIPTION, UnsyncFromCalendarInputSchema),
    markNotificationRead: actionTool('markNotificationRead', MARK_NOTIFICATION_READ_DESCRIPTION, MarkNotificationReadInputSchema),
    markAllNotificationsRead: actionTool('markAllNotificationsRead', MARK_ALL_NOTIFICATIONS_READ_DESCRIPTION, MarkAllNotificationsReadInputSchema),
    deleteNotification: actionTool('deleteNotification', DELETE_NOTIFICATION_DESCRIPTION, DeleteNotificationInputSchema),
    clearAllNotifications: actionTool('clearAllNotifications', CLEAR_ALL_NOTIFICATIONS_DESCRIPTION, ClearAllNotificationsInputSchema),
    updateSettings: actionTool('updateSettings', UPDATE_SETTINGS_DESCRIPTION, UpdateSettingsInputSchema),

    getSettings: {
      description: GET_SETTINGS_DESCRIPTION,
      inputSchema: GetSettingsInputSchema,
      execute: async (params: GetSettingsInput) => {
        const startTime = Date.now();
        chatDebug(`[Chat API] getSettings called with:`, truncateForLog(params));

        try {
          const profile = await fetchQuery(api.users.currentUserProfile, {}, { token });
          const duration = Date.now() - startTime;
          chatDebug(`[Chat API] getSettings result (${duration}ms):`, truncateForLog(profile));

          if (!profile) {
            return { error: 'User profile not found', suggestion: 'Please ensure you are logged in.' };
          }

          const category = params.category || 'all';

          if (category === 'all') {
            return {
              success: true,
              settings: {
                notifications: {
                  emailNotificationsEnabled: profile.emailNotificationsEnabled,
                  pushNotificationsEnabled: profile.pushNotificationsEnabled,
                  emailDeadlineReminders: profile.emailDeadlineReminders,
                  urgentDeadlineDays: profile.urgentDeadlineDays ? Number(profile.urgentDeadlineDays) : 7,
                  quietHoursEnabled: profile.quietHoursEnabled,
                  quietHoursStart: profile.quietHoursStart,
                  quietHoursEnd: profile.quietHoursEnd,
                },
                calendar: {
                  calendarSyncEnabled: profile.calendarSyncEnabled,
                  calendarSyncPwd: profile.calendarSyncPwd,
                  calendarSyncEta9089: profile.calendarSyncEta9089,
                  googleCalendarConnected: profile.googleCalendarConnected,
                },
                preferences: {
                  darkModeEnabled: profile.darkModeEnabled,
                  timezone: profile.timezone,
                },
              },
            };
          }

          if (category === 'notifications') {
            return {
              success: true,
              settings: {
                emailNotificationsEnabled: profile.emailNotificationsEnabled,
                pushNotificationsEnabled: profile.pushNotificationsEnabled,
                emailDeadlineReminders: profile.emailDeadlineReminders,
                urgentDeadlineDays: profile.urgentDeadlineDays ? Number(profile.urgentDeadlineDays) : 7,
                quietHoursEnabled: profile.quietHoursEnabled,
                quietHoursStart: profile.quietHoursStart,
                quietHoursEnd: profile.quietHoursEnd,
              },
            };
          }

          if (category === 'calendar') {
            return {
              success: true,
              settings: {
                calendarSyncEnabled: profile.calendarSyncEnabled,
                calendarSyncPwd: profile.calendarSyncPwd,
                calendarSyncEta9089: profile.calendarSyncEta9089,
                googleCalendarConnected: profile.googleCalendarConnected,
              },
            };
          }

          if (category === 'preferences') {
            return {
              success: true,
              settings: {
                darkModeEnabled: profile.darkModeEnabled,
                timezone: profile.timezone,
              },
            };
          }

          return { success: true, settings: profile };
        } catch (error) {
          captureError(error);
          return buildToolError('getSettings', error);
        }
      },
    },

    // =========================================================================
    // BULK OPERATION TOOLS (DESTRUCTIVE)
    // =========================================================================

    bulkUpdateStatus: actionTool('bulkUpdateStatus', BULK_UPDATE_STATUS_DESCRIPTION, BulkUpdateStatusInputSchema),
    bulkArchiveCases: actionTool('bulkArchiveCases', BULK_ARCHIVE_CASES_DESCRIPTION, BulkArchiveCasesInputSchema),
    bulkDeleteCases: actionTool('bulkDeleteCases', BULK_DELETE_CASES_DESCRIPTION, BulkDeleteCasesInputSchema),
    bulkCalendarSync: actionTool('bulkCalendarSync', BULK_CALENDAR_SYNC_DESCRIPTION, BulkCalendarSyncInputSchema),

    // =========================================================================
    // JOB DESCRIPTION TEMPLATE TOOLS
    // =========================================================================

    listJobDescriptionTemplates: {
      description: LIST_JOB_DESC_TEMPLATES_DESCRIPTION,
      inputSchema: ListJobDescriptionTemplatesInputSchema,
      execute: async (params: ListJobDescriptionTemplatesInput) => {
        const startTime = Date.now();
        chatDebug(`[Chat API] listJobDescriptionTemplates called with:`, truncateForLog(params));

        try {
          const templates = params.searchQuery
            ? await fetchQuery(api.jobDescriptionTemplates.searchByName, { query: params.searchQuery }, { token })
            : await fetchQuery(api.jobDescriptionTemplates.list, {}, { token });

          const duration = Date.now() - startTime;
          chatDebug(`[Chat API] listJobDescriptionTemplates result (${duration}ms): ${templates.length} templates`);
          return { success: true, templates: sanitizeBigInts(templates), count: templates.length };
        } catch (error) {
          captureError(error);
          return buildToolError('listJobDescriptionTemplates', error);
        }
      },
    },

    createJobDescriptionTemplate: actionTool('createJobDescriptionTemplate', CREATE_JOB_DESC_TEMPLATE_DESCRIPTION, CreateJobDescriptionTemplateInputSchema),
    updateJobDescriptionTemplate: actionTool('updateJobDescriptionTemplate', UPDATE_JOB_DESC_TEMPLATE_DESCRIPTION, UpdateJobDescriptionTemplateInputSchema),
    deleteJobDescriptionTemplate: actionTool('deleteJobDescriptionTemplate', DELETE_JOB_DESC_TEMPLATE_DESCRIPTION, DeleteJobDescriptionTemplateInputSchema),
  };

  // Context-aware tool selection: only include tools relevant to current page
  // Full set is 29 tools (~4k+ tokens). Reducing to 8-12 saves ~2-3k tokens,
  // critical for fallback models with tight TPM/context limits (Groq 12k, Cerebras 8k).
  const selectedTools = selectRelevantTools(toolsObj, pageContext, actionMode);
  chatDebug(`[Chat API] Tools created: ${Object.keys(selectedTools).length} of ${Object.keys(toolsObj).length} (${Object.keys(selectedTools).join(', ')})`);
  return selectedTools;
}

/**
 * Select only tools relevant to the current page context and action mode.
 * Core tools (query, search, navigate) are always included.
 * Page-specific tools are added based on pageType.
 */
function selectRelevantTools(
  allTools: Record<string, Tool>,
  pageContext?: PageContext,
  actionMode?: ActionMode,
): Record<string, Tool> {
  // Core tools — always included
  const coreNames = ['queryCases', 'searchKnowledge', 'searchWeb', 'getPageContext', 'navigate', 'viewCase'];

  // CRUD tools — included when actions are enabled
  const crudNames = ['createCase', 'updateCase', 'archiveCase', 'reopenCase', 'deleteCase'];

  // Start with core tools
  const selected: Record<string, Tool> = {};
  for (const name of coreNames) {
    if (allTools[name]) selected[name] = allTools[name];
  }

  // Add CRUD tools if actions are enabled
  if (actionMode !== 'off') {
    for (const name of crudNames) {
      if (allTools[name]) selected[name] = allTools[name];
    }
  }

  // Add page-specific tools
  const pageType = pageContext?.pageType;

  if (pageType === 'case-detail' || pageType === 'case-edit') {
    for (const name of ['syncToCalendar', 'unsyncFromCalendar', 'scrollTo', 'refreshPage']) {
      if (allTools[name]) selected[name] = allTools[name];
    }
  }

  if (pageType === 'cases-list' || pageType === 'cases') {
    // Add bulk ops only when cases are selected
    if (pageContext?.selectedCaseIds && pageContext.selectedCaseIds.length > 0) {
      for (const name of ['bulkUpdateStatus', 'bulkArchiveCases', 'bulkDeleteCases', 'bulkCalendarSync']) {
        if (allTools[name]) selected[name] = allTools[name];
      }
    }
    if (allTools['refreshPage']) selected['refreshPage'] = allTools['refreshPage'];
  }

  if (pageType === 'settings') {
    for (const name of ['updateSettings', 'getSettings']) {
      if (allTools[name]) selected[name] = allTools[name];
    }
  }

  if (pageType === 'notifications') {
    for (const name of ['markNotificationRead', 'markAllNotificationsRead', 'deleteNotification', 'clearAllNotifications']) {
      if (allTools[name]) selected[name] = allTools[name];
    }
  }

  // Job description templates — only on case creation/edit pages
  if (pageType === 'case-edit' || pageType === 'case-create') {
    for (const name of ['listJobDescriptionTemplates', 'createJobDescriptionTemplate', 'updateJobDescriptionTemplate', 'deleteJobDescriptionTemplate']) {
      if (allTools[name]) selected[name] = allTools[name];
    }
  }

  return selected;
}
