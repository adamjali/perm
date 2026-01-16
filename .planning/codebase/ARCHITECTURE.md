# Architecture

**Analysis Date:** 2026-01-16

## Pattern Overview

**Overall:** Full-stack serverless application with Next.js App Router frontend and Convex backend

**Key Characteristics:**
- Next.js 16 App Router for routing with route groups (auth, public, authenticated)
- Convex serverless functions for backend (queries, mutations, actions)
- Single source of truth for PERM business logic in `convex/lib/perm/`
- Real-time data sync via Convex reactive queries
- AI chat integration with tool-based actions

## Layers

**Presentation Layer (Frontend):**
- Purpose: UI rendering, user interaction, client-side state
- Location: `v2/src/`
- Contains: React components, pages, layouts, forms
- Depends on: Convex client, UI components, PERM logic re-exports
- Used by: Users via browser

**Backend Layer (Convex):**
- Purpose: Data persistence, authentication, business logic execution
- Location: `v2/convex/`
- Contains: Queries, mutations, actions, schema, cron jobs
- Depends on: Convex runtime, PERM logic, external APIs (Resend, Google)
- Used by: Frontend via Convex client, cron scheduler

**Business Logic Layer (PERM):**
- Purpose: PERM case calculations, validations, deadlines
- Location: `v2/convex/lib/perm/` (canonical), `v2/src/lib/perm/` (re-export)
- Contains: Calculators, validators, cascade logic, date utilities
- Depends on: date-fns
- Used by: Both frontend and backend

**API Layer (Next.js Routes):**
- Purpose: Server-side endpoints for non-Convex operations
- Location: `v2/src/app/api/`
- Contains: Chat streaming, Google OAuth callbacks
- Depends on: AI SDK, Google Auth, Convex fetch helpers
- Used by: Frontend chat widget, OAuth flows

## Data Flow

**Case Creation/Update Flow:**

1. User fills form in `src/components/forms/`
2. Form calls `applyCascade()` from `@/lib/perm` on field changes (auto-calculates dates)
3. On submit, validates with `validateCase()` from `@/lib/perm`
4. Frontend calls `api.cases.create` or `api.cases.update` mutation
5. Mutation validates, computes derived dates, writes to Convex DB
6. Mutation schedules calendar sync if enabled
7. Convex real-time sync pushes update to all connected clients

**Chat Interaction Flow:**

1. User sends message to `/api/chat` streaming endpoint
2. Endpoint authenticates, fetches conversation context + user preferences
3. AI SDK calls `streamText()` with tools (queryCases, updateCase, navigate, etc.)
4. Tools execute Convex queries/mutations via `fetchQuery`/`fetchMutation`
5. Tool results return to AI, AI generates response
6. Response streams back to frontend ChatWidget
7. Async summarization triggered for long conversations

**Notification/Deadline Flow:**

1. Cron job `deadline-reminders` runs daily at 9 AM EST
2. `scheduledJobs.checkDeadlineReminders` queries active cases
3. For each case, extracts deadlines via `extractActiveDeadlines()`
4. Creates notifications via `internal.notifications.createNotification`
5. Schedules email via `notificationActions.sendDeadlineReminderEmail`
6. Frontend `NotificationBell` component shows real-time count via query

**State Management:**
- Server state: Convex reactive queries (real-time sync)
- Form state: React Hook Form with Zod validation
- Auth state: Convex Auth context via `AuthProvider`
- UI state: Local React state, ThemeProvider for dark mode
- Page context: `PageContextProvider` for chat awareness

## Key Abstractions

**CaseData Type:**
- Purpose: Complete PERM case representation
- Examples: `v2/convex/lib/perm/types.ts`, `v2/convex/schema.ts`
- Pattern: Branded types for dates (ISODateString), strict TypeScript

**ValidationResult Type:**
- Purpose: Standardized validation output (valid, errors, warnings)
- Examples: `v2/convex/lib/perm/types.ts`
- Pattern: ValidationIssue with ruleId, severity, field, message

**Convex Document Types:**
- Purpose: Database schema types with automatic ID generation
- Examples: `v2/convex/schema.ts` defines all tables
- Pattern: `Id<'tableName'>` branded types, `v.` validators

**UI Components:**
- Purpose: Reusable presentational components
- Examples: `v2/src/components/ui/` (shadcn/ui based)
- Pattern: Component variants via CVA, Radix primitives

## Entry Points

**Next.js App Root:**
- Location: `v2/src/app/layout.tsx`
- Triggers: All page loads
- Responsibilities: Providers (Convex, Auth, Theme, i18n), structured data, fonts

**Route Groups:**
- `(authenticated)/layout.tsx`: Protected pages (dashboard, cases, calendar)
- `(public)/layout.tsx`: Marketing pages (home, demo, contact)
- `(auth)/layout.tsx`: Auth pages (login, signup, reset-password)

**API Routes:**
- `/api/chat/route.ts`: AI chat streaming endpoint
- `/api/chat/execute-tool/route.ts`: Deferred tool execution
- `/api/google/*/route.ts`: Google OAuth connect/callback/disconnect

**Convex Entry Points:**
- `v2/convex/cases.ts`: Case CRUD operations (largest file)
- `v2/convex/crons.ts`: Scheduled job definitions
- `v2/convex/auth.ts`: Authentication configuration

## Error Handling

**Strategy:** Layered error handling with user-friendly messages

**Patterns:**
- Convex functions throw errors caught by client with toast notifications
- Form validation shows inline errors before submission
- AI chat returns `error` + `suggestion` objects for graceful degradation
- Auth errors redirect to login with reason
- API routes return JSON error responses with appropriate HTTP codes

## Cross-Cutting Concerns

**Logging:**
- Convex: `loggers` from `convex/lib/logging.ts` with emoji prefixes
- Chat API: Session-based logging with `[Chat API] [sessionId]` prefix
- Development: `process.env.CHAT_LOG_VERBOSE` for detailed chat logs

**Validation:**
- Backend: `validateCase()` runs all 44 validation rules
- Frontend: Zod schemas for form validation
- Cascade: `applyCascade()` auto-calculates dependent dates

**Authentication:**
- Convex Auth with Google OAuth and email/password
- `getCurrentUserId(ctx)` helper enforces auth in functions
- Route groups control page-level access

**Audit Logging:**
- `v2/convex/lib/audit.ts`: `logCreate`, `logUpdate`, `logDelete`
- Stored in `auditLogs` table for compliance

---

*Architecture analysis: 2026-01-16*
