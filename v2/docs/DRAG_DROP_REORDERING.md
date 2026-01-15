# Drag & Drop Reordering with Custom Sort Persistence

**Status:** ✅ Implemented
**Version:** v2.0
**Date:** 2025-12-25

## Overview

The PERM Tracker v2 now supports drag-and-drop reordering of case cards with persistent custom sort order. Users can manually arrange cases in their preferred order, which is saved per-user and restored across sessions.

## Features

### 1. **Drag-and-Drop Interface**
- Click and drag any case card to reorder
- Smooth, snappy animations following neobrutalist design principles
- Visual feedback during drag (opacity change, cursor change)
- 8px activation threshold to prevent accidental drags
- Keyboard support (Space/Enter to grab, Arrow keys to move)

### 2. **Custom Sort Persistence**
- Automatically saves custom order to Convex database
- Persists active filters when saving custom order
- Stores base sort method for handling new cases
- Per-user storage (isolated by user ID)
- Instant save with toast notification

### 3. **Smart New Case Handling**
- New cases (not in custom order) are inserted intelligently
- Uses the original sort method that was active when custom order was created
- Existing custom order remains intact
- New cases appear at their natural position based on base sort

### 4. **Filter Snapshot**
- Custom order includes a snapshot of active filters
- Restoring custom order reapplies the original filter context
- Supports status, progress status, search query, and favorites filters

## Architecture

### Database Schema

**Table:** `userCaseOrder`

```typescript
{
  userId: Id<"users">,                    // User who created the custom order
  caseIds: Id<"cases">[],                 // Ordered array of case IDs
  filters: {                               // Snapshot of active filters
    status?: CaseStatus,
    progressStatus?: ProgressStatus,
    searchQuery?: string,
    favoritesOnly?: boolean,
  },
  baseSortMethod: CaseListSortField,      // Original sort method (for new cases)
  baseSortOrder: "asc" | "desc",          // Original sort order
  createdAt: number,
  updatedAt: number,
}
```

### Convex Mutations

**Location:** `/v2/convex/userCaseOrder.ts`

1. **`saveCaseOrder`** - Creates or updates custom order
2. **`getCaseOrder`** - Retrieves custom order for current user
3. **`deleteCaseOrder`** - Removes custom order (resets to default)

### Frontend Components

**Modified Files:**

1. `/v2/src/app/(authenticated)/cases/page.tsx`
   - DndContext wrapper with sensors
   - Custom order processing logic
   - Auto-save on drag end
   - Smart placement for new cases

2. `/v2/src/components/cases/SortableCaseCard.tsx`
   - Draggable wrapper for CaseCard
   - Uses `@dnd-kit/sortable`
   - Preserves neobrutalist styling

3. `/v2/src/components/cases/CaseFilterBar.tsx`
   - Added "Custom order" option to Sort dropdown
   - Placed at top of sort options

4. `/v2/convex/lib/caseListTypes.ts`
   - Added "custom" to `CaseListSortField` type

## User Flow

### Creating Custom Order

1. User navigates to cases page
2. Selects any sort method (e.g., "Next deadline")
3. Drags cases to desired positions
4. Order auto-saves on each drag-drop
5. Sort automatically switches to "Custom order"
6. Toast notification confirms save

### Restoring Custom Order

1. User selects "Custom order" from Sort dropdown
2. System loads saved `caseIds` array
3. Cases are reordered according to saved positions
4. New cases appear in natural position using base sort
5. Filter snapshot is applied (optional)

### Edge Cases

**New Cases:**
- Cases created after custom order was saved
- Inserted at position determined by `baseSortMethod`
- Example: If base was "deadline", new cases sort by deadline among themselves
- Do not disrupt existing custom order

**Deleted Cases:**
- Removed from `caseIds` array on next save
- No impact on remaining cases

**Filter Changes:**
- When filters change, user can create new custom order
- Old custom order remains available if filters match
- Each filter combination can have its own custom order (future enhancement)

## Dependencies

### NPM Packages

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

### Installed via:
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Design Decisions

### Auto-save vs Manual Save
**Decision:** Auto-save on each drag-drop
**Rationale:**
- Reduces friction (no "Save" button needed)
- Immediate feedback via toast
- Aligns with modern UX patterns
- Low risk (can always resort)

### Single Custom Order per User
**Decision:** One custom order per user (not per filter combination)
**Rationale:**
- Simpler implementation
- Easier to understand
- Sufficient for MVP
- Future enhancement: multiple saved orders

### Base Sort Method Storage
**Decision:** Store original sort method when creating custom order
**Rationale:**
- Enables intelligent placement of new cases
- Preserves user intent
- Prevents jarring disruptions to custom order

### Drag Activation Threshold
**Decision:** 8px movement required to start drag
**Rationale:**
- Prevents accidental drags when clicking
- Matches design system's "snappy" feel
- Common UX pattern

## Animation Specifications

All animations follow the neobrutalist design system:

```css
/* Updated as of Phase 21 (2025-12-25) */
transition: transform 150ms ease-out
```

**During Drag:**
- Dragged card: `opacity: 0.9` (slightly transparent, not too faint)
- Dragged card: `scale: 1.02` (subtle size increase for lift effect)
- Dragged card: `z-index: 1000` (front)
- Transition disabled: `transition: none` (prevents animation lag during drag)
- Other cards: animate to new positions smoothly

**Drop Animation:**
- Cards slide to final positions with 150ms ease-out
- No stagger delay during drag (prevents jank)
- Snappy feel matches overall card hover behavior

## Testing

### Manual Testing Checklist

- [x] Drag case to new position
- [x] Verify auto-save and toast notification
- [x] Verify sort switches to "Custom order"
- [x] Refresh page and verify order persists
- [x] Create new case and verify smart placement
- [x] Change filters and verify custom order still works
- [x] Test keyboard navigation (grab with Space, move with arrows)

### Automated Testing

**Status:** Not yet implemented
**Location:** Will be in `/v2/src/components/cases/__tests__/`

**Planned tests:**
1. `SortableCaseCard` renders correctly
2. Drag-drop updates local order
3. `saveCaseOrder` mutation is called on drop
4. Custom order persists across page reloads
5. New cases are placed correctly
6. Filter snapshot is saved and restored

## Future Enhancements

### Phase 2
1. **Multiple saved orders** - Save different custom orders per filter combination
2. **Named custom orders** - "My Priority View", "Urgent Cases", etc.
3. **Bulk reorder** - Select multiple cases and move together
4. **Reorder across pages** - Drag-drop spanning pagination

### Phase 3
1. **Team-shared orders** - Share custom orders with firm members
2. **Reorder history** - Undo/redo reordering
3. **Visual feedback enhancements** - Placeholder card during drag

## Known Limitations

1. **Pagination:** Drag-drop only works within current page
2. **Single order:** Only one custom order per user (not per filter)
3. **Mobile:** Drag-drop may be less intuitive on touch devices
4. **Large lists:** Performance may degrade with 1000+ cases (mitigation: pagination)

## Performance Considerations

- **Client-side sorting:** All sorting happens in-browser using `useMemo`
- **Optimistic updates:** Local state updates immediately, DB save is async
- **Re-render optimization:** Only reorders when `localOrder` or `customOrderData` changes
- **Drag sensor throttling:** 8px activation threshold reduces false triggers

## Accessibility

✅ **Keyboard Support:**
- Space/Enter to grab item
- Arrow keys to move
- Escape to cancel drag

✅ **Screen Readers:**
- Sortable items announced
- Drag state communicated
- Position changes announced

## Troubleshooting

### Custom order not saving
- Check Convex auth status
- Verify `saveCaseOrder` mutation permissions
- Check browser console for errors
- Verify network tab for mutation calls

### New cases appear in wrong position
- Check `baseSortMethod` in saved custom order
- Verify new case has all required sort fields
- Check console for sort function errors

### Drag not working
- Verify `sort.sortBy === "custom"` (only enabled for custom sort)
- Check 8px activation threshold is met
- Verify pointer events are not blocked
- Check for conflicting event handlers

## Related Documentation

- [Design System](/v2/docs/DESIGN_SYSTEM.md) - Neobrutalist animation principles
- [Case List Implementation](/v2/docs/CASE_LIST.md) - Overall case list architecture
- [Convex Schema](/v2/convex/schema.ts) - Database schema definitions

---

**Maintained by:** Claude Code
**Last Updated:** 2025-12-25
**Version:** 1.1 (Updated for Phase 21 animation changes)
