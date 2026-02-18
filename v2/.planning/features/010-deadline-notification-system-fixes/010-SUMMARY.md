# Feature 010: Summary

**Feature:** Deadline Notification System Fixes
**Date:** 2026-02-14
**Status:** Complete

## What Was Built

Fixed 4 bugs in the deadline notification system and added comprehensive tests.

## Changes

### 1. Add filing_window_closes to DeadlineNotificationType
**Commits:** `193b679`

| File | Change |
|------|--------|
| `convex/lib/notificationHelpers.ts` | Added `"filing_window_closes"` to union + `formatDeadlineType` case |
| `convex/scheduledJobs.ts:308` | Fixed notification type from `"filing_window_opens"` to `"filing_window_closes"` |
| `convex/deadlineEnforcement.ts:90` | Fixed `filing_window_missed` mapping to `"filing_window_closes"` |

**Root cause:** `DeadlineNotificationType` was missing `"filing_window_closes"`, forcing code to incorrectly use `"filing_window_opens"` when notifying about filing window closures.

### 2. Centralize weekly digest supersession checks
**Commits:** `cf7ab6a`

| File | Change |
|------|--------|
| `convex/scheduledJobs.ts` | `getDeadlinesForDigest` now uses `shouldRemindForDeadline()` instead of inline checks |

**Root cause:** DRY violation — digest had inline supersession checks that were missing the `eta9089CertificationDate` guard for I-140 deadlines. Now uses the centralized `shouldRemindForDeadline()` which wraps `isDeadlineActive()`.

### 3. Delete getUpcomingDeadlinesForUser dead code
**Commits:** `bdd67f1`

| File | Change |
|------|--------|
| `convex/scheduledJobs.ts` | Deleted ~90 lines of dead code |
| `convex/__tests__/scheduledJobs.test.ts` | Removed test block |
| `docs/API.md` | Removed API reference |

**Root cause:** Function had zero production callers, was replaced by `getDeadlinesForDigest`, and had zero supersession checks.

### 4. Add email guard for deleted users
**Commits:** `e81e3e2`

| File | Change |
|------|--------|
| `convex/notifications.ts` | Added `isNotificationValid` and `isUserActiveByEmail` internal queries |
| `convex/notificationActions.ts` | `sendNotificationEmail` checks notification exists before sending |
| `convex/notificationActions.ts` | `sendWeeklyDigestEmail` checks user exists before sending |

**Root cause:** `ctx.scheduler.runAfter()` creates persistent scheduled functions that survive user deletion. The email actions now guard against sending to deleted users.

### 5. Tests
**Commits:** `9799e49`

| File | Tests Added |
|------|-------------|
| `convex/__tests__/scheduledJobs.test.ts` | 9 new tests for `getDeadlinesForDigest` supersession |
| `convex/notifications.test.ts` | 5 new tests for email guard queries |

## Test Results

- **scheduledJobs.test.ts:** 35 tests (9 new) - all pass
- **notifications.test.ts:** 67 tests (5 new) - all pass
- **Total new tests:** 14

## Deployed

- Pushed to main: `9799e49`
- Convex production deployed: `https://[convex-prod].convex.cloud`
