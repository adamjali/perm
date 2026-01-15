# Phase 27 Plan 03: Tool Definitions Summary

**Flexible case query Convex function with AI SDK tool definitions for query_cases, search_knowledge, and search_web**

## Performance

- **Duration:** 90 min
- **Started:** 2026-01-08T11:10:41Z
- **Completed:** 2026-01-08T12:41:35Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Flexible `queryCases` Convex function with all filter options (status, progress, RFI/RFE, deadlines, search, projection)
- AI SDK tool definitions with comprehensive descriptions and Zod schemas
- 104 tests passing (30 chatCaseData + 74 tools schema tests)
- Helper queries: `getCaseById` and `getCaseSummary` for chatbot context

## Files Created/Modified
- `v2/convex/chatCaseData.ts` - Flexible case query functions (queryCases, getCaseById, getCaseSummary)
- `v2/src/lib/ai/tools.ts` - AI SDK tool definitions with Zod input/output schemas
- `v2/src/lib/ai/index.ts` - Updated exports for tools module
- `v2/convex/__tests__/chatCaseData.test.ts` - 30 tests for Convex queries
- `v2/src/lib/ai/__tests__/tools.test.ts` - 74 tests for tool schemas

## Decisions Made
- Used `inputSchema` (AI SDK v5) not `parameters` for tool definitions
- Case status values are lowercase to match schema (pwd, recruitment, eta9089, i140, closed)
- Progress status values use underscores (working, waiting_intake, filed, approved, under_review, rfi_rfe)
- RFI/RFE filters check for "active" (unresponded) entries only
- Added `getCaseSummary` bonus function for chatbot overview context
- Exported input schemas from tools.ts to enable independent testing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Schema field name alignment**
- **Found during:** Task 1 (queryCases implementation)
- **Issue:** Plan used different field names than actual schema (beneficiaryName vs beneficiaryIdentifier, rfiDeadline vs rfiEntries array)
- **Fix:** Used actual schema field names from v2/convex/schema.ts
- **Files modified:** v2/convex/chatCaseData.ts
- **Verification:** TypeScript compiles, tests pass

**2. [Rule 1 - Bug] Unused import warning**
- **Found during:** Task 1 (after initial implementation)
- **Issue:** `getCurrentUserId` imported but unused (only `getCurrentUserIdOrNull` needed)
- **Fix:** Removed unused import
- **Files modified:** v2/convex/chatCaseData.ts
- **Verification:** No TypeScript warnings

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 0 deferred
**Impact on plan:** Schema alignment was necessary for correctness. No scope creep.

## Issues Encountered
None

## Next Step
Ready for 27-04-PLAN.md (Chat API Integration with Tools)

---
*Phase: 27-knowledge-layer*
*Completed: 2026-01-08*
