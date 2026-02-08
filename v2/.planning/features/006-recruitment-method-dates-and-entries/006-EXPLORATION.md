# Feature 006: Exploration

**Feature:** Add start/end dates with validation to professional recruitment methods (job website, employer website, private employment firm) + allow additional entries within radio method
**Date:** 2026-02-08

## Current State

### Schema (`convex/schema.ts:306-314`)
Each additional recruitment method has ONE `date` field, no start/end:
```typescript
additionalRecruitmentMethods: v.array(
  v.object({
    method: v.string(),
    date: v.string(),
    description: v.optional(v.string()),
  })
)
```
Also has legacy wrapper dates:
- `additionalRecruitmentStartDate` / `additionalRecruitmentEndDate` (optional, used for the overall additional recruitment period)

### Type (`src/lib/shared/types.ts:137-144`)
```typescript
export interface AdditionalRecruitmentMethod {
  method: string;
  date: string;
  description?: string;
}
```

### Available Methods (`recruitment-section.constants.ts:79-91`)
11 options including: `job_website_ad`, `employer_website`, `private_employment_firm`, `radio_ad`, `local_newspaper`, `tv_ad`, `job_fair`, `campus_placement`, `trade_organization`, `employee_referral`, `on_campus_recruitment`

### UI (`RecruitmentSection.tsx:588-796`)
- Professional checkbox triggers AnimatePresence expansion
- Shows 1-3 method cards, each with: Method dropdown, single Date, optional Description
- Add/Remove buttons, max 3, duplicate prevention in dropdown
- Warning badge shows X/3 methods selected
- Below the methods: separate "Additional Recruitment Period" section with standalone start/end dates

### Validators (`convex/lib/perm/validators/recruitment.ts`)
- V-REC-01 through V-REC-12 cover standard recruitment (Sunday ads, job order, notice of filing)
- **NO validators for individual additional recruitment method dates**

### Derived Calculations (`convex/lib/derivedCalculations.ts:142-183`)
- `calculateRecruitmentEndDate` uses `method.date` as an end-date proxy
- Also includes `additionalRecruitmentEndDate` legacy field

### Date Constraints (`src/lib/forms/date-constraints.ts:295-315`)
- `getProfessionalDateConstraints()` constrains the legacy start/end dates
- Min: after PWD determination date
- Max: min(recruitmentStart + 150 days, pwdExpiration - 30 days)

## Similar Features (Date Range Patterns)

### Notice of Filing (Auto-calculated end)
- Schema: `noticeOfFilingStartDate` / `noticeOfFilingEndDate`
- Cascade: start → end (+10 business days), extendOnly
- Validators: V-REC-06 through V-REC-11

### Job Order (Suggested end, editable)
- Schema: `jobOrderStartDate` / `jobOrderEndDate`
- Cascade: start → end (+30 days), extendOnly
- Validators: V-REC-04, V-REC-05, V-REC-12

### RFI/RFE (Multiple entries pattern)
- Schema: array of entry objects with dates
- UI: `RFIEntryList.tsx` + `RFIEntry.tsx` using `useFieldArray`
- Features: add/remove, one active at a time, auto-sort, AnimatePresence

## Key Files to Examine

| Category | File | Lines |
|----------|------|-------|
| Schema | `convex/schema.ts` | 306-328 |
| Types | `src/lib/shared/types.ts` | 137-144 |
| Constants | `src/components/forms/sections/recruitment-section.constants.ts` | 79-91 |
| UI Form | `src/components/forms/sections/RecruitmentSection.tsx` | 220-264, 588-796 |
| Validators | `convex/lib/perm/validators/recruitment.ts` | Full file |
| Derived Calc | `convex/lib/derivedCalculations.ts` | 142-183 |
| Date Constraints | `src/lib/forms/date-constraints.ts` | 295-315 |
| Cascade | `convex/lib/perm/cascade.ts` | 23-50 |
| Mutations | `convex/cases.ts` | 224-232, 684-692 |
| Completion Check | `convex/lib/perm/recruitment/isRecruitmentComplete.ts` | 143-159 |
| RFI Pattern | `src/components/forms/sections/RFIEntryList.tsx` | Full file |

## Integration Points

1. **Schema** — Extend `additionalRecruitmentMethods` array object with `startDate`/`endDate`, add `subEntries` for radio
2. **Type** — Update `AdditionalRecruitmentMethod` interface
3. **Validators** — Add V-REC-13+ rules for method-level date range validation
4. **Derived Calculations** — Use `endDate` (if present) instead of `date` for recruitment end calculation
5. **UI** — Conditionally render start/end for certain methods, sub-entries for radio
6. **Date Constraints** — Extend `getProfessionalDateConstraints` for per-method constraints
7. **Mutations** — Update create/update mutation validators
8. **isRecruitmentComplete** — Update to check startDate+endDate presence
