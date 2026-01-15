# v2.0 Deadline System Reference

> **Purpose:** Complete documentation of the deadline/validation ecosystem
> **Created:** 2025-12-20
> **Source:** Extracted from current codebase analysis

---

## V2 IMPLEMENTATION (Canonical Source)

> **ALL PERM business logic is implemented at:**
> ```
> v2/convex/lib/perm/           <- Backend (Convex functions)
> v2/src/lib/perm/              <- Frontend (re-exports from convex/lib/perm)
> ```
>
> **See `v2/CLAUDE.md` for complete API documentation and import guidance.**
>
> This document describes the REQUIREMENTS. The implementation lives in the module above.

### V2 Module Structure

| Directory | Purpose |
|-----------|---------|
| `convex/lib/perm/calculators/` | PWD, ETA 9089, recruitment, I-140, RFI calculations |
| `convex/lib/perm/validators/` | All 44 validation rules (V-PWD-*, V-REC-*, etc.) |
| `convex/lib/perm/dates/` | Business days, federal holidays, filing window |
| `convex/lib/perm/cascade.ts` | Auto-calculation when dates change |
| `convex/lib/perm/recruitment/` | Recruitment completion checks |

---

## Overview

The deadline system is the CORE of PERM Tracker. Everything builds on it.

### Key Files in V1 Codebase (Legacy Reference)

| File | Purpose | Lines |
|------|---------|-------|
| `backend/app/utils/date_validation.py` | All PERM validation rules | 684 |
| `backend/app/utils/deadline_relevance.py` | Supersession logic | 198 |
| `backend/app/services/case_service.py` | Auto-calculations, stage logic | 957 |
| `backend/app/utils/business_days.py` | Federal holiday aware | ~100 |
| `frontend/src/js/utils/form/dateValidation.js` | Client-side mirror | 561 |

---

## Case Stage Progression

### 11-Stage Linear Flow

| Stage | Trigger Condition | Relevant Deadlines |
|-------|-------------------|-------------------|
| PWD | Only `pwd_filing_date` entered | None yet |
| PWD Approved | `pwd_determination_date` filled | PWD expiration |
| Recruitment | `sunday_ad_first_date` OR `job_order_end_date` entered | Recruitment end, 180-day limit |
| ETA 9089 Prep | Recruitment complete + 30-day wait satisfied | Filing window open |
| ETA 9089 Filed | `eta9089_filing_date` entered | None (superseded) |
| ETA 9089 Certified | `eta9089_certification_date` filled | ETA 9089 expiration (I-140 deadline) |
| I-140 Prep | Certification received, no I-140 yet | I-140 filing deadline |
| I-140 Filed | `i140_filing_date` entered | None (superseded) |
| I-140 Approved | `i140_approval_date` entered | None |
| Complete | Synonym for I-140 Approved | None |
| Withdrawn/Denied | Manual-only | None (terminal) |

---

## Validation Rules

### PWD Phase

| Rule | Type | Description |
|------|------|-------------|
| PWD filing < determination | Error | Filing must precede determination |
| PWD determination < expiration | Error | Expiration must follow determination |
| PWD expiration calculation | Auto | Apr 2-Jun 30: +90 days, else Jun 30 |
| PWD expired warning | Warning | Non-blocking for historical cases |

### Recruitment Phase

| Rule | Type | Description |
|------|------|-------------|
| Sunday ads on Sundays | Error | Both ads must be on Sundays |
| Second ad > first ad | Error | Strict ordering |
| Job order ≥ 30 days | Error | Minimum duration |
| Notice of Filing ≥ 10 business days | Error | Federal holidays excluded |
| Recruitment end calculation | Auto | max(second_ad, job_order_end) |

### ETA 9089 Phase

| Rule | Type | Description |
|------|------|-------------|
| Filing ≥ 30 days after recruitment | Error | Minimum wait |
| Filing ≤ 180 days after recruitment | Error | Maximum window |
| Filing before PWD expiration | Error | When recruitment started before PWD |
| Expiration calculation | Auto | Certification + 180 days |

### I-140 Phase

| Rule | Type | Description |
|------|------|-------------|
| Filing > certification | Error | Strict ordering |
| Filing ≤ 180 days after certification | Error | Hard deadline |
| Approval > filing | Error | Strict ordering |
| Weekend/holiday extension | Auto | Extends to next business day |

### RFI/RFE

| Rule | Type | Description |
|------|------|-------------|
| Due > received | Error | Due date after received |
| Submitted ≥ received | Error | Can't submit before receiving |
| Late submission | Warning | Non-blocking warning |

---

## PWD Expiration Calculation

### The April 2 - June 30 Rule (20 CFR § 656.40(c))

```typescript
function calculatePwdExpiration(determinationDate: Date): Date {
  const month = determinationDate.getMonth(); // 0-indexed
  const day = determinationDate.getDate();
  const year = determinationDate.getFullYear();

  // April 2 - June 30: expires in 90 days
  if ((month === 3 && day >= 2) || month === 4 || (month === 5 && day <= 30)) {
    return addDays(determinationDate, 90);
  }

  // July 1 - December 31: expires June 30 of FOLLOWING year
  if (month >= 6) {
    return new Date(year + 1, 5, 30); // June 30 next year
  }

  // January 1 - April 1: expires June 30 of SAME year
  return new Date(year, 5, 30); // June 30 this year
}
```

### PWD/Recruitment Interaction

**Critical Edge Case:**

If recruitment starts AFTER PWD is issued, the PWD expiration does NOT limit ETA 9089 filing. Only the 180-day recruitment window applies.

```typescript
function shouldEnforcePwdExpiration(case: Case): boolean {
  // If recruitment started before PWD was issued
  if (case.jobOrderStartDate < case.pwdDeterminationDate) {
    return true; // PWD expiration matters
  }
  return false; // Only recruitment 180-day window matters
}
```

---

## Deadline Relevance (Supersession)

### When Deadlines Become Irrelevant

| Deadline | Superseded By | Why |
|----------|---------------|-----|
| PWD expiration | ETA 9089 filing | Filing "locks in" the PWD |
| Recruitment end | ETA 9089 filing | Recruitment complete once filed |
| ETA 9089 filing window | ETA 9089 filing | Window closes when filed |
| Ready to file | ETA 9089 filing | No longer pending |
| Recruitment expiration | ETA 9089 filing | 180-day limit met |
| ETA 9089 expiration | I-140 filing | I-140 deadline met |
| RFI response | RFI submitted | RFI complete |
| RFE response | RFE submitted | RFE complete |

### Terminal Statuses (All Deadlines Hidden)

- Complete
- Closed
- Withdrawn
- Denied

### Implementation Pattern

```typescript
function isDeadlineRelevant(deadlineType: string, case: Case): boolean {
  // Check terminal statuses
  if (['Complete', 'Closed', 'Withdrawn', 'Denied'].includes(case.status)) {
    return false;
  }

  // Check supersession
  switch (deadlineType) {
    case 'pwd_expiration':
      return !case.eta9089FilingDate;
    case 'recruitment_end':
      return !case.eta9089FilingDate;
    case 'eta9089_expiration':
      return !case.i140FilingDate;
    // ... etc
  }
}
```

---

## Cascade Behavior

### When Date Changes, What Happens

1. **Recalculate dependent dates**
   - PWD determination → PWD expiration
   - Recruitment dates → Recruitment end
   - ETA 9089 certification → ETA 9089 expiration

2. **Revalidate related fields**
   - Check all cross-validations
   - Show errors/warnings as appropriate

3. **Update status if needed**
   - Auto-determine new case status

4. **Clean up irrelevant items**
   - Delete superseded notifications
   - Delete superseded calendar events

### Example Cascade

```
User enters: eta9089_filing_date = 2025-04-01

System does:
1. Status auto-updates to "ETA 9089 Filed"
2. PWD expiration deadline → IRRELEVANT
3. Recruitment deadlines → IRRELEVANT
4. Filing window deadline → IRRELEVANT
5. Delete PWD notifications
6. Delete recruitment notifications
7. Delete PWD calendar events
8. Delete recruitment calendar events
9. Remaining relevant: ETA 9089 expiration, I-140 deadline
```

---

## Deadline Display Locations

### Dashboard
- Deadline hero widget
- Groups: Overdue | This Week | This Month | Later
- Urgency colors: red (overdue), orange (critical), yellow (high), green (normal)

### Case Detail
- Inline with case data
- Stage-appropriate deadlines only
- Relevance filtering applied

### Calendar
- Google Calendar events
- One event per deadline type (configurable)
- Events deleted when superseded

### Notifications
- In-app notification center
- Email notifications (if enabled)
- Scheduler creates reminders daily at 9 AM

### Timeline
- Visual progression
- Deadlines shown inline with stages
- Past vs future distinction

---

## Business Day Calculator

### Federal Holidays (2025-2027)

```typescript
const FEDERAL_HOLIDAYS = [
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents' Day
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // ... 2026, 2027
];

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip federal holidays
      if (!FEDERAL_HOLIDAYS.includes(dateStr)) {
        count++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}
```

---

## Professional Occupation Rules

### Additional Recruitment Steps

If `is_professional_occupation === true`:
- Require 3 additional recruitment steps (from list of 10)
- All steps must occur within 180 days before filing
- **Only ONE step may end within 30 days of filing**

### Validation

```typescript
function validateProfessionalSteps(
  steps: RecruitmentStep[],
  filingDate: Date
): ValidationResult {
  const stepsInFinal30Days = steps.filter(step =>
    differenceInDays(filingDate, step.endDate) < 30
  );

  if (stepsInFinal30Days.length > 1) {
    return {
      type: 'error',
      message: 'Only one additional step may occur within 30 days of filing'
    };
  }

  return { type: 'valid' };
}
```

---

## Cleanup Operations

### On Case Delete

1. Delete all notifications for case
2. Delete all calendar events for case
3. Soft delete case (set deleted_at)

### On Case Archive/Close

1. Delete pending deadline notifications
2. Delete future calendar events
3. Keep historical notifications
4. Keep past calendar events

### On Stage Progress

1. Identify newly superseded deadlines
2. Delete superseded notifications
3. Delete superseded calendar events
4. Create new relevant notifications
5. Create new relevant calendar events

---

## Testing Requirements

### Must Cover

1. All 15+ validation rules
2. PWD expiration calculation (all date ranges)
3. Supersession logic (all combinations)
4. Cascade behavior (date changes)
5. Business day calculation (holidays)
6. Professional occupation rules
7. Edge cases:
   - PWD expires during recruitment
   - Recruitment started before PWD
   - 90-day PWD validity
   - Weekend/holiday extensions
   - One step in final 30 days

### Test Count Target

Match or exceed 377 behaviors from current test suite.

---

## Architecture for v2.0

### Central Module Structure (IMPLEMENTED)

> **NOTE:** This structure is now IMPLEMENTED at `v2/convex/lib/perm/`.
> See `v2/CLAUDE.md` for the complete API reference.

```
convex/lib/perm/               # CANONICAL SOURCE - ALL imports from here
├── index.ts                   # Public API - import from this
├── types.ts                   # TypeScript types (ISODateString, CaseData, ValidationResult)
├── statusTypes.ts             # CaseStatus, ProgressStatus
├── cascade.ts                 # Auto-calculation (applyCascade)
├── calculators/
│   ├── index.ts
│   ├── pwd.ts                 # calculatePWDExpiration
│   ├── eta9089.ts             # calculateETA9089Window, calculateETA9089Expiration
│   ├── recruitment.ts         # calculateRecruitmentDeadlines
│   ├── i140.ts                # calculateI140FilingDeadline
│   └── rfi.ts                 # calculateRFIDueDate
├── validators/
│   ├── index.ts
│   ├── pwd.ts                 # validatePWD (V-PWD-*)
│   ├── recruitment.ts         # validateRecruitment (V-REC-*)
│   ├── eta9089.ts             # validateETA9089 (V-ETA-*)
│   ├── i140.ts                # validateI140 (V-I140-*)
│   ├── rfi.ts                 # validateRFI (V-RFI-*)
│   ├── rfe.ts                 # validateRFE (V-RFE-*)
│   └── validateCase.ts        # Full case validation
├── dates/
│   ├── businessDays.ts        # addBusinessDays, countBusinessDays
│   ├── holidays.ts            # getFederalHolidays, isFederalHoliday
│   └── filingWindow.ts        # calculateFilingWindow, getFilingWindowStatus
├── recruitment/
│   └── isRecruitmentComplete.ts  # isRecruitmentComplete (canonical)
└── utils/
    └── fieldMapper.ts         # snake_case ↔ camelCase conversion
```

### Extensibility

```typescript
// Adding a new rule
const VALIDATION_RULES: ValidationRule[] = [
  // ... existing rules
  {
    id: 'new_rule',
    validate: (case) => { /* ... */ },
    errorMessage: 'New rule failed'
  }
];

// Removing a rule
const activeRules = VALIDATION_RULES.filter(r => r.id !== 'deprecated_rule');
```

### Chatbot Integration

```typescript
// Tools can use validation module
const tools = {
  validateCase: tool({
    description: 'Validate case dates',
    parameters: z.object({
      caseId: z.string()
    }),
    execute: async ({ caseId }) => {
      const case = await getCase(caseId);
      return validateAllRules(case);
    }
  })
};
```

---

## Key Constants

Replace magic numbers with named constants:

```typescript
export const PERM_CONSTANTS = {
  PWD_VALIDITY_DAYS_APR_JUN: 90,
  RECRUITMENT_WAIT_DAYS: 30,
  RECRUITMENT_MAX_DAYS: 180,
  ETA9089_EXPIRATION_DAYS: 180,
  I140_FILING_DEADLINE_DAYS: 180,
  JOB_ORDER_MIN_DAYS: 30,
  NOTICE_OF_FILING_BUSINESS_DAYS: 10,
  PROFESSIONAL_STEPS_FINAL_DAYS: 30
};
```

---

*Last updated: 2025-12-20*
