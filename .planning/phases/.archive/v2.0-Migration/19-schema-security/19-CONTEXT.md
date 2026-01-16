# Phase 19: Schema + Security - Context

**Gathered:** 2025-12-23
**Status:** Ready for planning

<vision>
## How This Should Work

Phase 19 is the complete data layer foundation for v2. It defines all Convex tables, security rules, and supporting infrastructure. The schema should mirror v1's data structure closely (easing Phase 32 migration) while consolidating fragmented tables and preparing for future firm/team features.

**Security Model:**
- Users can only access their own data (RLS equivalent via function-level auth)
- Architecture allows for future firm/team shared access (firm_id ready)
- Just architect for multi-tenant now, don't implement firm features yet

**Key Consolidation:**
- `userProfiles` consolidates ~40 fields from v1's `perm_users`, `user_settings`, and `user_preferences` tables
- Single source of truth for all user-specific data beyond auth

**Complete vs Closed Distinction:**
- **Complete** = `case_status: i140` + `progress_status: approved` (derived state, triggers celebration animation)
- **Closed/Archived** = `case_status: closed` (manual action, can happen at any stage)
- Both have no active deadlines

</vision>

<essential>
## What Must Be Nailed

- **Airtight security** - User data isolation is non-negotiable. One leak = disaster.
- **Complete schema** - All 9 tables defined correctly so features build smoothly on top
- **Soft delete patterns** - Implement NOW with `deletedAt` timestamps and filtered queries
- **Indexes defined upfront** - Don't defer to query patterns, define NOW based on v1 usage
- **Detailed audit logging** - Full change history: who changed what, when, old value → new value
- **userProfiles consolidation** - All ~40 fields from 3 v1 tables in one place
- **Full TDD** - Write tests FIRST for every query/mutation, then implement

</essential>

<boundaries>
## What's Out of Scope

- No UI work - pure backend/schema (dashboard is Phase 20)
- No data seeding - empty tables, actual data comes in Phase 32 migration
- No firm features implementation - just architecture to support it later
- No integration with external services (Google Calendar, email) - those are later phases

</boundaries>

<specifics>
## Specific Requirements

### Tables to Define (9 total)
1. `users` - Extended from @convex-dev/auth
2. `userProfiles` - Consolidated user data (~40 fields)
3. `cases` - 50+ fields across 5 PERM stages
4. `notifications` - Deadline alerts with priority/urgency
5. `userSettings` - Email prefs, quiet hours, timezone (may merge into userProfiles)
6. `refreshTokens` - JWT rotation with TTL
7. `conversations` - Chatbot threads
8. `conversationMessages` - Chat messages with full-text search
9. `auditLogs` - NEW: Full change history

### userProfiles Fields (~40 consolidated)
**Profile:** full_name, phone, job_title, company, profile_photo_url
**Organization:** user_type (individual/firm_admin/firm_member), firm_id
**Notifications:** email/sms/push toggles, urgent_deadline_days, reminder_days_before[]
**Email Settings:** deadline_reminders, status_updates, rfe_alerts, preferred_email
**Quiet Hours:** enabled, start, end, timezone
**Calendar Sync:** enabled + 7 category toggles (pwd, eta9089, i140, rfe, rfi, recruitment, filing_window)
**Google OAuth:** google_email, tokens, scopes, expiry
**UI Prefs:** cases_sort_by, cases_sort_order, cases_per_page, dismissed_deadlines[], dark_mode
**Privacy:** privacy_mode_enabled

### Audit Logging (Detailed)
- Every mutation captures: userId, tableName, documentId, action (create/update/delete)
- For updates: field-level old → new value tracking
- Timestamps for all entries
- Queryable by user, table, document, date range

### Validation Rules (Schema Support)
- RFI due date: **STRICT 30 days from received** (calculated, not editable)
- RFE due date: **USER EDITABLE** (stored as-is)
- Only 1 active RFI/RFE at a time per case
- Professional occupation flag triggers 3 additional recruitment methods requirement
- Cascade recalculation when upstream dates change

### Indexes Required
**Users:** by_auth_user_id, by_email, by_firm_id, by_deleted_at
**Cases:** by_user_id, by_user_and_status, by_user_and_favorite, by_deleted_at
**Notifications:** by_user_id, by_user_and_unread, by_case_id, by_deadline_date
**Conversations:** by_user_id, by_user_and_archived
**Messages:** by_conversation_id, by_created_at

### Security Patterns
```typescript
// Every query/mutation must:
const userId = await getCurrentUserId(ctx);
// Then filter by userId or verify ownership
```

Helper functions needed:
- `getCurrentUserId(ctx)` - Get user from auth context
- `isFirmAdmin(ctx)` - Check user type
- `getCurrentUserFirmId(ctx)` - Get firm for future multi-tenant
- `verifyOwnership(ctx, resource)` - Verify resource.user_id === currentUser

### Testing Requirements (TDD)

**Approach:** Write tests FIRST, then implement to make them pass.

**Security Tests (Critical):**
- Unauthenticated access denied for all queries/mutations
- User A cannot access User B's data (cases, notifications, etc.)
- User A cannot modify User B's data
- Soft-deleted records excluded from all queries
- Ownership verification on update/delete operations

**CRUD Tests (Per Table):**
- Create: Returns new document with correct fields
- Read: Returns only user's own documents
- Update: Modifies only specified fields, updates `updatedAt`
- Delete: Soft delete sets `deletedAt`, hard delete removes

**Audit Logging Tests:**
- Create action logs: userId, table, documentId, action="create", newValues
- Update action logs: userId, table, documentId, action="update", oldValues, newValues
- Delete action logs: userId, table, documentId, action="delete", oldValues
- Audit logs queryable by user, table, document, date range
- Audit logs immutable (no update/delete on audit entries)

**Index Tests:**
- Queries use expected indexes (no full table scans)
- Compound indexes work correctly for filtered queries

**Test Utilities:**
- Use existing `createAuthenticatedContext(userId)` from test-utils
- Create fixtures for each table type
- Test isolation between test runs

</specifics>

<notes>
## Additional Context

### Alignment with Source of Truth
- Schema aligned with `perm_flow.md` (5 case statuses, 6 progress statuses)
- Two-tier status system preserved (case_status + progress_status)
- "Complete" is derived state (i140 + approved), not separate status

### V2 Current State
- Auth complete (Phase 18)
- Basic `users` + `userProfiles` tables exist (need expansion)
- `testItems` placeholder table to be replaced
- PERM engine library ready in `/src/lib/perm-engine/`

### Migration Considerations
- Schema should match v1 structure closely for Phase 32 data migration
- Field names: PostgreSQL snake_case → Convex camelCase
- Dates: Store as ISO strings (YYYY-MM-DD)
- Timestamps: Store as Unix milliseconds
- Currency (pwd_wage_amount): Store as cents (×100)

### Exploration Insights
- V1 has 25+ migrations with extensive RLS, triggers, indexes
- 44 validation rules documented (38 errors, 6 warnings)
- Cascade recalculation critical for date dependencies
- Frontend expects specific API response shapes (preserve during migration)

</notes>

---

*Phase: 19-schema-security*
*Context gathered: 2025-12-23*
