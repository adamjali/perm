# PERM Tracker v2 Design System

**Framework:** Next.js 16 + React 19 + Tailwind CSS
**Style:** Neobrutalism
**Version:** 2.0
**Last Updated:** 2026-02-06

**Source Files:**
- Design tokens: `v2/src/app/globals.css`
- Component library: `v2/src/components/ui/` and `v2/src/components/status/`
- Storybook: Run `npm run storybook` (http://localhost:6006)

---

## Philosophy

The v2 design system follows **Neobrutalism** principles:

1. **Bold & Direct** - Hard shadows, thick borders, zero border radius
2. **Functional First** - Every element serves a purpose
3. **High Contrast** - Black borders on white backgrounds
4. **Forest Green Accent** - Professional, accessible single accent color
5. **Tactile Interactions** - Components feel pressable and reactive

**Migration from v1:** v2 uses React components (shadcn/ui) instead of v1's CSS classes.

---

## Color Palette

### Base Colors (CSS Variables)

```css
/* Light mode (default) */
--background: #ffffff;
--foreground: #000000;
--card: #ffffff;
--card-foreground: #000000;
--popover: #ffffff;
--popover-foreground: #000000;
--primary: #228B22;          /* Forest Green */
--primary-foreground: #ffffff;
--secondary: #f5f5f5;
--secondary-foreground: #000000;
--muted: #f5f5f5;
--muted-foreground: #737373;
--accent: #f5f5f5;
--accent-foreground: #000000;
--destructive: #ef4444;
--destructive-foreground: #ffffff;
--border: #000000;           /* Black borders everywhere */
--input: #000000;
--ring: #228B22;             /* Forest Green focus ring */
```

### Dark Mode

Dark mode uses brighter Forest Green (`#2ECC40`) and inverted backgrounds while maintaining the hard-edge aesthetic.

**Manila Folder Colors (Dark Mode):**
- Base: `#C4A97A` (darker, warmer tone)
- Dark: `#A8916A` (shadow variant)
- Shadow: `#8A7552` (deepest shadow)

*Note: Dark mode manila colors are intentionally darker than light mode for better contrast on dark backgrounds.*

### Stage Status Colors

From v1, preserved in v2:

| Stage | Variable | Hex | Usage |
|-------|----------|-----|-------|
| PWD | `--stage-pwd` | `#0066FF` | Blue - PWD phase |
| Recruitment | `--stage-recruitment` | `#9333ea` | Purple - Recruitment |
| ETA 9089 | `--stage-eta9089` | `#D97706` | Orange - ETA 9089 |
| ETA 9089 Working | `--stage-eta9089-working` | `#EAB308` | Yellow - Working |
| I-140 | `--stage-i140` | `#059669` | Teal - I-140 |
| Closed | `--stage-closed` | `#6B7280` | Gray - Closed/Archived |

### Urgency Colors

| Level | Variable | Hex | Days Until |
|-------|----------|-----|------------|
| Urgent | `--urgency-urgent` | `#DC2626` | ≤ 7 days |
| Soon | `--urgency-soon` | `#EA580C` | 8-30 days |
| Normal | `--urgency-normal` | `#059669` | 30+ days |

---

## Typography

### Font Families

```css
--font-heading: 'Space Grotesk', sans-serif;  /* Geometric, quirky */
--font-body: 'Inter', sans-serif;             /* Readable, modern */
--font-mono: 'JetBrains Mono', monospace;     /* Technical labels */
```

**Usage:**
- `Space Grotesk` - Headings, buttons, bold UI elements
- `Inter` - Body text, labels, descriptions
- `JetBrains Mono` - Case numbers, dates, technical codes (use `.mono` class)

**Weights:**
- Space Grotesk: 700 (bold)
- Inter: 400 (regular), 500 (medium), 600 (semibold)
- JetBrains Mono: 400 (regular), 500 (medium)

### Type Scale

Follows Tailwind defaults:
- `text-4xl` (2.25rem) - Page headers
- `text-2xl` (1.5rem) - Section headers
- `text-lg` (1.125rem) - Card headers
- `text-base` (1rem) - Body text
- `text-sm` (0.875rem) - Labels, secondary text
- `text-xs` (0.75rem) - Captions, metadata

---

## Shadows

Neobrutalist hard shadows (no blur):

```css
--shadow-hard-sm: 2px 2px 0px #000;
--shadow-hard: 4px 4px 0px #000;
--shadow-hard-lg: 8px 8px 0px #000;
```

**Utility classes:**
- `.shadow-hard-sm`
- `.shadow-hard`
- `.shadow-hard-lg`

**Usage:**
- All badges: `shadow-hard-sm`
- Buttons: `shadow-hard` (default), lifts to `shadow-hard-sm` on hover
- Cards: `shadow-hard`, expands to `shadow-hard-lg` on hover

---

## Border Radius

**v2 Design Decision (Phase 17.1):** Changed to `--radius: 0px` for pure neobrutalist aesthetic (sharp corners).

Components use `rounded-none` (0px) for maximum brutalism.

---

## Spacing

Follows Tailwind spacing scale:
- `space-y-2` (0.5rem / 8px) - Tight grouping
- `space-y-4` (1rem / 16px) - Related elements
- `space-y-6` (1.5rem / 24px) - Section spacing
- `space-y-8` (2rem / 32px) - Major sections

**Container padding:** `p-6` or `p-8` (1.5rem or 2rem)

---

## Components

### Core UI Components (shadcn/ui)

Located in `v2/src/components/ui/`:

1. **Button** - Primary, secondary, destructive, outline, ghost, link variants. Hard shadows with hover lift.
2. **Badge** - Status indicators with 3D shadow. Variants: default, secondary, destructive, outline.
3. **Card** - Container with header/content/footer. Variants: default, dark. Hover lift effect.
4. **Input** - Text fields with hover lift. File input styled to match.
5. **Label** - Form labels with required indicator support.
6. **Dialog** - Modals with overlay and animations.
7. **Sonner** - Toast notifications (light/dark theme support).
8. **Skeleton** - Loading states with shimmer animation. Variants: line, block, circle.
9. **Divider** - Horizontal rule. Variants: default, thick.
10. **ProgressRing** - Circular progress indicator with percentage display.
11. **NavLink** - Navigation links with active state support.

### Status Components (PERM-specific)

Located in `v2/src/components/status/`:

1. **CaseStageBadge** - Case lifecycle stages (PWD, Recruitment, ETA9089, I-140, Closed)
2. **ProgressStatusBadge** - Progress statuses (Working, Waiting Intake, Filed, Approved, etc.)
3. **UrgencyIndicator** - Static colored dots (urgent/soon/normal)
4. **DeadlineIndicator** - Days until deadline with urgency color
5. **StageProgression** - Numbered stage labels with expanding underline hover (signature interaction)

### Dashboard Components

Located in `v2/src/components/dashboard/`:

1. **SummaryTile** - Individual summary tile for case counts by stage
   - Props: `status`, `label`, `count`, `subtext`, `href`, `cornerVariant`
   - Corner variants: `none` (default), `solid` (6x6 color square), `bar` (full-width label bar), `tag` (pill badge)
   - Hover effects: Expanding underline, text color changes to stage color, shadow lift
   - Responsive text sizing (sm breakpoint)
   - Theme-aware colors

2. **SummaryTilesGrid** - Grid container for summary tiles
   - Responsive grid: 2 columns mobile, 3 columns tablet+
   - Fetches data from Convex `dashboard.getSummary`
   - Loading state with skeleton placeholders
   - Supports `cornerVariant` prop to apply decoration to all tiles

### Content Hub Components

Located in `v2/src/components/content/` (16 components, barrel-exported from `index.ts`):

**Article Layout:**
1. **ArticleLayout** - Full article page with hero, table of contents, and related posts
2. **ContentHero** - Article hero section with title, metadata, and featured image
3. **TableOfContents** - Sticky sidebar TOC with scroll-aware active heading highlighting
4. **ReadingProgress** - FM `useScroll` + `useSpring` progress bar at top of article

**Content Display:**
5. **ContentCard** - Card for article previews in listings
6. **ContentGrid** - Responsive grid for content cards
7. **ContentListing** - Full listing page with filters and search
8. **ContentCTA** - Call-to-action block for articles
9. **ChangelogTimeline** - Single-page timeline for changelog entries

**Media:**
10. **ScreenshotFigure** - App screenshot with neobrutalist styling
    - Props: `src`, `alt` (required), `caption?`, `step?` (numbered badge), `maxWidth?`
    - Features: `border-2 border-border shadow-hard`, FM `whileInView` fade-up, green step badge, `font-mono text-xs` caption
    - Uses `not-prose` to escape MDX prose styling
11. **VideoPlayer** - Remotion video player (dynamic import, `ssr: false`)
12. **VideoPlayerInner** - Client-side Remotion `<Player>` wrapper

**Utilities:**
13. **ShareButtons** - Social sharing (Twitter, LinkedIn, copy link)
14. **RelatedPosts** - Related articles by tag similarity
15. **CategoryFilter** - Content type filter tabs
16. **ContentSearch** - Fuzzy search across articles
17. **StructuredData** - JSON-LD structured data via `next/script`

**MDX Components** (defined in `src/lib/content/mdx-components.tsx`):
- `Callout` (info/warning/tip/important), `ProductCTA`, `StepByStep`/`Step`, `ComparisonTable`
- Plus `ScreenshotFigure` and `VideoPlayer` registered for use in MDX articles

### Layout Components

Located in `v2/src/components/layout/`:

1. **Header** - Main navigation header for authenticated pages
2. **AuthHeader** - Simplified header for auth pages (login/signup)
3. **AuthFooter** - Footer for auth pages
4. **ThemeToggle** - Dark/light mode toggle button with animated icon transition

### Component Patterns

**Hover effects:**
- Buttons: Translate down (2px, 2px), reduce shadow (pressed effect)
- Cards: Translate up-left (-2px, -2px), increase shadow (lifted effect)
- Inputs: Translate up (-1px), increase shadow

**Active states:**
- Buttons: Translate down (4px, 4px), remove shadow (fully pressed)
- Cards: Translate down (2px, 2px), remove shadow

**Transitions:**
- Cards: `transition-transform duration-150` (0.15s) for snappiest hover feel
- Buttons: `transition-all duration-200` (0.2s) for balanced interaction
- Theme: `transition-colors duration-300` (0.3s) for smooth mode switching

---

## Utility Classes

### Visual Effects (globals.css)

| Class | Purpose | From |
|-------|---------|------|
| `.grain-overlay` | Subtle SVG noise texture overlay (4% opacity) | design2, design4 |
| `.bg-dots` | Radial dot pattern (24px grid) | design1, design3 |
| `.mono` | JetBrains Mono font | All designs |
| `.skeleton-pulse` | Shimmer animation for loading states | design4 |
| `.hazard-bg` | Yellow/black diagonal stripes | design5 |

### Animations

| Class | Duration | Effect |
|-------|----------|--------|
| `.bounce` | 2s | Vertical bounce + rotation |
| `.bounce-fast` | 1.2s | Faster bounce |
| `.bounce-slow` | 3s | Slower bounce |
| `.bounce-subtle` | 2s | Bounce without rotation |
| `.bounce-spin` | 2s | Bounce with 360° spin |

### Hover Effects

| Class | Effect |
|-------|--------|
| `.card-snappy` | Snappy lift on hover, press on active |

### Decorations

| Class | Effect |
|-------|--------|
| `.corner-accent` | Green triangle in top-right corner |
| `.corner-accent-hazard` | Hazard-striped triangle |
| `.corner-accent-sm` | Smaller corner accent |
| `.corner-accent-lg` | Larger corner accent |
| `.corner-accent-bl` | Bottom-left placement |

### Glass Effect

| Class | Effect |
|-------|--------|
| `.glass-panel` | Frosted glass with backdrop blur (80% opacity white/dark, 10px blur, subtle border) |

**Usage:** Modals, overlays, floating panels. Light mode uses `rgba(255,255,255,0.8)`, dark mode uses `rgba(42,42,42,0.8)`.

**Implementation:**
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);  /* Safari support */
  border: 1px solid rgba(0, 0, 0, 0.1);
}
```

**Example usage:**
```tsx
<div className="glass-panel p-6 shadow-hard">
  {/* Modal content */}
</div>
```

### Custom Scrollbar

Neobrutalist scrollbar styling (webkit browsers):
- Track: `var(--muted)` background
- Thumb: `var(--foreground)` with 3px border
- Hover: Changes to `var(--primary)` (Forest Green)

---

## Storybook

**Run:** `cd v2 && npm run storybook` (http://localhost:6006)

**Stories available:**
- UI components (Button, Badge, Card, Input, Dialog, Label, Sonner, Skeleton, Divider, Utilities)
- Status components (CaseStageBadge, ProgressStatusBadge, UrgencyIndicator, DeadlineIndicator, StageProgression)

**Theme switching:** Use toolbar to toggle light/dark modes.

---

## Accessibility

### Contrast Ratios
- Text on background: 21:1 (WCAG AAA)
- Forest Green on white: 4.5:1+ (WCAG AA Large)
- Status colors: All meet WCAG AA minimum

### Focus States
All interactive elements use Forest Green focus ring:
```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

### Keyboard Navigation
- All components support keyboard navigation
- Dialog: Escape to close, focus trap
- Buttons: Enter/Space activation

### Screen Readers
- Semantic HTML throughout
- ARIA labels on icon-only buttons
- Status badges include accessible text

---

## Design Decisions Log

### Phase 17 (2025-12-22)
- Established neobrutalist base with Forest Green accent
- Hard shadows (no blur), black borders, zero border radius
- Space Grotesk + Inter + JetBrains Mono typography
- shadcn/ui component library

### Phase 17.1 (2025-12-22)
- Added visual polish: grain overlay, dot backgrounds, mono utility
- Created Skeleton, Divider, CardDark, StageProgression components
- Added bounce animations, corner accents, custom scrollbar
- Deferred: hazard stripes, corner labels, knobs, glass panels, typing cursor

### ISS-001 Resolution (2025-12-22)
- Added stage/urgency colors to `@theme inline` for Tailwind utilities
- Enables `bg-stage-pwd`, `text-urgency-urgent`, etc.

### Glass Panel Implementation (2025-12-22)
- Added `.glass-panel` utility class for modal/overlay backgrounds
- Includes backdrop blur (10px) with light/dark mode variants
- Uses webkit prefix for Safari compatibility

### Phase 20 - Dark Mode & Dashboard (2025-12-23)
- Implemented dark mode with `next-themes` provider
- Added ThemeToggle component with animated Sun/Moon icons
- Created SummaryTile component with 4 corner decoration variants
- Created SummaryTilesGrid with responsive 2/3 column layout
- Added dashboard page with summary tiles integration
- Fixed dark mode on auth pages (login/signup)
- Updated AuthHeader with dark mode support
- Added ProgressRing and NavLink UI components
- Enhanced theme transitions (0.3s ease-out) across all elements

### Phase 21 - CaseCard UI Polish (2025-12-25)
- **Thinner borders:** Changed from 4px → 2px for card body, 4px → 1px for folder tab and bookmark
- **Faster transitions:** Migrated from Framer Motion to pure CSS transitions (150ms duration)
- **Stage-colored tabs:** Folder tab now uses stage color background with white text (previously light color with colored text)
- **Darker manila in dark mode:** Updated manila colors (#C4A97A) for better dark mode contrast
- **Menu state tracking:** Dropdown menu no longer collapses card on open (tracks `isMenuOpen` state)
- **Universal drag-drop:** All cases now use SortableCaseCard wrapper regardless of sort mode (simpler architecture)
- **Z-index layering fix:** Left color bar z-20 (above content, below tab) to prevent overlap issues

**Design Rationale:**
- Thinner borders reduce visual weight while maintaining brutalist aesthetic
- 150ms transitions feel snappier than 300ms (matches user expectation for hover feedback)
- Stage-colored tabs improve information hierarchy (stage is primary indicator)
- Universal SortableCaseCard simplifies code and ensures consistent behavior

### Phase 25 - Settings & Motion Library (2025-12-31)
- **Motion library integration:** Added `motion/react` for snappy page transitions
- **Tab switch animation:** Settings layout content fades + slides (150ms, ease-out) on section change
- **Success feedback:** Animated checkmark with spring physics after successful save
- **Status text transitions:** AnimatePresence for clean state changes (dirty/saved/clean)

**Animation Guidelines:**
- All transitions: 150ms maximum for snappy feel
- Use `motion/react` import for client components
- Prefer CSS transitions for simple hover/active states
- Use Motion for complex state-based animations (enter/exit, springs)

### ISS-020 Resolution - Settings Keyboard Navigation (2026-01-03)
- **Full WAI-ARIA keyboard navigation** for Settings tabs
- Desktop (vertical): ArrowUp/ArrowDown to move between tabs
- Mobile (horizontal): ArrowLeft/ArrowRight to move between tabs
- Home/End keys to jump to first/last tab
- Roving tabindex pattern (active tab = tabIndex 0, others = -1)

### ISS-021 Resolution - Tab Styling Decision (2026-01-03)

**Two Tab Styling Patterns:**

| Pattern | Component | Typography | Use Case |
|---------|-----------|------------|----------|
| **Text-only tabs** | `NotificationTabs` | `uppercase tracking-wide` | Short text labels without icons |
| **Icon + text tabs** | `SettingsLayout` | Normal case | Longer labels with icons |

**Rationale:**
- **NotificationTabs** uses uppercase because tabs are short, text-only labels (All, Unread, Deadlines). Uppercase with wide tracking improves scanability and creates visual weight without icons.
- **SettingsLayout** uses normal case because tabs include icons that provide visual weight. Uppercase + icons would be visually heavy and harder to read.

**Guidelines:**
- Use `uppercase tracking-wide` for text-only tab bars with short labels
- Use normal case for tabs with icons or longer descriptive labels
- Both patterns share the same base styling: font-heading, font-bold, 2px borders, active state with bg-black/text-white

---

## Migration from v1

| v1 Pattern | v2 Equivalent |
|------------|---------------|
| `.btn-brutalist` class | `<Button>` component |
| `.card-brutalist` class | `<Card>` component |
| CSS variables in `main.css` | CSS variables in `globals.css` |
| Alpine.js state | React hooks |
| Manual dark mode class | `next-themes` provider |

---

## Resources

- **shadcn/ui docs:** https://ui.shadcn.com/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **next-themes:** https://github.com/pacocoursey/next-themes
- **Motion (Framer Motion):** https://motion.dev/docs/react-quick-start
- **Design references:** `.planning/phases/17-design-system/design1-5/`
- **Design skill:** `.planning/FRONTEND_DESIGN_SKILL.md` (frontend-design skill, its a plug-in)

---

**Maintained by:** Claude Code
**Last Review:** 2026-02-06
**Phase:** Content Hub Visual Aids
