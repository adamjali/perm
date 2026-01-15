# Phase 24 Plan 05: Scheduled Functions + Push Summary

**Convex crons with deadline reminders, notification cleanup, and push infrastructure using web-push + VAPID**

## Performance

- **Duration:** 70 min
- **Started:** 2025-12-31T13:55:58Z
- **Completed:** 2025-12-31T15:06:39Z
- **Tasks:** 7
- **Files modified:** 11

## Accomplishments
- Convex crons for daily deadline reminders (9 AM EST), hourly cleanup, weekly digest
- Deadline reminder job with deduplication, RFI/RFE support, user preference respect
- Push notification infrastructure with web-push, VAPID keys, service worker
- Push sending action with expired subscription auto-cleanup
- 19 new tests for scheduled job logic (2747 total tests)

## Files Created/Modified
- `v2/convex/crons.ts` - Cron job definitions (daily, hourly, weekly)
- `v2/convex/scheduledJobs.ts` - Cron handler implementations
- `v2/convex/pushNotifications.ts` - Push sending with web-push (Node runtime)
- `v2/convex/pushSubscriptions.ts` - Internal subscription queries/mutations
- `v2/convex/users.ts` - Added savePushSubscription/removePushSubscription mutations
- `v2/convex/schema.ts` - Added pushSubscription field to userProfiles
- `v2/public/sw-push.js` - Service worker for push events
- `v2/src/lib/pushSubscription.ts` - Client-side push subscription helpers
- `v2/.env.local.example` - VAPID key documentation
- `v2/package.json` - Added web-push dependency
- `v2/convex/__tests__/scheduledJobs.test.ts` - 19 tests for scheduled jobs

## Decisions Made
- Used `"use node"` directive for web-push in Convex (Node runtime required)
- Daily reminders at 9 AM EST (14:00 UTC) - matches typical business hours
- Deduplication via composite key `caseId:deadlineType:daysUntilDeadline`
- 90-day retention for read notifications before cleanup
- Push subscription stored as JSON string in userProfiles

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split push logic into separate files**
- **Found during:** Task 6 (Push sending action)
- **Issue:** Original plan put push action in scheduledJobs.ts, but web-push requires Node runtime which conflicts with Convex V8 runtime
- **Fix:** Created dedicated `pushNotifications.ts` with `"use node"` directive, `pushSubscriptions.ts` for internal helpers
- **Files modified:** Created v2/convex/pushNotifications.ts, v2/convex/pushSubscriptions.ts
- **Verification:** Deployment succeeds, types pass
- **Commit:** Included in plan commit

**2. [Rule 2 - Missing Critical] Added structural validation for push subscription**
- **Found during:** Code Review
- **Issue:** savePushSubscription only validated JSON syntax, not required fields (endpoint, keys.p256dh, keys.auth)
- **Fix:** Added validation for required PushSubscription fields with descriptive error messages
- **Files modified:** v2/convex/users.ts
- **Verification:** Invalid subscriptions now rejected with clear error
- **Commit:** Included in plan commit

**3. [Rule 1 - Bug] Added deletedAt filter to clearPushSubscription**
- **Found during:** Code Review
- **Issue:** clearPushSubscription didn't filter by deletedAt, inconsistent with other queries
- **Fix:** Added `.filter((q) => q.eq(q.field("deletedAt"), undefined))` to query
- **Files modified:** v2/convex/pushSubscriptions.ts
- **Verification:** Soft-deleted profiles no longer patched
- **Commit:** Included in plan commit

### Deferred Enhancements

Logged to .planning/ISSUES.md for future consideration:
- ISS-018: VAPID configuration at module level without error handling (discovered in Code Review)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug), 1 deferred
**Impact on plan:** All auto-fixes improve security and consistency; no scope creep

## Issues Encountered
- convex-test framework shows "unhandled rejection" errors for scheduled function tests due to `_scheduled_functions` system table writes - this is expected behavior per convex-test documentation; tests pass correctly

## Next Phase Readiness
- Phase 24 (Notifications + Email) is COMPLETE - all 5 plans finished
- Ready for Phase 24.1 (API Documentation) or Phase 25 (Settings)
- Push subscription UI can be added in Phase 25 Settings page

---
*Phase: 24-notifications*
*Completed: 2025-12-31*
