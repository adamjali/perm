# Calendar & Timeline Component Refactoring Summary

**Date:** 2026-01-09
**Objective:** Simplify calendar and timeline components while preserving all functionality.

---

## Changes Made

### 1. Calendar Component Simplifications

#### **CalendarView.tsx**
- **Extracted animation configurations** to `src/lib/calendar/animations.ts`:
  - `springTransition` - Spring physics config for neobrutalist animations
  - `fadeVariants` - Fade animation variants for view transitions
  - `fadeTransition` - Transition duration constant

- **Extracted event styling** to `src/lib/calendar/eventStyles.ts`:
  - `eventStyleBase` - Base styles for all calendar events
  - `createEventPropGetter()` - Factory function for stage-based event coloring

- **Consolidated configuration**:
  - Combined `views`, `customComponents`, and `eventPropGetter` into single `useMemo()` for better performance
  - Reduced duplication of animation configs across multiple transitions

**Result:** CalendarView.tsx reduced from 909 lines to ~850 lines, with reusable utilities extracted.

---

### 2. Timeline Component Simplifications

#### **New Shared Utilities**

**`src/lib/timeline/positioning.ts`**
- `calculatePosition()` - Calculate horizontal position as percentage for a date
- `calculateRangePosition()` - Calculate start/end positions for range bars with clamping
- `clampPosition()` - Clamp position to valid 0-100 range

**`src/lib/timeline/constants.ts`**
- `SIDEBAR_WIDTH_CLASSES` - Responsive sidebar width classes (used in Grid and Row)
- `SIDEBAR_WIDTHS` - Numeric width values for calculations
- `Z_INDEX` - Centralized z-index layers (base, hovered, tooltipHovered)
- `TIMELINE_ANIMATION` - Animation config (stagger delay, spring physics)

#### **TimelineRow.tsx**
- Removed duplicate `calculatePosition()` function (now imported)
- Simplified range bar position calculation using `calculateRangePosition()`
- Replaced hardcoded sidebar width classes with `SIDEBAR_WIDTH_CLASSES`
- Replaced magic z-index values with `Z_INDEX` constants

**Result:** Reduced from 312 lines to ~280 lines.

#### **TimelineGrid.tsx**
- Replaced hardcoded sidebar widths with `SIDEBAR_WIDTH_CLASSES`
- Replaced animation config with `TIMELINE_ANIMATION` constants
- **Consolidated TodayIndicator** component:
  - Reduced 3 separate indicators (mobile/tablet/desktop) to a single `.map()` loop
  - Extracted common styles to `createIndicatorStyle()` and `labelBaseClasses`

**Result:** Reduced from 325 lines to ~280 lines.

#### **TimelineRangeBar.tsx**
- Simplified position clamping using `clampPosition()` utility
- Replaced z-index magic numbers with `Z_INDEX` constants
- Early return pattern for invalid widths

**Result:** More readable and consistent with other components.

#### **TimelineMilestoneMarker.tsx**
- Simplified position clamping using `clampPosition()` utility
- Replaced z-index magic numbers with `Z_INDEX` constants

**Result:** More readable and consistent with other components.

---

## Benefits

### **DRY/KISS Principles Applied**
- **No duplicates:** Position calculations, sidebar widths, z-index values, and animation configs now centralized
- **Minimal code:** Removed ~150 lines across timeline components through consolidation
- **Single source of truth:** Constants defined once, imported everywhere

### **Maintainability Improvements**
- **Easy updates:** Change sidebar widths in one place, affects all timeline components
- **Consistent behavior:** All position calculations use same logic
- **Clear intent:** Named constants (`Z_INDEX.tooltipHovered`) vs magic numbers (`100`)

### **Readability Enhancements**
- **Reduced nesting:** TodayIndicator now uses `.map()` instead of 3 separate JSX blocks
- **Self-documenting:** `createEventPropGetter()` vs inline logic
- **Clearer imports:** See exactly what utilities are used

---

## Functionality Verification

### **Tests Passing**
```bash
pnpm test:fast
# ✓ 1394 tests passed (44 test files)
# All calendar and timeline functionality preserved
```

### **No Breaking Changes**
- All props interfaces unchanged
- All exported components unchanged
- All callbacks and event handlers preserved
- All styling and animations identical

### **File Structure**
```
v2/
├── src/
│   ├── lib/
│   │   ├── calendar/
│   │   │   ├── animations.ts          # NEW - Animation configs
│   │   │   ├── eventStyles.ts         # NEW - Event styling utilities
│   │   │   ├── localizer.ts
│   │   │   └── types.ts
│   │   └── timeline/
│   │       ├── constants.ts           # NEW - Shared constants
│   │       ├── positioning.ts         # NEW - Position calculations
│   │       ├── milestones.ts
│   │       └── types.ts
│   └── components/
│       ├── calendar/
│       │   ├── CalendarView.tsx       # SIMPLIFIED
│       │   ├── CalendarToolbar.tsx
│       │   ├── CalendarEvent.tsx
│       │   └── ...
│       └── timeline/
│           ├── TimelineGrid.tsx       # SIMPLIFIED
│           ├── TimelineRow.tsx        # SIMPLIFIED
│           ├── TimelineRangeBar.tsx   # SIMPLIFIED
│           ├── TimelineMilestoneMarker.tsx  # SIMPLIFIED
│           └── ...
```

---

## Key Patterns Applied

### **1. Extract Constants**
```typescript
// Before: Magic numbers scattered across files
className="z-10 hover:z-[100]"

// After: Named constants
className={`z-${Z_INDEX.base} hover:z-${Z_INDEX.tooltipHovered}`}
```

### **2. Factory Functions**
```typescript
// Before: Inline callback
const eventPropGetter: EventPropGetter<CalendarEvent> = useCallback(
  (event) => {
    const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
    // ... 15 lines of logic
  },
  []
);

// After: Factory function
const eventPropGetter = useMemo(() => createEventPropGetter(), []);
```

### **3. Consolidated Configuration**
```typescript
// Before: 3 separate useMemo calls
const views = useMemo(() => [...], []);
const components = useMemo(() => ({...}), []);
const getter = useCallback(() => {...}, []);

// After: Single configuration object
const { views, customComponents, eventPropGetter } = useMemo(
  () => ({ views: [...], customComponents: {...}, eventPropGetter: createGetter() }),
  []
);
```

### **4. Loop Over Repetition**
```typescript
// Before: 3 separate JSX blocks for responsive indicators
<div className="sm:hidden">...</div>
<div className="hidden sm:block md:hidden">...</div>
<div className="hidden md:block">...</div>

// After: Single loop
{[mobile, tablet, desktop].map(({ width, className }) => (
  <div className={className}>...</div>
))}
```

---

## Next Steps

1. **Monitor production:** Verify no visual regressions after deployment
2. **Document patterns:** Add to project style guide for future components
3. **Apply to other areas:** Calendar/Timeline refactoring can be template for other complex components

---

**Impact:** Reduced codebase complexity, improved maintainability, preserved all functionality. All tests pass.
