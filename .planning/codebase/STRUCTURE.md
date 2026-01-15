# Codebase Structure

**Analysis Date:** 2026-01-03

## Directory Layout

```
v2/
├── convex/                 # Backend: Convex functions + business logic
│   ├── lib/               # Shared backend utilities
│   │   └── perm/          # PERM business logic (canonical)
│   ├── _generated/        # Auto-generated Convex API types
│   └── __tests__/         # Convex function tests
├── src/                    # Frontend: Next.js application
│   ├── app/               # App Router pages and layouts
│   ├── components/        # Reusable React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and helpers
│   └── emails/            # React Email templates
├── public/                 # Static assets (icons, service worker)
├── test-utils/            # Shared test utilities and fixtures
├── tests/                 # E2E tests (Playwright)
├── docs/                  # Project documentation
└── .storybook/            # Storybook configuration
```

## Directory Purposes

**convex/**
- Purpose: Backend functions, database schema, business logic
- Contains: Queries, mutations, actions, crons
- Key files: schema.ts, cases.ts, users.ts, crons.ts
- Subdirectories: lib/perm/ (business logic), __tests__/

**convex/lib/perm/**
- Purpose: Central PERM business logic (single source of truth)
- Contains: Calculators, validators, date utilities, cascading logic
- Key files: index.ts (exports), types.ts, cascade.ts
- Size: 9,980 lines across 30+ modules
- Critical: All deadline/validation logic lives here

**src/app/**
- Purpose: Next.js App Router pages and layouts
- Contains: Page components, route handlers, layouts
- Key files: layout.tsx (root), providers.tsx
- Subdirectories:
  - `(auth)/` - Login, signup, reset-password
  - `(authenticated)/` - Dashboard, cases, settings
  - `(public)/` - Home, demo, contact, privacy, terms
  - `api/` - Route handlers (Google OAuth)

**src/components/**
- Purpose: Reusable React components
- Contains: UI primitives, feature components, forms
- Key files: CaseForm.tsx, CaseCard.tsx
- Subdirectories:
  - `ui/` - shadcn/ui primitives
  - `forms/` - Form components and sections
  - `cases/` - Case-specific components
  - `dashboard/` - Dashboard widgets
  - `layout/` - Header, footer, navigation
  - `settings/` - Settings page components

**src/lib/**
- Purpose: Frontend utilities and helpers
- Contains: Validation schemas, contexts, constants
- Key files: case-form-schema.ts, AuthContext.tsx
- Subdirectories:
  - `perm/` - Re-exports from convex/lib/perm
  - `forms/` - Form helpers and Zod resolver
  - `import/` - CSV/JSON case import
  - `export/` - Case export logic
  - `demo/` - Demo mode utilities
  - `google/` - OAuth helpers
  - `contexts/` - React contexts

**src/emails/**
- Purpose: React Email templates for transactional emails
- Contains: DeadlineReminder, StatusChange, RfiAlert, WeeklyDigest
- Pattern: React components rendered to HTML

**test-utils/**
- Purpose: Shared test utilities and fixtures
- Contains: Render helpers, mock factories, fixtures
- Key files: render-utils.tsx, dashboard-fixtures.ts

## Key File Locations

**Entry Points:**
- src/app/layout.tsx - Root layout (Convex auth setup)
- src/app/providers.tsx - Client provider wrapper
- convex/crons.ts - Scheduled job definitions

**Configuration:**
- package.json - Dependencies, scripts
- tsconfig.json - TypeScript strict mode
- next.config.ts - Next.js + Sentry
- vitest.config.ts - Test configuration
- convex/schema.ts - Database schema

**Core Logic:**
- convex/lib/perm/index.ts - PERM business logic exports
- convex/cases.ts - Case CRUD operations
- convex/users.ts - User profile management
- convex/scheduledJobs.ts - Notification handlers

**Testing:**
- vitest.setup.ts - Test environment setup
- test-utils/ - Shared fixtures and helpers
- convex/**/*.test.ts - Backend tests
- src/**/__tests__/ - Component tests

**Documentation:**
- docs/DESIGN_SYSTEM.md - UI design system
- docs/API.md - Convex API reference
- TEST_README.md - Testing guide

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (CaseForm.tsx, CaseCard.tsx)
- Utilities: camelCase.ts (dashboardHelpers.ts, auth.ts)
- Tests: *.test.ts(x) (pwd.test.ts, CaseForm.test.tsx)
- Special: UPPERCASE.md (README.md, CLAUDE.md)

**Directories:**
- kebab-case: (authenticated), (public)
- camelCase: lib/, components/, convex/
- Plural: components/, emails/, tests/

**Special Patterns:**
- __tests__/ - Test directories (colocated)
- _generated/ - Auto-generated code (Convex)
- index.ts - Barrel exports

## Where to Add New Code

**New Feature:**
- Primary code: src/components/{feature}/ + convex/{feature}.ts
- Tests: src/components/{feature}/__tests__/ + convex/{feature}.test.ts
- Business logic: convex/lib/perm/{feature}.ts

**New Component:**
- Implementation: src/components/{category}/ComponentName.tsx
- Tests: src/components/{category}/__tests__/ComponentName.test.tsx
- Storybook: src/components/{category}/ComponentName.stories.tsx

**New Page:**
- Implementation: src/app/(authenticated)/{route}/page.tsx
- Layout: src/app/(authenticated)/{route}/layout.tsx (if needed)
- Loading: src/app/(authenticated)/{route}/loading.tsx

**New Convex Function:**
- Implementation: convex/{domain}.ts
- Tests: convex/{domain}.test.ts
- Types: Add to convex/schema.ts if new table

**PERM Business Logic:**
- Calculator: convex/lib/perm/calculators/{name}.ts
- Validator: convex/lib/perm/validators/{name}.ts
- Tests: convex/lib/perm/{category}/__tests__/{name}.test.ts

**Utilities:**
- Backend: convex/lib/{name}.ts
- Frontend: src/lib/{category}/{name}.ts

## Special Directories

**convex/_generated/**
- Purpose: Auto-generated Convex API types
- Source: `npx convex dev` generates from schema
- Committed: Yes (required for type safety)

**public/**
- Purpose: Static assets, service workers
- Contains: Icons, sw-push.js, site.webmanifest
- Committed: Yes

**.next/**
- Purpose: Next.js build output
- Committed: No (gitignored)

**node_modules/**
- Purpose: npm packages
- Committed: No (gitignored)

---

*Structure analysis: 2026-01-03*
*Update when directory structure changes*
