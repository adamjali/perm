/**
 * Tool Icons and Color Configuration
 *
 * Centralized mapping of tool names to their icons and colors.
 * Used by ToolCallCard for consistent visual representation.
 *
 * Design: the site's calm look
 * - Icons from @phosphor-icons/react
 * - Colors follow semantic meaning
 */

import { ArchiveIcon, BuildingsIcon, HourglassMediumIcon, ListNumbersIcon, TagIcon, ArrowCounterClockwiseIcon as RotateCcw, ArrowDownIcon, ArrowsClockwiseIcon as CalendarSync, ArrowsClockwiseIcon as RefreshCw, BellIcon, BellSlashIcon as BellOff, BookOpenIcon, CalendarIcon, CalendarMinusIcon, CalendarPlusIcon, CheckIcon, ChecksIcon as CheckCheck, DatabaseIcon, EyeIcon, FileTextIcon, GearIcon as Settings, GlobeIcon, MagnifyingGlassIcon as Search, NavigationArrowIcon as Navigation2, PencilIcon, PlusIcon, SlidersHorizontalIcon, TrashIcon as Trash2 } from "@phosphor-icons/react/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Tool name to icon mapping
 * Keys match AI SDK tool names from lib/ai/tools.ts
 */
export const TOOL_ICONS: Record<string, PhosphorIcon> = {
  // Read-only tools (current)
  queryCases: DatabaseIcon,
  searchKnowledge: BookOpenIcon,
  searchWeb: GlobeIcon,

  // Public records
  lookupDolCase: Search,
  estimateDecision: HourglassMediumIcon,
  dolQueue: ListNumbersIcon,
  visaBulletin: CalendarIcon,
  searchSponsors: Search,
  sponsorProfile: BuildingsIcon,
  findSocCode: TagIcon,

  // Case CRUD tools
  createCase: PlusIcon,
  updateCase: PencilIcon,
  archiveCase: ArchiveIcon,
  reopenCase: RotateCcw,
  deleteCase: Trash2,

  // Other action tools
  syncCalendar: CalendarIcon,
  searchCases: Search,
  generateDocument: FileTextIcon,
  refreshData: RefreshCw,

  // Navigation tools
  navigate: Navigation2,
  viewCase: EyeIcon,
  scrollTo: ArrowDownIcon,
  refreshPage: RefreshCw,

  // Calendar sync tools
  syncToCalendar: CalendarPlusIcon,
  unsyncFromCalendar: CalendarMinusIcon,

  // Notification tools
  markNotificationRead: CheckIcon,
  markAllNotificationsRead: CheckCheck,
  deleteNotification: BellIcon,
  clearAllNotifications: BellOff,

  // Settings tools
  updateSettings: Settings,
  getSettings: SlidersHorizontalIcon,

  // Bulk operation tools
  bulkUpdateStatus: RefreshCw,
  bulkArchiveCases: ArchiveIcon,
  bulkDeleteCases: Trash2,
  bulkCalendarSync: CalendarSync,
} as const;

/**
 * Tool name to color class mapping
 * Colors indicate tool type/category:
 * - Blue: Data queries (database operations)
 * - Ink: Knowledge, documentation and settings (stage colours mark stages only)
 * - Lime: External/web
 * - Amber: Modification (future)
 * - Red: Destructive (future)
 * - Teal: Sync operations (future)
 */
export const TOOL_COLORS: Record<string, string> = {
  // Read-only tools
  queryCases: 'text-data-info-ink ',
  searchKnowledge: 'text-foreground',
  searchWeb: 'text-primary ',

  // Case CRUD tools
  createCase: 'text-primary ',
  updateCase: 'text-data-warn-ink ',
  archiveCase: 'text-muted-foreground ',
  reopenCase: 'text-data-info-ink ',
  deleteCase: 'text-destructive ',

  // Other action tools
  syncCalendar: 'text-primary ',
  searchCases: 'text-data-info-ink ',
  generateDocument: 'text-data-info-ink ',
  refreshData: 'text-data-info-ink ',

  // Navigation tools (slate/neutral for non-data actions)
  navigate: 'text-muted-foreground ',
  viewCase: 'text-data-info-ink ',
  scrollTo: 'text-muted-foreground ',
  refreshPage: 'text-muted-foreground ',

  // Calendar sync tools
  syncToCalendar: 'text-primary ',
  unsyncFromCalendar: 'text-data-warn-ink ',

  // Notification tools
  markNotificationRead: 'text-primary ',
  markAllNotificationsRead: 'text-primary ',
  deleteNotification: 'text-destructive ',
  clearAllNotifications: 'text-destructive ',

  // Settings tools
  updateSettings: 'text-foreground',
  getSettings: 'text-foreground',

  // Bulk operation tools (amber/red for destructive)
  bulkUpdateStatus: 'text-data-warn-ink ',
  bulkArchiveCases: 'text-muted-foreground ',
  bulkDeleteCases: 'text-destructive ',
  bulkCalendarSync: 'text-primary ',
} as const;

/**
 * Tool name to background color class (for status indicators)
 */
export const TOOL_BG_COLORS: Record<string, string> = {
  // Read-only tools
  queryCases: 'bg-data-info/10 ',
  searchKnowledge: 'bg-tint',
  searchWeb: 'bg-tint',

  // Case CRUD tools
  createCase: 'bg-tint',
  updateCase: 'bg-data-warn/15 ',
  archiveCase: 'bg-muted ',
  reopenCase: 'bg-data-info/10 ',
  deleteCase: 'bg-destructive/10 ',

  // Other action tools
  syncCalendar: 'bg-tint',

  // Navigation tools
  navigate: 'bg-muted ',
  viewCase: 'bg-data-info/10 ',
  scrollTo: 'bg-muted ',
  refreshPage: 'bg-muted ',

  // Calendar sync tools
  syncToCalendar: 'bg-tint',
  unsyncFromCalendar: 'bg-data-warn/15 ',

  // Notification tools
  markNotificationRead: 'bg-tint',
  markAllNotificationsRead: 'bg-tint',
  deleteNotification: 'bg-destructive/10 ',
  clearAllNotifications: 'bg-destructive/10 ',

  // Settings tools
  updateSettings: 'bg-tint',
  getSettings: 'bg-tint',

  // Bulk operation tools
  bulkUpdateStatus: 'bg-data-warn/15 ',
  bulkArchiveCases: 'bg-muted ',
  bulkDeleteCases: 'bg-destructive/10 ',
  bulkCalendarSync: 'bg-tint',
} as const;

/**
 * Human-readable tool display names
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Read-only tools
  queryCases: 'Query cases',
  searchKnowledge: 'Search knowledge',
  searchWeb: 'Web search',

  // Public records
  lookupDolCase: 'DOL case lookup',
  estimateDecision: 'Decision estimate',
  dolQueue: 'DOL processing times',
  visaBulletin: 'Visa bulletin',
  searchSponsors: 'Sponsor search',
  sponsorProfile: 'Sponsor record',
  findSocCode: 'SOC code',

  // Case CRUD tools
  createCase: 'Create case',
  updateCase: 'Update case',
  archiveCase: 'Archive case',
  reopenCase: 'Reopen case',
  deleteCase: 'Delete case',

  // Other action tools
  syncCalendar: 'Sync calendar',
  searchCases: 'Search cases',
  generateDocument: 'Generate document',
  refreshData: 'Refresh data',

  // Navigation tools
  navigate: 'Navigate',
  viewCase: 'View case',
  scrollTo: 'Scroll to',
  refreshPage: 'Refresh page',

  // Calendar sync tools
  syncToCalendar: 'Sync to calendar',
  unsyncFromCalendar: 'Remove from calendar',

  // Notification tools
  markNotificationRead: 'Mark as read',
  markAllNotificationsRead: 'Mark all read',
  deleteNotification: 'Delete notification',
  clearAllNotifications: 'Clear notifications',

  // Settings tools
  updateSettings: 'Update settings',
  getSettings: 'Get settings',

  // Bulk operation tools
  bulkUpdateStatus: 'Bulk update status',
  bulkArchiveCases: 'Bulk archive cases',
  bulkDeleteCases: 'Bulk delete cases',
  bulkCalendarSync: 'Bulk calendar sync',
} as const;

/**
 * Tool loading messages (shown during pending state)
 */
export const TOOL_LOADING_MESSAGES: Record<string, string> = {
  // Read-only tools
  queryCases: 'Searching cases...',
  searchKnowledge: 'Searching knowledge base...',
  searchWeb: 'Searching the web...',

  // Public records
  lookupDolCase: "Reading DOL's record...",
  estimateDecision: 'Working out the estimate...',
  dolQueue: "Reading DOL's processing times...",
  visaBulletin: 'Reading the visa bulletin...',
  searchSponsors: "Searching DOL's records...",
  sponsorProfile: "Reading the sponsor's record...",
  findSocCode: 'Finding the SOC code...',

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
export function getToolIcon(tool: string): PhosphorIcon {
  return TOOL_ICONS[tool] ?? Search;
}

/**
 * Get color class for a tool, with fallback
 */
export function getToolColor(tool: string): string {
  return TOOL_COLORS[tool] ?? 'text-muted-foreground ';
}

/**
 * Get background color class for a tool, with fallback
 */
export function getToolBgColor(tool: string): string {
  return TOOL_BG_COLORS[tool] ?? 'bg-muted ';
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
