/**
 * Tool Icons and Color Configuration
 *
 * Centralized mapping of tool names to their icons and colors.
 * Used by ToolCallCard for consistent visual representation.
 *
 * Design System: Neobrutalist (PERM Tracker v2)
 * - Icons from lucide-react
 * - Colors follow semantic meaning
 */

import {
  Database,
  BookOpen,
  Globe,
  Pencil,
  Trash2,
  Calendar,
  CalendarPlus,
  CalendarMinus,
  Search,
  FileText,
  RefreshCw,
  Navigation2,
  Eye,
  ArrowDown,
  Plus,
  Archive,
  RotateCcw,
  Check,
  CheckCheck,
  Bell,
  BellOff,
  Settings,
  SlidersHorizontal,
  CalendarSync,
  type LucideIcon,
} from 'lucide-react';

/**
 * Tool name to icon mapping
 * Keys match AI SDK tool names from lib/ai/tools.ts
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  // Read-only tools (current)
  queryCases: Database,
  searchKnowledge: BookOpen,
  searchWeb: Globe,

  // Case CRUD tools
  createCase: Plus,
  updateCase: Pencil,
  archiveCase: Archive,
  reopenCase: RotateCcw,
  deleteCase: Trash2,

  // Other action tools
  syncCalendar: Calendar,
  searchCases: Search,
  generateDocument: FileText,
  refreshData: RefreshCw,

  // Navigation tools
  navigate: Navigation2,
  viewCase: Eye,
  scrollTo: ArrowDown,
  refreshPage: RefreshCw,

  // Calendar sync tools
  syncToCalendar: CalendarPlus,
  unsyncFromCalendar: CalendarMinus,

  // Notification tools
  markNotificationRead: Check,
  markAllNotificationsRead: CheckCheck,
  deleteNotification: Bell,
  clearAllNotifications: BellOff,

  // Settings tools
  updateSettings: Settings,
  getSettings: SlidersHorizontal,

  // Bulk operation tools
  bulkUpdateStatus: RefreshCw,
  bulkArchiveCases: Archive,
  bulkDeleteCases: Trash2,
  bulkCalendarSync: CalendarSync,
} as const;

/**
 * Tool name to color class mapping
 * Colors indicate tool type/category:
 * - Blue: Data queries (database operations)
 * - Purple: Knowledge/documentation
 * - Emerald: External/web
 * - Amber: Modification (future)
 * - Red: Destructive (future)
 * - Teal: Sync operations (future)
 */
export const TOOL_COLORS: Record<string, string> = {
  // Read-only tools
  queryCases: 'text-blue-600 dark:text-blue-400',
  searchKnowledge: 'text-purple-600 dark:text-purple-400',
  searchWeb: 'text-emerald-600 dark:text-emerald-400',

  // Case CRUD tools
  createCase: 'text-green-600 dark:text-green-400',
  updateCase: 'text-amber-600 dark:text-amber-400',
  archiveCase: 'text-slate-600 dark:text-slate-400',
  reopenCase: 'text-blue-600 dark:text-blue-400',
  deleteCase: 'text-red-600 dark:text-red-400',

  // Other action tools
  syncCalendar: 'text-teal-600 dark:text-teal-400',
  searchCases: 'text-blue-600 dark:text-blue-400',
  generateDocument: 'text-indigo-600 dark:text-indigo-400',
  refreshData: 'text-cyan-600 dark:text-cyan-400',

  // Navigation tools (slate/neutral for non-data actions)
  navigate: 'text-slate-600 dark:text-slate-400',
  viewCase: 'text-blue-600 dark:text-blue-400',
  scrollTo: 'text-slate-500 dark:text-slate-400',
  refreshPage: 'text-slate-500 dark:text-slate-400',

  // Calendar sync tools
  syncToCalendar: 'text-teal-600 dark:text-teal-400',
  unsyncFromCalendar: 'text-orange-600 dark:text-orange-400',

  // Notification tools
  markNotificationRead: 'text-green-600 dark:text-green-400',
  markAllNotificationsRead: 'text-green-600 dark:text-green-400',
  deleteNotification: 'text-red-600 dark:text-red-400',
  clearAllNotifications: 'text-red-600 dark:text-red-400',

  // Settings tools
  updateSettings: 'text-violet-600 dark:text-violet-400',
  getSettings: 'text-violet-600 dark:text-violet-400',

  // Bulk operation tools (amber/red for destructive)
  bulkUpdateStatus: 'text-amber-600 dark:text-amber-400',
  bulkArchiveCases: 'text-slate-600 dark:text-slate-400',
  bulkDeleteCases: 'text-red-600 dark:text-red-400',
  bulkCalendarSync: 'text-teal-600 dark:text-teal-400',
} as const;

/**
 * Tool name to background color class (for status indicators)
 */
export const TOOL_BG_COLORS: Record<string, string> = {
  // Read-only tools
  queryCases: 'bg-blue-50 dark:bg-blue-950/30',
  searchKnowledge: 'bg-purple-50 dark:bg-purple-950/30',
  searchWeb: 'bg-emerald-50 dark:bg-emerald-950/30',

  // Case CRUD tools
  createCase: 'bg-green-50 dark:bg-green-950/30',
  updateCase: 'bg-amber-50 dark:bg-amber-950/30',
  archiveCase: 'bg-slate-50 dark:bg-slate-950/30',
  reopenCase: 'bg-blue-50 dark:bg-blue-950/30',
  deleteCase: 'bg-red-50 dark:bg-red-950/30',

  // Other action tools
  syncCalendar: 'bg-teal-50 dark:bg-teal-950/30',

  // Navigation tools
  navigate: 'bg-slate-50 dark:bg-slate-900/30',
  viewCase: 'bg-blue-50 dark:bg-blue-950/30',
  scrollTo: 'bg-slate-50 dark:bg-slate-900/30',
  refreshPage: 'bg-slate-50 dark:bg-slate-900/30',

  // Calendar sync tools
  syncToCalendar: 'bg-teal-50 dark:bg-teal-950/30',
  unsyncFromCalendar: 'bg-orange-50 dark:bg-orange-950/30',

  // Notification tools
  markNotificationRead: 'bg-green-50 dark:bg-green-950/30',
  markAllNotificationsRead: 'bg-green-50 dark:bg-green-950/30',
  deleteNotification: 'bg-red-50 dark:bg-red-950/30',
  clearAllNotifications: 'bg-red-50 dark:bg-red-950/30',

  // Settings tools
  updateSettings: 'bg-violet-50 dark:bg-violet-950/30',
  getSettings: 'bg-violet-50 dark:bg-violet-950/30',

  // Bulk operation tools
  bulkUpdateStatus: 'bg-amber-50 dark:bg-amber-950/30',
  bulkArchiveCases: 'bg-slate-50 dark:bg-slate-950/30',
  bulkDeleteCases: 'bg-red-50 dark:bg-red-950/30',
  bulkCalendarSync: 'bg-teal-50 dark:bg-teal-950/30',
} as const;

/**
 * Human-readable tool display names
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Read-only tools
  queryCases: 'Query Cases',
  searchKnowledge: 'Search Knowledge',
  searchWeb: 'Web Search',

  // Case CRUD tools
  createCase: 'Create Case',
  updateCase: 'Update Case',
  archiveCase: 'Archive Case',
  reopenCase: 'Reopen Case',
  deleteCase: 'Delete Case',

  // Other action tools
  syncCalendar: 'Sync Calendar',
  searchCases: 'Search Cases',
  generateDocument: 'Generate Document',
  refreshData: 'Refresh Data',

  // Navigation tools
  navigate: 'Navigate',
  viewCase: 'View Case',
  scrollTo: 'Scroll To',
  refreshPage: 'Refresh Page',

  // Calendar sync tools
  syncToCalendar: 'Sync to Calendar',
  unsyncFromCalendar: 'Remove from Calendar',

  // Notification tools
  markNotificationRead: 'Mark as Read',
  markAllNotificationsRead: 'Mark All Read',
  deleteNotification: 'Delete Notification',
  clearAllNotifications: 'Clear Notifications',

  // Settings tools
  updateSettings: 'Update Settings',
  getSettings: 'Get Settings',

  // Bulk operation tools
  bulkUpdateStatus: 'Bulk Update Status',
  bulkArchiveCases: 'Bulk Archive Cases',
  bulkDeleteCases: 'Bulk Delete Cases',
  bulkCalendarSync: 'Bulk Calendar Sync',
} as const;

/**
 * Tool loading messages (shown during pending state)
 */
export const TOOL_LOADING_MESSAGES: Record<string, string> = {
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
} as const;

/**
 * Get icon for a tool, with fallback
 */
export function getToolIcon(tool: string): LucideIcon {
  return TOOL_ICONS[tool] ?? Search;
}

/**
 * Get color class for a tool, with fallback
 */
export function getToolColor(tool: string): string {
  return TOOL_COLORS[tool] ?? 'text-gray-600 dark:text-gray-400';
}

/**
 * Get background color class for a tool, with fallback
 */
export function getToolBgColor(tool: string): string {
  return TOOL_BG_COLORS[tool] ?? 'bg-gray-50 dark:bg-gray-950/30';
}

/**
 * Get display name for a tool, with fallback
 */
export function getToolDisplayName(tool: string): string {
  return TOOL_DISPLAY_NAMES[tool] ?? formatToolName(tool);
}

/**
 * Get loading message for a tool, with fallback
 */
export function getToolLoadingMessage(tool: string): string {
  return TOOL_LOADING_MESSAGES[tool] ?? 'Processing...';
}

/**
 * Format a tool name to human-readable form (fallback)
 * e.g., "queryCases" -> "Query Cases"
 */
function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
