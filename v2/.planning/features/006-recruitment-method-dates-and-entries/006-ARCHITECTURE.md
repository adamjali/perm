# Feature 006: Architecture

**Feature:** Professional recruitment method dates and additional entries
**Date:** 2026-02-08
**Chosen Approach:** Minimal Changes

## Summary

Extend existing `AdditionalRecruitmentMethod` type/schema with optional `startDate`, `endDate`, and `subEntries` fields. Add method categorization constants (`METHODS_WITH_DATE_RANGES`, `METHODS_WITH_SUB_ENTRIES`). Conditionally render date inputs in `RecruitmentSection.tsx` based on method type. Create one new component: `SubEntriesManager.tsx`. Reuse existing `getProfessionalDateConstraints()` formula. Remove legacy `additionalRecruitmentStartDate/EndDate` fields.

## Method Categories

| Category | Methods | Fields |
|----------|---------|--------|
| Date Range | `job_website_ad`, `employer_website`, `private_employment_firm` | startDate + endDate |
| Sub-Entries | `radio_ad`, `tv_ad` | array of {date, description} sub-entries |
| Single Date | 6 remaining methods | date (unchanged) |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/forms/sections/SubEntriesManager.tsx` | Sub-entry list for radio/TV ads (add/remove, overflow handling) |
| `convex/lib/perm/validators/__tests__/professionalRecruitment.test.ts` | Tests for V-PROF validators |

## Files to Modify

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add optional `startDate`/`endDate`/`subEntries` to method object. Remove `additionalRecruitmentStartDate`/`EndDate` |
| `src/lib/shared/types.ts` | Extend `AdditionalRecruitmentMethod` interface |
| `src/lib/forms/case-form-schema.ts` | Update Zod schema for methods array |
| `src/components/forms/sections/recruitment-section.constants.ts` | Add `METHODS_WITH_DATE_RANGES`, `METHODS_WITH_SUB_ENTRIES` constants |
| `src/components/forms/sections/RecruitmentSection.tsx` | Conditional rendering by method type, remove legacy period section |
| `convex/lib/perm/validators/recruitment.ts` | Add V-PROF-01 through V-PROF-05 rules |
| `convex/lib/derivedCalculations.ts` | Update `calculateRecruitmentEndDate` to use `endDate`/`subEntries` |
| `convex/lib/perm/recruitment/isRecruitmentComplete.ts` | Update completion check for date-range methods |
| `src/lib/forms/date-constraints.ts` | Update `getProfessionalDateConstraints` for per-method constraints |
| `src/hooks/useDateFieldValidation.ts` | Add method-level field dependencies |
| `convex/cases.ts` | Update create/update mutation validators |

## Validation Rules

| Rule | Description |
|------|-------------|
| V-PROF-01 | Date range: start must be after PWDDD |
| V-PROF-02 | Date range: start cannot be after end date |
| V-PROF-03 | Date range: end must be before recruitment window close (min(PWDED, firstRecruitment+150)) |
| V-PROF-04 | Date range: end cannot be before start |
| V-PROF-05 | Sub-entries: date must be within recruitment window |

## Date Constraint Formula (unchanged)

- **Min**: PWDDD + 1 day
- **Max**: min(firstRecruitmentDate + 150 days, pwdExpirationDate - 30 days)
- **End date min**: startDate + 1 day (or PWDDD + 1 if no start)
- **End date disabled**: until startDate is entered

## Trade-offs Accepted

- RecruitmentSection grows to ~950 lines (acceptable — could extract MethodCard later)
- `date` field kept for backward compat alongside `startDate`/`endDate`
- No discriminated union types (runtime string lookup via constants is sufficient for 3 fixed categories)
- Sub-entry overflow UI ("+X more") kept simple with CSS truncation
