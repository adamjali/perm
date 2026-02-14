# Feature 010: Exploration

**Feature:** Deadline Notification System Fixes
**Date:** 2026-02-14

## Bugs Identified

### BUG 1: Filing Window Closes labeled as "Filing Window Opens"
- `scheduledJobs.ts:308` passes `"filing_window_opens"` as `DeadlineNotificationType` for the `filing_window_closes` deadline
- Users see "Filing Window Opens in 7 days" when their filing window is about to CLOSE

### BUG 2: `DeadlineNotificationType` missing `"filing_window_closes"`
- `notificationHelpers.ts:47-54` has no `"filing_window_closes"` member
- `formatDeadlineType()` has no case for it
- `digestHelpers.ts` `formatDeadlineType()` also missing it

### BUG 3: `violationTypeToDeadlineType` maps `filing_window_missed` wrong
- `deadlineEnforcement.ts:90` maps `filing_window_missed` → `"filing_window_opens"` instead of `"filing_window_closes"`
- Auto-closure email says "Filing Window Opens" when case was closed because filing window was MISSED

### BUG 4: Weekly digest uses inline supersession instead of centralized
- `scheduledJobs.ts:699-789` (`getDeadlinesForDigest`) has inline `!caseDoc.eta9089FilingDate` checks
- I-140 check at line 762 is missing the `eta9089CertificationDate` guard
- Should use `shouldRemindForDeadline()` like the daily cron does

### BUG 5: `getUpcomingDeadlinesForUser` has NO supersession checks
- `scheduledJobs.ts:849-938` — no calls to `isDeadlineActive()` or `shouldRemindForDeadline()`
- PWD/filing window deadlines show even after ETA 9089 filed
- I-140 deadline entirely missing
- Appears unused in production (dead code) but still dangerous

### BUG 6: Email actions don't verify user exists before sending
- All email-sending actions in `notificationActions.ts` receive pre-resolved email and send directly
- `purgeAllUserData` in `convex/lib/deletion.ts` does NOT cancel scheduled functions
- Race condition: delete user → scheduled email still fires → email sent to deleted user

## Four Deadline Type Systems

| System | File | Context |
|--------|------|---------|
| `DeadlineType` (perm) | `convex/lib/perm/deadlines/types.ts` | Canonical — has `filing_window_closes` |
| `DeadlineNotificationType` | `convex/lib/notificationHelpers.ts` | Notifications — MISSING `filing_window_closes` |
| `DeadlineType` (dashboard) | `convex/lib/dashboardTypes.ts` | Dashboard UI — uses `recruitment_window` |
| `DeadlineType` (calendar) | `src/lib/calendar/types.ts` | Frontend calendar — camelCase |

## Key Files

| File | Purpose |
|------|---------|
| `convex/scheduledJobs.ts` | Daily cron, weekly digest, dead code — 3 bugs here |
| `convex/lib/notificationHelpers.ts` | Type definitions, formatDeadlineType, shouldSendEmail |
| `convex/lib/digestHelpers.ts` | Separate formatDeadlineType for digests |
| `convex/deadlineEnforcement.ts` | Auto-closure flow, violationTypeToDeadlineType mapping |
| `convex/notificationActions.ts` | All email-sending actions — no user-exists guards |
| `convex/lib/deletion.ts` | purgeAllUserData — no scheduled function cancellation |
| `convex/lib/perm/deadlines/isDeadlineActive.ts` | Canonical supersession logic |
| `convex/lib/perm/deadlines/extractActiveDeadlines.ts` | shouldRemindForDeadline |
| `convex/lib/perm/deadlines/types.ts` | CaseDataForDeadlines interface |
| `convex/users.ts` | Account deletion (requestAccountDeletion, immediateAccountDeletion) |
| `convex/admin.ts` | Admin deletion path |

## Deletion Paths (Email Leak Risk)

| Path | File | Cancels Scheduled Emails? |
|------|------|--------------------------|
| requestAccountDeletion (30d grace) | users.ts | NO |
| immediateAccountDeletion | users.ts | NO |
| permanentlyDeleteAccount (after grace) | scheduledJobs.ts | NO |
| processExpiredDeletions (hourly cron) | scheduledJobs.ts | NO |
| deleteUserAdmin | admin.ts | NO |
| purgeUserInternal | admin.ts | NO |

**All paths route through `purgeAllUserData()` which does NOT cancel pending scheduled functions.**

## Supersession Check Matrix

| Location | Uses Centralized? | Gaps |
|----------|-------------------|------|
| extractActiveDeadlines | YES | None |
| shouldRemindForDeadline | YES | None |
| getCasesNeedingReminders (daily cron) | YES | None |
| dashboardHelpers | YES | None |
| chatCaseData | YES | None |
| **getDeadlinesForDigest (weekly)** | **NO — inline** | Missing eta9089CertificationDate for I-140 |
| **getUpcomingDeadlinesForUser** | **NO — none** | Missing ALL supersession checks |
