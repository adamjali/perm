# PERM Tracker v2

Next.js + Convex migration of the PERM case tracking application.

## Tech Stack

- **Framework:** Next.js 16.1.0 (App Router) + React 19
- **Backend/DB:** Convex 1.31.2 (real-time subscriptions)
- **Auth:** @convex-dev/auth with email/password
- **Styling:** Tailwind CSS v4 (CSS-first config)
- **UI Components:** Custom neobrutalist design system + shadcn/ui
- **Theme:** next-themes (dark/light mode)
- **Testing:** Vitest + convex-test (unit), Playwright (E2E)
- **Storybook:** Component development and documentation
- **Email:** React Email + Resend
- **Push:** Web Push with VAPID

## Features

### Case Management
- Full CRUD for PERM cases with real-time sync
- Duplicate detection on create
- Bulk operations (delete, status update, import/export)
- Favorites and pinning
- Soft-delete with restore

### PERM Deadline Engine
- 10 deadline calculators (PWD, recruitment, ETA 9089, I-140, RFI)
- 44 validation rules across 8 categories
- 5 cascade rules for automatic field updates
- Business day calculations with federal holidays

### Dashboard
- Real-time case counts by status
- Deadline urgency grouping (overdue, this week, this month)
- Recent activity feed
- Upcoming deadlines widget

### Timeline Visualization
- Case milestone timeline
- Configurable time ranges (3/6/12/24 months)
- Case selection and filtering
- Framer Motion animations

### Calendar View
- Month/week/day views
- Deadline color coding by case status
- Event filtering and preferences

### Notifications
- In-app notification bell with unread badge
- Full notifications page with tabs and filters
- Email notifications via Resend
- Push notifications via Web Push
- Scheduled deadline reminders (daily cron)
- Weekly digest emails

### Deadline Enforcement
- Auto-closure for deadline violations
- PWD expiration enforcement
- I-140 filing deadline enforcement
- RFI/RFE due date enforcement

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Convex dev server (separate terminal)
npx convex dev

# Start Next.js dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Development

### Running Tests

```bash
pnpm test:run      # Unit tests (3000+ tests)
pnpm test:e2e      # E2E tests (2 tests)
pnpm test:all      # All tests
pnpm test:coverage # Coverage report
```

See [TEST_README.md](TEST_README.md) for complete testing documentation.

### Storybook

```bash
pnpm storybook     # Run Storybook at http://localhost:6006
```

View and interact with all UI components in isolation. Includes:
- Core UI components (Button, Badge, Card, Input, etc.)
- Dashboard components (SummaryTile, SummaryTilesGrid)
- Layout components (Header, ThemeToggle, etc.)
- Status components (CaseStageBadge, ProgressStatusBadge, etc.)
- Dark/light theme toggle in toolbar

### Project Structure

```
v2/
├── convex/                      # Convex functions & schema
│   ├── auth.ts                  # Authentication
│   ├── dashboard.ts             # Dashboard queries
│   ├── schema.ts                # Database schema
│   └── *.test.ts                # Convex unit tests
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── (authenticated)/     # Protected pages (dashboard, etc.)
│   │   ├── globals.css          # Global styles + design tokens
│   │   └── providers.tsx        # App providers (Convex, Theme)
│   ├── components/
│   │   ├── ui/                  # Core UI components (shadcn/ui)
│   │   ├── dashboard/           # Dashboard components
│   │   ├── layout/              # Layout components
│   │   └── status/              # PERM status components
│   └── lib/
│       ├── perm/                # PERM deadline calculations (frontend helpers)
│       └── testUtils.tsx        # React testing utilities
├── test-utils/                  # Test utilities (excluded from Convex)
├── tests/e2e/                   # Playwright E2E tests
└── docs/
    └── DESIGN_SYSTEM.md         # Design system documentation
```

## Environment

- Convex deployment: `giddy-peccary-484.convex.cloud`
- Local dev: `localhost:3000` (Next.js) + Convex cloud

## Key Components

### Dashboard Components

- **SummaryTile** - Case count summary with corner decoration variants
  - Corner variants: `none`, `solid` (color square), `bar` (full-width label), `tag` (pill badge)
  - Hover effects: expanding underline, color transitions, shadow lift
  - Responsive design with theme support

- **SummaryTilesGrid** - Responsive grid layout (2 cols mobile, 3 cols tablet+)
  - Real-time data from Convex
  - Loading states with skeleton UI
  - Configurable corner variants

### Notification Components

- **NotificationBell** - Header notification icon with unread count badge
- **NotificationDropdown** - Dropdown showing recent notifications
- **NotificationList** - Full notification list with pagination
- **NotificationItem** - Individual notification with priority styling
- **NotificationFilters** - Filter by type, priority, read status

### Calendar Components

- **CalendarView** - Month/week/day calendar views
- **DeadlineEvent** - Deadline event with case status color coding
- **EventFilters** - Filter deadlines by type and case

### Timeline Components

- **CaseTimeline** - Visual timeline of case milestones
- **TimelineControls** - Time range and case filters
- **MilestoneMarker** - Individual milestone with date and status

### UI Components

- **Button** - Multiple variants with neobrutalist hard shadows
- **Card** - Container with hover lift effect
- **Badge** - Status indicators with stage colors
- **ThemeToggle** - Animated dark/light mode switcher
- **ProgressRing** - Circular progress indicator
- **Skeleton** - Loading state shimmer animation
- And more... (see Storybook)

### PERM Engine

Comprehensive deadline calculation and validation library:
- 10 deadline calculators (PWD, recruitment, ETA 9089, I-140, RFI)
- 44 validation rules across 8 categories
- 5 cascade rules for automatic field updates
- 100% test coverage (319 tests in PERM module, 3000+ total)
- Isomorphic (browser and Node.js)

See `convex/lib/perm/` for deadline calculation and validation implementations.

## Design System

Neobrutalist design with:
- **Colors:** Forest Green accent (#228B22), black borders, high contrast
- **Typography:** Space Grotesk (headings), Inter (body), JetBrains Mono (code)
- **Shadows:** Hard shadows (no blur) - 2px, 4px, 8px variants
- **Radius:** 0px (pure brutalism)
- **Stage Colors:** PWD (blue), Recruitment (purple), ETA 9089 (orange), I-140 (teal), Closed (gray)

See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for complete design documentation.

## Documentation

- [CLAUDE.md](CLAUDE.md) - Developer guide and patterns
- [docs/API.md](docs/API.md) - Complete Convex API reference
- [TEST_README.md](TEST_README.md) - Testing guide with critical pitfalls
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) - Design system documentation
- [docs/PERM_SYSTEM_ARCHITECTURE.md](docs/PERM_SYSTEM_ARCHITECTURE.md) - PERM engine architecture
- [docs/CASE_CARD.md](docs/CASE_CARD.md) - CaseCard component specifications
- [docs/DRAG_DROP_REORDERING.md](docs/DRAG_DROP_REORDERING.md) - Drag-drop implementation
- [docs/FUZZY_SEARCH.md](docs/FUZZY_SEARCH.md) - Fuzzy search implementation
- [docs/SCHEMA_MIGRATION.md](docs/SCHEMA_MIGRATION.md) - Schema migration guide
- [convex/lib/perm/](convex/lib/perm/) - PERM deadline calculation library
- [.planning/](../.planning/) - Project planning documents
