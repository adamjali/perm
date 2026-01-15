# Architecture

**Analysis Date:** 2026-01-03

## Pattern Overview

**Overall:** Modern Serverless Full-Stack (Next.js 16 App Router + Convex Backend)

**Key Characteristics:**
- Backend-centric business logic (PERM regulations in Convex)
- Real-time data subscriptions via WebSocket
- Type-safe RPC between client and server
- Multi-tenant with row-level security
- Centralized business logic (no duplication)

## Layers

**Presentation Layer (React Components):**
- Purpose: UI rendering and user interaction
- Contains: Page components, UI components, forms
- Depends on: Client services layer (hooks)
- Used by: Next.js App Router

**Client Services Layer (React Hooks & Contexts):**
- Purpose: State management and API orchestration
- Contains: Custom hooks, React contexts, Convex hooks
- Depends on: Convex client
- Used by: Presentation layer

**API Integration Layer (Convex Client):**
- Purpose: Type-safe RPC with backend
- Contains: useQuery, useMutation, useAction calls
- Depends on: Generated Convex API types
- Used by: Client services layer

**Backend Functions Layer (Convex):**
- Purpose: Authorization, data manipulation, side effects
- Contains: Queries (read), Mutations (write), Actions (external APIs)
- Depends on: Business logic layer, database
- Used by: Client via Convex hooks

**Business Logic Layer (PERM Engine):**
- Purpose: Deadline calculations, validations, cascading logic
- Contains: Pure TypeScript functions (no framework deps)
- Depends on: Nothing (pure functions)
- Used by: Backend functions, tests
- Location: `convex/lib/perm/` (9,980 lines)

**Data Access Layer (Convex ORM):**
- Purpose: CRUD operations, querying
- Contains: Schema definition, indexes
- Depends on: PostgreSQL via Convex
- Used by: Backend functions

**External Services Layer (Actions):**
- Purpose: Third-party API integration
- Contains: Google Calendar, Resend email, web-push
- Depends on: External APIs
- Used by: Scheduled jobs, user actions

## Data Flow

**Case Creation Flow:**
```
User clicks "Add Case"
  ↓
CaseForm component (react-hook-form)
  ↓
Zod schema validation (case-form-schema.ts)
  ↓
useMutation(api.cases.create)
  ↓
Convex mutation:
  - validateCase() from convex/lib/perm
  - applyCascade() for auto-calculations
  - calculateDerivedDates()
  - Insert into database
  - Create audit log
  - Trigger calendar sync if enabled
  ↓
Return case ID → UI update → redirect
```

**Deadline Notification Flow (Scheduled):**
```
Cron triggers daily at 9 AM EST
  ↓
scheduledJobs.checkDeadlineReminders
  ↓
Query all cases for all users
  ↓
extractActiveDeadlines() from convex/lib/perm
  ↓
Check reminder intervals (1, 3, 7, 14, 30 days)
  ↓
Create notification records
  ↓
Schedule email via ctx.scheduler.runAfter()
  ↓
Render React Email template → Resend API
  ↓
Web push if enabled → subscription cleanup on failure
```

**State Management:**
- Convex reactivity for data (real-time subscriptions)
- React Context for auth state
- next-themes for dark/light mode
- No global state management library needed

## Key Abstractions

**CaseData:**
- Purpose: Core domain entity representing a PERM case
- Examples: All case fields, dates, statuses
- Pattern: Branded types (ISODateString), enums (CaseStatus)

**ValidationResult:**
- Purpose: Result of PERM validation rules
- Examples: `{ valid: boolean, errors: Issue[], warnings: Issue[] }`
- Pattern: Discriminated union with severity levels

**Cascade:**
- Purpose: Auto-calculation of dependent dates
- Examples: PWD expiration from determination, filing window from recruitment
- Pattern: Pure function that returns updated case data

**Service/Query/Mutation:**
- Purpose: Convex function patterns
- Examples: getCases(), updateCase(), sendEmail()
- Pattern: Declarative with args validation

## Entry Points

**Frontend:**
- Root Layout: `src/app/layout.tsx` - Convex provider setup, fonts, CSS
- Root Provider: `src/app/providers.tsx` - Auth, theme, navigation contexts
- Route Groups:
  - `(public)/*` - Landing, demo, contact
  - `(auth)/*` - Login, signup, password reset
  - `(authenticated)/*` - Protected dashboard, cases, settings

**Backend:**
- Convex Functions: `convex/*.ts` - API entry points
- Schema: `convex/schema.ts` - Database structure
- Crons: `convex/crons.ts` - Scheduled job definitions

## Error Handling

**Strategy:** Throw at source, catch at boundaries

**Patterns:**
- Convex functions throw errors → client receives error state
- Validation returns result objects (not exceptions)
- Actions have try/catch for external API calls
- UI shows error toasts via sonner

## Cross-Cutting Concerns

**Logging:**
- Console.log throughout (needs structured logging)
- Sentry for error tracking
- Audit logs for data changes

**Validation:**
- Zod schemas at form boundary
- Convex validators (v.string(), v.id())
- PERM validation in business logic layer

**Authentication:**
- @convex-dev/auth middleware
- Per-function authorization checks
- Row-level security in database

**Authorization:**
```typescript
const userId = await getCurrentUserId(ctx);
const caseDoc = await ctx.db.get(args.id);
await verifyOwnership(ctx, caseDoc, "Case");
```

**Soft Deletes:**
```typescript
.filter((q) => q.eq(q.field("deletedAt"), undefined))
```

---

*Architecture analysis: 2026-01-03*
*Update when major patterns change*
