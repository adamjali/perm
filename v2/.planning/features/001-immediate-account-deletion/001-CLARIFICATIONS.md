# Feature 001: Clarifications

**Feature:** User-facing immediate account deletion option alongside existing 30-day scheduled flow
**Date:** 2026-02-02

## Questions & Answers

### Confirmation Method
**Q:** For immediate deletion, what confirmation should users type?
**A:** Type "DELETE" + check an "I understand this is immediate and irreversible" checkbox. Both must be satisfied.

### Email After Immediate Deletion
**Q:** Should the user receive a confirmation email after immediate deletion?
**A:** Yes, send a "your account has been deleted" confirmation email before wiping the data.

### UI Layout — "Delete Now" Placement
**Q:** How should the immediate deletion option appear?
**A:** The "Delete Now" button appears in the scheduled deletion warning banner (next to "Cancel Deletion"), only visible when a deletion is already scheduled and the user logs back in. Not in the initial dialog — the initial flow stays as-is (schedule only).

### Additional Requirements (from user)

1. **Persistent app-wide banner**: When an account has a scheduled deletion, show a dismissible banner at the top of the app (all pages, not just settings). Dismissible per session but reappears on every login. Banner directs user to Settings support section to cancel.

2. **Improved post-schedule messaging**: The toast after scheduling should include instructions: "Sign in and go to Settings to cancel."

3. **Delete Now flow**: User schedules deletion → gets logged out → logs back in → sees persistent banner + settings shows "Cancel Deletion" AND "Delete Now" buttons → Delete Now requires typing "DELETE" + checking confirmation checkbox → immediate permanent deletion.

## Implications

- **Delete Now is a second-step action only** — user must first schedule deletion, then can expedite. No immediate deletion from cold start.
- **Persistent banner component needed** — a new app-level component that checks `profile.deletedAt` and renders a warning bar.
- **Email template can be reused** with minor copy changes for immediate deletion.
- **Two new pieces of UI**: (1) persistent banner across app, (2) Delete Now button + confirmation in settings.
- **Backend**: New `immediatelyDeleteAccount` mutation that bypasses the scheduler and calls permanent delete directly.
