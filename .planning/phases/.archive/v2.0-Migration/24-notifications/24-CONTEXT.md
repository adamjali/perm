# Phase 24: Notifications + Email - Context

**Gathered:** 2025-12-30
**Status:** Ready for planning

<vision>
## How This Should Work

When a deadline approaches or a case status changes, users should know immediately — both in the app and via email. There's a notification bell in the header with a red badge showing unread count. Clicking it opens a dropdown with the 5 most recent notifications plus a "+X more" link to the full page.

The full notifications page shows everything grouped by date (Today, Yesterday, This Week, Older) with tabs to filter by type (All, Unread, Deadlines, Status, RFE/RFI). Users can dismiss (mark as read but keep), delete (remove permanently), or mark all as read.

Emails go out for deadline reminders at configurable intervals (default: 1, 3, 7, 14, 30 days before). Status change emails notify when cases progress or hit problems. There's also an option for daily digest emails summarizing all upcoming deadlines.

Push notifications (browser/PWA) are included for urgent deadlines, giving users real-time alerts even when not actively using the app.

Everything should hook seamlessly with the existing auto-close/deadline enforcement system — when a case is auto-closed, a notification is created. When case status changes, irrelevant notifications are cleaned up.

The chatbot (Phase 26+) will need easy access to query all notifications, mark them as read individually or in bulk, and understand what's pending. Design the API to be chatbot-friendly.

</vision>

<essential>
## What Must Be Nailed

- **Notification bell with real-time badge** — Unread count updates instantly via Convex subscription. No polling, no delays.

- **All deadline reminders at intervals** — Every deadline type (PWD, Recruitment, ETA 9089, I-140, RFI, RFE) gets reminders at user-configurable intervals (default 1, 3, 7, 14, 30 days).

- **Email integration that works** — Resend templates for deadline reminders, status changes, RFI/RFE alerts. Users can control what they receive.

- **Full v1 feature parity + improvements** — Everything v1 has, plus real-time updates, push notifications, daily digest option, and per-case muting.

- **Seamless auto-close hookup** — Integrate with existing `deadlineEnforcement.ts`. When cases auto-close, notifications appear. When case status changes, irrelevant notifications are cleaned up.

- **Chatbot-ready API** — Easy to query notifications by case, type, read status. Easy to mark as read (single, multiple, all). Easy to understand notification stats.

</essential>

<boundaries>
## What's Out of Scope

- **Settings UI** — Phase 25. Backend fields exist and are ready, but no settings page in this phase.
- **SMS notifications** — Deferred. Push + email covers immediate needs.
- **Slack/Teams integrations** — Deferred to post-MVP.
- **Timezone-aware scheduling** — Fields exist, but full enforcement can wait for Phase 25.
- **Mobile-specific notification UI** — Responsive dropdown yes, but no native mobile patterns.

</boundaries>

<specifics>
## Specific Ideas

**Notification Bell:**
- Red circular badge with unread count (99+ if over 99)
- Badge hidden when count is 0
- Positioned right side of header, before theme toggle
- Neobrutalist design matching existing header

**Dropdown:**
- 5 most recent notifications
- "+X more" link to full page if more exist
- Each item shows: urgency color bar, icon, title (bold if unread), message (2-line truncated), relative time, delete X on hover
- "Mark All Read" button in header
- Clicking notification → mark as read + navigate to case

**Full Page:**
- Tabs: All | Unread | Deadlines | Status | RFE/RFI (with count badges)
- Grouped by date: Today, Yesterday, This Week, This Month, Older
- 20 per page with pagination
- Dismiss (read but stays) vs Delete (gone) as separate actions
- Bulk actions: Mark All Read, Delete All Read

**Email Templates:**
- Urgency colors (red for urgent/overdue, orange for high, blue for normal)
- Case details, deadline info, action button to view case
- Manage settings link in footer

**Settings (backend ready for Phase 25 UI):**
- Per-type toggles: deadline reminders, status updates, RFE alerts
- Per-deadline-type intervals
- Per-case muting
- Daily digest option
- Quiet hours (fields exist)

</specifics>

<notes>
## Additional Context

**V1 Exploration Complete:**
- notification_service.py (867 lines) — full CRUD, scheduling, cleanup
- scheduler_service.py — daily 9 AM checks
- resend_service.py + email_template_service.py — Resend integration
- Frontend bell component (910 lines) with animations
- Notifications page with tabs and pagination

**V2 Already Has:**
- `notifications` table schema (6 types, all fields)
- Auto-closure notification creation in `deadlineEnforcement.ts`
- `AutoClosureAlertBanner.tsx` on dashboard
- `userProfiles` with all notification preference fields
- Resend integration (auth emails only)
- Sonner toast library

**Integration Points:**
- Header.tsx — add notification bell
- deadlineEnforcement.ts — already creates `auto_closure` notifications
- cases.ts — trigger status_change notifications on updates
- userProfiles — all preference fields exist

**Plan Structure (5 plans):**
1. Data Layer (queries, mutations, helpers)
2. Bell + Dropdown UI
3. Full Notification Page
4. Email Integration (Resend templates)
5. Scheduled Functions + Push Notifications

</notes>

---

*Phase: 24-notifications*
*Context gathered: 2025-12-30*
