# Phase 19 Plan 01: Core Schema Summary

**Core Convex schema with 3 tables: users (7 fields), userProfiles (45 fields), cases (59 fields) and 10 indexes**

## Performance

- **Duration:** 12 min
- **Started:** 2025-12-23T06:55:55Z
- **Completed:** 2025-12-23T07:08:31Z
- **Tasks:** 3
- **Files modified:** 4 (2 created/modified, 2 deleted)

## Accomplishments
- Extended users table with phone and deletedAt soft-delete fields
- Consolidated userProfiles from v1's 3 tables into 45 fields covering profile, organization, notifications, calendar sync, Google OAuth, UI preferences
- Defined complete cases table with 59 fields covering all PERM stages (PWD, Recruitment, ETA 9089, RFI/RFE, I-140)
- Added 10 indexes for query optimization (user lookups, status filtering, favorites, priorities, soft deletes)
- Removed testItems placeholder table

## Files Created/Modified
- `v2/convex/schema.ts` - Core schema with 3 tables and 10 indexes
- `v2/convex/users.ts` - Updated index names (userId → by_user_id), expanded ensureUserProfile with all ~45 fields

## Files Deleted
- `v2/convex/testData.ts` - Removed (referenced deleted testItems table)
- `v2/convex/testData.test.ts` - Removed (tests for deleted testData module)

## Decisions Made
- Used camelCase for all field names (Convex convention, converted from v1's snake_case)
- Used v.int64() for numeric fields (urgentDeadlineDays, reminderDaysBefore, casesPerPage, pwdWageAmount, recruitmentApplicantsCount) - requires BigInt literals
- ISO date strings (YYYY-MM-DD) for date fields, Unix milliseconds for timestamps
- Currency stored as cents (v.int64) for precision
- v.any() for calendarEventIds (flexible map structure)
- Consolidated userProfiles index naming: by_user_id, by_firm_id, by_deleted_at

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed testData.ts and testData.test.ts**
- **Found during:** Schema verification
- **Issue:** Files referenced removed testItems table, causing TypeScript errors
- **Fix:** Deleted both files completely
- **Files modified:** convex/testData.ts, convex/testData.test.ts (deleted)
- **Verification:** `npx convex dev --once` succeeds
- **Commit:** Included in plan commit

**2. [Rule 3 - Blocking] Fixed userProfiles index naming**
- **Found during:** Schema verification
- **Issue:** users.ts used old index name "userId" instead of new "by_user_id"
- **Fix:** Updated .withIndex() calls to use correct index names
- **Files modified:** convex/users.ts
- **Verification:** TypeScript compiles without errors

**3. [Rule 3 - Blocking] Updated ensureUserProfile to match new schema**
- **Found during:** Schema verification
- **Issue:** Old schema had nested notificationPreferences object, new schema has flat fields
- **Fix:** Expanded insert call with all ~45 fields and correct BigInt literals for v.int64() fields
- **Files modified:** convex/users.ts
- **Verification:** TypeScript compiles, schema deploys successfully

---

**Total deviations:** 3 auto-fixed (all blocking issues)
**Impact on plan:** Necessary fixes for schema change compatibility. No scope creep.

## Issues Encountered
None - all blocking issues resolved during execution.

## Next Phase Readiness
- Core schema tables defined and deployed
- Ready for 19-02-PLAN.md (Supporting schema tables: notifications, refreshTokens, conversations, etc.)

---
*Phase: 19-schema-security*
*Completed: 2025-12-23*
