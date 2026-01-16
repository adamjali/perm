# Phase 32: Data Migration + Go-Live - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

Brief maintenance window approach - users are notified in advance, v1 goes down for 15-30 minutes while we migrate, then v2 comes up at the same URL. Users log in (via Google or email) and see all their cases exactly as they left them.

The migration is invisible to users except for the brief downtime. When they return:
- Google sign-in users click "Sign in with Google" → same email → see their cases
- All case data is there - every field, every date, every note
- Calendar needs re-connection (fresh OAuth) but that's expected
- Chat/notifications start fresh (clean slate)

After everything is verified working:
- Clean up v1's orphaned Google Calendar events
- Decommission v1 services (Render backend, Supabase)
- Remove v1 code from repo
- Push clean v2-only codebase

</vision>

<essential>
## What Must Be Nailed

All three are equally critical - can't compromise on any:

1. **Zero data loss** - Every case, every field, perfectly migrated. Verification is paramount. The 229-feature checklist must pass with migrated data.

2. **Smooth user transition** - Users log in, see their cases, everything works. Google sign-in users matched by email. No confusion about where their data went.

3. **Clean decommission** - v1 fully removed, no orphaned resources (especially Google Calendar events), clean codebase with only v2 remaining.

**Calendar sync fixes before launch:**
- Auto-cleanup when user toggles off specific deadline types
- "Clear All Events" button for disconnect flow
- Fix RFI/RFE multi-entry event tracking

</essential>

<boundaries>
## What's Out of Scope

- **Extended testing period** - Quick verification with the 229-feature checklist, not weeks of UAT
- **New features** - Pure migration and go-live, no feature additions
- **Chat history migration** - v2 chatbot architecture is different, start fresh
- **Email/notification history** - Start fresh in v2
- **Calendar event migration** - Users re-connect and re-sync (clean slate)
- **Preserving OAuth tokens** - Users re-authorize Google Calendar in v2

</boundaries>

<specifics>
## Specific Ideas

**Migration sequence:**
1. Export v1 data (users + cases)
2. Transform (snake_case → camelCase, UUID → Convex ID, etc.)
3. Import to production Convex
4. Verify 229 features with migrated data
5. Run v1 calendar cleanup script (delete all Google Calendar events)
6. Point domain to v2
7. Decommission v1 services
8. Remove v1 code from repo

**User ID mapping:**
- Match v1 users to v2 by EMAIL (not OAuth ID)
- Create mapping table: v1_uuid → v1_email → v2_convex_id
- Update all case userId foreign keys

**Calendar cleanup (v1):**
- v1 has orphaned events bug (unsync doesn't delete from Google)
- Need bulk cleanup script before decommission
- Delete ALL v1 events for ALL users from Google Calendar

**Calendar fixes (v2):**
- When user toggles off `calendarSyncPwd` etc., auto-delete those event types
- Add "Clear All Events" button in settings (especially for disconnect)
- Fix RFI/RFE to store array of event IDs (multiple entries)

**Field transformations:**
- Dates: keep as ISO strings (YYYY-MM-DD)
- Timestamps: convert to Unix milliseconds
- Money (pwdWageAmount): convert to cents (int64)
- RFI/RFE: merge separate tables into inline arrays
- User preferences: consolidate 3 tables → 1 userProfiles

</specifics>

<notes>
## Additional Context

**Extensive exploration completed:**
- v1 calendar sync: confirmed orphaned events bug (unsync clears DB but not Google)
- v2 calendar sync: properly deletes events on unsync/delete, but gaps in preference changes
- Schema comparison: 70+ v1 fields → 72+ v2 fields, well-documented in V2_FIELD_MAPPINGS.md
- Auth: both use email as identifier, Google sign-in will work if email matches
- v2 gaps identified: no auto-cleanup on preference toggle, no "clear all" button

**Test environment:**
- This is `perm-tracker-test/` worktree on branch `test`
- Database: Isolated test Supabase (`lkbhdshknusfrvxgtahz`)
- Migration scripts can be tested here before production

**Production targets:**
- Frontend: Vercel (permtracker.app)
- Backend: Convex cloud deployment
- v1 to decommission: Render (FastAPI), Supabase (PostgreSQL)

</notes>

---

*Phase: 32-data-migration-go-live*
*Context gathered: 2026-01-11*
