# V2_DEADLINE_FLOWS.md

**Purpose:** Comprehensive reference for all deadline types, calculation formulas, validation rules, and edge cases in the PERM process.

**Created:** 2025-12-20
**Updated:** 2025-12-22
**Status:** Active Reference
**Target:** v2.0 Architecture

> **Reference:** See `V2_ORIGINAL_VISION.md` for complete requirements

---

## Table of Contents

1. [Overview](#overview)
2. [PWD Phase Deadlines](#pwd-phase-deadlines)
3. [Recruitment Phase Deadlines](#recruitment-phase-deadlines)
4. [ETA 9089 Phase Deadlines](#eta-9089-phase-deadlines)
5. [I-140 Phase Deadlines](#i-140-phase-deadlines)
6. [RFI/RFE Deadlines](#rfirfe-deadlines)
7. [Cross-Phase Dependencies](#cross-phase-dependencies)
8. [Supersession Rules](#supersession-rules)
9. [Business Day Calculation](#business-day-calculation)
10. [Urgency Levels](#urgency-levels)
11. [Worked Examples](#worked-examples)
12. [Validation Rules](#validation-rules)
13. [Edge Cases & Special Scenarios](#edge-cases--special-scenarios)
14. [Feature Cross-Reference](#feature-cross-reference)

---

## Overview

### Deadline Categories

| Category | Phases | Regulatory Basis |
|----------|--------|------------------|
| **Statutory** | PWD expiration, ETA 9089 window, I-140 deadline | 20 CFR § 656, 8 CFR § 204.5 |
| **Procedural** | Recruitment steps, Job order duration | 20 CFR § 656.17 |
| **Response** | RFI/RFE deadlines | DOL/USCIS notice |
| **User-Defined** | Internal milestones, attorney deadlines | Case management |

### Timeline Flow

```
PWD Filing → PWD Determination → [Recruitment Period] → ETA 9089 Filing →
ETA 9089 Certification → I-140 Filing → I-140 Approval
```

### Critical Constraints

1. **PWD Expiration:** Must be valid when ETA 9089 is filed
2. **Recruitment Window:** ETA 9089 must be filed 30-180 days after recruitment ends
3. **I-140 Deadline:** Must be filed within 180 days of ETA 9089 certification
4. **Overlapping Periods:** Recruitment can occur during PWD validity but filing can happen after PWD expires if within recruitment window

---

## PWD Phase Deadlines

### Deadline Types

| Deadline | Type | Calculation | Regulatory Ref |
|----------|------|-------------|----------------|
| `pwd_determination_date` | User-entered | N/A | 20 CFR § 656.40(c) |
| `pwd_expiration_date` | Calculated | See formula below | 20 CFR § 656.40(c) |

### PWD Expiration Calculation

**Regulation:** 20 CFR § 656.40(c)

```typescript
interface PWDDates {
  pwd_determination_date: Date;
  pwd_expiration_date: Date;
}

function calculatePWDExpiration(determinationDate: Date): Date {
  const month = determinationDate.getMonth() + 1; // 1-12
  const day = determinationDate.getDate();
  const year = determinationDate.getFullYear();

  // Case 1: April 2 - June 30 → +90 days
  if ((month === 4 && day >= 2) || month === 5 || (month === 6 && day <= 30)) {
    return addDays(determinationDate, 90);
  }

  // Case 2: July 1 - December 31 → June 30 of following year
  if (month >= 7) {
    return new Date(year + 1, 5, 30); // June 30 next year
  }

  // Case 3: January 1 - April 1 → June 30 of same year
  return new Date(year, 5, 30); // June 30 same year
}
```

### PWD Validation Rules

```typescript
interface PWDValidation {
  rule: string;
  check: (dates: PWDDates) => boolean;
  errorMessage: string;
}

const PWD_VALIDATIONS: PWDValidation[] = [
  {
    rule: "pwd_filing_before_determination",
    check: (d) => d.pwd_filing_date <= d.pwd_determination_date,
    errorMessage: "PWD filing date must be before or on determination date"
  },
  {
    rule: "pwd_expiration_after_determination",
    check: (d) => d.pwd_expiration_date > d.pwd_determination_date,
    errorMessage: "PWD expiration must be after determination date"
  }
];
```

### PWD Examples

**Example 1: Spring Determination (90-day rule)**
```
Determination Date: May 15, 2024
Expiration Date: May 15 + 90 days = August 13, 2024
```

**Example 2: Fall Determination (June 30 rule)**
```
Determination Date: September 10, 2024
Expiration Date: June 30, 2025
```

**Example 3: Winter Determination (June 30 same year)**
```
Determination Date: February 5, 2024
Expiration Date: June 30, 2024
```

**Example 4: Edge Case - April 1 (same year)**
```
Determination Date: April 1, 2024
Expiration Date: June 30, 2024 (NOT +90 days)
```

**Example 5: Edge Case - April 2 (90-day rule kicks in)**
```
Determination Date: April 2, 2024
Expiration Date: April 2 + 90 days = July 1, 2024
```

---

## Recruitment Phase Deadlines

### Deadline Types

| Deadline | Type | Calculation | Regulatory Ref |
|----------|------|-------------|----------------|
| `first_sunday_ad_date` | User-entered | Must be Sunday | 20 CFR § 656.17(e)(1)(i)(B)(1) |
| `second_sunday_ad_date` | User-entered | Must be Sunday, > first ad | 20 CFR § 656.17(e)(1)(i)(B)(1) |
| `job_order_start_date` | User-entered | N/A | 20 CFR § 656.17(e)(1)(i)(A) |
| `job_order_end_date` | Calculated | start + 30 days minimum | 20 CFR § 656.17(e)(1)(i)(A) |
| `notice_of_filing_start` | User-entered | N/A | 20 CFR § 656.10(d) |
| `notice_of_filing_end` | Calculated | start + 10 business days | 20 CFR § 656.10(d) |
| `recruitment_end_date` | Calculated | See formula below | 20 CFR § 656.17(e) |

### Recruitment End Calculation

```typescript
function calculateRecruitmentEnd(dates: RecruitmentDates): Date {
  const allEndDates = [
    dates.second_sunday_ad_date,
    dates.job_order_end_date,
    ...dates.additional_recruitment_steps.map(s => s.end_date).filter(Boolean)
  ];
  return max(allEndDates); // Latest date among all recruitment steps
}
```

### Recruitment Step Deadline Formulas (v2.0)

> **Reference:** See `V2_ORIGINAL_VISION.md` for rationale

These deadlines are calculated to ensure recruitment can complete within the 180-day window, accounting for the mandatory 30-day quiet period before ETA 9089 filing.

```typescript
/**
 * Calculate recruitment step deadlines based on first recruitment date and PWD expiration.
 *
 * Rationale:
 * - ETA 9089 must be filed 30-180 days after recruitment ends
 * - So recruitment must end by: min(first + 180 - 30, pwded - 30) = min(first + 150, pwded - 30)
 * - Job order needs 30 days posting, so must START by: min(first + 120, pwded - 60)
 * - 1st Sunday needs week gap for 2nd Sunday: min(first + 143, pwded - 37)
 */

function calculateRecruitmentDeadlines(
  firstRecruitmentDate: Date,
  pwdExpirationDate: Date
): RecruitmentDeadlines {

  // Notice of Filing deadline (same as 2nd Sunday - last step allowed)
  const noticeDeadline = min(
    addDays(firstRecruitmentDate, 150),
    addDays(pwdExpirationDate, -30)
  );

  // Job Order START deadline (needs 30-day posting period)
  const jobOrderStartDeadline = min(
    addDays(firstRecruitmentDate, 120),
    addDays(pwdExpirationDate, -60)
  );

  // 2nd Sunday Ad deadline (last step allowed)
  const secondSundayDeadline = lastSundayOnOrBefore(min(
    addDays(firstRecruitmentDate, 150),
    addDays(pwdExpirationDate, -30)
  ));

  // 1st Sunday Ad deadline (must be 1 week before 2nd Sunday)
  const firstSundayDeadline = lastSundayOnOrBefore(min(
    addDays(firstRecruitmentDate, 143),
    addDays(pwdExpirationDate, -37)
  ));

  return {
    notice_of_filing_deadline: noticeDeadline,
    job_order_start_deadline: jobOrderStartDeadline,
    first_sunday_ad_deadline: firstSundayDeadline,
    second_sunday_ad_deadline: secondSundayDeadline,
    recruitment_window_closes: noticeDeadline // Same as latest step deadline
  };
}

function lastSundayOnOrBefore(date: Date): Date {
  const dayOfWeek = date.getDay();
  const daysToSubtract = dayOfWeek; // Sunday = 0, so subtract 0 for Sunday
  return addDays(date, -daysToSubtract);
}
```

### Deadline Formula Summary

| Step | Formula | Rationale |
|------|---------|-----------|
| Notice of Filing | `min(first+150, pwded-30)` | Last step, 30-day buffer for quiet period |
| Job Order START | `min(first+120, pwded-60)` | +30-day posting = ends by min(first+150, pwded-30) |
| 1st Sunday Ad | `lastSunday(min(first+143, pwded-37))` | 7 days before 2nd Sunday deadline |
| 2nd Sunday Ad | `lastSunday(min(first+150, pwded-30))` | Last step, must be Sunday |

### Job Order Duration Calculation

```typescript
function calculateJobOrderEnd(startDate: Date): Date {
  // Minimum 30 calendar days
  return addDays(startDate, 30);
}
```

### Notice of Filing Duration Calculation

```typescript
function calculateNoticeOfFilingEnd(startDate: Date): Date {
  // 10 consecutive business days (exclude weekends)
  let businessDays = 0;
  let currentDate = new Date(startDate);

  while (businessDays < 10) {
    currentDate = addDays(currentDate, 1);
    if (!isWeekend(currentDate)) {
      businessDays++;
    }
  }

  return currentDate;
}
```

### Recruitment Validation Rules

```typescript
const RECRUITMENT_VALIDATIONS: ValidationRule[] = [
  {
    rule: "first_sunday_ad_is_sunday",
    check: (d) => d.first_sunday_ad_date.getDay() === 0,
    errorMessage: "First Sunday ad must be on a Sunday"
  },
  {
    rule: "second_sunday_ad_is_sunday",
    check: (d) => d.second_sunday_ad_date.getDay() === 0,
    errorMessage: "Second Sunday ad must be on a Sunday"
  },
  {
    rule: "second_sunday_after_first",
    check: (d) => d.second_sunday_ad_date > d.first_sunday_ad_date,
    errorMessage: "Second Sunday ad must be after first Sunday ad"
  },
  {
    rule: "job_order_minimum_30_days",
    check: (d) => daysBetween(d.job_order_start_date, d.job_order_end_date) >= 30,
    errorMessage: "Job order must be posted for at least 30 days"
  },
  {
    rule: "notice_of_filing_10_business_days",
    check: (d) => businessDaysBetween(d.notice_of_filing_start, d.notice_of_filing_end) === 10,
    errorMessage: "Notice of filing must be posted for 10 consecutive business days"
  }
];
```

### Professional Occupation Additional Steps

**Requirement:** 3 additional recruitment steps beyond mandatory steps (20 CFR § 656.17(e)(1)(ii))

**Critical Constraint:** Only 1 additional step can end within 30 days of ETA 9089 filing

```typescript
interface AdditionalStep {
  step_name: string;
  start_date: Date;
  end_date: Date;
}

function validateProfessionalRecruitment(
  additionalSteps: AdditionalStep[],
  eta9089FilingDate: Date
): ValidationResult {
  if (additionalSteps.length < 3) {
    return {
      valid: false,
      error: "Professional occupations require 3 additional recruitment steps"
    };
  }

  const stepsWithin30Days = additionalSteps.filter(step => {
    const daysBeforeFiling = daysBetween(step.end_date, eta9089FilingDate);
    return daysBeforeFiling <= 30;
  });

  if (stepsWithin30Days.length > 1) {
    return {
      valid: false,
      error: "Only 1 additional recruitment step can end within 30 days of ETA 9089 filing"
    };
  }

  return { valid: true };
}
```

### Recruitment Examples

**Example 1: Basic Recruitment Timeline**
```
First Sunday Ad: March 3, 2024 (Sunday)
Second Sunday Ad: March 10, 2024 (Sunday, 7 days later)
Job Order Start: March 1, 2024
Job Order End: March 31, 2024 (30 days minimum)
Recruitment End: March 31, 2024 (max of all end dates)
```

**Example 2: Professional Occupation with Additional Steps**
```
Mandatory Steps:
- First Sunday Ad: April 7, 2024
- Second Sunday Ad: April 14, 2024
- Job Order: April 1 - May 1, 2024

Additional Steps (3 required):
1. Job Fair: April 10, 2024 (ends 50 days before filing ✓)
2. Campus Recruitment: April 20, 2024 (ends 40 days before filing ✓)
3. Website Posting: May 15, 2024 (ends 15 days before filing ✓)

Recruitment End: May 15, 2024
ETA 9089 Filing: June 1, 2024

Validation: Only 1 step (Website Posting) ends within 30 days → VALID
```

**Example 3: Invalid Professional Recruitment**
```
Additional Steps:
1. Job Fair: May 10, 2024 (ends 20 days before filing ✗)
2. Campus Recruitment: May 15, 2024 (ends 15 days before filing ✗)
3. Website Posting: May 20, 2024 (ends 10 days before filing ✗)

ETA 9089 Filing: June 1, 2024

Validation: 3 steps end within 30 days → INVALID
Error: "Only 1 additional recruitment step can end within 30 days of filing"
```

---

## ETA 9089 Phase Deadlines

### Deadline Types

| Deadline | Type | Calculation | Regulatory Ref |
|----------|------|-------------|----------------|
| `eta9089_window_opens` | Calculated | recruitment_end + 30 days | 20 CFR § 656.17(e) |
| `eta9089_window_closes` | Calculated | recruitment_end + 180 days | 20 CFR § 656.17(e) |
| `eta9089_filing_date` | User-entered | Must be within window | 20 CFR § 656.17(e) |
| `eta9089_certification_date` | User-entered | N/A | N/A |
| `eta9089_expiration_date` | Calculated | certification + 180 days | 20 CFR § 656.30(b) |

### ETA 9089 Window Calculation

```typescript
interface ETA9089Dates {
  recruitment_end_date: Date;
  eta9089_window_opens: Date;
  eta9089_window_closes: Date;
  eta9089_filing_date: Date;
  eta9089_certification_date?: Date;
  eta9089_expiration_date?: Date;
}

function calculateETA9089Window(recruitmentEndDate: Date): {
  windowOpens: Date;
  windowCloses: Date;
} {
  return {
    windowOpens: addDays(recruitmentEndDate, 30),
    windowCloses: addDays(recruitmentEndDate, 180)
  };
}

function calculateETA9089Expiration(certificationDate: Date): Date {
  return addDays(certificationDate, 180);
}
```

### ETA 9089 Validation Rules

```typescript
const ETA9089_VALIDATIONS: ValidationRule[] = [
  {
    rule: "filing_within_window",
    check: (d) =>
      d.eta9089_filing_date >= d.eta9089_window_opens &&
      d.eta9089_filing_date <= d.eta9089_window_closes,
    errorMessage: "ETA 9089 must be filed 30-180 days after recruitment ends"
  },
  {
    rule: "filing_before_pwd_expiration",
    check: (d) => d.eta9089_filing_date <= d.pwd_expiration_date,
    errorMessage: "ETA 9089 must be filed before PWD expiration"
  },
  {
    rule: "certification_after_filing",
    check: (d) =>
      !d.eta9089_certification_date ||
      d.eta9089_certification_date >= d.eta9089_filing_date,
    errorMessage: "Certification date cannot be before filing date"
  },
  {
    rule: "expiration_180_days_after_certification",
    check: (d) =>
      !d.eta9089_expiration_date ||
      daysBetween(d.eta9089_certification_date, d.eta9089_expiration_date) === 180,
    errorMessage: "ETA 9089 expires 180 days after certification"
  }
];
```

### ETA 9089 Examples

**Example 1: Standard Timeline**
```
Recruitment End: June 30, 2024
Window Opens: July 30, 2024 (recruitment_end + 30 days)
Window Closes: December 27, 2024 (recruitment_end + 180 days)
Filing Date: August 15, 2024 (within window ✓)
```

**Example 2: Edge Case - PWD Expires During Window**
```
PWD Determination: May 15, 2024
PWD Expiration: August 13, 2024 (determination + 90 days)
Recruitment End: July 1, 2024
Window Opens: July 31, 2024
Window Closes: December 28, 2024

Filing Date: August 10, 2024
Validation: Filing < PWD Expiration (Aug 10 < Aug 13) → VALID

Filing Date: August 15, 2024
Validation: Filing > PWD Expiration (Aug 15 > Aug 13) → INVALID
```

**Example 3: Recruitment During PWD Validity, Filing After Expiration**
```
PWD Determination: January 15, 2024
PWD Expiration: June 30, 2024
Recruitment Start: May 1, 2024
Recruitment End: June 15, 2024 (BEFORE PWD expiration)
Window Opens: July 15, 2024 (AFTER PWD expiration)
Window Closes: December 12, 2024

Filing Date: July 20, 2024
Validation: Filing > PWD Expiration BUT recruitment ended before expiration → VALID
```

**Example 4: Certification and Expiration**
```
Filing Date: August 15, 2024
Certification Date: October 1, 2024
Expiration Date: March 30, 2025 (certification + 180 days)
```

---

## I-140 Phase Deadlines

### Deadline Types

| Deadline | Type | Calculation | Regulatory Ref |
|----------|------|-------------|----------------|
| `i140_filing_deadline` | Calculated | eta9089_certification + 180 days | 8 CFR § 204.5(n)(3) |
| `i140_filing_date` | User-entered | Must be ≤ deadline | 8 CFR § 204.5(n)(3) |
| `i140_approval_date` | User-entered | N/A | N/A |

### I-140 Deadline Calculation

```typescript
interface I140Dates {
  eta9089_certification_date: Date;
  i140_filing_deadline: Date;
  i140_filing_date?: Date;
  i140_approval_date?: Date;
}

function calculateI140Deadline(certificationDate: Date): Date {
  return addDays(certificationDate, 180);
}
```

### I-140 Validation Rules

```typescript
const I140_VALIDATIONS: ValidationRule[] = [
  {
    rule: "filing_within_180_days",
    check: (d) =>
      !d.i140_filing_date ||
      d.i140_filing_date <= d.i140_filing_deadline,
    errorMessage: "I-140 must be filed within 180 days of ETA 9089 certification"
  },
  {
    rule: "filing_after_certification",
    check: (d) =>
      !d.i140_filing_date ||
      d.i140_filing_date >= d.eta9089_certification_date,
    errorMessage: "I-140 filing cannot be before ETA 9089 certification"
  },
  {
    rule: "approval_after_filing",
    check: (d) =>
      !d.i140_approval_date ||
      d.i140_approval_date >= d.i140_filing_date,
    errorMessage: "I-140 approval cannot be before filing date"
  }
];
```

### I-140 Examples

**Example 1: Standard Timeline**
```
ETA 9089 Certification: October 1, 2024
I-140 Filing Deadline: March 30, 2025 (certification + 180 days)
I-140 Filing: November 15, 2024 (within deadline ✓)
I-140 Approval: January 10, 2025
```

**Example 2: Late Filing (Invalid)**
```
ETA 9089 Certification: October 1, 2024
I-140 Filing Deadline: March 30, 2025
I-140 Filing: April 5, 2025 (AFTER deadline)
Validation: Filing > Deadline → INVALID
```

---

## RFI/RFE Deadlines

### Deadline Types

| Deadline | Type | Calculation | Source |
|----------|------|-------------|--------|
| `rfi_received_date` | User-entered | N/A | DOL/USCIS notice |
| `rfi_due_date` | User-entered | Specified in notice | DOL/USCIS notice |
| `rfi_submitted_date` | User-entered | Must be ≤ due date | User action |

### RFI/RFE Validation Rules

```typescript
interface RFIDates {
  rfi_received_date: Date;
  rfi_due_date: Date;
  rfi_submitted_date?: Date;
}

const RFI_VALIDATIONS: ValidationRule[] = [
  {
    rule: "due_date_after_received",
    check: (d) => d.rfi_due_date > d.rfi_received_date,
    errorMessage: "RFI due date must be after received date"
  },
  {
    rule: "submitted_before_due",
    check: (d) =>
      !d.rfi_submitted_date ||
      d.rfi_submitted_date <= d.rfi_due_date,
    errorMessage: "RFI must be submitted by due date"
  },
  {
    rule: "submitted_after_received",
    check: (d) =>
      !d.rfi_submitted_date ||
      d.rfi_submitted_date >= d.rfi_received_date,
    errorMessage: "RFI submitted date cannot be before received date"
  }
];
```

### RFI/RFE Examples

**Example 1: Standard RFI**
```
Received: September 15, 2024
Due Date: October 15, 2024 (30 days, typical)
Submitted: October 10, 2024 (within deadline ✓)
```

**Example 2: Late Submission (Invalid)**
```
Received: September 15, 2024
Due Date: October 15, 2024
Submitted: October 20, 2024 (AFTER due date)
Validation: Submitted > Due Date → INVALID
```

---

## Cross-Phase Dependencies

### Dependency Graph

```
PWD Determination
    ↓
PWD Expiration ←─────────────┐
    ↓                         │
Recruitment Period            │
    ↓                         │
Recruitment End               │
    ↓                         │
ETA 9089 Window Opens         │
    ↓                         │
ETA 9089 Filing ──────────────┘ (must be before PWD expiration)
    ↓
ETA 9089 Certification
    ↓
ETA 9089 Expiration (180 days)
    ↓
I-140 Filing Deadline (180 days from certification)
    ↓
I-140 Filing
    ↓
I-140 Approval
```

### Critical Cross-Phase Rules

```typescript
interface CaseDates extends PWDDates, RecruitmentDates, ETA9089Dates, I140Dates {}

const CROSS_PHASE_VALIDATIONS: ValidationRule[] = [
  {
    rule: "pwd_valid_at_filing",
    check: (d: CaseDates) =>
      d.eta9089_filing_date <= d.pwd_expiration_date,
    errorMessage: "PWD must be valid when ETA 9089 is filed"
  },
  {
    rule: "recruitment_during_pwd_validity_or_window_overlap",
    check: (d: CaseDates) => {
      // Recruitment can start during PWD validity
      // OR filing can occur after PWD expires if within recruitment window
      const recruitmentDuringPWD = d.recruitment_end_date <= d.pwd_expiration_date;
      const filingWithinWindow =
        d.eta9089_filing_date >= d.eta9089_window_opens &&
        d.eta9089_filing_date <= d.eta9089_window_closes;
      return recruitmentDuringPWD || filingWithinWindow;
    },
    errorMessage: "Recruitment and filing must align with PWD validity and window rules"
  },
  {
    rule: "i140_within_eta9089_validity",
    check: (d: CaseDates) =>
      !d.i140_filing_date ||
      d.i140_filing_date <= d.eta9089_expiration_date,
    errorMessage: "I-140 must be filed before ETA 9089 expires"
  }
];
```

---

## Supersession Rules

### Overview

**Purpose:** Determine which deadlines should be hidden when certain milestones are reached or case statuses change.

**Core Principle:** Actual filing dates supersede planned/calculated deadlines. Terminal statuses hide all deadlines.

### Supersession by Filing Dates

| Deadline Type | Superseded By | Reason |
|---------------|---------------|--------|
| `pwd_expiration` | `eta9089_filing_date` | PWD expiration no longer relevant after ETA 9089 filed |
| `recruitment_end` | `eta9089_filing_date` | Recruitment phase complete |
| `eta9089_filing_window` | `eta9089_filing_date` | Window no longer relevant after filing |
| `ready_to_file` | `eta9089_filing_date` | Ready-to-file deadline superseded by actual filing |
| `recruitment_expiration` | `eta9089_filing_date` | Recruitment expiration no longer relevant |
| `eta9089_expiration` | `i140_filing_date` | ETA 9089 expiration no longer relevant after I-140 filed |
| `i140_filing_deadline` | `i140_filing_date` | Deadline no longer relevant after filing |
| `rfi_response_due` | `rfi_response_submitted_date` | RFI deadline met |
| `rfe_response_due` | `rfe_response_submitted_date` | RFE deadline met |

### Supersession by Case Status

**Terminal Statuses** (hide all deadlines):
- `Complete`
- `Closed`
- `Withdrawn`
- `Denied`

**Rationale:** When a case reaches a terminal status, no further deadlines are relevant.

### Implementation Logic

```typescript
interface DeadlineSupersession {
  deadlineType: string;
  supersededBy: string;  // Field name that supersedes this deadline
  checkFn: (caseData: CaseData) => boolean;
}

const SUPERSESSION_RULES: DeadlineSupersession[] = [
  {
    deadlineType: "pwd_expiration",
    supersededBy: "eta9089_filing_date",
    checkFn: (d) => d.eta9089_filing_date !== null
  },
  {
    deadlineType: "recruitment_end",
    supersededBy: "eta9089_filing_date",
    checkFn: (d) => d.eta9089_filing_date !== null
  },
  {
    deadlineType: "eta9089_filing_window",
    supersededBy: "eta9089_filing_date",
    checkFn: (d) => d.eta9089_filing_date !== null
  },
  {
    deadlineType: "ready_to_file",
    supersededBy: "eta9089_filing_date",
    checkFn: (d) => d.eta9089_filing_date !== null
  },
  {
    deadlineType: "recruitment_expiration",
    supersededBy: "eta9089_filing_date",
    checkFn: (d) => d.eta9089_filing_date !== null
  },
  {
    deadlineType: "eta9089_expiration",
    supersededBy: "i140_filing_date",
    checkFn: (d) => d.i140_filing_date !== null
  },
  {
    deadlineType: "i140_filing_deadline",
    supersededBy: "i140_filing_date",
    checkFn: (d) => d.i140_filing_date !== null
  },
  {
    deadlineType: "rfi_response_due",
    supersededBy: "rfi_response_submitted_date",
    checkFn: (d) => d.rfi_response_submitted_date !== null
  },
  {
    deadlineType: "rfe_response_due",
    supersededBy: "rfe_response_submitted_date",
    checkFn: (d) => d.rfe_response_submitted_date !== null
  }
];

const TERMINAL_STATUSES = ["Complete", "Closed", "Withdrawn", "Denied"];

function shouldShowDeadline(
  deadlineType: string,
  caseData: CaseData
): boolean {
  // Hide all deadlines for terminal statuses
  if (TERMINAL_STATUSES.includes(caseData.status)) {
    return false;
  }

  // Check if this deadline is superseded
  const rule = SUPERSESSION_RULES.find(r => r.deadlineType === deadlineType);
  if (rule && rule.checkFn(caseData)) {
    return false;  // Deadline is superseded
  }

  return true;  // Show deadline
}
```

### Example: Supersession Timeline

```typescript
// Case progression showing deadline visibility

// State 1: Before ETA 9089 Filing
{
  status: "Recruitment",
  eta9089_filing_date: null,
  i140_filing_date: null,
  visible_deadlines: [
    "pwd_expiration",          // ✓ Visible
    "recruitment_end",         // ✓ Visible
    "eta9089_filing_window",   // ✓ Visible
    "ready_to_file"            // ✓ Visible
  ]
}

// State 2: After ETA 9089 Filing
{
  status: "ETA 9089 Pending",
  eta9089_filing_date: "2024-08-15",
  i140_filing_date: null,
  visible_deadlines: [
    "pwd_expiration",          // ✗ Hidden (superseded by eta9089_filing_date)
    "recruitment_end",         // ✗ Hidden (superseded by eta9089_filing_date)
    "eta9089_filing_window",   // ✗ Hidden (superseded by eta9089_filing_date)
    "ready_to_file",           // ✗ Hidden (superseded by eta9089_filing_date)
    "eta9089_expiration",      // ✓ Visible
    "i140_filing_deadline"     // ✓ Visible
  ]
}

// State 3: After I-140 Filing
{
  status: "I-140 Pending",
  eta9089_filing_date: "2024-08-15",
  i140_filing_date: "2024-10-01",
  visible_deadlines: [
    "eta9089_expiration",      // ✗ Hidden (superseded by i140_filing_date)
    "i140_filing_deadline"     // ✗ Hidden (superseded by i140_filing_date)
  ]
}

// State 4: Case Approved (Terminal Status)
{
  status: "Complete",
  eta9089_filing_date: "2024-08-15",
  i140_filing_date: "2024-10-01",
  visible_deadlines: []        // All hidden (terminal status)
}
```

### Frontend Integration

```typescript
// Fetch deadlines with supersession logic
function getActiveDeadlines(caseData: CaseData): Deadline[] {
  const allDeadlines = calculateAllDeadlines(caseData);

  return allDeadlines.filter(deadline =>
    shouldShowDeadline(deadline.type, caseData)
  );
}

// Example usage in UI
const activeDeadlines = getActiveDeadlines(currentCase);
// Render only active deadlines in timeline/dashboard
```

---

## Business Day Calculation

### Overview

**Purpose:** Calculate business days for Notice of Filing and RFI/RFE response deadlines.

**Definition:** Business day = NOT weekend AND NOT federal holiday

### Federal Holidays (2025-2027)

#### 2025 Federal Holidays

| Date | Holiday | Observation Rule |
|------|---------|-----------------|
| January 1, 2025 | New Year's Day | Wednesday |
| January 20, 2025 | Martin Luther King Jr. Day | Third Monday in January |
| February 17, 2025 | Presidents' Day | Third Monday in February |
| May 26, 2025 | Memorial Day | Last Monday in May |
| June 19, 2025 | Juneteenth | Thursday |
| July 4, 2025 | Independence Day | Friday |
| September 1, 2025 | Labor Day | First Monday in September |
| October 13, 2025 | Columbus Day | Second Monday in October |
| November 11, 2025 | Veterans Day | Tuesday |
| November 27, 2025 | Thanksgiving Day | Fourth Thursday in November |
| December 25, 2025 | Christmas Day | Thursday |

#### 2026 Federal Holidays

| Date | Holiday | Observation Rule |
|------|---------|-----------------|
| January 1, 2026 | New Year's Day | Thursday |
| January 19, 2026 | Martin Luther King Jr. Day | Third Monday in January |
| February 16, 2026 | Presidents' Day | Third Monday in February |
| May 25, 2026 | Memorial Day | Last Monday in May |
| June 19, 2026 | Juneteenth | Friday |
| July 3, 2026 | Independence Day (observed) | Friday (July 4 is Saturday) |
| September 7, 2026 | Labor Day | First Monday in September |
| October 12, 2026 | Columbus Day | Second Monday in October |
| November 11, 2026 | Veterans Day | Wednesday |
| November 26, 2026 | Thanksgiving Day | Fourth Thursday in November |
| December 25, 2026 | Christmas Day | Friday |

#### 2027 Federal Holidays

| Date | Holiday | Observation Rule |
|------|---------|-----------------|
| January 1, 2027 | New Year's Day | Friday |
| January 18, 2027 | Martin Luther King Jr. Day | Third Monday in January |
| February 15, 2027 | Presidents' Day | Third Monday in February |
| May 31, 2027 | Memorial Day | Last Monday in May |
| June 18, 2027 | Juneteenth (observed) | Friday (June 19 is Saturday) |
| July 5, 2027 | Independence Day (observed) | Monday (July 4 is Sunday) |
| September 6, 2027 | Labor Day | First Monday in September |
| October 11, 2027 | Columbus Day | Second Monday in October |
| November 11, 2027 | Veterans Day | Thursday |
| November 25, 2027 | Thanksgiving Day | Fourth Thursday in November |
| December 24, 2027 | Christmas Day (observed) | Friday (December 25 is Saturday) |

### Holiday Observation Rules

```typescript
interface HolidayObservationRule {
  rule: string;
  description: string;
}

const OBSERVATION_RULES: HolidayObservationRule[] = [
  {
    rule: "saturday_to_friday",
    description: "If holiday falls on Saturday, observed on preceding Friday"
  },
  {
    rule: "sunday_to_monday",
    description: "If holiday falls on Sunday, observed on following Monday"
  }
];

// Examples:
// July 4, 2026 (Saturday) → Observed July 3, 2026 (Friday)
// July 4, 2027 (Sunday) → Observed July 5, 2027 (Monday)
// June 19, 2027 (Saturday) → Observed June 18, 2027 (Friday)
// December 25, 2027 (Saturday) → Observed December 24, 2027 (Friday)
```

### Business Day Calculation Functions

```typescript
// Federal holidays list (2025-2027)
const FEDERAL_HOLIDAYS: Date[] = [
  // 2025
  new Date("2025-01-01"),  // New Year's Day
  new Date("2025-01-20"),  // MLK Day
  new Date("2025-02-17"),  // Presidents' Day
  new Date("2025-05-26"),  // Memorial Day
  new Date("2025-06-19"),  // Juneteenth
  new Date("2025-07-04"),  // Independence Day
  new Date("2025-09-01"),  // Labor Day
  new Date("2025-10-13"),  // Columbus Day
  new Date("2025-11-11"),  // Veterans Day
  new Date("2025-11-27"),  // Thanksgiving
  new Date("2025-12-25"),  // Christmas

  // 2026
  new Date("2026-01-01"),  // New Year's Day
  new Date("2026-01-19"),  // MLK Day
  new Date("2026-02-16"),  // Presidents' Day
  new Date("2026-05-25"),  // Memorial Day
  new Date("2026-06-19"),  // Juneteenth
  new Date("2026-07-03"),  // Independence Day (observed)
  new Date("2026-09-07"),  // Labor Day
  new Date("2026-10-12"),  // Columbus Day
  new Date("2026-11-11"),  // Veterans Day
  new Date("2026-11-26"),  // Thanksgiving
  new Date("2026-12-25"),  // Christmas

  // 2027
  new Date("2027-01-01"),  // New Year's Day
  new Date("2027-01-18"),  // MLK Day
  new Date("2027-02-15"),  // Presidents' Day
  new Date("2027-05-31"),  // Memorial Day
  new Date("2027-06-18"),  // Juneteenth (observed)
  new Date("2027-07-05"),  // Independence Day (observed)
  new Date("2027-09-06"),  // Labor Day
  new Date("2027-10-11"),  // Columbus Day
  new Date("2027-11-11"),  // Veterans Day
  new Date("2027-11-25"),  // Thanksgiving
  new Date("2027-12-24")   // Christmas (observed)
];

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;  // Sunday = 0, Saturday = 6
}

function isFederalHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];  // YYYY-MM-DD
  return FEDERAL_HOLIDAYS.some(
    holiday => holiday.toISOString().split('T')[0] === dateStr
  );
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isFederalHoliday(date);
}

function addBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = new Date(startDate);
  let addedDays = 0;

  while (addedDays < businessDays) {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    if (isBusinessDay(currentDate)) {
      addedDays++;
    }
  }

  return currentDate;
}

function countBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  let currentDate = new Date(startDate);

  // Inclusive counting
  while (currentDate <= endDate) {
    if (isBusinessDay(currentDate)) {
      count++;
    }
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return count;
}
```

### Notice of Filing Calculation

**Requirement:** 10 consecutive business days (20 CFR § 656.10(d))

```typescript
function calculateNoticeOfFilingEnd(startDate: Date): Date {
  // Add 10 business days from start date
  return addBusinessDays(startDate, 10);
}

// Example 1: No holidays, no weekends
{
  start: "2025-01-06" (Monday),
  end: "2025-01-17" (Friday, 10 business days later)
}

// Example 2: With weekend
{
  start: "2025-01-03" (Friday),
  // Skip Jan 4-5 (weekend)
  // Count: Jan 6, 7, 8, 9, 10, 13, 14, 15, 16, 17
  end: "2025-01-17" (Friday, 10 business days later)
}

// Example 3: With federal holiday
{
  start: "2025-01-10" (Friday),
  // Count: Jan 13, 14, 15, 16, 17
  // Skip Jan 20 (MLK Day)
  // Count: Jan 21, 22, 23, 24, 27
  end: "2025-01-27" (Monday, 10 business days later)
}
```

### RFI/RFE Response Calculation

**Typical Deadline:** 30 calendar days (NOT business days)

**Note:** DOL/USCIS specify calendar days for RFI/RFE responses, NOT business days.

```typescript
// RFI/RFE use calendar days, not business days
function calculateRFIDeadline(receivedDate: Date, calendarDays: number): Date {
  return new Date(receivedDate.getTime() + calendarDays * 24 * 60 * 60 * 1000);
}

// Example: 30 calendar days
{
  received: "2025-09-15",
  due: "2025-10-15" (30 calendar days later, includes weekends and holidays)
}
```

### Examples: Business Day Counting

**Example 1: Simple 10 Business Days**
```
Start: Monday, March 3, 2025
Day 1: Tuesday, March 4
Day 2: Wednesday, March 5
Day 3: Thursday, March 6
Day 4: Friday, March 7
Skip: Saturday-Sunday (March 8-9)
Day 5: Monday, March 10
Day 6: Tuesday, March 11
Day 7: Wednesday, March 12
Day 8: Thursday, March 13
Day 9: Friday, March 14
Skip: Saturday-Sunday (March 15-16)
Day 10: Monday, March 17
End: Monday, March 17, 2025
```

**Example 2: Including Federal Holiday**
```
Start: Friday, June 13, 2025
Skip: Saturday-Sunday (June 14-15)
Day 1: Monday, June 16
Day 2: Tuesday, June 17
Day 3: Wednesday, June 18
Skip: Thursday, June 19 (Juneteenth - FEDERAL HOLIDAY)
Day 4: Friday, June 20
Skip: Saturday-Sunday (June 21-22)
Day 5: Monday, June 23
Day 6: Tuesday, June 24
Day 7: Wednesday, June 25
Day 8: Thursday, June 26
Day 9: Friday, June 27
Skip: Saturday-Sunday (June 28-29)
Day 10: Monday, June 30
End: Monday, June 30, 2025
```

**Example 3: Crossing Multiple Holidays**
```
Start: Tuesday, December 23, 2025
Day 1: Wednesday, December 24
Skip: Thursday, December 25 (Christmas - FEDERAL HOLIDAY)
Day 2: Friday, December 26
Skip: Saturday-Sunday (December 27-28)
Day 3: Monday, December 29
Day 4: Tuesday, December 30
Day 5: Wednesday, December 31
Skip: Thursday, January 1, 2026 (New Year's - FEDERAL HOLIDAY)
Day 6: Friday, January 2, 2026
Skip: Saturday-Sunday (January 3-4)
Day 7: Monday, January 5, 2026
Day 8: Tuesday, January 6, 2026
Day 9: Wednesday, January 7, 2026
Day 10: Thursday, January 8, 2026
End: Thursday, January 8, 2026
```

---

## Urgency Levels

### Overview

**Purpose:** Categorize deadlines by proximity to trigger appropriate UI alerts and attorney actions.

**Categories:** Overdue, Critical, High, Normal

### Urgency Calculation Logic

```typescript
enum UrgencyLevel {
  OVERDUE = "overdue",
  CRITICAL = "critical",
  HIGH = "high",
  NORMAL = "normal"
}

interface UrgencyConfig {
  level: UrgencyLevel;
  condition: string;
  daysRemaining: number | null;
  color: string;
  icon: string;
  action: string;
}

const URGENCY_LEVELS: UrgencyConfig[] = [
  {
    level: UrgencyLevel.OVERDUE,
    condition: "deadline < today",
    daysRemaining: null,
    color: "red",
    icon: "⚠️",
    action: "URGENT: Immediate attention required"
  },
  {
    level: UrgencyLevel.CRITICAL,
    condition: "deadline <= today + 3 days",
    daysRemaining: 3,
    color: "orange",
    icon: "🔴",
    action: "CRITICAL: Action required within 3 days"
  },
  {
    level: UrgencyLevel.HIGH,
    condition: "deadline <= today + 7 days",
    daysRemaining: 7,
    color: "yellow",
    icon: "🟡",
    action: "HIGH: Action required within 1 week"
  },
  {
    level: UrgencyLevel.NORMAL,
    condition: "deadline > today + 7 days",
    daysRemaining: null,
    color: "green",
    icon: "🟢",
    action: "NORMAL: Plan ahead"
  }
];

function calculateUrgency(deadline: Date, today: Date = new Date()): UrgencyLevel {
  const daysRemaining = daysBetween(today, deadline);

  if (daysRemaining < 0) {
    return UrgencyLevel.OVERDUE;
  }

  if (daysRemaining <= 3) {
    return UrgencyLevel.CRITICAL;
  }

  if (daysRemaining <= 7) {
    return UrgencyLevel.HIGH;
  }

  return UrgencyLevel.NORMAL;
}
```

### Urgency Matrix

| Urgency Level | Days Remaining | Color | UI Treatment | Notification |
|--------------|----------------|-------|--------------|--------------|
| **Overdue** | < 0 | Red | Red badge, bold text, alert icon | Email + push notification |
| **Critical** | 0-3 days | Orange | Orange badge, bold text | Email + push notification |
| **High** | 4-7 days | Yellow | Yellow badge, normal text | Email notification |
| **Normal** | > 7 days | Green | Green badge or no badge | No automatic notification |

### Examples: Urgency Calculation

```typescript
// Today: December 20, 2025

// Example 1: Overdue deadline
{
  deadline: "2025-12-15",
  today: "2025-12-20",
  daysRemaining: -5,
  urgency: "OVERDUE",
  color: "red",
  action: "URGENT: Deadline missed 5 days ago"
}

// Example 2: Critical deadline (2 days)
{
  deadline: "2025-12-22",
  today: "2025-12-20",
  daysRemaining: 2,
  urgency: "CRITICAL",
  color: "orange",
  action: "CRITICAL: 2 days remaining"
}

// Example 3: High urgency (5 days)
{
  deadline: "2025-12-25",
  today: "2025-12-20",
  daysRemaining: 5,
  urgency: "HIGH",
  color: "yellow",
  action: "HIGH: 5 days remaining"
}

// Example 4: Normal (30 days)
{
  deadline: "2026-01-19",
  today: "2025-12-20",
  daysRemaining: 30,
  urgency: "NORMAL",
  color: "green",
  action: "NORMAL: 30 days remaining"
}
```

### Urgency-Based UI Components

> **⚠️ frontend-design skill (its a plug-in) REQUIREMENT**
>
> When implementing UI components for deadlines, urgency badges, and timeline visualizations, agents MUST read `.planning/FRONTEND_DESIGN_SKILL.md` (the frontend-design skill, its a plug-in) for design system requirements.

```typescript
// Badge component
interface DeadlineBadge {
  urgency: UrgencyLevel;
  text: string;
  className: string;
}

function getDeadlineBadge(urgency: UrgencyLevel, daysRemaining: number): DeadlineBadge {
  switch (urgency) {
    case UrgencyLevel.OVERDUE:
      return {
        urgency,
        text: `OVERDUE (${Math.abs(daysRemaining)} days)`,
        className: "bg-red-500 text-white font-bold animate-pulse"
      };
    case UrgencyLevel.CRITICAL:
      return {
        urgency,
        text: `${daysRemaining} days left`,
        className: "bg-orange-500 text-white font-bold"
      };
    case UrgencyLevel.HIGH:
      return {
        urgency,
        text: `${daysRemaining} days left`,
        className: "bg-yellow-500 text-black"
      };
    case UrgencyLevel.NORMAL:
      return {
        urgency,
        text: `${daysRemaining} days`,
        className: "bg-green-500 text-white"
      };
  }
}

// Dashboard filtering
function filterDeadlinesByUrgency(
  deadlines: Deadline[],
  minUrgency: UrgencyLevel
): Deadline[] {
  const urgencyOrder = [
    UrgencyLevel.OVERDUE,
    UrgencyLevel.CRITICAL,
    UrgencyLevel.HIGH,
    UrgencyLevel.NORMAL
  ];

  const minIndex = urgencyOrder.indexOf(minUrgency);

  return deadlines.filter(d => {
    const urgencyIndex = urgencyOrder.indexOf(d.urgency);
    return urgencyIndex <= minIndex;  // Show this urgency or higher
  });
}

// Example: Show only critical and overdue
const urgentDeadlines = filterDeadlinesByUrgency(
  allDeadlines,
  UrgencyLevel.CRITICAL
);
// Returns: All OVERDUE and CRITICAL deadlines
```

### Notification Triggers

```typescript
interface NotificationRule {
  urgency: UrgencyLevel;
  channels: string[];
  frequency: string;
}

const NOTIFICATION_RULES: NotificationRule[] = [
  {
    urgency: UrgencyLevel.OVERDUE,
    channels: ["email", "push", "in-app"],
    frequency: "daily"
  },
  {
    urgency: UrgencyLevel.CRITICAL,
    channels: ["email", "push", "in-app"],
    frequency: "once_at_threshold"
  },
  {
    urgency: UrgencyLevel.HIGH,
    channels: ["email", "in-app"],
    frequency: "once_at_threshold"
  },
  {
    urgency: UrgencyLevel.NORMAL,
    channels: ["in-app"],
    frequency: "none"
  }
];

// Example notification logic
function shouldSendNotification(
  deadline: Deadline,
  lastNotified: Date | null
): boolean {
  const rule = NOTIFICATION_RULES.find(r => r.urgency === deadline.urgency);

  if (!rule || rule.frequency === "none") {
    return false;
  }

  if (rule.frequency === "once_at_threshold") {
    return lastNotified === null;  // Only send once
  }

  if (rule.frequency === "daily") {
    if (!lastNotified) return true;
    const hoursSinceLastNotification =
      (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastNotification >= 24;
  }

  return false;
}
```

### Dashboard Sorting

```typescript
// Sort deadlines by urgency first, then by date
function sortDeadlinesByUrgency(deadlines: Deadline[]): Deadline[] {
  const urgencyOrder = {
    [UrgencyLevel.OVERDUE]: 0,
    [UrgencyLevel.CRITICAL]: 1,
    [UrgencyLevel.HIGH]: 2,
    [UrgencyLevel.NORMAL]: 3
  };

  return [...deadlines].sort((a, b) => {
    // First sort by urgency
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // Then sort by deadline date (earliest first)
    return a.deadline.getTime() - b.deadline.getTime();
  });
}

// Example output:
// 1. Overdue deadlines (oldest first)
// 2. Critical deadlines (earliest first)
// 3. High urgency deadlines (earliest first)
// 4. Normal deadlines (earliest first)
```

---

## Worked Examples

### Example 1: Typical Professional Occupation Timeline

**Scenario:** Software Engineer (Bachelor's required) - all deadlines met

```
Phase 1: PWD
- PWD Determination: January 15, 2024
- PWD Expiration: June 30, 2024 (same year rule)

Phase 2: Recruitment (March 1 - May 15, 2024)
- First Sunday Ad: March 3, 2024
- Second Sunday Ad: March 10, 2024
- Job Order: March 1 - March 31, 2024 (30 days)
- Notice of Filing: March 5 - March 18, 2024 (10 business days)
- Additional Steps (3 required):
  1. LinkedIn Job Posting: March 15 - April 15, 2024 (60 days before filing)
  2. University Career Fair: April 10, 2024 (55 days before filing)
  3. Professional Association Newsletter: May 1, 2024 (30+ days before filing)
- Recruitment End: May 1, 2024 (max of all end dates)

Phase 3: ETA 9089
- Window Opens: May 31, 2024 (recruitment_end + 30 days)
- Window Closes: October 28, 2024 (recruitment_end + 180 days)
- Filing Date: June 15, 2024 (within window ✓, before PWD expiration ✓)
- Certification Date: September 1, 2024
- Expiration Date: February 28, 2025 (certification + 180 days)

Phase 4: I-140
- Filing Deadline: February 28, 2025 (certification + 180 days)
- Filing Date: October 1, 2024 (within deadline ✓)
- Approval Date: January 15, 2025

Validation: ALL CHECKS PASS ✓
```

---

### Example 2: Edge Case - PWD Expires During Recruitment Window

**Scenario:** Recruitment completes before PWD expiration, filing occurs after PWD expiration

```
Phase 1: PWD
- PWD Determination: May 1, 2024
- PWD Expiration: July 30, 2024 (determination + 90 days)

Phase 2: Recruitment
- Recruitment Start: June 1, 2024
- Recruitment End: July 15, 2024 (BEFORE PWD expiration ✓)

Phase 3: ETA 9089
- Window Opens: August 14, 2024 (AFTER PWD expiration)
- Window Closes: January 11, 2025
- Filing Date: August 20, 2024 (AFTER PWD expiration)

Question: Is this valid?

Answer: YES ✓
Reason: Recruitment completed (July 15) BEFORE PWD expired (July 30).
The fact that the filing window opens AFTER PWD expiration is acceptable
because recruitment was completed while PWD was valid.

Validation Logic:
if (recruitment_end_date <= pwd_expiration_date) {
  // Recruitment completed during PWD validity
  // Filing can occur within window even if after PWD expiration
  return VALID;
}
```

---

### Example 3: Invalid Professional Recruitment (Too Many Steps Within 30 Days)

**Scenario:** 3 additional steps but 2 end within 30 days of filing

```
Phase 2: Recruitment
- Mandatory steps completed: May 1, 2024
- Additional Steps:
  1. Job Fair: April 15, 2024 (60 days before filing ✓)
  2. Campus Recruitment: May 15, 2024 (20 days before filing ✗)
  3. Website Posting: May 20, 2024 (15 days before filing ✗)

Phase 3: ETA 9089
- Filing Date: June 5, 2024

Validation:
Steps within 30 days of filing: Campus Recruitment (20 days), Website Posting (15 days)
Count: 2
Rule: Maximum 1 step can end within 30 days

Result: INVALID ✗
Error: "Only 1 additional recruitment step can end within 30 days of ETA 9089 filing"
```

---

### Example 4: Spring PWD Determination (90-Day Rule)

**Scenario:** PWD determination during April 2 - June 30 triggers 90-day expiration

```
Phase 1: PWD
- PWD Determination: May 15, 2024
- PWD Expiration: August 13, 2024 (determination + 90 days)

Phase 2: Recruitment
- Recruitment End: July 1, 2024

Phase 3: ETA 9089
- Window Opens: July 31, 2024
- Window Closes: December 28, 2024
- Filing Date: August 10, 2024

Question: Is August 10, 2024 valid?

Answer: YES ✓
Reason: Filing date (Aug 10) is BEFORE PWD expiration (Aug 13)

Question: Would August 15, 2024 be valid?

Answer: NO ✗
Reason: Filing date (Aug 15) is AFTER PWD expiration (Aug 13)
Error: "ETA 9089 must be filed before PWD expiration"
```

---

### Example 5: I-140 Deadline Miss

**Scenario:** I-140 filed after 180-day deadline

```
Phase 3: ETA 9089
- Certification Date: October 1, 2024
- Expiration Date: March 30, 2025 (certification + 180 days)

Phase 4: I-140
- Filing Deadline: March 30, 2025 (certification + 180 days)
- Filing Date: April 5, 2025 (5 days late)

Validation:
Filing Date (Apr 5) > Deadline (Mar 30)

Result: INVALID ✗
Error: "I-140 must be filed within 180 days of ETA 9089 certification"

Consequence: ETA 9089 certification may be invalidated; may need to restart PERM process
```

---

### Example 6: RFI Response Deadline

**Scenario:** DOL issues RFI during ETA 9089 audit

```
Phase 3: ETA 9089
- Filing Date: August 15, 2024
- Audit Notice Received: September 10, 2024
- RFI Received: September 15, 2024
- RFI Due Date: October 15, 2024 (30 days from receipt)
- RFI Submitted: October 10, 2024 (5 days before deadline)

Validation: Submitted (Oct 10) < Due Date (Oct 15) → VALID ✓

Alternative Scenario (Late Submission):
- RFI Submitted: October 20, 2024 (5 days after deadline)

Validation: Submitted (Oct 20) > Due Date (Oct 15) → INVALID ✗
Consequence: Case may be denied for failure to respond timely
```

---

## Validation Rules

### Validation Architecture

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  rule: string;
  message: string;
  field: string;
  severity: "error" | "warning";
}

function validateCase(caseData: CaseDates): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Run all validation rules
  const allValidations = [
    ...PWD_VALIDATIONS,
    ...RECRUITMENT_VALIDATIONS,
    ...ETA9089_VALIDATIONS,
    ...I140_VALIDATIONS,
    ...RFI_VALIDATIONS,
    ...CROSS_PHASE_VALIDATIONS
  ];

  for (const validation of allValidations) {
    if (!validation.check(caseData)) {
      errors.push({
        rule: validation.rule,
        message: validation.errorMessage,
        field: validation.field,
        severity: validation.severity || "error"
      });
    }
  }

  return {
    valid: errors.filter(e => e.severity === "error").length === 0,
    errors,
    warnings: errors.filter(e => e.severity === "warning")
  };
}
```

### Validation Levels

| Level | Description | User Experience |
|-------|-------------|-----------------|
| **Error** | Hard constraint violation, prevents submission | Red alert, blocks save |
| **Warning** | Soft constraint, unusual but allowed | Yellow warning, allows save with confirmation |
| **Info** | Informational, no action needed | Blue notice |

### Example Validation Messages

```typescript
const VALIDATION_MESSAGES = {
  // Errors
  pwd_filing_before_determination: {
    severity: "error",
    message: "PWD filing date ({filed}) must be before or on determination date ({determined})",
    remedy: "Update PWD filing date to be on or before determination date"
  },

  eta9089_after_pwd_expiration: {
    severity: "error",
    message: "ETA 9089 filing date ({filed}) is after PWD expiration ({expires})",
    remedy: "File ETA 9089 before PWD expiration or obtain new PWD"
  },

  // Warnings
  recruitment_very_short: {
    severity: "warning",
    message: "Recruitment period is only {days} days, which is unusually short",
    remedy: "Consider extending recruitment to reduce audit risk"
  },

  eta9089_filing_near_deadline: {
    severity: "warning",
    message: "ETA 9089 filing date ({filed}) is within 7 days of window closing ({closes})",
    remedy: "File earlier to avoid missing deadline"
  }
};
```

---

## Edge Cases & Special Scenarios

### Edge Case 1: PWD Expiration on Weekend/Holiday

**Question:** If PWD expires on Saturday, June 30, can you file on Monday, July 2?

**Answer:** NO ✗

**Reason:** Deadlines are calendar dates, not business days. If June 30 falls on a weekend, you must file by June 30 or earlier.

**Best Practice:** Plan to file several days before expiration to account for weekends and system issues.

---

### Edge Case 2: Sunday Ad on Holiday Weekend

**Question:** Can the second Sunday ad be on Memorial Day weekend?

**Answer:** YES ✓

**Reason:** The regulation requires Sunday newspaper ads. If a Sunday falls on a holiday weekend, it's still a valid Sunday.

**Consideration:** Readership may be lower on holiday weekends; consider recruiting effectiveness.

---

### Edge Case 3: Job Order Ending Exactly 30 Days

**Question:** If job order starts May 1, can it end May 31 (exactly 30 days)?

**Answer:** YES ✓

**Calculation:**
```
Start: May 1, 2024
End: May 31, 2024
Days: 30 (May 1 is day 0, May 31 is day 30)
```

**Best Practice:** Use 31+ days to avoid any interpretation issues.

---

### Edge Case 4: Recruitment Start Before PWD Determination

**Question:** Can you start recruitment before receiving PWD determination?

**Answer:** YES, but risky ✗

**Reason:** If the PWD determination results in a higher wage than advertised, the recruitment is invalid and must be repeated.

**Best Practice:** Wait for PWD determination before starting recruitment.

---

### Edge Case 5: I-140 Filed on 180th Day

**Question:** If ETA 9089 certified October 1, can I-140 be filed March 30 (day 180)?

**Answer:** YES ✓

**Calculation:**
```
Certification: October 1, 2024
Deadline: March 30, 2025 (day 180)
Filing: March 30, 2025
Validation: Filing date ≤ Deadline → VALID
```

**Best Practice:** File several days before the deadline to account for submission issues.

---

### Edge Case 6: Additional Recruitment Step Ending Exactly 30 Days Before Filing

**Question:** If ETA 9089 filed June 30, can an additional step end May 31 (exactly 30 days)?

**Answer:** YES, but counts toward the 1-step limit ✗

**Calculation:**
```
Step End: May 31, 2024
Filing: June 30, 2024
Days: 30
Rule: Steps ending ≤ 30 days count toward limit
```

**Best Practice:** End additional steps 31+ days before filing to avoid limit.

---

### Edge Case 7: Leap Year PWD Expiration

**Question:** If PWD determination is January 15, 2024 (leap year), is expiration still June 30?

**Answer:** YES ✓

**Reason:** June 30 rule applies regardless of leap year.

```
Determination: January 15, 2024 (leap year)
Expiration: June 30, 2024 (same year rule)
```

---

### Edge Case 8: RFI Received After ETA 9089 Window Closes

**Question:** If RFI due date extends beyond the 180-day window, is the case still valid?

**Answer:** YES ✓

**Reason:** RFI response deadlines are set by DOL and take precedence over the 180-day window. The case remains in "audit" status.

**Example:**
```
Recruitment End: June 30, 2024
ETA 9089 Filing: August 15, 2024 (day 46)
Window Closes: December 27, 2024 (day 180)
RFI Received: December 1, 2024
RFI Due Date: December 31, 2024 (AFTER window closes)

Validation: RFI due date supersedes window close → VALID
```

---

### Edge Case 9: Multiple Audit Cycles

**Question:** If DOL issues RFI, then second RFI, does the 180-day window extend?

**Answer:** NO, but case remains active ✗

**Reason:** The 180-day window is for initial filing. Audit cycles extend case processing time but don't change the original window.

**Timeline:**
```
Filing: August 15, 2024 (day 46 of 180-day window)
First RFI: September 15, 2024 → Response: October 15, 2024
Second RFI: November 1, 2024 → Response: December 1, 2024
Window Closes: December 27, 2024
Final Decision: January 15, 2025 (AFTER window closed)

Validation: Case valid because it was filed within window; audit extends processing
```

---

### Edge Case 10: PWD Determination on April 1 vs. April 2

**Critical Distinction:**

```
Determination: April 1, 2024
Expiration: June 30, 2024 (same year rule, NOT +90 days)

Determination: April 2, 2024
Expiration: July 1, 2024 (April 2 + 90 days)
```

**Why it matters:**
- April 1: 90 days from expiration (June 30 - April 1 = 90 days)
- April 2: 90 days from determination (April 2 + 90 = July 1)

**Best Practice:** Always calculate using the exact regulation formula, not assumptions.

---

## Implementation Notes for v2.0

### Database Schema Considerations

```typescript
// Computed fields should be calculated on-the-fly, not stored
interface CaseDeadlines {
  // Stored fields
  pwd_determination_date: Date;
  recruitment_end_date: Date;
  eta9089_filing_date: Date;
  eta9089_certification_date: Date;

  // Computed fields (calculated via functions)
  pwd_expiration_date: Date;           // = calculatePWDExpiration(pwd_determination_date)
  eta9089_window_opens: Date;          // = recruitment_end_date + 30 days
  eta9089_window_closes: Date;         // = recruitment_end_date + 180 days
  eta9089_expiration_date: Date;       // = eta9089_certification_date + 180 days
  i140_filing_deadline: Date;          // = eta9089_certification_date + 180 days
}
```

### API Response Format

```typescript
interface DeadlineValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  computed_deadlines: {
    pwd_expiration_date: string;      // ISO 8601
    eta9089_window_opens: string;
    eta9089_window_closes: string;
    eta9089_expiration_date: string;
    i140_filing_deadline: string;
  };
  days_remaining: {
    until_pwd_expiration: number;
    until_eta9089_window_closes: number;
    until_i140_deadline: number;
  };
}
```

### Frontend Display Patterns

```typescript
// Deadline urgency indicators
function getDeadlineUrgency(daysRemaining: number): "critical" | "warning" | "normal" {
  if (daysRemaining <= 7) return "critical";   // Red
  if (daysRemaining <= 30) return "warning";   // Yellow
  return "normal";                             // Green
}

// Timeline visualization
interface TimelineEvent {
  date: Date;
  label: string;
  type: "deadline" | "milestone" | "filing";
  urgency: "critical" | "warning" | "normal";
}
```

---

## References

### Regulatory Citations

| Citation | Description | URL |
|----------|-------------|-----|
| 20 CFR § 656.40(c) | PWD validity period | [Link](https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40) |
| 20 CFR § 656.17(e) | Recruitment and filing requirements | [Link](https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-C/section-656.17) |
| 20 CFR § 656.10(d) | Notice of filing requirements | [Link](https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-B/section-656.10) |
| 20 CFR § 656.30(b) | ETA 9089 validity period | [Link](https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.30) |
| 8 CFR § 204.5(n)(3) | I-140 filing deadline | [Link](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/subpart-A/section-204.5) |

### Related Documents

- [V2_BUSINESS_RULES.md](.planning/V2_BUSINESS_RULES.md) - Complete business logic reference
- [docs/research.md](../docs/research.md) - Original PERM research and regulations
- [docs/plan.md](../docs/plan.md) - Implementation plan with validation details

---

## Feature Cross-Reference

### Overview

**Purpose:** Map deadline calculation logic to v1.0 features and v2.0 implementation locations.

### v1.0 Feature Inventory

Reference: `.planning/phases/12-feature-inventory/F229-FEATURE-INVENTORY.md`

| Feature ID | Feature Name | Deadline Logic | Status |
|------------|--------------|----------------|--------|
| F001 | PWD Expiration Calculation | Section 2 (PWD Phase Deadlines) | Active |
| F002 | ETA 9089 Filing Window | Section 4 (ETA 9089 Phase Deadlines) | Active |
| F003 | I-140 Filing Deadline | Section 5 (I-140 Phase Deadlines) | Active |
| F004 | Notice of Filing (10 business days) | Section 9 (Business Day Calculation) | Active |
| F005 | Recruitment End Date | Section 3 (Recruitment Phase Deadlines) | Active |
| F006 | Job Order Duration (30 days) | Section 3 (Recruitment Phase Deadlines) | Active |
| F007 | Sunday Ad Validation | Section 3 (Recruitment Phase Deadlines) | Active |
| F008 | Professional Occupation Rules | Section 3 (Recruitment Phase Deadlines) | Active |
| F009 | RFI/RFE Response Deadlines | Section 6 (RFI/RFE Deadlines) | Active |
| F010 | Deadline Urgency Indicators | Section 10 (Urgency Levels) | Active |
| F011 | Supersession Logic | Section 8 (Supersession Rules) | Active |

### v2.0 Implementation Mapping

| Section | Implementation File | Function/Class | Priority |
|---------|-------------------|----------------|----------|
| PWD Phase Deadlines | `backend/app/services/deadline_service.py` | `calculate_pwd_expiration()` | P0 |
| Recruitment Phase Deadlines | `backend/app/services/deadline_service.py` | `calculate_recruitment_end()` | P0 |
| ETA 9089 Phase Deadlines | `backend/app/services/deadline_service.py` | `calculate_eta9089_window()` | P0 |
| I-140 Phase Deadlines | `backend/app/services/deadline_service.py` | `calculate_i140_deadline()` | P0 |
| RFI/RFE Deadlines | `backend/app/services/deadline_service.py` | `validate_rfi_dates()` | P0 |
| Cross-Phase Dependencies | `backend/app/services/validation_service.py` | `validate_cross_phase()` | P0 |
| Supersession Rules | `backend/app/services/deadline_service.py` | `should_show_deadline()` | P1 |
| Business Day Calculation | `backend/app/utils/business_days.py` | `add_business_days()`, `is_business_day()` | P0 |
| Urgency Levels | `backend/app/services/deadline_service.py` | `calculate_urgency()` | P1 |
| Validation Rules | `backend/app/services/validation_service.py` | `validate_case()` | P0 |

### Database Schema Alignment

| Deadline Type | Database Field | Table | Computed/Stored |
|---------------|---------------|-------|-----------------|
| PWD Determination | `pwd_determination_date` | `cases` | Stored |
| PWD Expiration | `pwd_expiration_date` | `cases` | Computed (via function) |
| Recruitment End | `recruitment_end_date` | `cases` | Computed (via function) |
| ETA 9089 Window Opens | N/A | N/A | Computed on-the-fly |
| ETA 9089 Window Closes | N/A | N/A | Computed on-the-fly |
| ETA 9089 Filing | `eta9089_filing_date` | `cases` | Stored |
| ETA 9089 Certification | `eta9089_certification_date` | `cases` | Stored |
| ETA 9089 Expiration | N/A | N/A | Computed on-the-fly |
| I-140 Filing Deadline | N/A | N/A | Computed on-the-fly |
| I-140 Filing | `i140_filing_date` | `cases` | Stored |
| I-140 Approval | `i140_approval_date` | `cases` | Stored |
| RFI Received | `rfi_received_date` | `cases` | Stored |
| RFI Due | `rfi_due_date` | `cases` | Stored |
| RFI Submitted | `rfi_submitted_date` | `cases` | Stored |

### API Endpoint Mapping

| Endpoint | HTTP Method | Section Reference | Response Includes |
|----------|-------------|-------------------|-------------------|
| `/api/cases/{id}/deadlines` | GET | All sections | All computed deadlines + urgency |
| `/api/cases/{id}/validate` | POST | Sections 9, 12 | Validation errors/warnings |
| `/api/cases/{id}` | PUT | Sections 2-6 | Updated case with computed deadlines |
| `/api/deadlines/urgency` | GET | Section 10 | Deadlines filtered by urgency level |
| `/api/deadlines/active` | GET | Section 8 | Deadlines after supersession logic |

### Frontend Component Mapping

| Component | Location | Section Reference | Functionality |
|-----------|----------|-------------------|---------------|
| `DeadlineTimeline.js` | `frontend/src/components/` | Sections 8, 10 | Timeline view with urgency colors |
| `DeadlineBadge.js` | `frontend/src/components/` | Section 10 | Urgency badge display |
| `CaseValidation.js` | `frontend/src/components/` | Section 12 | Validation error display |
| `BusinessDayCalculator.js` | `frontend/src/utils/` | Section 9 | Notice of Filing date picker |
| `PWDExpirationForm.js` | `frontend/src/components/` | Section 2 | PWD date input with auto-calculation |

### Testing Coverage

| Test Suite | Location | Section Coverage |
|------------|----------|------------------|
| `test_pwd_calculations.py` | `backend/tests/services/` | Section 2 (PWD Phase) |
| `test_recruitment_deadlines.py` | `backend/tests/services/` | Section 3 (Recruitment) |
| `test_eta9089_windows.py` | `backend/tests/services/` | Section 4 (ETA 9089) |
| `test_i140_deadlines.py` | `backend/tests/services/` | Section 5 (I-140) |
| `test_rfi_validation.py` | `backend/tests/services/` | Section 6 (RFI/RFE) |
| `test_cross_phase_validation.py` | `backend/tests/services/` | Section 7 (Cross-Phase) |
| `test_supersession.py` | `backend/tests/services/` | Section 8 (Supersession) |
| `test_business_days.py` | `backend/tests/utils/` | Section 9 (Business Days) |
| `test_urgency_levels.py` | `backend/tests/services/` | Section 10 (Urgency) |
| `test_edge_cases.py` | `backend/tests/services/` | Section 13 (Edge Cases) |

### Related Documentation

| Document | Purpose | Cross-Reference |
|----------|---------|-----------------|
| [V2_BUSINESS_RULES.md](.planning/V2_BUSINESS_RULES.md) | Complete business logic reference | All sections |
| [F229-FEATURE-INVENTORY.md](.planning/phases/12-feature-inventory/F229-FEATURE-INVENTORY.md) | v1.0 feature catalog | Feature mapping |
| [13-RESEARCH.md](.planning/phases/13-core-logic-extraction/13-RESEARCH.md) | Core logic analysis | Implementation patterns |
| [docs/research.md](../docs/research.md) | PERM regulations research | Regulatory citations |
| [docs/plan.md](../docs/plan.md) | Original implementation plan | Validation details |
| [CLAUDE.md](../CLAUDE.md) | Project instructions | Date validation rules |

### Migration Path (v1.0 → v2.0)

| v1.0 Location | v2.0 Location | Section | Migration Status |
|---------------|---------------|---------|------------------|
| `backend/app/services/deadline_logic.py` | `backend/app/services/deadline_service.py` | Sections 2-6 | Planned |
| `backend/app/utils/date_helpers.py` | `backend/app/utils/business_days.py` | Section 9 | Planned |
| `frontend/src/utils/deadlines.js` | `frontend/src/services/DeadlineService.js` | All sections | Planned |
| Database triggers | Python service layer | Sections 2-6 | Planned (remove triggers) |
| Frontend date calculations | Backend API responses | All sections | Planned (centralize) |

### Development Phases

**Phase 13.1: Core Deadline Calculations**
- Sections 2-6 (PWD, Recruitment, ETA 9089, I-140, RFI/RFE)
- Priority: P0

**Phase 13.2: Validation & Dependencies**
- Sections 7, 12 (Cross-Phase, Validation Rules)
- Priority: P0

**Phase 13.3: Business Logic Enhancement**
- Sections 8-10 (Supersession, Business Days, Urgency)
- Priority: P1

**Phase 13.4: Edge Cases & Testing**
- Sections 11, 13 (Worked Examples, Edge Cases)
- Priority: P1

---

**Last Updated:** 2025-12-20
**Document Version:** 1.1
**Target Architecture:** v2.0
