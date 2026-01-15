# v2.0 Business Rules Reference

> **Purpose:** Complete PERM business logic for migration to v2.0 tech stack
>
> **Created:** 2025-12-20
>
> **Source:** Extracted from backend/app/utils/, backend/app/services/, docs/research.md
>
> **Important:** This document contains the complete PERM business logic. The v2.0 migration should reference ONLY this document - never the FastAPI codebase.

---

## Table of Contents

1. [PERM Process Overview](#1-perm-process-overview)
2. [Case Stage Progression](#2-case-stage-progression)
3. [Auto-Calculated Fields](#3-auto-calculated-fields)
4. [The Either/Or Rule](#4-the-eitheror-rule-20-cfr--65640c)
5. [Case Field Reference](#5-case-field-reference)
6. [Date Validation Rules](#6-date-validation-rules)
7. [Professional Occupation Rules](#7-professional-occupation-rules)
8. [Feature Cross-Reference](#8-feature-cross-reference)
9. [Terminal States](#9-terminal-states)
10. [Deadline Relevance Logic](#10-deadline-relevance-logic)

---

## 1. PERM Process Overview

### 1.1 Four-Step Process

The PERM (Program Electronic Review Management) process consists of four sequential steps that employers must complete to obtain permanent labor certification for a foreign worker.

#### Step 1: Job Identification
**Requirements:**
- Position must be permanent and full-time
- Must determine actual minimum requirements and duties
- Cannot tailor requirements to specific candidate

**Position Categories:**
1. Non-professional/Professional Occupations (20 CFR 656.17) - Most common
2. College/University Teachers (20 CFR 656.18) - Special recruitment procedures
3. Professional Athletes (20 CFR 656.10) - Rare category

#### Step 2: Prevailing Wage Determination (PWD)
**Processing Time:** 6-7 months (as of 2025)

**Validity Period (20 CFR § 656.40(c)):**
- **Minimum:** 90 days from determination date
- **Maximum:** 1 year from determination date

**Critical Requirement:**
Must file ETA 9089 **OR** begin recruitment **BEFORE** PWD expires (Either/Or Rule - see Section 4).

#### Step 3: Pre-Filing Recruitment
**Timing:** All recruitment must occur **30-180 days** before filing ETA 9089

**Mandatory Steps (All Positions):**
1. **Job Order with State Workforce Agency (SWA)**
   - Duration: 30 consecutive days minimum
   - Must be posted before other recruitment

2. **Two Sunday Newspaper Advertisements**
   - Must run on **two different Sundays**
   - In newspaper of general circulation in area of intended employment

3. **Notice of Filing (Internal Posting)**
   - Duration: 10 consecutive business days
   - Posted at location of intended employment

**Professional Positions - Additional Requirements:**
Must complete **3 of 10** additional recruitment steps:
1. Job website (Monster, Indeed, etc.)
2. Employer's website
3. On-campus recruiting
4. Trade or professional organization
5. Private employment firm
6. Employee referral program with incentives
7. Campus placement office
8. Local and ethnic newspapers
9. Radio and television advertisements
10. Other recruitment methods (pre-approved by DOL)

**Filing Window:**
- **Minimum Wait:** 30 days after recruitment ends
- **Maximum Wait:** 180 days after recruitment ends

#### Step 4: ETA 9089 Filing
**Processing Time:** 15-16 months (non-audited, as of 2025)

**Audit Rate:** 25-30% of applications (adds 6-12+ months)

**Certification Validity:** 180 days from certification date

**I-140 Requirement:** Must file I-140 within 180 days of ETA 9089 certification

### 1.2 Timeline Overview

**Total Process:** 22-30 months (non-audited cases)

```
PWD Phase (6-7 months)
    ↓
Recruitment Phase (2-3 months)
    ↓
30-day quiet period
    ↓
ETA 9089 Processing (15-16 months)
    ↓
I-140 Filing (within 180 days of certification)
    ↓
I-140 Processing (4-11 months depending on service center)
```

---

## 2. Case Stage Progression

> **Reference:** See `V2_ORIGINAL_VISION.md` for complete requirements

### 2.1 Two-Tier Status System (5+6)

v2.0 uses a **two-tier status system** replacing the previous 14-value enum:

#### Case Status (5 values, colored tag)

```typescript
type CaseStatus = "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
```

| Status | Color | Window | Trigger Into | Trigger Out |
|--------|-------|--------|--------------|-------------|
| `pwd` | Blue (#0066FF) | Filing → Determination | Case created | PWD determination set |
| `recruitment` | Purple (#9333ea) | Determination → PWD expiration | PWD determination set | ETA 9089 filing date set |
| `eta9089` | Orange (#D97706) | 30 days after recruitment → 180 days/pwded | ETA 9089 filing set | I-140 filing date set |
| `i140` | Green (#059669) | Certification → Expiration | I-140 filing set | I-140 approval set (→ Complete tile) |
| `closed` | Gray (#6B7280) | N/A (terminal) | Manual OR auto-close edge case | Never |

#### Progress Status (6 values, separate tag, no color)

```typescript
type ProgressStatus = "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
```

| Status | Trigger | Override |
|--------|---------|----------|
| `working` | Default for new cases | Manual |
| `waiting_intake` | Manual only | Manual |
| `filed` | Filing date set for current stage | Manual override allowed |
| `approved` | Approval/cert date set for current stage | Manual override allowed |
| `under_review` | Manual only | Manual |
| `rfi_rfe` | Active RFI or RFE exists | Auto only (no manual) |

#### Dashboard Tiles

| Tile | Shows Cases Where |
|------|-------------------|
| PWD | `case_status = 'pwd'` |
| Recruitment | `case_status = 'recruitment'` |
| ETA 9089 | `case_status = 'eta9089'` |
| I-140 | `case_status = 'i140'` AND `progress_status != 'approved'` |
| **Complete** | `case_status = 'i140'` AND `progress_status = 'approved'` |
| **Closed/Archived** | `case_status = 'closed'` |

**Note:** "Complete" is NOT a status - it's a dashboard tile showing I-140 cases with approved progress.

### 2.2 Stage Transition Rules (v2.0)

**Case Status** is auto-determined from dates. **Progress Status** is auto-set with manual override.

```typescript
function determineCaseStatus(caseData: CaseData): CaseStatus {
  // Terminal status - manual only
  if (caseData.case_status === "closed") return "closed";

  // I-140 phase (filing date set)
  if (caseData.i140_filing_date) return "i140";

  // ETA 9089 phase (filing date set)
  if (caseData.eta9089_filing_date) return "eta9089";

  // Recruitment phase (PWD determined)
  if (caseData.pwd_determination_date) return "recruitment";

  // PWD phase (default)
  return "pwd";
}

function determineProgressStatus(caseData: CaseData, currentCaseStatus: CaseStatus): ProgressStatus {
  // RFI/RFE overrides all (auto only)
  if (hasActiveRfi(caseData) || hasActiveRfe(caseData)) return "rfi_rfe";

  // Check for approved status
  if (currentCaseStatus === "i140" && caseData.i140_approval_date) return "approved";
  if (currentCaseStatus === "eta9089" && caseData.eta9089_certification_date) return "approved";
  if (currentCaseStatus === "pwd" && caseData.pwd_determination_date) return "approved";

  // Check for filed status
  if (currentCaseStatus === "i140" && caseData.i140_filing_date) return "filed";
  if (currentCaseStatus === "eta9089" && caseData.eta9089_filing_date) return "filed";
  if (currentCaseStatus === "pwd" && caseData.pwd_filing_date) return "filed";

  // Manual override preserved if set
  if (caseData.progress_status_override) return caseData.progress_status;

  // Default
  return "working";
}
```

### 2.3 Auto-Close Edge Cases

Cases are **automatically closed** with notification + popup:

```typescript
function checkAutoClose(caseData: CaseData): { shouldClose: boolean; reason: string } | null {
  const today = new Date();

  // Edge Case 1: PWD expires before ETA 9089 filed
  if (caseData.pwd_expiration_date && !caseData.eta9089_filing_date) {
    if (today > caseData.pwd_expiration_date) {
      return { shouldClose: true, reason: "PWD expired before ETA 9089 filing" };
    }
  }

  // Edge Case 2: Miss 180-day recruitment deadline with <60 days to PWD expiration
  const firstRecruitment = getFirstRecruitmentDate(caseData);
  if (firstRecruitment && caseData.pwd_expiration_date) {
    const recruitmentDeadline = addDays(firstRecruitment, 180);
    const daysToExpiration = daysBetween(today, caseData.pwd_expiration_date);

    if (today > recruitmentDeadline && daysToExpiration < 60) {
      return { shouldClose: true, reason: "Missed recruitment deadline with insufficient time remaining" };
    }
  }

  // Edge Case 3: ETA 9089 expiration missed
  if (caseData.eta9089_expiration_date && !caseData.i140_filing_date) {
    if (today > caseData.eta9089_expiration_date) {
      return { shouldClose: true, reason: "ETA 9089 certification expired before I-140 filing" };
    }
  }

  return null;
}
```

### 2.4 Legacy Mapping (14 → 5+6)

For migration from v1:
  if (caseData.pwd_determination_date) {
    return "PWD Approved";
  }

  // 2. PWD filed, no determination → PWD
  if (caseData.pwd_filing_date) {
    return "PWD";
  }

  // 1. Default: New case with no dates
  return "PWD";
}

function calculateRecruitmentEnd(
  sunday_ad_second: Date | null,
  job_order_end: Date | null
): Date | null {
  if (!sunday_ad_second && !job_order_end) return null;
  if (!sunday_ad_second) return job_order_end;
  if (!job_order_end) return sunday_ad_second;
  return max(sunday_ad_second, job_order_end);
}
```

### 2.3 Stage-Specific Behavior

**PWD Stage:**
- Only `pwd_filing_date` is set
- User is waiting for PWD determination from DOL

**PWD Approved Stage:**
- `pwd_determination_date` is set
- `pwd_expiration_date` is auto-calculated (see Section 3.1)
- No recruitment dates entered yet
- Must begin recruitment or file ETA 9089 before PWD expires

**Recruitment Stage:**
- At least one recruitment date is set:
  - `sunday_ad_first_date` OR
  - `job_order_end_date`
- User is actively recruiting
- Must complete recruitment and wait 30 days before filing ETA 9089

**ETA 9089 Prep Stage:**
- Recruitment is complete (`sunday_ad_second_date` OR `job_order_end_date` set)
- 30-day waiting period has passed
- Case is ready to file ETA 9089
- Must file within 180 days of recruitment start

**ETA 9089 Filed Stage:**
- `eta9089_filing_date` is set
- Case is pending DOL review
- Processing time: 15-16 months (non-audited)

**ETA 9089 Audit Stage:**
- Not currently auto-set
- Can be manually set if case is selected for audit
- Adds 6-12+ months to processing time

**ETA 9089 Certified Stage:**
- `eta9089_certification_date` is set
- `eta9089_expiration_date` is auto-calculated (certification + 180 days)
- User has 180 days to file I-140

**I-140 Prep Stage:**
- ETA 9089 is certified
- I-140 not yet filed
- Must file within 180 days of certification

**I-140 Filed Stage:**
- `i140_filing_date` is set
- Case is pending USCIS review
- Processing time: 4-11 months (varies by service center)

**I-140 Approved / Complete Stage:**
- `i140_approval_date` is set
- Case is successfully completed
- Terminal state (no further deadlines)

---

## 3. Auto-Calculated Fields

The system automatically calculates certain date fields based on regulatory requirements. These calculations MUST be performed server-side and MUST NOT be overridden by user input (except in edge cases with warnings).

### 3.1 PWD Expiration Date

**Field:** `pwd_expiration_date`

**Trigger:** When `pwd_determination_date` is set or updated

**Regulation:** 20 CFR § 656.40(c)

**Algorithm:**

```typescript
function calculatePwdExpiration(determinationDate: Date): Date {
  const month = determinationDate.getMonth() + 1; // 1-12
  const day = determinationDate.getDate();
  const year = determinationDate.getFullYear();

  // Check if determination is between April 2 and June 30 (inclusive)
  const isApril2ToJune30 =
    (month === 4 && day >= 2) ||
    (month === 5) ||
    (month === 6 && day <= 30);

  if (isApril2ToJune30) {
    // Expiration = determination + 90 days
    return addDays(determinationDate, 90);
  }

  // Check if determination is after June 30
  const isAfterJune30 =
    (month > 6) ||
    (month === 6 && day === 31);

  if (isAfterJune30) {
    // Expiration = June 30 of following year
    return new Date(year + 1, 5, 30); // month is 0-indexed
  }

  // Otherwise (January 1 - April 1)
  // Expiration = June 30 of same year
  return new Date(year, 5, 30);
}
```

**Examples:**
- PWD determined on May 15, 2025 → Expires August 13, 2025 (90 days)
- PWD determined on March 1, 2025 → Expires June 30, 2025 (same year)
- PWD determined on July 15, 2025 → Expires June 30, 2026 (following year)

### 3.2 Recruitment End Date

**Field:** Not stored directly, calculated on-the-fly

**Purpose:** Used to determine ETA 9089 filing window

**Algorithm:**

```typescript
function calculateRecruitmentEndDate(
  sunday_ad_second_date: Date | null,
  job_order_end_date: Date | null
): Date | null {
  // Recruitment ends on the LATER of:
  // - Second Sunday ad date
  // - Job order end date

  if (!sunday_ad_second_date && !job_order_end_date) {
    return null;
  }

  if (!sunday_ad_second_date) {
    return job_order_end_date;
  }

  if (!job_order_end_date) {
    return sunday_ad_second_date;
  }

  return max(sunday_ad_second_date, job_order_end_date);
}
```

### 3.3 ETA 9089 Expiration Date

**Field:** `eta9089_expiration_date`

**Trigger:** When `eta9089_certification_date` is set or updated

**Regulation:** 8 CFR § 204.5(n)(3)

**Algorithm:**

```typescript
function calculateEta9089Expiration(certificationDate: Date): Date {
  // ETA 9089 certification is valid for exactly 180 days
  return addDays(certificationDate, 180);
}
```

**Example:**
- ETA 9089 certified on January 15, 2025 → Expires July 14, 2025

### 3.4 I-140 Filing Deadline

**Field:** Not stored directly, calculated on-the-fly

**Purpose:** Must file I-140 within 180 days of ETA 9089 certification

**Algorithm:**

```typescript
function calculateI140FilingDeadline(eta9089_certification_date: Date): Date {
  // Same as ETA 9089 expiration - I-140 must be filed before ETA expires
  return addDays(eta9089_certification_date, 180);
}
```

### 3.5 Beneficiary Identifier (Auto-Generation)

**Field:** `beneficiary_identifier`

**Trigger:** When case is created and field is not provided

**Purpose:** Attorney-client privilege anonymization

**Algorithm:**

```typescript
function generateBeneficiaryIdentifier(): string {
  // Generate random 8-character hex string
  const randomHex = generateRandomHex(8); // e.g., "A3F5B2C7"
  return `BEN-${randomHex.toUpperCase()}`;
}
```

**Example:** `BEN-A3F5B2C7`

**User Override:** User can provide their own identifier (e.g., "ABC-Initials", "Case-2025-001")

---

## 4. The Either/Or Rule (20 CFR § 656.40(c))

### 4.1 Explanation

The PWD expiration date creates a critical deadline, but employers have **two paths** to maintain validity:

**Path A: File Before Expiration**
- Complete entire recruitment process
- File ETA 9089 **before** PWD expires
- Straightforward but tight timeline

**Path B: Start Recruitment Before Expiration**
- Begin recruitment **during** PWD validity period
- Can file ETA 9089 **after** PWD expires
- More flexible but requires documentation

### 4.2 Implementation

**Validation Logic:**

```typescript
function validateEta9089FilingVsPwdExpiration(
  eta9089_filing_date: Date,
  pwd_expiration_date: Date,
  sunday_ad_first_date: Date | null,
  job_order_start_date: Date | null
): ValidationResult {
  // If filing before expiration (Path A), always valid
  if (eta9089_filing_date <= pwd_expiration_date) {
    return { valid: true };
  }

  // Filing after expiration - check if recruitment started during validity (Path B)
  const recruitmentStartDates = [
    sunday_ad_first_date,
    job_order_start_date
  ].filter(d => d !== null);

  if (recruitmentStartDates.length === 0) {
    return {
      valid: false,
      error: "ETA 9089 must be filed before PWD expiration OR recruitment must start during PWD validity"
    };
  }

  const recruitmentStart = min(recruitmentStartDates);

  if (recruitmentStart <= pwd_expiration_date) {
    // Path B: Recruitment started during PWD validity
    return {
      valid: true,
      warning: "ETA 9089 filed after PWD expiration. Ensure recruitment started during PWD validity period is documented."
    };
  }

  return {
    valid: false,
    error: "ETA 9089 must be filed before PWD expiration OR recruitment must start during PWD validity"
  };
}
```

**UI Messaging:**

When filing ETA 9089 after PWD expiration:
- ✅ **Valid (Path B):** "ETA 9089 filed after PWD expiration. This is permitted because recruitment started on [date], which was during the PWD validity period."
- ❌ **Invalid:** "ETA 9089 cannot be filed after PWD expiration unless recruitment started during PWD validity. Recruitment started on [date], after PWD expired on [date]."

---

## 5. Case Field Reference

### 5.1 All 50+ Fields

The PERM case has 50+ fields organized into logical groups:

#### Basic Information (4 fields)
```typescript
interface BasicInfo {
  employer_name: string;              // Required, 1-255 chars
  position_title: string;             // Required, 1-255 chars
  beneficiary_identifier: string;     // Auto-generated or user-provided, max 100 chars
  case_number: string | null;         // Optional internal tracking number, max 100 chars
}
```

#### PWD Dates (3 fields)
```typescript
interface PwdDates {
  pwd_filing_date: Date | null;           // When PWD was filed with DOL
  pwd_determination_date: Date | null;    // When DOL determined the prevailing wage
  pwd_expiration_date: Date | null;       // Auto-calculated from determination date
}
```

**Constraints:**
- `pwd_filing_date` < `pwd_determination_date` < `pwd_expiration_date`
- `pwd_expiration_date` is auto-calculated (cannot be manually set)

#### Recruitment Dates (8 fields)
```typescript
interface RecruitmentDates {
  // Sunday Newspaper Ads (mandatory)
  sunday_ad_first_date: Date | null;      // Must be a Sunday
  sunday_ad_second_date: Date | null;     // Must be a Sunday, after first ad

  // Job Order (mandatory)
  job_order_start_date: Date | null;      // Job order start
  job_order_end_date: Date | null;        // Job order end (must be 30+ days from start)

  // Notice of Filing (mandatory)
  notice_of_filing_start_date: Date | null;    // Internal posting start
  notice_of_filing_end_date: Date | null;      // Internal posting end (10 business days)

  // Additional Methods (for professional positions)
  additional_recruitment_methods: string | null;  // JSON array of method names
}
```

**Constraints:**
- Both Sunday ads must fall on Sundays (weekday === 0)
- `sunday_ad_second_date` > `sunday_ad_first_date`
- `job_order_end_date` >= `job_order_start_date` + 30 days
- `notice_of_filing_end_date` >= `notice_of_filing_start_date` + 10 business days

#### Recruitment Summary Fields (5 fields)
```typescript
interface RecruitmentSummary {
  sunday_ad_newspaper: string | null;           // Newspaper name, max 255 chars
  job_order_state: string | null;               // State abbreviation (e.g., "CA", "NY"), max 2 chars
  recruitment_applicants_count: number;         // Total applicants, default 0
  recruitment_summary_custom: string | null;    // Custom summary text (overrides auto-generated)
  is_professional_occupation: boolean;          // Whether position requires Bachelor's degree, default false
}
```

**Professional Occupation:**
- If `true`, requires 3 additional recruitment methods beyond mandatory steps
- Determines whether to show additional recruitment fields in UI

#### ETA 9089 Dates (4 fields)
```typescript
interface Eta9089Dates {
  eta9089_filing_date: Date | null;         // When ETA 9089 was filed with DOL
  eta9089_certification_date: Date | null;  // When DOL certified the application
  eta9089_expiration_date: Date | null;     // Auto-calculated (cert + 180 days)
  eta9089_case_number: string | null;       // DOL case number, max 100 chars
}
```

**Constraints:**
- `eta9089_filing_date` must be 30-180 days after recruitment end
- `eta9089_filing_date` must satisfy Either/Or rule (see Section 4)
- `eta9089_certification_date` > `eta9089_filing_date`
- `eta9089_expiration_date` is auto-calculated (cannot be manually set)

#### RFI (Request for Information - DOL/ETA 9089 Stage) (4 fields)
```typescript
interface RfiDates {
  rfi_received_date: Date | null;           // When RFI was received from DOL
  rfi_response_due_date: Date | null;       // When response is due
  rfi_response_submitted_date: Date | null; // When response was submitted
  rfi_list: RfiEntry[] | null;              // JSONB array of RFI entries (new system)
}

interface RfiEntry {
  title: string;                  // RFI title
  description: string | null;     // RFI description
  received_date: Date;            // When received
  response_due_date: Date | null; // When due
  response_submitted_date: Date | null; // When submitted
  notes: string | null;           // Additional notes
}
```

**Constraints:**
- `rfi_response_due_date` > `rfi_received_date`
- `rfi_response_submitted_date` >= `rfi_received_date`
- Warning if `rfi_response_submitted_date` > `rfi_response_due_date` (late submission)

**Migration Note:**
- Legacy single RFI fields (`rfi_received_date`, `rfi_response_due_date`, `rfi_response_submitted_date`) exist for backward compatibility
- New system uses `rfi_list` (JSONB array) stored in separate `case_rfi` table
- Both systems currently supported

#### I-140 Dates (3 fields)
```typescript
interface I140Dates {
  i140_filing_date: Date | null;      // When I-140 was filed with USCIS
  i140_approval_date: Date | null;    // When I-140 was approved
  i140_receipt_number: string | null; // USCIS receipt number, max 100 chars
}
```

**Constraints:**
- `i140_filing_date` must be within 180 days of `eta9089_certification_date`
- `i140_filing_date` > `eta9089_certification_date`
- `i140_approval_date` > `i140_filing_date`

#### RFE (Request for Evidence - USCIS/I-140 Stage) (4 fields)
```typescript
interface RfeDates {
  rfe_received_date: Date | null;           // When RFE was received from USCIS
  rfe_response_due_date: Date | null;       // When response is due
  rfe_response_submitted_date: Date | null; // When response was submitted
  rfe_list: RfeEntry[] | null;              // JSONB array of RFE entries (new system)
}

interface RfeEntry {
  title: string;                  // RFE title
  description: string | null;     // RFE description
  received_date: Date;            // When received
  response_due_date: Date | null; // When due
  response_submitted_date: Date | null; // When submitted
  notes: string | null;           // Additional notes
}
```

**Constraints:**
- Same as RFI constraints (see above)

**Migration Note:**
- Legacy single RFE fields exist for backward compatibility
- New system uses `rfe_list` (JSONB array) stored in separate `case_rfe` table
- Both systems currently supported

#### Status Fields (2 fields)
```typescript
interface StatusFields {
  case_status: CaseStatus;           // See Section 2.1 for enum values
  progress_status: string | null;    // Optional custom status (e.g., "Working on it", "Under review")
}
```

**Auto-Determination:**
- `case_status` is auto-determined based on dates (see Section 2.2)
- Manual override allowed for "Withdrawn", "Denied", "Closed"
- `progress_status` is entirely user-controlled (no auto-determination)

#### Metadata Fields (4 fields)
```typescript
interface MetadataFields {
  notes: string | null;                 // Free-form case notes
  calendar_sync_enabled: boolean;       // Whether to sync deadlines to Google Calendar, default true
  is_favorite: boolean;                 // Whether case is favorited/starred, default false

  // System fields (not user-editable)
  id: UUID;                            // Auto-generated
  user_id: UUID;                       // Owner user ID
  created_at: DateTime;                // Auto-generated
  updated_at: DateTime;                // Auto-updated
  deleted_at: DateTime | null;         // Soft delete timestamp
}
```

### 5.2 Field Groups by Stage

**PWD Stage Fields:**
- `pwd_filing_date`
- `pwd_determination_date`
- `pwd_expiration_date` (auto-calculated)

**Recruitment Stage Fields:**
- `sunday_ad_first_date`
- `sunday_ad_second_date`
- `sunday_ad_newspaper`
- `job_order_start_date`
- `job_order_end_date`
- `job_order_state`
- `notice_of_filing_start_date`
- `notice_of_filing_end_date`
- `recruitment_applicants_count`
- `is_professional_occupation`
- `additional_recruitment_methods` (if professional)
- `recruitment_summary_custom`

**ETA 9089 Stage Fields:**
- `eta9089_filing_date`
- `eta9089_certification_date`
- `eta9089_expiration_date` (auto-calculated)
- `eta9089_case_number`
- `rfi_received_date`
- `rfi_response_due_date`
- `rfi_response_submitted_date`
- `rfi_list`

**I-140 Stage Fields:**
- `i140_filing_date`
- `i140_approval_date`
- `i140_receipt_number`
- `rfe_received_date`
- `rfe_response_due_date`
- `rfe_response_submitted_date`
- `rfe_list`

---

## 6. Date Validation Rules

All date validations are **blocking** (user cannot save) unless marked as **warning** (user can save with acknowledgment).

### 6.1 PWD Validation

```typescript
function validatePwdDates(
  pwd_filing_date: Date | null,
  pwd_determination_date: Date | null,
  pwd_expiration_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: Filing < Determination
  if (pwd_filing_date && pwd_determination_date) {
    if (pwd_filing_date >= pwd_determination_date) {
      errors.push({
        field: "pwd_determination_date",
        message: "PWD determination date must be after filing date",
        severity: "error"
      });
    }
  }

  // Rule 2: Determination < Expiration
  if (pwd_determination_date && pwd_expiration_date) {
    if (pwd_determination_date >= pwd_expiration_date) {
      errors.push({
        field: "pwd_expiration_date",
        message: "PWD expiration date must be after determination date",
        severity: "error"
      });
    }
  }

  // Rule 3: Expiration matches calculation
  if (pwd_determination_date && pwd_expiration_date) {
    const expectedExpiration = calculatePwdExpiration(pwd_determination_date);
    if (pwd_expiration_date !== expectedExpiration) {
      errors.push({
        field: "pwd_expiration_date",
        message: `PWD expiration should be ${expectedExpiration} based on determination date`,
        severity: "warning"  // Allow override but warn
      });
    }
  }

  // Rule 4: Check if PWD has expired (warning only - allows historical cases)
  if (pwd_expiration_date && pwd_expiration_date < today) {
    errors.push({
      field: "pwd_expiration_date",
      message: "PWD has expired. A new PWD must be filed if case is active.",
      severity: "warning"
    });
  }

  return errors;
}
```

### 6.2 Sunday Ad Validation

```typescript
function validateSundayAdDates(
  sunday_ad_first_date: Date | null,
  sunday_ad_second_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: First ad must be on Sunday
  if (sunday_ad_first_date && !isSunday(sunday_ad_first_date)) {
    errors.push({
      field: "sunday_ad_first_date",
      message: "First Sunday ad must be on a Sunday",
      severity: "error"
    });
  }

  // Rule 2: Second ad must be on Sunday
  if (sunday_ad_second_date && !isSunday(sunday_ad_second_date)) {
    errors.push({
      field: "sunday_ad_second_date",
      message: "Second Sunday ad must be on a Sunday",
      severity: "error"
    });
  }

  // Rule 3: Second ad must be after first ad
  if (sunday_ad_first_date && sunday_ad_second_date) {
    if (sunday_ad_second_date <= sunday_ad_first_date) {
      errors.push({
        field: "sunday_ad_second_date",
        message: "Second Sunday ad must be after first Sunday ad",
        severity: "error"
      });
    }
  }

  return errors;
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0;  // Sunday = 0 in JavaScript
}
```

### 6.3 Job Order Validation

```typescript
function validateJobOrderDates(
  job_order_start_date: Date | null,
  job_order_end_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (job_order_start_date && job_order_end_date) {
    // Rule 1: End date must be after start date
    if (job_order_end_date <= job_order_start_date) {
      errors.push({
        field: "job_order_end_date",
        message: "Job order end date must be after start date",
        severity: "error"
      });
    }
    // Rule 2: Job order must be active for at least 30 days
    else {
      const duration = daysBetween(job_order_start_date, job_order_end_date);
      if (duration < 30) {
        errors.push({
          field: "job_order_end_date",
          message: `Job order must be active for at least 30 days (currently ${duration} days)`,
          severity: "error"
        });
      }
    }
  }

  return errors;
}
```

### 6.4 ETA 9089 Validation

```typescript
function validateEta9089Dates(
  eta9089_filing_date: Date | null,
  eta9089_certification_date: Date | null,
  eta9089_expiration_date: Date | null,
  recruitment_end_date: Date | null,
  pwd_expiration_date: Date | null,
  sunday_ad_first_date: Date | null,
  job_order_start_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: Filing must be 30-180 days after recruitment ends
  if (eta9089_filing_date && recruitment_end_date) {
    const windowOpens = addDays(recruitment_end_date, 30);
    const windowCloses = addDays(recruitment_end_date, 180);

    if (eta9089_filing_date < windowOpens) {
      errors.push({
        field: "eta9089_filing_date",
        message: `ETA 9089 must be filed at least 30 days after recruitment ends (earliest: ${windowOpens})`,
        severity: "error"
      });
    }

    if (eta9089_filing_date > windowCloses) {
      errors.push({
        field: "eta9089_filing_date",
        message: `ETA 9089 must be filed within 180 days of recruitment ending (deadline: ${windowCloses})`,
        severity: "error"
      });
    }
  }

  // Rule 2: Filing before PWD expiration (Either/Or rule)
  if (eta9089_filing_date && pwd_expiration_date) {
    if (eta9089_filing_date > pwd_expiration_date) {
      // Check if recruitment started during PWD validity (Path B)
      const recruitmentStartDates = [
        sunday_ad_first_date,
        job_order_start_date
      ].filter(d => d !== null);

      const recruitmentStart = recruitmentStartDates.length > 0
        ? min(recruitmentStartDates)
        : null;

      // If recruitment started during PWD validity, allow filing after expiration
      if (!recruitmentStart || recruitmentStart > pwd_expiration_date) {
        errors.push({
          field: "eta9089_filing_date",
          message: "ETA 9089 must be filed before PWD expiration OR recruitment must start during PWD validity",
          severity: "error"
        });
      }
    }
  }

  // Rule 3: Certification must be after filing
  if (eta9089_filing_date && eta9089_certification_date) {
    if (eta9089_certification_date <= eta9089_filing_date) {
      errors.push({
        field: "eta9089_certification_date",
        message: "ETA 9089 certification must be after filing date",
        severity: "error"
      });
    }
  }

  // Rule 4: Expiration matches calculation (cert + 180 days)
  if (eta9089_certification_date && eta9089_expiration_date) {
    const expectedExpiration = addDays(eta9089_certification_date, 180);
    if (eta9089_expiration_date !== expectedExpiration) {
      errors.push({
        field: "eta9089_expiration_date",
        message: `ETA 9089 expiration should be ${expectedExpiration} (180 days after certification)`,
        severity: "warning"
      });
    }
  }

  return errors;
}
```

### 6.5 I-140 Validation

```typescript
function validateI140Dates(
  i140_filing_date: Date | null,
  i140_approval_date: Date | null,
  eta9089_certification_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: I-140 must be filed within 180 days of ETA 9089 certification
  if (i140_filing_date && eta9089_certification_date) {
    const deadline = addDays(eta9089_certification_date, 180);

    if (i140_filing_date > deadline) {
      errors.push({
        field: "i140_filing_date",
        message: `I-140 must be filed within 180 days of ETA 9089 certification (deadline: ${deadline})`,
        severity: "error"
      });
    }

    // Rule 2: I-140 filing must be after ETA 9089 certification
    if (i140_filing_date <= eta9089_certification_date) {
      errors.push({
        field: "i140_filing_date",
        message: "I-140 filing date must be after ETA 9089 certification",
        severity: "error"
      });
    }
  }

  // Rule 3: Approval must be after filing
  if (i140_filing_date && i140_approval_date) {
    if (i140_approval_date <= i140_filing_date) {
      errors.push({
        field: "i140_approval_date",
        message: "I-140 approval must be after filing date",
        severity: "error"
      });
    }
  }

  return errors;
}
```

### 6.6 RFI/RFE Validation

```typescript
function validateRfiRfeDates(
  received_date: Date | null,
  response_due_date: Date | null,
  response_submitted_date: Date | null,
  fieldPrefix: "rfi" | "rfe"
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: Due date must be after received date
  if (received_date && response_due_date) {
    if (response_due_date <= received_date) {
      errors.push({
        field: `${fieldPrefix}_response_due_date`,
        message: `${fieldPrefix.toUpperCase()} due date must be after received date`,
        severity: "error"
      });
    }
  }

  // Rule 2: Submitted date must be after received date
  if (response_submitted_date && received_date) {
    if (response_submitted_date < received_date) {
      errors.push({
        field: `${fieldPrefix}_response_submitted_date`,
        message: `${fieldPrefix.toUpperCase()} submission date must be after received date`,
        severity: "error"
      });
    }
  }

  // Rule 3: Warning if submitted late
  if (response_submitted_date && response_due_date) {
    if (response_submitted_date > response_due_date) {
      errors.push({
        field: `${fieldPrefix}_response_submitted_date`,
        message: `${fieldPrefix.toUpperCase()} was submitted after the due date (late submission)`,
        severity: "warning"
      });
    }
  }

  return errors;
}
```

---

## 9. Terminal States

Terminal states are case statuses that represent the end of the PERM process. Cases in terminal states:
- Do not auto-transition to other statuses
- Do not generate deadline notifications
- Are not included in "active cases" counts
- Can still be viewed/edited but are considered "archived"

### 9.1 Complete

**Trigger:** `i140_approval_date` is set

**Meaning:** I-140 has been approved. The PERM process is successfully completed.

**Business Rules:**
- Case status auto-set to "Complete" when I-140 approval date is entered
- Synonym for "I-140 Approved" status
- No further deadlines or actions required
- Case can be archived or marked as favorite for reference

### 9.2 Closed

**Trigger:** Manual only (user action)

**Meaning:** Case was closed for reasons other than completion, withdrawal, or denial.

**Use Cases:**
- Case was transferred to another attorney
- Employer decided not to proceed
- Beneficiary left the company
- Position was eliminated

**Business Rules:**
- Cannot be auto-set (manual only)
- Does not generate notifications
- Can be reopened by changing status back to active status

### 9.3 Withdrawn

**Trigger:** Manual only (user action)

**Meaning:** Case was voluntarily withdrawn by employer or attorney.

**Use Cases:**
- Employer withdrew petition
- Beneficiary withdrew application
- Case withdrawn due to error or changed circumstances

**Business Rules:**
- Cannot be auto-set (manual only)
- Overrides auto-determination (once set, status will not auto-change)
- Does not generate notifications
- Can be reopened by changing status back to active status

### 9.4 Denied

**Trigger:** Manual only (user action)

**Meaning:** Case was denied by DOL or USCIS.

**Use Cases:**
- PWD request denied
- ETA 9089 application denied
- I-140 petition denied

**Business Rules:**
- Cannot be auto-set (manual only)
- Overrides auto-determination (once set, status will not auto-change)
- Does not generate notifications
- Can be reopened by changing status back to active status (if re-filing)

### 9.5 Terminal State Detection

```typescript
const TERMINAL_STATUSES: CaseStatus[] = [
  "Complete",
  "Closed",
  "Withdrawn",
  "Denied"
];

function isTerminalStatus(status: CaseStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function shouldGenerateDeadlines(caseData: CaseData): boolean {
  return !isTerminalStatus(caseData.case_status);
}
```

---

## 10. Deadline Relevance Logic

Not all deadlines are relevant at all times. The system uses "deadline relevance" logic to hide deadlines that have been superseded by later events.

### 10.1 PWD Deadline Relevance

**Rule:** PWD expiration deadline is NO LONGER RELEVANT if ETA 9089 has been filed.

**Rationale:** Once ETA 9089 is filed, the PWD expiration date no longer matters (Either/Or rule satisfied).

```typescript
function shouldShowPwdDeadline(caseData: CaseData): boolean {
  // Don't show if ETA 9089 already filed (superseded)
  if (caseData.eta9089_filing_date) {
    return false;
  }

  // Don't show for terminal statuses
  if (isTerminalStatus(caseData.case_status)) {
    return false;
  }

  // Show if PWD has an expiration date
  return caseData.pwd_expiration_date !== null;
}
```

### 10.2 Recruitment Deadline Relevance

**Rule:** Recruitment deadlines are NO LONGER RELEVANT if ETA 9089 has been filed.

**Rationale:** Once ETA 9089 is filed, recruitment deadlines are satisfied.

```typescript
function shouldShowRecruitmentDeadline(caseData: CaseData): boolean {
  // Don't show if ETA 9089 already filed (superseded)
  if (caseData.eta9089_filing_date) {
    return false;
  }

  // Don't show for terminal statuses
  if (isTerminalStatus(caseData.case_status)) {
    return false;
  }

  // Show if recruitment dates exist
  return (
    caseData.sunday_ad_first_date !== null ||
    caseData.job_order_start_date !== null
  );
}
```

### 10.3 ETA 9089 Deadline Relevance

**Rule:** ETA 9089 expiration deadline is NO LONGER RELEVANT if I-140 has been filed.

**Rationale:** Once I-140 is filed, the ETA 9089 expiration date no longer matters.

```typescript
function shouldShowEta9089Deadline(caseData: CaseData): boolean {
  // Don't show if I-140 already filed (superseded)
  if (caseData.i140_filing_date) {
    return false;
  }

  // Don't show for terminal statuses
  if (isTerminalStatus(caseData.case_status)) {
    return false;
  }

  // Show if ETA 9089 has an expiration date
  return caseData.eta9089_expiration_date !== null;
}
```

### 10.4 RFI Deadline Relevance

**Rule:** RFI deadlines are NO LONGER RELEVANT if response has been submitted.

**Rationale:** Once response is submitted, the deadline is satisfied.

```typescript
function shouldShowRfiDeadline(rfi: RfiEntry): boolean {
  // Don't show if response already submitted
  if (rfi.response_submitted_date) {
    return false;
  }

  // Show if there's a due date
  return rfi.response_due_date !== null;
}
```

### 10.5 RFE Deadline Relevance

**Rule:** RFE deadlines are NO LONGER RELEVANT if response has been submitted.

**Rationale:** Once response is submitted, the deadline is satisfied.

```typescript
function shouldShowRfeDeadline(rfe: RfeEntry): boolean {
  // Don't show if response already submitted
  if (rfe.response_submitted_date) {
    return false;
  }

  // Show if there's a due date
  return rfe.response_due_date !== null;
}
```

### 10.6 Deadline Cleanup

When a case is updated, the system should clean up notifications and calendar events for deadlines that are no longer relevant.

```typescript
function cleanupIrrelevantDeadlines(caseData: CaseData): void {
  const deadlinesToRemove: string[] = [];

  // PWD deadline superseded by ETA 9089 filing
  if (caseData.eta9089_filing_date && !shouldShowPwdDeadline(caseData)) {
    deadlinesToRemove.push("pwd_expiration");
  }

  // Recruitment deadlines superseded by ETA 9089 filing
  if (caseData.eta9089_filing_date && !shouldShowRecruitmentDeadline(caseData)) {
    deadlinesToRemove.push("recruitment_expiration");
    deadlinesToRemove.push("eta9089_filing_window_opens");
  }

  // ETA 9089 deadline superseded by I-140 filing
  if (caseData.i140_filing_date && !shouldShowEta9089Deadline(caseData)) {
    deadlinesToRemove.push("eta9089_expiration");
  }

  // Remove notifications and calendar events
  for (const deadlineType of deadlinesToRemove) {
    deleteNotificationsByType(caseData.id, deadlineType);
    deleteCalendarEventsByType(caseData.id, deadlineType);
  }
}
```

---

## Appendix A: Regulatory References

- **20 CFR § 656.40(c)** - PWD validity period and Either/Or rule
- **20 CFR § 656.17** - Recruitment requirements for non-professional/professional positions
- **20 CFR § 656.17(e)** - Recruitment timing (30-180 days before filing)
- **20 CFR § 656.17(e)(1)** - 30-day post-recruitment waiting period
- **20 CFR § 656.17(e)(1)(i)** - Job order 30-day minimum requirement
- **20 CFR § 656.10(d)(3)** - Notice of Filing 10 consecutive business days
- **8 CFR § 204.5(n)(3)** - ETA 9089 certification 180-day validity
- **8 CFR § 204.5(e)** - Priority date retention
- **INA § 204(j)** - Job portability protection

---

## Appendix B: Processing Times (as of 2025)

**PWD:** 6-7 months

**ETA 9089:**
- Non-audited: 15-16 months (472-499 days)
- Audited: 21-28 months
- Audit rate: 25-30%

**I-140:**
- Texas Service Center: 7-11 months
- Nebraska Service Center: 4-8 months
- California Service Center: Varies
- Vermont Service Center: Varies
- Premium Processing: 15 calendar days (initial review)

**Total Timeline:** 22-30 months (non-audited cases)

---

## Appendix C: Migration Notes

### From v1.0 FastAPI to v2.0 Stack

**Field Name Changes:**
- `first_sunday_ad_date` → `sunday_ad_first_date` (already migrated)
- `eta_9089_filing_date` → `eta9089_filing_date` (underscores removed)

**RFI/RFE System:**
- v1.0: Single RFI/RFE per case (legacy fields)
- v2.0: Multiple RFI/RFE entries per case (new tables: `case_rfi`, `case_rfe`)
- **Migration Strategy:** Both systems currently supported for backward compatibility

**Auto-Calculated Fields:**
- v1.0: Calculated server-side in Python (FastAPI)
- v2.0: Must be calculated server-side in new stack
- **CRITICAL:** Never trust client-side calculations for regulatory compliance

**Status Enum:**
- v1.0: Stored as VARCHAR with CHECK constraint
- v2.0: Should use native enum type if supported by new stack
- **Values:** Exactly 14 allowed values (see Section 2.1)

**Date Storage:**
- v1.0: PostgreSQL DATE type
- v2.0: Use native date type, NOT timestamp
- **Rationale:** PERM deadlines are date-based, not time-based

---

## 7. Professional Occupation Rules

### 7.1 Definition

**Field:** `is_professional_occupation`

**Type:** Boolean

**Default:** `false` (non-professional occupation)

**Regulation:** 20 CFR § 656.17(e)

**Trigger:**

The `is_professional_occupation` field must be set to `true` when the position meets the definition of a professional occupation according to DOL regulations.

**Professional Occupation Criteria:**

A position is classified as "professional" when:
- The position **requires** a Bachelor's degree (or higher) as the **minimum** education requirement
- The degree requirement is an actual minimum requirement of the job, not a preference
- The requirement is normal for the occupation in the industry

**Non-Professional Examples:**
- Administrative Assistant (no degree required)
- Retail Manager (degree preferred but not required)
- Cook (vocational training sufficient)

**Professional Examples:**
- Software Engineer (Bachelor's in Computer Science required)
- Accountant (Bachelor's in Accounting required)
- Civil Engineer (Bachelor's in Engineering required)

**Important Notes:**
- Do NOT check this box if degree is only "preferred" or "desired"
- Do NOT check this box if experience can substitute for education
- Position title alone does not determine professional status - actual job requirements do

### 7.2 Additional Recruitment Requirements

**Regulation:** 20 CFR § 656.17(e)(1)(ii)

Professional occupations require **3 of the following 10** additional recruitment steps, **beyond** the mandatory steps (job order, two Sunday ads, notice of filing):

**The 10 Additional Recruitment Methods:**

1. **Job Website**
   - Posting on major job sites (Monster.com, Indeed.com, CareerBuilder, etc.)
   - Must be active and searchable by public
   - Must include all material job requirements

2. **Employer's Website**
   - Posting on company's own career/jobs page
   - Must be accessible to the public
   - Must remain posted for duration of recruitment period

3. **On-Campus Recruiting**
   - Recruitment activities at colleges/universities
   - Includes career fairs, information sessions, interviews
   - Must document attendance and recruitment efforts

4. **Trade or Professional Organization**
   - Posting with relevant industry associations
   - Examples: IEEE, ABA, AICPA, etc.
   - Must be industry-appropriate for the position

5. **Private Employment Firm**
   - Engagement of recruiting agency or headhunter
   - Agency must actively search for qualified candidates
   - Must document agency's recruitment efforts

6. **Employee Referral Program with Incentives**
   - Internal referral program with financial or other rewards
   - Must offer significant incentive (bonus, prize, etc.)
   - Must document program details and promotion

7. **Campus Placement Office**
   - Posting with university career services/placement offices
   - Can be at multiple institutions
   - Must document posting dates and institutions

8. **Local and Ethnic Newspapers**
   - Advertisement in newspapers targeting specific communities
   - Must be in area of intended employment or national circulation
   - Separate from required Sunday newspaper ads

9. **Radio and Television Advertisements**
   - Paid advertising on broadcast media
   - Must be in area of intended employment
   - Must document when ads ran and content

10. **Other Recruitment Methods**
    - Any other lawful recruitment activity
    - Must be pre-approved by DOL in some cases
    - Examples: LinkedIn job posting, industry publications, job banks

**Implementation:**

```typescript
interface AdditionalRecruitmentMethod {
  method_name: string;  // One of the 10 methods above
  start_date: Date;     // When recruitment method began
  end_date: Date | null; // When recruitment method ended (if completed)
  description: string | null; // Details (e.g., which website, which newspaper)
  applicants_count: number; // Applicants received from this method
}

// Stored in case field:
additional_recruitment_methods: AdditionalRecruitmentMethod[] | null;
```

### 7.3 30-Day Final Step Rule

**Regulation:** 20 CFR § 656.17(e)(1)

**Critical Requirement:** Only **ONE** of the additional recruitment steps may be conducted within **30 days** of filing the ETA 9089 application.

**Rationale:**

The purpose of the 30-day quiet period is to ensure employers have time to:
1. Review all recruitment results
2. Document why U.S. workers were not hired
3. Prepare the ETA 9089 application with complete recruitment data

**Validation Rule:**

```typescript
function validateThirtyDayFinalStepRule(
  eta9089_filing_date: Date,
  additional_recruitment_methods: AdditionalRecruitmentMethod[]
): ValidationResult {
  if (!eta9089_filing_date || !additional_recruitment_methods) {
    return { valid: true };
  }

  // Calculate 30-day threshold
  const thirtyDaysBeforeFiling = addDays(eta9089_filing_date, -30);

  // Count how many additional steps ended within 30 days of filing
  const stepsWithin30Days = additional_recruitment_methods.filter(method => {
    if (!method.end_date) return false;
    return method.end_date > thirtyDaysBeforeFiling;
  });

  if (stepsWithin30Days.length > 1) {
    return {
      valid: false,
      error: `Only ONE additional recruitment step may end within 30 days of ETA 9089 filing. Currently ${stepsWithin30Days.length} steps end after ${thirtyDaysBeforeFiling}.`,
      affectedMethods: stepsWithin30Days.map(m => m.method_name)
    };
  }

  if (stepsWithin30Days.length === 1) {
    return {
      valid: true,
      warning: `One additional recruitment step (${stepsWithin30Days[0].method_name}) ends within 30 days of filing. This is permitted.`
    };
  }

  return { valid: true };
}
```

**Error Code:** `V-PRO-02`

**Examples:**

**Valid Scenario:**
- Job website ad: May 1 - May 31
- Employer website: May 1 - May 31
- Trade organization: May 1 - June 15 (within 30 days of filing)
- ETA 9089 filing: June 30
- ✅ Only ONE step (trade organization) ends within 30 days

**Invalid Scenario:**
- Job website ad: May 1 - June 15 (within 30 days)
- Employer website: May 1 - June 20 (within 30 days)
- Trade organization: May 1 - May 31
- ETA 9089 filing: June 30
- ❌ TWO steps end within 30 days - VIOLATION

### 7.4 Validation

**Professional Occupation Validation Rules:**

```typescript
function validateProfessionalOccupationRequirements(
  is_professional_occupation: boolean,
  additional_recruitment_methods: AdditionalRecruitmentMethod[] | null,
  eta9089_filing_date: Date | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: Professional positions require 3 additional recruitment methods
  if (is_professional_occupation) {
    const methodCount = additional_recruitment_methods?.length || 0;

    if (methodCount < 3) {
      errors.push({
        field: "additional_recruitment_methods",
        message: `Professional occupations require 3 additional recruitment methods. Currently ${methodCount} methods are documented.`,
        severity: "error",
        code: "V-PRO-01"
      });
    }
  }

  // Rule 2: If not professional, additional methods are optional (no validation needed)
  if (!is_professional_occupation && additional_recruitment_methods && additional_recruitment_methods.length > 0) {
    errors.push({
      field: "is_professional_occupation",
      message: "Additional recruitment methods are documented but position is not marked as professional. Consider marking position as professional if Bachelor's degree is required.",
      severity: "warning",
      code: "V-PRO-03"
    });
  }

  // Rule 3: 30-Day Final Step Rule (see Section 7.3)
  if (is_professional_occupation && additional_recruitment_methods && eta9089_filing_date) {
    const thirtyDayValidation = validateThirtyDayFinalStepRule(
      eta9089_filing_date,
      additional_recruitment_methods
    );

    if (!thirtyDayValidation.valid) {
      errors.push({
        field: "eta9089_filing_date",
        message: thirtyDayValidation.error,
        severity: "error",
        code: "V-PRO-02"
      });
    }
  }

  // Rule 4: Each additional method must have start and end dates
  if (additional_recruitment_methods) {
    additional_recruitment_methods.forEach((method, index) => {
      if (!method.start_date) {
        errors.push({
          field: `additional_recruitment_methods[${index}].start_date`,
          message: `${method.method_name} must have a start date`,
          severity: "error",
          code: "V-PRO-04"
        });
      }

      if (!method.end_date) {
        errors.push({
          field: `additional_recruitment_methods[${index}].end_date`,
          message: `${method.method_name} must have an end date`,
          severity: "warning",
          code: "V-PRO-05"
        });
      }

      if (method.start_date && method.end_date && method.end_date <= method.start_date) {
        errors.push({
          field: `additional_recruitment_methods[${index}].end_date`,
          message: `${method.method_name} end date must be after start date`,
          severity: "error",
          code: "V-PRO-06"
        });
      }
    });
  }

  // Rule 5: All additional methods must be within the 30-180 day window
  if (additional_recruitment_methods && eta9089_filing_date) {
    const recruitment_end_date = max(
      additional_recruitment_methods
        .map(m => m.end_date)
        .filter(d => d !== null)
    );

    if (recruitment_end_date) {
      const windowOpens = addDays(recruitment_end_date, 30);
      const windowCloses = addDays(recruitment_end_date, 180);

      if (eta9089_filing_date < windowOpens || eta9089_filing_date > windowCloses) {
        errors.push({
          field: "eta9089_filing_date",
          message: `ETA 9089 must be filed 30-180 days after recruitment ends (window: ${windowOpens} - ${windowCloses})`,
          severity: "error",
          code: "V-DATE-04"
        });
      }
    }
  }

  return errors;
}
```

**Validation Error Codes:**

| Code | Description |
|------|-------------|
| `V-PRO-01` | Professional position requires 3 additional methods |
| `V-PRO-02` | More than one additional method ends within 30 days of filing |
| `V-PRO-03` | Additional methods documented but position not marked professional |
| `V-PRO-04` | Additional method missing start date |
| `V-PRO-05` | Additional method missing end date (warning) |
| `V-PRO-06` | Additional method end date before start date |

---

## 8. Feature Cross-Reference

### 8.1 Features Covered by This Document

This document covers the complete business logic for **229 features** documented in [V2_FEATURE_INVENTORY.md](V2_FEATURE_INVENTORY.md).

**Mapping by Section:**

| V2_BUSINESS_RULES.md Section | V2_FEATURE_INVENTORY.md Section | Features |
|------------------------------|--------------------------------|----------|
| 1. PERM Process Overview | 2. Case Management | 15 |
| 2. Case Stage Progression | 4. Case Stages | 11 |
| 3. Auto-Calculated Fields | 2. Case Management | 4 (subset) |
| 4. The Either/Or Rule | 3. Date Validation | 1 (V-DATE-08) |
| 5. Case Field Reference | 2. Case Management | 15 |
| 6. Date Validation Rules | 3. Date Validation | 20 |
| 7. Professional Occupation Rules | 3. Date Validation + 7. Recruitment | 4 + 8 |
| 7. Terminal States | 4. Case Stages | 4 (subset) |
| 8. Deadline Relevance Logic | 5. Deadline Tracking | 15 |

**Complete Feature Coverage:**

**Section 2: Case Management (15 features)**
- All case CRUD operations (Section 5)
- Auto-calculated fields (Section 3)
- Beneficiary identifier generation (Section 3.5)
- Case validation (Section 6)
- Import/export (documented separately)

**Section 3: Date Validation (20 features)**
- PWD validation (Section 6.1) → 4 features
- Sunday ad validation (Section 6.2) → 3 features
- Job order validation (Section 6.3) → 2 features
- Notice of Filing (Section 1.3) → 1 feature
- Business day calculator (Section 6.3) → 1 feature
- ETA 9089 validation (Section 6.4) → 5 features
- I-140 validation (Section 6.5) → 3 features
- RFI/RFE validation (Section 6.6) → 2 features
- Professional occupation rules (Section 7) → 4 features
- Either/Or rule (Section 4) → 1 feature

**Section 4: Case Stages (11 features)**
- All 14 stage enum values (Section 2.1)
- Auto-determination algorithm (Section 2.2)
- Terminal states (Section 7)

**Section 5: Deadline Tracking (15 features)**
- PWD expiration deadline (Section 8.1)
- Recruitment deadlines (Section 8.2)
- ETA 9089 expiration deadline (Section 8.3)
- RFI deadlines (Section 8.4)
- RFE deadlines (Section 8.5)
- Deadline relevance system (Section 8)
- Deadline cleanup (Section 8.6)

**Section 7: Recruitment (8 features)**
- Auto-generated recruitment summary (Section 1.3)
- Custom recruitment summary override (Section 5.1)
- Recruitment completion detection (Section 3.2)
- Professional occupation requirements (Section 7)
- Additional recruitment methods (Section 7.2)
- 30-day final step rule (Section 7.3)

### 8.2 Related Documents

This document is part of the v2.0 migration documentation suite:

**Core Business Logic Documents:**

1. **V2_BUSINESS_RULES.md** (this document)
   - Complete PERM business logic
   - Date validation rules
   - Auto-calculated fields
   - Case stage progression
   - Professional occupation rules
   - Terminal states
   - Deadline relevance

2. **V2_DEADLINE_FLOWS.md**
   - In-depth deadline calculations
   - Step-by-step examples
   - Edge cases and scenarios
   - Deadline messaging

3. **V2_VALIDATION_RULES.md**
   - All validation rules in detail
   - Error codes and messages
   - Cross-field validation
   - Validation severity levels

4. **V2_DEADLINE_SYSTEM.md**
   - Complete deadline ecosystem
   - Notification integration
   - Calendar sync integration
   - Background jobs

**Feature Documentation:**

5. **V2_FEATURE_INVENTORY.md**
   - 229 features checklist
   - Feature verification at go-live
   - Feature counts by category

**Migration Guides:**

6. **V2_MIGRATION_PLAN.md**
   - Phase-by-phase migration strategy
   - 32 phases from planning to go-live
   - Tech stack decisions
   - Risk mitigation

**Reference Documents:**

7. **docs/research.md** (v1.0 codebase)
   - PERM regulatory research
   - CFR citations with context
   - DOL processing times
   - USCIS service centers

8. **docs/plan.md** (v1.0 codebase)
   - Original implementation plan
   - Feature specifications
   - Technical decisions

**How to Use These Documents:**

- **Implementing Date Logic?** → Read this document (Section 6) + V2_DEADLINE_FLOWS.md
- **Implementing Deadlines?** → V2_DEADLINE_SYSTEM.md + this document (Section 8)
- **Implementing Validation?** → This document (Section 6) + V2_VALIDATION_RULES.md
- **Understanding Professional Positions?** → This document (Section 7)
- **Verifying Feature Completeness?** → V2_FEATURE_INVENTORY.md
- **Understanding Regulations?** → docs/research.md + this document (Appendix A)

**Regulatory References:**

All business logic in this document is derived from:

- **20 CFR § 656.17** - Basic recruitment requirements
- **20 CFR § 656.17(e)** - Professional occupations, 3 of 10 methods
- **20 CFR § 656.17(e)(1)** - 30-day post-recruitment wait
- **20 CFR § 656.17(e)(1)(i)** - Job order 30-day minimum
- **20 CFR § 656.17(e)(1)(ii)** - The 10 additional recruitment methods
- **20 CFR § 656.18** - College/University teachers (special recruitment)
- **20 CFR § 656.40(c)** - PWD validity period and Either/Or rule
- **20 CFR § 656.10(d)(3)** - Notice of Filing 10 business days
- **8 CFR § 204.5(n)(3)** - ETA 9089 certification 180-day validity
- **8 CFR § 204.5(e)** - Priority date retention
- **INA § 204(j)** - Job portability protection

---

**End of Document**

This document is complete and sufficient for v2.0 migration. All business logic has been extracted from the v1.0 codebase and documented here. The new stack should implement this logic exactly as specified, with no reference to the FastAPI codebase.
