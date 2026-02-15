# Feature 010: Clarifications

**Feature:** Deadline Notification System Fixes
**Date:** 2026-02-14

## Questions & Answers

### Approach
**Q:** How to handle the fixes?
**A:** Do all fixes — type system, labels, supersession centralization, dead code removal, email guards. Keep it simple, DRY, KISS, YAGNI, SOLID. Industry standard best practices. No leftover dead/stale code.

### Email 9 AM Claim
**Q:** User claims sjsoltau got email at 9 AM today about filing window opens for Ull LLC case.
**A:** DB shows ZERO notifications for this user in last 7 days. Supersession correctly blocks it (eta9089FilingDate set). Most likely a Google Calendar notification (calendar sync logs show activity for this case today). Need user to forward actual email to confirm source.

### Scope
**Q:** Implementation scope?
**A:** All bugs, all improvements, thorough tests, proper logic. Refactor as needed. Delete dead code. Consolidate. Central source of truth throughout.

## Implications

- Delete `getUpcomingDeadlinesForUser` (dead code with bugs)
- Refactor `getDeadlinesForDigest` to use `shouldRemindForDeadline()`
- Add `"filing_window_closes"` to `DeadlineNotificationType` + all formatters
- Fix `scheduledJobs.ts:308` label
- Fix `deadlineEnforcement.ts:90` mapping
- Add email guards to all 6 email actions in notificationActions.ts
- Update/add tests throughout
