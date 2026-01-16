# Phase 16 Plan 02: Date Calculators Summary

**All PERM date calculators implemented with TDD: PWD expiration (3-case logic), recruitment deadlines, ETA 9089 windows, I-140 deadline, RFI due date - 73 calculator tests passing**

## Performance

- **Duration:** 13 min
- **Started:** 2025-12-22T15:29:40Z
- **Completed:** 2025-12-22T15:42:29Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- PWD expiration calculator with 3-case logic per 20 CFR § 656.40(c)
- Recruitment deadline calculators (notice, job order, Sunday ads, recruitment window)
- ETA 9089 window and expiration calculators
- I-140 filing deadline calculator (certification + 180 days)
- RFI due date calculator (strict 30 days per V-RFI-02)
- All calculators use pure functions with ISO string inputs/outputs
- 73 comprehensive tests for calculators alone (123 total)

## Files Created/Modified

- `v2/src/lib/perm-engine/calculators/pwd.ts` - PWD expiration (3-case logic)
- `v2/src/lib/perm-engine/calculators/pwd.test.ts` - 19 tests
- `v2/src/lib/perm-engine/calculators/eta9089.ts` - ETA 9089 window, expiration, recruitment end
- `v2/src/lib/perm-engine/calculators/eta9089.test.ts` - 19 tests
- `v2/src/lib/perm-engine/calculators/recruitment.ts` - All recruitment deadlines
- `v2/src/lib/perm-engine/calculators/recruitment.test.ts` - 21 tests
- `v2/src/lib/perm-engine/calculators/i140.ts` - I-140 filing deadline
- `v2/src/lib/perm-engine/calculators/i140.test.ts` - 6 tests
- `v2/src/lib/perm-engine/calculators/rfi.ts` - RFI due date (strict 30 days)
- `v2/src/lib/perm-engine/calculators/rfi.test.ts` - 8 tests
- `v2/src/lib/perm-engine/calculators/index.ts` - Barrel exports
- `v2/src/lib/perm-engine/index.ts` - Added calculator exports to public API

## Decisions Made

- Used custom `addDaysUTC()` helper in pwd.ts and eta9089.ts to avoid date-fns DST issues with UTC date arithmetic
- All functions accept and return ISO strings (YYYY-MM-DD) for consistency with existing codebase
- lastSundayOnOrBefore helper created for newspaper ad deadline calculations
- Types (RecruitmentDeadlines, ETA9089Window) exported via calculators/index.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD approach caught edge cases early (leap years, year boundaries, month transitions, DST).

## Next Phase Readiness

- All calculators ready for validators (Plan 03)
- Public API exported via `@/lib/perm-engine`:
  - `calculatePWDExpiration`
  - `calculateETA9089Window`, `calculateETA9089Expiration`, `calculateRecruitmentEnd`
  - `calculateRecruitmentDeadlines`, `lastSundayOnOrBefore`, `calculateNoticeOfFilingEnd`, `calculateJobOrderEnd`
  - `calculateI140FilingDeadline`
  - `calculateRFIDueDate`

---
*Phase: 16-deadline-validation-core*
*Completed: 2025-12-22*
