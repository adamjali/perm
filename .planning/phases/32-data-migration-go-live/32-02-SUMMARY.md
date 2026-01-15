# Phase 32 Plan 02: v2 Calendar Sync Fixes Summary

**Auto-cleanup on preference toggle, "Clear All Events" button, disconnect cleanup, and progress bar improvements**

## Performance

- **Duration:** 36 min
- **Started:** 2026-01-12T16:11:30Z
- **Completed:** 2026-01-12T22:47:21Z
- **Tasks:** 4 (+ 2 bug fixes discovered during verification)
- **Files modified:** 6

## Accomplishments

- Auto-cleanup when toggling OFF a calendar sync preference (deletes events of that type from Google Calendar)
- "Clear All Calendar Events" button with amber styling and confirmation
- Disconnect flow now clears all events before disconnecting
- Progress bars show estimated "X of Y cases" with elapsed/remaining time
- Fixed userId extraction bug in disconnect (was using wrong array index)
- Improved dark mode styling for all calendar action buttons

## Files Created/Modified

- `v2/convex/calendar.ts` - Added `updateCalendarSyncPreference` mutation, `disconnectGoogleCalendarWithCleanup` mutation, preference-to-schema field mappings
- `v2/convex/googleCalendarActions.ts` - Added `bulkDeleteEventsByType` internal action, `clearAllCalendarEvents` internal action, `clearAllEvents` public action
- `v2/convex/googleCalendarSync.ts` - Added `getCasesWithCalendarEvents` internal query
- `v2/convex/googleAuth.ts` - Fixed userId extraction (`[0]` instead of `[1]`)
- `v2/convex/cases.ts` - Added `getCasesWithEventsCount` query for Clear All progress
- `v2/src/components/settings/CalendarSyncSection.tsx` - Added Clear All button, improved progress bars with x/y estimates, fixed dark mode button styling

## Decisions Made

- Use estimated progress based on elapsed time and case count (Convex actions don't support streaming)
- ~150ms per case for sync, ~200ms per event for clear (rate limiting + API time)
- Progress bars cap at 95% until completion (prevents misleading 100% before done)
- Preference-to-schema field mapping handles multiple event types per preference (e.g., calendarSyncEta9089 maps to both eta9089_filing_window and eta9089_expiration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed userId extraction in disconnectWithRevocation**
- **Found during:** Human verification (disconnect was failing)
- **Issue:** `identity.subject.split("|")[1]` was getting wrong ID - authSessions ID instead of users ID
- **Fix:** Changed to `[0]` to get primary user ID (first element)
- **Files modified:** v2/convex/googleAuth.ts
- **Verification:** Disconnect now works correctly

**2. [Rule 2 - Missing Critical] Added progress bar improvements**
- **Found during:** Human verification (user requested real progress)
- **Issue:** Progress bars were indeterminate, didn't show actual x/y progress
- **Fix:** Added estimated progress calculation, elapsed/remaining time, case/event counts
- **Files modified:** v2/src/components/settings/CalendarSyncSection.tsx
- **Verification:** Progress now shows "X of Y cases" with time estimates

**3. [Rule 2 - Missing Critical] Fixed dark mode button styling**
- **Found during:** Human verification (buttons looked inconsistent)
- **Issue:** Disconnect, Sync All, Clear All buttons had poor dark mode styling
- **Fix:** Updated all three buttons with consistent border, bg, and hover colors for both modes
- **Files modified:** v2/src/components/settings/CalendarSyncSection.tsx
- **Verification:** All buttons now look consistent in light and dark mode

### Deferred Enhancements

None - all issues were fixed inline.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical)
**Impact on plan:** All fixes were necessary for correct operation. No scope creep.

## Issues Encountered

- Stale `.next` build causing MODULE_NOT_FOUND errors during testing (user needed to restart dev server)

## Next Phase Readiness

- Calendar sync cleanup is complete and verified
- Ready for 32-03-PLAN.md (Data Migration Execution & Verification)

---
*Phase: 32-data-migration-go-live*
*Completed: 2026-01-12*
