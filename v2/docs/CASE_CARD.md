# CaseCard Component Documentation

**Component:** `v2/src/components/cases/CaseCard.tsx`
**Design Metaphor:** Manila folder with neobrutalist styling
**Version:** 2.0 (Phase 21)
**Last Updated:** 2025-12-25

## Overview

The CaseCard component displays PERM case information using a manila folder metaphor with neobrutalist design principles. It serves as the primary UI element in the cases list view.

## Design Specifications

### Border Widths (Updated Phase 21)

| Element | Width | Rationale |
|---------|-------|-----------|
| Card body | 2px | Reduced from 4px for lighter visual weight |
| Folder tab | 1px | Reduced from 4px for refined appearance |
| Bookmark | 1px | Reduced from 4px to match tab |
| Dividers (internal) | 1px | Subtle separation for expanded content |

**Design Decision:** Thinner borders maintain brutalist aesthetic while reducing visual clutter, especially when displaying multiple cards in a grid.

### Folder Tab (Stage Indicator)

**Position:** Absolute, extends above card body
**Dimensions:** 136px width × 24px height
**Shape:** Trapezoid with 8px angled corners
**Background:** Stage color (solid)
**Text:** White, uppercase, mono font, 0.625rem

**Color Mapping:**
- PWD: `#0066FF` (Blue)
- Recruitment: `#9333ea` (Purple)
- ETA 9089: `#D97706` (Orange)
- I-140: `#059669` (Teal)
- Closed: `#6B7280` (Gray)

**Phase 21 Change:** Previously used light tinted background with colored text. Now uses full stage color with white text for better hierarchy and contrast.

### Manila Folder Colors

**Light Mode:**
- Base: `#F5E6C8`
- Dark: `#E8D4A8`
- Shadow: `#D4C090`

**Dark Mode (Updated Phase 21):**
- Base: `#C4A97A` (darker, warmer tone)
- Dark: `#A8916A`
- Shadow: `#8A7552`

**Rationale:** Dark mode manila colors are intentionally darker for better contrast against dark backgrounds while maintaining the warm, paper-like feel.

### Z-Index Layering (Fixed Phase 21)

| Element | Z-Index | Layer Purpose |
|---------|---------|---------------|
| Paper texture overlay | 1 | Subtle grain effect |
| Expanded content | 10 | Hover details |
| Left color bar | 20 | Stage indicator (must be above content) |
| Folder tab | 10 | Top decoration |
| Bookmark | 0 | Side decoration |

**Critical Fix:** Left color bar set to z-20 to prevent being covered by expanded content while staying below the folder tab.

### Transitions & Animations (Updated Phase 21)

**Migration:** Removed Framer Motion dependency, now uses pure CSS transitions.

```css
/* Card hover */
transition: transform 150ms ease-out;

/* Shadow changes */
transition: shadow 150ms ease-out;
```

**Hover Effects:**
- Card lifts: `transform: translateY(-4px)`
- Shadow expands: `shadow-hard` → `shadow-hard-lg`
- Expanded content reveals with max-height transition

**Rationale:** 150ms is snappier than previous 300ms, providing immediate visual feedback while still feeling smooth. Pure CSS transitions are more performant than Framer Motion for simple hover states.

### Expanded Content

**Trigger:** Mouse hover over card body (not buttons area)
**Behavior:** Smooth expansion via max-height transition
**Background:** `rgba(255,255,255,0.6)` (semi-transparent overlay)
**Contains:**
- Detailed dates grid
- Recruitment details (if applicable)
- Priority information
- Notes preview (truncated to 2 lines)

**Phase 21 Fix:** Menu open state now tracked (`isMenuOpen`). Card won't collapse while dropdown menu is active, preventing jarring UX when clicking menu options.

### Bookmark (Favorite Indicator)

**Position:** Absolute, top-right, extends above card
**Dimensions:** 32px width × 48px height
**Border:** 1px (top and sides only)
**States:**
- Unfavorited: Translucent gray with dashed border
- Favorited: Solid yellow (`#FBBF24`) with solid border, pre-lifted
- Hover: Lifts further upward

**Animation:** 150ms ease transition on all state changes

### Action Buttons Bar

**Position:** Bottom of card, full-width
**Background:** `var(--manila-dark)` (darker manila tone)
**Border:** 1px top border with reduced opacity
**Layout:** Flexbox, gap-2

**Buttons (Active Cases):**
1. "View Details" (outline) - Links to case detail page
2. "More" menu (outline) - Archive/Delete actions

**Buttons (Closed Cases):**
1. "Reopen" (outline) - Restore to active
2. "View Details" (outline) - Read-only view
3. "More" menu (outline) - Permanent delete only

**Hover Tracking:** `hoverStartedFromButtons` flag prevents card expansion when hovering over buttons area (focused interaction).

## Component Architecture

### Props Interface

```typescript
interface CaseCardProps {
  case: CaseCardData;        // Case data from Convex
  isSelected?: boolean;       // Multi-select mode
  onSelect?: (id: string) => void;  // Selection callback
  selectionMode?: boolean;    // Enable selection checkbox
}
```

### State Management

```typescript
const [isHovered, setIsHovered] = useState(false);
const [hoverStartedFromButtons, setHoverStartedFromButtons] = useState(false);
const [isMenuOpen, setIsMenuOpen] = useState(false);
```

**Key States:**
- `isHovered` - Controls expanded content visibility
- `hoverStartedFromButtons` - Prevents expansion when interacting with buttons
- `isMenuOpen` - Prevents collapse while dropdown menu is open

### Helper Functions

1. `getUrgencyLevel(date)` - Calculates urgent/soon/normal from deadline
2. `getUrgencyDotColor(urgency)` - Maps urgency to color
3. `getStageColorVar(stage)` - Returns CSS variable for stage color
4. `formatDate(dateString)` - Formats dates for display
5. `extractCityState(location)` - Parses location string

## Accessibility

- **Semantic HTML:** Uses `<div>` with `role="button"` for interactive elements
- **Keyboard Support:** Checkbox, buttons, and links are keyboard navigable
- **ARIA Labels:** Bookmark button includes `aria-label` and `aria-pressed`
- **Focus States:** All interactive elements have visible focus rings
- **Color Contrast:** Stage colors meet WCAG AA standards

## Integration with Drag-Drop

The CaseCard is wrapped by `SortableCaseCard` for drag-and-drop functionality:

```tsx
<SortableCaseCard case={caseData} index={index} />
```

**Universal Wrapper (Phase 21):** All cases now use `SortableCaseCard` regardless of sort mode, simplifying architecture and ensuring consistent behavior.

## Performance Considerations

- **Pure CSS transitions:** No JavaScript animation libraries
- **Conditional rendering:** Expanded content only renders when hovered
- **Memoization:** Helper functions are pure (no side effects)
- **Optimistic UI:** State changes happen immediately, mutations async

## Common Patterns

### Adding a New Field to the Card

1. Update `CaseCardData` type in `/convex/lib/caseListTypes.ts`
2. Add field to Convex query in `/convex/cases.ts`
3. Render field in appropriate section (visible or expanded)
4. Update tests

### Modifying Hover Behavior

1. Adjust `onMouseEnter`/`onMouseLeave` handlers
2. Update `isHovered` state logic
3. Modify transition durations in className strings
4. Test with buttons area and menu interactions

### Changing Stage Colors

1. Update CSS variables in `/v2/src/app/globals.css`
2. Verify `getStageColorVar()` returns correct variable
3. Check contrast ratios for accessibility
4. Test in both light and dark modes

## Related Components

- **SortableCaseCard** - Drag-drop wrapper (always used)
- **CaseStageBadge** - Renders stage badge
- **ProgressStatusBadge** - Renders progress status
- **CaseFilterBar** - Controls filtering and sorting
- **CasePagination** - Handles pagination

## Testing

### Manual Testing Checklist

- [ ] Hover shows expanded content
- [ ] Hover over buttons area does NOT expand
- [ ] Menu dropdown keeps card expanded
- [ ] Favorite toggle animates smoothly
- [ ] Closed cases show correct gray styling
- [ ] Dark mode manila colors look correct
- [ ] All transitions feel snappy (150ms)
- [ ] Z-index layering is correct (bar above content)

### Automated Tests

**Location:** TBD - `/v2/src/components/cases/__tests__/CaseCard.test.tsx`

**Planned:**
1. Renders with required props
2. Shows/hides expanded content on hover
3. Handles favorite toggle
4. Displays correct stage colors
5. Formats dates correctly
6. Handles selection mode
7. Renders closed state correctly

## Known Issues & Limitations

1. **Hover on touch devices:** Expanded content may not work well on mobile (consider tap-to-expand)
2. **Long employer names:** May overflow card width (consider truncation)
3. **No virtualization:** Large lists (1000+ cards) may have performance issues

## Future Enhancements

1. **Mobile-first expansion:** Tap-to-expand instead of hover
2. **Card size variants:** Compact, default, detailed
3. **Quick actions:** Swipe gestures for common actions
4. **Skeleton loading:** Show placeholder while loading
5. **Customizable fields:** User chooses which fields to display

---

**Maintained by:** Claude Code
**Phase:** 21 (CaseCard UI Polish)
**Related Docs:**
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) - Overall design patterns
- [DRAG_DROP_REORDERING.md](DRAG_DROP_REORDERING.md) - Drag-drop integration
