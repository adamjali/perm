# V2 Original Vision

> **Source:** User requirements document (perm_flow.md)
> **Created:** 2025-12-22
> **Status:** Canonical reference for v2.0 implementation

This document captures the original vision for PERM Tracker v2.0. All v2 reference docs should align with this.

---

## PERM Workflow

1. PWD application → filing date → PWD Status Filed
2. PWD determination → PWD Status Approved → Really Recruitment Working on it
3. Fill out recruitment → Recruitment Working on it → done becomes Recruitment Waiting period
   - A. Notice of filing - pwddd → 150 days after first recruitment or 30 days before pwded, whichever is first
   - B. Job order - pwddd → 120 days after first recruitment or 60 days before pwded, whichever is first
   - C. Sunday Ads - pwddd → 150 days after first recruitment or 30 days before pwded, whichever is first
     - 1st Sunday have to be on Sunday, has to be before the last Sunday (including it) that is still at least 143 days after first recruitment or 37 days before pwded whatever comes first
     - 2nd Sunday ad has to be on Sunday, before the last Sunday (including) that is at least 150 days after first recruitment or 30 days before pwded whatever comes first
   - D. Professional Occupation
4. Wait 30 days → ETA 9089 Working on it
5. ETA 9089 application → filing date → ETA 9089 Status filed
6. ETA 9089 Cert → Cert Date → Status Approved really I-140 Working on it
7. I-140 → filing date → status filed
8. I-140 → Approval date → status approved (maybe celebrate animations or something)

---

## Case Status (5 values, colored tag box)

| # | Status | Color | Window |
|---|--------|-------|--------|
| 1 | PWD | Blue | filing date → pwd determination |
| 2 | Recruitment | Purple | pwd determination → 30 days after recruitment ends / pwd expiration (first). Has waiting period countdown |
| 3 | ETA 9089 | Orange (Yellow when working) | 30 days after last recruitment → pwd expires / 180 days from first recruitment |
| 4 | I-140 | Green | ETA 9089 cert → expiration |
| 5 | Closed/Archived | Gray | progress status not applicable |

---

## Progress Status (6 values, separate tag, no color)

| # | Status | Trigger |
|---|--------|---------|
| 1 | Working on it | Default |
| 2 | Waiting for intake | Manual |
| 3 | Filed | Auto (manual override) |
| 4 | Approved | Auto (manual override) |
| 5 | Under review | Manual |
| 6 | RFI/RFE | Active RFI or RFE exists |

---

## Deadline Windows

| Window | Opens | Closes |
|--------|-------|--------|
| PWD | N/A | pwded (expiration) |
| Recruitment | PWDDD | 180 days after first recruitment (pwded trumps) |
| ETA 9089 | 30 days after last recruitment | 180 days after first recruitment (pwded trumps) |
| I-140 | ETA 9089 cert | ETA 9089 expiration |

### Recruitment Step Deadlines

| Step | Deadline Formula | Rationale |
|------|-----------------|-----------|
| Notice of Filing | min(first+150, pwded-30) | 30-day wait buffer |
| Job Order Start | min(first+120, pwded-60) | 30-day wait + 30-day posting |
| 1st Sunday Ad | lastSunday(min(first+143, pwded-37)) | 30-day wait + 7-day gap for 2nd Sunday |
| 2nd Sunday Ad | lastSunday(min(first+150, pwded-30)) | 30-day wait buffer |

---

## Upcoming Deadline Logic

1. Nearest deadline and step; if shared, whichever comes first
2. Special: "ETA 9089 filing ready" = 30 days after recruitment ends (goes away when filed)
3. Deadline becomes inactive/met once the field has a value

---

## Extra Tags

### Professional Occupation
- If checked: need 3 additional recruitment methods
- Each must be different (dropdown removes selected options)
- 3 max, no add button
- Cute animation + Lottie to open section
- Tag: white/black/grayscale

### RFI (Request for Information)
- Due: auto 30 days from received, **NOT editable** (strict)
- Received must be after filing date
- Submitted must be after received, before due
- Only one active at a time
- Red tag when active

### RFE (Request for Evidence)
- Due: **editable**, no auto
- Received must be after filing date
- Submitted must be after received, before due
- Only one active at a time
- Red tag when active

---

## Edge Cases

1. **PWD expires before ETA filed** → notification + popup on next login + auto-close
2. **Miss 180-day recruitment** → restart recruitment. If <60 days to pwded → auto-close with reasoning
3. **Miss ETA 9089 window** → restart recruitment. If <60 days to pwded → auto-close with reasoning
4. **Miss ETA 9089 expiration** → restart ETA if time allows, else auto-close with reasoning

---

## Date Validation Rules

### PWD
1. Filing date ≤ today
2. PWDDD > filing, ≤ today (can't fill before filing date)
3. PWDED auto-calculated: 90 days if Apr 2-Jun 30, else upcoming Jun 30

### Recruitment
4. Notice of filing: > PWDDD, < min(first+150, pwded-30)
5. Notice end: auto = notice + 10 business days (extend only, not shorten)
6. Job order start: > PWDDD, < min(first+120, pwded-60)
7. Job order end: ≥ start + 30 days (extend only)
8. 1st Sunday: on Sunday, < lastSunday(min(first+143, pwded-37))
9. 2nd Sunday: on Sunday, > 1st Sunday, < lastSunday(min(first+150, pwded-30))

### ETA 9089
10. Filing: > last recruitment + 30 days, < min(first+180, pwded)
11. Certification > filing

### I-140
12. Filing: > certification, < ETA expiration
13. Approval > filing

### Cascade Rules
- PWDDD change → PWDED recalculates → recruitment deadlines recalculate
- First recruitment change → all recruitment deadlines recalculate
- Notice start change → notice end recalculates (if within 10 days)
- Job order start change → job order end recalculates (if within 30 days)

---

## Important Constraints

- Recruitment must finish within 180 days of starting AND before pwded
- ETA 9089 can only be filed 30-180 days after recruitment AND before pwded
- Sunday ads must be at least 1 week apart
- Job order must be posted for 30 days

---

## Other Fields

- Newspaper name, job order state, number of applicants (no deadline validation)
- Internal case number (optional)
- PWD case number, ETA case number (optional)

---

## Ideas (Incorporated into v2)

- ✅ Case status + progress status (2-tier system)
- ✅ Internal case number
- ✅ PWD, ETA case numbers (optional)
- ❌ Case attachments (deferred)
- ✅ Google calendar sync per case
- ✅ Cascading field recalculation (real-time with Convex)
- ✅ Fix infinite leave/cancel popup bug
- ✅ Rename "recruitment summary" → "results"
- ✅ Timestamped notes with done/pending/delete
- ✅ I-140 approved = Complete tile
- ✅ No urgent/critical distinction - just deadlines
- ✅ Standardize case/progress status throughout

---

## Design Requirements

### Dashboard
- Deadline widget (overdue, this week, this month, later)
- Summary tiles with subtexts:
  - Complete: I-140 approved
  - Closed/Archived: separate tile
  - PWD: "X working, Y filed"
  - Recruitment: "X ready to start, Y in progress"
  - ETA 9089: "X prep, Y RFI, Z filed"
  - I-140: "X prep, Y RFE, Z filed"
- Upcoming deadlines, recent activity

### Cases List
- Export/import at bottom
- Filter: case status + progress status
- Show by: Active, All, Completed, Closed/Archived
- Sort: Recently updated, Favorites, Next deadline (default), Employer, Case status, PWD/ETA/I-140 filing dates
- Columns: Add recruitment started, expires, ETA 9089 filing window opens
- Search: robust, anything
- Count: "Showing X of Y total cases"

### Calendar
- Consistent case status + progress status
- Hover shows full details

### Notifications
- Case CRUD notifications
- Deadline alerts: month, week (urgent), day (urgent) before
- Remove RFE from notification types

### Settings
- Remove RFE from notification types
- Calendar sync order: pwded, recruitment window closes, eta 9089 filing window opens, eta 9089 filing deadline, i-140 filing deadline, rfe response deadline, rfi response deadline

### Case View
- Buttons: timeline toggle, calendar sync toggle, close/archive
- ETA 9089 section: add "filing window opens"
- Keep window displays
- Upcoming deadline at top
- Rename: "Recruitment Results"
- Created/updated at bottom
- Delete at bottom

---

## Open Questions

- ASK HER ABOUT EMAIL AND NOTIS AND CALENDAR
