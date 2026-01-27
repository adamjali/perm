# Feature 001: Clarifications

**Feature:** Cases list/card view toggle with sections and stunning animations
**Date:** 2026-01-27

## Questions & Answers

### Grouping Strategy
**Q:** How should the list view be grouped when sorted by different criteria?
**A:** Smart Auto-Group - Alphabetical for employer, time-based for deadline, stage-based for status. Match the current card view's grouping logic where possible. Header area doesn't change.

### Row Information Density
**Q:** What info should be visible in each list row?
**A:** Compact - Employer, position, stage badge, deadline, progress status. Clean and scannable.

### Toggle Placement
**Q:** Where should the view toggle be positioned?
**A:** Header Right - Between 'Cases' title and action buttons. Specifically, positioned RIGHT NEXT TO the "Cases" title (not in the action buttons area).

### Interaction Model
**Q:** Should the list rows support the same interactions as cards?
**A:** Simplified - Click to view only, no pin/favorite from list. Keep the list view clean and focused on quick scanning/navigation.

## Implications

### Design Decisions

1. **Toggle Position:** Create a compact icon toggle (Grid/List icons) placed immediately after the Cases title, in the same `<div>` as the title and subtitle.

2. **List Row Design:**
   - Single-line or two-line compact row
   - Stage color indicator (left bar or badge)
   - Employer + position as primary info
   - Deadline badge with urgency coloring
   - Progress status badge
   - Row click → navigate to case detail

3. **Grouping Implementation:**
   - Reuse sorting logic already in place
   - Add grouping computation based on sort field
   - Sticky group headers with subtle scroll shadow
   - Same grouping in card view (no change to cards)

4. **Interaction Simplification:**
   - No drag-to-reorder in list view
   - No click-to-pin
   - No favorite bookmark toggle
   - Selection mode still works (checkboxes)
   - Row click → `/cases/[id]` navigation

5. **Animation Strategy:**
   - Toggle: Icon swap with scale pulse
   - View transition: Crossfade (150-200ms)
   - List rows: Staggered fade-in (0.05s mobile, 0.1s desktop)
   - Hover: Subtle lift effect with shadow

### Technical Notes

- Store view preference in localStorage: `perm-tracker-view-mode`
- No URL param for view mode (filter/sort are URL params, view is preference)
- DnD context stays active for card view, disabled for list view
- Selection mode works in both views
