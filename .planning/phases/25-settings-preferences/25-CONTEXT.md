# Phase 25: Settings + Preferences - Context

**Gathered:** 2025-12-31
**Status:** Ready for planning

---

<vision>
## How This Should Work

A **clean and minimal** settings page that is also a **comprehensive hub** - everything in one place with clear navigation between sections, but no clutter. Each section clearly separated.

The settings page should feel **professional and organized** - matching the existing v2 neobrutalist design while taking inspiration from Linear/Notion's clean, minimal, modern settings patterns.

When users open Settings, they should immediately see:
1. Clear tabbed/sectioned navigation
2. Current setting states visible at a glance
3. Toggles and controls that respond instantly
4. Confirmation of saves with snappy feedback

Everything must be **properly connected** - when a toggle is flipped, the underlying system behavior changes immediately. No orphaned settings that don't do anything.

</vision>

<essential>
## What Must Be Nailed

**All equally important - no prioritization:**

1. **Everything Connected** - All settings actually work and affect app behavior immediately
   - Notification toggles connect to Phase 24 notification system
   - Email settings connect to email delivery
   - Calendar settings prepare for Phase 30 Google sync
   - Auto-close toggle properly hooks up to deadline enforcement
   - Quiet hours work with timezone awareness

2. **Clean Account Management** - Profile display + account deletion handled properly and safely
   - Google profile photo displayed if signed in with Google
   - Account deletion with 7-30 day grace period (soft delete)
   - Email confirmation before deletion

3. **Notification Control** - Per-type control over what notifications user gets and when
   - Toggle each notification type: deadline reminders, status updates, RFE/RFI alerts
   - Reminder days configuration
   - Quiet hours with timezone

4. **Proper Integration** - No clashing, duplicate, or non-integrated implementations
   - Check existing implementations before creating new
   - Work within existing patterns
   - Refactor as needed to make things fit

</essential>

<boundaries>
## What's Out of Scope

**Explicitly NOT building in Phase 25:**

- **Data export/import** - Already complete in Phase 21 (CSV/JSON with duplicate detection)
- **Avatar/photo upload** - Only use Google profile photo if signed in with Google (no custom upload)
- **Dark mode persistence** - Already works, no additional persistence needed
- **Google Calendar OAuth flow** - That's Phase 30 (we prepare settings UI, not the connection)
- **Gmail OAuth** - Phase 30
- **Two-way calendar sync** - Phase 30
- **File attachments** - Deferred to post-MVP

**Clarifications:**
- "Firebase import" refers to Phase 21's auto-detection of legacy camelCase format
- Timezone is IN SCOPE for quiet hours (auto-detect + allow override)

</boundaries>

<specifics>
## Specific Ideas & Requirements

### Visual Style
- Match existing v2 neobrutalist theme (sharp corners, hard shadows, Forest Green accent)
- Linear/Notion-inspired clean sidebar navigation
- Snappy, responsive feel

### Animations & Micro-interactions
- Use **Motion** (motion.dev, formerly Framer Motion) - add if not present
- GSAP for complex animations if needed
- Lottie for any animated icons
- 150-200ms snappy transitions
- Interactive, reactive, responsive controls
- Press effects on buttons, hover lifts on cards

### Account Deletion
- **Grace period (7-30 days)** soft delete with ability to recover
- Email confirmation before deletion
- Properly clean up all user data across all tables

### Profile Photo
- Display Google profile photo if signed in with Google OAuth
- Use initials fallback if no photo (pattern from v0 reference)
- Check `/Users/dev/workspace/perm-tracker-new` for implementation pattern

### Auto-Close Toggle
- Must be in Settings page (currently has component: `DeadlineEnforcementToggle.tsx`)
- Properly hooked up and working with deadline enforcement system

### Timezone
- Include for quiet hours functionality
- Auto-detect using browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Allow override with dropdown of common US timezones (PERM is US immigration)
- Store in userProfiles, use for quiet hours calculation

</specifics>

<notes>
## Additional Context

### User's Meta-Instructions for Implementation

**CRITICAL - These apply to planning AND all subagents:**

1. **Explore Before Implementing**
   - Fully explore to understand current implementation before making changes
   - Check if something already exists or can be reused before creating new
   - No clashing, duplicate, or non-seamless implementations

2. **Code Quality Standards**
   - DRY and KISS - minimal, simple, using existing as much as possible
   - Clean, organized, abstract-able, scalable, maintainable, readable
   - Global fixes (not repeated per-file)
   - Refactor as you go as needed to fix or improve

3. **Required Documentation to Read**
   - `.planning/FRONTEND_DESIGN_SKILL.md` - frontend-design skill (its a plug-in) - Design patterns and principles
   - `.planning/phases/17-design-system/design*` - All design docs (1-5)
   - `perm_flow.md` - Source of truth for PERM workflow
   - `v2/CLAUDE.md` - Development patterns for v2
   - `v2/docs/API.md` - Convex API reference

4. **V1 Feature Parity**
   - Check v1 (`perm-tracker/`) settings to ensure all features present in v2
   - v1 but with improvements and v2 polish

5. **Process**
   - Use Explore agents to understand codebase
   - Orchestrator pattern: explore → review → implement → verify → follow up
   - Create/maintain JSON tracking file throughout
   - Clean up thoroughly after

6. **Subagent Instructions**
   - ALL subagents must receive these meta-instructions in their prompts
   - ALL subagents must be told which docs to read
   - ALL subagents must understand the "no duplicates, work within existing" requirement

---

### Cascade Requirement

This context must flow through:
1. **CONTEXT.md** (this file) → informs plan stage
2. **Plan stage** → puts these instructions in EACH PLAN.md file
3. **PLAN.md files** → put these instructions in prompts for ALL explore and task subagents

---

### Exploration Findings Summary

#### From v2 Codebase (Current State)
- **userProfiles schema** already has ALL settings fields defined (12+ notification fields)
- **Settings page exists** at `/settings` with placeholder sections
- **DeadlineEnforcementToggle component** exists and works
- **Backend is 99% ready** - only UI needs building
- **Notification system** deeply integrated with shouldSendEmail(), quiet hours, timezone support
- **Push notifications** fully implemented with web-push + VAPID

#### From v1 (Feature Parity Required)
- 4-section tabbed navigation: Account, Email Notifications, Google Calendar, Support
- Profile editing (name only, email read-only)
- Email notification preferences with granular toggles + reminder scheduling
- Google Calendar connection + per-deadline-type sync toggles
- Privacy mode setting (auto-enable on login)
- Dark mode toggle
- Test email functionality
- Support contact form with GitHub integration
- Auto-save system with dirty state tracking

#### From v0 Reference (Google Photo Pattern)
- Google profile photo from Firebase Auth `photoURL`
- Initials fallback pattern: `getInitials()` → "JD" from "John Doe"
- Store photoURL in database (not just auth)
- Tabbed settings with 6 sections

#### Notification System Integration Points
- **12+ fields** in userProfiles must be exposed in Settings UI
- **shouldSendEmail()** checks master + type-specific + quiet hours
- **Quiet hours bypass** for urgent priority (overdue, <7 days)
- **Cron jobs** use reminderDaysBefore, timezone settings
- **Auto-closure** uses autoDeadlineEnforcementEnabled

---

### Settings Sections to Build

1. **Profile Section**
   - Name display/edit
   - Email display (read-only)
   - Google profile photo (if available) or initials fallback
   - Timezone selector

2. **Notification Preferences Section**
   - Master email toggle
   - Per-type toggles: deadline reminders, status updates, RFE/RFI alerts
   - Reminder days configuration (checkboxes: 1, 3, 7, 14, 30 days)
   - Urgent deadline threshold
   - Push notification toggle + subscription management

3. **Quiet Hours Section**
   - Enable/disable toggle
   - Start time picker (HH:MM)
   - End time picker (HH:MM)
   - Note: Urgent notifications bypass quiet hours

4. **Calendar Sync Section** (prep for Phase 30)
   - Master calendar sync toggle
   - Per-deadline-type toggles (PWD, ETA 9089, I-140, RFE, RFI, Recruitment, Filing Window)
   - Google Calendar connection status (read-only for now)

5. **Auto-Close Section**
   - DeadlineEnforcementToggle component (already exists)
   - Warning about closure rules

6. **Account Management Section**
   - Account deletion with grace period
   - Privacy mode toggle
   - Data export link (to Phase 21 functionality)

7. **Support Section** (from v1)
   - Contact support
   - Report bug (GitHub issues link)
   - Request feature (GitHub enhancement link)

---

### Files to Reference During Implementation

| File | Purpose |
|------|---------|
| `v2/convex/schema.ts` | userProfiles schema with all settings fields |
| `v2/convex/users.ts` | updateUserProfile mutation (already works) |
| `v2/convex/lib/notificationHelpers.ts` | shouldSendEmail, quiet hours logic |
| `v2/convex/deadlineEnforcement.ts` | Auto-closure system |
| `v2/src/app/(authenticated)/settings/page.tsx` | Existing settings page shell |
| `v2/src/components/settings/DeadlineEnforcementToggle.tsx` | Example component |
| `perm-tracker/frontend/settings.html` | v1 settings for feature parity |
| `perm-tracker/frontend/src/js/pages/settings.js` | v1 settings logic |

</notes>

---

## Implementation Workflow Instructions

### For Planning Stage

When creating PLAN.md files, include in EACH plan:

```markdown
## Required Reading (MANDATORY for all implementers)
- `.planning/FRONTEND_DESIGN_SKILL.md`
- `.planning/phases/17-design-system/design*` (all 5 design docs)
- `perm_flow.md`
- `v2/CLAUDE.md`

## Implementation Rules
1. Explore existing code BEFORE creating anything new
2. No clashing, duplicate, or non-integrated implementations
3. DRY, KISS, minimal - use existing patterns
4. Refactor as needed to fit changes
5. Check v1 for feature parity
6. Clean up thoroughly after

## Subagent Instructions
All Task and Explore subagents MUST receive these rules in their prompts.
```

### For Task Subagents

Each Task subagent prompt must include:
1. These meta-instructions verbatim
2. List of docs to read before implementing
3. Explicit instruction to explore before creating
4. Reminder about no duplicates/clashing code

### JSON Tracking

Create and maintain: `.planning/phases/25-settings-preferences/TRACKING.json`

Track:
- Each section's implementation status
- Issues found during implementation
- Refactoring performed
- Tests written
- Cleanup tasks

---

*Phase: 25-settings-preferences*
*Context gathered: 2025-12-31*
