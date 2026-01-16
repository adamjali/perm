# Phase 21-04: Selection Mode + Export/Import Summary

**Implemented selection mode with bulk actions, CSV/JSON export, and JSON import with legacy format detection.**

## Accomplishments

- **SelectionBar component** - Fixed bottom bar with selection count, Select All/Deselect All, Export CSV/JSON, bulk Delete/Archive buttons
- **Export functionality** - CSV (RFC 4180 compliant) and JSON (pretty-printed) export with proper date formatting and field escaping
- **Import functionality** - ImportModal with drag-drop, preview table, validation, and automatic legacy format detection (Firebase IDs, snake_case fields)
- **Integration** - Selection mode wired into cases page with checkbox state management passed to SortableCaseCard
- **Bug fixes** - Fixed pre-existing test failures (border-2 vs border-4, date timezone issues, CSS-hidden vs DOM removal)

## Files Created

- `v2/src/components/cases/SelectionBar.tsx` - Selection bar component (235 lines)
- `v2/src/components/cases/__tests__/SelectionBar.test.tsx` - 14 tests
- `v2/src/components/cases/ImportModal.tsx` - Import modal with preview
- `v2/src/components/cases/__tests__/ImportModal.test.tsx` - 18 tests
- `v2/src/lib/export/caseExport.ts` - CSV/JSON export utilities
- `v2/src/lib/export/__tests__/caseExport.test.ts` - 14 tests
- `v2/src/lib/export/index.ts` - Export barrel file
- `v2/src/lib/import/caseImport.ts` - Import parsing and validation
- `v2/src/lib/import/__tests__/caseImport.test.ts` - 15 tests
- `v2/src/lib/import/index.ts` - Import barrel file

## Files Modified

- `v2/src/app/(authenticated)/cases/page.tsx` - Selection mode state, export/import integration
- `v2/src/components/cases/index.ts` - Added SelectionBar, ImportModal exports
- `v2/src/components/cases/SortableCaseCard.tsx` - Selection props passthrough
- `v2/src/components/cases/__tests__/CaseCard.test.tsx` - Fixed pre-existing test failures
- `v2/convex/lib/caseListTypes.test.ts` - Added "custom" to CASE_LIST_SORT_FIELDS
- `v2/convex/cases.ts` - Added importCases mutation

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| SelectionBar fixed at bottom (z-40) | Persistent visibility without scrolling, common mobile pattern |
| CSV uses RFC 4180 escaping | Standard format, compatible with Excel and other tools |
| JSON pretty-printed with 2-space indent | Human-readable export for debugging/review |
| Strict on required fields, lenient on optional | employerName and beneficiaryIdentifier required for valid import |
| Auto-detect legacy Firebase format | Seamless migration from v1 without manual conversion |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Pre-existing CaseCard test failures | Fixed: border-4 → border-2, timezone-safe date fixtures, CSS visibility check |
| "custom" sort field missing from test | Added to CASE_LIST_SORT_FIELDS (from drag-drop feature in 21-03) |

## Test Status

- **1115 tests passing** (6 skipped)
- No TypeScript errors
- Human checkpoint approved

## Next Step

Phase 21 complete. Ready for Phase 22 (Case Forms - Add/Edit).
