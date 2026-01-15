/**
 * Tool Permission System
 *
 * Defines permission levels for AI chatbot tools to control
 * which actions require user confirmation before execution.
 *
 * Permission Levels:
 * - autonomous: No confirmation needed, executes immediately
 * - confirm: Requires confirmation in CONFIRM mode, auto-executes in AUTO mode
 * - destructive: Always requires confirmation, even in AUTO mode
 *
 * @module tool-permissions
 */

import type { ChatToolName } from './tools';

/**
 * Permission level for a tool
 */
export type PermissionLevel = 'autonomous' | 'confirm' | 'destructive';

/**
 * Action mode for the chatbot
 * - off: Actions are disabled
 * - confirm: Confirm-level tools require user approval
 * - auto: Confirm-level tools execute automatically
 */
export type ActionMode = 'off' | 'confirm' | 'auto';

/**
 * Tool permission registry
 *
 * Maps tool names to their permission levels.
 * Default is 'confirm' for any tool not listed here.
 *
 * Uses ChatToolName for type safety - prevents typos in tool names.
 */
export const TOOL_PERMISSIONS: Partial<Record<ChatToolName, PermissionLevel>> = {
  // ==========================================================================
  // AUTONOMOUS - No confirmation needed
  // These tools only read data or perform non-destructive navigation
  // ==========================================================================

  // Data queries (read-only)
  queryCases: 'autonomous',
  searchKnowledge: 'autonomous',
  searchWeb: 'autonomous',

  // Navigation tools (non-destructive)
  navigate: 'autonomous',
  viewCase: 'autonomous',
  scrollTo: 'autonomous',
  refreshPage: 'autonomous',

  // ==========================================================================
  // CONFIRM - Ask in CONFIRM mode, auto in AUTO mode
  // These tools modify data but changes are reversible
  // ==========================================================================

  // Case CRUD operations (reversible)
  createCase: 'confirm',
  updateCase: 'confirm',
  archiveCase: 'confirm', // Closes case
  reopenCase: 'confirm',

  // Calendar tools (reversible)
  syncToCalendar: 'confirm',
  unsyncFromCalendar: 'confirm',

  // Notification tools (single item - reversible or low impact)
  markNotificationRead: 'confirm',
  deleteNotification: 'confirm',

  // Settings tools
  updateSettings: 'confirm', // Modifies user preferences
  getSettings: 'autonomous', // Read-only

  // ==========================================================================
  // DESTRUCTIVE - Always ask, even in AUTO mode
  // These tools cause irreversible changes
  // ==========================================================================

  // Permanent deletion
  deleteCase: 'destructive',

  // Bulk notification operations (irreversible batch actions)
  markAllNotificationsRead: 'destructive',
  clearAllNotifications: 'destructive',

  // Bulk case operations (DESTRUCTIVE - always require confirmation)
  bulkUpdateStatus: 'destructive',
  bulkArchiveCases: 'destructive',
  bulkDeleteCases: 'destructive',
  bulkCalendarSync: 'destructive',
};

/**
 * Get the permission level for a tool
 *
 * @param toolName - The name of the tool
 * @returns The permission level (defaults to 'confirm' if not found)
 */
export function getToolPermission(toolName: string): PermissionLevel {
  // Cast to ChatToolName for lookup, defaulting to 'confirm' for unknown tools
  return (TOOL_PERMISSIONS as Record<string, PermissionLevel>)[toolName] ?? 'confirm';
}

/**
 * Check if a tool requires user confirmation before execution
 *
 * @param toolName - The name of the tool
 * @param actionMode - Current action mode setting
 * @returns true if confirmation is required, false otherwise
 *
 * @example
 * // In CONFIRM mode
 * requiresConfirmation('queryCases', 'confirm'); // false (autonomous)
 * requiresConfirmation('createCase', 'confirm'); // true (confirm-level)
 * requiresConfirmation('deleteCase', 'confirm'); // true (destructive)
 *
 * @example
 * // In AUTO mode
 * requiresConfirmation('queryCases', 'auto'); // false (autonomous)
 * requiresConfirmation('createCase', 'auto'); // false (auto-executes)
 * requiresConfirmation('deleteCase', 'auto'); // true (always confirm)
 *
 * @example
 * // In OFF mode (actions disabled)
 * requiresConfirmation('queryCases', 'off'); // false (read-only allowed)
 * requiresConfirmation('createCase', 'off'); // true (blocked)
 */
export function requiresConfirmation(
  toolName: string,
  actionMode: ActionMode
): boolean {
  const permission = getToolPermission(toolName);

  // Autonomous tools never require confirmation
  if (permission === 'autonomous') {
    return false;
  }

  // Destructive tools always require confirmation
  if (permission === 'destructive') {
    return true;
  }

  // Confirm-level tools:
  // - In AUTO mode: no confirmation needed
  // - In CONFIRM mode: confirmation required
  // - In OFF mode: confirmation required (will be blocked)
  if (actionMode === 'auto') {
    return false;
  }

  return true;
}

/**
 * Check if a tool is allowed to execute based on action mode
 *
 * This is different from requiresConfirmation - this checks if the
 * tool can be executed at all in the current mode.
 *
 * @param toolName - The name of the tool
 * @param actionMode - Current action mode setting
 * @returns true if the tool can be executed, false if blocked
 */
export function isToolAllowed(
  toolName: string,
  actionMode: ActionMode
): boolean {
  const permission = getToolPermission(toolName);

  // Autonomous tools are always allowed (they're read-only/navigation)
  if (permission === 'autonomous') {
    return true;
  }

  // In OFF mode, only autonomous tools are allowed
  if (actionMode === 'off') {
    return false;
  }

  // In CONFIRM or AUTO mode, all tools are allowed (with appropriate confirmation)
  return true;
}

/**
 * Get a human-readable description of why confirmation is needed
 *
 * @param toolName - The name of the tool
 * @returns Description string for UI display
 */
export function getConfirmationReason(toolName: string): string {
  const permission = getToolPermission(toolName);

  switch (permission) {
    case 'destructive':
      return 'This action cannot be undone.';
    case 'confirm':
      return 'This action will modify your data.';
    case 'autonomous':
    default:
      return '';
  }
}
