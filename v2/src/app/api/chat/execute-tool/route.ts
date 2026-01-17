/**
 * Execute Tool API Route
 *
 * Executes a tool after user confirmation.
 * This endpoint is called by useToolConfirmations hook after user approves a tool action.
 *
 * POST /api/chat/execute-tool
 * Body: { toolCallId: string, toolName: string, arguments: Record<string, unknown> }
 * Returns: Tool execution result
 */

import { NextResponse } from 'next/server';
import { isAuthenticatedNextjs, convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';

// ============================================================================
// Helper: Fetch case details for accurate confirmation messages
// ============================================================================

interface CaseDetails {
  employerName: string;
  foreignWorkerId: string;
  positionTitle: string;
}

async function getCaseDetails(caseId: Id<'cases'>, token: string): Promise<CaseDetails> {
  const caseData = await fetchQuery(
    api.cases.get,
    { id: caseId },
    { token }
  );
  return {
    employerName: caseData?.employerName ?? 'Unknown',
    foreignWorkerId: caseData?.beneficiaryIdentifier ?? '',
    positionTitle: caseData?.positionTitle ?? 'Unknown',
  };
}

// ============================================================================
// Types
// ============================================================================

interface ExecuteToolRequest {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

// Type-safe case status values
type CaseStatus = 'pwd' | 'recruitment' | 'eta9089' | 'i140' | 'closed';
type ProgressStatus = 'working' | 'waiting_intake' | 'filed' | 'approved' | 'under_review' | 'rfi_rfe';
type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
type I140Category = 'EB-1' | 'EB-2' | 'EB-3';

// ============================================================================
// Tool Execution Functions
// ============================================================================

type ToolExecutor = (
  args: Record<string, unknown>,
  token: string
) => Promise<Record<string, unknown>>;

/**
 * Map of tool names to their execution functions.
 * These are the tools that can be executed after user confirmation.
 */
const toolExecutors: Record<string, ToolExecutor> = {
  // Case CRUD operations
  createCase: async (args, token) => {
    // Map foreignWorkerId to beneficiaryIdentifier (database field name)
    const foreignWorkerId = (args.foreignWorkerId as string | undefined) ?? '';
    const result = await fetchMutation(
      api.cases.create,
      {
        employerName: args.employerName as string,
        beneficiaryIdentifier: foreignWorkerId,
        positionTitle: args.positionTitle as string,
        caseStatus: args.caseStatus as CaseStatus | undefined,
        progressStatus: args.progressStatus as ProgressStatus | undefined,
        priorityLevel: args.priorityLevel as PriorityLevel | undefined,
        isProfessionalOccupation: args.isProfessionalOccupation as boolean | undefined,
        isFavorite: args.isFavorite as boolean | undefined,
        calendarSyncEnabled: args.calendarSyncEnabled as boolean | undefined,
        pwdFilingDate: args.pwdFilingDate as string | undefined,
        pwdDeterminationDate: args.pwdDeterminationDate as string | undefined,
        pwdExpirationDate: args.pwdExpirationDate as string | undefined,
        pwdCaseNumber: args.pwdCaseNumber as string | undefined,
        pwdWageLevel: args.pwdWageLevel as string | undefined,
        jobOrderStartDate: args.jobOrderStartDate as string | undefined,
        jobOrderEndDate: args.jobOrderEndDate as string | undefined,
        sundayAdFirstDate: args.sundayAdFirstDate as string | undefined,
        sundayAdSecondDate: args.sundayAdSecondDate as string | undefined,
        sundayAdNewspaper: args.sundayAdNewspaper as string | undefined,
        noticeOfFilingStartDate: args.noticeOfFilingStartDate as string | undefined,
        noticeOfFilingEndDate: args.noticeOfFilingEndDate as string | undefined,
        additionalRecruitmentMethods: args.additionalRecruitmentMethods as
          | { method: string; date: string; description?: string }[]
          | undefined,
        eta9089FilingDate: args.eta9089FilingDate as string | undefined,
        eta9089CertificationDate: args.eta9089CertificationDate as string | undefined,
        eta9089CaseNumber: args.eta9089CaseNumber as string | undefined,
        i140FilingDate: args.i140FilingDate as string | undefined,
        i140ReceiptNumber: args.i140ReceiptNumber as string | undefined,
        i140Category: args.i140Category as I140Category | undefined,
        i140PremiumProcessing: args.i140PremiumProcessing as boolean | undefined,
        internalCaseNumber: args.internalCaseNumber as string | undefined,
        employerFein: args.employerFein as string | undefined,
        socCode: args.socCode as string | undefined,
        socTitle: args.socTitle as string | undefined,
        jobOrderState: args.jobOrderState as string | undefined,
      },
      { token }
    );
    return {
      success: true,
      caseId: result,
      employerName: args.employerName as string,
      foreignWorkerId,
      positionTitle: args.positionTitle as string,
      action: 'case_created',
      message: foreignWorkerId
        ? `Created new case "${args.employerName} - ${foreignWorkerId} (${args.positionTitle})".`
        : `Created new case "${args.employerName} (${args.positionTitle})".`,
    };
  },

  updateCase: async (args, token) => {
    const { caseId, foreignWorkerId, ...otherFields } = args;

    // Fetch case details first for accurate confirmation message
    const caseDetails = await getCaseDetails(caseId as Id<'cases'>, token);

    // Map foreignWorkerId to beneficiaryIdentifier (database field name)
    const updateFields = {
      ...otherFields,
      ...(foreignWorkerId !== undefined ? { beneficiaryIdentifier: foreignWorkerId as string } : {}),
    };

    const result = await fetchMutation(
      api.cases.update,
      {
        id: caseId as Id<'cases'>,
        ...updateFields,
      },
      { token }
    );

    // For display purposes, show foreignWorkerId instead of beneficiaryIdentifier
    const displayFields = { ...updateFields };
    if ('beneficiaryIdentifier' in displayFields) {
      delete displayFields.beneficiaryIdentifier;
      (displayFields as Record<string, unknown>).foreignWorkerId = foreignWorkerId;
    }

    const updatedFieldNames = Object.keys(displayFields).join(', ');
    const fieldCount = Object.keys(displayFields).length;
    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: result,
      ...caseDetails,
      updates: displayFields,
      action: 'case_updated',
      message: `Updated ${fieldCount} field${fieldCount !== 1 ? 's' : ''} (${updatedFieldNames}) for case "${caseLabel}".`,
    };
  },

  archiveCase: async (args, token) => {
    // Fetch case details before archiving for accurate confirmation message
    const caseDetails = await getCaseDetails(args.caseId as Id<'cases'>, token);

    // archiveCase uses the remove mutation (hard delete with cascade cleanup)
    await fetchMutation(
      api.cases.remove,
      { id: args.caseId as Id<'cases'> },
      { token }
    );

    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: args.caseId,
      ...caseDetails,
      action: 'archived',
      message: `Archived case "${caseLabel} (${caseDetails.positionTitle})".`,
    };
  },

  reopenCase: async (args, token) => {
    // Fetch case details for accurate confirmation message
    const caseDetails = await getCaseDetails(args.caseId as Id<'cases'>, token);

    await fetchMutation(
      api.cases.reopenCase,
      { id: args.caseId as Id<'cases'> },
      { token }
    );

    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: args.caseId,
      ...caseDetails,
      action: 'reopened',
      message: `Reopened case "${caseLabel} (${caseDetails.positionTitle})".`,
    };
  },

  deleteCase: async (args, token) => {
    // Fetch case details before deleting for accurate confirmation message
    const caseDetails = await getCaseDetails(args.caseId as Id<'cases'>, token);

    // deleteCase uses the remove mutation (hard delete with cascade cleanup)
    await fetchMutation(
      api.cases.remove,
      { id: args.caseId as Id<'cases'> },
      { token }
    );

    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: args.caseId,
      ...caseDetails,
      action: 'permanently_deleted',
      message: `PERMANENTLY DELETED case "${caseLabel} (${caseDetails.positionTitle})". This action cannot be undone.`,
    };
  },

  // Calendar sync tools
  syncToCalendar: async (args, token) => {
    // Fetch case details for accurate confirmation message
    const caseDetails = await getCaseDetails(args.caseId as Id<'cases'>, token);

    await fetchMutation(
      api.cases.toggleCalendarSync,
      { id: args.caseId as Id<'cases'> },
      { token }
    );

    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: args.caseId,
      ...caseDetails,
      enabled: true,
      action: 'calendar_sync_enabled',
      message: `Enabled calendar sync for case "${caseLabel}". Deadlines will now appear in your calendar.`,
    };
  },

  unsyncFromCalendar: async (args, token) => {
    // Fetch case details for accurate confirmation message
    const caseDetails = await getCaseDetails(args.caseId as Id<'cases'>, token);

    await fetchMutation(
      api.cases.toggleCalendarSync,
      { id: args.caseId as Id<'cases'> },
      { token }
    );

    const caseLabel = caseDetails.foreignWorkerId
      ? `${caseDetails.employerName} - ${caseDetails.foreignWorkerId}`
      : caseDetails.employerName;
    return {
      success: true,
      caseId: args.caseId,
      ...caseDetails,
      enabled: false,
      action: 'calendar_sync_disabled',
      message: `Disabled calendar sync for case "${caseLabel}". Deadlines removed from calendar.`,
    };
  },

  // Notification tools
  markNotificationRead: async (args, token) => {
    await fetchMutation(
      api.notifications.markAsRead,
      { notificationId: args.notificationId as Id<'notifications'> },
      { token }
    );
    return {
      success: true,
      notificationId: args.notificationId,
      action: 'notification_marked_read',
      message: 'Marked 1 notification as read.',
    };
  },

  markAllNotificationsRead: async (_args, token) => {
    const result = await fetchMutation(api.notifications.markAllAsRead, {}, { token });
    const count = result.count;
    return {
      success: true,
      count,
      action: 'all_notifications_marked_read',
      message: `Marked all ${count} notification${count !== 1 ? 's' : ''} as read.`,
    };
  },

  deleteNotification: async (args, token) => {
    await fetchMutation(
      api.notifications.deleteNotification,
      { notificationId: args.notificationId as Id<'notifications'> },
      { token }
    );
    return {
      success: true,
      notificationId: args.notificationId,
      action: 'notification_deleted',
      message: 'Deleted 1 notification.',
    };
  },

  clearAllNotifications: async (_args, token) => {
    const result = await fetchMutation(api.notifications.deleteAllRead, {}, { token });
    const count = result.count;
    return {
      success: true,
      count,
      action: 'all_read_notifications_cleared',
      message: `Cleared ${count} read notification${count !== 1 ? 's' : ''}.`,
    };
  },

  // Settings tools - uses updateUserProfile
  updateSettings: async (args, token) => {
    const settings = args.settings as Record<string, unknown>;
    await fetchMutation(
      api.users.updateUserProfile,
      settings,
      { token }
    );
    const settingNames = Object.keys(settings).join(', ');
    const count = Object.keys(settings).length;
    return {
      success: true,
      settings,
      updatedCount: count,
      action: 'settings_updated',
      message: `Updated ${count} setting${count !== 1 ? 's' : ''}: ${settingNames}.`,
    };
  },

  // Bulk operations
  bulkUpdateStatus: async (args, token) => {
    const caseIds = args.caseIds as string[];
    const status = args.status as CaseStatus;

    const result = await fetchMutation(
      api.cases.bulkUpdateStatus,
      {
        ids: caseIds as Id<'cases'>[],
        status,
      },
      { token }
    );

    return {
      success: true,
      successCount: result.successCount,
      totalCount: caseIds.length,
      status,
      action: 'bulk_status_updated',
      message: `Updated status to "${status}" for ${result.successCount} of ${caseIds.length} case${caseIds.length !== 1 ? 's' : ''}.`,
    };
  },

  bulkArchiveCases: async (args, token) => {
    const caseIds = args.caseIds as string[];

    const result = await fetchMutation(
      api.cases.bulkRemove,
      { ids: caseIds as Id<'cases'>[] },
      { token }
    );

    return {
      success: true,
      successCount: result.successCount,
      totalCount: caseIds.length,
      action: 'bulk_archived',
      message: `Archived ${result.successCount} of ${caseIds.length} case${caseIds.length !== 1 ? 's' : ''}.`,
    };
  },

  bulkDeleteCases: async (args, token) => {
    const caseIds = args.caseIds as string[];

    const result = await fetchMutation(
      api.cases.bulkRemove,
      { ids: caseIds as Id<'cases'>[] },
      { token }
    );

    return {
      success: true,
      successCount: result.successCount,
      totalCount: caseIds.length,
      action: 'bulk_permanently_deleted',
      message: `PERMANENTLY DELETED ${result.successCount} of ${caseIds.length} case${caseIds.length !== 1 ? 's' : ''}. This action cannot be undone.`,
    };
  },

  bulkCalendarSync: async (args, token) => {
    const caseIds = args.caseIds as string[];
    const enabled = args.enabled as boolean;

    const result = await fetchMutation(
      api.cases.bulkUpdateCalendarSync,
      {
        ids: caseIds as Id<'cases'>[],
        calendarSyncEnabled: enabled,
      },
      { token }
    );

    return {
      success: true,
      successCount: result.successCount,
      totalCount: caseIds.length,
      enabled,
      action: enabled ? 'bulk_calendar_sync_enabled' : 'bulk_calendar_sync_disabled',
      message: `${enabled ? 'Enabled' : 'Disabled'} calendar sync for ${result.successCount} of ${caseIds.length} case${caseIds.length !== 1 ? 's' : ''}.`,
    };
  },
};

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const isAuthenticated = await isAuthenticatedNextjs();
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'No auth token' }, { status: 401 });
    }

    // 2. Parse request body
    const body = (await request.json()) as ExecuteToolRequest;
    const { toolCallId, toolName, arguments: args } = body;

    console.log(`[Execute Tool] ${toolName} (${toolCallId}):`, JSON.stringify(args).slice(0, 200));

    // 3. Find executor
    const executor = toolExecutors[toolName];
    if (!executor) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    // 4. Execute tool
    const result = await executor(args, token);

    const duration = Date.now() - startTime;
    console.log(`[Execute Tool] ${toolName} completed in ${duration}ms`);

    return NextResponse.json({
      ...result,
      toolCallId,
      toolName,
      executedAt: Date.now(),
      duration,
    });
  } catch (error) {
    console.error('[Execute Tool] Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Execution failed',
        suggestion: 'Please try again or contact support if the issue persists.',
      },
      { status: 500 }
    );
  }
}
