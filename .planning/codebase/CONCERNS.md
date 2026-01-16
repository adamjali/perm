# Codebase Concerns

**Analysis Date:** 2026-01-16

## Tech Debt

**Legacy Migration Fields Still in Schema:**
- Issue: `legacyId`, `legacyUserId`, and `legacyAuthId` fields remain in schema after v1->v2 migration
- Files: `v2/convex/schema.ts` (lines 74-76, 219-220), `v2/convex/migrations.ts`
- Impact: Schema bloat, unnecessary indexes (`by_legacy_id`, `by_legacy_user_id`) consuming storage
- Fix approach: After confirming migration complete, remove legacy fields and indexes from schema, run cleanup migration to drop indexes

**Deprecated Export Functions:**
- Issue: `exportCasesCSV` and `exportCasesJSON` are marked deprecated but still present
- Files: `v2/src/lib/export/caseExport.ts` (lines 725, 750)
- Impact: Multiple code paths for same functionality, potential confusion
- Fix approach: Remove deprecated functions, update any remaining callers to use `exportFullCasesCSV` and `exportFullCasesJSON`

**Deprecated Animation Utility:**
- Issue: `parallaxRange()` deprecated in favor of `createParallaxRange()`
- Files: `v2/src/lib/animations.ts` (line 268)
- Impact: Minor - deprecated function with clear replacement documented
- Fix approach: Find usages and migrate to `createParallaxRange()`, then remove deprecated function

**Large Files Indicating Possible Complexity:**
- Issue: Several files exceed 1000 lines suggesting potential for extraction
- Files:
  - `v2/convex/cases.ts` (2725 lines) - CRUD operations, validation, calendar sync
  - `v2/src/lib/ai/tools.ts` (1946 lines) - AI tool definitions
  - `v2/src/app/api/chat/route.ts` (1908 lines) - Chat API handler
  - `v2/convex/lib/rag/appGuideKnowledge.ts` (1834 lines) - Knowledge base content
  - `v2/convex/googleCalendarActions.ts` (1315 lines) - Google Calendar integration
  - `v2/src/app/(authenticated)/cases/CasesPageClient.tsx` (1283 lines) - Case list page
- Impact: Harder to test, understand, and maintain; longer CI times for affected tests
- Fix approach: Extract logical subsections into separate modules (e.g., split cases.ts into case-queries.ts, case-mutations.ts, case-calendar.ts)

## Known Bugs

**None detected** - No TODO/FIXME comments indicating known bugs in production code. Test suite shows 3600+ passing tests.

## Security Considerations

**Environment Variable Handling:**
- Risk: Multiple API keys and secrets accessed via `process.env` throughout codebase
- Files:
  - `v2/convex/webSearch.ts` (TAVILY_API_KEY, BRAVE_API_KEY)
  - `v2/convex/googleCalendarActions.ts` (GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET)
  - `v2/convex/lib/crypto.ts` (OAUTH_ENCRYPTION_KEY)
  - `v2/convex/pushNotifications.ts` (VAPID_PRIVATE_KEY)
  - `v2/src/lib/ai/providers.ts` (OPENROUTER_API_KEY, GROQ_API_KEY, etc.)
- Current mitigation: Keys stored in Convex dashboard environment, not committed to repo. OAuth tokens encrypted with AES-256-GCM
- Recommendations: Add runtime validation for required keys at startup, implement key rotation mechanism for OAuth encryption key

**OAuth Token Storage:**
- Risk: Google OAuth refresh tokens stored in userProfiles table
- Files: `v2/convex/schema.ts` (lines 136-138), `v2/convex/lib/crypto.ts`
- Current mitigation: Tokens encrypted with AES-256-GCM using OAUTH_ENCRYPTION_KEY
- Recommendations: Consider shorter token rotation intervals, add audit logging for token refresh events

**Rate Limiting Configuration:**
- Risk: Rate limits may need adjustment based on actual usage patterns
- Files: `v2/convex/lib/rateLimit.ts` (lines 44-50)
- Current mitigation: Limits configured for OTP (5/15min), password reset (3/hr), login (10/15min), email (5/10min)
- Recommendations: Monitor rate limit hits in production, consider stricter limits for password reset

## Performance Bottlenecks

**Full Table Scans in Queries:**
- Problem: Some queries fetch all records then filter in memory
- Files:
  - `v2/convex/cases.ts` list query: `.take(1000)` then filters
  - `v2/convex/migrations.ts` getTableCount: `.collect()` fetches all records
- Cause: Convex doesn't support COUNT queries natively, some filters not indexable
- Improvement path: For list query, use pagination with cursor-based queries. For counts, maintain denormalized counters or use Convex's new aggregation features when available

**Calendar Sync Operations:**
- Problem: Syncing all cases to Google Calendar can be slow for users with many cases
- Files: `v2/convex/googleCalendarActions.ts`, `v2/convex/cases.ts` (DEADLINE_RELEVANT_FIELDS)
- Cause: Each calendar event requires separate Google API call
- Improvement path: Implement batching with Google Calendar API batch endpoints, add progress indicator for bulk sync

## Fragile Areas

**Import/Export Module:**
- Files: `v2/src/lib/import/caseImport.ts` (1128 lines), `v2/src/lib/export/caseExport.ts`
- Why fragile: Handles 4+ legacy formats (v2, v1, perm-tracker-new, firebase-object), complex date parsing with multiple fallback formats, field mapping between schemas
- Safe modification: Add new formats as separate detection cases, never modify existing format handlers without comprehensive tests
- Test coverage: Well-tested at 1216 lines of tests in `v2/src/lib/import/__tests__/caseImport.test.ts`

**AI Chat Route:**
- Files: `v2/src/app/api/chat/route.ts` (1908 lines)
- Why fragile: Multi-provider fallback logic, streaming response handling, tool execution with confirmation flow, conversation context summarization
- Safe modification: Add new tools via tool definitions in `v2/src/lib/ai/tools.ts`, test thoroughly with all providers
- Test coverage: Limited E2E coverage for streaming behavior

**PERM Business Logic:**
- Files: `v2/convex/lib/perm/` (entire directory)
- Why fragile: Complex date calculations tied to federal regulations (20 CFR 656.40), cascade dependencies between fields
- Safe modification: Always use existing calculators/validators, never recreate logic elsewhere, add new rules to validators/
- Test coverage: 100% - comprehensive test suite for all calculators and validators

## Scaling Limits

**Case Limit Per User:**
- Current capacity: `.take(1000)` in list queries
- Limit: Users with >1000 cases will not see all cases
- Scaling path: Implement proper pagination with cursor-based queries, add virtual scrolling to UI

**Notification Table Growth:**
- Current capacity: Read notifications cleaned up after 90 days
- Limit: Unread notifications accumulate indefinitely
- Scaling path: Consider archiving old unread notifications, add index for cleanup queries

**Conversation Message History:**
- Current capacity: Unlimited message storage per conversation
- Limit: Context window limits handled by summarization (checkNeedsSummarization)
- Scaling path: Consider periodic conversation archival for very old inactive conversations

## Dependencies at Risk

**Lucia Auth Deprecation:**
- Risk: `lucia-auth` package shows deprecation warning in lockfile
- Impact: Auth system may need migration in future
- Migration plan: @convex-dev/auth already provides abstraction layer, monitor for required updates

**Multiple AI SDK Providers:**
- Risk: Dependency on multiple AI providers (OpenRouter, Groq, Cerebras, Mistral, Google, OpenAI)
- Impact: Provider API changes could break fallback chain
- Migration plan: ai-fallback package handles retries, but providers should be version-pinned

## Missing Critical Features

**No detected critical gaps** - Application appears feature-complete for v2.0 milestone with:
- Full PERM case tracking workflow
- Calendar sync
- Notifications with email
- AI chat assistant with tools
- Import/export functionality

## Test Coverage Gaps

**E2E Test Coverage:**
- What's not tested: Chat streaming behavior, full import flow, calendar sync OAuth flow
- Files: `v2/tests/e2e/` (limited test files)
- Risk: Integration issues between frontend and backend may go unnoticed
- Priority: Medium - unit tests provide good coverage, E2E tests should cover critical user journeys

**API Route Testing:**
- What's not tested: `v2/src/app/api/chat/route.ts` has limited direct testing
- Files: API routes rely on integration tests
- Risk: Edge cases in streaming, error handling may not be covered
- Priority: Medium - add unit tests for request validation and error cases

**UI Component Edge Cases:**
- What's not tested: Some complex components have test coverage but may miss edge cases
- Files: Components in `v2/src/components/` with >500 line tests
- Risk: Specific interaction patterns may break
- Priority: Low - visual testing via Storybook provides additional coverage

---

*Concerns audit: 2026-01-16*
