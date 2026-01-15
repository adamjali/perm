/**
 * PERM Knowledge Sections for RAG
 *
 * Structured knowledge base containing PERM labor certification rules,
 * deadlines, and procedures. Each section is sized for optimal embedding
 * (400-512 tokens) with comprehensive metadata.
 *
 * Source: perm_flow.md and 20 CFR Part 656
 */

export interface PERMKnowledgeSection {
  title: string;
  content: string;
  metadata: {
    source: string;
    section: string;
    cfr?: string;
  };
}

export const PERM_KNOWLEDGE_SECTIONS: PERMKnowledgeSection[] = [
  // Section 1: PWD Application & Expiration
  {
    title: "PWD Application and Expiration Calculation",
    content: `The Prevailing Wage Determination (PWD) is the first step in the PERM labor certification process. The PWD establishes the minimum wage that must be offered to the foreign worker.

PWD Expiration Calculation Rules (20 CFR 656.40(c)):
- If PWD determination date falls between April 2 and June 30: Expiration = determination date + 90 days
- Otherwise: Expiration = June 30 of the following year (if after June 30) or same year (if before June 30)

Date Validation Requirements:
1. PWD filing date cannot be in the future
2. PWD determination date must be after filing date but not in the future
3. PWD determination date cannot be filled until filing date is entered
4. PWD expiration date is auto-calculated based on determination date

The PWD expiration date is critical because all recruitment activities must complete and the ETA 9089 must be filed before this date. If PWD expires before ETA 9089 is filed, the case must be closed and the entire process must restart with a new PWD application.

Case Status: PWD status spans from filing date to determination date. Color: Blue.`,
    metadata: {
      source: "perm_flow.md",
      section: "pwd-expiration",
      cfr: "20 CFR 656.40(c)",
    },
  },

  // Section 2: Recruitment Stage Overview
  {
    title: "Recruitment Stage Overview and Windows",
    content: `The Recruitment Stage begins after PWD determination and requires completing specific advertising methods within strict timeframes.

Recruitment Window:
- Opens: PWD determination date (can start recruitment 30 days before determination in some cases)
- Closes: Earlier of (180 days after first recruitment step) OR (PWD expiration date)
- The PWD expiration date always takes precedence if it comes first

Three Required Recruitment Methods (for all PERM cases):
1. Notice of Filing - Must be posted for 10 business days
2. Job Order - Must be posted for at least 30 days
3. Sunday Newspaper Ads - Two separate Sunday ads, at least 7 days apart

The 180-day rule is critical: All recruitment must complete and the 30-day waiting period must pass within 180 days of the first recruitment step. This means the last recruitment step must occur no later than day 150 to allow for the 30-day waiting period.

Case Status: Recruitment status spans from PWD determination to 30 days after last recruitment method (or PWD expiration). Color: Purple. Has special progress status for waiting period with countdown.`,
    metadata: {
      source: "perm_flow.md",
      section: "recruitment-overview",
    },
  },

  // Section 3: Notice of Filing Requirements
  {
    title: "Notice of Filing Requirements and Deadlines",
    content: `The Notice of Filing is a mandatory recruitment method that must be posted at the job location for 10 consecutive business days.

Notice of Filing Rules:
- Start date must be after PWD determination date
- Must be posted for at least 10 business days (excluding weekends and federal holidays)
- End date is auto-calculated as start date + 10 business days but can be extended (not shortened)

Deadline Calculation:
The notice of filing deadline is the EARLIER of:
- 150 days after the first recruitment step, OR
- 30 days before PWD expiration date

This calculation accounts for:
- 30-day waiting period after recruitment ends (required before filing ETA 9089)
- Need to file ETA 9089 within 180 days of first recruitment AND before PWD expiration

Example: If first recruitment step was January 15 and PWD expires December 31:
- Option A: January 15 + 150 days = June 14
- Option B: December 31 - 30 days = December 1
- Deadline is June 14 (earlier date)

The notice must include all required job information and be posted in a visible location where employees can see it.`,
    metadata: {
      source: "perm_flow.md",
      section: "notice-of-filing",
    },
  },

  // Section 4: Job Order Requirements
  {
    title: "Job Order Requirements and 30-Day Posting",
    content: `The Job Order is a mandatory recruitment method that must be placed with the State Workforce Agency (SWA) for a minimum of 30 days.

Job Order Rules:
- Start date must be after PWD determination date
- Must run for at least 30 consecutive days
- End date is auto-calculated as start date + 30 days but can be extended (not shortened)
- Must be posted in the state where the job is located

Deadline Calculation:
The job order start deadline is the EARLIER of:
- 120 days after the first recruitment step, OR
- 60 days before PWD expiration date

This calculation accounts for:
- The 30-day minimum posting requirement
- The 30-day waiting period after recruitment ends
- Need to file within 180 days of first recruitment AND before PWD expiration

Example: If first recruitment step was January 15 and PWD expires December 31:
- Option A: January 15 + 120 days = May 15
- Option B: December 31 - 60 days = November 1
- Deadline is May 15 (earlier date)

The job order must include all required job information matching the ETA 9089 application.`,
    metadata: {
      source: "perm_flow.md",
      section: "job-order",
    },
  },

  // Section 5: Sunday Ads Requirements
  {
    title: "Sunday Newspaper Advertisement Requirements",
    content: `Two Sunday newspaper advertisements are required for all PERM cases. Both ads must appear on Sundays and must be at least 7 days apart.

First Sunday Ad Rules:
- Must be published on a Sunday
- Deadline: The last Sunday that is at least 143 days after first recruitment OR 37 days before PWD expiration, whichever comes first
- The 143-day calculation accounts for: 7 days until second ad + 30-day waiting period + 180-day total window

Second Sunday Ad Rules:
- Must be published on a Sunday
- Must be at least 7 days after the first Sunday ad
- Deadline: The last Sunday that is at least 150 days after first recruitment OR 30 days before PWD expiration, whichever comes first

Example Timeline (first recruitment Jan 15, PWD expires Dec 31):
- First Sunday ad deadline: Last Sunday on or before June 7 (Jan 15 + 143 days)
- Second Sunday ad deadline: Last Sunday on or before June 14 (Jan 15 + 150 days)

Both ads must be placed in a newspaper of general circulation in the area of intended employment. The newspaper name should be recorded for the recruitment summary.`,
    metadata: {
      source: "perm_flow.md",
      section: "sunday-ads",
    },
  },

  // Section 6: Professional Occupation Methods
  {
    title: "Professional Occupation Additional Recruitment Methods",
    content: `For positions classified as professional occupations (typically requiring a Bachelor's degree or higher), three additional recruitment methods beyond the basic three are required.

Professional Occupation Criteria:
- Position requires a Bachelor's degree or higher for entry
- When checked as professional, opens section for 3 additional methods
- Tag displays "Professional" on the case

Additional Method Requirements:
- Must select 3 different methods (no duplicates)
- Each method must be different from the others
- Options include: job fairs, campus recruitment, employee referral programs, local/ethnic newspapers, radio/TV ads, professional organizations, private employment firms, etc.

Method Selection Rules:
- Once a method is selected, it's removed from dropdown for other selections
- All 3 methods must be selected before recruitment is complete
- Can save without all 3 selected but will show warning
- Each additional method has its own date field

The professional occupation checkbox affects the recruitment completion check - all 3 additional methods must have dates for recruitment to be considered complete.`,
    metadata: {
      source: "perm_flow.md",
      section: "professional-occupation",
    },
  },

  // Section 7: ETA 9089 Filing Window
  {
    title: "ETA 9089 Filing Window and 30-Day Waiting Period",
    content: `The ETA 9089 is the actual PERM labor certification application filed with the Department of Labor. There is a strict filing window with both minimum and maximum timeframes.

Filing Window Rules (20 CFR 656.40(c)(1)):
- Window OPENS: 30 days after the LAST recruitment step (mandatory waiting period)
- Window CLOSES: EARLIER of (180 days after FIRST recruitment step) OR (PWD expiration date)

The 30-Day Waiting Period:
- Required before filing ETA 9089
- Starts after ALL recruitment methods are complete (including professional methods if applicable)
- Cannot be shortened or waived
- Special deadline "Ready to File" appears when this period ends

Filing Window Calculation Example:
- First recruitment: January 15
- Last recruitment: February 28
- PWD expiration: December 31
- Window opens: March 30 (Feb 28 + 30 days)
- Window closes: July 13 (Jan 15 + 180 days, since that's before Dec 31)

Date Validation:
- Filing date must be at least 30 days after last recruitment
- Filing date must be within 180 days of first recruitment
- Filing date must be before PWD expiration

Case Status: ETA 9089 status spans from 30 days after last recruitment to PWD expiration or 180 days (whichever is first). Color: Orange/Yellow when working.`,
    metadata: {
      source: "perm_flow.md",
      section: "eta9089-filing-window",
      cfr: "20 CFR 656.40(c)(1)",
    },
  },

  // Section 8: ETA 9089 to I-140 Transition
  {
    title: "ETA 9089 Certification and I-140 Filing Window",
    content: `After the ETA 9089 is filed, the case enters a pending status with the Department of Labor. Upon certification, the I-140 immigrant petition must be filed within a specific window.

ETA 9089 Certification Process:
- Filing date recorded when application is submitted
- Status changes from "Filed" to "Approved" upon certification
- Certification date triggers I-140 filing window
- ETA 9089 expiration is auto-calculated as certification date + 180 days

I-140 Filing Window:
- Opens: Immediately upon ETA 9089 certification
- Closes: 180 days after ETA 9089 certification date
- I-140 filing date must be after certification date
- I-140 filing date must be before expiration (cert + 180 days)

I-140 Approval:
- I-140 approval date must be after filing date
- Upon I-140 approval, the case is considered complete
- Celebration animation may display on approval

Date Validation Chain:
1. ETA 9089 certification date must be after filing date
2. I-140 filing date must be after certification date
3. I-140 filing date must be before ETA 9089 expiration (cert + 180 days)
4. I-140 approval date must be after I-140 filing date

Case Status: I-140 status spans from ETA 9089 certification to expiration. Color: Green.`,
    metadata: {
      source: "perm_flow.md",
      section: "eta9089-to-i140",
    },
  },

  // Section 9: RFI Rules
  {
    title: "Request for Information (RFI) Response Rules",
    content: `An RFI (Request for Information) may be issued by the Department of Labor after ETA 9089 is filed, requesting additional documentation or clarification.

RFI Response Rules (20 CFR 656.40(c)):
- RFI received date must be AFTER ETA 9089 filing date
- Response due date is STRICTLY 30 calendar days from RFI received date (NOT editable)
- Response submitted date must be after received date and before due date
- Only ONE active RFI allowed at a time - cannot add another until current one is submitted

RFI Lifecycle:
1. RFI Received: Date DOL issued the RFI
2. Response Due: Auto-calculated as received date + 30 days (strict, cannot be changed)
3. Response Submitted: Date response was filed with DOL

Progress Status:
- When RFI is active (received but not submitted): Progress status shows "RFI/RFE"
- RFI tag appears in RED when active
- Once submitted, tag becomes inactive/hidden

Critical Difference from RFE:
- RFI due date is STRICT 30 days - no extensions, not editable
- This is different from RFE where the due date can be manually set/extended

Multiple RFIs:
- Can have multiple RFIs over the life of a case
- But only one can be active (unsubmitted) at a time
- Once submitted, can add another if needed`,
    metadata: {
      source: "perm_flow.md",
      section: "rfi-rules",
      cfr: "20 CFR 656.40(c)",
    },
  },

  // Section 10: RFE Rules
  {
    title: "Request for Evidence (RFE) Response Rules",
    content: `An RFE (Request for Evidence) may be issued during the I-140 petition stage, requiring additional evidence or documentation.

RFE Response Rules:
- RFE received date must be AFTER I-140 filing date
- Response due date is EDITABLE (no auto-calculation)
- Response submitted date must be after received date and before due date
- Only ONE active RFE allowed at a time - cannot add another until current one is submitted

RFE Lifecycle:
1. RFE Received: Date USCIS issued the RFE
2. Response Due: Manually entered (editable) - typically 30-90 days depending on the request
3. Response Submitted: Date response was filed with USCIS

Progress Status:
- When RFE is active (received but not submitted): Progress status shows "RFI/RFE"
- RFE tag appears in RED when active
- Once submitted, tag becomes inactive/hidden

Key Difference from RFI:
- RFE due date is EDITABLE and can be set based on the actual RFE notice
- RFI due date is STRICT 30 days (not editable)
- RFE is issued by USCIS during I-140 stage
- RFI is issued by DOL during ETA 9089 stage

Multiple RFEs:
- Can have multiple RFEs over the life of a case
- But only one can be active (unsubmitted) at a time
- Once submitted, can add another if needed`,
    metadata: {
      source: "perm_flow.md",
      section: "rfe-rules",
    },
  },

  // Section 11: Case Status Types
  {
    title: "Case Status Types and Transitions",
    content: `Case Status represents the major stage of the PERM process. There are 5 case status types, each with specific triggers and colors.

Case Status Types:

1. PWD (Blue)
   - Trigger: Case created, PWD filing date entered
   - Ends: PWD determination date received
   - Scope: Filing date through determination date

2. Recruitment (Purple)
   - Trigger: PWD determination date entered
   - Ends: 30 days after last recruitment method complete
   - Scope: PWD determination through end of 30-day waiting period
   - Special: Has waiting period countdown

3. ETA 9089 (Orange, Yellow when working)
   - Trigger: 30-day waiting period complete
   - Ends: PWD expiration or 180 days from first recruitment
   - Scope: Filing window through certification

4. I-140 (Green)
   - Trigger: ETA 9089 certification date entered
   - Ends: I-140 approval
   - Scope: Certification through I-140 approval

5. Closed/Archived (Grayed out)
   - Trigger: Manual closure, PWD expiration, missed deadlines, or I-140 approval
   - Progress status: Not applicable
   - Used for completed or abandoned cases

Status Transitions:
PWD -> Recruitment -> ETA 9089 -> I-140 -> Complete/Closed

Each status change should be logged for audit trail and notification purposes.`,
    metadata: {
      source: "perm_flow.md",
      section: "case-status-types",
    },
  },

  // Section 12: Progress Status Types
  {
    title: "Progress Status Types Within Case Stages",
    content: `Progress Status indicates the current activity state within a case status. There are 6 progress status types.

Progress Status Types:

1. Working on it (Default)
   - General active state
   - Used when actively preparing documents or completing tasks
   - Default status when entering a new case stage

2. Waiting for intake
   - Case is awaiting initial information from client
   - Used early in process before data is collected

3. Filed (Auto/Manual Override)
   - Auto-triggered when filing date is entered (PWD, ETA 9089, I-140)
   - Can be manually overridden
   - Indicates application has been submitted

4. Approved (Auto/Manual Override)
   - Auto-triggered when approval/determination/certification date entered
   - Can be manually overridden
   - Indicates application has been approved

5. Under review
   - Application is pending with government agency
   - Used between filing and decision

6. RFI/RFE
   - Active RFI (ETA 9089 stage) or RFE (I-140 stage) pending
   - Indicates additional evidence requested
   - Auto-set when RFI/RFE received date entered without submitted date

Progress Status Display:
- Appears as tag on case card
- No background color, no box
- Changes based on case activity
- Some transitions are automatic, others require manual update

The progress status depends on the case status - different progress states are relevant for different stages.`,
    metadata: {
      source: "perm_flow.md",
      section: "progress-status-types",
    },
  },

  // Section 13: Edge Case - PWD Expiration
  {
    title: "Edge Case: PWD Expiration and Case Closure",
    content: `If the PWD expires before the ETA 9089 is filed, the case must be closed and the entire PERM process must restart.

PWD Expiration Scenario:
- Condition: Current date passes PWD expiration date AND ETA 9089 is not yet filed
- Result: Case is automatically closed/archived
- Notification: Pop-up on next login + email notification

Closure Process:
1. System detects PWD expiration date has passed
2. Checks if ETA 9089 filing date exists
3. If no filing date: Triggers auto-closure
4. Notification sent with explanation
5. Case status changes to Closed/Archived
6. Progress status becomes "Not Applicable"

Recovery:
- Must start entirely new PERM process
- New PWD application required
- All recruitment must be redone
- Previous recruitment cannot be used

Prevention Strategies:
- Dashboard shows PWD expiration warnings
- Deadline reminders at 1 month, 1 week, 1 day before
- ETA 9089 filing window status shows urgency
- Clear deadline display on case view

This is the most common reason for PERM case failure - always prioritize completing recruitment and filing ETA 9089 before PWD expiration.`,
    metadata: {
      source: "perm_flow.md",
      section: "edge-case-pwd-expiration",
    },
  },

  // Section 14: Edge Case - Missed Deadlines
  {
    title: "Edge Case: Missed 180-Day Deadline and Restart Rules",
    content: `Missing the 180-day recruitment deadline triggers specific restart scenarios depending on remaining time before PWD expiration.

180-Day Deadline Miss Scenarios:

Scenario 1: Missed but PWD still valid (60+ days remaining)
- Recruitment must restart from scratch
- All previous recruitment is invalid
- New first recruitment date starts new 180-day window
- Must still complete before PWD expiration

Scenario 2: Missed and PWD expiring soon (less than 60 days remaining)
- Cannot restart recruitment in time
- Case must be closed/archived
- Notification with explanation sent
- Must start new PWD application

Scenario 3: ETA 9089 filed but certification takes too long
- If ETA 9089 expiration passes (180 days from certification)
- Must refile ETA 9089 if still within recruitment window and PWD valid
- If recruitment window passed or PWD expired, case closes

Detection and Notification:
1. System monitors 180-day deadline from first recruitment
2. If deadline passes without ETA 9089 filing:
   - Check if 60+ days remain before PWD expiration
   - If yes: Notify to restart recruitment
   - If no: Auto-close case

The 180-day rule is absolute - no extensions possible. Planning recruitment timing is critical.`,
    metadata: {
      source: "perm_flow.md",
      section: "edge-case-missed-deadlines",
    },
  },

  // Section 15: Date Validation Overview
  {
    title: "Date Validation Rules Overview",
    content: `All dates in the PERM process must follow strict validation rules and maintain proper chronological order.

PWD Stage Validation:
1. PWD filing date: Cannot be in the future
2. PWD determination date: Must be after filing, cannot be in future
3. PWD expiration: Auto-calculated, no manual entry

Recruitment Stage Validation:
4. Notice of Filing start: Must be after PWD determination
5. Notice of Filing end: Auto-calculated as start + 10 business days (can extend, not shorten)
6. Job Order start: Must be after PWD determination
7. Job Order end: Auto-calculated as start + 30 days (can extend, not shorten)
8. First Sunday ad: Must be on Sunday, before deadline
9. Second Sunday ad: Must be on Sunday, at least 7 days after first

ETA 9089 Stage Validation:
10. Filing date: Must be 30+ days after last recruitment, before 180-day deadline and PWD expiration
11. Certification date: Must be after filing date
12. Expiration: Auto-calculated as certification + 180 days

I-140 Stage Validation:
13. Filing date: Must be after ETA 9089 certification, before ETA 9089 expiration
14. Approval date: Must be after I-140 filing date

RFI/RFE Validation:
15. Received date: Must be after parent filing date
16. Due date: RFI = received + 30 days (strict), RFE = editable
17. Submitted date: Must be after received, before due

Cascade Logic: When upstream dates change, downstream dates auto-recalculate if affected.`,
    metadata: {
      source: "perm_flow.md",
      section: "date-validation-overview",
    },
  },

  // Section 16: Recruitment Window Calculation
  {
    title: "Recruitment Window Calculation Details",
    content: `The recruitment window defines when recruitment activities must occur. Understanding this window is critical for PERM success.

Recruitment Window Formula:
- Opens: PWD determination date
- Closes: EARLIER of (PWD expiration date - 30 days) OR (first recruitment + 150 days)

Why the -30 Days?
- Must have 30-day waiting period after recruitment ends
- ETA 9089 must be filed before PWD expires
- So recruitment must end at least 30 days before PWD expiration

Why 150 Days?
- Total window is 180 days from first recruitment step
- 30 days required for waiting period
- 180 - 30 = 150 days for actual recruitment

Example Calculation:
- PWD determination: January 1, 2024
- PWD expiration: December 31, 2024
- First recruitment: January 15, 2024

Option A (based on PWD): December 31 - 30 = December 1, 2024
Option B (based on 180 rule): January 15 + 150 = June 14, 2024

Recruitment window closes: June 14, 2024 (earlier date)

Special Considerations:
- If PWD expiration is close, it limits the recruitment window
- Dashboard should show which constraint is limiting
- "PWD Limited" flag indicates PWD expiration is the constraint

This window affects all recruitment deadline calculations (notice, job order, Sunday ads).`,
    metadata: {
      source: "perm_flow.md",
      section: "recruitment-window-calculation",
    },
  },

  // Section 17: Deadline Display and Tracking
  {
    title: "Deadline Display and Tracking System",
    content: `The PERM Tracker displays and tracks all deadlines to help prevent missed dates.

Upcoming Deadline Display:
- Shows nearest deadline and associated step
- If multiple deadlines on same date, shows which comes first chronologically
- Deadline becomes inactive once the corresponding filed/completion date is entered

Special Deadline Types:

1. ETA 9089 Filing Window Opens
- Appears when 30-day waiting period completes
- Shows "Ready to File" indicator
- Goes away when ETA 9089 is filed or date passes

2. Deadline Categories:
- Overdue: Past due date, not yet completed
- This Week: Due within 7 days
- This Month: Due within 30 days
- Later: Due more than 30 days out

Deadline Notifications:
- 1 month before: Normal priority reminder
- 1 week before: Urgent reminder
- 1 day before: Critical reminder
- Same day: Final warning
- Overdue: Alert until resolved

Dashboard Deadline Widget:
- Groups deadlines by category (overdue/this week/this month/later)
- Shows case name, beneficiary, deadline type, and due date
- Click to navigate to case

Deadline Deactivation:
- Deadline becomes met/inactive when corresponding date field is populated
- Exception: "Ready to File" only goes away when filed or window passes`,
    metadata: {
      source: "perm_flow.md",
      section: "deadline-tracking",
    },
  },

  // Section 18: Dashboard Summary Tiles
  {
    title: "Dashboard Summary Tiles and Metrics",
    content: `The dashboard provides summary tiles showing case counts and status breakdowns by stage.

Summary Tile Categories:

1. Complete Tile
- Count of cases where I-140 is approved
- Represents fully completed PERM cases

2. Archived/Closed Tile
- Count of cases with Closed status
- Includes auto-closed (PWD expired, missed deadlines) and manually closed

3. PWD Tile
- Count of cases in PWD status
- Subtext shows: "X working on it, Y filed"
- Working on it = no filing date, Filed = has filing date

4. Recruitment Tile
- Count of cases in Recruitment status
- Subtext shows: "X ready to start, Y in progress"
- Ready to start = no recruitment dates entered
- In progress = at least one recruitment date entered

5. ETA 9089 Tile
- Count of cases in ETA 9089 status
- Subtext shows: "X prep, Y filed, Z RFI"
- Prep = preparing to file, Filed = has filing date, RFI = active RFI

6. I-140 Tile
- Count of cases in I-140 status
- Subtext shows: "X prep, Y filed, Z RFE"
- Prep = preparing to file, Filed = has filing date, RFE = active RFE

Each tile is clickable and filters the cases list to show only cases in that status.`,
    metadata: {
      source: "perm_flow.md",
      section: "dashboard-tiles",
    },
  },
];
