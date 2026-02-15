---
status: diagnosed
trigger: "Phantom 'Filing Window Opens' email sent for Ull LLC case despite eta9089FilingDate being set 3 days prior"
created: 2026-02-14T20:00:00Z
updated: 2026-02-14T21:00:00Z
---

## Current Focus

hypothesis: FINAL -- The code's supersession logic was correct and should have blocked the email. No code-level bug found. Most likely explanation is a Convex platform-level issue (scheduler retry, deployment hiccup, or transient function execution anomaly) that cannot be reproduced or verified due to purged _scheduled_functions logs.
test: Complete -- all code paths traced, all hypotheses tested
expecting: N/A
next_action: Document answers to user's 3 questions

## Symptoms

expected: No "Filing Window Opens" email should be sent because eta9089FilingDate was set on Feb 11, which means the filing_window_closes deadline is superseded (filing already happened).
actual: Email was sent on Feb 14 with "7 DAYS REMAINING" (Feb 21 - Feb 14 = 7 days until filingWindowCloses).
errors: No errors reported -- the email was sent "successfully" when it shouldn't have been.
reproduction: Cannot reproduce -- this was a one-time occurrence in production on Feb 14, 2026.
started: Feb 14, 2026 ~14:00 UTC (daily cron run)

## Eliminated

- hypothesis: Stale data in Convex
  evidence: Convex has serializable isolation. A 3-day-old write is 100% visible to any query. ctx.runQuery inside an action runs a full transactional query. Per docs: "All database reads inside a single query call are performed at the same logical timestamp."
  timestamp: 2026-02-14T20:05:00Z

- hypothesis: Wrong supersession type passed to shouldRemindForDeadline
  evidence: Code at 25283d9 passes "filing_window_closes" to shouldRemindForDeadline, which calls isDeadlineActive("filing_window_closes", ...) which hits checkFilingWindowActive() which checks eta9089FilingDate. Correct at every version since initial commit.
  timestamp: 2026-02-14T20:10:00Z

- hypothesis: Another code path sent the email
  evidence: Only sendDeadlineReminderEmail in notificationActions.ts produces the "X DAYS REMAINING" format. Only checkDeadlineReminders calls it. Weekly digest uses WeeklyDigest template and Feb 14 is Saturday (digest runs Monday). Deadline enforcement only sends auto-closure emails.
  timestamp: 2026-02-14T20:10:00Z

- hypothesis: Field cleared by mutation between Feb 11 and Feb 14
  evidence: No mutation touches eta9089FilingDate except explicit user updates. Audit log shows no changes between Feb 11 and Feb 14.
  timestamp: 2026-02-14T20:10:00Z

- hypothesis: Convex ctx.runQuery() inside action has consistency edge cases
  evidence: Per Convex docs, a single ctx.runQuery is fully transactional with serializable isolation. The concern would only arise with MULTIPLE separate ctx.runQuery calls, but getCasesNeedingReminders is a SINGLE query reading all data atomically.
  timestamp: 2026-02-14T20:20:00Z

- hypothesis: Dedup key naming ("filing_window_opens") caused dedup miss
  evidence: The dedup key uses notification type "filing_window_opens" CONSISTENTLY -- both when creating notifications and when building the existingKeys set. More importantly, supersession check runs BEFORE dedup check, so even if dedup failed, supersession would block the email.
  timestamp: 2026-02-14T20:25:00Z

- hypothesis: Email was scheduled by a PREVIOUS cron (before Feb 11) with different daysUntil
  evidence: Email content says "7 DAYS REMAINING" which corresponds to daysUntil=7 (Feb 21 - Feb 14 = 7). The last pre-Feb-11 cron that would match reminder days was Feb 7 with daysUntil=14. A Feb 7 scheduled email would say "14 DAYS REMAINING", not "7". The daysUntil value is passed as an argument to the scheduled function and baked into the email.
  timestamp: 2026-02-14T20:30:00Z

- hypothesis: Different version of code deployed to production
  evidence: Supersession checks have existed in scheduledJobs.ts since the initial commit (52fbe6b). Every version ever deployed has `shouldRemindForDeadline("filing_window_closes", caseDataForDeadlines)` guarding the filing window check. No version of the code lacks this guard.
  timestamp: 2026-02-14T20:35:00Z

## Evidence

- timestamp: 2026-02-14T20:05:00Z
  checked: isDeadlineActive.ts at commit 25283d9 -- checkFilingWindowActive()
  found: Returns { isActive: false, supersededReason: "ETA 9089 has been filed" } when caseData.eta9089FilingDate is truthy. Covers filing_window_opens, filing_window_closes, and recruitment_window_closes.
  implication: Supersession logic is correct and comprehensive.

- timestamp: 2026-02-14T20:07:00Z
  checked: scheduledJobs.ts getCasesNeedingReminders at commit 25283d9 (lines 287-309)
  found: caseDataForDeadlines is built with direct field mapping: `eta9089FilingDate: caseDoc.eta9089FilingDate`. No transformation, no filtering. Then `shouldRemindForDeadline("filing_window_closes", caseDataForDeadlines)` gates the checkDeadline call.
  implication: Supersession guard is in the right place, uses the right type, and passes through the field correctly.

- timestamp: 2026-02-14T20:10:00Z
  checked: Dedup key construction in getCasesNeedingReminders
  found: Key format: `${caseDoc._id}:${deadlineType}:${daysUntil}` where deadlineType is "filing_window_opens" (notification type, not deadline type). Both creation and lookup use the same type consistently.
  implication: Dedup naming is cosmetically wrong but functionally consistent. Cannot cause dedup miss.

- timestamp: 2026-02-14T20:12:00Z
  checked: notifications.ts deleteNotification at commit 25283d9
  found: Hard delete via ctx.db.delete(). Removes notification record permanently. Dedup check queries all existing "deadline_reminder" notifications to build existingKeys set.
  implication: Notification deletion removes dedup protection. BUT supersession check runs FIRST, so dedup gap is irrelevant when supersession blocks.

- timestamp: 2026-02-14T20:15:00Z
  checked: checkDeadlineReminders action flow
  found: Flow is: (1) ctx.runQuery(getCasesNeedingReminders) returns filtered list, (2) for each: createNotification mutation, (3) ctx.scheduler.runAfter(delay, sendDeadlineReminderEmail, args). Email is fire-and-forget once scheduled.
  implication: Once scheduled, email sends regardless of subsequent changes. But the scheduling only happens if getCasesNeedingReminders returns the reminder.

- timestamp: 2026-02-14T20:18:00Z
  checked: Execution order of guards
  found: shouldRemindForDeadline is called BEFORE checkDeadline. If it returns false, checkDeadline is NEVER called, and no reminder enters the array. The dedup check inside checkDeadline is secondary protection.
  implication: Supersession is the primary gate. Even total dedup failure cannot bypass supersession.

- timestamp: 2026-02-14T20:20:00Z
  checked: Convex consistency model (docs + web search)
  found: "All database reads inside a single query call are performed at the same logical timestamp" with serializable isolation and automatic OCC retries. No caching, no eventual consistency. A single ctx.runQuery is fully ACID.
  implication: The query definitively sees eta9089FilingDate as "2026-02-10" when it reads the case document.

- timestamp: 2026-02-14T20:25:00Z
  checked: Timeline analysis -- which cron runs match reminder days
  found: Feb 7 cron: daysUntil=14 (in reminder list, before eta9089FilingDate set). Feb 14 cron: daysUntil=7 (in reminder list, after eta9089FilingDate set). No other dates between Feb 5-14 match reminder days for this deadline.
  implication: Email says "7 DAYS REMAINING" which can only be generated on Feb 14. Cannot be a delayed Feb 7 email (that would say "14 DAYS REMAINING").

- timestamp: 2026-02-14T20:30:00Z
  checked: sendDeadlineReminderEmail action (notificationActions.ts at commit 25283d9)
  found: Takes args (employerName, deadlineType, deadlineDate, daysUntil, etc.) and renders email template. Does NOT re-check database for supersession. Once scheduled with specific args, sends exactly those args.
  implication: No re-validation at send time. The only guard is at scheduling time (getCasesNeedingReminders). Feature 010 later added a deletion guard (isNotificationValid) but NOT a supersession re-check.

- timestamp: 2026-02-14T20:35:00Z
  checked: Git history of supersession in scheduledJobs.ts
  found: shouldRemindForDeadline("filing_window_closes", ...) has existed since the initial commit (52fbe6b). Every version ever deployed has this guard. No version lacks it.
  implication: Cannot be a code version issue. The guard was always present.

- timestamp: 2026-02-14T20:40:00Z
  checked: Convex scheduler stagger delay
  found: Email stagger is only emailIndex * 600ms. Even with 100 emails, max delay is 60 seconds. Cannot explain multi-day delay.
  implication: Scheduler delay mechanism cannot cause the email to arrive days late.

## Resolution

root_cause: INCONCLUSIVE WITH HIGH CONFIDENCE IN CODE CORRECTNESS

After exhaustive analysis of the code at commit 25283d9 (the version running when the cron fired on Feb 14 at 14:00 UTC), no code-level bug was found that could explain the phantom email. The supersession logic was correct at every version of the code since the initial commit.

The investigation definitively established:
1. shouldRemindForDeadline("filing_window_closes", ...) correctly checks eta9089FilingDate
2. The check runs BEFORE any dedup logic (primary gate)
3. caseDataForDeadlines correctly maps eta9089FilingDate from the case document
4. Convex queries have serializable isolation (no stale reads possible)
5. The email content ("7 DAYS REMAINING") can only be generated on Feb 14
6. No alternate code path could produce this email
7. Every deployed version has had this supersession guard

REMAINING EXPLANATIONS (unfalsifiable without platform logs):
1. Convex platform anomaly -- a transient issue in function execution (e.g., scheduler executing a stale/cached version of the function code during a deployment transition)
2. Convex scheduler retry -- if the Feb 14 scheduled function failed and was retried in a way that bypassed the normal flow
3. A very rare race condition at the Convex platform level that is outside application code control

fix: N/A (investigation only mode)
verification: N/A
files_changed: []

---

## Answers to User's 3 Questions

### Question 1: Explain "notification created and deleted"

**VERIFIED CORRECT.** The exact flow at commit 25283d9:

1. `checkDeadlineReminders` (internalAction) calls `ctx.runQuery(getCasesNeedingReminders)` -- this returns filtered reminders (supersession + dedup checked)

2. For each reminder, the action calls:
   - `ctx.runMutation(createNotification)` -- inserts notification into DB with deadlineType, daysUntilDeadline, etc.
   - `ctx.scheduler.runAfter(delayMs, sendDeadlineReminderEmail, { notificationId, to, employerName, ... })` -- schedules the email as a separate Convex function

3. The email function (`sendDeadlineReminderEmail`) is scheduled as an independent Convex job. It receives all email content as ARGUMENTS (not by reading the DB). In the OLD code (25283d9), it does NOT re-check the database before sending.

4. Meanwhile, the user can delete the notification from the UI via `deleteNotification` mutation, which does a hard delete: `ctx.db.delete(notificationId)`.

5. The scheduled email function fires regardless. In the old code, `sendNotificationEmail` does not verify the notification still exists. It simply renders the template from its arguments and sends via Resend.

**The key insight:** `ctx.scheduler.runAfter()` creates a fire-and-forget job. Deleting the notification has NO effect on whether the email sends. The email was already "locked in" at scheduling time.

**Feature 010 fix (commit e81e3e2) addressed this for a different scenario:** It added an `isNotificationValid` check before sending, but this guards against deleted USERS (account deletion), not superseded deadlines. A supersession re-check at email send time was NOT added.

**Relevant code locations:**
- `/Users/dev/cc/perm-tracker/v2/convex/scheduledJobs.ts` (checkDeadlineReminders action, lines ~401-530 at old commit)
- `/Users/dev/cc/perm-tracker/v2/convex/notificationActions.ts` (sendDeadlineReminderEmail, lines ~164-200)
- `/Users/dev/cc/perm-tracker/v2/convex/notifications.ts` (deleteNotification at line ~518)

### Question 2: Could the filing_window_opens naming have caused the issue?

**NO.** The naming could NOT have caused this issue. Here is the thorough trace:

**At commit 25283d9, the code is:**
```typescript
// Line 306-308 in getCasesNeedingReminders:
if (shouldRemindForDeadline("filing_window_closes", caseDataForDeadlines)) {
  checkDeadline(caseDoc.filingWindowCloses, "filing_window_opens", "filing_window_closes");
}
```

The three-argument `checkDeadline(date, notificationType, tzDeadlineType)` call uses:
- `"filing_window_opens"` as the NOTIFICATION type (stored in DB, used in dedup key, used as email label)
- `"filing_window_closes"` as the DEADLINE type (used for timezone-aware daysUntil calculation)

**Why the naming is NOT the cause:**

1. **Supersession runs FIRST:** `shouldRemindForDeadline("filing_window_closes", ...)` is called BEFORE `checkDeadline`. If supersession blocks (eta9089FilingDate is set), `checkDeadline` is NEVER called. The notification type name is completely irrelevant because we never reach the code that uses it.

2. **Dedup is internally consistent:** The dedup key is `${caseId}:filing_window_opens:${daysUntil}`. The existingKeys set is built from `notif.deadlineType` which also stores `"filing_window_opens"`. Both sides use the same string, so dedup works correctly.

3. **Impact is cosmetic only:** The naming means the notification record has `deadlineType: "filing_window_opens"` and the email says "Filing Window Opens" instead of "Filing Window Closes". This is a labeling bug (fixed by commit 193b679), not a logic bug.

**What the Feature 010 fix (commit 193b679) actually changed:**
- Changed `checkDeadline(caseDoc.filingWindowCloses, "filing_window_opens", "filing_window_closes")` to `checkDeadline(caseDoc.filingWindowCloses, "filing_window_closes", "filing_window_closes")`
- Added `"filing_window_closes"` to `DeadlineNotificationType` union
- Added format case for "Filing Window Closes" in `formatDeadlineType()`
- This fixes the EMAIL LABEL and DEDUP KEY to say "filing_window_closes" instead of "filing_window_opens" -- purely cosmetic/correctness, not a logic fix

### Question 3: Convex edge cases with ctx.runQuery() inside actions

**NO consistency edge cases for this scenario.** Here is what the research found:

**Convex's consistency guarantees per official documentation:**

1. **Single ctx.runQuery = fully transactional:** "All database reads inside a single query call are performed at the same logical timestamp" with serializable isolation. The query sees a perfectly consistent snapshot.

2. **No stale cache:** Convex's caching is deterministic and always 100% consistent. There is no eventually-consistent layer between the action and the query.

3. **ACID within a single query:** The getCasesNeedingReminders query reads multiple tables (userProfiles, users, notifications, cases) but ALL reads happen within a SINGLE transactional query. Convex guarantees all reads see the same logical timestamp.

4. **Where inconsistency CAN occur:** Multiple SEPARATE ctx.runQuery/ctx.runMutation calls within the same action can see different snapshots. For example, if `checkDeadlineReminders` called `ctx.runQuery(A)` then `ctx.runQuery(B)`, data could change between A and B. BUT: the getCasesNeedingReminders is a SINGLE query, so this doesn't apply.

5. **Action-level guarantees:** Actions themselves are NOT transactional (unlike mutations). But the individual ctx.runQuery/ctx.runMutation calls within them ARE. The non-transactional nature means: if the action crashes after creating a notification but before scheduling the email, the notification exists without the email being sent. But this creates a MISSING email, not a PHANTOM email.

**Bottom line:** The `ctx.runQuery(internal.scheduledJobs.getCasesNeedingReminders)` call in `checkDeadlineReminders` executes as a single transactional query with serializable isolation. It WILL see eta9089FilingDate = "2026-02-10" because that value was written 3 days prior. There is no consistency edge case in Convex that could cause this single query to return stale data.

**Sources:**
- [Convex Actions Documentation](https://docs.convex.dev/functions/actions)
- [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/)
- [How Convex Works](https://stack.convex.dev/how-convex-works)
- [Convex vs. Relational Databases](https://stack.convex.dev/convex-vs-relational-databases)
