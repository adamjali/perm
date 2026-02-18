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
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
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
  type ListJobDescriptionTemplatesInput,
  type CreateJobDescriptionTemplateInput,
  type UpdateJobDescriptionTemplateInput,
  type DeleteJobDescriptionTemplateInput,
  createCaseTool,
  updateCaseTool,
  archiveCaseTool,
  reopenCaseTool,
  deleteCaseTool,
} from '@/lib/ai/tools';
import type { ActionMode } from '@/lib/ai/tool-permissions';
import { executeWithCache, createCacheStats, type CacheableToolName } from '@/lib/ai/cache';
import { captureError } from '@/lib/sentry';
import {
  buildConfirmationResponse,
  buildToolError,
  checkToolAllowed,
  checkNeedsConfirmation,
  resolveBulkCaseIds,
} from '@/lib/ai/tool-helpers';

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
Use for: showing case details after finding a case via queryCases, viewing case timeline, editing a case.
Parameters: caseId (required), section (optional: overview, timeline, edit).`;

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

const CLEAR_ALL_NOTIFICATIONS_DESCRIPTION = `Delete all READ notifications permanently. Batch operation.
Use for: cleaning up notification history, clearing old notifications.
Parameters: none.`;

const UPDATE_SETTINGS_DESCRIPTION = `Update user settings and preferences.
Use for: changing notification settings, calendar settings, UI preferences.
Parameters: settings object with fields to change.`;

const GET_SETTINGS_DESCRIPTION = `Get current user settings and preferences.
Use for: checking current settings before suggesting changes.
Parameters: category (optional: all, notifications, calendar, preferences).`;

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

const LIST_JOB_DESC_TEMPLATES_DESCRIPTION = `List the user's job description templates.
Use for: showing templates, finding template by name, suggesting templates.
Parameters: searchQuery (optional, filter by name).`;

const CREATE_JOB_DESC_TEMPLATE_DESCRIPTION = `Create a new job description template.
Use for: saving a job description for reuse, creating template from position title.
Parameters: name (position title), description (job description text).`;

const UPDATE_JOB_DESC_TEMPLATE_DESCRIPTION = `Update an existing job description template.
Use for: modifying template name or description.
Parameters: templateId, name (optional), description (optional).`;

const DELETE_JOB_DESC_TEMPLATE_DESCRIPTION = `Delete a job description template (soft delete).
DESTRUCTIVE: Requires confirmation.
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
  console.log(`[Chat API] Creating tools with actionMode: ${actionMode}`);

  const toolsObj = {
    // =========================================================================
    // READ-ONLY TOOLS (AUTONOMOUS)
    // =========================================================================

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
                const result = await fetchQuery(api.chatCaseData.queryCases, params, { token });
                return sanitizeBigInts(result);
              } catch (error) {
                console.error(`[Chat API] queryCases error:`, {
                  error,
                  errorMessage: error instanceof Error ? error.message : String(error),
                  errorType: error instanceof Error ? error.constructor.name : typeof error,
                  params: truncateForLog(params),
                });
                captureError(error);
                return {
                  error: 'Failed to query cases',
                  suggestion: 'Please try again or rephrase your question about cases.',
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
        console.log(`[Chat API] searchKnowledge called with:`, truncateForLog(params));

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
              console.error(`[Chat API] searchKnowledge error:`, {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                params: truncateForLog(params),
              });
              captureError(error);
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
          contextLength: typedResult?.context?.length || 0,
          sourcesCount: typedResult?.sources?.length || 0,
        };
        console.log(`[Chat API] searchKnowledge result (${duration}ms):`, preview);
        console.log(`[Chat API] searchKnowledge context preview:`, truncateForLog(typedResult?.context || ''));
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
              const result = await fetchAction(api.webSearch.searchWeb, params, { token });
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
        console.log(`[Chat API] searchWeb result (${duration}ms):`, preview);
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

        if (pageContext.currentCaseId) {
          result.currentCaseId = pageContext.currentCaseId;
          result.hint = 'User is viewing a specific case. Use this ID for operations on "this case".';

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
        console.log(`[Chat API] navigate called with:`, truncateForLog(params));
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
        console.log(`[Chat API] viewCase called with:`, truncateForLog(params));
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
        console.log(`[Chat API] scrollTo called with:`, truncateForLog(params));
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
        console.log(`[Chat API] refreshPage called with:`, truncateForLog(params));
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

    createCase: {
      description: createCaseTool.description,
      inputSchema: CreateCaseInputSchema,
      execute: async (params: CreateCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] createCase called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('createCase', actionMode, 'Case creation is disabled', 'create cases');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('createCase', actionMode, toolCallId, params,
          `Create a new PERM case for ${params.employerName} - ${params.foreignWorkerId || 'TBD'} (${params.positionTitle})`);
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(
            api.cases.create,
            {
              employerName: params.employerName,
              beneficiaryIdentifier: params.foreignWorkerId,
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
            foreignWorkerId: params.foreignWorkerId,
            positionTitle: params.positionTitle,
            message: `Created case for ${params.foreignWorkerId || params.positionTitle} at ${params.employerName}`,
          };
        } catch (error) {
          captureError(error);
          return buildToolError('createCase', error);
        }
      },
    },

    updateCase: {
      description: updateCaseTool.description,
      inputSchema: UpdateCaseInputSchema,
      execute: async (params: UpdateCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] updateCase called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('updateCase', actionMode, 'Case updates are disabled', 'update cases');
        if (disabled) return disabled;

        const updateFieldNames = Object.keys(params).filter(k => k !== 'caseId' && params[k as keyof UpdateCaseInput] !== undefined);
        const confirm = checkNeedsConfirmation('updateCase', actionMode, toolCallId, params,
          `Update case ${params.caseId}: changing ${updateFieldNames.join(', ')}`);
        if (confirm) return confirm;

        try {
          const { caseId, ...updateFields } = params;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const convexFields: Record<string, any> = { ...updateFields };

          if (typeof updateFields.pwdWageAmount === 'number') {
            convexFields.pwdWageAmount = BigInt(updateFields.pwdWageAmount);
          }
          if (typeof updateFields.recruitmentApplicantsCount === 'number') {
            convexFields.recruitmentApplicantsCount = BigInt(updateFields.recruitmentApplicantsCount);
          }
          if (updateFields.documents) {
            convexFields.documents = updateFields.documents.map(doc => ({
              ...doc,
              size: typeof doc.size === 'number' ? BigInt(doc.size) : doc.size,
            }));
          }

          const result = await fetchMutation(
            api.cases.update,
            { id: caseId as Id<'cases'>, ...convexFields },
            { token }
          );

          const duration = Date.now() - startTime;
          console.log(`[Chat API] updateCase result (${duration}ms):`, truncateForLog(result));

          const fieldSummary = updateFieldNames.length <= 3
            ? updateFieldNames.join(', ')
            : `${updateFieldNames.slice(0, 3).join(', ')} and ${updateFieldNames.length - 3} more`;

          return {
            success: true,
            caseId: result,
            message: `Case updated successfully (${fieldSummary})`,
            updatedFields: updateFieldNames,
          };
        } catch (error) {
          captureError(error);
          const errorMessage = error instanceof Error ? error.message : 'Please try again';
          if (errorMessage.includes('Validation failed')) {
            return {
              error: 'Validation failed',
              validationErrors: errorMessage,
              suggestion: 'Check the date values and ensure they follow PERM regulations. For example: RFI due date must be exactly 30 days after received date.',
            };
          }
          return buildToolError('updateCase', error);
        }
      },
    },

    archiveCase: {
      description: archiveCaseTool.description,
      inputSchema: ArchiveCaseInputSchema,
      execute: async (params: ArchiveCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] archiveCase called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('archiveCase', actionMode, 'Case archiving is disabled', 'archive cases');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('archiveCase', actionMode, toolCallId, params,
          `Close case ${params.caseId}${params.reason ? ` (${params.reason})` : ''}. Can be reopened later.`);
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(
            api.cases.update,
            { id: params.caseId as Id<'cases'>, caseStatus: 'closed' },
            { token }
          );
          const duration = Date.now() - startTime;
          console.log(`[Chat API] archiveCase result (${duration}ms):`, truncateForLog(result));
          return { success: true, caseId: result, message: 'Case closed successfully. Can be reopened with reopenCase if needed.' };
        } catch (error) {
          captureError(error);
          return buildToolError('archiveCase', error);
        }
      },
    },

    reopenCase: {
      description: reopenCaseTool.description,
      inputSchema: ReopenCaseInputSchema,
      execute: async (params: ReopenCaseInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] reopenCase called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('reopenCase', actionMode, 'Case reopening is disabled', 'reopen cases');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('reopenCase', actionMode, toolCallId, params,
          `Reopen closed case ${params.caseId}`);
        if (confirm) return confirm;

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
          captureError(error);
          return buildToolError('reopenCase', error);
        }
      },
    },

    deleteCase: {
      description: deleteCaseTool.description,
      inputSchema: DeleteCaseInputSchema,
      execute: async (params: DeleteCaseInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] deleteCase called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('deleteCase', actionMode, 'Case deletion is disabled', 'delete cases');
        if (disabled) return disabled;

        // DESTRUCTIVE — always requires confirmation
        return buildConfirmationResponse('deleteCase', toolCallId, params,
          `PERMANENTLY DELETE case ${params.caseId}. This action CANNOT be undone!`,
          {
            permissionType: 'destructive',
            warning: 'This will permanently remove the case and all associated data. Consider using archiveCase instead if you might need this data later.',
          });
      },
    },

    // =========================================================================
    // CALENDAR TOOLS (CONFIRM tier)
    // =========================================================================

    syncToCalendar: {
      description: SYNC_TO_CALENDAR_DESCRIPTION,
      inputSchema: SyncToCalendarInputSchema,
      execute: async (params: SyncToCalendarInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] syncToCalendar called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('syncToCalendar', actionMode, 'Calendar sync is disabled', 'sync cases to calendar');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('syncToCalendar', actionMode, toolCallId, params,
          `Enable Google Calendar sync for case ${params.caseId}`);
        if (confirm) return confirm;

        try {
          await fetchMutation(api.cases.enableCalendarSync, { id: params.caseId as Id<'cases'> }, { token });
          const duration = Date.now() - startTime;
          console.log(`[Chat API] syncToCalendar result (${duration}ms): enabled`);
          return {
            success: true,
            caseId: params.caseId,
            calendarSyncEnabled: true,
            message: 'Calendar sync enabled. Case deadlines will appear in your Google Calendar.',
          };
        } catch (error) {
          captureError(error);
          return buildToolError('syncToCalendar', error);
        }
      },
    },

    unsyncFromCalendar: {
      description: UNSYNC_FROM_CALENDAR_DESCRIPTION,
      inputSchema: UnsyncFromCalendarInputSchema,
      execute: async (params: UnsyncFromCalendarInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] unsyncFromCalendar called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('unsyncFromCalendar', actionMode, 'Calendar unsync is disabled', 'unsync cases from calendar');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('unsyncFromCalendar', actionMode, toolCallId, params,
          `Disable Google Calendar sync for case ${params.caseId}`);
        if (confirm) return confirm;

        try {
          await fetchMutation(api.cases.disableCalendarSync, { id: params.caseId as Id<'cases'> }, { token });
          const duration = Date.now() - startTime;
          console.log(`[Chat API] unsyncFromCalendar result (${duration}ms): disabled`);
          return {
            success: true,
            caseId: params.caseId,
            calendarSyncEnabled: false,
            message: 'Calendar sync disabled. Case deadlines removed from your Google Calendar.',
          };
        } catch (error) {
          captureError(error);
          return buildToolError('unsyncFromCalendar', error);
        }
      },
    },

    // =========================================================================
    // NOTIFICATION TOOLS (mixed tiers)
    // =========================================================================

    markNotificationRead: {
      description: MARK_NOTIFICATION_READ_DESCRIPTION,
      inputSchema: MarkNotificationReadInputSchema,
      execute: async (params: MarkNotificationReadInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] markNotificationRead called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('markNotificationRead', actionMode, 'Notification actions are disabled');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('markNotificationRead', actionMode, toolCallId, params,
          `Mark notification ${params.notificationId} as read`);
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(
            api.notifications.markAsRead,
            { notificationId: params.notificationId as Id<'notifications'> },
            { token }
          );
          const duration = Date.now() - startTime;
          console.log(`[Chat API] markNotificationRead result (${duration}ms):`, result);
          return { success: true, notificationId: params.notificationId, message: 'Notification marked as read.' };
        } catch (error) {
          captureError(error);
          return buildToolError('markNotificationRead', error);
        }
      },
    },

    markAllNotificationsRead: {
      description: MARK_ALL_NOTIFICATIONS_READ_DESCRIPTION,
      inputSchema: MarkAllNotificationsReadInputSchema,
      execute: async (params: MarkAllNotificationsReadInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] markAllNotificationsRead called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('markAllNotificationsRead', actionMode, 'Notification actions are disabled');
        if (disabled) return disabled;

        // DESTRUCTIVE — always requires confirmation
        return buildConfirmationResponse('markAllNotificationsRead', toolCallId, params,
          'Mark ALL notifications as read. This affects all your unread notifications.',
          { permissionType: 'destructive' });
      },
    },

    deleteNotification: {
      description: DELETE_NOTIFICATION_DESCRIPTION,
      inputSchema: DeleteNotificationInputSchema,
      execute: async (params: DeleteNotificationInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] deleteNotification called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('deleteNotification', actionMode, 'Notification actions are disabled');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('deleteNotification', actionMode, toolCallId, params,
          `Delete notification ${params.notificationId} permanently`);
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(
            api.notifications.deleteNotification,
            { notificationId: params.notificationId as Id<'notifications'> },
            { token }
          );
          const duration = Date.now() - startTime;
          console.log(`[Chat API] deleteNotification result (${duration}ms):`, result);
          return { success: true, notificationId: params.notificationId, message: 'Notification deleted.' };
        } catch (error) {
          captureError(error);
          return buildToolError('deleteNotification', error);
        }
      },
    },

    clearAllNotifications: {
      description: CLEAR_ALL_NOTIFICATIONS_DESCRIPTION,
      inputSchema: ClearAllNotificationsInputSchema,
      execute: async (params: ClearAllNotificationsInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] clearAllNotifications called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('clearAllNotifications', actionMode, 'Notification actions are disabled');
        if (disabled) return disabled;

        // DESTRUCTIVE — always requires confirmation
        return buildConfirmationResponse('clearAllNotifications', toolCallId, params,
          'Delete all READ notifications permanently. Unread notifications will be preserved.',
          {
            permissionType: 'destructive',
            warning: 'This will permanently remove all your read notifications. This cannot be undone.',
          });
      },
    },

    // =========================================================================
    // SETTINGS TOOLS
    // =========================================================================

    updateSettings: {
      description: UPDATE_SETTINGS_DESCRIPTION,
      inputSchema: UpdateSettingsInputSchema,
      execute: async (params: UpdateSettingsInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] updateSettings called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('updateSettings', actionMode, 'Settings updates are disabled');
        if (disabled) return disabled;

        const settingKeys = Object.keys(params.settings);
        const confirm = checkNeedsConfirmation('updateSettings', actionMode, toolCallId, params,
          `Update settings: ${settingKeys.join(', ')}`);
        if (confirm) return confirm;

        try {
          const convexSettings: Record<string, unknown> = { ...params.settings };
          if (typeof params.settings.urgentDeadlineDays === 'number') {
            convexSettings.urgentDeadlineDays = BigInt(params.settings.urgentDeadlineDays);
          }
          if (typeof params.settings.reminderDaysBefore === 'number') {
            convexSettings.reminderDaysBefore = BigInt(params.settings.reminderDaysBefore);
          }

          const result = await fetchMutation(api.users.updateUserProfile, convexSettings, { token });
          const duration = Date.now() - startTime;
          console.log(`[Chat API] updateSettings result (${duration}ms):`, result);
          return { success: true, updatedSettings: settingKeys, message: 'Settings updated successfully.' };
        } catch (error) {
          captureError(error);
          return buildToolError('updateSettings', error);
        }
      },
    },

    getSettings: {
      description: GET_SETTINGS_DESCRIPTION,
      inputSchema: GetSettingsInputSchema,
      execute: async (params: GetSettingsInput) => {
        const startTime = Date.now();
        console.log(`[Chat API] getSettings called with:`, truncateForLog(params));

        try {
          const profile = await fetchQuery(api.users.currentUserProfile, {}, { token });
          const duration = Date.now() - startTime;
          console.log(`[Chat API] getSettings result (${duration}ms):`, truncateForLog(profile));

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

    bulkUpdateStatus: {
      description: BULK_UPDATE_STATUS_DESCRIPTION,
      inputSchema: BulkUpdateStatusInputSchema,
      execute: async (params: BulkUpdateStatusInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkUpdateStatus called with:`, truncateForLog(params));

        const caseIds = await resolveBulkCaseIds(params, token, { toolName: 'bulkUpdateStatus' });
        if (caseIds.length === 0) {
          return { error: 'No cases to update', suggestion: 'Use all=true or provide caseIds' };
        }

        const disabled = checkToolAllowed('bulkUpdateStatus', actionMode, 'Bulk operations are disabled');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('bulkUpdateStatus', actionMode, toolCallId, { ...params, caseIds },
          `Update ${caseIds.length} cases to status "${params.status}"`,
          { permissionType: 'destructive', preview: { count: caseIds.length, status: params.status, filter: params.filterByStatus || 'all' } });
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(api.cases.bulkUpdateStatus, {
            ids: caseIds.map(id => id as Id<'cases'>),
            status: params.status,
          }, { token });
          return { success: true, ...result, message: `Updated ${result.successCount} cases to "${params.status}"` };
        } catch (error) {
          captureError(error);
          return buildToolError('bulkUpdateStatus', error);
        }
      },
    },

    bulkArchiveCases: {
      description: BULK_ARCHIVE_CASES_DESCRIPTION,
      inputSchema: BulkArchiveCasesInputSchema,
      execute: async (params: BulkArchiveCasesInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkArchiveCases called with:`, truncateForLog(params));

        const caseIds = await resolveBulkCaseIds(params, token, { toolName: 'bulkArchiveCases' });
        if (caseIds.length === 0) {
          return { error: 'No cases to archive', suggestion: 'Use all=true or provide caseIds' };
        }

        const disabled = checkToolAllowed('bulkArchiveCases', actionMode, 'Bulk operations are disabled');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('bulkArchiveCases', actionMode, toolCallId, { ...params, caseIds },
          `Archive ${caseIds.length} cases`,
          { permissionType: 'destructive', preview: { count: caseIds.length, filter: params.filterByStatus || 'all' } });
        if (confirm) return confirm;

        try {
          const result = await fetchMutation(api.cases.bulkRemove, {
            ids: caseIds.map(id => id as Id<'cases'>),
          }, { token });
          return { success: true, ...result, message: `Archived ${result.successCount} cases` };
        } catch (error) {
          captureError(error);
          return buildToolError('bulkArchiveCases', error);
        }
      },
    },

    bulkDeleteCases: {
      description: BULK_DELETE_CASES_DESCRIPTION,
      inputSchema: BulkDeleteCasesInputSchema,
      execute: async (params: BulkDeleteCasesInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkDeleteCases called with:`, truncateForLog(params));

        const caseIds = await resolveBulkCaseIds(params, token, { idsOnly: true, toolName: 'bulkDeleteCases' });
        if (caseIds.length === 0) {
          return { error: 'No cases to delete', suggestion: 'Use all=true or provide caseIds' };
        }

        const disabled = checkToolAllowed('bulkDeleteCases', actionMode, 'Bulk operations are disabled');
        if (disabled) return disabled;

        // HIGHLY DESTRUCTIVE — always requires confirmation
        return buildConfirmationResponse('bulkDeleteCases', toolCallId, { ...params, caseIds },
          `PERMANENTLY delete ${caseIds.length} cases`,
          {
            permissionType: 'destructive',
            warning: 'This action cannot be undone! All case data will be permanently removed.',
            preview: { count: caseIds.length, filter: params.filterByStatus || 'all' },
          });
      },
    },

    bulkCalendarSync: {
      description: BULK_CALENDAR_SYNC_DESCRIPTION,
      inputSchema: BulkCalendarSyncInputSchema,
      execute: async (params: BulkCalendarSyncInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] bulkCalendarSync called with:`, truncateForLog(params));

        const caseIds = await resolveBulkCaseIds(params, token, { idsOnly: true, toolName: 'bulkCalendarSync' });
        if (caseIds.length === 0) {
          return { error: 'No cases to sync', suggestion: 'Use all=true or provide caseIds' };
        }

        const disabled = checkToolAllowed('bulkCalendarSync', actionMode, 'Bulk operations are disabled');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('bulkCalendarSync', actionMode, toolCallId, { ...params, caseIds },
          `${params.enabled ? 'Enable' : 'Disable'} calendar sync for ${caseIds.length} cases`,
          { permissionType: 'destructive', preview: { count: caseIds.length, enabled: params.enabled, filter: params.filterByStatus || 'all' } });
        if (confirm) return confirm;

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
          captureError(error);
          return buildToolError('bulkCalendarSync', error);
        }
      },
    },

    // =========================================================================
    // JOB DESCRIPTION TEMPLATE TOOLS
    // =========================================================================

    listJobDescriptionTemplates: {
      description: LIST_JOB_DESC_TEMPLATES_DESCRIPTION,
      inputSchema: ListJobDescriptionTemplatesInputSchema,
      execute: async (params: ListJobDescriptionTemplatesInput) => {
        const startTime = Date.now();
        console.log(`[Chat API] listJobDescriptionTemplates called with:`, truncateForLog(params));

        try {
          const templates = params.searchQuery
            ? await fetchQuery(api.jobDescriptionTemplates.searchByName, { query: params.searchQuery }, { token })
            : await fetchQuery(api.jobDescriptionTemplates.list, {}, { token });

          const duration = Date.now() - startTime;
          console.log(`[Chat API] listJobDescriptionTemplates result (${duration}ms): ${templates.length} templates`);
          return { success: true, templates: sanitizeBigInts(templates), count: templates.length };
        } catch (error) {
          captureError(error);
          return buildToolError('listJobDescriptionTemplates', error);
        }
      },
    },

    createJobDescriptionTemplate: {
      description: CREATE_JOB_DESC_TEMPLATE_DESCRIPTION,
      inputSchema: CreateJobDescriptionTemplateInputSchema,
      execute: async (params: CreateJobDescriptionTemplateInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] createJobDescriptionTemplate called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('createJobDescriptionTemplate', actionMode, 'Template creation is disabled', 'create templates');
        if (disabled) return disabled;

        const confirm = checkNeedsConfirmation('createJobDescriptionTemplate', actionMode, toolCallId, params,
          `Create job description template "${params.name}"`);
        if (confirm) return confirm;

        try {
          const templateId = await fetchMutation(
            api.jobDescriptionTemplates.create,
            { name: params.name, description: params.description },
            { token }
          );
          const duration = Date.now() - startTime;
          console.log(`[Chat API] createJobDescriptionTemplate result (${duration}ms):`, templateId);
          return { success: true, templateId, name: params.name, message: `Created job description template "${params.name}"` };
        } catch (error) {
          captureError(error);
          return buildToolError('createJobDescriptionTemplate', error);
        }
      },
    },

    updateJobDescriptionTemplate: {
      description: UPDATE_JOB_DESC_TEMPLATE_DESCRIPTION,
      inputSchema: UpdateJobDescriptionTemplateInputSchema,
      execute: async (params: UpdateJobDescriptionTemplateInput, { toolCallId }: ToolExecutionOptions) => {
        const startTime = Date.now();
        console.log(`[Chat API] updateJobDescriptionTemplate called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('updateJobDescriptionTemplate', actionMode, 'Template updates are disabled', 'update templates');
        if (disabled) return disabled;

        if (!params.name && !params.description) {
          return { error: 'Nothing to update', suggestion: 'Provide at least one of: name, description' };
        }

        const updateFields = [];
        if (params.name) updateFields.push('name');
        if (params.description) updateFields.push('description');
        const confirm = checkNeedsConfirmation('updateJobDescriptionTemplate', actionMode, toolCallId, params,
          `Update job description template: changing ${updateFields.join(', ')}`);
        if (confirm) return confirm;

        try {
          const existing = await fetchQuery(
            api.jobDescriptionTemplates.get,
            { id: params.templateId as Id<'jobDescriptionTemplates'> },
            { token }
          );

          if (!existing) {
            return { error: 'Template not found', suggestion: 'Use listJobDescriptionTemplates to find the correct template ID.' };
          }

          const templateId = await fetchMutation(
            api.jobDescriptionTemplates.update,
            {
              id: params.templateId as Id<'jobDescriptionTemplates'>,
              name: params.name || existing.name,
              description: params.description || existing.description,
            },
            { token }
          );
          const duration = Date.now() - startTime;
          console.log(`[Chat API] updateJobDescriptionTemplate result (${duration}ms):`, templateId);
          return { success: true, templateId, message: 'Updated job description template' };
        } catch (error) {
          captureError(error);
          return buildToolError('updateJobDescriptionTemplate', error);
        }
      },
    },

    deleteJobDescriptionTemplate: {
      description: DELETE_JOB_DESC_TEMPLATE_DESCRIPTION,
      inputSchema: DeleteJobDescriptionTemplateInputSchema,
      execute: async (params: DeleteJobDescriptionTemplateInput, { toolCallId }: ToolExecutionOptions) => {
        console.log(`[Chat API] deleteJobDescriptionTemplate called with:`, truncateForLog(params));

        const disabled = checkToolAllowed('deleteJobDescriptionTemplate', actionMode, 'Template deletion is disabled', 'delete templates');
        if (disabled) return disabled;

        // Requires confirmation (soft delete but still destructive)
        return buildConfirmationResponse('deleteJobDescriptionTemplate', toolCallId, params,
          'Delete job description template',
          {
            permissionType: 'confirm',
            warning: 'This will remove the template. It will no longer be available for use.',
          });
      },
    },
  };

  console.log(`[Chat API] Tools created:`, Object.keys(toolsObj));
  return toolsObj;
}
