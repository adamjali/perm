/**
 * App Guide Knowledge Sections for RAG
 *
 * Structured knowledge base containing PERM Tracker app usage guides,
 * page documentation, feature guides, and workflow instructions.
 * Each section is sized for optimal embedding (400-512 tokens).
 *
 * Source: App documentation and UI patterns
 */

import type { PERMKnowledgeSection } from './permKnowledge';

export type AppGuideSection = PERMKnowledgeSection;

export const APP_GUIDE_SECTIONS: AppGuideSection[] = [
  // ============================================================
  // PAGE GUIDES (1-10)
  // ============================================================

  // Section 1: Dashboard Overview
  {
    title: "Dashboard Overview",
    content: `The Dashboard is your command center for tracking all PERM cases at a glance. It provides immediate visibility into deadlines, case statuses, and recent activity.

Key Dashboard Components:

1. Deadline Hub (Left Panel)
- Groups deadlines by urgency: Overdue, This Week, This Month, Later
- Each deadline shows case name, beneficiary, deadline type, and due date
- Click any deadline to navigate directly to that case
- Overdue deadlines appear in red with warning indicators

2. Summary Tiles (Top Section)
- Six tiles showing case counts by stage: PWD, Recruitment, ETA 9089, I-140, Complete, Archived
- Each tile shows subtotals (e.g., "5 filed, 2 working on it")
- Click any tile to filter the cases list to that status

3. Recent Activity Feed (Right Panel)
- Shows latest case updates, status changes, and notifications
- Displays timestamp and action summary
- Click entries to view the related case

4. Add Case Button
- Prominent button in the header or empty state
- Opens the case creation form
- To add a case: Click "Add Case" -> Fill required fields -> Save

Related: Cases List, Case Detail, Notifications`,
    metadata: {
      source: "app_guide",
      section: "app-dashboard",
    },
  },

  // Section 2: Cases List Page
  {
    title: "Cases List Page Navigation",
    content: `The Cases List page displays all your PERM cases in a filterable, sortable grid layout with card-based display.

Page Layout:

1. Cases Grid
- Responsive grid showing case cards (1-4 columns based on screen size)
- Each card shows: Beneficiary name, Employer, Status badge, Progress status, Next deadline
- Click any card to open the full case detail view
- Favorite star icon in top-right corner of each card

2. Pagination Controls
- Page numbers at bottom of grid
- Page size selector: 10, 25, 50, or 100 cases per page
- Navigation arrows for first/previous/next/last page
- Current page indicator and total count

3. View Controls (Top Bar)
- Grid/List view toggle (if available)
- Sort dropdown: By name, status, deadline, created date
- Bulk selection mode toggle

4. Filter Sidebar (if expanded)
- Status filter checkboxes (PWD, Recruitment, ETA 9089, I-140)
- Progress status filter
- Favorites only toggle
- Clear all filters button

To find a specific case:
1. Use the search box to search by beneficiary or employer name
2. Apply status/progress filters to narrow results
3. Sort by deadline to see most urgent cases first
4. Check "Favorites only" to see starred cases

Related: Case Detail, Filtering and Sorting, Bulk Operations`,
    metadata: {
      source: "app_guide",
      section: "app-cases-list",
    },
  },

  // Section 3: Case Detail View
  {
    title: "Case Detail View and Sections",
    content: `The Case Detail view shows complete information for a single PERM case, organized into collapsible sections for easy navigation.

Page Structure:

1. Header Section
- Beneficiary and employer names prominently displayed
- Status badge (PWD, Recruitment, ETA 9089, I-140, Closed)
- Progress status tag (Working on it, Filed, Approved, RFI/RFE)
- Favorite star toggle
- Actions menu (Edit, Export, Archive, Delete)

2. Timeline (Inline or Side Panel)
- Visual timeline showing case progression
- Milestone markers for key dates (PWD filed, Recruitment started, etc.)
- Current stage highlighted
- Click milestones to jump to that section

3. Collapsible Sections
- PWD Section: Filing date, determination date, expiration (auto-calculated)
- Recruitment Section: Notice of filing, job order, Sunday ads, additional methods
- ETA 9089 Section: Filing date, certification, expiration, RFI entries
- I-140 Section: Filing date, approval date, RFE entries
- Case Info: Employer details, job title, SOC code, wage info

4. Deadline Display
- Next deadline prominently shown with countdown
- All upcoming deadlines listed with dates
- Overdue deadlines highlighted in red

To edit case information:
1. Click "Edit" in the actions menu OR
2. Click the edit icon on any section header
3. Make changes in the form
4. Click "Save" to apply changes

Related: Case Form, RFI/RFE Management, Filing Windows`,
    metadata: {
      source: "app_guide",
      section: "app-case-detail",
    },
  },

  // Section 4: Case Create/Edit Form
  {
    title: "Case Create and Edit Form",
    content: `The Case Form is used for both creating new cases and editing existing ones. It includes intelligent date auto-calculation and validation.

Form Sections:

1. Basic Information
- Beneficiary name (required): Foreign worker's name
- Employer name (required): Sponsoring company
- Job title, SOC code, wage offered
- Professional occupation checkbox (triggers additional recruitment methods)

2. PWD Section
- PWD filing date: When application was submitted
- PWD determination date: When wage was approved
- PWD expiration date: Auto-calculated (cannot be edited manually)

3. Recruitment Section
- Notice of Filing: Start date and end date (auto-calculated +10 business days)
- Job Order: Start date and end date (auto-calculated +30 days)
- First Sunday Ad: Must be a Sunday
- Second Sunday Ad: Must be Sunday, at least 7 days after first
- Additional Methods (if professional): Select 3 different methods with dates

4. ETA 9089 Section
- Filing date: Must be 30+ days after last recruitment
- Certification date: When approved
- RFI entries: Received date, due date (strict 30 days), submitted date

5. I-140 Section
- Filing date: Must be after ETA 9089 certification
- Approval date: Final approval
- RFE entries: Received date, due date (editable), submitted date

Date Pickers:
- Click the calendar icon to open date picker
- Dates that violate rules are disabled (e.g., Sundays only for Sunday ads)
- Invalid dates show error messages below the field

Auto-Calculation: When you enter certain dates, related dates are calculated automatically. For example, entering PWD determination date calculates expiration.

Related: Date Validation, Filing Windows, Professional Occupation`,
    metadata: {
      source: "app_guide",
      section: "app-case-form",
    },
  },

  // Section 5: Calendar Page
  {
    title: "Calendar Page and Views",
    content: `The Calendar page provides a visual timeline of all deadlines and case milestones across your cases.

Calendar Views:

1. Month View (Default)
- Full month grid showing all days
- Deadlines appear as colored dots/badges on their dates
- Click a date to see all deadlines for that day
- Navigate months with arrow buttons

2. Week View
- Seven-day horizontal view
- More detail per day than month view
- Shows deadline titles and case names
- Scroll vertically to see more events

3. Day View
- Single day with hourly breakdown
- Most detailed view for busy days
- Shows full deadline information

View Controls:
- View selector: Month, Week, Day buttons
- Today button: Jump to current date
- Navigation arrows: Move forward/backward in time
- Date range indicator: Shows current viewing period

Deadline Colors:
- Red: Overdue deadlines
- Orange: Due within 7 days
- Yellow: Due within 30 days
- Blue: Future deadlines
- Green: Completed milestones

Google Calendar Sync Banner:
- Appears at top if calendar sync is not configured
- Click "Connect Google Calendar" to enable sync
- Once connected, deadlines sync automatically to your Google Calendar

To view deadline details:
1. Click on a deadline in any view
2. A popup shows full details: case name, deadline type, date, status
3. Click "View Case" to open the case detail page

Related: Calendar Sync, Notification Settings, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "app-calendar",
    },
  },

  // Section 6: Timeline Gantt Chart
  {
    title: "Timeline Gantt Chart Visualization",
    content: `The Timeline page displays a Gantt chart view showing case progress across time, allowing comparison of multiple cases and identification of scheduling conflicts.

Timeline Components:

1. Case Rows
- Each case appears as a horizontal row
- Case name and beneficiary shown on the left
- Colored bars represent different stages (PWD, Recruitment, ETA 9089, I-140)
- Bar length corresponds to duration

2. Stage Colors
- Blue: PWD stage
- Purple: Recruitment stage
- Orange/Yellow: ETA 9089 stage
- Green: I-140 stage
- Gray: Completed or closed

3. Milestone Markers
- Diamond shapes on the timeline
- Mark key dates: PWD determination, recruitment complete, certification, approval
- Hover to see milestone details

4. Zoom Controls
- Zoom in/out buttons to adjust time scale
- Zoom levels: Days, Weeks, Months, Quarters
- Scroll horizontally to navigate timeline

5. Date Range Selector
- Start and end date inputs
- Quick presets: This month, This quarter, This year
- Custom range selection

6. Case Selection
- Checkbox to show/hide individual cases
- "Select All" / "Deselect All" buttons
- Filter to show only cases with upcoming deadlines

Reading the Timeline:
- Longer bars = longer duration in that stage
- Gaps between bars = waiting periods
- Overlapping deadlines across cases show potential workload conflicts
- Click any bar to navigate to case detail

To compare specific cases:
1. Use case selection checkboxes to show only relevant cases
2. Adjust date range to focus on a time period
3. Zoom to appropriate level for detail needed

Related: Calendar, Case Detail, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "app-timeline",
    },
  },

  // Section 7: Notifications Page
  {
    title: "Notifications Page and Management",
    content: `The Notifications page displays all system notifications organized by date and read status, with bulk management capabilities.

Page Layout:

1. Tab Navigation
- All: Shows all notifications
- Unread: Only unread notifications
- Deadlines: Deadline reminders only
- Status Changes: Case status updates only
- RFI/RFE: Request notifications only

2. Date Grouping
- Notifications grouped by: Today, Yesterday, This Week, This Month, Older
- Most recent appear at top
- Expandable/collapsible date sections

3. Notification Cards
- Icon indicating type (deadline, status change, RFI, system)
- Title and message text
- Timestamp showing when notification was created
- Read/unread indicator (dot or highlight)
- Click to expand details or navigate to related case

4. Bulk Actions (Top Bar)
- Mark all as read button
- Select mode toggle for bulk operations
- Clear all read notifications option
- Notification settings link

Individual Notification Actions:
- Click notification to mark as read and expand
- "View Case" button to navigate to related case
- Dismiss/delete individual notifications
- Hover for quick actions

To manage notifications:
1. Click "Mark All Read" to clear unread indicator on all
2. Use tabs to filter by notification type
3. Click individual notifications to see details and mark as read
4. Enable/disable notification types in Settings

Notification Priority Indicators:
- Red badge: Urgent (overdue deadlines)
- Orange badge: High priority (due within 7 days)
- Blue badge: Normal priority
- Gray badge: Low priority / informational

Related: Notification Settings, Dashboard, Case Detail`,
    metadata: {
      source: "app_guide",
      section: "app-notifications",
    },
  },

  // Section 8: Settings Overview
  {
    title: "Settings Page Overview",
    content: `The Settings page provides configuration options organized into six tabs for personalizing your PERM Tracker experience.

Settings Tabs:

1. Profile Tab
- Display name and email address
- Profile picture upload
- Time zone selection
- Language preference (if available)
- Account information

2. Notifications Tab
- Email notification toggles for different event types
- Push notification enable/disable
- Notification frequency settings
- Reminder timing (days before deadline)
- Urgent threshold configuration

3. Quiet Hours Tab
- Enable/disable quiet hours
- Start time and end time settings
- Time zone for quiet hours
- Days of week selection
- During quiet hours, non-urgent notifications are held

4. Calendar Sync Tab
- Google Calendar connection status
- Connect/Disconnect button
- Sync settings (which deadline types to sync)
- Per-case sync toggle information
- Sync frequency and last sync time

5. Auto-Close Tab
- Enable/disable automatic case closure
- Auto-close trigger settings
- Warning notification preferences
- List of cases closed by auto-close
- Reopen options for auto-closed cases

6. Support Tab
- Help documentation links
- Contact support form
- Bug report submission
- Feature request form
- App version and changelog

To navigate settings:
1. Click Settings in the user dropdown menu
2. Select the tab for the area you want to configure
3. Make changes and click "Save" (some settings save automatically)

Related: Notification Settings, Calendar Sync, Quiet Hours, Auto-Close`,
    metadata: {
      source: "app_guide",
      section: "app-settings",
    },
  },

  // Section 9: Chat Widget
  {
    title: "AI Chat Widget Usage",
    content: `The Chat widget provides an AI assistant that can answer questions about your cases, PERM regulations, and app functionality.

Chat Interface:

1. Opening/Closing
- Click the chat icon (typically bottom-right corner) to open
- Click X or outside the chat to close
- Chat history persists across sessions

2. Message Input
- Type your question in the text box
- Press Enter or click Send to submit
- Supports multi-line input with Shift+Enter

3. AI Responses
- Responses appear with typing indicator while processing
- Markdown formatting for readability
- Code snippets and lists when applicable
- Sources cited when referencing PERM regulations

4. Tool Calls Display
- When the AI needs to look up case data, tool calls are shown
- "Looking up case..." indicators during search
- Results displayed inline with the response

5. Chat History
- Scroll up to see previous messages
- Clear history button to start fresh
- History saved per session

What You Can Ask:
- "What are the deadlines for [beneficiary name]'s case?"
- "When does PWD expire for [case]?"
- "What are the Sunday ad requirements?"
- "How do I add an RFI?"
- "What is the 30-day waiting period?"

Tips for Better Responses:
- Be specific with case names or beneficiary names
- Ask one question at a time for clearer answers
- Reference specific dates or stages when asking about deadlines

To clear chat history:
1. Click the menu icon in the chat header
2. Select "Clear History"
3. Confirm the action

Related: Dashboard, Case Detail, PERM Knowledge`,
    metadata: {
      source: "app_guide",
      section: "app-chat",
    },
  },

  // Section 10: Header Navigation
  {
    title: "Header Navigation and User Menu",
    content: `The header provides primary navigation, notifications access, and user account controls.

Header Components:

1. Logo/Home Link (Left)
- Click logo to return to Dashboard
- Always visible regardless of current page

2. Main Navigation Links
- Dashboard: Overview and deadline hub
- Cases: Full cases list with filters
- Calendar: Visual deadline calendar
- Timeline: Gantt chart view

3. Search Box (Center or Right)
- Quick search for cases by name
- Type to see instant results
- Press Enter or click result to navigate

4. Notification Bell (Right Section)
- Shows unread count as badge
- Click to open notifications dropdown
- "View All" link to full notifications page
- Mark individual as read from dropdown

5. User Dropdown Menu (Far Right)
- Profile name or avatar displayed
- Click to expand menu options:
  - Settings: Open settings page
  - Profile: Edit profile information
  - Theme Toggle: Switch dark/light mode
  - Sign Out: Log out of the application

6. Theme Toggle
- Switch between light and dark mode
- Preference saved to your account
- May be in user dropdown or as separate icon

Keyboard Shortcuts (if enabled):
- Cmd/Ctrl + K: Open search
- G then D: Go to Dashboard
- G then C: Go to Cases
- G then L: Go to Calendar

Mobile Navigation:
- Hamburger menu icon on smaller screens
- Opens slide-out navigation drawer
- Same links as desktop header

Related: Dashboard, Cases List, Notifications, Settings`,
    metadata: {
      source: "app_guide",
      section: "app-navigation",
    },
  },

  // ============================================================
  // FEATURE GUIDES (11-22)
  // ============================================================

  // Section 11: Filtering and Sorting
  {
    title: "Filtering and Sorting Cases",
    content: `The cases list provides powerful filtering and sorting to help you find specific cases quickly.

Filter Options:

1. Status Filter
- Checkboxes for each case status: PWD, Recruitment, ETA 9089, I-140, Closed
- Multiple selections allowed (e.g., PWD AND Recruitment)
- Shows count of cases matching each status

2. Progress Status Filter
- Filter by: Working on it, Waiting for intake, Filed, Approved, Under review, RFI/RFE
- Combines with status filter for precise filtering

3. Search Box
- Searches beneficiary name and employer name
- Real-time filtering as you type
- Clear button to reset search

4. Favorites Filter
- Toggle to show only starred/favorite cases
- Combines with other filters

5. Date Range Filter (if available)
- Filter by case creation date
- Filter by next deadline date range

Sort Options:

1. Sort Dropdown
- Beneficiary Name (A-Z, Z-A)
- Employer Name (A-Z, Z-A)
- Next Deadline (Soonest first, Latest first)
- Created Date (Newest, Oldest)
- Status (by stage order)

2. Sort Direction
- Ascending or Descending toggle
- Click column header to toggle (in table view)

Using Filters Effectively:
1. Click "Filters" button to expand filter panel
2. Select desired status checkboxes
3. Add progress status filter if needed
4. Type in search box for name search
5. Toggle "Favorites only" if needed
6. Use sort dropdown to order results
7. Click "Clear All Filters" to reset

Filter Persistence:
- Filters are saved during your session
- Returning to cases list remembers your filters
- Page refresh may reset filters (depends on settings)

Related: Cases List, Bulk Operations, Favorites`,
    metadata: {
      source: "app_guide",
      section: "app-filtering-sorting",
    },
  },

  // Section 12: Bulk Operations
  {
    title: "Bulk Operations and Selection",
    content: `Bulk operations allow you to perform actions on multiple cases at once, saving time when managing many cases.

Enabling Selection Mode:

1. Click "Select" or "Bulk Actions" button in the cases list header
2. Checkboxes appear on each case card
3. Selection toolbar appears at top or bottom

Selection Options:

1. Individual Selection
- Click checkbox on any case card to select/deselect
- Selected cases show visual highlight

2. Select All
- "Select All" button selects all cases on current page
- "Select All (X cases)" selects across all pages (if available)

3. Deselect All
- "Deselect All" or "Clear Selection" button
- Also cleared by exiting selection mode

Available Bulk Actions:

1. Export Selected
- Export selected cases to CSV or JSON
- Includes all case data and dates
- Download starts automatically

2. Archive Selected
- Move selected cases to archived status
- Confirmation dialog before action
- Can be undone by reopening individual cases

3. Delete Selected
- Permanently delete selected cases
- Strong confirmation required
- Cannot be undone - use with caution

4. Bulk Status Update (if available)
- Change progress status for all selected
- Useful for marking multiple as "Under review"

Performing Bulk Operations:
1. Enter selection mode
2. Select desired cases (or use Select All)
3. Click the bulk action button (Export, Archive, Delete)
4. Confirm the action in the dialog
5. Wait for completion message
6. Exit selection mode

Best Practices:
- Double-check selection before destructive actions
- Use filters to narrow cases before selecting all
- Export before deleting as a backup

Related: Import/Export, Cases List, Filtering`,
    metadata: {
      source: "app_guide",
      section: "app-bulk-operations",
    },
  },

  // Section 13: Import and Export
  {
    title: "Import and Export Cases",
    content: `The import/export feature allows you to backup cases, transfer data, and integrate with external systems.

Export Options:

1. Export Format
- JSON: Complete data with all fields, best for backup/restore
- CSV: Spreadsheet format, good for reporting and analysis

2. Export Scope
- Selected Cases: Only checked cases in selection mode
- Filtered Cases: All cases matching current filters
- All Cases: Every case in your account

3. Export Contents
- All case fields and dates
- Calculated fields (expirations, windows)
- Status and progress information
- RFI/RFE entries

To Export:
1. (Optional) Apply filters or select specific cases
2. Click "Export" button in toolbar
3. Choose format (JSON or CSV)
4. File downloads automatically
5. Check your downloads folder

Import Options:

1. Supported Formats
- JSON: Must match export format structure
- CSV: Must have required columns (beneficiary_name, employer_name)

2. Import Behavior
- Creates new cases for each row/entry
- Validates all dates and data
- Shows error report for invalid entries

3. Duplicate Detection
- Checks for matching beneficiary + employer combinations
- Options: Skip duplicates, Update existing, Create anyway

To Import:
1. Click "Import" button in toolbar
2. Select file from your computer
3. Review import preview and validation results
4. Configure duplicate handling
5. Click "Import" to confirm
6. View import summary with success/error counts

Import Validation:
- Required fields must be present
- Dates must be valid format (YYYY-MM-DD)
- Status values must match valid options
- Invalid rows are skipped with error messages

Related: Bulk Operations, Cases List, Case Form`,
    metadata: {
      source: "app_guide",
      section: "app-import-export",
    },
  },

  // Section 14: Calendar Sync
  {
    title: "Google Calendar Sync Configuration",
    content: `Calendar sync allows PERM Tracker deadlines to appear in your Google Calendar for unified schedule management.

Setting Up Calendar Sync:

1. Navigate to Settings > Calendar Sync tab
2. Click "Connect Google Calendar"
3. Sign in to your Google account in the popup
4. Grant permission to manage calendar events
5. Select which calendar to sync to (or create new)
6. Click "Save" to complete setup

Sync Settings:

1. Deadline Types to Sync
- PWD Expiration deadlines
- Recruitment deadlines (Notice, Job Order, Sunday Ads)
- ETA 9089 filing window open/close
- I-140 filing deadline
- RFI/RFE due dates

2. Reminder Settings
- Add Google Calendar reminders to synced events
- Configure reminder timing (1 day, 1 week before)

3. Per-Case Sync Toggle
- Enable/disable sync for individual cases
- Found in case detail under settings/preferences
- Useful for cases you don't want cluttering calendar

Calendar Event Details:
- Event title: "[Deadline Type] - [Beneficiary Name]"
- Event description: Case details and link back to app
- Event time: All-day event on deadline date
- Color coding matches app status colors (if supported)

Sync Frequency:
- Automatic sync when deadlines change
- Manual "Sync Now" button for immediate sync
- Last sync timestamp displayed

To Disconnect:
1. Go to Settings > Calendar Sync
2. Click "Disconnect Google Calendar"
3. Confirm disconnection
4. Events remain in Google Calendar but stop updating

Troubleshooting:
- If sync fails, try disconnecting and reconnecting
- Check Google Calendar permissions in Google Account settings
- Ensure popup blocker allows Google sign-in

Related: Calendar Page, Notification Settings, Settings`,
    metadata: {
      source: "app_guide",
      section: "app-calendar-sync",
    },
  },

  // Section 15: Notification Settings
  {
    title: "Notification Preferences Configuration",
    content: `Notification settings control how and when you receive alerts about case deadlines and updates.

Email Notification Toggles:

1. Deadline Reminders
- Enable/disable email alerts for approaching deadlines
- Configure reminder timing: 30 days, 14 days, 7 days, 1 day before

2. Status Changes
- Alerts when case status changes (PWD -> Recruitment, etc.)
- Optional progress status change notifications

3. RFI/RFE Alerts
- Immediate notification when RFI/RFE is added
- Reminder notifications as due date approaches

4. System Notifications
- Account-related updates
- Feature announcements
- Maintenance notifications

Push Notification Settings:

1. Enable Push Notifications
- Toggle to enable browser push notifications
- Requires browser permission (prompted on enable)
- Works even when app is closed

2. Push Notification Types
- Same categories as email notifications
- Can enable push for some, email for others

Reminder Configuration:

1. Reminder Days
- Set how many days before deadline to start reminders
- Default: 30, 14, 7, 1 day sequence
- Customize for your workflow

2. Urgent Threshold
- Days before deadline when notification becomes "urgent"
- Urgent notifications have different styling
- Default: 7 days

3. Overdue Notifications
- Toggle for notifications after deadline passes
- Frequency: Daily until resolved

To Configure:
1. Navigate to Settings > Notifications tab
2. Toggle desired notification types
3. Adjust reminder day settings
4. Set urgent threshold
5. Enable/disable push notifications
6. Click "Save Changes"

Note: Some notifications (like overdue) may be mandatory and cannot be disabled.

Related: Quiet Hours, Notifications Page, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "app-notification-settings",
    },
  },

  // Section 16: Quiet Hours
  {
    title: "Quiet Hours Configuration",
    content: `Quiet Hours allows you to pause non-urgent notifications during specified times, such as nights or weekends.

Quiet Hours Settings:

1. Enable Quiet Hours
- Master toggle to turn feature on/off
- When enabled, settings below take effect

2. Time Window
- Start Time: When quiet hours begin (e.g., 8:00 PM)
- End Time: When quiet hours end (e.g., 8:00 AM)
- Time displayed in your configured timezone

3. Timezone Setting
- Select your timezone for accurate quiet hours
- Important if you travel or work across timezones
- Defaults to your system timezone

4. Days of Week (if available)
- Select which days quiet hours apply
- Common: Enable only weekends
- Or: Every night of the week

Notification Behavior During Quiet Hours:

1. Held Notifications
- Non-urgent notifications are queued
- Delivered when quiet hours end
- Batched together in a summary (if enabled)

2. Urgent Notifications
- Overdue deadlines still notify immediately
- Configurable: some urgent types can be held too

3. Push Notifications
- Browser push notifications are suppressed
- Email notifications are held/delayed

To Set Up Quiet Hours:
1. Go to Settings > Quiet Hours tab
2. Enable the Quiet Hours toggle
3. Set start time (when notifications should stop)
4. Set end time (when notifications resume)
5. Verify timezone is correct
6. (Optional) Select specific days
7. Save changes

Use Cases:
- Prevent notifications during sleep hours
- Block weekend notifications for work-life balance
- Silence alerts during important meetings (temporary)

Note: You can always check the Notifications page to see held notifications even during quiet hours.

Related: Notification Settings, Notifications Page`,
    metadata: {
      source: "app_guide",
      section: "app-quiet-hours",
    },
  },

  // Section 17: Deadline Enforcement
  {
    title: "Automatic Case Closure Feature",
    content: `The Auto-Close feature automatically closes cases when critical deadlines are missed, preventing continued work on invalid cases.

Auto-Close Triggers:

1. PWD Expiration Passed
- If PWD expires before ETA 9089 is filed
- Case must be closed; recruitment cannot continue
- Must start new PERM process from scratch

2. 180-Day Recruitment Window Missed
- If ETA 9089 not filed within 180 days of first recruitment
- All recruitment becomes invalid
- Case requires restart or closure

How Auto-Close Works:

1. Detection
- System checks deadlines daily (and on case access)
- Compares current date against critical deadlines
- Evaluates if required steps were completed

2. Notification
- Email notification sent before auto-close (warning)
- Pop-up alert on next login
- Explanation of why case will be/was closed

3. Closure Action
- Case status changes to "Closed"
- Progress status changes to "Auto-Closed"
- Case moves to Archived in dashboard
- Reason recorded in case history

Settings (in Settings > Auto-Close tab):

1. Enable/Disable Auto-Close
- Toggle to turn feature on/off
- When disabled, expired cases remain open (but flagged)

2. Warning Period
- Days before auto-close to send warning
- Default: 7 days, 1 day warnings

3. View Auto-Closed Cases
- List of cases closed by this feature
- Date closed and reason shown
- Option to reopen (if appropriate)

Reopening Auto-Closed Cases:
- Navigate to case detail
- Click "Reopen Case" in actions menu
- Confirm understanding that deadlines may be expired
- Case returns to previous status

Best Practice: Address expiring cases before auto-close triggers. Use dashboard warnings and notification reminders.

Related: PWD Expiration, Deadline Tracking, Notifications`,
    metadata: {
      source: "app_guide",
      section: "app-deadline-enforcement",
    },
  },

  // Section 18: Favorites
  {
    title: "Favorites and Starred Cases",
    content: `The Favorites feature allows you to star important cases for quick access and priority tracking.

Starring a Case:

1. From Cases List
- Click the star icon in the top-right corner of any case card
- Filled star = favorited, Empty star = not favorited
- Toggle with a single click

2. From Case Detail
- Star icon in the case header
- Same toggle behavior as list view

Using Favorites:

1. Favorites Filter
- In cases list, toggle "Favorites Only" filter
- Shows only starred cases
- Combines with other filters (e.g., favorites in PWD status)

2. Sort by Favorites
- Sort option to show favorites first
- Then sorted by secondary criteria (name, deadline)

3. Dashboard Integration
- Favorites may appear in a dedicated section
- Priority visibility on dashboard

Visual Indicators:
- Filled gold/yellow star: Favorited
- Empty/outline star: Not favorited
- Star visible on cards and in detail view

Best Practices:
- Star cases with imminent deadlines
- Star high-priority clients or complex cases
- Use favorites filter for focused work sessions
- Un-star completed cases to keep list manageable

Favorites Persistence:
- Favorites saved to your account
- Persist across devices and sessions
- Not affected by filters or sorting

To Quick-Filter Favorites:
1. Navigate to Cases list
2. Click "Favorites Only" toggle or filter checkbox
3. Only starred cases display
4. Combine with search for specific favorite

Note: Favorites are personal to your account. Other users (if applicable) have their own favorites.

Related: Cases List, Filtering and Sorting, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "app-favorites",
    },
  },

  // Section 19: Status Colors
  {
    title: "Case Status and Progress Status Colors",
    content: `The app uses consistent color coding for case stages and progress statuses to provide quick visual identification.

Case Status Colors (5 Stages):

1. PWD Stage - Blue
- Case is in Prevailing Wage Determination phase
- From case creation until PWD is approved
- Badge color: Blue background with white text

2. Recruitment Stage - Purple
- Active recruitment activities ongoing
- From PWD determination through 30-day waiting period
- Badge color: Purple background with white text

3. ETA 9089 Stage - Orange/Yellow
- Ready to file or filed ETA 9089
- Orange when preparing, Yellow when actively working
- Badge color: Orange or Amber background

4. I-140 Stage - Green
- ETA 9089 certified, working on I-140
- From certification to I-140 approval
- Badge color: Green background with white text

5. Closed/Archived - Gray
- Case completed or terminated
- Includes successful completions and abandoned cases
- Badge color: Gray background with muted text

Progress Status Indicators (6 Types):

1. Working on it - Default active state
- General progress indicator
- No special color, neutral styling

2. Waiting for intake - Pending information
- Case awaiting client documents
- May show light gray or blue styling

3. Filed - Application submitted
- Auto-set when filing date entered
- May show checkmark icon

4. Approved - Application approved
- Auto-set when approval date entered
- May show success icon

5. Under review - Pending with agency
- Waiting for government response
- May show clock or pending icon

6. RFI/RFE - Additional evidence requested
- Active request outstanding
- Shown in RED for urgency

Calendar and Timeline Colors:
- Same stage colors apply in calendar view
- Timeline bars use these colors for stages
- Deadline dots/markers use urgency colors (red, orange, yellow, blue)

Related: Case Detail, Dashboard, Timeline`,
    metadata: {
      source: "app_guide",
      section: "app-status-colors",
    },
  },

  // Section 20: Filing Windows
  {
    title: "Filing Window Display and Tracking",
    content: `Filing windows show the valid time period for submitting applications, with clear visualization of opening, closing, and current status.

ETA 9089 Filing Window:

1. Window Opens
- 30 days after LAST recruitment step completes
- Displayed as "Ready to File" on dashboard
- Countdown shows "Window opens in X days" before

2. Window Closes
- EARLIER of: 180 days after FIRST recruitment OR PWD expiration
- Deadline shown prominently when window is open
- Countdown shows days remaining

3. Window Status Display
- "Waiting" (gray): 30-day waiting period active
- "Open" (green): Window currently open, can file
- "Closing Soon" (yellow): Less than 30 days remaining
- "Urgent" (red): Less than 7 days remaining
- "Closed" (red): Window has passed

Window Display in Case Detail:

1. Filing Window Section
- Visual progress bar showing window status
- Opens date and closes date displayed
- Days remaining counter
- "PWD Limited" indicator if PWD expiration is the constraint

2. Status Messages
- "30-day waiting period: X days remaining"
- "Filing window open: X days to file"
- "Window closes: [date] (PWD expiration)"

Dashboard Integration:
- "Ready to File" deadlines appear in Deadline Hub
- Summary tiles may show "X ready to file" count
- Notifications sent when window opens

30-180 Day Rule Explained:
- Must wait 30 days after recruitment ends (cooling off period)
- Must file within 180 days of first recruitment step
- PWD expiration date may further limit the window
- System calculates the most restrictive deadline

PWD Limited Cases:
- When PWD expires before 180-day mark
- Window closes at PWD expiration instead
- Flagged with special "PWD Limited" indicator
- Requires faster action than standard timeline

Related: ETA 9089 Stage, Recruitment Deadlines, Case Detail`,
    metadata: {
      source: "app_guide",
      section: "app-filing-windows",
    },
  },

  // Section 21: RFI and RFE Management
  {
    title: "RFI and RFE Entry Management",
    content: `RFI (Request for Information) and RFE (Request for Evidence) entries track government requests during the PERM process.

Understanding RFI vs RFE:

1. RFI - Request for Information
- Issued by DOL during ETA 9089 stage
- Due date: STRICT 30 days from received date (cannot edit)
- Requesting additional documentation or clarification

2. RFE - Request for Evidence
- Issued by USCIS during I-140 stage
- Due date: EDITABLE (typically 30-90 days, varies by request)
- Requesting evidence to support the petition

Adding an RFI/RFE:

1. Navigate to case detail
2. Scroll to ETA 9089 section (for RFI) or I-140 section (for RFE)
3. Click "Add RFI" or "Add RFE" button
4. Enter received date (when request was issued)
5. Due date auto-calculates (RFI) or enter manually (RFE)
6. Save the entry

RFI/RFE Entry Fields:
- Received Date: Date the request was issued/received
- Due Date: Response deadline (auto for RFI, manual for RFE)
- Submitted Date: Date response was filed (enter when done)

Active RFI/RFE Indicators:
- Case progress status changes to "RFI/RFE"
- Red tag appears on case card
- Deadline appears in Dashboard deadline hub
- Notifications sent as due date approaches

Submitting Response:
1. Open case detail
2. Find the active RFI/RFE entry
3. Enter the submitted date
4. Save changes
5. Progress status returns to previous state
6. Entry becomes inactive (but history preserved)

Multiple RFI/RFE Rules:
- Only ONE active (unsubmitted) RFI/RFE at a time
- Must submit current before adding another
- History of past RFI/RFEs preserved in case

Removing an RFI/RFE:
1. Click remove/delete icon on the entry
2. Confirm deletion
3. Entry is permanently removed

Related: ETA 9089 Stage, I-140 Stage, Deadline Tracking`,
    metadata: {
      source: "app_guide",
      section: "app-rfi-rfe",
    },
  },

  // Section 22: Professional Occupation
  {
    title: "Professional Occupation Checkbox and Additional Methods",
    content: `The Professional Occupation setting indicates positions requiring a Bachelor's degree, which triggers additional recruitment requirements.

When to Check Professional Occupation:

1. Position Requirements
- Job REQUIRES a Bachelor's degree or higher for entry
- Not just preferred - must be a minimum requirement
- Includes positions requiring specific degree fields

2. Impact of Checking
- Enables "Additional Recruitment Methods" section
- Requires 3 additional methods beyond basic 3
- "Professional" tag displays on case card

Additional Recruitment Methods (3 Required):

Available method options:
- Job fairs
- Campus/university recruitment
- Employee referral program with incentives
- Local or ethnic newspaper ads
- Radio or television advertisements
- Professional organization publications/websites
- Private employment firm/recruiter
- Trade or professional organization job listing
- Company website posting
- Job search website posting
- Other qualifying method

Selecting Methods:
1. Open case form and go to Recruitment section
2. Ensure "Professional Occupation" is checked
3. Use first dropdown to select Method 1, enter date
4. Use second dropdown to select Method 2, enter date
5. Use third dropdown to select Method 3, enter date
6. Each method must be different (no duplicates)

Validation Rules:
- All 3 additional methods required if professional checked
- Each method must have a date entered
- Dates must be after PWD determination
- Cannot select the same method twice

Method Dropdown Behavior:
- Once a method is selected, it's removed from other dropdowns
- Prevents accidental duplicate selection
- If you change a selection, the previous method becomes available again

Recruitment Completion:
- Basic recruitment: Notice of Filing, Job Order, 2 Sunday Ads
- Professional addition: 3 unique additional methods with dates
- All must be complete for recruitment to be considered done

Related: Recruitment Stage, Case Form, Workflow Add Case`,
    metadata: {
      source: "app_guide",
      section: "app-professional-occupation",
    },
  },

  // ============================================================
  // WORKFLOW GUIDES (23-30)
  // ============================================================

  // Section 23: Add Case Workflow
  {
    title: "Workflow: Adding a New Case",
    content: `Step-by-step guide for creating a new PERM case from start to finish.

Step 1: Access the Case Form
- From Dashboard: Click the "Add Case" button (prominent, usually top-right or center)
- From Cases List: Click "New Case" or "+" button in toolbar
- The case creation form opens in a new page or modal

Step 2: Enter Basic Information
- Beneficiary Name: Enter the foreign worker's full name (required)
- Employer Name: Enter the sponsoring company name (required)
- Job Title: Position title for the PERM application
- SOC Code: Occupation code (can be looked up)
- Wage Offered: Salary amount for the position

Step 3: Configure Case Settings
- Professional Occupation: Check if position requires Bachelor's degree
- This affects recruitment requirements (3 additional methods)

Step 4: Enter PWD Information (if available)
- PWD Filing Date: When the PWD application was submitted
- PWD Determination Date: When the wage was approved (if already received)
- Expiration auto-calculates when determination date is entered

Step 5: Review and Save
- Review all entered information
- Click "Save" or "Create Case" button
- Case is created and you're redirected to case detail

After Creation:
- Case appears in Cases List
- Status is "PWD" (initial stage)
- Add remaining dates as the case progresses
- Case appears in Dashboard deadline tracking

Tips:
- You can save with minimal info and add details later
- Required fields are marked with asterisks
- Invalid dates show error messages - fix before saving

Related: Case Form, Case Detail, PWD Stage`,
    metadata: {
      source: "app_guide",
      section: "workflow-add-case",
    },
  },

  // Section 24: Track Deadlines Workflow
  {
    title: "Workflow: Tracking Deadlines Across Views",
    content: `How to monitor and track deadlines using the Dashboard, Calendar, Notifications, and Case Detail.

Dashboard Deadline Hub:
1. Open Dashboard (click logo or Dashboard nav link)
2. View Deadline Hub panel (usually left side)
3. Deadlines grouped by urgency: Overdue, This Week, This Month, Later
4. Click any deadline to navigate to its case
5. Red items are overdue - address immediately

Calendar View:
1. Navigate to Calendar page
2. View deadlines visually on the calendar
3. Switch between Month/Week/Day views as needed
4. Click on deadline to see details popup
5. Use "View Case" to open full case detail

Notifications Approach:
1. Check notification bell for unread alerts
2. Open Notifications page for full history
3. Filter by "Deadlines" tab for deadline-specific notifications
4. Each notification links to its related case
5. Mark as read to track what you've addressed

Case Detail Method:
1. Open specific case from Cases list
2. View "Next Deadline" prominently displayed
3. Scroll to see all upcoming deadlines for this case
4. Timeline shows deadlines as milestones

Recommended Daily Workflow:
1. Start at Dashboard - check Overdue and This Week sections
2. Address any overdue items first
3. Review This Week deadlines and plan accordingly
4. Check notifications for new alerts
5. Use Calendar for weekly/monthly planning

Weekly Review:
1. Open Calendar in Week view
2. Review upcoming week's deadlines
3. Switch to Month view for broader planning
4. Identify cases needing attention before deadlines

Setting Up Reminders:
1. Go to Settings > Notifications
2. Enable deadline reminders
3. Set reminder days (e.g., 30, 14, 7, 1 day before)
4. Enable push notifications for real-time alerts

Related: Dashboard, Calendar, Notifications, Case Detail`,
    metadata: {
      source: "app_guide",
      section: "workflow-track-deadlines",
    },
  },

  // Section 25: Export Cases Workflow
  {
    title: "Workflow: Exporting Cases for Backup or Reporting",
    content: `Step-by-step guide for exporting your cases to JSON or CSV format.

Exporting All Cases:

Step 1: Navigate to Cases List
- Click "Cases" in the navigation menu
- Ensure no filters are applied (or clear filters)

Step 2: Open Export Dialog
- Click "Export" button in the toolbar
- Export dialog/modal opens

Step 3: Select Export Options
- Choose format: JSON (complete backup) or CSV (spreadsheet)
- Select "All Cases" scope
- Review field selection (usually all fields included)

Step 4: Download
- Click "Export" or "Download" button
- File downloads to your browser's download folder
- Filename includes date: cases_export_2024-01-15.json

Exporting Selected Cases:

Step 1: Enter Selection Mode
- Click "Select" or "Bulk Actions" button
- Checkboxes appear on case cards

Step 2: Select Cases
- Click checkboxes on specific cases you want
- Or use filters first, then "Select All" for filtered results
- Selected count displayed in toolbar

Step 3: Export Selected
- Click "Export Selected" button
- Choose format (JSON or CSV)
- Only selected cases are included in export

Exporting Filtered Cases:

Step 1: Apply Filters
- Use status filter to select specific stages
- Use search to find specific cases
- Apply any other desired filters

Step 2: Export Filtered
- Click "Export" button
- May offer "Export Filtered" option
- Or use Select All then Export Selected

JSON vs CSV:

JSON Format:
- Complete data preservation
- Nested data structures (RFI/RFE arrays)
- Best for backup and restore
- Can be imported back into PERM Tracker

CSV Format:
- Spreadsheet compatible (Excel, Google Sheets)
- Flat structure (one row per case)
- Best for reporting and analysis
- RFI/RFE may be flattened or limited

Related: Bulk Operations, Import/Export, Cases List`,
    metadata: {
      source: "app_guide",
      section: "workflow-export-cases",
    },
  },

  // Section 26: Calendar Setup Workflow
  {
    title: "Workflow: Setting Up Google Calendar Sync",
    content: `Complete guide to connecting and configuring Google Calendar synchronization.

Step 1: Navigate to Calendar Settings
- Click your profile/user icon in the header
- Select "Settings" from the dropdown
- Click the "Calendar Sync" tab

Step 2: Connect Google Account
- Click "Connect Google Calendar" button
- Google sign-in popup opens
- Sign in with your Google account (or select if multiple)
- Grant permission to manage calendar events
- Popup closes automatically when complete

Step 3: Select Target Calendar
- After connecting, calendar list loads
- Select which Google Calendar to sync to
- Options: Primary calendar or any calendar you own
- You can create a new "PERM Deadlines" calendar if preferred

Step 4: Configure Sync Settings
- Select deadline types to sync:
  - PWD Expiration
  - Recruitment deadlines
  - ETA 9089 filing window
  - I-140 deadline
  - RFI/RFE due dates
- Enable/disable reminders on calendar events
- Set reminder timing (e.g., 1 day before)

Step 5: Save and Test
- Click "Save Settings"
- Wait for initial sync to complete
- Open Google Calendar to verify events appear
- Check an event to confirm details are correct

Step 6: Per-Case Configuration (Optional)
- Navigate to any case detail
- Find calendar sync toggle in case settings
- Disable to exclude specific case from sync
- Useful for closed or low-priority cases

Verification:
- Open Google Calendar
- Navigate to a date with known deadlines
- Verify deadline events appear with correct titles
- Check event descriptions for case links

Troubleshooting:
- If events don't appear, click "Sync Now" in settings
- Check that the correct calendar is selected
- Verify deadline types are enabled
- Try disconnecting and reconnecting if issues persist

Related: Calendar Page, Notification Settings, Settings`,
    metadata: {
      source: "app_guide",
      section: "workflow-calendar-setup",
    },
  },

  // Section 27: Notifications Setup Workflow
  {
    title: "Workflow: Configuring All Notification Options",
    content: `Complete guide to setting up email, push, and in-app notifications.

Step 1: Access Notification Settings
- Click profile/user icon in header
- Select "Settings" from dropdown
- Click "Notifications" tab

Step 2: Configure Email Notifications
For each category, toggle on/off:
- Deadline Reminders: Upcoming deadline alerts
- Status Changes: Case stage transitions
- RFI/RFE Alerts: Request received and due soon
- System Updates: App announcements and maintenance

Step 3: Set Reminder Timing
- Find "Reminder Days" section
- Select when to receive deadline reminders:
  - 30 days before (monthly heads-up)
  - 14 days before (two-week warning)
  - 7 days before (week warning)
  - 1 day before (final reminder)
  - Day of (if still not addressed)
- Check/uncheck each timing as desired

Step 4: Configure Urgent Threshold
- Set "Urgent Deadline Threshold" (default: 7 days)
- Deadlines within this range show as urgent
- Affects notification priority and styling

Step 5: Enable Push Notifications
- Toggle "Enable Push Notifications"
- Browser will request permission - click "Allow"
- If denied, you'll need to enable in browser settings
- Select which notification types trigger push

Step 6: Configure Quiet Hours (Optional)
- Click "Quiet Hours" tab in Settings
- Toggle "Enable Quiet Hours"
- Set start time (e.g., 8:00 PM)
- Set end time (e.g., 8:00 AM)
- Verify timezone is correct
- Non-urgent notifications held during this window

Step 7: Save Changes
- Click "Save" button
- Confirmation message appears
- Settings take effect immediately

Testing Your Setup:
- Create a test case with deadline in configured range
- Verify email arrives at expected time
- Check push notification appears (if enabled)
- Verify urgent styling for close deadlines

Recommended Settings:
- Enable 7-day and 1-day email reminders minimum
- Enable push for RFI/RFE and overdue deadlines
- Set quiet hours for work-life balance

Related: Quiet Hours, Notifications Page, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "workflow-notifications-setup",
    },
  },

  // Section 28: Bulk Operations Workflow
  {
    title: "Workflow: Performing Bulk Actions on Cases",
    content: `Step-by-step guide for selecting and acting on multiple cases at once.

Bulk Export Workflow:

Step 1: Prepare Your Selection
- Navigate to Cases list
- (Optional) Apply filters to narrow down cases
- Click "Select" or "Bulk Actions" to enter selection mode

Step 2: Select Cases
- Click checkbox on each case to include, OR
- Click "Select All" for all cases on current page, OR
- Click "Select All (X cases)" to select across all pages

Step 3: Export
- Click "Export" or "Export Selected" button
- Choose format (JSON for backup, CSV for reporting)
- Download starts automatically

Bulk Archive Workflow:

Step 1: Select Cases to Archive
- Enter selection mode
- Select completed or inactive cases
- Verify selection (check count in toolbar)

Step 2: Archive
- Click "Archive" or "Archive Selected" button
- Confirmation dialog appears
- Review the count of cases to be archived
- Click "Confirm" to proceed

Step 3: Verify
- Archived cases move to Archived/Closed status
- Can filter to view archived cases
- Can reopen individual cases if needed

Bulk Delete Workflow (Use with Caution):

Step 1: Select Cases to Delete
- Enter selection mode
- Select cases to permanently delete
- Double-check your selection

Step 2: Delete
- Click "Delete" or "Delete Selected" button
- Strong confirmation dialog appears
- May require typing "DELETE" to confirm
- Click "Confirm Delete"

Step 3: Acknowledgment
- Cases are permanently removed
- Cannot be undone
- Consider exporting before deletion as backup

Best Practices:
- Export before any bulk delete operation
- Use filters to ensure you're selecting the right cases
- Review selection count before confirming actions
- Start with a small batch to verify behavior

Exiting Selection Mode:
- Click "Cancel" or "Done" button
- Or click outside the selection toolbar
- Selections are cleared

Related: Export Cases, Cases List, Filtering`,
    metadata: {
      source: "app_guide",
      section: "workflow-bulk-operations",
    },
  },

  // Section 29: Case Lifecycle Workflow
  {
    title: "Workflow: Complete PERM Case Lifecycle",
    content: `End-to-end guide following a case from creation through I-140 approval.

Stage 1: PWD (Prevailing Wage Determination)

Start: Create new case with beneficiary and employer info
During: Prepare and file PWD application with DOL
Track: Enter PWD filing date when submitted
Complete: Enter PWD determination date when received
Auto: System calculates PWD expiration date

Stage 2: Recruitment

Start: Begins immediately after PWD determination
Track: Enter dates as each method completes:
- Notice of Filing: Start date (end auto-calculates +10 business days)
- Job Order: Start date (end auto-calculates +30 days)
- First Sunday Ad: Must be Sunday
- Second Sunday Ad: Must be Sunday, 7+ days after first
- Additional Methods (if professional): 3 different methods with dates

Wait: 30-day waiting period after last recruitment step
Monitor: Dashboard shows "Ready to File" when window opens

Stage 3: ETA 9089 Filing

Window: Opens 30 days after last recruitment, closes at 180 days or PWD expiration
Action: File ETA 9089 with DOL
Track: Enter ETA 9089 filing date
If RFI: Add RFI entry with received date, due date auto-calculates
Respond: Enter RFI submitted date when response filed
Complete: Enter certification date when approved
Auto: System calculates ETA 9089 expiration (cert + 180 days)

Stage 4: I-140 Petition

Start: Immediately after ETA 9089 certification
Deadline: Must file before ETA 9089 expires (180 days from certification)
Track: Enter I-140 filing date
If RFE: Add RFE entry with received date and due date
Respond: Enter RFE submitted date when response filed
Complete: Enter I-140 approval date

Completion:
- Case status shows "Complete" or "I-140 Approved"
- Success indicator/celebration may display
- Case can be archived

Related: PWD Stage, Recruitment Stage, ETA 9089 Stage, I-140 Stage`,
    metadata: {
      source: "app_guide",
      section: "workflow-case-lifecycle",
    },
  },

  // Section 30: Search and Find Workflow
  {
    title: "Workflow: Finding Specific Cases Quickly",
    content: `Guide to using search, filters, and sorting to locate specific cases efficiently.

Quick Search (Fastest):

Step 1: Use the Search Box
- Located in header or cases list toolbar
- Type beneficiary name, employer name, or case ID
- Results filter as you type (real-time)

Step 2: Select from Results
- Click on matching case in results
- Or press Enter to go to Cases list with search applied

Advanced Filtering:

Step 1: Open Filters Panel
- Navigate to Cases list
- Click "Filters" button to expand filter panel

Step 2: Apply Status Filter
- Check stages you want: PWD, Recruitment, ETA 9089, I-140
- Multiple selections show cases in ANY checked status
- Uncheck "Closed" to hide archived cases

Step 3: Apply Progress Filter
- Select progress status: Working on it, Filed, Approved, RFI/RFE, etc.
- Narrows within the status filter

Step 4: Use Favorites Filter
- Toggle "Favorites Only" to show only starred cases
- Great for focusing on priority cases

Step 5: Set Sort Order
- Use sort dropdown to order by:
  - Name (A-Z or Z-A)
  - Deadline (soonest or latest first)
  - Created date (newest or oldest)
- Click sort icon to toggle ascending/descending

Combined Search Strategy:
1. Apply broad status filter (e.g., "Recruitment only")
2. Sort by deadline (soonest first)
3. Use search to find specific beneficiary within filtered results

Common Search Scenarios:

Find overdue cases:
- Dashboard Deadline Hub > "Overdue" section shows all

Find cases for specific employer:
- Search box > type employer name > review results

Find cases ready to file:
- Status filter: ETA 9089 > Look for "Ready to File" indicator

Find high-priority cases:
- Toggle "Favorites Only" > sorted by deadline

Clear and Reset:
- Click "Clear All Filters" to reset
- Clear search box to remove text search

Related: Cases List, Filtering and Sorting, Dashboard`,
    metadata: {
      source: "app_guide",
      section: "workflow-search-find",
    },
  },
];
