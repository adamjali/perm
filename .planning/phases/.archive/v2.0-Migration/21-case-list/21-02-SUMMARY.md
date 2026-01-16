# Phase 21-02 Summary: CaseCard Component

**Status:** Complete
**Date:** 2025-12-25

## Objective

Build the signature CaseCard component with manila folder metaphor, hover-to-expand animation, and neobrutalist styling.

## Delivered

### Core Component
- `v2/src/components/cases/CaseCard.tsx` - Full CaseCard implementation
- `v2/src/components/cases/CaseCard.stories.tsx` - Comprehensive Storybook stories
- `v2/src/components/cases/__tests__/CaseCard.test.tsx` - 45 test cases
- `v2/src/components/cases/index.ts` - Barrel export

### Supporting Components
- `v2/src/components/ui/dropdown-menu.tsx` - Dropdown menu for actions
- `v2/src/components/ui/checkbox.tsx` - Selection checkbox

### Features Implemented
1. **Manila Folder Metaphor**
   - Beige card body (`#F5E6C8` via CSS variable)
   - Folder tab extending ABOVE card with stage name
   - Left color bar (6px) for stage identification
   - Paper texture overlay

2. **Favorite Bookmark Tab**
   - Bookmark-shaped tab at top right (behind card)
   - Yellow when favorited, gray otherwise
   - Framer Motion animations: hover peek (-10px), tap scale, spring toggle
   - Replaces old star icon

3. **Hover-to-Expand Animation**
   - Framer Motion `AnimatePresence` for smooth expand/collapse
   - Shows detailed dates grid (PWD, Recruitment, ETA, I-140)
   - Notes preview with line clamping
   - Card lift effect on hover

4. **Action Buttons**
   - View (primary green), Edit, More menu
   - Transparent backgrounds with black borders
   - Closed cases: View, Reopen, Delete

5. **Visual States**
   - Stage colors: PWD blue, Recruitment purple, ETA orange, I-140 green
   - Progress status badge always visible
   - Urgent deadlines: red background, pulse animation
   - Closed cases: grayscale filter, muted styling

6. **Selection Mode**
   - Checkbox at top-LEFT when in selection mode
   - Dark forest green checkbox styling
   - Ring highlight when selected

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Same colors in light/dark mode | Manila folder look preserved across themes |
| Bookmark tab behind card (z-0) | Visual metaphor of bookmark peeking out |
| Black text for deadlines | Maximum readability on manila background |
| PRO badge with gray fill | Grayscale to not compete with stage colors |
| framer-motion for animations | Smooth, declarative, React-native |
| Selection checkbox top-left | Clear of bookmark tab on right |

## Test Coverage

- 45 CaseCard-specific tests
- 992 total tests passing
- Covers: rendering, interactions, states, accessibility

## Files Modified

**Created:**
- `v2/src/components/cases/CaseCard.tsx`
- `v2/src/components/cases/CaseCard.stories.tsx`
- `v2/src/components/cases/__tests__/CaseCard.test.tsx`
- `v2/src/components/cases/index.ts`
- `v2/src/components/ui/dropdown-menu.tsx`
- `v2/src/components/ui/checkbox.tsx`

**Modified:**
- `v2/convex/lib/caseListTypes.ts` - Added closedReason, closedAt fields
- `v2/convex/lib/caseListHelpers.ts` - Populate closed case fields
- `v2/src/app/globals.css` - Manila folder CSS variables
- `v2/package.json` - framer-motion dependency
- `v2/test-utils/render-utils.tsx` - userEvent support

## Human Checkpoints

- Round 1: Manila look, deadline labels, checkbox position, progress visibility
- Round 2: Dark mode readability, z-index, transparent buttons
- Round 3: Padding, deadline text black, View button border
- Round 4: Same colors light/dark, PRO badge fill, button borders
- Round 5: Bookmark tab with Framer Motion animations

## Next Steps

Ready for **21-03-PLAN.md**: Case List Page & Filters
