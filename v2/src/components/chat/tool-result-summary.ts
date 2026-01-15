/**
 * Tool Result Summary Utilities
 *
 * Functions to generate brief, human-readable summaries from tool results.
 * Used by ToolCallCard to display compact result information.
 *
 * Design Philosophy:
 * - Keep summaries SHORT (under 40 chars ideally)
 * - Use counts and key info only
 * - Handle errors gracefully
 * - Detect permission requests and show appropriate status
 */

import { isPermissionRequest } from '@/lib/ai/tool-confirmation-types';

/**
 * Tool call structure from AI SDK
 */
export interface ToolCall {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
}

/**
 * Summarize tool result into a brief string
 * @param tool - Tool name
 * @param result - JSON string of tool output
 * @returns Human-readable summary
 */
export function summarizeToolResult(tool: string, result?: string): string {
  if (!result) return '';

  try {
    const parsed = JSON.parse(result);

    // CRITICAL: Check for permission request FIRST
    // This prevents showing "Created: case" when the tool is awaiting confirmation
    if (isPermissionRequest(parsed)) {
      return 'Awaiting confirmation...';
    }

    switch (tool) {
      case 'queryCases': {
        const count = parsed.count ?? parsed.cases?.length ?? 0;
        return `${count} case${count !== 1 ? 's' : ''} found`;
      }

      case 'searchKnowledge': {
        const sourceCount = parsed.sources?.length ?? 0;
        if (sourceCount === 0) return 'No matches found';
        return `${sourceCount} source${sourceCount !== 1 ? 's' : ''} found`;
      }

      case 'searchWeb': {
        const resultCount = parsed.results?.length ?? 0;
        if (resultCount === 0) return 'No results found';
        return `${resultCount} result${resultCount !== 1 ? 's' : ''} found`;
      }

      case 'createCase': {
        if (parsed.error) return 'Creation failed';
        return `Created: ${parsed.employerName || 'case'}`;
      }

      case 'updateCase': {
        if (parsed.error) return 'Update failed';
        if (parsed.success === false) return 'Update failed';
        const fields = Object.keys(parsed.updates || {}).length;
        if (fields > 0) {
          return `Updated ${fields} field${fields !== 1 ? 's' : ''}`;
        }
        return 'Case updated';
      }

      case 'archiveCase':
        return parsed.success ? 'Case archived' : 'Archive failed';

      case 'reopenCase':
        return parsed.success ? 'Case reopened' : 'Reopen failed';

      case 'deleteCase':
        return parsed.success ? 'Case deleted' : 'Delete failed';

      case 'syncCalendar': {
        const synced = parsed.syncedCount ?? 0;
        return `${synced} event${synced !== 1 ? 's' : ''} synced`;
      }

      // Navigation tools
      case 'navigate':
        return `Navigated to ${parsed.path || 'page'}`;
      case 'viewCase':
        return 'Opened case';
      case 'scrollTo':
        return `Scrolled to ${parsed.target || 'section'}`;
      case 'refreshPage':
        return 'Page refreshed';

      // Calendar sync tools
      case 'syncToCalendar':
        return parsed.success ? 'Synced to calendar' : 'Sync failed';
      case 'unsyncFromCalendar':
        return parsed.success ? 'Removed from calendar' : 'Remove failed';

      // Notification tools
      case 'markNotificationRead':
        return parsed.success ? 'Marked as read' : 'Mark failed';
      case 'markAllNotificationsRead': {
        const count = parsed.count ?? parsed.markedCount ?? 0;
        return parsed.success !== false
          ? `Marked ${count} as read`
          : 'Mark all failed';
      }
      case 'deleteNotification':
        return parsed.success ? 'Deleted notification' : 'Delete failed';
      case 'clearAllNotifications': {
        const count = parsed.count ?? parsed.deletedCount ?? 0;
        return parsed.success !== false
          ? `Cleared ${count} notification${count !== 1 ? 's' : ''}`
          : 'Clear failed';
      }

      // Settings tools
      case 'updateSettings': {
        const count = parsed.updatedCount ?? Object.keys(parsed.settings || {}).length ?? 0;
        return parsed.success !== false
          ? `Updated ${count} setting${count !== 1 ? 's' : ''}`
          : 'Update failed';
      }
      case 'getSettings':
        return parsed.category
          ? `Retrieved ${parsed.category} settings`
          : 'Retrieved settings';

      // Bulk operation tools
      case 'bulkUpdateStatus': {
        const r = parsed as { successCount?: number; status?: string };
        return `Updated ${r.successCount || 0} cases to "${r.status || 'new status'}"`;
      }
      case 'bulkArchiveCases': {
        const r = parsed as { successCount?: number };
        return `Deleted ${r.successCount || 0} cases`;
      }
      case 'bulkDeleteCases': {
        const r = parsed as { successCount?: number };
        return `Permanently deleted ${r.successCount || 0} cases`;
      }
      case 'bulkCalendarSync': {
        const r = parsed as { successCount?: number; enabled?: boolean };
        return `${r.enabled ? 'Synced' : 'Unsynced'} ${r.successCount || 0} cases`;
      }

      default:
        // Generic handling for unknown tools
        if (typeof parsed === 'object') {
          if ('count' in parsed) return `${parsed.count} items`;
          if ('success' in parsed) return parsed.success ? 'Completed' : 'Failed';
          if ('message' in parsed) return truncate(String(parsed.message), 40);
        }
        return 'Completed';
    }
  } catch {
    // If result is not valid JSON, return truncated string
    return truncate(result, 40);
  }
}

/**
 * Summarize tool arguments into compact key-value pairs
 * @param tool - Tool name
 * @param args - JSON string of tool arguments
 * @returns Array of key-value pairs for display (max 3)
 */
export function summarizeToolArgs(
  tool: string,
  args: string
): Array<{ key: string; value: string }> {
  try {
    const parsed = JSON.parse(args);
    const entries: Array<{ key: string; value: string }> = [];

    // Tool-specific argument prioritization
    const priorityKeys = getToolPriorityKeys(tool);

    // First, add priority keys if they exist
    for (const key of priorityKeys) {
      if (key in parsed && parsed[key] !== undefined && parsed[key] !== null) {
        entries.push({
          key: formatArgKey(key),
          value: formatArgValue(parsed[key]),
        });
      }
    }

    // Then add remaining keys (up to max 3 total)
    for (const [key, value] of Object.entries(parsed)) {
      if (entries.length >= 3) break;
      if (priorityKeys.includes(key)) continue; // Already added
      if (value === undefined || value === null) continue;
      if (key === 'countOnly' && value === false) continue; // Skip default values

      entries.push({
        key: formatArgKey(key),
        value: formatArgValue(value),
      });
    }

    return entries.slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Get priority keys for each tool type
 * These are the most important args to show first
 */
function getToolPriorityKeys(tool: string): string[] {
  switch (tool) {
    case 'queryCases':
      return ['caseStatus', 'progressStatus', 'hasOverdueDeadline', 'searchText'];
    case 'searchKnowledge':
      return ['query'];
    case 'searchWeb':
      return ['query'];
    case 'createCase':
      return ['employerName', 'positionTitle', 'beneficiaryIdentifier'];
    case 'updateCase':
      return ['caseId', 'updates'];
    case 'archiveCase':
      return ['caseId', 'reason'];
    case 'reopenCase':
      return ['caseId', 'reason'];
    case 'deleteCase':
      return ['caseId'];
    case 'syncCalendar':
      return ['caseIds'];
    // Navigation tools
    case 'navigate':
      return ['path', 'reason'];
    case 'viewCase':
      return ['caseId', 'section'];
    case 'scrollTo':
      return ['target'];
    case 'refreshPage':
      return ['reason'];
    // Calendar sync tools
    case 'syncToCalendar':
      return ['caseId'];
    case 'unsyncFromCalendar':
      return ['caseId'];
    // Notification tools
    case 'markNotificationRead':
      return ['notificationId'];
    case 'markAllNotificationsRead':
      return ['confirm'];
    case 'deleteNotification':
      return ['notificationId'];
    case 'clearAllNotifications':
      return ['confirm'];
    // Settings tools
    case 'updateSettings':
      return ['settings'];
    case 'getSettings':
      return ['category'];
    // Bulk operation tools
    case 'bulkUpdateStatus':
      return ['caseIds', 'status'];
    case 'bulkArchiveCases':
      return ['caseIds'];
    case 'bulkDeleteCases':
      return ['caseIds'];
    case 'bulkCalendarSync':
      return ['caseIds', 'enabled'];
    default:
      return [];
  }
}

/**
 * Format argument key for display
 * e.g., "caseStatus" -> "status", "hasOverdueDeadline" -> "overdue"
 */
function formatArgKey(key: string): string {
  const keyMap: Record<string, string> = {
    caseStatus: 'status',
    progressStatus: 'progress',
    hasOverdueDeadline: 'overdue',
    deadlineWithinDays: 'within',
    hasRfi: 'RFI',
    hasRfe: 'RFE',
    searchText: 'search',
    isProfessionalOccupation: 'professional',
    countOnly: 'count only',
    returnAllFields: 'all fields',
    query: 'query',
    // Navigation tools
    path: 'page',
    target: 'target',
    section: 'section',
  };

  return keyMap[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

/**
 * Format argument value for display
 * Handles booleans, arrays, objects, and long strings
 */
function formatArgValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    if (value.length <= 2) return value.join(', ');
    return `${value.length} items`;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value).slice(0, 20) + '...';
  }

  const str = String(value);
  return truncate(str, 25);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Calculate execution duration in human-readable format
 * @param startTime - Start timestamp (ms)
 * @param endTime - End timestamp (ms)
 * @returns Duration string (e.g., "234ms", "1.2s")
 */
export function formatDuration(startTime?: number, endTime?: number): string {
  if (!startTime || !endTime) return '';

  const durationMs = endTime - startTime;

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * Get status-specific result message
 * @param status - Tool call status
 * @param tool - Tool name
 * @param result - Tool result (optional)
 * @returns Status message
 */
export function getStatusMessage(
  status: 'pending' | 'success' | 'error',
  tool: string,
  result?: string
): string {
  switch (status) {
    case 'pending':
      return getToolLoadingMessage(tool);
    case 'success':
      return summarizeToolResult(tool, result);
    case 'error':
      return getErrorMessage(result);
  }
}

/**
 * Get loading message for tool
 */
function getToolLoadingMessage(tool: string): string {
  const messages: Record<string, string> = {
    // Read-only tools
    queryCases: 'Searching cases...',
    searchKnowledge: 'Searching knowledge base...',
    searchWeb: 'Searching the web...',
    // Case CRUD tools
    createCase: 'Creating case...',
    updateCase: 'Updating case...',
    archiveCase: 'Archiving case...',
    reopenCase: 'Reopening case...',
    deleteCase: 'Deleting case...',
    // Other action tools
    syncCalendar: 'Syncing calendar...',
    // Navigation tools
    navigate: 'Navigating...',
    viewCase: 'Opening case...',
    scrollTo: 'Scrolling...',
    refreshPage: 'Refreshing...',
    // Calendar sync tools
    syncToCalendar: 'Syncing to calendar...',
    unsyncFromCalendar: 'Removing from calendar...',
    // Notification tools
    markNotificationRead: 'Marking as read...',
    markAllNotificationsRead: 'Marking all as read...',
    deleteNotification: 'Deleting notification...',
    clearAllNotifications: 'Clearing notifications...',
    // Settings tools
    updateSettings: 'Updating settings...',
    getSettings: 'Retrieving settings...',
    // Bulk operation tools
    bulkUpdateStatus: 'Updating case statuses...',
    bulkArchiveCases: 'Archiving cases...',
    bulkDeleteCases: 'Deleting cases...',
    bulkCalendarSync: 'Updating calendar sync...',
  };
  return messages[tool] ?? 'Processing...';
}

/**
 * Extract error message from result
 */
function getErrorMessage(result?: string): string {
  if (!result) return 'An error occurred';

  try {
    const parsed = JSON.parse(result);
    // Check if this was a user denial (persisted as error status with denied marker)
    if (parsed.denied === true) return 'Action denied by user';
    if (parsed.error) return truncate(String(parsed.error), 50);
    if (parsed.message) return truncate(String(parsed.message), 50);
  } catch {
    // Not JSON, use as-is
  }

  return truncate(result, 50);
}

/**
 * Check if a tool result indicates user denial
 * Used by UI components to style denied tools differently from errors
 */
export function isToolDenied(result?: string): boolean {
  if (!result) return false;
  try {
    const parsed = JSON.parse(result);
    return parsed.denied === true;
  } catch {
    return false;
  }
}
