# Codebase Structure

**Analysis Date:** 2026-01-16

## Directory Layout

```
perm-tracker/
├── v2/                      # Active application (Next.js + Convex)
│   ├── convex/              # Convex backend
│   │   ├── lib/             # Shared backend logic
│   │   │   ├── perm/        # PERM business logic (CANONICAL)
│   │   │   └── rag/         # RAG knowledge base
│   │   ├── _generated/      # Auto-generated Convex types
│   │   └── *.ts             # Convex functions (queries/mutations/actions)
│   ├── src/                 # Next.js frontend
│   │   ├── app/             # App Router pages and layouts
│   │   │   ├── (authenticated)/  # Protected routes
│   │   │   ├── (public)/         # Public routes
│   │   │   ├── (auth)/           # Auth routes
│   │   │   └── api/              # API routes
│   │   ├── components/      # React components
│   │   │   ├── ui/          # Base UI (shadcn)
│   │   │   ├── forms/       # Case forms
│   │   │   ├── cases/       # Case-specific components
│   │   │   ├── chat/        # AI chat widget
│   │   │   ├── dashboard/   # Dashboard components
│   │   │   └── layout/      # Header, Footer, etc.
│   │   ├── lib/             # Frontend utilities
│   │   │   ├── perm/        # Re-exports from convex/lib/perm
│   │   │   └── ai/          # AI/chat utilities
│   │   └── emails/          # React Email templates
│   ├── test-utils/          # Test fixtures and helpers
│   ├── tests/               # E2E tests (Playwright)
│   └── public/              # Static assets
├── .planning/               # Project planning documents
└── perm_flow.md             # PERM workflow reference
```

## Directory Purposes

**`v2/convex/`:**
- Purpose: Convex backend - all server-side logic
- Contains: Database schema, queries, mutations, actions, cron jobs
- Key files: `cases.ts` (100k+ lines), `schema.ts`, `crons.ts`, `dashboard.ts`

**`v2/convex/lib/perm/`:**
- Purpose: CANONICAL PERM business logic (single source of truth)
- Contains: Calculators, validators, cascade logic, date utilities, types
- Key files: `index.ts` (exports all), `cascade.ts`, `types.ts`, `statusTypes.ts`

**`v2/convex/lib/`:**
- Purpose: Shared backend helpers
- Contains: Auth helpers, audit logging, notification helpers, list helpers
- Key files: `auth.ts`, `audit.ts`, `notificationHelpers.ts`, `caseListHelpers.ts`

**`v2/src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layouts, route handlers
- Key files: `layout.tsx`, `providers.tsx`, `globals.css`

**`v2/src/app/(authenticated)/`:**
- Purpose: Protected pages requiring authentication
- Contains: Dashboard, Cases, Calendar, Settings, Timeline, Notifications
- Key files: `layout.tsx`, `dashboard/page.tsx`, `cases/page.tsx`

**`v2/src/app/(public)/`:**
- Purpose: Public marketing and legal pages
- Contains: Home, Demo, Contact, Privacy, Terms
- Key files: `page.tsx` (home), `demo/page.tsx`

**`v2/src/app/(auth)/`:**
- Purpose: Authentication pages
- Contains: Login, Signup, Reset Password
- Key files: `login/page.tsx`, `signup/page.tsx`

**`v2/src/app/api/`:**
- Purpose: Next.js API routes for non-Convex operations
- Contains: Chat streaming, Google OAuth flows
- Key files: `chat/route.ts` (1900+ lines), `google/*/route.ts`

**`v2/src/components/ui/`:**
- Purpose: Base UI components (shadcn/ui based)
- Contains: Button, Card, Dialog, Badge, Input, etc.
- Key files: `button.tsx`, `card.tsx`, `dialog.tsx`, `index.ts`

**`v2/src/components/forms/`:**
- Purpose: Case form components with multi-section layout
- Contains: Form sections (PWD, Recruitment, ETA-9089, I-140)
- Key files: `sections/*.tsx`, `CaseForm.tsx`

**`v2/src/components/cases/`:**
- Purpose: Case-specific display components
- Contains: CaseCard, CaseList, CaseDetail, QuickEdit
- Key files: `CaseCard.tsx`, `detail/*.tsx`

**`v2/src/components/chat/`:**
- Purpose: AI chat widget and message components
- Contains: ChatWidget, ChatMessage, ToolConfirmation
- Key files: `ChatWidgetConnected.tsx`, `ChatMessage.tsx`

**`v2/src/lib/perm/`:**
- Purpose: Frontend re-export layer for PERM logic
- Contains: Single `index.ts` that re-exports from `convex/lib/perm/`
- Key files: `index.ts` (1 line: `export * from '../../../convex/lib/perm'`)

**`v2/src/lib/ai/`:**
- Purpose: AI chat utilities and tool definitions
- Contains: Providers, tools, prompts, caching, permissions
- Key files: `providers.ts`, `tools.ts`, `system-prompt.ts`, `tool-permissions.ts`

**`v2/src/emails/`:**
- Purpose: React Email templates for notifications
- Contains: DeadlineReminder, StatusChange, WeeklyDigest, etc.
- Key files: `DeadlineReminder.tsx`, `components/*.tsx`

**`v2/test-utils/`:**
- Purpose: Test utilities, fixtures, and factories
- Contains: Dashboard fixtures, deadline fixtures, render utilities
- Key files: `ui-fixtures.ts`, `dashboard-fixtures.ts`, `render-utils.tsx`

## Key File Locations

**Entry Points:**
- `v2/src/app/layout.tsx`: Root layout with providers
- `v2/src/app/providers.tsx`: Client providers (Convex, Auth, Theme)
- `v2/convex/schema.ts`: Database schema definition
- `v2/convex/auth.ts`: Auth configuration

**Configuration:**
- `v2/next.config.ts`: Next.js configuration
- `v2/tsconfig.json`: TypeScript configuration
- `v2/vitest.config.ts`: Test configuration
- `v2/convex/crons.ts`: Scheduled job definitions

**Core Logic:**
- `v2/convex/cases.ts`: Case CRUD (largest file - 100k+ lines)
- `v2/convex/lib/perm/index.ts`: PERM logic exports
- `v2/convex/lib/perm/cascade.ts`: Date cascade logic
- `v2/convex/lib/perm/validators/*.ts`: Validation rules

**Testing:**
- `v2/convex/lib/perm/__tests__/`: PERM logic tests
- `v2/src/components/**/__tests__/`: Component tests
- `v2/convex/__tests__/`: Integration tests
- `v2/tests/`: E2E tests

## Naming Conventions

**Files:**
- Components: PascalCase (`CaseCard.tsx`, `ChatWidget.tsx`)
- Utilities: camelCase (`caseListHelpers.ts`, `dateValidation.ts`)
- Tests: `*.test.ts` or `__tests__/` directory
- Stories: `*.stories.tsx`

**Directories:**
- Feature areas: lowercase (`cases/`, `dashboard/`, `chat/`)
- Route groups: parentheses (`(authenticated)/`, `(public)/`)
- Dynamic routes: brackets (`[id]/`)

**Database (schema.ts):**
- Tables: camelCase (`cases`, `userProfiles`, `auditLogs`)
- Fields: camelCase (`employerName`, `pwdFilingDate`)
- Indexes: snake_case with `by_` prefix (`by_user_id`, `by_user_and_status`)

## Where to Add New Code

**New Feature (e.g., Reports):**
- Page: `v2/src/app/(authenticated)/reports/page.tsx`
- Components: `v2/src/components/reports/`
- Backend: `v2/convex/reports.ts`
- Tests: `v2/src/components/reports/__tests__/`

**New PERM Calculator:**
- Implementation: `v2/convex/lib/perm/calculators/`
- Export: Add to `v2/convex/lib/perm/calculators/index.ts`
- Re-export: Add to `v2/convex/lib/perm/index.ts`
- Tests: `v2/convex/lib/perm/__tests__/`

**New UI Component:**
- Component: `v2/src/components/ui/component-name.tsx`
- Export: Add to `v2/src/components/ui/index.ts`
- Story: `v2/src/components/ui/component-name.stories.tsx`

**New Chat Tool:**
- Schema: Add to `v2/src/lib/ai/tools.ts`
- Handler: Add to `createTools()` in `v2/src/app/api/chat/route.ts`
- Permission: Add to `v2/src/lib/ai/tool-permissions.ts`

**Utilities:**
- Frontend-only: `v2/src/lib/`
- Shared (frontend+backend): `v2/convex/lib/`
- PERM-specific: `v2/convex/lib/perm/utils/`

## Special Directories

**`v2/convex/_generated/`:**
- Purpose: Auto-generated Convex types and API bindings
- Generated: Yes (by `npx convex dev`)
- Committed: Yes

**`v2/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `pnpm dev` or `pnpm build`)
- Committed: No

**`v2/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `pnpm install`)
- Committed: No

**`v2/coverage/`:**
- Purpose: Test coverage reports
- Generated: Yes (by `pnpm test:coverage`)
- Committed: No

**`v2/test-results/`:**
- Purpose: E2E test results
- Generated: Yes (by Playwright)
- Committed: No

**`.planning/`:**
- Purpose: Project planning, phase tracking, codebase docs
- Generated: No (manually created)
- Committed: Yes

---

*Structure analysis: 2026-01-16*
