---
phase: 006-recruitment-method-dates-and-entries
plan: 01
subsystem: recruitment
tags:
  - professional-recruitment
  - date-range-methods
  - sub-entries
  - validation
  - ui-enhancement
dependency_graph:
  requires:
    - base-perm-validators
    - recruitment-validation-framework
  provides:
    - method-level-date-validation
    - per-method-date-constraints
    - sub-entry-management
  affects:
    - recruitment-completion-checks
    - derived-date-calculations
    - case-form-validation
tech_stack:
  added:
    - feature-006-method-categories
  patterns:
    - conditional-rendering-by-method-category
    - tdd-red-green-cycle
    - branded-type-casting
key_files:
  created:
    - src/lib/shared/types.ts (SubEntry interface)
    - src/components/forms/sections/SubEntriesManager.tsx
    - convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts
  modified:
    - src/lib/shared/types.ts (AdditionalRecruitmentMethod extended)
    - convex/schema.ts (per-method date fields)
    - src/lib/forms/case-form-schema.ts (Zod schema updated)
    - src/components/forms/sections/recruitment-section.constants.ts (METHOD_CATEGORIES)
    - convex/cases.ts (mutation validators)
    - convex/lib/perm/validators/recruitment.ts (V-PROF validators)
    - convex/lib/derivedCalculations.ts (calculateRecruitmentEndDate)
    - convex/lib/perm/recruitment/isRecruitmentComplete.ts (startDate/subEntries support)
    - src/lib/forms/date-constraints.ts (getMethodDateConstraints)
    - src/components/forms/sections/RecruitmentSection.tsx (conditional UI)
    - src/components/cases/detail/quick-edit/QuickEditFields.tsx (branded types)
decisions:
  - "Use METHOD_CATEGORIES constants (DATE_RANGE_METHODS, SUB_ENTRY_METHODS) for method categorization"
  - "Keep legacy additionalRecruitmentStartDate/EndDate in schema for backward compatibility, remove from UI"
  - "Initialize sub-entry methods with one empty entry when method type changes"
  - "Disable endDate input until startDate is entered for date-range methods"
  - "Use IIFE for conditional rendering in RecruitmentSection to maintain clean JSX"
metrics:
  duration: 1052s
  tasks_completed: 3/3
  tests_added: 11
  tests_passing: 1695+11
  commits: 3
  completed_date: 2026-02-08
---

# Feature 006: Professional Recruitment Method Dates and Entries Summary

> Extended professional recruitment methods to support per-method date ranges (startDate + endDate) for web/firm-based methods, sub-entries (array of date+description) for radio/TV ads, and retained single date for remaining methods. Removed legacy top-level additionalRecruitmentStartDate/EndDate UI fields. Added V-PROF validation rules and updated all downstream consumers.

## What Was Built

### 1. Extended Type System and Schema (Task 1 - TDD Red Phase)

**New Types:**
- `SubEntry` interface in `src/lib/shared/types.ts`: `{ date: string, description?: string }`
- Extended `AdditionalRecruitmentMethod` with optional `startDate`, `endDate`, `subEntries` fields
- `ProfessionalMethodsInput` for V-PROF validator

**Schema Updates:**
- Convex schema: Added `startDate`, `endDate`, `subEntries` to `additionalRecruitmentMethods` array
- Zod schema: Added `subEntrySchema` and extended `additionalRecruitmentMethodSchema`
- Updated all Convex mutation validators (createCase, updateCase, importCase)

**Method Categorization:**
- Added `METHOD_CATEGORIES` constants in `recruitment-section.constants.ts`:
  - `DATE_RANGE_METHODS`: `['job_website_ad', 'employer_website', 'private_employment_firm']`
  - `SUB_ENTRY_METHODS`: `['radio_ad', 'tv_ad']`
- Added `getMethodCategory()` helper function

**Test Infrastructure:**
- Created `professionalRecruitment.test.ts` with 11 test cases
- All tests initially failing (TDD red phase)

### 2. V-PROF Validators and Backend Logic (Task 2 - TDD Green Phase)

**Validation Rules Implemented:**
- `V-PROF-01`: Date range start must be after PWD determination date
- `V-PROF-02`: Date range start cannot be after end date
- `V-PROF-03`: Date range end must be before recruitment window close
- `V-PROF-04`: Date range end cannot be before start (same as V-PROF-02 from opposite perspective)
- `V-PROF-05`: Sub-entries date must be within recruitment window

**Backend Updates:**
- `calculateRecruitmentEndDate()` in `derivedCalculations.ts`:
  - Now considers `method.endDate` (or `startDate` if no `endDate`)
  - Includes all `subEntries[].date` values in max date calculation
- `isRecruitmentComplete()` in `isRecruitmentComplete.ts`:
  - Recognizes methods with `startDate` or `subEntries` as having dates
  - Filter: `m.method && (m.date || m.startDate || (m.subEntries && m.subEntries.length > 0))`
- `getMethodDateConstraints()` in `date-constraints.ts`:
  - Returns constraints based on method category
  - Date-range: separate constraints for `startDate` and `endDate` (endDate min = startDate + 1)
  - Sub-entries: single constraint for `entryDate`
  - Single-date: same as legacy `additionalRecruitmentStartDate`

### 3. SubEntriesManager Component and UI Updates (Task 3)

**New Component:**
- `SubEntriesManager.tsx`: Manages array of sub-entries (date + description pairs)
- Features:
  - Add/remove entries (max 10)
  - Per-entry date and description inputs
  - Date constraints applied to all entries
  - Delete button for entries > 1

**RecruitmentSection Updates:**
- Conditional rendering based on `getMethodCategory()`:
  - **Date-range methods**: Show `startDate` + `endDate` inputs (3-column grid)
  - **Sub-entry methods**: Show `SubEntriesManager` + overall description input
  - **Single-date methods**: Show single `date` + `description` inputs (2-column grid)
- `handleMethodTypeChange()`: Clears incompatible date fields when method category changes
- Removed legacy "Additional Recruitment Period (Optional)" section (UI only, schema kept)
- Per-method date constraints calculated inline using `getMethodDateConstraints()`

**QuickEditFields Fix:**
- Added branded type casts for `startDate`, `endDate`, and `subEntries[].date`

## Deviations from Plan

**None** - Plan executed exactly as written.

All tasks completed successfully:
1. Task 1: Types, schema, constants, and V-PROF tests (TDD red) ✅
2. Task 2: V-PROF validator implementation and backend updates (TDD green) ✅
3. Task 3: SubEntriesManager component and RecruitmentSection UI updates ✅

## Technical Implementation Details

### Method Category Logic
```typescript
// Example: job_website_ad
const category = getMethodCategory('job_website_ad'); // 'date-range'
const constraints = getMethodDateConstraints(values, category, method.startDate);
// Returns: { startDate: { min, max, hint }, endDate: { min, max, hint } }
```

### V-PROF Validation Flow
1. Parse input dates and determine recruitment window max date
2. For date-range methods: validate `startDate > pwdDetDate` and `endDate <= maxRecruitmentDate`
3. For sub-entry methods: validate each `subEntries[].date` is within window
4. Single-date methods are NOT validated by V-PROF (handled by existing validators)

### Derived Date Calculation
```typescript
// calculateRecruitmentEndDate now considers:
if (method.date) dates.push(method.date);                    // existing
if (method.endDate) dates.push(method.endDate);              // NEW
else if (method.startDate) dates.push(method.startDate);     // NEW
if (method.subEntries) {
  method.subEntries.forEach(e => dates.push(e.date));        // NEW
}
```

### Recruitment Completion Check
```typescript
// isRecruitmentComplete now recognizes:
const methodsWithDates = methods.filter(m =>
  m.method && (
    m.date ||                                     // existing
    m.startDate ||                                // NEW
    (m.subEntries && m.subEntries.length > 0)    // NEW
  )
);
```

## Testing

### Test Results
- V-PROF tests: 11/11 passing ✅
- Fast test suite: 1695 passing (no regressions) ✅
- TypeScript compilation: Clean ✅

### Test Coverage
- V-PROF-01: startDate before PWD determination date
- V-PROF-02: startDate after endDate
- V-PROF-03: endDate exceeds recruitment window
- V-PROF-04: endDate before startDate (from endDate field perspective)
- V-PROF-05: sub-entry date outside recruitment window (before PWD + beyond window)
- Edge cases: empty methods array, method with no dates

### Known Flaky Test
- `src/lib/__tests__/toast.test.ts` - Known flaky test (passes in isolation, documented in MEMORY.md)

## Files Modified/Created

### Created (3 files)
1. `src/lib/shared/types.ts` - SubEntry interface
2. `src/components/forms/sections/SubEntriesManager.tsx` - Sub-entry manager component
3. `convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` - V-PROF test suite

### Modified (12 files)
1. `src/lib/shared/types.ts` - Extended AdditionalRecruitmentMethod
2. `convex/schema.ts` - Added per-method date fields
3. `src/lib/forms/case-form-schema.ts` - Updated Zod schema + CrossValidationData
4. `src/components/forms/sections/recruitment-section.constants.ts` - Added METHOD_CATEGORIES
5. `convex/cases.ts` - Updated mutation validators (3 occurrences)
6. `convex/lib/perm/validators/recruitment.ts` - Implemented V-PROF validators
7. `convex/lib/derivedCalculations.ts` - Updated calculateRecruitmentEndDate
8. `convex/lib/perm/recruitment/isRecruitmentComplete.ts` - Extended AdditionalMethod interface + filter logic
9. `src/lib/forms/date-constraints.ts` - Added getMethodDateConstraints
10. `src/components/forms/sections/RecruitmentSection.tsx` - Conditional rendering + method type change handler
11. `src/components/cases/detail/quick-edit/QuickEditFields.tsx` - Branded type casts
12. `src/hooks/useDateFieldValidation.ts` - No changes needed (per-method validation in Zod)

## Commits

1. **test(feature-006)**: Add V-PROF validation tests and extend types/schema for method-level dates [2bd932c]
   - Extended types, schema, constants
   - Created V-PROF test file (TDD red phase)
   - All tests compile and fail as expected

2. **feat(feature-006)**: Implement V-PROF validators and update backend date calculations [01dcde2]
   - Implemented validateProfessionalMethods (V-PROF-01 to V-PROF-05)
   - All 11 V-PROF tests pass (TDD green phase)
   - Updated backend date calculations and completion checks

3. **feat(feature-006)**: Add SubEntriesManager component and update RecruitmentSection with method-type-aware date inputs [7a7c8cd]
   - Created SubEntriesManager component
   - Conditional rendering in RecruitmentSection
   - Method type change handler
   - Removed legacy UI section

## Impact Assessment

### Backward Compatibility
- ✅ Existing cases with only `date` field on methods continue to work
- ✅ Legacy `additionalRecruitmentStartDate`/`EndDate` fields kept in schema
- ✅ UI gracefully handles methods without new date fields
- ✅ All existing 1695 tests pass with no regressions

### User Experience
- ✅ Date-range methods now show intuitive start/end date inputs
- ✅ Radio/TV ads support multiple air dates with descriptions
- ✅ Single-date methods unchanged (familiar UX)
- ✅ Method type change automatically clears incompatible date fields
- ✅ Per-method date constraints provide accurate min/max guidance

### Developer Experience
- ✅ Method categorization logic centralized in constants
- ✅ V-PROF validators follow existing validation patterns
- ✅ Conditional rendering uses clean IIFE pattern
- ✅ All types compile with strict TypeScript mode
- ✅ TDD approach ensures correctness before implementation

## Migration Notes

### For Future Data Migration
When ready to remove legacy fields:
1. Create migration script to move `additionalRecruitmentStartDate`/`EndDate` to method-level dates
2. Remove deprecated fields from schema
3. Remove deprecation comments

### For Users
- Existing cases: No action required (backward compatible)
- New cases: Use method-level dates (legacy fields no longer shown in UI)
- Date-range methods: Enter start and end dates for posting period
- Radio/TV ads: Add multiple entries for each spot/placement

## Self-Check: PASSED

**Files created:**
- FOUND: src/lib/shared/types.ts (SubEntry interface added)
- FOUND: src/components/forms/sections/SubEntriesManager.tsx
- FOUND: convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts

**Commits exist:**
- FOUND: 2bd932c (test: V-PROF tests + types/schema)
- FOUND: 01dcde2 (feat: V-PROF validators + backend)
- FOUND: 7a7c8cd (feat: SubEntriesManager + UI)

**Tests passing:**
- V-PROF tests: 11/11 ✅
- Fast test suite: 1695 passing ✅
- TypeScript compilation: Clean ✅

**Key functionality verified:**
- `getMethodCategory('radio_ad')` returns `'sub-entries'` ✅
- `getMethodCategory('job_website_ad')` returns `'date-range'` ✅
- `getMethodCategory('job_fair')` returns `'single-date'` ✅
- All V-PROF validation rules enforced ✅
- Backend date calculations include new fields ✅
- Recruitment completion recognizes new date types ✅

All checks passed. Feature 006 successfully implemented.
