# Feature 001: Exploration

**Feature:** User-facing immediate account deletion option alongside existing 30-day scheduled flow
**Date:** 2026-02-02

## Similar Features

### Existing Account Deletion (30-Day Scheduled)

**UI:** `src/components/settings/SupportSection.tsx`
- Confirmation dialog requiring typing "DELETE" to enable button
- Shows scheduled deletion warning banner with cancel button when pending
- Signs out user immediately after scheduling

**Backend:** `convex/users.ts:686-810`
- `requestAccountDeletion` — schedules job 30 days out, sets `deletedAt` on both `users` and `userProfiles`, sends confirmation email
- `cancelAccountDeletion` — cancels scheduled job, clears `deletedAt`

**Permanent Deletion:** `convex/scheduledJobs.ts:946-1026`
- `permanentlyDeleteAccount` (internal mutation) — deletes cases, notifications, profile, auth accounts, sessions, user record
- Has guard: returns early if `deletedAt > Date.now()` (grace period not expired)
- Safety net cron runs hourly at `:45` via `processExpiredDeletions`

**Email:** `convex/notificationActions.ts:394-436` + `src/emails/AccountDeletionConfirm.tsx`
- Sends via Resend using React Email template
- Shows deletion date, cancel CTA, support link

## Architecture Patterns

- **Soft Delete → Hard Delete**: `deletedAt` timestamp set first, permanent deletion after grace period
- **Scheduler Pattern**: `ctx.scheduler.runAt()` with stored job ID for cancellation
- **Typed Confirmation**: Requiring exact text match ("DELETE") to enable destructive action
- **Immediate Sign-out**: User logged out right after requesting deletion
- **Safety Net Cron**: Hourly job catches any missed scheduled deletions
- **Internal Mutations**: `permanentlyDeleteAccount` is not client-callable

## Key Files

| File | Role | Lines |
|------|------|-------|
| `src/components/settings/SupportSection.tsx` | UI component, dialog, handlers | Full file |
| `convex/users.ts` | Request/cancel mutations | 686-810 |
| `convex/scheduledJobs.ts` | Permanent deletion + cron | 946-1085 |
| `convex/notificationActions.ts` | Email sending action | 394-436 |
| `src/emails/AccountDeletionConfirm.tsx` | Email template | Full file |
| `convex/schema.ts` | `deletedAt`, `scheduledDeletionJobId` fields | 53-206 |
| `convex/users.test.ts` | Backend tests | 252-427 |
| `src/components/settings/__tests__/SupportSection.test.tsx` | Frontend tests | Full file |

## Integration Points

1. **New mutation needed**: `immediatelyDeleteAccount` in `convex/users.ts` — bypasses scheduler, calls `permanentlyDeleteAccount` directly
2. **`permanentlyDeleteAccount` guard must be updated**: Currently blocks if `deletedAt > Date.now()`. For immediate deletion, need to either set `deletedAt` to past/now, or add a `force` flag
3. **UI choice**: Add deletion type selection (scheduled vs immediate) in the confirmation dialog
4. **Different confirmation text**: "DELETE NOW" for immediate to distinguish from scheduled
5. **Email**: Could reuse existing template with tweaked copy, or create separate template for immediate deletion confirmation
6. **Tests**: Mirror existing patterns in both `users.test.ts` and `SupportSection.test.tsx`
