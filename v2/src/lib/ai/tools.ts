/**
 * AI SDK Tool Definitions
 *
 * Tool definitions for the PERM Tracker chat assistant.
 * These tools enable the LLM to query case data, search the knowledge base,
 * and search the web for current PERM information.
 *
 * IMPORTANT: These are tool DEFINITIONS only. The execute functions are
 * implemented in the API route handler, not here.
 *
 * @module tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import { CASE_STATUSES, PROGRESS_STATUSES } from '../../../convex/lib/perm/statusTypes';

// =============================================================================
// Output Schemas (for type safety in API route)
// =============================================================================

/**
 * Schema for queryCases tool output
 */
export const QueryCasesOutputSchema = z.object({
  cases: z.array(z.record(z.string(), z.unknown())),
  count: z.number(),
});
export type QueryCasesOutput = z.infer<typeof QueryCasesOutputSchema>;

/**
 * Schema for queryCases countOnly output
 */
export const QueryCasesCountOutputSchema = z.object({
  count: z.number(),
});
export type QueryCasesCountOutput = z.infer<typeof QueryCasesCountOutputSchema>;

/**
 * Schema for searchKnowledge tool output
 */
export const SearchKnowledgeOutputSchema = z.object({
  context: z.string(),
  sources: z.array(
    z.object({
      title: z.string(),
      source: z.string(),
      section: z.string().optional(),
      cfr: z.string().optional(),
    })
  ),
});
export type SearchKnowledgeOutput = z.infer<typeof SearchKnowledgeOutputSchema>;

/**
 * Schema for searchWeb tool output
 */
export const SearchWebOutputSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })
  ),
  query: z.string(),
});
export type SearchWebOutput = z.infer<typeof SearchWebOutputSchema>;

// =============================================================================
// Input Schemas (used by tools)
// =============================================================================

/**
 * Schema for navigate tool input
 * Defines all valid navigation paths in the application
 */
export const NavigateInputSchema = z.object({
  path: z
    .enum([
      '/dashboard',
      '/cases',
      '/cases/new',
      '/calendar',
      '/timeline',
      '/notifications',
      '/settings',
      '/settings/profile',
      '/settings/notifications',
      '/settings/calendar',
      '/settings/account',
    ])
    .describe('The page path to navigate to'),
  reason: z
    .string()
    .optional()
    .describe('Why navigating (shown to user in transition message)'),
});

export type NavigateInput = z.infer<typeof NavigateInputSchema>;

/**
 * Schema for viewCase tool input
 * Navigate to a specific case detail page
 */
export const ViewCaseInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the case to view'),
  section: z
    .enum(['overview', 'timeline', 'edit'])
    .optional()
    .describe('Which section to show (defaults to overview)'),
});

export type ViewCaseInput = z.infer<typeof ViewCaseInputSchema>;

/**
 * Schema for scrollTo tool input
 * Scroll to specific sections within the current page
 */
export const ScrollToInputSchema = z.object({
  target: z
    .enum([
      'top',
      'bottom',
      'deadlines',
      'recent-activity',
      'form-section',
      'timeline',
    ])
    .describe('Where to scroll on the current page'),
  smooth: z
    .boolean()
    .optional()
    .default(true)
    .describe('Use smooth scrolling animation'),
});

export type ScrollToInput = z.infer<typeof ScrollToInputSchema>;

/**
 * Schema for refreshPage tool input
 * Refresh the current page to get latest data
 */
export const RefreshPageInputSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe('Why refreshing (shown to user in status message)'),
});

export type RefreshPageInput = z.infer<typeof RefreshPageInputSchema>;

/**
 * Schema for queryCases tool input
 */
export const QueryCasesInputSchema = z.object({
  caseStatus: z
    .enum(CASE_STATUSES)
    .optional()
    .describe(
      'Filter by case stage. Options: pwd (Prevailing Wage), recruitment (Labor Market Test), eta9089 (Application Filing), i140 (I-140 Petition), closed (Completed/Withdrawn)'
    ),

  progressStatus: z
    .enum(PROGRESS_STATUSES)
    .optional()
    .describe(
      'Filter by progress status. Options: working (Active work), waiting_intake (Awaiting client docs), filed (Submitted to DOL/USCIS), approved (Approved), under_review (Government review), rfi_rfe (RFI or RFE issued)'
    ),

  hasRfi: z
    .boolean()
    .optional()
    .describe(
      'Filter for cases with active (unresponded) RFI. true = has pending RFI, false = no pending RFI'
    ),

  hasRfe: z
    .boolean()
    .optional()
    .describe(
      'Filter for cases with active (unresponded) RFE. true = has pending RFE, false = no pending RFE'
    ),

  hasOverdueDeadline: z
    .boolean()
    .optional()
    .describe(
      'Filter for cases with any overdue deadline (PWD expiration, ETA 9089 expiration, filing window, RFI/RFE due dates). true = has overdue, false = no overdue'
    ),

  deadlineWithinDays: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Filter for cases with any deadline within N days from today. E.g., 7 for deadlines this week, 30 for next month'
    ),

  searchText: z
    .string()
    .optional()
    .describe(
      'Text search across employer name, position title, foreign worker ID, and notes. Case-insensitive partial match'
    ),

  isProfessionalOccupation: z
    .boolean()
    .optional()
    .describe(
      'Filter for cases marked as professional occupation (requires Bachelor\'s degree or higher). true = professional only, false = non-professional only'
    ),

  fields: z
    .array(z.string())
    .optional()
    .describe(
      'Specific fields to return. If omitted, returns common fields. Common fields: employerName, foreignWorkerId, positionTitle, caseStatus, progressStatus, pwdExpirationDate, eta9089FilingDate'
    ),

  returnAllFields: z
    .boolean()
    .optional()
    .describe('If true, returns all case fields. Use sparingly as it increases response size'),

  countOnly: z
    .boolean()
    .optional()
    .describe(
      'If true, returns only the count of matching cases (faster). Default: false. Use for "how many" questions'
    ),

  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Maximum number of cases to return. Default: 100. Use smaller values for overview questions'),

  idsOnly: z
    .boolean()
    .optional()
    .describe(
      'For bulk operations: returns minimal data (_id, employerName, foreignWorkerId, calendarSyncEnabled). Use this when you need case IDs for bulkCalendarSync, bulkUpdateStatus, etc.'
    ),
});

export type QueryCasesInput = z.infer<typeof QueryCasesInputSchema>;

/**
 * Schema for searchKnowledge tool input
 */
export const SearchKnowledgeInputSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      'Natural language search query about PERM regulations, deadlines, procedures, or requirements. Be specific for better results. E.g., "PWD expiration calculation" or "recruitment advertising requirements"'
    ),
});

export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

/**
 * Schema for searchWeb tool input
 */
export const SearchWebInputSchema = z.object({
  query: z
    .string()
    .min(3)
    .describe(
      'Web search query. Include "PERM" and relevant year for best results. E.g., "PERM processing times 2024" or "DOL PERM audit statistics"'
    ),
});

export type SearchWebInput = z.infer<typeof SearchWebInputSchema>;

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * Query Cases Tool
 *
 * Allows the LLM to query the user's PERM cases with flexible filters.
 * Supports filtering by status, deadlines, RFI/RFE, and text search.
 */
export const queryCasesTool = tool({
  description: `Query the user's PERM cases with flexible filters and field projection.

## WHEN TO USE:
- Questions about user's cases: "How many cases do I have?", "Show my recruitment cases"
- Deadline questions: "Which cases have overdue deadlines?", "Cases with deadlines this week"
- Status inquiries: "Cases waiting for intake", "Cases under review"
- RFI/RFE tracking: "Cases with pending RFI", "Show cases needing RFE response"
- Searching for specific cases: "Find the TechCorp case", "Cases for John Doe"
- Counting/aggregation: "Count my closed cases", "How many cases in PWD stage?"

## WHEN NOT TO USE:
- General PERM regulation questions (use searchKnowledge instead)
- Current processing times or news (use searchWeb instead)
- Questions not about the user's specific cases

## PARAMETERS SUMMARY:
- caseStatus: Filter by case stage (pwd, recruitment, eta9089, i140, closed)
- progressStatus: Filter by progress (working, waiting_intake, filed, approved, under_review, rfi_rfe)
- hasRfi/hasRfe: Filter for cases with active RFI/RFE (true/false)
- hasOverdueDeadline: Filter for overdue deadlines (true/false)
- deadlineWithinDays: Filter for deadlines within N days (number)
- searchText: Text search in employer name, position, foreign worker ID, notes
- isProfessionalOccupation: Filter by professional occupation status (true/false)
- fields: Specific fields to return (array of field names)
- countOnly: Return only count, not case data (default: false)
- limit: Max cases to return (default: 100)
- idsOnly: IMPORTANT for bulk operations! Returns minimal data for bulkCalendarSync, bulkUpdateStatus, etc.

## OUTPUT FORMAT:
- If countOnly=true: { count: number }
- Otherwise: { cases: array of case objects, count: total matching cases }

## EXAMPLES:
- "Cases in recruitment": { caseStatus: "recruitment" }
- "Overdue cases": { hasOverdueDeadline: true }
- "Count PWD cases": { caseStatus: "pwd", countOnly: true }
- "Cases due in 7 days": { deadlineWithinDays: 7 }
- "Find ACME Corp": { searchText: "ACME Corp" }
- "Professional occupation cases": { isProfessionalOccupation: true }
- "Count professional cases": { isProfessionalOccupation: true, countOnly: true }
- "Sync all cases to calendar" (bulk): { idsOnly: true } (use result for bulkCalendarSync)
- "Update all recruitment cases" (bulk): { caseStatus: "recruitment", idsOnly: true }`,

  inputSchema: QueryCasesInputSchema,
});

/**
 * Search Knowledge Tool
 *
 * Searches the PERM knowledge base using RAG (Retrieval Augmented Generation).
 * Contains regulatory information, deadlines, and procedures from perm_flow.md.
 */
export const searchKnowledgeTool = tool({
  description: `Search the PERM knowledge base for regulatory information, deadlines, and procedures.

## WHEN TO USE:
- PERM regulation questions: "What is the PWD expiration rule?", "How long is the filing window?"
- Process questions: "What are the recruitment steps?", "What documents are needed?"
- Deadline rules: "When must I-140 be filed?", "What is the 30-180 day rule?"
- Definition questions: "What is a prevailing wage?", "What is professional occupation?"
- Compliance questions: "What if PWD expires?", "Can I extend the filing window?"

## WHEN NOT TO USE:
- Questions about user's specific cases (use queryCases instead)
- Current processing times, news, or updates (use searchWeb instead)
- Questions clearly outside PERM scope

## PARAMETER:
- query: Natural language question about PERM regulations, deadlines, or procedures

## OUTPUT FORMAT:
{
  context: "Relevant text from knowledge base (concatenated)",
  sources: [{ title, source, section?, cfr? }]
}

## EXAMPLES:
- "PWD expiration": query = "How is PWD expiration date calculated?"
- "Filing window": query = "What is the 30-180 day ETA 9089 filing window?"
- "I-140 deadline": query = "How long after ETA certification must I-140 be filed?"`,

  inputSchema: SearchKnowledgeInputSchema,
});

/**
 * Search Web Tool
 *
 * Searches the web for current PERM information, processing times, and news.
 * Uses multi-provider web search with rate limit tracking.
 */
export const searchWebTool = tool({
  description: `Search the web for current PERM information, processing times, news, and updates.

## WHEN TO USE:
- Current processing times: "What is the current PERM processing time?", "How long is USCIS taking?"
- Recent news/updates: "Any changes to PERM rules?", "Latest DOL announcements"
- External resources: "Where can I check case status?", "DOL FLAG system"
- Trends and statistics: "PERM denial rates", "Common audit reasons"
- Information not in knowledge base

## WHEN NOT TO USE:
- Questions about user's specific cases (use queryCases instead)
- Standard PERM regulations already in knowledge base (use searchKnowledge instead)
- Information that requires authentication or user-specific data

## PARAMETER:
- query: Search query for web search. Be specific and include "PERM" for relevance

## OUTPUT FORMAT:
{
  results: [{ title, url, snippet }],
  query: "original search query"
}

## EXAMPLES:
- Processing times: query = "PERM processing times 2024"
- Audit trends: query = "PERM audit reasons DOL 2024"
- Status check: query = "DOL FLAG PERM case status lookup"`,

  inputSchema: SearchWebInputSchema,
});

/**
 * Navigate Tool
 *
 * Navigate to different pages within the PERM Tracker application.
 * Enables the LLM to help users navigate to relevant pages based on context.
 */
export const navigateTool = tool({
  description: `Navigate to a specific page in the PERM Tracker application.

## WHEN TO USE:
- User asks to go somewhere: "Take me to the dashboard", "Open settings", "Go to my cases"
- After completing a task that suggests navigation: "I've noted that, let me take you to the calendar"
- User needs to see specific content: "Show me notifications", "I need to create a new case"
- Contextual navigation: After discussing deadlines, offer to navigate to calendar

## WHEN NOT TO USE:
- User is asking a question (answer the question first, then offer navigation)
- Navigation would interrupt the user's current task
- The user is already on the requested page
- User wants to view a specific case (use viewCase instead)

## PATHS:
- /dashboard: Main dashboard with case overview and metrics
- /cases: List of all cases with filters
- /cases/new: Create a new PERM case
- /calendar: Calendar view of deadlines and events
- /timeline: Overall timeline view across all cases
- /notifications: Notification center
- /settings: Main settings page
- /settings/profile: User profile settings
- /settings/notifications: Notification preferences
- /settings/calendar: Calendar sync settings
- /settings/account: Account settings

## EXAMPLES:
- "Go to dashboard": { path: "/dashboard" }
- "I need to add a case": { path: "/cases/new", reason: "Creating new PERM case" }
- "Show me my notifications": { path: "/notifications" }
- "Open calendar settings": { path: "/settings/calendar" }`,

  inputSchema: NavigateInputSchema,
});

/**
 * View Case Tool
 *
 * Navigate to a specific case detail page by case ID.
 * Use when the user wants to see details of a particular case.
 */
export const viewCaseTool = tool({
  description: `Navigate to view a specific PERM case's detail page.

## WHEN TO USE:
- After finding a case via queryCases: "Let me show you the TechCorp case"
- User references a specific case: "Show me case details for [employer]"
- Following up on case discussion: "Here's that case you asked about"
- User wants to edit a case: "Edit the ACME Corp case"

## WHEN NOT TO USE:
- User wants to see a list of cases (use navigate to /cases instead)
- The case ID is unknown (use queryCases first to find it)
- User is asking general questions about a case (use queryCases instead)

## SECTIONS:
- overview: Main case details and status (default)
- timeline: Case timeline with all events and milestones
- edit: Edit mode for the case

## EXAMPLES:
- "Show TechCorp case": { caseId: "abc123" }
- "Edit ACME case": { caseId: "xyz789", section: "edit" }
- "Show case timeline": { caseId: "def456", section: "timeline" }

## NOTE:
Always use queryCases first to find the caseId if not already known.`,

  inputSchema: ViewCaseInputSchema,
});

/**
 * Scroll To Tool
 *
 * Scroll to specific sections within the current page.
 * Useful for long pages or when directing attention to specific content.
 */
export const scrollToTool = tool({
  description: `Scroll to a specific section on the current page.

## WHEN TO USE:
- User asks about something visible on page: "Show me the deadlines section"
- After explaining something: "Let me scroll you to the relevant section"
- User seems lost on a long page: "Here's the form section you need"
- Highlighting specific content: "Look at the recent activity"

## WHEN NOT TO USE:
- User needs to go to a different page (use navigate instead)
- The target section doesn't exist on the current page
- User didn't ask to see something specific
- Navigation would be more appropriate than scrolling

## TARGETS:
- top: Top of the current page
- bottom: Bottom of the current page
- deadlines: Deadline section (on dashboard or case detail)
- recent-activity: Recent activity feed
- form-section: Main form section (on edit/create pages)
- timeline: Timeline section (on case detail page)

## EXAMPLES:
- "Show deadlines": { target: "deadlines" }
- "Go to top": { target: "top" }
- "Show me the form": { target: "form-section" }
- "Jump to bottom quickly": { target: "bottom", smooth: false }`,

  inputSchema: ScrollToInputSchema,
});

/**
 * Refresh Page Tool
 *
 * Refresh the current page to fetch the latest data.
 * Useful after changes or when data might be stale.
 */
export const refreshPageTool = tool({
  description: `Refresh the current page to get the latest data.

## WHEN TO USE:
- After making changes that affect displayed data
- When user reports stale data: "My case status isn't updated"
- Proactive refresh: "Let me refresh to show you the latest"
- After external changes: "If you just filed something, let me refresh"

## WHEN NOT TO USE:
- No changes have been made (unnecessary refresh)
- User wants to navigate to a different page
- Data is already current
- Would interrupt user's current activity (e.g., filling a form)

## EXAMPLES:
- "Refresh to see updates": { reason: "Fetching latest case data" }
- "Page might be stale": { reason: "Refreshing to show current status" }
- Just refresh: { }`,

  inputSchema: RefreshPageInputSchema,
});

// =============================================================================
// Calendar Tool Schemas
// =============================================================================

/**
 * Schema for syncToCalendar tool input
 */
export const SyncToCalendarInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the case to sync to Google Calendar'),
});

export type SyncToCalendarInput = z.infer<typeof SyncToCalendarInputSchema>;

/**
 * Schema for unsyncFromCalendar tool input
 */
export const UnsyncFromCalendarInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the case to remove from Google Calendar'),
});

export type UnsyncFromCalendarInput = z.infer<typeof UnsyncFromCalendarInputSchema>;

// =============================================================================
// Notification Tool Schemas
// =============================================================================

/**
 * Schema for markNotificationRead tool input
 */
export const MarkNotificationReadInputSchema = z.object({
  notificationId: z.string().describe('The Convex ID of the notification to mark as read'),
});

export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>;

/**
 * Schema for markAllNotificationsRead tool input
 */
export const MarkAllNotificationsReadInputSchema = z.object({
  confirm: z
    .boolean()
    .optional()
    .describe('Confirmation flag (not required, used for explicit confirmation)'),
});

export type MarkAllNotificationsReadInput = z.infer<typeof MarkAllNotificationsReadInputSchema>;

/**
 * Schema for deleteNotification tool input
 */
export const DeleteNotificationInputSchema = z.object({
  notificationId: z.string().describe('The Convex ID of the notification to delete'),
});

export type DeleteNotificationInput = z.infer<typeof DeleteNotificationInputSchema>;

/**
 * Schema for clearAllNotifications tool input
 */
export const ClearAllNotificationsInputSchema = z.object({
  confirm: z
    .boolean()
    .optional()
    .describe('Confirmation flag (not required, used for explicit confirmation)'),
});

export type ClearAllNotificationsInput = z.infer<typeof ClearAllNotificationsInputSchema>;

// =============================================================================
// Settings Tool Schemas
// =============================================================================

/**
 * Schema for updateSettings tool input
 */
export const UpdateSettingsInputSchema = z.object({
  settings: z
    .object({
      // Notification settings
      emailNotificationsEnabled: z.boolean().optional(),
      pushNotificationsEnabled: z.boolean().optional(),
      emailDeadlineReminders: z.boolean().optional(),

      // Calendar settings
      calendarSyncEnabled: z.boolean().optional(),
      calendarSyncPwd: z.boolean().optional(),
      calendarSyncEta9089: z.boolean().optional(),

      // Preference settings
      darkModeEnabled: z.boolean().optional(),
      urgentDeadlineDays: z.number().int().min(1).max(30).optional(),
      reminderDaysBefore: z.number().int().min(1).max(14).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().optional(),
      quietHoursEnd: z.string().optional(),
    })
    .describe('Settings to update (only include fields to change)'),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

/**
 * Schema for getSettings tool input
 */
export const GetSettingsInputSchema = z.object({
  category: z
    .enum(['all', 'notifications', 'calendar', 'preferences'])
    .optional()
    .describe('Category of settings to retrieve (default: all)'),
});

export type GetSettingsInput = z.infer<typeof GetSettingsInputSchema>;

// =============================================================================
// Bulk Operation Tool Schemas
// =============================================================================

/**
 * Common filter options for bulk operations
 * When `all: true`, these filters determine which cases are affected
 */
const BulkFilterSchema = z.object({
  all: z.boolean().optional().describe('Set to true to apply to ALL matching cases (no need to list IDs)'),
  caseIds: z.array(z.string()).optional().describe('Specific case IDs (only needed if all is not true)'),
  filterByStatus: z.enum(CASE_STATUSES).optional()
    .describe('When all=true, only affect cases with this status'),
});

/**
 * Schema for bulkUpdateStatus tool input
 */
export const BulkUpdateStatusInputSchema = BulkFilterSchema.extend({
  status: z.enum(CASE_STATUSES).describe('New status for all cases'),
  reason: z.string().optional().describe('Reason for bulk update'),
});

export type BulkUpdateStatusInput = z.infer<typeof BulkUpdateStatusInputSchema>;

/**
 * Schema for bulkArchiveCases tool input
 */
export const BulkArchiveCasesInputSchema = BulkFilterSchema.extend({
  reason: z.string().optional().describe('Reason for bulk archive'),
});

export type BulkArchiveCasesInput = z.infer<typeof BulkArchiveCasesInputSchema>;

/**
 * Schema for bulkDeleteCases tool input
 */
export const BulkDeleteCasesInputSchema = BulkFilterSchema.extend({
  confirmPhrase: z.string().optional().describe('Confirmation phrase for extra safety'),
});

export type BulkDeleteCasesInput = z.infer<typeof BulkDeleteCasesInputSchema>;

/**
 * Schema for bulkCalendarSync tool input
 */
export const BulkCalendarSyncInputSchema = BulkFilterSchema.extend({
  enabled: z.boolean().describe('true to enable sync, false to disable sync'),
});

export type BulkCalendarSyncInput = z.infer<typeof BulkCalendarSyncInputSchema>;

// =============================================================================
// Case CRUD Tool Schemas
// =============================================================================

/**
 * Case status enum matching Convex schema
 * Derived from CASE_STATUSES in statusTypes.ts (single source of truth)
 */
const CaseStatusEnum = z.enum(CASE_STATUSES);

/**
 * Progress status enum matching Convex schema
 * Derived from PROGRESS_STATUSES in statusTypes.ts (single source of truth)
 */
const ProgressStatusEnum = z.enum(PROGRESS_STATUSES);

/**
 * Priority level enum matching Convex schema
 */
const PriorityLevelEnum = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * I-140 category enum matching Convex schema
 */
const I140CategoryEnum = z.enum(['EB-1', 'EB-2', 'EB-3']);

/**
 * ISO date string pattern (YYYY-MM-DD)
 */
const ISODateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

/**
 * Additional recruitment method schema
 */
const AdditionalRecruitmentMethodSchema = z.object({
  method: z.string().describe('Name of the recruitment method'),
  date: z.string().describe('Date of the recruitment activity (YYYY-MM-DD)'),
  description: z.string().optional().describe('Optional description'),
});

/**
 * Closure reason enum matching Convex schema
 */
const ClosureReasonEnum = z.enum([
  'pwd_expired',
  'recruitment_window_missed',
  'filing_window_missed',
  'eta9089_expired',
  'withdrawn',
  'denied',
  'manual',
  'other',
]);

// =============================================================================
// RFI/RFE/Notes Array Schemas
// =============================================================================

/**
 * RFI Entry Schema (Request for Information from DOL)
 *
 * IMPORTANT: responseDueDate is AUTO-CALCULATED (+30 days from receivedDate)
 * per 20 CFR 656.20. Do NOT allow manual editing of this field.
 */
const RfiEntrySchema = z.object({
  id: z.string().describe('Unique ID for this RFI entry'),
  title: z.string().optional().describe('Short title/summary of the RFI'),
  description: z.string().optional().describe('Detailed description of what is being requested'),
  notes: z.string().optional().describe('Internal notes about the RFI'),
  receivedDate: ISODateString.describe('Date RFI was received (YYYY-MM-DD)'),
  responseDueDate: ISODateString.describe('Response due date - AUTO-CALCULATED (+30 days from receivedDate)'),
  responseSubmittedDate: ISODateString.optional().describe('Date response was submitted (YYYY-MM-DD). Null if not yet submitted.'),
  createdAt: z.number().describe('Unix timestamp when entry was created'),
});

/**
 * RFE Entry Schema (Request for Evidence from USCIS)
 *
 * Unlike RFI, responseDueDate is USER-EDITABLE as it varies by case complexity.
 */
const RfeEntrySchema = z.object({
  id: z.string().describe('Unique ID for this RFE entry'),
  title: z.string().optional().describe('Short title/summary of the RFE'),
  description: z.string().optional().describe('Detailed description of what evidence is needed'),
  notes: z.string().optional().describe('Internal notes about the RFE'),
  receivedDate: ISODateString.describe('Date RFE was received (YYYY-MM-DD)'),
  responseDueDate: ISODateString.describe('Response due date (YYYY-MM-DD) - User editable, check USCIS notice'),
  responseSubmittedDate: ISODateString.optional().describe('Date response was submitted (YYYY-MM-DD). Null if not yet submitted.'),
  createdAt: z.number().describe('Unix timestamp when entry was created'),
});

/**
 * Case Note Schema for journal entries
 *
 * Notes support priority, category, and optional due dates for follow-up tasks.
 */
const NoteSchema = z.object({
  id: z.string().describe('Unique ID for this note'),
  content: z.string().min(1).describe('Note content (required)'),
  createdAt: z.number().describe('Unix timestamp when note was created'),
  status: z.enum(['pending', 'done', 'deleted']).describe('Note status: pending (active), done (completed), deleted (soft delete)'),
  priority: z.enum(['high', 'medium', 'low']).optional().describe('Priority level for the note'),
  category: z.enum([
    'follow-up',
    'document',
    'client',
    'internal',
    'deadline',
    'other',
  ]).optional().describe('Category of the note'),
  dueDate: ISODateString.optional().describe('Due date for follow-up notes (YYYY-MM-DD)'),
});

/**
 * Document attachment schema
 */
const DocumentSchema = z.object({
  id: z.string().describe('Unique ID for this document'),
  name: z.string().describe('Document file name'),
  url: z.string().describe('Convex file storage URL'),
  mimeType: z.string().describe('MIME type of the document'),
  size: z.number().int().describe('File size in bytes'),
  uploadedAt: z.number().describe('Unix timestamp when document was uploaded'),
});

// Export schemas for use in chat route
export { RfiEntrySchema, RfeEntrySchema, NoteSchema, DocumentSchema };
export type RfiEntry = z.infer<typeof RfiEntrySchema>;
export type RfeEntry = z.infer<typeof RfeEntrySchema>;
export type NoteEntry = z.infer<typeof NoteSchema>;
export type DocumentEntry = z.infer<typeof DocumentSchema>;

/**
 * Schema for createCase tool input
 */
export const CreateCaseInputSchema = z.object({
  // Required fields
  employerName: z
    .string()
    .min(1)
    .describe('Name of the sponsoring employer (required)'),
  foreignWorkerId: z
    .string()
    .optional()
    .describe('Foreign worker identifier - name or initials (optional)'),
  positionTitle: z
    .string()
    .min(1)
    .describe('Job position title (required)'),

  // Optional status fields
  caseStatus: CaseStatusEnum.optional().describe(
    'Case stage: pwd, recruitment, eta9089, i140, closed (default: pwd)'
  ),
  progressStatus: ProgressStatusEnum.optional().describe(
    'Progress status: working, waiting_intake, filed, approved, under_review, rfi_rfe (default: working)'
  ),
  priorityLevel: PriorityLevelEnum.optional().describe(
    'Priority: low, normal, high, urgent (default: normal)'
  ),

  // Optional flags
  isProfessionalOccupation: z
    .boolean()
    .optional()
    .describe("Set to true if position requires Bachelor's degree or higher"),
  isFavorite: z.boolean().optional().describe('Mark case as favorite'),
  calendarSyncEnabled: z
    .boolean()
    .optional()
    .describe('Enable Google Calendar sync for deadlines (default: true)'),

  // Optional PWD dates
  pwdFilingDate: ISODateString.optional().describe('PWD filing date (YYYY-MM-DD)'),
  pwdDeterminationDate: ISODateString.optional().describe(
    'PWD determination date (YYYY-MM-DD). Auto-calculates expiration.'
  ),
  pwdExpirationDate: ISODateString.optional().describe('PWD expiration date (YYYY-MM-DD)'),
  pwdCaseNumber: z.string().optional().describe('PWD case number'),
  pwdWageLevel: z.string().optional().describe('Wage level (e.g., "Level 2")'),

  // Optional recruitment dates
  jobOrderStartDate: ISODateString.optional().describe(
    'Job order start date (YYYY-MM-DD)'
  ),
  jobOrderEndDate: ISODateString.optional().describe('Job order end date (YYYY-MM-DD)'),
  sundayAdFirstDate: ISODateString.optional().describe(
    'First Sunday newspaper ad date (YYYY-MM-DD, must be a Sunday)'
  ),
  sundayAdSecondDate: ISODateString.optional().describe(
    'Second Sunday newspaper ad date (YYYY-MM-DD, must be a Sunday, after first)'
  ),
  sundayAdNewspaper: z.string().optional().describe('Newspaper name for Sunday ads'),
  noticeOfFilingStartDate: ISODateString.optional().describe(
    'Notice of Filing posting start date (YYYY-MM-DD)'
  ),
  noticeOfFilingEndDate: ISODateString.optional().describe(
    'Notice of Filing posting end date (YYYY-MM-DD)'
  ),
  additionalRecruitmentMethods: z
    .array(AdditionalRecruitmentMethodSchema)
    .optional()
    .describe('Additional recruitment methods (3+ required for professional occupations)'),

  // Optional ETA 9089 dates
  eta9089FilingDate: ISODateString.optional().describe(
    'ETA 9089 filing date (YYYY-MM-DD)'
  ),
  eta9089CertificationDate: ISODateString.optional().describe(
    'ETA 9089 certification date (YYYY-MM-DD)'
  ),
  eta9089CaseNumber: z.string().optional().describe('ETA 9089 case number'),

  // Optional I-140 fields
  i140FilingDate: ISODateString.optional().describe('I-140 filing date (YYYY-MM-DD)'),
  i140ReceiptNumber: z.string().optional().describe('I-140 receipt number'),
  i140Category: I140CategoryEnum.optional().describe('I-140 category: EB-1, EB-2, EB-3'),
  i140PremiumProcessing: z
    .boolean()
    .optional()
    .describe('Whether premium processing was requested'),

  // Optional text fields
  internalCaseNumber: z.string().optional().describe('Internal case/matter number'),
  employerFein: z.string().optional().describe('Employer FEIN'),
  socCode: z.string().optional().describe('SOC code'),
  socTitle: z.string().optional().describe('SOC title'),
  jobOrderState: z.string().optional().describe('State for job order (e.g., "CA")'),
});

export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;

/**
 * Schema for updateCase tool input
 *
 * COMPREHENSIVE field support for ALL case fields.
 * Includes array operations for RFI/RFE/notes with proper validation.
 */
export const UpdateCaseInputSchema = z.object({
  // ==========================================================================
  // REQUIRED
  // ==========================================================================
  caseId: z.string().describe('The Convex ID of the case to update (required)'),

  // ==========================================================================
  // CORE IDENTITY FIELDS
  // ==========================================================================
  employerName: z.string().min(1).optional().describe('Update employer name'),
  foreignWorkerId: z
    .string()
    .optional()
    .describe('Update foreign worker ID'),
  positionTitle: z.string().min(1).optional().describe('Update position title'),
  jobTitle: z.string().optional().describe('Update job title'),

  // ==========================================================================
  // STATUS FIELDS
  // ==========================================================================
  caseStatus: CaseStatusEnum.optional().describe('Update case stage: pwd, recruitment, eta9089, i140, closed'),
  progressStatus: ProgressStatusEnum.optional().describe('Update progress status: working, waiting_intake, filed, approved, under_review, rfi_rfe'),
  progressStatusOverride: z.boolean().optional().describe('Set to true to prevent auto-calculation of progressStatus'),
  priorityLevel: PriorityLevelEnum.optional().describe('Update priority level: low, normal, high, urgent'),

  // ==========================================================================
  // FLAGS / BOOLEANS
  // ==========================================================================
  isProfessionalOccupation: z.boolean().optional().describe("Update professional occupation flag (requires Bachelor's degree)"),
  isFavorite: z.boolean().optional().describe('Update favorite status'),
  isPinned: z.boolean().optional().describe('Update pinned status (pinned cases appear at top of list)'),
  calendarSyncEnabled: z.boolean().optional().describe('Update calendar sync setting'),
  showOnTimeline: z.boolean().optional().describe('Update timeline visibility'),

  // ==========================================================================
  // CASE NUMBERS
  // ==========================================================================
  caseNumber: z.string().optional().describe('Update DOL case number'),
  internalCaseNumber: z.string().optional().describe('Update internal case/matter number'),
  pwdCaseNumber: z.string().optional().describe('Update PWD case number'),
  eta9089CaseNumber: z.string().optional().describe('Update ETA 9089 case number'),
  i140ReceiptNumber: z.string().optional().describe('Update I-140 receipt number'),

  // ==========================================================================
  // PWD FIELDS
  // ==========================================================================
  pwdFilingDate: ISODateString.optional().describe('Update PWD filing date (YYYY-MM-DD)'),
  pwdDeterminationDate: ISODateString.optional().describe('Update PWD determination date (auto-calculates expiration)'),
  pwdExpirationDate: ISODateString.optional().describe('Update PWD expiration date (usually auto-calculated)'),
  pwdWageLevel: z.string().optional().describe('Update wage level (e.g., "Level 2")'),
  pwdWageAmount: z.number().int().min(0).optional().describe('Update wage amount in cents (e.g., 7500000 = $75,000)'),

  // ==========================================================================
  // RECRUITMENT DATES
  // ==========================================================================
  jobOrderStartDate: ISODateString.optional().describe('Update job order start date (YYYY-MM-DD)'),
  jobOrderEndDate: ISODateString.optional().describe('Update job order end date (auto-extends to +30 days)'),
  jobOrderState: z.string().optional().describe('Update job order state (2-letter code, e.g., "CA")'),

  sundayAdFirstDate: ISODateString.optional().describe('Update first Sunday ad date (must be Sunday)'),
  sundayAdSecondDate: ISODateString.optional().describe('Update second Sunday ad date (must be Sunday after first)'),
  sundayAdNewspaper: z.string().optional().describe('Update newspaper name for Sunday ads'),

  noticeOfFilingStartDate: ISODateString.optional().describe('Update Notice of Filing start date'),
  noticeOfFilingEndDate: ISODateString.optional().describe('Update Notice of Filing end date (auto-extends to +10 business days)'),

  additionalRecruitmentStartDate: ISODateString.optional().describe('Update additional recruitment start date'),
  additionalRecruitmentEndDate: ISODateString.optional().describe('Update additional recruitment end date'),
  additionalRecruitmentMethods: z
    .array(AdditionalRecruitmentMethodSchema)
    .optional()
    .describe('Update additional recruitment methods (3+ required for professional occupations). Full array replacement.'),

  // ==========================================================================
  // RECRUITMENT METADATA
  // ==========================================================================
  recruitmentApplicantsCount: z.number().int().min(0).optional().describe('Update count of recruitment applicants'),
  recruitmentNotes: z.string().optional().describe('Update recruitment notes'),
  recruitmentSummaryCustom: z.string().optional().describe('Update custom recruitment summary'),

  // ==========================================================================
  // ETA 9089 FIELDS
  // ==========================================================================
  eta9089FilingDate: ISODateString.optional().describe('Update ETA 9089 filing date'),
  eta9089AuditDate: ISODateString.optional().describe('Update ETA 9089 audit date'),
  eta9089CertificationDate: ISODateString.optional().describe('Update ETA 9089 certification date (auto-calculates expiration)'),
  eta9089ExpirationDate: ISODateString.optional().describe('Update ETA 9089 expiration date (usually auto-calculated)'),

  // ==========================================================================
  // I-140 FIELDS
  // ==========================================================================
  i140FilingDate: ISODateString.optional().describe('Update I-140 filing date'),
  i140ReceiptDate: ISODateString.optional().describe('Update I-140 receipt date'),
  i140ApprovalDate: ISODateString.optional().describe('Update I-140 approval date'),
  i140DenialDate: ISODateString.optional().describe('Update I-140 denial date'),
  i140Category: I140CategoryEnum.optional().describe('Update I-140 category: EB-1, EB-2, EB-3'),
  i140PremiumProcessing: z.boolean().optional().describe('Update premium processing flag'),
  i140ServiceCenter: z.string().optional().describe('Update I-140 service center'),

  // ==========================================================================
  // JOB DESCRIPTION
  // ==========================================================================
  jobDescription: z.string().max(10000).optional().describe('Update job description text (max 10,000 characters)'),
  jobDescriptionPositionTitle: z.string().optional().describe('Update job description position title'),

  // ==========================================================================
  // POSITION / EMPLOYER DETAILS
  // ==========================================================================
  employerFein: z.string().optional().describe('Update employer FEIN'),
  socCode: z.string().optional().describe('Update SOC code'),
  socTitle: z.string().optional().describe('Update SOC title'),

  // ==========================================================================
  // CLOSURE TRACKING
  // ==========================================================================
  closureReason: ClosureReasonEnum.optional().describe('Update closure reason (only for closed cases)'),

  // ==========================================================================
  // SIMPLE ARRAYS (Full Replacement)
  // ==========================================================================
  tags: z.array(z.string()).optional().describe('Update case tags (full array replacement)'),

  // ==========================================================================
  // COMPLEX ARRAYS: RFI/RFE/NOTES
  // ==========================================================================
  /**
   * RFI Entries (Request for Information from DOL)
   *
   * IMPORTANT:
   * - responseDueDate is AUTO-CALCULATED as receivedDate + 30 days (strict per 20 CFR 656.20)
   * - Only ONE active RFI allowed (without responseSubmittedDate)
   * - To add: Include new entry in array with receivedDate
   * - To update: Include full entry with changes
   * - To remove: Exclude the entry from array
   * - To clear all: Pass empty array []
   *
   * When adding new RFI:
   * - Generate unique ID: `rfi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
   * - Set createdAt: Date.now()
   * - responseDueDate will be auto-calculated from receivedDate
   */
  rfiEntries: z.array(RfiEntrySchema).optional().describe(
    'Update RFI entries. Auto-calculates due date (+30 days from receivedDate). Only one active RFI allowed. Pass [] to clear all.'
  ),

  /**
   * RFE Entries (Request for Evidence from USCIS)
   *
   * IMPORTANT:
   * - responseDueDate is USER-PROVIDED (varies by case complexity)
   * - Only ONE active RFE allowed (without responseSubmittedDate)
   * - Similar CRUD semantics as RFI entries
   *
   * When adding new RFE:
   * - Generate unique ID: `rfe_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
   * - Set createdAt: Date.now()
   * - responseDueDate MUST be provided by user (check USCIS notice)
   */
  rfeEntries: z.array(RfeEntrySchema).optional().describe(
    'Update RFE entries. Due date is user-editable (varies by case). Only one active RFE allowed. Pass [] to clear all.'
  ),

  /**
   * Case Notes / Journal
   *
   * Notes support priority, category, and optional due dates for follow-ups.
   * Use status: "deleted" for soft delete (preserves history).
   *
   * When adding new note:
   * - Generate unique ID: `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
   * - Set createdAt: Date.now()
   * - Set status: "pending" for active notes
   */
  notes: z.array(NoteSchema).optional().describe(
    'Update case notes/journal. Use status "deleted" for soft delete. Pass [] to clear all.'
  ),

  /**
   * Document Attachments
   *
   * Note: Documents require file upload via separate endpoint.
   * This field is for managing existing document metadata.
   */
  documents: z.array(DocumentSchema).optional().describe(
    'Update document attachments. Note: Files must be uploaded separately.'
  ),
});

export type UpdateCaseInput = z.infer<typeof UpdateCaseInputSchema>;

/**
 * Schema for archiveCase tool input (soft delete)
 */
export const ArchiveCaseInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the case to archive (required)'),
  reason: z
    .string()
    .optional()
    .describe('Reason for archiving (for confirmation message)'),
});

export type ArchiveCaseInput = z.infer<typeof ArchiveCaseInputSchema>;

/**
 * Schema for reopenCase tool input
 */
export const ReopenCaseInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the closed case to reopen (required)'),
});

export type ReopenCaseInput = z.infer<typeof ReopenCaseInputSchema>;

/**
 * Schema for deleteCase tool input (permanent delete)
 */
export const DeleteCaseInputSchema = z.object({
  caseId: z.string().describe('The Convex ID of the case to permanently delete (required)'),
  confirmationPhrase: z
    .string()
    .optional()
    .describe('User must confirm with case identifier for destructive action'),
});

export type DeleteCaseInput = z.infer<typeof DeleteCaseInputSchema>;

// =============================================================================
// Calendar Tool Definitions
// =============================================================================

/**
 * Sync to Calendar Tool
 *
 * Enables Google Calendar sync for a case's deadlines.
 */
export const syncToCalendarTool = tool({
  description: `Enable Google Calendar sync for a PERM case.

## WHEN TO USE:
- User asks to sync a case to their calendar: "Sync the TechCorp case to my calendar"
- User wants deadline reminders: "Add this case to my calendar"
- User wants to track a case's dates in Google Calendar

## WHEN NOT TO USE:
- User wants to unsync/remove from calendar (use unsyncFromCalendar)
- You don't have the caseId (use queryCases first)
- Calendar sync is already enabled for the case

## BEHAVIOR:
- Sets calendarSyncEnabled to true for the case
- Case deadlines will sync to user's Google Calendar
- Requires user's Google Calendar to be connected in settings

## EXAMPLES:
- "Sync to calendar": { caseId: "abc123" }
- "Add TechCorp to my calendar": { caseId: "xyz789" }

## NOTES:
- Use queryCases first if you need to find the case ID
- User must have Google Calendar connected for sync to work`,

  inputSchema: SyncToCalendarInputSchema,
});

/**
 * Unsync from Calendar Tool
 *
 * Disables Google Calendar sync for a case's deadlines.
 */
export const unsyncFromCalendarTool = tool({
  description: `Disable Google Calendar sync for a PERM case.

## WHEN TO USE:
- User asks to remove a case from their calendar: "Stop syncing TechCorp"
- User wants to disable calendar reminders: "Remove from calendar"
- User no longer wants deadline notifications in Google Calendar

## WHEN NOT TO USE:
- User wants to enable calendar sync (use syncToCalendar)
- You don't have the caseId (use queryCases first)
- Calendar sync is already disabled for the case

## BEHAVIOR:
- Sets calendarSyncEnabled to false for the case
- Removes case deadlines from user's Google Calendar
- Does not delete the case itself

## EXAMPLES:
- "Remove from calendar": { caseId: "abc123" }
- "Stop syncing TechCorp": { caseId: "xyz789" }

## NOTES:
- Use queryCases first if you need to find the case ID
- This only affects calendar sync, not the case itself`,

  inputSchema: UnsyncFromCalendarInputSchema,
});

// =============================================================================
// Notification Tool Definitions
// =============================================================================

/**
 * Mark Notification Read Tool
 *
 * Marks a single notification as read.
 */
export const markNotificationReadTool = tool({
  description: `Mark a single notification as read.

## WHEN TO USE:
- User asks to dismiss a specific notification
- User acknowledges a notification: "I've seen the deadline reminder"
- After displaying notification details to user

## WHEN NOT TO USE:
- User wants to mark ALL notifications as read (use markAllNotificationsRead)
- User wants to delete the notification (use deleteNotification)
- You don't have the notificationId

## BEHAVIOR:
- Sets the notification's isRead flag to true
- Notification remains in history but won't show as unread
- Updates unread count

## EXAMPLES:
- "Mark as read": { notificationId: "abc123" }
- "Dismiss this notification": { notificationId: "xyz789" }

## NOTES:
- Notification ID should come from a previous notification query
- This is different from deleting - the notification stays in history`,

  inputSchema: MarkNotificationReadInputSchema,
});

/**
 * Mark All Notifications Read Tool
 *
 * Marks all notifications as read. This is a destructive batch operation.
 */
export const markAllNotificationsReadTool = tool({
  description: `Mark ALL notifications as read. This is a batch operation.

## WHEN TO USE:
- User asks to clear all notifications: "Mark everything as read"
- User wants to dismiss all unread notifications
- User wants a clean notification inbox

## WHEN NOT TO USE:
- User wants to mark only ONE notification (use markNotificationRead)
- User wants to DELETE notifications (use deleteNotification or clearAllNotifications)
- User didn't explicitly ask for this batch action

## BEHAVIOR:
- Marks ALL user's notifications as read in one operation
- Does not delete notifications - they remain in history
- Resets unread count to 0

## EXAMPLES:
- "Mark all as read": { }
- "Clear my notifications": { confirm: true }

## NOTES:
- Always confirm with user before batch operations
- This affects ALL notifications, not just visible ones`,

  inputSchema: MarkAllNotificationsReadInputSchema,
});

/**
 * Delete Notification Tool
 *
 * Permanently deletes a single notification.
 */
export const deleteNotificationTool = tool({
  description: `Delete a single notification permanently.

## WHEN TO USE:
- User explicitly asks to delete a notification
- User wants to remove a notification from history
- Notification is no longer relevant

## WHEN NOT TO USE:
- User just wants to mark as read (use markNotificationRead)
- User wants to delete ALL notifications (use clearAllNotifications)
- You don't have the notificationId

## BEHAVIOR:
- Permanently removes the notification from the database
- Cannot be undone
- Updates notification count

## EXAMPLES:
- "Delete this notification": { notificationId: "abc123" }
- "Remove the deadline reminder": { notificationId: "xyz789" }

## NOTES:
- Notification ID should come from a previous notification query
- Consider marking as read instead unless user wants deletion`,

  inputSchema: DeleteNotificationInputSchema,
});

/**
 * Clear All Notifications Tool
 *
 * Deletes all READ notifications. This is a destructive batch operation.
 */
export const clearAllNotificationsTool = tool({
  description: `Delete all READ notifications permanently. This is a destructive batch operation.

## WHEN TO USE:
- User asks to clear notification history: "Delete all my old notifications"
- User wants to clean up read notifications
- User explicitly requests permanent deletion of notifications

## WHEN NOT TO USE:
- User wants to mark notifications as read (use markAllNotificationsRead)
- User wants to delete ONE notification (use deleteNotification)
- User didn't explicitly ask for permanent deletion

## BEHAVIOR:
- PERMANENTLY DELETES all read notifications
- Unread notifications are NOT affected
- Cannot be undone

## EXAMPLES:
- "Clear notification history": { }
- "Delete all read notifications": { confirm: true }

## NOTES:
- Always confirm with user - this is irreversible
- Only affects READ notifications, unread ones are preserved
- Use with caution`,

  inputSchema: ClearAllNotificationsInputSchema,
});

// =============================================================================
// Case CRUD Tool Definitions
// =============================================================================

/**
 * Create Case Tool
 *
 * Creates a new PERM case with the provided data.
 * Requires confirmation before execution.
 */
export const createCaseTool = tool({
  description: `Create a new PERM case in the system.

## WHEN TO USE:
- User explicitly asks to create a new case: "Create a case for TechCorp"
- User wants to add a new case: "Add a new case for John at ACME"
- User provides case details and wants to save: "Start a new PWD case"
- User confirms after you've gathered required info

## WHEN NOT TO USE:
- User is just asking questions about cases (use queryCases)
- User wants to edit an existing case (use updateCase)
- User hasn't provided required fields (ask for them first)
- You're unsure if user wants to create (ask to confirm intent)

## REQUIRED FIELDS:
- employerName: Sponsoring employer name
- positionTitle: Job title

## OPTIONAL FIELDS:
- foreignWorkerId: Foreign worker name or initials (optional)

## OPTIONAL FIELDS:
All dates should be YYYY-MM-DD format. See input schema for full list.

## EXAMPLES:
- "Create case for TechCorp, John Doe, Software Engineer":
  { employerName: "TechCorp", foreignWorkerId: "John Doe", positionTitle: "Software Engineer" }
- "Add a PWD case for ACME":
  { employerName: "ACME", positionTitle: "[ask user]", caseStatus: "pwd" }

## NOTES:
- Always confirm details with user before creating
- Default caseStatus is "pwd" (earliest stage)
- Default progressStatus is "working"
- PWD expiration auto-calculates from determination date`,

  inputSchema: CreateCaseInputSchema,
});

/**
 * Update Case Tool
 *
 * Updates an existing PERM case with new data.
 * Only include fields that need to change.
 */
export const updateCaseTool = tool({
  description: `Update an existing PERM case with new information.

## COMPREHENSIVE FIELD SUPPORT

This tool supports updating ALL case fields including:
- Core identity (employer, foreign worker, position)
- Status fields (caseStatus, progressStatus, priority)
- All dates (PWD, recruitment, ETA 9089, I-140)
- Flags (favorite, pinned, professional, calendar sync)
- Case numbers (PWD, ETA, I-140, internal)
- RFI/RFE entries (add, update, remove, or clear)
- Case notes/journal (add, update, soft delete)
- Tags (full array replacement)

## WHEN TO USE:
- User asks to change case data: "Update the TechCorp case status to recruitment"
- User provides new dates: "Set the PWD determination date to 2024-06-15"
- User wants to correct information: "Change the employer name to TechCorp Inc"
- User advances case stage: "Mark this case as filed"
- User manages RFI/RFE: "Add an RFI received today", "Clear the RFI", "Mark RFI as responded"
- User manages notes: "Add a note about client meeting", "Mark that note as done"
- User updates progress: "Remove the RFI/RFE status", "Change progress to working"

## WHEN NOT TO USE:
- User wants to create a new case (use createCase)
- User wants to delete/archive a case (use archiveCase)
- You don't have the caseId (use queryCases first to find it)
- User is asking about case data (use queryCases)

## REQUIRED:
- caseId: Must have the Convex ID of the case to update

## RFI/RFE MANAGEMENT

### RFI (Request for Information from DOL):
- responseDueDate is AUTO-CALCULATED (+30 days from receivedDate, strict per 20 CFR 656.20)
- Only ONE active RFI allowed (without responseSubmittedDate)
- To add: Include new entry in rfiEntries array
- To clear all: Pass rfiEntries: []
- To mark as responded: Update responseSubmittedDate

When adding new RFI entry:
\`\`\`json
{
  "id": "rfi_1234567890_abc123",  // Generate unique ID
  "receivedDate": "2024-08-15",   // Required
  "responseDueDate": "2024-09-14", // Auto-calculated: receivedDate + 30 days
  "title": "Documentation Request", // Optional
  "createdAt": 1723747200000       // Date.now()
}
\`\`\`

### RFE (Request for Evidence from USCIS):
- responseDueDate is USER-PROVIDED (varies by case)
- Only ONE active RFE allowed
- Same CRUD semantics as RFI

## NOTES/JOURNAL MANAGEMENT

Add case notes with priority and category:
\`\`\`json
{
  "id": "note_1234567890_xyz789",
  "content": "Call client about documents",
  "status": "pending",
  "priority": "high",
  "category": "follow-up",
  "dueDate": "2024-08-20",
  "createdAt": 1723747200000
}
\`\`\`

Use status: "deleted" for soft delete (preserves history).

## AUTO-CALCULATIONS

These fields trigger automatic calculations:
- pwdDeterminationDate → pwdExpirationDate (per 20 CFR 656.40)
- eta9089CertificationDate → eta9089ExpirationDate (+180 days)
- jobOrderStartDate → jobOrderEndDate (extends to +30 days)
- noticeOfFilingStartDate → noticeOfFilingEndDate (extends to +10 business days)
- RFI receivedDate → responseDueDate (+30 days strict)

## EXAMPLES

### Basic Updates:
- "Update case status": { caseId: "abc123", caseStatus: "recruitment" }
- "Set PWD date": { caseId: "abc123", pwdDeterminationDate: "2024-06-15" }
- "Update multiple fields": { caseId: "abc123", progressStatus: "filed", eta9089FilingDate: "2024-07-01" }

### RFI Management:
- "Add RFI": { caseId: "abc123", rfiEntries: [{ id: "rfi_...", receivedDate: "2024-08-15", responseDueDate: "2024-09-14", createdAt: Date.now() }] }
- "Clear RFI": { caseId: "abc123", rfiEntries: [], progressStatus: "working" }
- "Mark RFI responded": Fetch current entries, update responseSubmittedDate, send full array

### Notes:
- "Add note": { caseId: "abc123", notes: [...existingNotes, { id: "note_...", content: "Follow up", status: "pending", createdAt: Date.now() }] }

## NOTES:
- Only include fields you want to change
- Use queryCases first if you need to find the case ID
- Dates must be YYYY-MM-DD format
- For arrays (rfiEntries, rfeEntries, notes), send the FULL updated array
- pwdWageAmount is in cents (e.g., 7500000 = $75,000)`,

  inputSchema: UpdateCaseInputSchema,
});

/**
 * Archive Case Tool
 *
 * Closes a case by setting caseStatus to "closed".
 */
export const archiveCaseTool = tool({
  description: `Close/archive a PERM case by setting its status to "closed".

## WHEN TO USE:
- User wants to close a case: "Close the TechCorp case"
- User wants to archive a case: "Archive this case"
- Case is complete or no longer active

## WHEN NOT TO USE:
- User wants to permanently delete a case (use deleteCase)
- You don't have the caseId (use queryCases first)
- Case is already closed (check status first)

## BEHAVIOR:
- Sets caseStatus to "closed"
- Case remains in database and can be reopened with reopenCase
- Case still appears in queries but with closed status

## EXAMPLES:
- "Close the TechCorp case": { caseId: "abc123" }
- "Archive this case": { caseId: "xyz789", reason: "No longer active" }

## NOTES:
- Always confirm with user before closing
- Can be reopened with reopenCase if needed`,

  inputSchema: ArchiveCaseInputSchema,
});

/**
 * Reopen Case Tool
 *
 * Reopens a closed case, recalculating the appropriate status.
 */
export const reopenCaseTool = tool({
  description: `Reopen a closed PERM case.

## WHEN TO USE:
- User wants to reopen a completed case: "Reopen the TechCorp case"
- Case was closed prematurely: "This case isn't actually done"
- Need to continue work on a closed case

## WHEN NOT TO USE:
- Case is not closed (already active)
- Case is archived/deleted (use restoreCase)
- You don't have the caseId

## BEHAVIOR:
- Recalculates appropriate caseStatus based on case data
- Determines correct progressStatus based on PERM workflow
- For example: if I-140 is approved, stays at i140 stage

## EXAMPLES:
- "Reopen case": { caseId: "abc123" }

## NOTES:
- Only works on cases with caseStatus: "closed"
- Status is automatically determined based on case data`,

  inputSchema: ReopenCaseInputSchema,
});

/**
 * Delete Case Tool
 *
 * Permanently deletes a case. DESTRUCTIVE - always requires confirmation.
 */
export const deleteCaseTool = tool({
  description: `PERMANENTLY delete a PERM case. This cannot be undone!

## WHEN TO USE:
- User explicitly requests permanent deletion
- User confirms they want data removed forever
- After user acknowledges this is irreversible

## WHEN NOT TO USE:
- User just wants to "delete" a case (use archiveCase for soft delete)
- User hasn't confirmed they want permanent deletion
- You're unsure of user's intent

## BEHAVIOR:
- Case is permanently removed from database
- All associated data is deleted
- Calendar events are deleted
- CANNOT BE UNDONE

## EXAMPLES:
- "Permanently delete": { caseId: "abc123" }

## NOTES:
- ALWAYS use archiveCase first unless user explicitly says "permanent"
- ALWAYS ask for confirmation before executing
- This is a DESTRUCTIVE action`,

  inputSchema: DeleteCaseInputSchema,
});

// =============================================================================
// Settings Tool Definitions
// =============================================================================

/**
 * Update Settings Tool
 *
 * Updates user settings and preferences.
 */
export const updateSettingsTool = tool({
  description: `Update user settings and preferences.

## WHEN TO USE:
- User asks to change notification settings: "Turn off email notifications"
- User wants to adjust calendar sync: "Enable calendar sync"
- User requests preference changes: "Set urgent deadline reminder to 5 days"
- User wants to configure quiet hours: "Enable quiet hours from 10pm to 8am"

## WHEN NOT TO USE:
- User is asking what their current settings are (use getSettings)
- User wants account-level changes (password, email) - those are not available here
- User asks about settings without wanting to change them

## SETTINGS CATEGORIES:
- Notifications: emailNotificationsEnabled, pushNotificationsEnabled, emailDeadlineReminders
- Calendar: calendarSyncEnabled, calendarSyncPwd, calendarSyncEta9089
- Preferences: darkModeEnabled, urgentDeadlineDays, reminderDaysBefore, quietHoursEnabled, quietHoursStart, quietHoursEnd

## EXAMPLES:
- "Turn off email notifications": { settings: { emailNotificationsEnabled: false } }
- "Enable push notifications and set urgent to 7 days": { settings: { pushNotificationsEnabled: true, urgentDeadlineDays: 7 } }
- "Disable calendar sync for PWD": { settings: { calendarSyncPwd: false } }

## NOTES:
- Only include settings that need to change
- Changes take effect immediately
- Some settings may require page refresh to be visible`,

  inputSchema: UpdateSettingsInputSchema,
});

/**
 * Get Settings Tool
 *
 * Retrieves current user settings.
 */
export const getSettingsTool = tool({
  description: `Get current user settings and preferences.

## WHEN TO USE:
- User asks what their current settings are: "What are my notification settings?"
- User wants to check a specific setting: "Is calendar sync enabled?"
- Before suggesting changes, to know current state
- User asks about their preferences: "Show my current preferences"

## WHEN NOT TO USE:
- User wants to CHANGE settings (use updateSettings)
- User is asking about case data (use queryCases)

## CATEGORIES:
- all: Returns all settings (default)
- notifications: Email and push notification settings
- calendar: Calendar sync settings
- preferences: Dark mode, deadline days, quiet hours

## EXAMPLES:
- "What are my settings?": { } or { category: "all" }
- "Show notification settings": { category: "notifications" }
- "Is calendar sync on?": { category: "calendar" }

## NOTES:
- Returns structured settings object
- Use before updateSettings to show current vs. proposed changes`,

  inputSchema: GetSettingsInputSchema,
});

// =============================================================================
// Bulk Operation Tool Definitions
// =============================================================================

/**
 * Bulk Update Status Tool
 *
 * Updates status for multiple cases at once.
 * DESTRUCTIVE - Always requires confirmation.
 */
export const bulkUpdateStatusTool = tool({
  description: `Update status for multiple cases at once.

## DESTRUCTIVE ACTION - Always requires confirmation

## WHEN TO USE:
- User asks to update status for multiple cases: "Change all PWD cases to recruitment"
- User wants to advance multiple cases: "Move all my cases to i140"

## WHEN NOT TO USE:
- Single case update (use updateCase instead)
- User hasn't specified the target status

## PARAMETERS:
Use EITHER "all" OR "caseIds", not both:
- all: true → Applies to ALL user's cases
- all: true + filterByStatus: "pwd" → Only PWD cases
- caseIds: ["id1", "id2"] → Specific cases only

## EXAMPLES:
- "Update all PWD cases to recruitment": { all: true, filterByStatus: "pwd", status: "recruitment" }
- "Move all my cases to i140": { all: true, status: "i140" }
- "Update these specific cases": { caseIds: ["id1", "id2"], status: "recruitment" }

## NOTES:
- PREFER { all: true } over querying IDs first - it's simpler and more efficient
- Always confirm with user before executing`,

  inputSchema: BulkUpdateStatusInputSchema,
});

/**
 * Bulk Archive Cases Tool
 *
 * Archives (closes) multiple cases at once.
 * DESTRUCTIVE - Always requires confirmation.
 */
export const bulkArchiveCasesTool = tool({
  description: `Archive (close) multiple cases at once.

## DESTRUCTIVE ACTION - Always requires confirmation

## WHEN TO USE:
- User asks to archive/close multiple cases: "Close all completed cases"
- User wants to clean up old cases: "Archive all i140 cases"

## WHEN NOT TO USE:
- Single case (use archiveCase instead)
- User wants to permanently delete (use bulkDeleteCases instead)

## PARAMETERS:
Use EITHER "all" OR "caseIds", not both:
- all: true → Applies to ALL user's cases
- all: true + filterByStatus: "i140" → Only I-140 cases
- caseIds: ["id1", "id2"] → Specific cases only

## EXAMPLES:
- "Archive all completed cases": { all: true, filterByStatus: "i140", reason: "Completed" }
- "Close all my cases": { all: true }
- "Archive these specific cases": { caseIds: ["id1", "id2"] }

## NOTES:
- PREFER { all: true } over querying IDs first - it's simpler and more efficient
- Always confirm with user before executing
- Can be undone individually with reopenCase`,

  inputSchema: BulkArchiveCasesInputSchema,
});

/**
 * Bulk Delete Cases Tool
 *
 * PERMANENTLY deletes multiple cases at once. Cannot be undone!
 * DESTRUCTIVE - Always requires confirmation with extra warning.
 */
export const bulkDeleteCasesTool = tool({
  description: `PERMANENTLY delete multiple cases at once. This cannot be undone!

## HIGHLY DESTRUCTIVE - Requires explicit confirmation with warning

## WHEN TO USE:
- User explicitly asks to permanently delete multiple cases
- User is certain about bulk deletion and has been warned

## WHEN NOT TO USE:
- User wants to archive/close (use bulkArchiveCases instead)
- User is unsure or hasn't been warned

## PARAMETERS:
Use EITHER "all" OR "caseIds", not both:
- all: true → Applies to ALL user's cases (DANGEROUS!)
- all: true + filterByStatus: "closed" → Only closed cases
- caseIds: ["id1", "id2"] → Specific cases only

## EXAMPLES:
- "Delete all closed cases permanently": { all: true, filterByStatus: "closed" }
- "Permanently delete these test cases": { caseIds: ["id1", "id2"] }

## NOTES:
- ALWAYS prefer bulkArchiveCases unless user explicitly says "permanent"
- ALWAYS ask for explicit confirmation before executing
- ALWAYS warn user this cannot be undone
- This is a HIGHLY DESTRUCTIVE action`,

  inputSchema: BulkDeleteCasesInputSchema,
});

/**
 * Bulk Calendar Sync Tool
 *
 * Enables or disables Google Calendar sync for multiple cases at once.
 * DESTRUCTIVE - Always requires confirmation.
 */
export const bulkCalendarSyncTool = tool({
  description: `Enable or disable Google Calendar sync for multiple cases at once.

## DESTRUCTIVE ACTION - Always requires confirmation

## WHEN TO USE:
- User asks to sync multiple cases to calendar: "Sync all my cases"
- User wants to enable calendar for many cases: "Add all active cases to my calendar"
- User wants to disable sync for multiple cases: "Stop syncing all closed cases"

## WHEN NOT TO USE:
- Single case (use syncToCalendar or unsyncFromCalendar instead)

## PARAMETERS:
Use EITHER "all" OR "caseIds", not both:
- all: true → Applies to ALL user's cases (no need to query first!)
- all: true + filterByStatus: "pwd" → Only PWD cases
- caseIds: ["id1", "id2"] → Specific cases only

## EXAMPLES:
- "Sync all my cases": { all: true, enabled: true }
- "Sync all recruitment cases": { all: true, filterByStatus: "recruitment", enabled: true }
- "Stop syncing these specific cases": { caseIds: ["id1", "id2"], enabled: false }

## NOTES:
- PREFER { all: true } over querying IDs first - it's simpler and more efficient
- Always confirm with user before executing
- User must have Google Calendar connected for sync to work`,

  inputSchema: BulkCalendarSyncInputSchema,
});

// =============================================================================
// Job Description Template Tool Schemas
// =============================================================================

/**
 * Schema for listJobDescriptionTemplates tool input
 */
export const ListJobDescriptionTemplatesInputSchema = z.object({
  searchQuery: z
    .string()
    .optional()
    .describe('Optional search query to filter templates by name (position title)'),
});

export type ListJobDescriptionTemplatesInput = z.infer<typeof ListJobDescriptionTemplatesInputSchema>;

/**
 * Schema for createJobDescriptionTemplate tool input
 */
export const CreateJobDescriptionTemplateInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('Template name (usually the position title, e.g., "Software Engineer")'),
  description: z
    .string()
    .min(1)
    .max(10000)
    .describe('Job description text (max 10,000 characters)'),
});

export type CreateJobDescriptionTemplateInput = z.infer<typeof CreateJobDescriptionTemplateInputSchema>;

/**
 * Schema for updateJobDescriptionTemplate tool input
 */
export const UpdateJobDescriptionTemplateInputSchema = z.object({
  templateId: z.string().describe('The Convex ID of the template to update'),
  name: z
    .string()
    .min(1)
    .optional()
    .describe('New template name (position title)'),
  description: z
    .string()
    .min(1)
    .max(10000)
    .optional()
    .describe('New job description text'),
});

export type UpdateJobDescriptionTemplateInput = z.infer<typeof UpdateJobDescriptionTemplateInputSchema>;

/**
 * Schema for deleteJobDescriptionTemplate tool input
 */
export const DeleteJobDescriptionTemplateInputSchema = z.object({
  templateId: z.string().describe('The Convex ID of the template to delete'),
});

export type DeleteJobDescriptionTemplateInput = z.infer<typeof DeleteJobDescriptionTemplateInputSchema>;

// =============================================================================
// Job Description Template Tool Definitions
// =============================================================================

/**
 * List Job Description Templates Tool
 *
 * Lists all job description templates for the user.
 */
export const listJobDescriptionTemplatesTool = tool({
  description: `List the user's job description templates.

## WHEN TO USE:
- User asks about their job description templates: "Show my templates", "What job descriptions do I have saved?"
- User wants to find a specific template: "Do I have a Software Engineer template?"
- Before suggesting to use or modify a template
- User wants to see available templates to populate a case

## WHEN NOT TO USE:
- User wants to create a new template (use createJobDescriptionTemplate)
- User is asking about case data (use queryCases)
- User wants to update a template (use updateJobDescriptionTemplate)

## PARAMETERS:
- searchQuery (optional): Filter templates by name (position title). Case-insensitive partial match.

## OUTPUT FORMAT:
{
  templates: [{ _id, name, description, usageCount, createdAt, updatedAt }],
  count: number
}

## EXAMPLES:
- "Show my templates": { }
- "Do I have engineer templates?": { searchQuery: "engineer" }
- "Find Software Engineer template": { searchQuery: "Software Engineer" }`,

  inputSchema: ListJobDescriptionTemplatesInputSchema,
});

/**
 * Create Job Description Template Tool
 *
 * Creates a new job description template.
 */
export const createJobDescriptionTemplateTool = tool({
  description: `Create a new job description template.

## WHEN TO USE:
- User asks to save a job description as a template: "Save this as a template"
- User wants to create a new template: "Create a Software Engineer template"
- User provides job description content to save for reuse

## WHEN NOT TO USE:
- User wants to update an existing template (use updateJobDescriptionTemplate)
- User wants to see existing templates (use listJobDescriptionTemplates)
- User wants to apply a template to a case (use updateCase with jobDescription fields)

## PARAMETERS:
- name (required): Template name - usually the position title (e.g., "Software Engineer", "Data Analyst")
- description (required): The job description text (max 10,000 characters)

## BEHAVIOR:
- Creates a new template with the given name and description
- Template names must be unique per user (case-insensitive)
- If a template with the same name exists, will fail with an error

## EXAMPLES:
- "Create a Software Engineer template":
  { name: "Software Engineer", description: "[job description text]" }
- "Save this job description for Data Analyst":
  { name: "Data Analyst", description: "[job description text]" }

## NOTES:
- Always confirm the name and description with the user before creating
- Template names should be descriptive (usually position titles)
- Max 10,000 characters for description`,

  inputSchema: CreateJobDescriptionTemplateInputSchema,
});

/**
 * Update Job Description Template Tool
 *
 * Updates an existing job description template.
 */
export const updateJobDescriptionTemplateTool = tool({
  description: `Update an existing job description template.

## WHEN TO USE:
- User asks to modify a template: "Update my Software Engineer template"
- User wants to change a template's name or description
- User wants to improve or correct an existing template

## WHEN NOT TO USE:
- User wants to create a new template (use createJobDescriptionTemplate)
- User wants to delete a template (use deleteJobDescriptionTemplate)
- User wants to see templates (use listJobDescriptionTemplates)

## PARAMETERS:
- templateId (required): The Convex ID of the template to update
- name (optional): New template name
- description (optional): New job description text

## BEHAVIOR:
- Updates only the fields provided
- At least one of name or description must be provided
- If name is changed, must not conflict with existing template names

## EXAMPLES:
- "Update the description": { templateId: "abc123", description: "[new text]" }
- "Rename template": { templateId: "abc123", name: "Senior Software Engineer" }
- "Update both": { templateId: "abc123", name: "Senior Software Engineer", description: "[new text]" }

## NOTES:
- Use listJobDescriptionTemplates first if you need to find the template ID
- Only include fields that need to change`,

  inputSchema: UpdateJobDescriptionTemplateInputSchema,
});

/**
 * Delete Job Description Template Tool
 *
 * Deletes a job description template (soft delete).
 */
export const deleteJobDescriptionTemplateTool = tool({
  description: `Delete a job description template.

## WHEN TO USE:
- User explicitly asks to delete a template: "Delete my old template"
- User wants to remove a template they no longer need

## WHEN NOT TO USE:
- User wants to update a template (use updateJobDescriptionTemplate)
- User is unsure which template to delete (use listJobDescriptionTemplates first)

## PARAMETERS:
- templateId (required): The Convex ID of the template to delete

## BEHAVIOR:
- Performs a soft delete (template is marked as deleted but not removed)
- Cannot be undone from the chat interface
- Template will no longer appear in lists

## EXAMPLES:
- "Delete the old template": { templateId: "abc123" }

## NOTES:
- Always confirm with user before deleting
- Use listJobDescriptionTemplates first to find the template ID
- This is a destructive action`,

  inputSchema: DeleteJobDescriptionTemplateInputSchema,
});

// =============================================================================
// Exports
// =============================================================================

/**
 * All chat tools bundled together for use in streamText
 */
export const chatTools = {
  // Query tools (autonomous)
  queryCases: queryCasesTool,
  searchKnowledge: searchKnowledgeTool,
  searchWeb: searchWebTool,

  // Navigation tools (autonomous)
  navigate: navigateTool,
  viewCase: viewCaseTool,
  scrollTo: scrollToTool,
  refreshPage: refreshPageTool,

  // Case CRUD tools (require confirmation)
  createCase: createCaseTool,
  updateCase: updateCaseTool,
  archiveCase: archiveCaseTool,
  reopenCase: reopenCaseTool,

  // Calendar tools (require confirmation)
  syncToCalendar: syncToCalendarTool,
  unsyncFromCalendar: unsyncFromCalendarTool,

  // Notification tools (mixed permissions)
  markNotificationRead: markNotificationReadTool,
  markAllNotificationsRead: markAllNotificationsReadTool,
  deleteNotification: deleteNotificationTool,
  clearAllNotifications: clearAllNotificationsTool,

  // Destructive tools (always require confirmation)
  deleteCase: deleteCaseTool,

  // Bulk operation tools (DESTRUCTIVE - always require confirmation)
  bulkUpdateStatus: bulkUpdateStatusTool,
  bulkArchiveCases: bulkArchiveCasesTool,
  bulkDeleteCases: bulkDeleteCasesTool,
  bulkCalendarSync: bulkCalendarSyncTool,

  // Settings tools
  updateSettings: updateSettingsTool,
  getSettings: getSettingsTool,

  // Job description template tools
  listJobDescriptionTemplates: listJobDescriptionTemplatesTool,
  createJobDescriptionTemplate: createJobDescriptionTemplateTool,
  updateJobDescriptionTemplate: updateJobDescriptionTemplateTool,
  deleteJobDescriptionTemplate: deleteJobDescriptionTemplateTool,
};

/**
 * Tool name type for type-safe tool handling
 */
export type ChatToolName = keyof typeof chatTools;
