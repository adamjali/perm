/**
 * Chat Streaming API Route
 *
 * Handles AI chat requests with:
 * - Authentication verification
 * - Multi-provider fallback (auto-switches on quota/rate limit errors)
 * - Streaming response with error recovery
 * - Native AI SDK tool calling for case queries, knowledge search, and web search
 * - Conversation context optimization via summarization
 *
 * POST /api/chat
 * Body: { messages: UIMessage[], conversationId?: string }
 * Returns: Streaming response (AI SDK format)
 */

import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  type Tool,
  type CoreMessage,
} from 'ai';
import { z } from 'zod';
import { isAuthenticatedNextjs, convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery, fetchAction, fetchMutation } from 'convex/nextjs';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import {
  summarizeConversation,
  checkNeedsSummarization,
} from '@/lib/ai/summarize';
import { chatModel, PRIMARY_MODEL_NAME } from '@/lib/ai/providers';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
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
  type QueryCasesInput,
  type SearchKnowledgeInput,
  type SearchWebInput,
  type NavigateInput,
  type ViewCaseInput,
  type ScrollToInput,
  type RefreshPageInput,
  type CreateCaseInput,
  type UpdateCaseInput,
  type ArchiveCaseInput,
  type ReopenCaseInput,
  type DeleteCaseInput,
  type SyncToCalendarInput,
  type UnsyncFromCalendarInput,
  type MarkNotificationReadInput,
  type MarkAllNotificationsReadInput,
  type DeleteNotificationInput,
  type ClearAllNotificationsInput,
  type UpdateSettingsInput,
  type GetSettingsInput,
  type BulkUpdateStatusInput,
  type BulkArchiveCasesInput,
  type BulkDeleteCasesInput,
  type BulkCalendarSyncInput,
  createCaseTool,
  updateCaseTool,
  archiveCaseTool,
  reopenCaseTool,
  deleteCaseTool,
} from '@/lib/ai/tools';
import {
  requiresConfirmation,
  getToolPermission,
  isToolAllowed,
  type ActionMode,
} from '@/lib/ai/tool-permissions';
import { executeWithCache, createCacheStats, type CacheableToolName } from '@/lib/ai/cache';

/**
 * Tool execution options provided by AI SDK.
 * The second parameter to execute functions.
 */
interface ToolExecutionOptions {
  toolCallId: string;
  messages?: CoreMessage[];
  abortSignal?: AbortSignal;
}

// Allow up to 60 seconds for streaming responses (extra time for fallbacks + tool calls)
export const maxDuration = 60;

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

const LOG_PREVIEW_LENGTH = 500; // Characters to preview in console
const VERBOSE_LOGGING = process.env.CHAT_LOG_VERBOSE === 'true';

/**
 * Truncate data for logging (unless verbose mode enabled)
 */
function truncateForLog(data: unknown, maxLength: number = LOG_PREVIEW_LENGTH): string {
  // Handle BigInt serialization (Convex IDs can be BigInt internally)
  const str = typeof data === 'string' ? data : JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 0);
  if (VERBOSE_LOGGING || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + `... [+${str.length - maxLength} chars]`;
}

/**
 * Recursively sanitize BigInt values to numbers/strings for JSON serialization.
 * Convex returns BigInt for some internal values (_creationTime, etc.)
 * which break JSON.stringify in the AI SDK response streaming.
 */
function sanitizeBigInts<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    // Convert to number if safe, otherwise string
    return (Number.isSafeInteger(Number(data)) ? Number(data) : data.toString()) as T;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeBigInts) as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeBigInts(value);
    }
    return result as T;
  }

  return data;
}

/**
 * Generate unique session ID for request tracing
 */
function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// TOOL DEFINITIONS WITH EXECUTE FUNCTIONS
// =============================================================================

// Tool description constants
const QUERY_CASES_DESCRIPTION = `Query the user's PERM cases with flexible filters and field projection.
Use for: listing/counting cases, finding by employer/beneficiary/status, deadline inquiries, RFI/RFE tracking, professional occupation cases.
Parameters: caseStatus, progressStatus, hasRfi/hasRfe, hasOverdueDeadline, deadlineWithinDays, searchText, isProfessionalOccupation, countOnly, limit.`;

const SEARCH_KNOWLEDGE_DESCRIPTION = `Search the PERM knowledge base for regulatory information, deadlines, and procedures.
Use for: PERM regulation questions, deadline rules, process questions, CFR lookups.
Parameter: query (natural language question).`;

const SEARCH_WEB_DESCRIPTION = `Search the web for current PERM information, processing times, news, and updates.
Use for: current processing times, recent DOL/USCIS announcements, trends not in knowledge base.
Parameter: query (search query, include "PERM" for relevance).`;

// Navigation tool descriptions (AUTONOMOUS - no permission required)
const NAVIGATE_DESCRIPTION = `Navigate to a specific page in the PERM Tracker application.
Use for: going to dashboard, cases list, calendar, settings, or creating a new case.
Parameters: path (required), reason (optional).`;

const VIEW_CASE_DESCRIPTION = `Navigate to view a specific PERM case's detail page.
Use for: showing case details after finding a case via queryCases, viewing case timeline, editing a case.
Parameters: caseId (required), section (optional: overview, timeline, edit).`;

const SCROLL_TO_DESCRIPTION = `Scroll to a specific section on the current page.
Use for: highlighting deadlines section, jumping to form sections, navigating within long pages.
Parameters: target (required: top, bottom, deadlines, recent-activity, form-section, timeline), smooth (optional).`;

const REFRESH_PAGE_DESCRIPTION = `Refresh the current page to get the latest data.
Use for: refreshing after changes, when user reports stale data, after external updates.
Parameters: reason (optional).`;

// Calendar tool descriptions (CONFIRM tier)
const SYNC_TO_CALENDAR_DESCRIPTION = `Enable Google Calendar sync for a PERM case.
Use for: syncing case deadlines to calendar, adding case to user's calendar.
Parameters: caseId (required).`;

const UNSYNC_FROM_CALENDAR_DESCRIPTION = `Disable Google Calendar sync for a PERM case.
Use for: removing case from calendar, stopping deadline sync.
Parameters: caseId (required).`;

// Notification tool descriptions (mixed permission tiers)
const MARK_NOTIFICATION_READ_DESCRIPTION = `Mark a single notification as read.
Use for: dismissing specific notification, acknowledging alerts.
Parameters: notificationId (required).`;

const MARK_ALL_NOTIFICATIONS_READ_DESCRIPTION = `Mark ALL notifications as read. Batch operation.
Use for: clearing all unread notifications at once.
Parameters: none.`;

const DELETE_NOTIFICATION_DESCRIPTION = `Delete a single notification permanently.
Use for: removing specific notification from history.
Parameters: notificationId (required).`;

const CLEAR_ALL_NOTIFICATIONS_DESCRIPTION = `Delete all READ notifications permanently. Batch operation.
Use for: cleaning up notification history, clearing old notifications.
Parameters: none.`;

// Settings tool descriptions
const UPDATE_SETTINGS_DESCRIPTION = `Update user settings and preferences.
Use for: changing notification settings, calendar settings, UI preferences.
Parameters: settings object with fields to change.`;

const GET_SETTINGS_DESCRIPTION = `Get current user settings and preferences.
Use for: checking current settings before suggesting changes.
Parameters: category (optional: all, notifications, calendar, preferences).`;

// Bulk operation tool descriptions (DESTRUCTIVE - always require confirmation)
const BULK_UPDATE_STATUS_DESCRIPTION = `Update status for multiple cases at once.
DESTRUCTIVE: Always requires confirmation.
IMPORTANT: Use { all: true } to affect all cases - no need to query IDs first.
Use filterByStatus to only affect cases with a specific status.
Parameters: all (boolean), status (pwd/recruitment/eta9089/i140/closed), filterByStatus (optional).`;

const BULK_ARCHIVE_CASES_DESCRIPTION = `Archive (close) multiple cases at once.
DESTRUCTIVE: Always requires confirmation. Uses hard delete.
IMPORTANT: Use { all: true } to affect all cases - no need to query IDs first.
Use filterByStatus to only affect cases with a specific status.
Parameters: all (boolean), filterByStatus (optional), reason (optional).`;

const BULK_DELETE_CASES_DESCRIPTION = `PERMANENTLY delete multiple cases at once.
HIGHLY DESTRUCTIVE: Always requires explicit confirmation. Cannot be undone!
IMPORTANT: Use { all: true } to affect all cases - no need to query IDs first.
Use filterByStatus to only affect cases with a specific status.
Parameters: all (boolean), filterByStatus (optional).`;

const BULK_CALENDAR_SYNC_DESCRIPTION = `Enable or disable Google Calendar sync for multiple cases.
DESTRUCTIVE: Always requires confirmation.
IMPORTANT: Use { all: true } to affect all cases - no need to query IDs first.
Use filterByStatus to only affect cases with a specific status.
Parameters: all (boolean), enabled (boolean), filterByStatus (optional).`;

/**
 * Create tools object with execute functions that call Convex
 * Tools are defined as plain objects with description, parameters, and execute
 * Now with caching support for improved performance.
 *
 * @param token - Convex auth token for authenticated API calls
 * @param conversationId - Optional conversation ID for caching scope
 * @param cacheStats - Optional cache stats tracker for logging
 * @param actionMode - Current action mode for permission checking
 * @returns Tools object for streamText
 */
function createTools(
  token: string,
  conversationId: Id<'conversations'> | null = null,
  cacheStats?: ReturnType<typeof createCacheStats>,
  actionMode: ActionMode = 'confirm',
  pageContext?: {
    path?: string;
    pageType?: string;
    currentCaseId?: string;
    visibleCaseIds?: string[];
    filters?: Record<string, unknown>;
    pagination?: { page?: number; pageSize?: number; totalCount?: number };
    selectedCaseIds?: string[];
    [key: string]: unknown;
  }
): Record<string, Tool> {
  console.log(`[Chat API] Creating tools with actionMode: ${actionMode}`);
  const toolsObj = {
    queryCases: {
      description: QUERY_CASES_DESCRIPTION,
      inputSchema: QueryCasesInputSchema,
      execute: async (params: QueryCasesInput) => {
        const startTime = Date.now();
        console.log(`[Chat API] queryCases called with:`, truncateForLog(params));

        try {
          const result = await executeWithCache({
            conversationId,
            toolName: 'query_cases' as CacheableToolName,
            params: params as Record<string, unknown>,
            token,
            execute: async () => {
              try {
                cacheStats?.recordMiss();
                const result = await fetchQuery(
                  api.chatCaseData.queryCases,
                  params,
                  { token }
                );
                // Sanitize BigInt values from Convex (e.g., _creationTime)
                return sanitizeBigInts(result);
              } catch (error) {
                // Log with full context for debugging
                console.error(`[Chat API] queryCases error:`, {
                  error,
                  errorMessage: error instanceof Error ? error.message : String(error),
                  errorType: error instanceof Error ? error.constructor.name : typeof error,
                  params: truncateForLog(params),
                });
                return {
                  error: 'Failed to query cases',
                  suggestion: 'Please try again or rephrase your question about cases.',
                  // Include error type for AI context (not sensitive details)
                  errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
                };
              }
            },
          });

          const duration = Date.now() - startTime;
          console.log(`[Chat API] queryCases result (${duration}ms):`, truncateForLog(result));
          return result;
        } catch (error) {
          console.error(`[Chat API] queryCases executeWithCache error:`, error);
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
        console.log(`[Chat API] searchKnowledge called with:`, truncateForLog(params));

        const result = await executeWithCache({
          conversationId,
          toolName: 'search_knowledge' as CacheableToolName,
          params: params as Record<string, unknown>,
          token,
          execute: async () => {
            try {
              cacheStats?.recordMiss();
              const result = await fetchAction(
                api.knowledge.searchKnowledge,
                params,
                { token }
              );
              // Sanitize BigInt values from Convex
              return sanitizeBigInts(result);
            } catch (error) {
              // Log with full context for debugging
              console.error(`[Chat API] searchKnowledge error:`, {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                params: truncateForLog(params),
              });
              return {
                error: 'Failed to search knowledge base',
                suggestion: 'Please try rephrasing your question about PERM regulations.',
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
              };
            }
          },
        });

        const duration = Date.now() - startTime;
        const typedResult = result as { context?: string; sources?: unknown[] };
        const preview = {
          contextLength: typedResult?.context?.length ?? 0,
          sourcesCount: typedResult?.sources?.length ?? 0,
        };
        console.log(`[Chat API] searchKnowledge result (${duration}ms):`, preview);
        console.log(`[Chat API] searchKnowledge context preview:`, truncateForLog(typedResult?.context ?? ''));
        return result;
      },
    },

    searchWeb: {
      description: SEARCH_WEB_DESCRIPTION,
      inputSchema: SearchWebInputSchema,
      execute: async (params: SearchWebInput) => {
        const startTime = Date.now();
        console.log(`[Chat API] searchWeb called with:`, truncateForLog(params));

        const result = await executeWithCache({
          conversationId,
          toolName: 'search_web' as CacheableToolName,
          params: params as Record<string, unknown>,
          token,
          execute: async () => {
            try {
              cacheStats?.recordMiss();
              const result = await fetchAction(
                api.webSearch.searchWeb,
                params,
                { token }
              );
              // Sanitize BigInt values from Convex
              return sanitizeBigInts(result);
            } catch (error) {
              // Log with full context for debugging
              console.error(`[Chat API] searchWeb error:`, {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                params: truncateForLog(params),
              });
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
          source: typedResult?.source ?? 'unknown',
          resultsCount: typedResult?.results?.length ?? 0,
          hasAnswer: !!typedResult?.answer,
        };
        console.log(`[Chat API] searchWeb result (${duration}ms):`, preview);
        return result;
      },
    },

    // =========================================================================
    // NAVIGATION TOOLS (AUTONOMOUS - no permission required)
    // These return clientAction objects for frontend execution
    // =========================================================================

    navigate: {
      description: NAVIGATE_DESCRIPTION,
      inputSchema: NavigateInputSchema,
      execute: async (params: NavigateInput) => {
        console.log(`[Chat API] navigate called with:`, truncateForLog(params));

        // Navigation is client-side only - return action for frontend execution
        return {
          success: true,
          clientAction: {
            type: 'navigate' as const,
            payload: { path: params.path, reason: params.reason },
          },
          message: params.reason || `Navigating to ${params.path}`,
        };
      },
    },

    viewCase: {
      description: VIEW_CASE_DESCRIPTION,
      inputSchema: ViewCaseInputSchema,
      execute: async (params: ViewCaseInput) => {
        console.log(`[Chat API] viewCase called with:`, truncateForLog(params));

        // View case is client-side navigation - return action for frontend
        return {
          success: true,
          clientAction: {
            type: 'viewCase' as const,
            payload: { caseId: params.caseId, section: params.section },
          },
          message: `Opening case ${params.caseId}${params.section ? ` (${params.section})` : ''}`,
        };
      },
    },

    scrollTo: {
      description: SCROLL_TO_DESCRIPTION,
      inputSchema: ScrollToInputSchema,
      execute: async (params: ScrollToInput) => {
        console.log(`[Chat API] scrollTo called with:`, truncateForLog(params));

        // Scroll is client-side only - return action for frontend execution
        return {
          success: true,
          clientAction: {
            type: 'scrollTo' as const,
            payload: { target: params.target, smooth: params.smooth ?? true },
          },
          message: `Scrolling to ${params.target}`,
        };
      },
    },

    refreshPage: {
      description: REFRESH_PAGE_DESCRIPTION,
      inputSchema: RefreshPageInputSchema,
      execute: async (params: RefreshPageInput) => {
        console.log(`[Chat API] refreshPage called with:`, truncateForLog(params));

        // Refresh is client-side only - return action for frontend execution
        return {
          success: true,
          clientAction: {
            type: 'refreshPage' as const,
            payload: { reason: params.reason },
          },
          message: params.reason || 'Refreshing page',
        };
      },
    },

    // =========================================================================
    // CASE CRUD TOOLS (require confirmation based on actionMode)
    // These tools modify case data and require permission checking
    // =========================================================================

    createCase: {
      description: createCaseTool.description,
      inputSchema: CreateCaseInputSchema,
      execute: async (params: CreateCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] createCase called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('createCase', actionMode)) {
          return {
            error: 'Case creation is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to create cases.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('createCase', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('createCase'),
            toolName: 'createCase',
            toolCallId,
            arguments: params,
            description: `Create a new PERM case for ${params.employerName} - ${params.beneficiaryIdentifier} (${params.positionTitle})`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(
            api.cases.create,
            {
              employerName: params.employerName,
              beneficiaryIdentifier: params.beneficiaryIdentifier,
              positionTitle: params.positionTitle,
              caseStatus: params.caseStatus,
              progressStatus: params.progressStatus,
              priorityLevel: params.priorityLevel,
              isProfessionalOccupation: params.isProfessionalOccupation,
              isFavorite: params.isFavorite,
              calendarSyncEnabled: params.calendarSyncEnabled,
              pwdFilingDate: params.pwdFilingDate,
              pwdDeterminationDate: params.pwdDeterminationDate,
              pwdExpirationDate: params.pwdExpirationDate,
              pwdCaseNumber: params.pwdCaseNumber,
              pwdWageLevel: params.pwdWageLevel,
              jobOrderStartDate: params.jobOrderStartDate,
              jobOrderEndDate: params.jobOrderEndDate,
              sundayAdFirstDate: params.sundayAdFirstDate,
              sundayAdSecondDate: params.sundayAdSecondDate,
              sundayAdNewspaper: params.sundayAdNewspaper,
              noticeOfFilingStartDate: params.noticeOfFilingStartDate,
              noticeOfFilingEndDate: params.noticeOfFilingEndDate,
              additionalRecruitmentMethods: params.additionalRecruitmentMethods,
              eta9089FilingDate: params.eta9089FilingDate,
              eta9089CertificationDate: params.eta9089CertificationDate,
              eta9089CaseNumber: params.eta9089CaseNumber,
              i140FilingDate: params.i140FilingDate,
              i140ReceiptNumber: params.i140ReceiptNumber,
              i140Category: params.i140Category,
              i140PremiumProcessing: params.i140PremiumProcessing,
              internalCaseNumber: params.internalCaseNumber,
              employerFein: params.employerFein,
              socCode: params.socCode,
              socTitle: params.socTitle,
              jobOrderState: params.jobOrderState,
            },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] createCase result (${duration}ms):`, truncateForLog(result));

          return {
            success: true,
            caseId: result,
            employerName: params.employerName,
            beneficiaryIdentifier: params.beneficiaryIdentifier,
            positionTitle: params.positionTitle,
            message: `Created case for ${params.beneficiaryIdentifier} at ${params.employerName}`,
          };
        } catch (error) {
          console.error(`[Chat API] createCase error:`, error);
          return {
            error: 'Failed to create case',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    updateCase: {
      description: updateCaseTool.description,
      inputSchema: UpdateCaseInputSchema,
      execute: async (params: UpdateCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] updateCase called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('updateCase', actionMode)) {
          return {
            error: 'Case updates are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to update cases.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('updateCase', actionMode)) {
          // Build a description of what's being updated
          const updateFields = Object.keys(params).filter(k => k !== 'caseId' && params[k as keyof UpdateCaseInput] !== undefined);
          return {
            requiresPermission: true,
            permissionType: getToolPermission('updateCase'),
            toolName: 'updateCase',
            toolCallId,
            arguments: params,
            description: `Update case ${params.caseId}: changing ${updateFields.join(', ')}`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          // Build the update object, only including defined fields
          const { caseId, ...updateFields } = params;

          // Convert number fields to BigInt for Convex int64 fields
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const convexFields: Record<string, any> = { ...updateFields };

          if (typeof updateFields.pwdWageAmount === 'number') {
            convexFields.pwdWageAmount = BigInt(updateFields.pwdWageAmount);
          }
          if (typeof updateFields.recruitmentApplicantsCount === 'number') {
            convexFields.recruitmentApplicantsCount = BigInt(updateFields.recruitmentApplicantsCount);
          }

          // Handle document size field (int64)
          if (updateFields.documents) {
            convexFields.documents = updateFields.documents.map(doc => ({
              ...doc,
              size: typeof doc.size === 'number' ? BigInt(doc.size) : doc.size,
            }));
          }

          const result = await fetchMutation(
            api.cases.update,
            {
              id: caseId as Id<'cases'>,
              ...convexFields,
            },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] updateCase result (${duration}ms):`, truncateForLog(result));

          // Build a descriptive success message
          const updatedFieldNames = Object.keys(updateFields).filter(k => updateFields[k as keyof typeof updateFields] !== undefined);
          const fieldSummary = updatedFieldNames.length <= 3
            ? updatedFieldNames.join(', ')
            : `${updatedFieldNames.slice(0, 3).join(', ')} and ${updatedFieldNames.length - 3} more`;

          return {
            success: true,
            caseId: result,
            message: `Case updated successfully (${fieldSummary})`,
            updatedFields: updatedFieldNames,
          };
        } catch (error) {
          console.error(`[Chat API] updateCase error:`, error);

          // Extract validation errors for better AI feedback
          const errorMessage = error instanceof Error ? error.message : 'Please try again';

          // Check if it's a validation error
          if (errorMessage.includes('Validation failed')) {
            return {
              error: 'Validation failed',
              validationErrors: errorMessage,
              suggestion: 'Check the date values and ensure they follow PERM regulations. For example: RFI due date must be exactly 30 days after received date.',
            };
          }

          return {
            error: 'Failed to update case',
            suggestion: errorMessage,
          };
        }
      },
    },

    archiveCase: {
      description: archiveCaseTool.description,
      inputSchema: ArchiveCaseInputSchema,
      execute: async (params: ArchiveCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] archiveCase called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('archiveCase', actionMode)) {
          return {
            error: 'Case archiving is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to archive cases.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('archiveCase', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('archiveCase'),
            toolName: 'archiveCase',
            toolCallId,
            arguments: params,
            description: `Close case ${params.caseId}${params.reason ? ` (${params.reason})` : ''}. Can be reopened later.`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          // Archive = close the case (set caseStatus to "closed")
          const result = await fetchMutation(
            api.cases.update,
            {
              id: params.caseId as Id<'cases'>,
              caseStatus: 'closed',
            },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] archiveCase result (${duration}ms):`, truncateForLog(result));

          return {
            success: true,
            caseId: result,
            message: `Case closed successfully. Can be reopened with reopenCase if needed.`,
          };
        } catch (error) {
          console.error(`[Chat API] archiveCase error:`, error);
          return {
            error: 'Failed to close case',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    reopenCase: {
      description: reopenCaseTool.description,
      inputSchema: ReopenCaseInputSchema,
      execute: async (params: ReopenCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] reopenCase called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('reopenCase', actionMode)) {
          return {
            error: 'Case reopening is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to reopen cases.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('reopenCase', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('reopenCase'),
            toolName: 'reopenCase',
            toolCallId,
            arguments: params,
            description: `Reopen closed case ${params.caseId}`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(
            api.cases.reopenCase,
            { id: params.caseId as Id<'cases'> },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] reopenCase result (${duration}ms):`, truncateForLog(result));

          return {
            success: true,
            caseId: params.caseId,
            newCaseStatus: result.newCaseStatus,
            newProgressStatus: result.newProgressStatus,
            message: `Case reopened. Status set to ${result.newCaseStatus} (${result.newProgressStatus})`,
          };
        } catch (error) {
          console.error(`[Chat API] reopenCase error:`, error);
          return {
            error: 'Failed to reopen case',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    deleteCase: {
      description: deleteCaseTool.description,
      inputSchema: DeleteCaseInputSchema,
      execute: async (params: DeleteCaseInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] deleteCase called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('deleteCase', actionMode)) {
          return {
            error: 'Case deletion is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to delete cases.',
          };
        }

        // DESTRUCTIVE action - ALWAYS requires confirmation regardless of actionMode
        // This is a safety check even though requiresConfirmation should return true
        return {
          requiresPermission: true,
          permissionType: 'destructive' as const,
          toolName: 'deleteCase',
          toolCallId,
          arguments: params,
          description: `PERMANENTLY DELETE case ${params.caseId}. This action CANNOT be undone!`,
          warning: 'This will permanently remove the case and all associated data. Consider using archiveCase instead if you might need this data later.',
          _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
        };
      },
    },

    // =========================================================================
    // CALENDAR SYNC TOOLS (require confirmation)
    // These tools toggle calendar sync for cases
    // =========================================================================

    syncToCalendar: {
      description: SYNC_TO_CALENDAR_DESCRIPTION,
      inputSchema: SyncToCalendarInputSchema,
      execute: async (params: SyncToCalendarInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] syncToCalendar called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('syncToCalendar', actionMode)) {
          return {
            error: 'Calendar sync is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to sync cases to calendar.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('syncToCalendar', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('syncToCalendar'),
            toolName: 'syncToCalendar',
            toolCallId,
            arguments: params,
            description: `Enable Google Calendar sync for case ${params.caseId}`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          // Use explicit enableCalendarSync mutation (idempotent)
          await fetchMutation(
            api.cases.enableCalendarSync,
            { id: params.caseId as Id<'cases'> },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] syncToCalendar result (${duration}ms): enabled`);

          return {
            success: true,
            caseId: params.caseId,
            calendarSyncEnabled: true,
            message: 'Calendar sync enabled. Case deadlines will appear in your Google Calendar.',
          };
        } catch (error) {
          console.error(`[Chat API] syncToCalendar error:`, error);
          return {
            error: 'Failed to sync to calendar',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    unsyncFromCalendar: {
      description: UNSYNC_FROM_CALENDAR_DESCRIPTION,
      inputSchema: UnsyncFromCalendarInputSchema,
      execute: async (params: UnsyncFromCalendarInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] unsyncFromCalendar called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('unsyncFromCalendar', actionMode)) {
          return {
            error: 'Calendar sync is disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings to unsync cases from calendar.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('unsyncFromCalendar', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('unsyncFromCalendar'),
            toolName: 'unsyncFromCalendar',
            toolCallId,
            arguments: params,
            description: `Disable Google Calendar sync for case ${params.caseId}`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          // Use explicit disableCalendarSync mutation (idempotent)
          await fetchMutation(
            api.cases.disableCalendarSync,
            { id: params.caseId as Id<'cases'> },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] unsyncFromCalendar result (${duration}ms): disabled`);

          return {
            success: true,
            caseId: params.caseId,
            calendarSyncEnabled: false,
            message: 'Calendar sync disabled. Case deadlines removed from your Google Calendar.',
          };
        } catch (error) {
          console.error(`[Chat API] unsyncFromCalendar error:`, error);
          return {
            error: 'Failed to unsync from calendar',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    // =========================================================================
    // NOTIFICATION TOOLS (mixed permission tiers)
    // These tools manage user notifications
    // =========================================================================

    markNotificationRead: {
      description: MARK_NOTIFICATION_READ_DESCRIPTION,
      inputSchema: MarkNotificationReadInputSchema,
      execute: async (params: MarkNotificationReadInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] markNotificationRead called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('markNotificationRead', actionMode)) {
          return {
            error: 'Notification actions are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('markNotificationRead', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('markNotificationRead'),
            toolName: 'markNotificationRead',
            toolCallId,
            arguments: params,
            description: `Mark notification ${params.notificationId} as read`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(
            api.notifications.markAsRead,
            { notificationId: params.notificationId as Id<'notifications'> },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] markNotificationRead result (${duration}ms):`, result);

          return {
            success: true,
            notificationId: params.notificationId,
            message: 'Notification marked as read.',
          };
        } catch (error) {
          console.error(`[Chat API] markNotificationRead error:`, error);
          return {
            error: 'Failed to mark notification as read',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    markAllNotificationsRead: {
      description: MARK_ALL_NOTIFICATIONS_READ_DESCRIPTION,
      inputSchema: MarkAllNotificationsReadInputSchema,
      execute: async (params: MarkAllNotificationsReadInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] markAllNotificationsRead called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('markAllNotificationsRead', actionMode)) {
          return {
            error: 'Notification actions are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // DESTRUCTIVE batch action - always requires confirmation
        return {
          requiresPermission: true,
          permissionType: 'destructive' as const,
          toolName: 'markAllNotificationsRead',
          toolCallId,
          arguments: params,
          description: 'Mark ALL notifications as read. This affects all your unread notifications.',
          _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
        };
      },
    },

    deleteNotification: {
      description: DELETE_NOTIFICATION_DESCRIPTION,
      inputSchema: DeleteNotificationInputSchema,
      execute: async (params: DeleteNotificationInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] deleteNotification called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('deleteNotification', actionMode)) {
          return {
            error: 'Notification actions are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('deleteNotification', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: getToolPermission('deleteNotification'),
            toolName: 'deleteNotification',
            toolCallId,
            arguments: params,
            description: `Delete notification ${params.notificationId} permanently`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(
            api.notifications.deleteNotification,
            { notificationId: params.notificationId as Id<'notifications'> },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] deleteNotification result (${duration}ms):`, result);

          return {
            success: true,
            notificationId: params.notificationId,
            message: 'Notification deleted.',
          };
        } catch (error) {
          console.error(`[Chat API] deleteNotification error:`, error);
          return {
            error: 'Failed to delete notification',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    clearAllNotifications: {
      description: CLEAR_ALL_NOTIFICATIONS_DESCRIPTION,
      inputSchema: ClearAllNotificationsInputSchema,
      execute: async (params: ClearAllNotificationsInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] clearAllNotifications called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('clearAllNotifications', actionMode)) {
          return {
            error: 'Notification actions are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // DESTRUCTIVE batch action - always requires confirmation
        return {
          requiresPermission: true,
          permissionType: 'destructive' as const,
          toolName: 'clearAllNotifications',
          toolCallId,
          arguments: params,
          description: 'Delete all READ notifications permanently. Unread notifications will be preserved.',
          warning: 'This will permanently remove all your read notifications. This cannot be undone.',
          _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
        };
      },
    },

    // =========================================================================
    // SETTINGS TOOLS
    // updateSettings requires confirmation, getSettings is autonomous
    // =========================================================================

    updateSettings: {
      description: UPDATE_SETTINGS_DESCRIPTION,
      inputSchema: UpdateSettingsInputSchema,
      execute: async (params: UpdateSettingsInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] updateSettings called with:`, truncateForLog(params));

        // Check if tool is allowed in current mode
        if (!isToolAllowed('updateSettings', actionMode)) {
          return {
            error: 'Settings updates are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // Check permission - return confirmation request if needed
        if (requiresConfirmation('updateSettings', actionMode)) {
          const settingKeys = Object.keys(params.settings);
          return {
            requiresPermission: true,
            permissionType: getToolPermission('updateSettings'),
            toolName: 'updateSettings',
            toolCallId,
            arguments: params,
            description: `Update settings: ${settingKeys.join(', ')}`,
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          // Convert settings to the format expected by updateUserProfile
          // Handle urgentDeadlineDays conversion to int64
          const convexSettings: Record<string, unknown> = { ...params.settings };
          if (typeof params.settings.urgentDeadlineDays === 'number') {
            convexSettings.urgentDeadlineDays = BigInt(params.settings.urgentDeadlineDays);
          }
          if (typeof params.settings.reminderDaysBefore === 'number') {
            convexSettings.reminderDaysBefore = BigInt(params.settings.reminderDaysBefore);
          }

          const result = await fetchMutation(
            api.users.updateUserProfile,
            convexSettings,
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] updateSettings result (${duration}ms):`, result);

          return {
            success: true,
            updatedSettings: Object.keys(params.settings),
            message: 'Settings updated successfully.',
          };
        } catch (error) {
          console.error(`[Chat API] updateSettings error:`, error);
          return {
            error: 'Failed to update settings',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    getSettings: {
      description: GET_SETTINGS_DESCRIPTION,
      inputSchema: GetSettingsInputSchema,
      execute: async (params: GetSettingsInput) => {
        const startTime = Date.now();
        console.log(`[Chat API] getSettings called with:`, truncateForLog(params));

        // getSettings is AUTONOMOUS - no permission check needed
        try {
          const profile = await fetchQuery(
            api.users.currentUserProfile,
            {},
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] getSettings result (${duration}ms):`, truncateForLog(profile));

          if (!profile) {
            return {
              error: 'User profile not found',
              suggestion: 'Please ensure you are logged in.',
            };
          }

          // Filter by category if specified
          const category = params.category ?? 'all';

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

          return {
            success: true,
            settings: profile,
          };
        } catch (error) {
          console.error(`[Chat API] getSettings error:`, error);
          return {
            error: 'Failed to get settings',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },

    // =========================================================================
    // PAGE CONTEXT TOOL (AUTONOMOUS - no confirmation needed)
    // Provides detailed information about what the user is currently viewing
    // =========================================================================

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
        console.log(`[Chat API] getPageContext called with:`, truncateForLog(params));

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

        // Case detail context
        if (pageContext.currentCaseId) {
          result.currentCaseId = pageContext.currentCaseId;
          result.hint = 'User is viewing a specific case. Use this ID for operations on "this case".';

          // Optionally fetch full case data
          if (params.includeVisibleCaseData) {
            try {
              const caseData = await fetchQuery(
                api.cases.get,
                { id: pageContext.currentCaseId as Id<'cases'> },
                { token }
              );
              result.currentCaseData = caseData;
            } catch (e) {
              console.error('[Chat API] Error fetching current case data:', e);
            }
          }
        }

        // Cases list context
        if (pageContext.visibleCaseIds && pageContext.visibleCaseIds.length > 0) {
          result.visibleCaseIds = pageContext.visibleCaseIds;
          result.visibleCaseCount = pageContext.visibleCaseIds.length;
          result.hint = `User sees ${pageContext.visibleCaseIds.length} cases on screen. Use these IDs for operations on "visible cases" or "these cases".`;
        }

        // Selected cases context
        if (pageContext.selectedCaseIds && pageContext.selectedCaseIds.length > 0) {
          result.selectedCaseIds = pageContext.selectedCaseIds;
          result.selectedCaseCount = pageContext.selectedCaseIds.length;
        }

        // Filter context
        if (pageContext.filters) {
          result.activeFilters = pageContext.filters;
        }

        // Pagination context
        if (pageContext.pagination) {
          result.pagination = pageContext.pagination;
        }

        return {
          success: true,
          pageContext: result,
        };
      },
    },

    // =========================================================================
    // BULK OPERATION TOOLS (DESTRUCTIVE - always require confirmation)
    // These tools modify multiple cases at once
    // =========================================================================

    bulkUpdateStatus: {
      description: BULK_UPDATE_STATUS_DESCRIPTION,
      inputSchema: BulkUpdateStatusInputSchema,
      execute: async (params: BulkUpdateStatusInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkUpdateStatus called with:`, truncateForLog(params));

        // Resolve case IDs from "all" or explicit list
        let caseIds: string[] = params.caseIds || [];
        if (params.all) {
          const queryParams: Record<string, unknown> = {};
          if (params.filterByStatus) queryParams.caseStatus = params.filterByStatus;
          const queryResult = await fetchQuery(api.chatCaseData.queryCases, queryParams, { token });
          if ('cases' in queryResult && Array.isArray(queryResult.cases)) {
            caseIds = queryResult.cases.map((c) => String((c as Record<string, unknown>)._id));
          }
        }

        if (caseIds.length === 0) {
          return { error: 'No cases to update', suggestion: 'Use all=true or provide caseIds' };
        }

        // Check if tool is allowed in current mode
        if (!isToolAllowed('bulkUpdateStatus', actionMode)) {
          return { error: 'Bulk operations are disabled', suggestion: 'Enable actions in settings.' };
        }

        // DESTRUCTIVE action - always requires confirmation
        if (requiresConfirmation('bulkUpdateStatus', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: 'destructive' as const,
            toolName: 'bulkUpdateStatus',
            toolCallId,
            arguments: { ...params, caseIds },
            description: `Update ${caseIds.length} cases to status "${params.status}"`,
            preview: { count: caseIds.length, status: params.status, filter: params.filterByStatus || 'all' },
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(api.cases.bulkUpdateStatus, {
            ids: caseIds.map(id => id as Id<'cases'>),
            status: params.status,
          }, { token });
          return { success: true, ...result, message: `Updated ${result.successCount} cases to "${params.status}"` };
        } catch (error) {
          console.error(`[Chat API] bulkUpdateStatus error:`, error);
          return { error: 'Failed to bulk update status', suggestion: error instanceof Error ? error.message : 'Please try again' };
        }
      },
    },

    bulkArchiveCases: {
      description: BULK_ARCHIVE_CASES_DESCRIPTION,
      inputSchema: BulkArchiveCasesInputSchema,
      execute: async (params: BulkArchiveCasesInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkArchiveCases called with:`, truncateForLog(params));

        // Resolve case IDs from "all" or explicit list
        let caseIds: string[] = params.caseIds || [];
        if (params.all) {
          const queryParams: Record<string, unknown> = {};
          if (params.filterByStatus) queryParams.caseStatus = params.filterByStatus;
          const queryResult = await fetchQuery(api.chatCaseData.queryCases, queryParams, { token });
          if ('cases' in queryResult && Array.isArray(queryResult.cases)) {
            caseIds = queryResult.cases.map((c) => String((c as Record<string, unknown>)._id));
          }
        }

        if (caseIds.length === 0) {
          return { error: 'No cases to archive', suggestion: 'Use all=true or provide caseIds' };
        }

        // Check if tool is allowed in current mode
        if (!isToolAllowed('bulkArchiveCases', actionMode)) {
          return { error: 'Bulk operations are disabled', suggestion: 'Enable actions in settings.' };
        }

        // DESTRUCTIVE action - always requires confirmation
        if (requiresConfirmation('bulkArchiveCases', actionMode)) {
          return {
            requiresPermission: true,
            permissionType: 'destructive' as const,
            toolName: 'bulkArchiveCases',
            toolCallId,
            arguments: { ...params, caseIds },
            description: `Archive ${caseIds.length} cases`,
            preview: { count: caseIds.length, filter: params.filterByStatus || 'all' },
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(api.cases.bulkRemove, {
            ids: caseIds.map(id => id as Id<'cases'>),
          }, { token });
          return { success: true, ...result, message: `Archived ${result.successCount} cases` };
        } catch (error) {
          console.error(`[Chat API] bulkArchiveCases error:`, error);
          return { error: 'Failed to bulk archive cases', suggestion: error instanceof Error ? error.message : 'Please try again' };
        }
      },
    },

    bulkDeleteCases: {
      description: BULK_DELETE_CASES_DESCRIPTION,
      inputSchema: BulkDeleteCasesInputSchema,
      execute: async (params: BulkDeleteCasesInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkDeleteCases called with:`, truncateForLog(params));

        // If all=true, fetch all case IDs first
        let caseIds: string[] = params.caseIds || [];
        if (params.all) {
          console.log(`[Chat API] bulkDeleteCases: all=true, fetching all case IDs`);
          const queryParams: Record<string, unknown> = { idsOnly: true };
          if (params.filterByStatus) {
            queryParams.caseStatus = params.filterByStatus;
          }
          const queryResult = await fetchQuery(api.chatCaseData.queryCases, queryParams, { token });
          if ('cases' in queryResult && Array.isArray(queryResult.cases)) {
            caseIds = queryResult.cases.map((c) => String((c as Record<string, unknown>)._id));
            console.log(`[Chat API] bulkDeleteCases: found ${caseIds.length} cases to delete`);
          }
        }

        if (caseIds.length === 0) {
          return { error: 'No cases to delete', suggestion: 'Use all=true or provide caseIds' };
        }

        // Check if tool is allowed in current mode
        if (!isToolAllowed('bulkDeleteCases', actionMode)) {
          console.log(`[Chat API] bulkDeleteCases blocked: actions disabled`);
          return {
            error: 'Bulk operations are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // HIGHLY DESTRUCTIVE action - ALWAYS requires confirmation
        console.log(`[Chat API] bulkDeleteCases requires permission (always destructive)`);
        return {
          requiresPermission: true,
          permissionType: 'destructive' as const,
          toolName: 'bulkDeleteCases',
          toolCallId,
          arguments: { ...params, caseIds },
          description: `PERMANENTLY delete ${caseIds.length} cases`,
          warning: 'This action cannot be undone! All case data will be permanently removed.',
          preview: {
            count: caseIds.length,
            filter: params.filterByStatus || 'all',
          },
          _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
        };
      },
    },

    bulkCalendarSync: {
      description: BULK_CALENDAR_SYNC_DESCRIPTION,
      inputSchema: BulkCalendarSyncInputSchema,
      execute: async (params: BulkCalendarSyncInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkCalendarSync called with:`, truncateForLog(params));

        // If all=true, fetch all case IDs first
        let caseIds: string[] = params.caseIds || [];
        if (params.all) {
          console.log(`[Chat API] bulkCalendarSync: all=true, fetching all case IDs`);
          const queryParams: Record<string, unknown> = { idsOnly: true };
          if (params.filterByStatus) {
            queryParams.caseStatus = params.filterByStatus;
          }
          const queryResult = await fetchQuery(api.chatCaseData.queryCases, queryParams, { token });
          if ('cases' in queryResult && Array.isArray(queryResult.cases)) {
            caseIds = queryResult.cases.map((c) => String((c as Record<string, unknown>)._id));
            console.log(`[Chat API] bulkCalendarSync: found ${caseIds.length} cases to sync`);
          }
        }

        if (caseIds.length === 0) {
          return { error: 'No cases to sync', suggestion: 'Use all=true or provide caseIds' };
        }

        // Check if tool is allowed in current mode
        if (!isToolAllowed('bulkCalendarSync', actionMode)) {
          console.log(`[Chat API] bulkCalendarSync blocked: actions disabled`);
          return {
            error: 'Bulk operations are disabled',
            suggestion: 'Actions are currently turned off. Enable actions in settings.',
          };
        }

        // DESTRUCTIVE action - always requires confirmation
        if (requiresConfirmation('bulkCalendarSync', actionMode)) {
          console.log(`[Chat API] bulkCalendarSync requires permission (mode: ${actionMode})`);
          return {
            requiresPermission: true,
            permissionType: 'destructive' as const,
            toolName: 'bulkCalendarSync',
            toolCallId,
            arguments: { ...params, caseIds },
            description: `${params.enabled ? 'Enable' : 'Disable'} calendar sync for ${caseIds.length} cases`,
            preview: {
              count: caseIds.length,
              enabled: params.enabled,
              filter: params.filterByStatus || 'all',
            },
            _ai_instruction: 'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.',
          };
        }

        try {
          const result = await fetchMutation(api.cases.bulkUpdateCalendarSync, {
            ids: caseIds.map(id => id as Id<'cases'>),
            calendarSyncEnabled: params.enabled,
          }, { token });

          return {
            success: true,
            ...result,
            message: `${params.enabled ? 'Enabled' : 'Disabled'} calendar sync for ${result.successCount} cases`,
          };
        } catch (error) {
          console.error(`[Chat API] bulkCalendarSync error:`, error);
          return {
            error: 'Failed to update calendar sync',
            suggestion: error instanceof Error ? error.message : 'Please try again',
          };
        }
      },
    },
  };

  console.log(`[Chat API] Tools created:`, Object.keys(toolsObj));
  return toolsObj;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Trigger async summarization check after successful response
 *
 * This function runs in the background (fire-and-forget) and does NOT block
 * the chat response. It checks if the conversation needs summarization and
 * triggers it if the threshold is exceeded.
 *
 * @param conversationId - The conversation to check
 * @param token - Auth token for Convex API calls
 * @param sessionId - Session ID for logging
 */
function triggerSummarizationCheck(
  conversationId: Id<"conversations">,
  token: string,
  sessionId: string
): void {
  // Run async check without awaiting (fire-and-forget)
  (async () => {
    try {
      const needsSummary = await checkNeedsSummarization(conversationId, token);

      if (needsSummary) {
        console.log(`[Chat API] [${sessionId}] Triggering async summarization`);
        // Run summarization in background - don't await
        summarizeConversation(conversationId, token).catch((error) => {
          console.error(`[Chat API] [${sessionId}] Summarization error:`, error);
        });
      }
    } catch (error) {
      console.error(`[Chat API] [${sessionId}] Failed to check summarization need:`, error);
    }
  })();
}

export async function POST(req: Request) {
  const sessionId = generateSessionId();
  console.log(`[Chat API] [${sessionId}] === New chat request ===`);

  try {
    // Verify authentication (chatbot is authenticated-only)
    const isAuthenticated = await isAuthenticatedNextjs();
    if (!isAuthenticated) {
      console.log(`[Chat API] [${sessionId}] Auth failed: not authenticated`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token for tool execution (needed for Convex API calls)
    const token = await convexAuthNextjsToken();
    if (!token) {
      console.error(`[Chat API] [${sessionId}] Failed to get auth token`);
      return new Response(
        JSON.stringify({ error: 'Authentication error' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const {
      messages,
      conversationId,
      pageContext,
    }: {
      messages: UIMessage[];
      conversationId?: string;
      pageContext?: {
        path?: string;
        pageType?: string;
        currentCaseId?: string;
        visibleCaseIds?: string[];
        filters?: Record<string, unknown>;
        pagination?: { page?: number; pageSize?: number; totalCount?: number };
        selectedCaseIds?: string[];
        [key: string]: unknown;
      };
    } = await req.json();
    const lastMessage = messages[messages.length - 1];
    // Log user message content (handle different UIMessage content types)
    const messageContent = lastMessage?.parts
      ? lastMessage.parts.filter((p): p is { type: 'text'; text: string } => (p as { type: string }).type === 'text').map(p => p.text).join(' ')
      : JSON.stringify(lastMessage);
    console.log(`[Chat API] [${sessionId}] User message:`, truncateForLog(messageContent));
    if (conversationId) {
      console.log(`[Chat API] [${sessionId}] Conversation ID: ${conversationId}`);
    }
    if (pageContext) {
      console.log(`[Chat API] [${sessionId}] Page context:`, truncateForLog(pageContext));
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get optimized context if conversationId is provided
    // This uses summary + recent messages instead of full history
    let convertedMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    let typedConversationId: Id<"conversations"> | null = null;

    if (conversationId) {
      typedConversationId = conversationId as Id<"conversations">;
      try {
        const contextData = await fetchQuery(
          api.conversationSummary.getContextMessages,
          { conversationId: typedConversationId },
          { token }
        );

        if (contextData.summary) {
          // Build optimized message array: summary as system context + recent messages
          console.log(`[Chat API] [${sessionId}] Using summarized context (${contextData.totalMessageCount} total messages)`);

          // Create messages with summary context
          const optimizedMessages: CoreMessage[] = [
            {
              role: "user" as const,
              content: `[Previous conversation context: ${contextData.summary}]`,
            },
            {
              role: "assistant" as const,
              content: "I understand the context from our previous conversation. How can I help you?",
            },
            ...contextData.recentMessages.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
          ];

          convertedMessages = optimizedMessages;
        } else {
          // No summary yet, use full message history
          console.log(`[Chat API] [${sessionId}] No summary available, using full history`);
          convertedMessages = await convertToModelMessages(messages);
        }
      } catch (error) {
        console.warn(`[Chat API] [${sessionId}] Failed to get context, using full history:`, error);
        convertedMessages = await convertToModelMessages(messages);
      }
    } else {
      // No conversationId provided, use messages as-is
      convertedMessages = await convertToModelMessages(messages);
    }

    // Create cache stats tracker for this request
    const cacheStats = createCacheStats();

    // Fetch user's action mode preference for permission checking
    // MUST be fetched before system prompt so AI knows its current capabilities
    let actionMode: ActionMode = 'confirm'; // Default to safest mode
    try {
      const userActionMode = await fetchQuery(
        api.users.getActionMode,
        {},
        { token }
      );
      actionMode = userActionMode as ActionMode;
      console.log(`[Chat API] [${sessionId}] Action mode: ${actionMode}`);
    } catch (error) {
      console.warn(`[Chat API] [${sessionId}] Failed to get action mode, using default (confirm):`, error);
    }

    // Build system prompt WITH action mode AND current date context
    // This tells the AI what mode it's in and what the current date is
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const systemPrompt = getSystemPrompt({
      actionMode,
      currentDate: `${currentDate} at ${currentTime}`,
      pageContext,
    });

    // Create tools for this request (pass pageContext for context-aware tools)
    const tools = createTools(token, typedConversationId, cacheStats, actionMode, pageContext);

    try {
      console.log(`[Chat API] [${sessionId}] Streaming with ${PRIMARY_MODEL_NAME} (auto-fallback enabled)`);

      // Single streamText call - ai-fallback handles all provider switching
      // including mid-stream error recovery with retryAfterOutput: true
      const result = streamText({
        model: chatModel,
        system: systemPrompt,
        messages: convertedMessages,
        tools,
        stopWhen: stepCountIs(5),
        maxOutputTokens: 4000, // Increased to prevent truncation
        maxRetries: 0, // ai-fallback handles retries internally
        onStepFinish: (event) => {
          console.log(`[Chat API] [${sessionId}] Step finished, reason: ${event.finishReason}`);

          // Log error details for debugging when model fails to process
          if (event.finishReason === 'error') {
            console.error(`[Chat API] [${sessionId}] Step error - model failed to generate response`);
            if ('usage' in event && event.usage) {
              const usage = event.usage as { inputTokens?: number; outputTokens?: number };
              if (usage.inputTokens && usage.inputTokens > 30000) {
                console.error(`[Chat API] [${sessionId}] Likely cause: input too large (${usage.inputTokens} tokens). Use idsOnly for bulk operations.`);
              }
            }
          }

          if ('toolCalls' in event && Array.isArray(event.toolCalls) && event.toolCalls.length > 0) {
            console.log(
              `[Chat API] [${sessionId}] Tool calls:`,
              event.toolCalls.map((tc: { toolName: string }) => ({ tool: tc.toolName }))
            );
          }
          if ('toolResults' in event && Array.isArray(event.toolResults) && event.toolResults.length > 0) {
            console.log(`[Chat API] [${sessionId}] Tool results: ${event.toolResults.length} result(s)`);
          }
          if ('usage' in event && event.usage) {
            const usage = event.usage as { inputTokens?: number; outputTokens?: number };
            console.log(`[Chat API] [${sessionId}] Usage: ${usage.inputTokens ?? 0} in, ${usage.outputTokens ?? 0} out`);
          }
        },
        onFinish: (event) => {
          // Log final stream completion for debugging
          if (event.finishReason === 'error' || event.finishReason === 'unknown') {
            console.error(`[Chat API] [${sessionId}] Stream finished with error/unknown: ${event.finishReason}`);
          } else {
            console.log(`[Chat API] [${sessionId}] Stream completed: ${event.finishReason}`);
          }
        },
      });

      // Trigger async summarization check after successful stream start
      // This runs in background and does NOT block the response
      if (typedConversationId) {
        triggerSummarizationCheck(typedConversationId, token, sessionId);
      }

      // Log cache stats for the session
      cacheStats.log(sessionId);

      return result.toUIMessageStreamResponse();
    } catch (error) {
      // All models failed (ai-fallback exhausted all options)
      console.error(`[Chat API] [${sessionId}] All models failed:`, error);
      return new Response(
        JSON.stringify({
          error: 'All AI providers are currently unavailable. Please try again later.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error(`[Chat API] [${sessionId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
