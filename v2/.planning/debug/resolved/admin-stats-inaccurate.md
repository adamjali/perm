---
status: resolved
trigger: "Admin dashboard stats are not correct/accurate. Login counter specifically never worked (always 0 or wrong). Multiple other stats may also be wrong. Need to audit ALL admin stats for correctness."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - afterUserCreatedOrUpdated callback was never called because Convex Auth skips it when createOrUpdateUser is defined
test: Traced library source code to confirm short-circuit behavior
expecting: Login counter always shows initial value (1 or session count fallback)
next_action: Fix applied and verified

## Symptoms

expected: Admin dashboard should show accurate stats - login counts, user counts, activity metrics, etc.
actual: Login counter doesn't work (never has). Multiple other stats seem inaccurate.
errors: No specific error messages - stats just show wrong values silently.
reproduction: Go to admin dashboard, observe stats. Login counter is always wrong/zero despite users logging in.
started: Login counter has NEVER worked since implementation. Other stats unclear.

## Eliminated

- hypothesis: Stats query logic in getAdminDashboardDataHelper is incorrect
  evidence: Query logic is sound - it reads loginCount/lastLoginAt from profile and falls back to session count. The problem is these fields are never populated.
  timestamp: 2026-02-15

- hypothesis: recordLogin mutation has a bug
  evidence: recordLogin logic is correct (increment loginCount, set lastLoginAt). The mutation itself was never called.
  timestamp: 2026-02-15

- hypothesis: Other aggregate stats (totalUsers, activeUsers, etc.) are broken
  evidence: Audited all 6 grid stats - they are computed correctly from the data model. totalCasesInSystem includes soft-deleted cases and usersWithCases includes all cases, which is reasonable for admin context.
  timestamp: 2026-02-15

## Evidence

- timestamp: 2026-02-15
  checked: AdminStatsGrid.tsx - what stats are displayed
  found: 6 stats on grid: totalUsers, activeUsers, usersWithCases, totalCasesInSystem, pendingDeletion, deletedUsers. Per-user in UsersTable: totalLogins, lastLoginTime.
  implication: Login stats are per-user in UsersTable, not in the grid.

- timestamp: 2026-02-15
  checked: convex/lib/admin.ts - getAdminDashboardDataHelper
  found: Lines 168-170 read loginCount/lastLoginAt from userProfile, falling back to session count.
  implication: Stats depend on profile fields being populated.

- timestamp: 2026-02-15
  checked: convex/users.ts - recordLogin mutation
  found: recordLogin correctly increments loginCount and sets lastLoginAt. It exists and is correctly implemented.
  implication: The mutation works, but needs to actually be called.

- timestamp: 2026-02-15
  checked: convex/auth.ts - where recordLogin was called from
  found: recordLogin was called inside afterUserCreatedOrUpdated callback (line 127). ensureUserProfileInternal was also called there (line 113).
  implication: Both profile creation and login tracking depended on afterUserCreatedOrUpdated firing.

- timestamp: 2026-02-15
  checked: node_modules/@convex-dev/auth/src/server/implementation/users.ts - library source
  found: Lines 58-63 show that when createOrUpdateUser callback is defined, the function RETURNS EARLY, completely skipping lines 146-162 where afterUserCreatedOrUpdated would be called.
  implication: afterUserCreatedOrUpdated has NEVER been called in this app because createOrUpdateUser is always defined.

- timestamp: 2026-02-15
  checked: node_modules/@convex-dev/auth/src/server/types.ts lines 176-178
  found: Documentation explicitly states: "This callback is only called if createOrUpdateUser is not specified."
  implication: This is documented behavior, not a library bug. The app misconfigured the callbacks.

- timestamp: 2026-02-15
  checked: convex/lib/userDefaults.ts - buildDefaultProfile
  found: Initial loginCount was set to 1, which would double-count with recordLogin on first auth event.
  implication: Fixed to 0 so recordLogin handles all counting.

- timestamp: 2026-02-15
  checked: PendingTermsHandler.tsx - safety net for profile creation
  found: Client-side safety net calls ensureUserProfile if profile is null after auth. This is why profiles existed despite afterUserCreatedOrUpdated never firing.
  implication: Profile creation worked via safety net, but recordLogin had no safety net - hence always broken.

## Resolution

root_cause: The Convex Auth library skips the `afterUserCreatedOrUpdated` callback entirely when a custom `createOrUpdateUser` callback is defined. The app defined BOTH callbacks, but only `createOrUpdateUser` ever executed. All login tracking logic (`recordLogin`) and server-side profile creation (`ensureUserProfileInternal`) were placed in the dead `afterUserCreatedOrUpdated` callback. Profile creation survived via a client-side safety net (PendingTermsHandler), but login tracking had no fallback - hence `loginCount` and `lastLoginAt` were never updated after initial profile creation.

fix: Moved profile creation and login tracking into the `createOrUpdateUser` callback via a shared `onAuthEvent()` helper function called at every return point. Removed the dead `afterUserCreatedOrUpdated` callback. Also fixed `buildDefaultProfile` to set `loginCount: 0` (was 1) to prevent double-counting on first auth event.

verification: TypeScript compiles cleanly. All 27 admin tests pass (25 existing + 2 new for loginCount defaults). Full test suite passes with 1972/1974 (2 pre-existing failures in case-form-schema.test.ts confirmed unrelated via git stash test).

files_changed:
  - convex/auth.ts (moved afterUserCreatedOrUpdated logic into createOrUpdateUser via onAuthEvent helper)
  - convex/lib/userDefaults.ts (loginCount default: 1 -> 0)
  - convex/users.ts (updated comment on recordLogin)
  - convex/lib/__tests__/admin.test.ts (added 2 tests for loginCount/lastLoginAt defaults)
  - src/components/auth/PendingTermsHandler.tsx (updated comment reference)
