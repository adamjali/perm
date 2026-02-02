# Feature 001: Architecture

**Feature:** Immediate account deletion + persistent deletion banner
**Date:** 2026-02-02
**Chosen Approach:** Minimal Changes

## Summary

Extend the existing scheduled deletion flow with an immediate execution option. Add `immediateAccountDeletion` mutation to `convex/users.ts` that validates a scheduled deletion exists, sends confirmation email, then calls existing `permanentlyDeleteAccount`. Create a `DeletionBanner` component with sessionStorage-based dismissal for persistent app-wide reminder. Add `DeleteNowDialog` with typed "DELETE" + checkbox confirmation. Reuse existing email template with updated copy. No new context providers, no schema changes.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/settings/DeleteNowDialog.tsx` | Confirmation dialog: text input ("DELETE") + checkbox ("I understand this is immediate and irreversible") |
| `src/components/layout/DeletionBanner.tsx` | Persistent app-wide banner for accounts with scheduled deletion. SessionStorage dismissal, reappears on login. Links to /settings. |
| `src/components/settings/__tests__/DeleteNowDialog.test.tsx` | Frontend tests for the dialog |
| `src/components/layout/__tests__/DeletionBanner.test.tsx` | Frontend tests for the banner |

## Files to Modify

| File | Changes |
|------|---------|
| `convex/users.ts` | Add `immediateAccountDeletion` mutation (~40 lines) after `cancelAccountDeletion` |
| `convex/notificationActions.ts` | Add `sendImmediateDeletionEmail` action (~30 lines) reusing existing email template with different subject/copy |
| `src/components/settings/SupportSection.tsx` | Add "Delete Now" button in scheduled deletion warning banner, import DeleteNowDialog, update toast message |
| `src/app/(app)/layout.tsx` (or wherever the authenticated layout lives) | Render `<DeletionBanner />` at top of authenticated pages |
| `convex/users.test.ts` | Add tests for `immediateAccountDeletion` mutation |
| `src/emails/AccountDeletionConfirm.tsx` | Add optional `immediate` prop to adjust copy for immediate deletion email |

## Key Design Decisions

1. **Delete Now only after scheduling** — no cold-start immediate deletion
2. **Reuse `permanentlyDeleteAccount`** — the new mutation calls the existing internal mutation, no duplication
3. **Reuse email template** — add `immediate` boolean prop to existing `AccountDeletionConfirm` to swap copy
4. **SessionStorage for banner dismissal** — key format: `dismissedDeletionBanner_${deletedAt}` so it resets on re-login (new timestamp)
5. **No new context** — banner reads from Convex query + sessionStorage directly
6. **Checkbox + text confirmation** — double confirmation for irreversible immediate action

## Trade-offs Accepted

- Banner dismissal not synced across tabs (sessionStorage is per-tab; acceptable)
- Email sent before deletion — if Resend is slow, account deleted before email arrives (acceptable, email is informational)
- No undo after immediate deletion (by design, with double confirmation)
- Minor layout shift from banner (mitigated with consistent height)
