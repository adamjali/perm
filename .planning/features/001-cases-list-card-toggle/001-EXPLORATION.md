# Feature 001: Exploration

**Feature:** Cases list/card view toggle with sections and stunning animations
**Date:** 2026-01-27

## Similar Features

### Existing Toggle Patterns Found

1. **ActionModeToggle** (`src/components/chat/ActionModeToggle.tsx`)
   - Segmented control with 3 modes (off/confirm/auto)
   - Neobrutalist styling: `border-2 border-border bg-background shadow-[2px_2px_0px_#000]`
   - Active: `bg-primary text-primary-foreground` (Forest Green)
   - Inactive: `bg-background text-foreground hover:bg-muted`
   - Icon-based with portal tooltips
   - Motion scale pulse on state change
   - Uses `motion/react` (Framer Motion)

2. **Show By Tabs** (`src/components/cases/CaseFilterBar.tsx`)
   - Button-based tab row: Active | Completed | Closed/Archived | All
   - Active variant: `variant="default"` (filled)
   - Inactive variant: `variant="outline"`
   - No animation on switch, instant state change

3. **ThemeToggle** (`src/components/layout/ThemeToggle.tsx`)
   - Icon rotation on hover: `group-hover:rotate-[20deg] group-hover:scale-110`
   - Active press: `group-active:rotate-0 group-active:scale-95`

### Data Display Patterns

1. **CaseCard** (`src/components/cases/CaseCard.tsx`)
   - Manila folder metaphor with neobrutalist design
   - Left color bar (6px) for stage indication
   - Paper texture overlay
   - Hover expansion reveals more content
   - Click-to-pin interaction with visual feedback
   - Uses `SortableCaseCard` wrapper for drag-and-drop

2. **Grid Layout** (`CasesPageClient.tsx`)
   - Current: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
   - Responsive: 1/2/3 columns by breakpoint
   - Cards include `mt-8` for folder tab overflow

## Architecture Patterns

### State Management
- URL params sync for filters/sort/pagination
- Local state for UI interactions (hover, selection mode)
- Convex real-time queries for data
- localStorage for user preferences (page size)

### Animation Infrastructure
- **Primary library:** `motion` v12.29.2 (motion.dev / Framer Motion fork)
- **Also available:** `lottie-react` for complex animations
- **Tailwind animations:** `tw-animate-css`

### Animation Constants (`src/lib/animations.ts`)
```typescript
STAGGER_DELAY = 0.1;        // Standard stagger
MAX_DURATION = 0.5;         // Maximum duration
springConfig = { type: "spring", stiffness: 500, damping: 30 };
quickSpringConfig = { type: "spring", stiffness: 600, damping: 25 };
```

### Neobrutalist Design Tokens
```css
--shadow-hard-sm: 2px 2px 0px var(--border);
--shadow-hard: 4px 4px 0px var(--border);
--shadow-hard-lg: 8px 8px 0px var(--border);
--radius: 0px;  /* Sharp corners everywhere */
```

### CSS Hover Effects (from globals.css)
```css
.card-snappy { transition: all 0.15s cubic-bezier(0.165, 0.84, 0.44, 1); }
.card-snappy:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-hard-lg); }
.card-snappy:active { transform: translate(2px, 2px); box-shadow: none; }

.hover-lift { transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; }
.hover-lift:hover { transform: translateY(-2px); box-shadow: var(--shadow-hard); }
```

## Key Files to Examine

### Primary Files to Modify
| File | Purpose |
|------|---------|
| `v2/src/app/(authenticated)/cases/CasesPageClient.tsx` | Main cases page - add toggle, conditional rendering |
| `v2/src/components/cases/CaseFilterBar.tsx` | Add view toggle control |

### New Files to Create
| File | Purpose |
|------|---------|
| `v2/src/components/cases/ViewToggle.tsx` | Card/List toggle component |
| `v2/src/components/cases/CaseListRow.tsx` | Row component for list view |
| `v2/src/components/cases/CaseListGroup.tsx` | Group header for sectioned list |
| `v2/src/components/cases/CaseListView.tsx` | List view container with grouping logic |

### Reference Files
| File | Purpose |
|------|---------|
| `v2/src/components/chat/ActionModeToggle.tsx` | Segmented control pattern |
| `v2/src/lib/animations.ts` | Animation variants and springs |
| `v2/src/components/cases/CaseCard.tsx` | Card data structure |
| `v2/src/components/cases/case-card.utils.ts` | Formatting helpers |

## Integration Points

### Header Section (where toggle will go)
Current structure in `CasesPageClient.tsx`:
```jsx
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div>
    <h1 className="font-heading text-3xl font-bold">Cases</h1>
    <p className="text-muted-foreground mt-1">{totalCount} cases</p>
  </div>
  {/* Toggle will go here, between title and action buttons */}
  <div className="flex flex-wrap items-center gap-3">
    {/* Selection, Import, Add Case buttons */}
  </div>
</div>
```

### Case Data Available (for list row display)
```typescript
interface CaseCardData {
  _id: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: CaseStatus;       // pwd | recruitment | eta9089 | i140 | closed
  progressStatus: ProgressStatus;
  nextDeadline?: string;        // ISO date
  nextDeadlineLabel?: string;
  isFavorite: boolean;
  isPinned: boolean;
  calendarSyncEnabled?: boolean;
  dates: CaseCardDates;
}
```

### Sorting Options (for grouping logic)
- `employer` - Group by employer name (alphabetical sections)
- `deadline` - Group by deadline proximity (Today, This Week, This Month, Later)
- `status` - Group by case status (PWD, Recruitment, ETA 9089, I-140)
- `updated` - Group by recency (Today, This Week, This Month, Older)

## Technical Considerations

### View State Persistence
- Store view preference in localStorage: `perm-tracker-view-mode`
- Values: `"card"` | `"list"`
- Default: `"card"` (current behavior)

### Grouping Logic
When sorting is:
- `employer` → Alphabetical sections (A, B, C, ...)
- `deadline` → Time-based sections (Overdue, Today, This Week, This Month, Later)
- `status` → Stage sections (PWD, Recruitment, ETA 9089, I-140, Closed)
- `favorites` → Favorites / Others
- Others → No grouping (flat list)

### Animation Strategy
1. **Toggle switch:** Scale pulse + icon swap animation
2. **View transition:** Crossfade between card grid and list (opacity + y transform)
3. **List row hover:** Lift effect with shadow expansion
4. **Group headers:** Sticky with subtle shadow on scroll
5. **Stagger:** List items animate in with 0.05s stagger (mobile-optimized)

### Accessibility
- Toggle is a `role="radiogroup"` with `role="radio"` segments
- List rows are keyboard navigable
- Group headers are `role="heading"`
- ARIA labels for all interactive elements
- Respects `prefers-reduced-motion`
