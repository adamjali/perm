# PERM Tracker v2: Complete System Architecture Guide

> **Purpose**: Single source of truth for understanding the PERM Tracker system, its deadline logic, architectural patterns, and implementation standards.
>
> **Audience**: Developers, AI assistants, future maintainers
>
> **Last Updated**: 2025-12-29

---

## Table of Contents

1. [The PERM Domain](#part-1-the-perm-domain)
2. [All Deadlines - Complete Reference](#part-2-all-deadlines---complete-reference)
3. [The Architectural Vision](#part-3-the-architectural-vision)
4. [Current V2 State](#part-4-current-v2-state)
5. [Specific Fixes Needed](#part-5-specific-fixes-needed)
6. [Form and UI - User-Facing Explanations](#part-6-form-and-ui---user-facing-explanations)
7. [Documentation Standards](#part-7-documentation-standards)
8. [Implementation Plan](#part-8-implementation-plan)
9. [Deferred Features](#part-9-deferred-features)

---

## Part 1: The PERM Domain

### What is PERM?

PERM (Program Electronic Review Management) is the U.S. Department of Labor's system for processing labor certifications. When a U.S. employer wants to sponsor a foreign worker for a green card through employment, they must first prove:

1. No qualified U.S. workers are available for the position
2. Hiring the foreign worker won't negatively affect U.S. workers' wages

This proof comes through the PERM process - a complex, multi-stage journey that typically takes **22-30 months** from start to finish.

### Why This App Exists

Immigration attorneys managing PERM cases face a nightmare of complexity:

- **Cascading deadlines**: Missing one deadline can invalidate months of work
- **Complex calculations**: Deadlines depend on other dates in non-obvious ways
- **Strict regulations**: The DOL has rigid rules (20 CFR § 656.40) that must be followed exactly
- **High stakes**: A single mistake can force restarting a 2-year process

PERM Tracker solves this by:
- Automatically calculating all deadlines
- Validating dates against DOL regulations before saving
- Syncing deadlines to Google Calendar (planned)
- Sending email reminders (planned)
- Providing a dashboard showing what needs attention
- Offering AI chatbot assistance for queries

### Who Uses It

Immigration attorneys at law firms. The app supports:
- **Individual**: Solo practitioners
- **Firm Admin**: Law firm administrators
- **Firm Member**: Attorneys at a firm

### The Four Stages

A PERM case moves through four major stages:

#### Stage 1: PWD (Prevailing Wage Determination) — 6-7 months

The employer files with the National Prevailing Wage Center to get the official wage for the position.

**Key dates**:
- `pwdFilingDate` - When application submitted
- `pwdDeterminationDate` - When wage determined (triggers expiration calculation)
- `pwdExpirationDate` - Auto-calculated, when PWD becomes invalid

#### Stage 2: Recruitment — 2-3 months

The employer demonstrates they tried to find U.S. workers.

**Mandatory for all positions**:
- Job order with State Workforce Agency (30 consecutive calendar days)
- Two Sunday newspaper advertisements (at least 7 days apart)
- Notice of Filing posted internally (10 consecutive business days)

**For professional occupations only** (`isProfessionalOccupation = true`):
- Three additional recruitment methods from a list of ten options

#### Stage 3: ETA 9089 Filing — 15-16 months processing

The Application for Permanent Employment Certification.

**Critical constraints**:
- Must wait **30 days** after LAST recruitment step ends (mandatory quiet period)
- Must file within **180 days** of FIRST recruitment step starting
- Must file before PWD expires (or have started recruitment during PWD validity)

#### Stage 4: I-140 Immigrant Petition — 4-11 months

Filed with USCIS within 180 days of ETA 9089 certification.

---

## Part 2: All Deadlines - Complete Reference

### Overview

The system tracks **12 deadline types**. Each has:
- A **calculation formula**
- **Active** conditions (when to show/notify)
- **Inactive** conditions (when to hide/stop notifying)
- **User-facing explanation** (what to tell users)

### Deadline Reference Table

| # | Deadline Type | Formula | Active When | Inactive When |
|---|---------------|---------|-------------|---------------|
| 1 | PWD Expiration | See PWD calculation below | PWD determined, ETA 9089 NOT filed | ETA 9089 filed |
| 2 | Notice of Filing Start Deadline | `MIN(first+140, pwd-40)` (accounting for 10 business days) | Recruitment planning | Notice started |
| 3 | Job Order Start Deadline | `MIN(first+120, pwd-60)` | Recruitment planning | Job order started |
| 4 | First Sunday Ad Deadline | `lastSunday(MIN(first+143, pwd-37))` | Recruitment planning | First ad placed |
| 5 | Second Sunday Ad Deadline | `lastSunday(MIN(first+150, pwd-30))` | First ad placed | Second ad placed |
| 6 | Recruitment Window | `MIN(first+150, pwd-30)` | First recruitment started | All recruitment dates filled |
| 7 | ETA 9089 Filing Window Opens | `lastRecruitment + 30 days` | Recruitment ends (immediately, as countdown) | ETA 9089 filed |
| 8 | ETA 9089 Filing Deadline | `MIN(first+180, pwdExpiration)` | Filing window opens | ETA 9089 filed |
| 9 | ETA 9089 Expiration / I-140 Deadline | `certification + 180 days` | ETA 9089 certified, I-140 NOT filed | I-140 filed |
| 10 | I-140 Filing Deadline | Same as #9 | ETA 9089 certified, I-140 NOT filed | I-140 filed |
| 11 | RFI Response Due | `received + 30 days` (STRICT) | RFI received, NOT submitted | Response submitted |
| 12 | RFE Response Due | User-editable | RFE received, NOT submitted | Response submitted |

### PWD Expiration Calculation

Per 20 CFR § 656.40(c):

```
IF determination_date is between April 2 and June 30:
  expiration = determination_date + 90 days

ELSE IF determination_date is between July 1 and December 31:
  expiration = June 30 of FOLLOWING year

ELSE (January 1 - April 1):
  expiration = June 30 of SAME year
```

**Location**: `v2/convex/lib/perm/calculators/pwd.ts`

### Recruitment Deadline Calculations

All recruitment deadlines use TWO constraints and take the MINIMUM (earlier date):
1. **Recruitment constraint**: Days from first recruitment date
2. **PWD constraint**: Days before PWD expiration

This ensures recruitment completes in time regardless of which constraint is tighter.

#### Notice of Filing Start Deadline

The notice must run for 10 BUSINESS days. The deadline is when you must START to finish in time.

```
notice_completion_deadline = MIN(first + 150, pwd - 30)
notice_START_deadline = notice_completion_deadline - 10 BUSINESS DAYS
```

**Effective deadline**: `MIN(first + 140, pwd - 40)` approximately (varies due to business days)

#### Sunday Ad Deadlines

Must be on actual Sundays. Formula finds the last possible Sunday before the constraint.

```
first_sunday_deadline = lastSundayOnOrBefore(MIN(first + 143, pwd - 37))
second_sunday_deadline = lastSundayOnOrBefore(MIN(first + 150, pwd - 30))
```

**Why 143/150 and 37/30?**
- Allows time for the 30-day quiet period before filing
- Ensures second Sunday is at least 7 days after first (enforced in validation, not formula)

### Filing Window Calculations

**Three related but distinct concepts:**

#### 1. Recruitment Window (when recruitment must complete)

```
recruitment_window_closes = MIN(first + 150, pwd - 30)
```

This is an "effective" deadline that accounts for the 30-day waiting period. It's 150 days (not 180) to leave room for the mandatory 30-day wait.

**Active**: From first recruitment date until ALL recruitment dates are filled
**Inactive**: When all required dates are filled (respecting `isProfessionalOccupation`)

#### 2. Filing Window Opens (earliest you can file)

```
filing_window_opens = lastRecruitmentEnd + 30 days
```

Where `lastRecruitmentEnd` is the MAX of:
- `sundayAdSecondDate`
- `jobOrderEndDate`
- `noticeOfFilingEndDate`
- IF `isProfessionalOccupation = true`: also include `additionalRecruitmentEndDate` and individual method dates
- IF `isProfessionalOccupation = false`: IGNORE additional recruitment dates even if filled

**Active**: Immediately when recruitment ends (acts as countdown: "Filing opens in X days")
**Inactive**: Once ETA 9089 is filed

#### 3. Filing Deadline (latest you can file)

```
filing_deadline = MIN(first + 180, pwdExpiration)
```

This is the HARD deadline. Must file before this date.

**Active**: Once filing window opens
**Inactive**: Once ETA 9089 is filed

### Supersession (Active/Inactive Logic)

Deadlines become **irrelevant** once their stage completes:

| When this happens... | These deadlines become inactive |
|---------------------|--------------------------------|
| ETA 9089 filed | PWD expiration, all recruitment deadlines, filing window opens, filing deadline |
| I-140 filed | ETA 9089 expiration, I-140 deadline |
| RFI response submitted | That specific RFI due date |
| RFE response submitted | That specific RFE due date |
| Case closed/completed | ALL deadlines |

**Implementation in v2**: Inline conditionals in `extractDeadlines()` function in `dashboardHelpers.ts`

### User-Facing Explanations

For deadlines that aren't the "exact" date but account for waiting periods, users need explanations:

| Deadline | User Explanation |
|----------|------------------|
| Recruitment Window | "This is an effective deadline that accounts for the mandatory 30-day waiting period before you can file ETA 9089. Actual filing window is 180 days from first recruitment, but recruitment must complete 30 days before that." |
| Notice Start Deadline | "This is when you should START the Notice of Filing posting to ensure 10 business days complete before the filing window." |
| Filing Window Opens | "After recruitment ends, federal regulations require a 30-day waiting period before filing ETA 9089. This countdown shows when that waiting period ends." |

---

## Part 3: The Architectural Vision

### The Core Principle

**Single canonical function + database storage for queryability**

Every calculation should exist in ONE place. That function is the source of truth for the LOGIC. The database stores the RESULT for queryability.

```
┌─────────────────────────────────────────────────────────────────┐
│  lib/perm/calculations                                       │
│  (Single source of truth for HOW to calculate)                  │
│                                                                 │
│  calculateRecruitmentDates(caseData) → {                        │
│    firstRecruitmentDate,                                        │
│    lastRecruitmentDate,                                         │
│    filingWindowOpens,                                           │
│    filingWindowCloses,                                          │
│    recruitmentWindowCloses,                                     │
│    ...                                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  On case save (create/update mutation)                          │
│                                                                 │
│  1. Call canonical calculation functions                        │
│  2. Store results in database fields                            │
│  3. Save both source dates AND derived dates                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Queries / Dashboard / Chatbot                                  │
│                                                                 │
│  "Show cases with deadlines this week"                          │
│  → Query: WHERE filingWindowCloses < next_week                  │
│                                                                 │
│  Can filter/sort at database level without recalculating        │
└─────────────────────────────────────────────────────────────────┘
```

### This Pattern Applies to EVERYTHING

| Domain | What gets centralized | What gets stored |
|--------|----------------------|------------------|
| **Deadline calculations** | All formulas in lib/perm | Derived deadline dates |
| **Date validations** | All rules in lib/perm/validators | Validation results (pass/fail) |
| **Form field constraints** | Min/max dates from lib/perm | N/A (calculated on render) |
| **Auto-calculations** | PWD exp, ETA exp, Notice end, etc. | The calculated values |
| **Status determination** | Case status logic | Suggested + actual status |
| **Supersession logic** | Which deadlines are active | Active deadline list |
| **Filing window status** | Open/closed/waiting | Status enum |

### Schema Additions Needed

Add these derived fields to the `cases` table:

```typescript
// Derived recruitment dates
recruitmentStartDate: v.optional(v.string()),      // MIN of first recruitment steps
recruitmentEndDate: v.optional(v.string()),        // MAX of last recruitment steps

// Derived filing window
filingWindowOpens: v.optional(v.string()),         // recruitmentEnd + 30 days
filingWindowCloses: v.optional(v.string()),        // MIN(recruitmentStart + 180, pwdExpiration)
recruitmentWindowCloses: v.optional(v.string()),   // MIN(recruitmentStart + 150, pwdExpiration - 30)

// Derived deadline statuses
isRecruitmentComplete: v.optional(v.boolean()),    // All required dates filled
isFilingWindowOpen: v.optional(v.boolean()),       // Past 30-day wait
isPwdExpired: v.optional(v.boolean()),             // Past PWD expiration
```

### How Save Handlers Should Work

```typescript
// In Convex mutation (cases.ts)
async function createCase(ctx, args) {
  // 1. Get the raw input data
  const caseData = args.caseData;

  // 2. Call canonical calculation functions
  const derivedDates = calculateAllDerivedDates(caseData);

  // 3. Merge derived values with input
  const fullCase = {
    ...caseData,
    ...derivedDates,
  };

  // 4. Validate (using lib/perm validators)
  const validation = validateCase(fullCase);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  // 5. Save to database
  return await ctx.db.insert('cases', fullCase);
}
```

### How Queries Use Stored Values

```typescript
// Dashboard query - no recalculation needed
const urgentDeadlines = await ctx.db
  .query('cases')
  .filter(q =>
    q.and(
      q.lt(q.field('filingWindowCloses'), nextWeek),
      q.eq(q.field('eta9089FilingDate'), undefined)
    )
  )
  .collect();

// Chatbot can query directly
// "Show me cases where I need to file soon"
// → Query filingWindowCloses < 14 days
```

---

## Part 4: Current V2 State

### What Exists and Works

**lib/perm** (`v2/convex/lib/perm/`) - The intended central source of truth:

| Component | Files | Lines | Tests | Coverage |
|-----------|-------|-------|-------|----------|
| Calculators | 10 files | ~1,500 | 100+ | 100% |
| Validators | 8 files | ~2,000 | 150+ | 100% |
| Utilities | 5 files | ~500 | 76 | 100% |
| **Total** | **23 files** | **~7,500** | **326** | **100%** |

**What lib/perm provides:**
- PWD expiration calculation
- All recruitment deadline calculations
- ETA 9089 filing window calculations
- I-140 deadline calculations
- RFI/RFE due date calculations
- 44 validation rules across all phases
- Business day calculations (federal holiday aware)
- Cascade update logic

### What's Broken (Duplicate Implementations)

Three files bypass lib/perm with their own implementations:

#### 1. `date-constraints.ts` (720 lines)

**Location**: `v2/src/lib/forms/date-constraints.ts`

**Problem**: Reimplements recruitment deadline calculations locally instead of importing from lib/perm.

**Used by**: 9 files (all form sections, useDateFieldValidation)

**Fix**: Refactor to import from lib/perm

#### 2. `statusCalculator.ts` (365 lines) - UNUSED

**Location**: `v2/src/lib/recruitment/statusCalculator.ts`

**Problem**: Complete duplicate of recruitment calculations. Not imported anywhere.

**Fix**: DELETE this file

#### 3. `milestones.ts`

**Location**: `v2/src/lib/timeline/milestones.ts`

**Problem**: Reimplements recruitment end date calculation

**Fix**: Refactor to import from lib/perm

### What's Missing from V1

| Feature | V1 Status | V2 Status | Priority |
|---------|-----------|-----------|----------|
| Deadline supersession | Separate module | Inline (works) | Low (functional) |
| Google Calendar sync | Complete | Not started | Deferred |
| Email notifications | Complete | Not started | Deferred |
| Notification scheduler | Complete | Not started | Deferred |
| Path B rule (Either/Or) | Implemented | Missing | Deferred |

### Timezone Handling Issues

**Current state in v2:**

| Layer | Handling | Issue |
|-------|----------|-------|
| Storage | ISO strings `YYYY-MM-DD` | OK |
| Calculations | UTC methods | OK |
| Display (some) | UTC formatting | OK |
| Display (some) | `toLocaleDateString()` | INCONSISTENT |
| Parsing | `+ "T00:00:00"` pattern (93 instances) | Creates local timezone |
| User preference | Stored but NEVER USED | Wasted |

**What should happen:**
- Store: ISO date strings (no time component)
- Calculate: UTC always
- Display: User's timezone (from stored preference)
- Parsing: Standardized UTC parsing helper

### Dashboard Inconsistencies

**Bug found**: Dashboard uses `first + 180` for recruitment window, but recruitment calculator uses `MIN(first + 150, pwd - 30)`.

**Impact**: Dashboard shows deadline 30 days later than actual.

---

## Part 5: Specific Fixes Needed

### Fix 1: Notice of Filing Start Deadline

**Current**: Calculates when notice must COMPLETE

**Needed**: Calculate when notice must START (subtract 10 business days)

**File**: `v2/convex/lib/perm/calculators/recruitment.ts`

**Change**:
```typescript
// Add new function
export function calculateNoticeOfFilingStartDeadline(
  firstRecruitmentDate: string,
  pwdExpirationDate: string
): string {
  const completionDeadline = calculateNoticeOfFilingDeadline(firstRecruitmentDate, pwdExpirationDate);
  return subtractBusinessDays(completionDeadline, 10);
}
```

### Fix 2: Filing Window Opens - Active Immediately

**Current**: Unclear when "active"

**Needed**: Active IMMEDIATELY when recruitment ends, showing countdown to when it opens

**File**: `v2/convex/lib/dashboardHelpers.ts`

**Change**: Extract "Filing Window Opens" deadline as soon as recruitment end date exists, not after 30 days pass.

### Fix 3: ETA 9089 Filing Deadline - Include PWD

**Current**: Dashboard uses `first + 180` without PWD constraint

**Needed**: `MIN(first + 180, pwdExpiration)`

**File**: `v2/convex/lib/dashboardHelpers.ts` (line ~289)

### Fix 4: Recruitment Window - Inactive When Complete

**Current**: Only inactive when ETA 9089 filed

**Needed**: Inactive when all required dates are filled

**Logic**:
```typescript
function isRecruitmentComplete(caseData): boolean {
  // Base requirements (always required)
  const baseComplete =
    caseData.sundayAdFirstDate &&
    caseData.sundayAdSecondDate &&
    caseData.jobOrderStartDate &&
    caseData.jobOrderEndDate &&
    caseData.noticeOfFilingStartDate &&
    caseData.noticeOfFilingEndDate;

  // Professional requirements (only if checked)
  if (caseData.isProfessionalOccupation) {
    return baseComplete &&
      caseData.additionalRecruitmentMethods?.length >= 3 &&
      caseData.additionalRecruitmentMethods.every(m => m.date);
  }

  return baseComplete;
}
```

### Fix 5: isProfessionalOccupation Check

**Files needing fix** (missing the check):
- `v2/convex/lib/perm/filing-window.ts` - `getLastRecruitmentDate()`
- `v2/convex/lib/dashboardHelpers.ts` - `calculateRecruitmentEndDate()` (line 327)
- `v2/src/lib/forms/case-form-schema.ts` (line 527)

**Fix**: Add parameter and check:
```typescript
if (isProfessionalOccupation && additionalRecruitmentMethods) {
  // Include additional dates
}
```

### Fix 6: Delete Unused Code

**Delete**: `v2/src/lib/recruitment/statusCalculator.ts` (365 lines, never imported)

### Fix 7: Timezone Standardization

**Create**: `v2/src/lib/utils/timezone.ts`

```typescript
// Parse ISO date as UTC
export function parseISODateUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Format date for display (user's timezone)
export function formatDateForDisplay(dateStr: string, timezone?: string): string {
  const date = parseISODateUTC(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Format date for input fields (always YYYY-MM-DD)
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

**Then**: Replace all 93 instances of `+ "T00:00:00"` with `parseISODateUTC()`

### Fix 8: Refactor date-constraints.ts

**Current**: 720 lines with duplicate calculations

**Fix**: Import from lib/perm instead of reimplementing

```typescript
// Before (BAD)
const maxFromRecruitment = format(
  addDays(new Date(firstRecruitmentDate + "T00:00:00"), config.daysFromRecruitment),
  "yyyy-MM-dd"
);

// After (GOOD)
import { calculateRecruitmentDeadlines } from '@/lib/perm/calculators/recruitment';

const deadlines = calculateRecruitmentDeadlines(firstRecruitmentDate, pwdExpirationDate);
const maxFromRecruitment = deadlines.notice_of_filing_deadline;
```

---

## Part 6: Form and UI - User-Facing Explanations

### Where Explanations Should Go

| Location | Type | What to Explain |
|----------|------|-----------------|
| Field tooltip/hint | Inline hint text | Why this date matters, constraints |
| Section header | Expandable info | How this phase works overall |
| Dedicated help page | Full documentation | Complete deadline system explanation |
| Dashboard widget | Tooltip on hover | What this deadline means, what action to take |
| Calendar event | Event description | Why this date is on the calendar |

### Specific Explanations Needed

#### Recruitment Window

**Where**: Dashboard widget tooltip, Recruitment section header

**What**:
> "The Recruitment Window shows when all recruitment activities must be completed. This is an 'effective' deadline that accounts for the mandatory 30-day waiting period before filing ETA 9089. While the actual filing deadline is 180 days from first recruitment, this window closes 30 days earlier to ensure you have time for the required quiet period."

#### Filing Window Opens (Countdown)

**Where**: Dashboard widget tooltip, ETA 9089 section

**What**:
> "After recruitment ends, federal regulations (20 CFR § 656.17) require a 30-day waiting period before you can file ETA 9089. This countdown shows when that waiting period ends and you become eligible to file."

#### Notice of Filing Start Deadline

**Where**: Field tooltip on `noticeOfFilingStartDate`

**What**:
> "This is the latest date you should START the Notice of Filing posting. The notice must be posted for at least 10 business days, and must complete before the filing deadline. Starting by this date ensures you have enough time."

#### Sunday Ad Deadlines

**Where**: Field tooltips on Sunday ad date fields

**What**:
> "Sunday advertisements must be placed on actual Sundays in a newspaper of general circulation. The second ad must be at least 7 days after the first. These deadlines show the last possible Sundays that allow enough time for the filing window."

### Storybook Patterns

Create stories that demonstrate deadline explanations:

```typescript
// DeadlineExplanation.stories.tsx

export default {
  title: 'Domain/Deadline Explanations',
  component: DeadlineTooltip,
};

export const RecruitmentWindow = {
  args: {
    deadlineType: 'recruitment_window',
    showExplanation: true,
  },
};

export const FilingWindowOpens = {
  args: {
    deadlineType: 'filing_window_opens',
    showExplanation: true,
  },
};

// etc.
```

### Help Page Structure

Create `/help/deadlines` page with:

1. **Overview** - What deadlines are and why they matter
2. **The Four Stages** - Visual timeline
3. **Each Deadline Type** - Expandable sections with:
   - What it is
   - How it's calculated
   - What to do before it
   - What happens if missed
4. **FAQ** - Common questions
5. **Glossary** - Terms like "business days", "quiet period", "supersession"

---

## Part 7: Documentation Standards

### Files That Need Updating

| File | What to Update |
|------|----------------|
| `perm_flow.md` | Add "effective deadline" concept, clarify formulas |
| `V2_BUSINESS_RULES.md` | Add centralization pattern, schema additions |
| `V2_DEADLINE_SYSTEM.md` | Fix formulas, add active/inactive rules |
| `V2_DEADLINE_FLOWS.md` | Add user-facing explanations |
| `ARCHITECTURE.md` | Add "single canonical function" pattern |

### Preventing Future Confusion

#### Rule 1: No Local Calculations

Any file that needs a deadline calculation MUST import from lib/perm. No exceptions.

**Enforced by**: ESLint rule (add to `.eslintrc`)
```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["date-fns"],
        "importNames": ["addDays", "subDays", "differenceInDays"],
        "message": "Use lib/perm calculators instead of direct date-fns for deadline calculations"
      }]
    }]
  }
}
```

#### Rule 2: Schema Changes Require Derived Fields

When adding a new date field, ask: "Should this trigger recalculation of derived fields?"

If yes, update the save mutation to recalculate.

#### Rule 3: Test Coverage Required

Every calculation function in lib/perm must have:
- Happy path test
- Edge case tests (boundaries, null inputs)
- Integration test (with real case data)

#### Rule 4: Documentation Required

Every new deadline type must be documented in:
- This file (Part 2 table)
- `V2_DEADLINE_SYSTEM.md`
- User-facing help page
- Storybook story

---

## Part 8: Implementation Plan

### Phase 1: Critical Fixes (Immediate)

1. **Fix isProfessionalOccupation checks** in 3 files
2. **Fix dashboard recruitment window formula** to use `MIN(first+150, pwd-30)`
3. **Fix ETA 9089 filing deadline** to include PWD constraint
4. **Delete unused statusCalculator.ts**

### Phase 2: Centralization (Next)

1. **Add derived fields to schema** (recruitmentStartDate, recruitmentEndDate, etc.)
2. **Update save mutations** to calculate and store derived values
3. **Refactor date-constraints.ts** to import from lib/perm
4. **Refactor milestones.ts** to import from lib/perm

### Phase 3: Timezone (After Centralization)

1. **Create timezone utilities**
2. **Replace all T00:00:00 patterns**
3. **Use stored user timezone for display**
4. **Add timezone indicator to settings**

### Phase 4: UX (Ongoing)

1. **Add deadline explanations** to tooltips
2. **Create help page**
3. **Add Storybook stories** for deadline components
4. **Improve calendar event descriptions**

### Testing Strategy

For each fix:
1. Write failing test first
2. Implement fix
3. Verify test passes
4. Run full test suite
5. Manual QA in dev environment

---

## Part 9: Deferred Features

### Path B Rule (Either/Or)

**What**: Per 20 CFR § 656.40(c), ETA 9089 can be filed AFTER PWD expiration IF recruitment started during PWD validity.

**Current state**:
- V1: Implemented in Python backend
- V2: NOT implemented (rejects valid cases)

**Why deferred**: Edge case, most cases don't need it. Fix core architecture first.

**Implementation when ready**:
```typescript
// In eta9089 validator
if (eta9089FilingDate > pwdExpirationDate) {
  // Check if recruitment started during PWD validity
  const firstRecruitmentDate = getFirstRecruitmentDate(caseData);
  if (firstRecruitmentDate && firstRecruitmentDate <= pwdExpirationDate) {
    // Path B: Allow filing after expiration
    return { valid: true };
  }
  // Path A required: Must file before expiration
  return { valid: false, error: 'ETA 9089 must be filed before PWD expiration' };
}
```

### Google Calendar Integration

**What**: Sync deadlines to user's Google Calendar

**V1 implementation** (reference):
- OAuth 2.0 with `calendar.events` scope
- Create all-day events for each deadline
- Update/delete events when dates change
- Store event IDs in `calendar_event_ids` JSON field

**Schema needed**:
```typescript
// User preferences
googleCalendarConnected: v.boolean(),
googleCalendarSyncEnabled: v.boolean(),
googleRefreshToken: v.string(), // Encrypted

// Per-case settings
calendarEventIds: v.optional(v.object({
  pwd_expiration: v.string(),
  filing_deadline: v.string(),
  // etc.
})),
```

### Email Notifications

**What**: Send email reminders for upcoming deadlines

**V1 implementation** (reference):
- Resend API integration
- Daily scheduler (9 AM) checks all cases
- User preferences: reminder days (default: 1, 3, 7, 14, 30)
- HTML email templates with urgency color-coding

**Schema needed**:
```typescript
// User preferences
emailNotificationsEnabled: v.boolean(),
reminderDaysBefore: v.array(v.number()), // [1, 3, 7, 14, 30]
quietHoursEnabled: v.boolean(),
quietHoursStart: v.string(), // "22:00"
quietHoursEnd: v.string(), // "08:00"
```

### Notification Scheduler

**What**: Background job to create notifications and send emails

**Implementation approach for Convex**:
- Use Convex scheduled functions
- Run daily check at configured time
- Query cases with upcoming deadlines
- Create notification records
- Trigger email sends

---

## Appendix A: File Reference

### Core Calculation Files

| Purpose | File |
|---------|------|
| PWD expiration | `v2/convex/lib/perm/calculators/pwd.ts` |
| Recruitment deadlines | `v2/convex/lib/perm/calculators/recruitment.ts` |
| ETA 9089 window | `v2/convex/lib/perm/calculators/eta9089.ts` |
| I-140 deadline | `v2/convex/lib/perm/calculators/i140.ts` |
| RFI due date | `v2/convex/lib/perm/calculators/rfi.ts` |
| Filing window status | `v2/convex/lib/perm/filing-window.ts` |
| Business days | `v2/convex/lib/perm/business-days.ts` |
| Federal holidays | `v2/convex/lib/perm/holidays.ts` |

### Validation Files

| Purpose | File |
|---------|------|
| PWD validation | `v2/convex/lib/perm/validators/pwd.ts` |
| Recruitment validation | `v2/convex/lib/perm/validators/recruitment.ts` |
| ETA 9089 validation | `v2/convex/lib/perm/validators/eta9089.ts` |
| I-140 validation | `v2/convex/lib/perm/validators/i140.ts` |
| RFI validation | `v2/convex/lib/perm/validators/rfi.ts` |
| RFE validation | `v2/convex/lib/perm/validators/rfe.ts` |
| Aggregate validator | `v2/convex/lib/perm/validators/validate-case.ts` |

### Dashboard/Display Files

| Purpose | File |
|---------|------|
| Deadline extraction | `v2/convex/lib/dashboardHelpers.ts` |
| Dashboard queries | `v2/convex/dashboard.ts` |
| Calendar queries | `v2/convex/calendar.ts` |

### Files Needing Refactor

| File | Issue | Action |
|------|-------|--------|
| `v2/src/lib/forms/date-constraints.ts` | Duplicate calculations | Refactor to use lib/perm |
| `v2/src/lib/recruitment/statusCalculator.ts` | Unused duplicate | DELETE |
| `v2/src/lib/timeline/milestones.ts` | Duplicate recruitment end | Refactor to use lib/perm |

---

## Appendix B: Regulatory References

| Regulation | What it covers |
|------------|---------------|
| 20 CFR § 656.40(c) | PWD validity period calculation |
| 20 CFR § 656.17 | Recruitment requirements, 30-180 day filing window |
| 20 CFR § 656.17(e)(1)(i) | Sunday newspaper ad requirements |
| 20 CFR § 656.17(d) | Job order requirements (30 days) |
| 20 CFR § 656.10(d)(1)(ii) | Notice of Filing requirements (10 business days) |
| 5 U.S.C. § 6103 | Federal holidays |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-29 | Initial creation |
