# Feature 001: Architecture

**Feature:** Cases list/card view toggle with sections and stunning animations
**Date:** 2026-01-27

## Architecture Options

### Option A: Minimal Changes

**Summary:** Add a minimal toggle component next to the "Cases" title that switches between the existing card grid view and a new compact list view with smart auto-grouping. Maximizes code reuse by leveraging the existing `ActionModeToggle` segmented control pattern, extracting utilities from `CaseCard`, and using the established animation infrastructure.

**Files to Create (3):**
| File | Purpose |
|------|---------|
| `v2/src/components/cases/ViewToggle.tsx` | Segmented control (card/list icons) - ~80 lines |
| `v2/src/components/cases/CaseListView.tsx` | Container with grouping logic + staggered animations - ~180 lines |
| `v2/src/components/cases/CaseListRow.tsx` | Compact row: employer, position, stage badge, deadline, progress - ~120 lines |

**Files to Modify (2):**
- `CasesPageClient.tsx` - Add view state, toggle, conditional render
- `components/cases/index.ts` - Add exports

**Pros:**
- Minimal change footprint (3 new files, 2 modifications)
- Pattern consistency with existing `ActionModeToggle`
- Maximum reuse of existing utilities
- Easy rollback - changes isolated
- Works with existing selection mode, pagination, sorting

**Cons:**
- No explicit group selection UI
- List view simpler (no expanded content)
- No drag-and-drop in list view
- No virtualization for large lists

---

### Option B: Clean Architecture

**Summary:** Implement a view toggle system with proper separation of concerns - view rendering decoupled from grouping logic via pure functions, testable components, and a dedicated hook for view persistence. More extensible for future view types (table, kanban).

**Files to Create (9):**
| File | Purpose |
|------|---------|
| `v2/src/components/cases/ViewModeToggle.tsx` | Segmented control with icons |
| `v2/src/components/cases/CaseListRow.tsx` | Compact row component |
| `v2/src/components/cases/CaseListGroup.tsx` | Collapsible section header |
| `v2/src/components/cases/CaseListView.tsx` | List view container |
| `v2/src/hooks/useViewMode.ts` | Hook for localStorage persistence |
| `v2/src/lib/caseGrouping.ts` | Pure grouping functions |
| `v2/src/lib/__tests__/caseGrouping.test.ts` | Unit tests for grouping |
| `v2/src/components/cases/__tests__/CaseListRow.test.tsx` | Row tests |
| `v2/src/components/cases/__tests__/CaseListView.test.tsx` | List tests |

**Files to Modify (2):**
- `CasesPageClient.tsx` - Add hook, toggle, conditional render
- `convex/lib/caseListTypes.ts` - Add GroupByField type

**New Abstractions:**
- `useViewMode` hook
- `CaseGroup` interface
- `groupCases()` pure function
- `CaseListGroup` collapsible component

**Pros:**
- Separation of concerns
- Testable grouping logic
- Future-proof (easy to add more views)
- Proper TypeScript types

**Cons:**
- More complexity (9 files vs 3)
- Client-side grouping computation
- Larger bundle size (~5KB)

---

## Chosen Approach: Minimal Changes (Option A)

**Decision:** User selected Minimal approach on 2026-01-27

**Rationale:** Maximum code reuse, minimal footprint, stunning visuals, easy rollback. 3 new files only.
