---
phase: 006-recruitment-method-dates-and-entries
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Types & Schema
  - src/lib/shared/types.ts
  - convex/schema.ts
  - src/lib/forms/case-form-schema.ts
  - convex/cases.ts
  # Constants
  - src/components/forms/sections/recruitment-section.constants.ts
  # Backend logic
  - convex/lib/perm/validators/recruitment.ts
  - convex/lib/perm/recruitment/isRecruitmentComplete.ts
  - convex/lib/derivedCalculations.ts
  # Frontend
  - src/lib/forms/date-constraints.ts
  - src/hooks/useDateFieldValidation.ts
  - src/components/forms/sections/RecruitmentSection.tsx
  - src/components/forms/sections/SubEntriesManager.tsx
  # Tests
  - convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts
autonomous: true
must_haves:
  truths:
    - "Date-range methods (job_website_ad, employer_website, private_employment_firm) show startDate + endDate inputs instead of single date"
    - "Sub-entry methods (radio_ad, tv_ad) show a list of sub-entries with date + description each"
    - "Single-date methods (6 remaining) show only one date input as before"
    - "Legacy additionalRecruitmentStartDate/EndDate fields are removed from schema and UI"
    - "V-PROF validation rules enforce date ordering and recruitment window constraints on method-level dates"
    - "calculateRecruitmentEndDate correctly uses method startDate/endDate/subEntries for max end date"
    - "isRecruitmentComplete recognizes methods with startDate, endDate, or subEntries as having dates"
  artifacts:
    - path: "src/lib/shared/types.ts"
      provides: "Extended AdditionalRecruitmentMethod with optional startDate, endDate, subEntries"
    - path: "src/components/forms/sections/recruitment-section.constants.ts"
      provides: "METHOD_CATEGORIES constant mapping methods to date-range/sub-entries/single-date"
    - path: "src/components/forms/sections/SubEntriesManager.tsx"
      provides: "Sub-entry list component for radio/TV ads"
    - path: "convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts"
      provides: "Tests for V-PROF-01 through V-PROF-05 validation rules"
  key_links:
    - from: "src/components/forms/sections/RecruitmentSection.tsx"
      to: "src/components/forms/sections/recruitment-section.constants.ts"
      via: "METHOD_CATEGORIES import for conditional rendering"
      pattern: "METHOD_CATEGORIES"
    - from: "convex/lib/derivedCalculations.ts"
      to: "AdditionalRecruitmentMethod type"
      via: "method.startDate/endDate/subEntries in calculateRecruitmentEndDate"
      pattern: "method\\.startDate|method\\.endDate|method\\.subEntries"
    - from: "convex/lib/perm/recruitment/isRecruitmentComplete.ts"
      to: "AdditionalRecruitmentMethod type"
      via: "method has date or startDate or subEntries"
      pattern: "method\\.startDate|method\\.subEntries"
---

<objective>
Extend the professional recruitment methods to support per-method date ranges (startDate + endDate) for web/firm-based methods, sub-entries (array of date+description) for radio/TV ads, and retain single date for the remaining methods. Remove legacy top-level additionalRecruitmentStartDate/EndDate fields. Add V-PROF validation rules and update all downstream consumers.

Purpose: Different recruitment methods have fundamentally different temporal characteristics. Job website ads run for date ranges, radio/TV ads air on specific dates (multiple spots), and job fairs happen on a single day. The current single-date model cannot capture this accurately.

Output: Extended schema, types, validation, and UI with method-type-aware date inputs.
</objective>

<execution_context>
@/Users/dev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/features/006-recruitment-method-dates-and-entries/006-ARCHITECTURE.md
@.planning/features/006-recruitment-method-dates-and-entries/006-CLARIFICATIONS.md
@.planning/features/006-recruitment-method-dates-and-entries/006-EXPLORATION.md
@src/lib/shared/types.ts
@convex/schema.ts
@src/lib/forms/case-form-schema.ts
@convex/cases.ts
@src/components/forms/sections/recruitment-section.constants.ts
@src/components/forms/sections/RecruitmentSection.tsx
@convex/lib/perm/validators/recruitment.ts
@convex/lib/derivedCalculations.ts
@convex/lib/perm/recruitment/isRecruitmentComplete.ts
@src/lib/forms/date-constraints.ts
@src/hooks/useDateFieldValidation.ts
@convex/lib/perm/types.ts
@convex/lib/perm/constants.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend types, schema, constants, and add V-PROF validation tests (TDD red phase)</name>
  <files>
    src/lib/shared/types.ts
    convex/schema.ts
    src/lib/forms/case-form-schema.ts
    src/components/forms/sections/recruitment-section.constants.ts
    convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts
    convex/lib/perm/validators/recruitment.ts
    convex/cases.ts
  </files>
  <action>
**Step 1: Extend AdditionalRecruitmentMethod type** in `src/lib/shared/types.ts`:

Add optional fields to the existing `AdditionalRecruitmentMethod` interface:
```typescript
export interface AdditionalRecruitmentMethod {
  method: string;
  date: string;               // existing - single date (kept for backward compat + single-date methods)
  description?: string;       // existing
  startDate?: string;         // NEW - for date-range methods (ISO YYYY-MM-DD)
  endDate?: string;           // NEW - for date-range methods (ISO YYYY-MM-DD)
  subEntries?: SubEntry[];    // NEW - for radio_ad, tv_ad
}

export interface SubEntry {
  date: string;               // ISO YYYY-MM-DD
  description?: string;       // e.g., "WABC 30-second spot"
}
```

**Step 2: Add METHOD_CATEGORIES constant** to `src/components/forms/sections/recruitment-section.constants.ts`:

```typescript
export const DATE_RANGE_METHODS = ['job_website_ad', 'employer_website', 'private_employment_firm'] as const;
export const SUB_ENTRY_METHODS = ['radio_ad', 'tv_ad'] as const;
// Remaining methods use single date (no constant needed, it's the default)

export type DateRangeMethod = (typeof DATE_RANGE_METHODS)[number];
export type SubEntryMethod = (typeof SUB_ENTRY_METHODS)[number];

export function getMethodCategory(method: string): 'date-range' | 'sub-entries' | 'single-date' {
  if ((DATE_RANGE_METHODS as readonly string[]).includes(method)) return 'date-range';
  if ((SUB_ENTRY_METHODS as readonly string[]).includes(method)) return 'sub-entries';
  return 'single-date';
}
```

**Step 3: Update Convex schema** in `convex/schema.ts`:

In the `additionalRecruitmentMethods` array object, add:
```typescript
additionalRecruitmentMethods: v.array(
  v.object({
    method: v.string(),
    date: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),   // NEW
    endDate: v.optional(v.string()),     // NEW
    subEntries: v.optional(v.array(      // NEW
      v.object({
        date: v.string(),
        description: v.optional(v.string()),
      })
    )),
  })
),
```

IMPORTANT: Do NOT remove `additionalRecruitmentStartDate` or `additionalRecruitmentEndDate` from schema yet. These are legacy fields that may have data in production. Mark them with a deprecation comment instead. They will be removed in a separate migration task.

**Step 4: Update Zod schema** in `src/lib/forms/case-form-schema.ts`:

Update `additionalRecruitmentMethodSchema`:
```typescript
const subEntrySchema = z.object({
  date: isoDateSchema,
  description: z.string().optional(),
});

const additionalRecruitmentMethodSchema = z.object({
  method: z.string().min(1, 'Method is required'),
  date: z.string(), // Keep for backward compat but may be empty for date-range/sub-entry methods
  description: z.string().optional(),
  startDate: optionalIsoDateSchema,
  endDate: optionalIsoDateSchema,
  subEntries: z.array(subEntrySchema).optional(),
});
```

Update `validateProfessionalRecruitment()` to validate per-method dates based on category:
- For date-range methods: validate startDate <= endDate, both within recruitment window
- For sub-entry methods: validate each sub-entry date is within recruitment window
- For single-date methods: keep existing date validation

Update `CrossValidationData` interface to include the new fields in additionalRecruitmentMethods array.

**Step 5: Update Convex mutation validators** in `convex/cases.ts`:

Update the `additionalRecruitmentMethods` validator in both `createCase` args and `updateCase` args to include the new optional fields:
```typescript
additionalRecruitmentMethods: v.optional(
  v.array(
    v.object({
      method: v.string(),
      date: v.string(),
      description: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      subEntries: v.optional(v.array(
        v.object({
          date: v.string(),
          description: v.optional(v.string()),
        })
      )),
    })
  )
),
```

Search for ALL occurrences of the additionalRecruitmentMethods v.object validator in cases.ts (there are at least 4: createCase args, updateCase args, importCase args, and any internal helpers) and update each one.

**Step 6: Write V-PROF validation tests** in `convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts`:

Create a new test file following the pattern of existing validator tests. Import from `../recruitment.ts` (we will add a new `validateProfessionalMethods` function there in the green phase).

Write tests for these rules (all should FAIL initially since the validator does not exist yet):

```typescript
import { describe, it, expect } from 'vitest';
import { validateProfessionalMethods } from '../recruitment';

describe('validateProfessionalMethods (V-PROF rules)', () => {
  const baseInput = {
    pwdDeterminationDate: '2024-01-15',
    pwdExpirationDate: '2025-01-15',
    firstRecruitmentDate: '2024-02-01',
  };

  describe('V-PROF-01: Date range start must be after PWDDD', () => {
    it('errors when startDate is before PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-01-10', // before PWDDD
          endDate: '2024-03-10',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(true);
    });

    it('passes when startDate is after PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-02-01',
          endDate: '2024-03-01',
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-01')).toBe(false);
    });
  });

  describe('V-PROF-02: Date range start cannot be after end date', () => {
    it('errors when startDate is after endDate', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'employer_website',
          date: '',
          startDate: '2024-04-01',
          endDate: '2024-03-01', // before start
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-02')).toBe(true);
    });
  });

  describe('V-PROF-03: Date range end must be before recruitment window close', () => {
    it('errors when endDate exceeds recruitment window', () => {
      // firstRecruitment=2024-02-01, window closes at +150 = 2024-06-30
      // pwdExpiration=2025-01-15, -30 = 2024-12-16
      // Effective max = 2024-06-30 (recruitment limit is earlier)
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'private_employment_firm',
          date: '',
          startDate: '2024-02-15',
          endDate: '2024-08-01', // beyond 150 days
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-03')).toBe(true);
    });
  });

  describe('V-PROF-04: Date range end cannot be before start', () => {
    // Same as V-PROF-02 from opposite perspective, tests endDate field path
    it('flags endDate field when end is before start', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_website_ad',
          date: '',
          startDate: '2024-05-01',
          endDate: '2024-04-01',
        }],
      });
      const endError = result.errors.find(e => e.ruleId === 'V-PROF-02' || e.ruleId === 'V-PROF-04');
      expect(endError).toBeDefined();
    });
  });

  describe('V-PROF-05: Sub-entries date must be within recruitment window', () => {
    it('errors when sub-entry date is before PWDDD', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-01-10', description: 'Morning show spot' }, // before PWDDD
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(true);
    });

    it('passes when sub-entry dates are within window', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'tv_ad',
          date: '',
          subEntries: [
            { date: '2024-03-01', description: 'Prime time spot' },
            { date: '2024-03-15', description: 'Weekend spot' },
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(false);
    });

    it('errors when sub-entry date exceeds recruitment window', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'radio_ad',
          date: '',
          subEntries: [
            { date: '2024-08-01', description: 'Late spot' }, // beyond window
          ],
        }],
      });
      expect(result.errors.some(e => e.ruleId === 'V-PROF-05')).toBe(true);
    });
  });

  describe('single-date methods are NOT validated by V-PROF', () => {
    it('does not run V-PROF rules for single-date methods', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{
          method: 'job_fair',
          date: '2024-03-01',
        }],
      });
      expect(result.errors.filter(e => e.ruleId.startsWith('V-PROF')).length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty methods array', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [],
      });
      expect(result.valid).toBe(true);
    });

    it('handles method with no dates at all', () => {
      const result = validateProfessionalMethods({
        ...baseInput,
        methods: [{ method: 'job_website_ad', date: '' }],
      });
      // Should not crash, no V-PROF errors (missing dates are handled by Zod schema)
      expect(result.errors.filter(e => e.ruleId.startsWith('V-PROF')).length).toBe(0);
    });
  });
});
```

**Step 7: Create stub `validateProfessionalMethods` in `convex/lib/perm/validators/recruitment.ts`:**

Add at the bottom of the file, a stub export so the test file compiles but all validation tests fail:
```typescript
export interface ProfessionalMethodsInput {
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;
  firstRecruitmentDate?: string | null;
  methods: Array<{
    method: string;
    date: string;
    startDate?: string;
    endDate?: string;
    subEntries?: Array<{ date: string; description?: string }>;
  }>;
}

export function validateProfessionalMethods(
  _input: ProfessionalMethodsInput
): ValidationResult {
  // STUB: Will be implemented in Task 2 (green phase)
  return createValidationResult([], []);
}
```

Commit: `test(006): add V-PROF validation tests and extend types/schema for method-level dates`
  </action>
  <verify>
    1. `cd /Users/dev/cc/perm-tracker/v2 && npx tsc --noEmit` passes (types compile)
    2. `pnpm vitest run convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` - tests run but V-PROF rule assertions FAIL (red phase: stub returns no errors)
    3. Verify the `SubEntry` type is exported from `src/lib/shared/types.ts`
    4. Verify `getMethodCategory('radio_ad')` returns `'sub-entries'`
    5. Verify `getMethodCategory('job_website_ad')` returns `'date-range'`
    6. Verify `getMethodCategory('job_fair')` returns `'single-date'`
  </verify>
  <done>
    - AdditionalRecruitmentMethod interface extended with startDate, endDate, subEntries
    - SubEntry interface defined
    - Convex schema updated with new optional fields (backward compatible)
    - Zod schema updated with new fields
    - METHOD_CATEGORIES constants and getMethodCategory() function added
    - V-PROF test file exists with 10+ test cases, all compiling, most assertions failing (red phase)
    - validateProfessionalMethods stub exported from recruitment.ts
    - All Convex mutation validators updated to accept new fields
    - TypeScript compilation passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement V-PROF validators and update backend logic (TDD green phase)</name>
  <files>
    convex/lib/perm/validators/recruitment.ts
    convex/lib/derivedCalculations.ts
    convex/lib/perm/recruitment/isRecruitmentComplete.ts
    src/lib/forms/date-constraints.ts
    src/hooks/useDateFieldValidation.ts
  </files>
  <action>
**Step 1: Implement `validateProfessionalMethods` in `convex/lib/perm/validators/recruitment.ts`:**

Replace the stub with real implementation. Import `getMethodCategory` from a shared location or inline the logic (since this is backend code, inline the arrays to avoid cross-boundary imports):

```typescript
const DATE_RANGE_METHODS = ['job_website_ad', 'employer_website', 'private_employment_firm'];
const SUB_ENTRY_METHODS = ['radio_ad', 'tv_ad'];
```

Implementation for each rule:

**V-PROF-01:** For date-range methods with `startDate`, check `startDate > pwdDeterminationDate`. Field: `additionalRecruitmentMethods.{index}.startDate`.

**V-PROF-02:** For date-range methods with both `startDate` and `endDate`, check `startDate <= endDate`. Field: `additionalRecruitmentMethods.{index}.endDate`.

**V-PROF-03:** For date-range methods with `endDate`, check endDate is within recruitment window: `endDate <= min(firstRecruitmentDate + 150, pwdExpirationDate - 30)`. Field: `additionalRecruitmentMethods.{index}.endDate`.

**V-PROF-04:** Same as V-PROF-02 but from endDate perspective (can be combined with V-PROF-02).

**V-PROF-05:** For sub-entry methods, iterate `subEntries` array. Each entry's `date` must be: (a) after pwdDeterminationDate, (b) within recruitment window. Field: `additionalRecruitmentMethods.{index}.subEntries.{subIndex}.date`.

For calculating recruitment window max, use the same formula as `calculateMethodMaxDate` in case-form-schema.ts: `min(firstRecruitmentDate + 150 days, pwdExpirationDate - 30 days)`. Import `RECRUITMENT_WINDOW_DAYS` and `PWD_RECRUITMENT_BUFFER_DAYS` from `../constants`.

Only process methods whose `method` value is in `DATE_RANGE_METHODS` or `SUB_ENTRY_METHODS`. Single-date methods are validated by the existing `validateProfessionalRecruitment` in case-form-schema.ts.

**Step 2: Update `calculateRecruitmentEndDate` in `convex/lib/derivedCalculations.ts`:**

Currently, the function only looks at `method.date` for individual method dates. Update it to also consider:
- `method.startDate` and `method.endDate` for date-range methods (use endDate as the end proxy)
- `method.subEntries` dates for sub-entry methods (use max subEntry date)

```typescript
// In the isProfessionalOccupation block, update the method date loop:
if (input.additionalRecruitmentMethods) {
  for (const method of input.additionalRecruitmentMethods) {
    // Existing: single date
    if (isValidISODate(method.date)) {
      dates.push(method.date);
    }
    // NEW: date-range methods - use endDate (or startDate if no endDate)
    if (isValidISODate((method as any).endDate)) {
      dates.push((method as any).endDate);
    } else if (isValidISODate((method as any).startDate)) {
      dates.push((method as any).startDate);
    }
    // NEW: sub-entry methods - use max sub-entry date
    if ((method as any).subEntries) {
      for (const entry of (method as any).subEntries) {
        if (isValidISODate(entry.date)) {
          dates.push(entry.date);
        }
      }
    }
  }
}
```

IMPORTANT: Update the `DerivedCalculationInput` interface's `additionalRecruitmentMethods` type to include the new optional fields:
```typescript
additionalRecruitmentMethods?: Array<{
  date?: string;
  startDate?: string;
  endDate?: string;
  subEntries?: Array<{ date: string }>;
}>;
```

**Step 3: Update `isRecruitmentComplete` in `convex/lib/perm/recruitment/isRecruitmentComplete.ts`:**

Update the `AdditionalMethod` interface to include new fields:
```typescript
interface AdditionalMethod {
  method: string;
  date: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  subEntries?: Array<{ date: string; description?: string }>;
}
```

Update `isProfessionalRecruitmentComplete` - the `methodsWithDates` filter currently checks `m.method && m.date`. Update to also accept methods that have `startDate` or `subEntries`:
```typescript
const methodsWithDates = methods.filter((m) =>
  m.method && (m.date || m.startDate || (m.subEntries && m.subEntries.length > 0))
);
```

**Step 4: Update `getProfessionalDateConstraints` in `src/lib/forms/date-constraints.ts`:**

The legacy constraints for `additionalRecruitmentStartDate` and `additionalRecruitmentEndDate` are still returned. Keep them for backward compatibility but also add a new exported function for per-method constraints:

```typescript
/**
 * Get date constraints for a specific method's date fields based on its category.
 * Uses the same formula as legacy getProfessionalDateConstraints.
 */
export function getMethodDateConstraints(
  values: Partial<CaseFormData>,
  methodType: 'date-range' | 'sub-entries' | 'single-date',
  methodStartDate?: string
) {
  const firstRecruitmentDate = getFirstRecruitmentStartDate(values);
  const { pwdExpirationDate: pwdExpiration, pwdDeterminationDate: pwdDet } = values;

  const deadline = getRecruitmentFieldDeadline('additionalRecruitmentStartDate', firstRecruitmentDate, pwdExpiration);
  const minAfterPwd = pwdDet ? addDaysToDateStr(pwdDet, 1) : undefined;

  if (methodType === 'date-range') {
    return {
      startDate: {
        min: minAfterPwd,
        max: deadline.maxDate,
        hint: buildAfterHint(pwdDet, deadline, "Enter PWD determination date first"),
      },
      endDate: {
        min: methodStartDate ? addDaysToDateStr(methodStartDate, 1) : minAfterPwd,
        max: deadline.maxDate,
        hint: methodStartDate
          ? buildAfterHint(methodStartDate, deadline, "Enter start date first")
          : "Enter start date first",
      },
    };
  }

  if (methodType === 'sub-entries') {
    return {
      entryDate: {
        min: minAfterPwd,
        max: deadline.maxDate,
        hint: buildAfterHint(pwdDet, deadline, "Enter PWD determination date first"),
      },
    };
  }

  // single-date: return same constraints as existing method date
  return {
    date: {
      min: minAfterPwd,
      max: deadline.maxDate,
      hint: buildAfterHint(pwdDet, deadline, "Enter PWD determination date first"),
    },
  };
}
```

Note: `addDaysToDateStr` and `buildAfterHint` are already in the file. Export `getMethodDateConstraints` alongside existing exports.

**Step 5: Update `useDateFieldValidation.ts`** to handle method-level date fields:

The current hook works on top-level form fields. Method-level dates (like `additionalRecruitmentMethods.0.startDate`) are validated via Zod cross-validation and the new V-PROF validators. No changes needed to the FIELD_DEPENDENCIES map for method-level fields since they are array items.

However, update `DATE_FIELDS` array if needed and ensure the hook does not break when additionalRecruitmentStartDate/EndDate fields are empty (backward compat).

No major changes needed here -- the existing `additionalRecruitmentStartDate` and `additionalRecruitmentEndDate` entries in FIELD_DEPENDENCIES can stay for backward compatibility. The per-method validation happens in the Zod superRefine and the new V-PROF validator.

Commit: `feat(006): implement V-PROF validators and update backend date calculations`
  </action>
  <verify>
    1. `pnpm vitest run convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` - ALL tests pass (green phase)
    2. `cd /Users/dev/cc/perm-tracker/v2 && npx tsc --noEmit` passes
    3. `pnpm test:fast` - no regressions in existing tests
    4. Verify that `calculateRecruitmentEndDate` with a method having `endDate: '2024-06-01'` includes that date in the max calculation
    5. Verify `isRecruitmentComplete` with 3 methods where one uses `startDate` instead of `date` returns true
  </verify>
  <done>
    - validateProfessionalMethods fully implemented with V-PROF-01 through V-PROF-05
    - All V-PROF tests pass
    - calculateRecruitmentEndDate considers startDate, endDate, and subEntries dates
    - isRecruitmentComplete recognizes methods with startDate or subEntries as complete
    - getMethodDateConstraints exported from date-constraints.ts
    - No regression in existing 3600+ tests
  </done>
</task>

<task type="auto">
  <name>Task 3: Create SubEntriesManager component and update RecruitmentSection UI</name>
  <files>
    src/components/forms/sections/SubEntriesManager.tsx
    src/components/forms/sections/RecruitmentSection.tsx
  </files>
  <action>
**Step 1: Create `SubEntriesManager.tsx`** in `src/components/forms/sections/`:

This component manages a list of sub-entries (date + description pairs) for radio/TV ads. Follow the existing pattern of the method array management in RecruitmentSection (manual array, no useFieldArray).

```typescript
"use client";

import * as React from "react";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { SubEntry } from "@/lib/shared/types";
import type { DateConstraint } from "@/lib/forms/date-constraints";

interface SubEntriesManagerProps {
  entries: SubEntry[];
  onChange: (entries: SubEntry[]) => void;
  dateConstraint?: DateConstraint;
  maxEntries?: number; // default 10
  methodLabel: string; // e.g., "Radio Ad" for display
}

export function SubEntriesManager({
  entries,
  onChange,
  dateConstraint,
  maxEntries = 10,
  methodLabel,
}: SubEntriesManagerProps) {
  const addEntry = () => {
    if (entries.length < maxEntries) {
      onChange([...entries, { date: '', description: '' }]);
    }
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof SubEntry, value: string) => {
    onChange(entries.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {methodLabel} Entries ({entries.length})
        </span>
      </div>

      {entries.map((entry, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1 grid gap-2 md:grid-cols-2">
            <FormField
              label={`Date ${index + 1}`}
              name={`sub-entry-date-${index}`}
            >
              <DateInput
                id={`sub-entry-date-${index}`}
                name={`sub-entry-date-${index}`}
                value={entry.date || ''}
                onChange={(e) => updateEntry(index, 'date', e.target.value)}
                minDate={dateConstraint?.min}
                maxDate={dateConstraint?.max}
              />
            </FormField>
            <FormField
              label={`Description ${index + 1}`}
              name={`sub-entry-desc-${index}`}
              hint="e.g., station name, time slot"
            >
              <Input
                id={`sub-entry-desc-${index}`}
                value={entry.description || ''}
                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                placeholder="e.g., WABC morning show"
              />
            </FormField>
          </div>
          {entries.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(index)}
              className="h-8 w-8 p-0 mt-6 text-destructive hover:text-destructive/80"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {entries.length < maxEntries && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Update `RecruitmentSection.tsx`** to conditionally render date inputs based on method category:

Import the new constants and component:
```typescript
import { getMethodCategory, DATE_RANGE_METHODS, SUB_ENTRY_METHODS } from "./recruitment-section.constants";
import { getMethodDateConstraints } from "@/lib/forms/date-constraints";
import { SubEntriesManager } from "./SubEntriesManager";
import type { SubEntry } from "@/lib/shared/types";
```

Replace the current method card rendering (the `{methods.map((method, index) => (` block, lines ~640-727) with conditional rendering based on method category. The key change is in the grid inside each method card:

For each method, after the method selector dropdown:

**If date-range method** (`getMethodCategory(method.method) === 'date-range'`):
- Show Start Date input (uses `method.startDate`, constraints from `getMethodDateConstraints(values, 'date-range')`)
- Show End Date input (uses `method.endDate`, disabled until startDate entered, constraints include min=startDate+1)
- Keep Description input

**If sub-entry method** (`getMethodCategory(method.method) === 'sub-entries'`):
- Show SubEntriesManager component (uses `method.subEntries || []`)
- Keep Description input (for overall description like "targeted metro area")

**If single-date method** (default):
- Keep existing Date input (unchanged)
- Keep Description input (unchanged)

The `updateMethod` function needs to be extended to handle the new fields:
```typescript
const updateMethod = (index: number, field: string, value: string | SubEntry[] | undefined) => {
  updateRecruitmentMethods(methods.map((m, i) =>
    i === index ? { ...m, [field]: value } : m
  ));
};
```

When a method type changes via the dropdown, clear the date fields that don't apply:
```typescript
const handleMethodTypeChange = (index: number, newMethod: string) => {
  const oldCategory = getMethodCategory(methods[index]?.method || '');
  const newCategory = getMethodCategory(newMethod);

  const updated = { ...methods[index]!, method: newMethod };

  // Clear inapplicable fields when category changes
  if (oldCategory !== newCategory) {
    if (newCategory === 'date-range') {
      updated.date = '';
      updated.subEntries = undefined;
    } else if (newCategory === 'sub-entries') {
      updated.date = '';
      updated.startDate = undefined;
      updated.endDate = undefined;
      updated.subEntries = [{ date: '', description: '' }];
    } else {
      updated.startDate = undefined;
      updated.endDate = undefined;
      updated.subEntries = undefined;
    }
  }

  updateRecruitmentMethods(methods.map((m, i) => i === index ? updated : m));
};
```

Update the method select dropdown's `onChange` to use `handleMethodTypeChange(index, e.target.value)` instead of `updateMethod(index, 'method', e.target.value)`.

**Step 3: Remove the "Additional Recruitment Period (Optional)" section** (lines ~744-791 in RecruitmentSection.tsx):

This is the legacy `additionalRecruitmentStartDate`/`additionalRecruitmentEndDate` section. Remove the entire block. Keep the data in the schema for backward compat but remove the UI inputs so users enter dates at the method level going forward.

Also remove from the `RecruitmentSectionProps.values` interface:
- `additionalRecruitmentStartDate`
- `additionalRecruitmentEndDate`

And remove from the constraint variable declarations:
- `additionalStartConstraint`
- `additionalEndConstraint`
- `additionalEndDisabled`

**Step 4: Clean up unused imports and variables** that referenced the removed legacy UI fields.

Commit: `feat(006): add SubEntriesManager component and update RecruitmentSection with method-type-aware date inputs`
  </action>
  <verify>
    1. `cd /Users/dev/cc/perm-tracker/v2 && npx tsc --noEmit` passes
    2. `pnpm test:fast` - no regressions
    3. `pnpm vitest run convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` - still passing
    4. Visual check: `pnpm dev` and navigate to case edit form. Enable professional occupation checkbox:
       - Select "Job Website" method -> see Start Date + End Date inputs
       - Select "Radio Advertisement" -> see sub-entries list with Add Entry button
       - Select "Job Fair" -> see single Date input (existing behavior)
    5. The "Additional Recruitment Period (Optional)" section with legacy start/end date fields is gone
  </verify>
  <done>
    - SubEntriesManager component created and working
    - RecruitmentSection conditionally renders date-range, sub-entries, or single-date inputs based on method type
    - Method type change clears inapplicable date fields
    - Legacy "Additional Recruitment Period" UI section removed
    - All types compile, no test regressions
    - Date constraints correctly applied to method-level inputs using getMethodDateConstraints
  </done>
</task>

</tasks>

<verification>
1. **Type check:** `npx tsc --noEmit` passes with zero errors
2. **Unit tests:** `pnpm test:fast` passes (existing 1000+ fast tests)
3. **V-PROF tests:** `pnpm vitest run convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` all green
4. **Schema compatibility:** Existing cases with only `date` field on methods still work (backward compat)
5. **Recruitment completion:** Cases with 3 methods using startDate/subEntries are recognized as complete
6. **Date calculations:** `calculateRecruitmentEndDate` includes endDate and subEntry dates in max calculation
7. **Visual verification:** Professional occupation section renders correctly for all 3 method categories
</verification>

<success_criteria>
- Professional recruitment methods conditionally show date-range, sub-entry, or single-date inputs based on method type
- V-PROF-01 through V-PROF-05 validation rules enforced
- calculateRecruitmentEndDate uses method-level startDate/endDate/subEntries
- isRecruitmentComplete recognizes all date types
- Legacy additionalRecruitmentStartDate/EndDate UI removed (schema kept for migration safety)
- All existing tests pass, new V-PROF tests pass
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/features/006-recruitment-method-dates-and-entries/006-SUMMARY.md`
</output>
