# CLAUDE.md - PERM Tracker v2

> **Stack:** Next.js 16.1 + Convex 1.32 + React 19 + TypeScript (strict mode)
> **Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-02-21

## Quick Start

```bash
pnpm install

# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
pnpm dev
```

**Local URLs:** http://localhost:3000 | [Convex Dashboard](https://dashboard.convex.dev)

---

## Development Commands

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `pnpm dev` | Next.js dev (Turbopack, port 3000) |
| Build | `pnpm build` | Production build (Webpack) |
| **Unit tests** | `pnpm test` | Vitest watch mode |
| Quick check | `pnpm test:fast` | Unit + PERM tests (~40s, ~1300 tests) |
| Full suite | `pnpm test:run` | All 3600+ tests (~9 min) |
| PERM only | `pnpm test:perm` | PERM calculators/validators only |
| Components | `pnpm test:components` | Component tests only |
| Convex | `pnpm test:convex` | Convex integration tests only |
| Changed | `pnpm test:changed` | Files changed since last commit |
| Coverage | `pnpm test:coverage` | Coverage report (V8 provider) |
| **E2E tests** | `pnpm test:e2e` | Playwright E2E (starts servers) |
| Storybook | `pnpm storybook` | Component dev (port 6006) |
| Type check | `pnpm typecheck` | tsgo --noEmit (fast native TS) |
| **Admin query** | `npx convex run admin:getUserSummary '{}' --prod \| jq .` | User summary (prod, run from `v2/`) |

**Two terminals required:** `npx convex dev` (Terminal 1) + `pnpm dev` (Terminal 2)

**Note:** Dev uses Turbopack, build uses Webpack. SWC minifier bugs only appear in production builds. See [CONCERNS.md](../.planning/codebase/CONCERNS.md) TD-01.

> Full testing docs: `TEST_README.md` | Test infrastructure deep-dive: [TESTING.md](../.planning/codebase/TESTING.md)

---

## Convex Patterns

### Function Types

| Type | Use Case | Import |
|------|----------|--------|
| `query` | Read-only data fetching | `import { query } from './_generated/server'` |
| `mutation` | Write operations | `import { mutation } from './_generated/server'` |
| `action` | Side effects, external APIs | `import { action } from './_generated/server'` |

Use `internalQuery`/`internalMutation`/`internalAction` for server-only logic (called via `internal.*`).

### Auth Pattern

```typescript
import { getCurrentUserId, getCurrentUserIdOrNull } from './lib/auth';

const userId = await getCurrentUserId(ctx);      // Throws if not authenticated
const userId = await getCurrentUserIdOrNull(ctx); // Returns null if not authenticated
```

### Auth Callbacks (Convex Auth)

**`createOrUpdateUser`** — defined in `convex/auth.ts` for email-based account linking. Called during OAuth, new accounts, and verification. **NOT called for password sign-ins of existing users** (`retrieveAccountWithCredentials` bypasses it).

**`afterUserCreatedOrUpdated`** — NEVER used. Skipped when `createOrUpdateUser` is defined.

**Login tracking** — handled client-side via `LoginTracker` component (`src/components/auth/LoginTracker.tsx`). Uses `sessionStorage` to fire `recordMyLogin` once per browser session. Covers ALL auth flows.

**Profile creation** — `onAuthEvent()` in auth.ts calls `ensureUserProfileInternal` for OAuth/new accounts. `PendingTermsHandler` is the client-side safety net.

### Schema Changes

Edit `convex/schema.ts` — `npx convex dev` applies changes automatically.

**Index naming:** `by_fieldName` or `by_field1_field2` for compound indexes.

---

## Central PERM Business Logic

**ALL PERM business logic lives in ONE place:**

```
convex/lib/perm/           <- BACKEND (canonical source)
src/lib/perm/              <- FRONTEND (re-exports)
```

**NEVER recreate deadline/validation/cascade logic elsewhere.**

```typescript
// Frontend
import { calculatePWDExpiration, validateCase, applyCascade } from '@/lib/perm';

// Convex functions
import { calculatePWDExpiration, validateCase, applyCascade } from '../lib/perm';
```

### Module Structure

```
convex/lib/perm/
├── index.ts              <- Main barrel export
├── types.ts              <- ISODateString, CaseData, ValidationResult
├── statusTypes.ts        <- CaseStatus, ProgressStatus enums
├── constants.ts          <- Filing window days, deadlines, all PERM constants
├── cascade.ts            <- applyCascade, applyCascadeMultiple
├── statusCalculation.ts  <- Auto-status determination from dates
├── calculators/          <- PWD, ETA9089, recruitment, I-140, RFI calculators
├── validators/           <- All validation rules + validateCase orchestrator
├── dates/                <- Business days, holidays, filing window, method dates
├── deadlines/            <- Deadline extraction, supersession, timezone rules
├── recruitment/          <- isRecruitmentComplete, method categories
└── utils/                <- fieldMapper (snake_case <-> camelCase)
```

> Full API reference: `docs/API.md` | Architecture deep-dive: [ARCHITECTURE.md](../.planning/codebase/ARCHITECTURE.md)

### Common Usage

```typescript
// Form with cascade
import { applyCascade } from '@/lib/perm';
const handleDateChange = (field: string, value: string) => {
  setFormData(applyCascade(formData, { field, value }));
};

// Validation on save
import { validateCase } from '@/lib/perm';
const result = validateCase(formData);
if (!result.valid) { setErrors(result.errors); return; }

// Filing window status
import { getFilingWindowStatusFromCase } from '@/lib/perm';
const status = getFilingWindowStatusFromCase(caseData);
```

---

## Date Protocol

**ALL dates are ISO strings (YYYY-MM-DD).** Never store Date objects.

```typescript
import { parseISO, format, addDays } from 'date-fns';

// Parse only for math, format back to string
const result = format(addDays(parseISO('2024-06-15'), 30), 'yyyy-MM-dd');
```

---

## File Structure

```
v2/
├── convex/                      # Convex backend (~40 function files)
│   ├── lib/                     # Shared backend helpers (~30 files)
│   │   ├── perm/               # CENTRAL PERM LOGIC (canonical)
│   │   ├── auth.ts             # Auth guards (getCurrentUserId, verifyOwnership)
│   │   ├── admin.ts            # Admin authorization (requireAdmin)
│   │   ├── audit.ts            # Audit logging (logCreate, logUpdate, logDelete)
│   │   ├── validation.ts       # Input validation + sanitization
│   │   ├── email.ts            # Shared email config (getResend, FROM_EMAIL)
│   │   ├── crypto.ts           # Token encryption (FEIN, OAuth)
│   │   ├── errorRecording.ts   # Unified error recording (DB + email + Sentry)
│   │   ├── logging.ts          # Structured logging with named loggers
│   │   └── rag/                # RAG knowledge base content
│   ├── schema.ts               # Database schema (14+ tables)
│   ├── cases.ts                # Case CRUD
│   ├── dashboard.ts            # Dashboard queries
│   ├── admin.ts                # Admin dashboard queries/mutations
│   ├── users.ts                # User profile queries/mutations
│   ├── notifications.ts        # Notification queries/mutations
│   ├── notificationActions.ts  # Email sending actions (Resend)
│   ├── conversations.ts        # Chat conversation CRUD
│   ├── conversationMessages.ts # Chat message queries/mutations
│   ├── pushNotifications.ts    # Web Push actions ("use node")
│   ├── calendar.ts             # Calendar view queries
│   ├── googleCalendarSync.ts   # Calendar sync mutations
│   ├── googleCalendarActions.ts # Google Calendar API actions
│   ├── deadlineEnforcement.ts  # Auto-closure for expired deadlines
│   ├── scheduledJobs.ts        # Cron job handlers
│   ├── crons.ts                # Cron definitions (6 scheduled tasks)
│   ├── knowledge.ts            # RAG knowledge base search
│   ├── webSearch.ts            # Web search (Tavily + Brave)
│   └── http.ts                 # HTTP routes (Resend webhook)
├── content/                     # MDX content hub articles
│   ├── blog/                   # Blog posts (3)
│   ├── tutorials/              # Step-by-step tutorials (3)
│   ├── guides/                 # Reference guides (3)
│   ├── changelog/              # Product changelog (2)
│   └── resources/              # PERM resources (1)
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (public)/           # Marketing: home, blog, guides, contact, demo
│   │   ├── (auth)/             # Login, signup, password reset
│   │   ├── (authenticated)/    # Dashboard, cases, calendar, settings, admin
│   │   └── api/                # API routes: chat, google, health, sentry-check
│   ├── components/
│   │   ├── ui/                 # Core UI primitives (shadcn/ui + custom)
│   │   ├── admin/              # Admin dashboard components
│   │   ├── auth/               # LoginTracker, PendingTermsHandler
│   │   ├── calendar/           # Calendar view components
│   │   ├── cases/              # Case cards, list, filters, detail, quick-edit
│   │   ├── chat/               # AI chatbot (ChatWidget, ChatPanel, ToolCallCard)
│   │   ├── content/            # Content hub components (22 components)
│   │   ├── dashboard/          # Dashboard widgets (deadlines, summary, activity)
│   │   ├── demo/               # Demo page components
│   │   ├── forms/              # Case form system + PERM sections
│   │   ├── home/               # Homepage sections (15 components)
│   │   ├── layout/             # Header, Footer, InactivityTimeout, SentryUserContext
│   │   ├── notifications/      # Notification list, filters
│   │   ├── onboarding/         # OnboardingWizard, Tour, Checklist
│   │   ├── settings/           # Settings page sections
│   │   ├── skeletons/          # Loading skeleton components
│   │   ├── status/             # PERM status/progress badges
│   │   └── timeline/           # Timeline view components
│   ├── hooks/                  # Custom hooks (17 hooks)
│   ├── lib/
│   │   ├── perm/               # Frontend PERM re-exports
│   │   ├── ai/                 # AI chat: providers, tools, prompts, summarization
│   │   ├── content/            # MDX processing + mdx-components
│   │   ├── hooks/              # Lib hooks: useTilt, useGSAP, useInactivityTimeout
│   │   ├── auth/               # Auth utilities
│   │   ├── forms/              # Form utilities
│   │   ├── calendar/           # Calendar utilities
│   │   ├── export/             # Data export (CSV/JSON)
│   │   ├── import/             # Case import (CSV parsing)
│   │   ├── sentry.ts           # Sentry frontend (captureError, addBreadcrumb)
│   │   ├── toast.ts            # Toast utilities (auth-aware, use instead of sonner)
│   │   └── errors.ts           # Error handling (handleOperationError)
│   ├── emails/                 # React Email templates (13 templates)
│   └── remotion/               # Remotion video compositions (3 compositions)
├── public/images/
│   ├── screenshots/            # App screenshots + walkthrough videos
│   ├── journey/                # PERM journey photos
│   └── features/               # Feature illustrations
├── test-utils/                 # Shared test fixtures and utilities
├── docs/API.md                 # Convex API reference
└── tests/e2e/                  # Playwright E2E tests
```

> **Full file inventory:** [STRUCTURE.md](../.planning/codebase/STRUCTURE.md) lists every file with descriptions.

---

## Content Hub

### MDX Articles

Content lives in `content/{type}/*.mdx` with frontmatter (title, date, tags, etc.). Processed by `next-mdx-remote` + `gray-matter` + `reading-time`.

### MDX Components (available in all articles)

Registered in `src/lib/content/mdx-components.tsx`:

| Component | Props | Usage |
|-----------|-------|-------|
| `Callout` | `type` (info/warning/tip/important), `title` | Highlighted info boxes |
| `ProductCTA` | `title`, `description`, `href`, `buttonText` | Signup call-to-action |
| `StepByStep` / `Step` | `number`, `title` | Numbered step containers |
| `ComparisonTable` | `headers`, `rows` | Comparison tables |
| `ScreenshotFigure` | `src`, `alt`, `caption?`, `step?`, `maxWidth?` | App screenshot with neobrutalist border, optional step badge |
| `VideoFigure` | `src`, `alt`, `caption?`, `step?`, `maxWidth?`, `poster?` | Video with neobrutalist border, Lightbox expand, IntersectionObserver autoplay |
| `VideoPlayer` | `videoId` | Remotion video player (lazy-loaded, SSR-disabled) |

Screenshots and videos in `public/images/screenshots/`. Videos use IntersectionObserver for autoplay-on-visible and Lightbox for expand.

---

## Anti-Patterns

```typescript
// DON'T: Recreate deadline logic
const expiration = addDays(determinationDate, 365); // WRONG
// DO: import { calculatePWDExpiration } from '@/lib/perm';

// DON'T: Hardcode validation rules
if (filingDate > certDate + 180) { ... } // WRONG
// DO: import { validateI140 } from '@/lib/perm';

// DON'T: Manual business day calculation
// DO: import { addBusinessDays } from '@/lib/perm';

// DON'T: Use ?? in dense expressions (SWC minifier drops vars with ~20+ ?? chains)
const value = a ?? b ?? c ?? d ?? e; // WRONG — production ReferenceError
// DO: Use || or ternary instead
const value = a || b || c || d || e;

// DON'T: Store Date objects in Convex
await ctx.db.patch(id, { pwdFilingDate: new Date() }); // WRONG
// DO: Use ISO strings (YYYY-MM-DD)
await ctx.db.patch(id, { pwdFilingDate: format(new Date(), "yyyy-MM-dd") });

// DON'T: Import toast from sonner directly (not auth-aware)
import { toast } from "sonner"; // WRONG — fires during sign-out
// DO: Use the app wrapper that suppresses during sign-out
import { toast } from "@/lib/toast";
```

> **SWC minifier bug details:** See [CONCERNS.md](../.planning/codebase/CONCERNS.md) TD-01.

---

## Code Style

- **TypeScript strict mode** — no `any` types, `noUncheckedIndexedAccess` enabled
- **ISO date strings** — YYYY-MM-DD everywhere, never `Date` objects
- **Central imports** — always from `@/lib/perm` or `convex/lib/perm`
- **TDD** — tests before implementation for business logic
- **Named exports** preferred; default exports only for page components
- **Import order** — framework → third-party → `@/` aliases → relative → types
- **Soft deletes** — all tables use `deletedAt` timestamp, filter with `q.eq(q.field("deletedAt"), undefined)`
- **Error handling** — frontend: `handleOperationError()` from `@/lib/errors`; backend: `recordError()` from `convex/lib/errorRecording`

> **Full conventions:** [CONVENTIONS.md](../.planning/codebase/CONVENTIONS.md) — TypeScript patterns, React patterns, Convex patterns, CSS/styling, naming rules.

---

## Sentry Error Tracking

**DSN:** Configured via `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` env vars.

### Config Files

| File | Scope |
|------|-------|
| `sentry.client.config.ts` | Browser errors, Session Replay, console logging |
| `sentry.server.config.ts` | Server-side (Node.js) errors |
| `sentry.edge.config.ts` | Edge/middleware errors |
| `src/instrumentation.ts` | Loads configs + `onRequestError` hook |
| `src/app/global-error.tsx` | Root error boundary (last resort) |
| `src/lib/sentry.ts` | Frontend utility functions (`captureError`, `addBreadcrumb`, `setUser`) |
| `convex/lib/errorRecording.ts` | Unified backend error recording (DB + admin email + Sentry) |
| `convex/lib/sentry.ts` | Sentry HTTP store API utility (used by sentryReportAction) |
| `convex/sentryReportAction.ts` | Internal action bridge: mutations → Sentry HTTP API |

### Frontend Error Capture

```typescript
import { captureError, addBreadcrumb } from "@/lib/sentry";

try {
  await updateCase(caseId, data);
} catch (error) {
  captureError(error, { operation: "updateCase", resourceId: caseId });
  throw error;
}
```

### Convex Backend Error Capture

```typescript
// ONE call → DB + admin email + Sentry (works in mutations AND actions):
import { recordError } from "./lib/errorRecording";
await recordError(ctx, "mutation", "cases.update", error, { resourceId: caseId });
```

> **Full Sentry details:** [INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md) — performance spans, Session Replay, env var inventory.

---

## AI Chat

Multi-provider AI assistant with 5-provider fallback: Groq → Mistral → Gemini 2.5 Flash → Gemini 3 Flash → OpenRouter → Cerebras.

- **API route:** `src/app/api/chat/route.ts` — streaming via `createUIMessageStream`
- **Providers:** `src/lib/ai/providers.ts` — custom `FallbackModel` class (replaced `ai-fallback`)
- **Tools:** `src/lib/ai/tools/` — case lookup, deadline check, web search, knowledge base
- **Prompts:** `src/lib/ai/prompts/` — system prompts with PERM expertise
- **Backend:** `convex/conversations.ts` + `convex/conversationMessages.ts` — CRUD with summarization
- **Components:** `src/components/chat/` — `ChatWidget`, `ChatPanel`, `ToolCallCard`

> **Full AI architecture:** [ARCHITECTURE.md](../.planning/codebase/ARCHITECTURE.md) — data flow diagram, provider details. [INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md) — API keys, rate limits, env vars.

---

## Codebase Map

7 deep-dive docs (3,856 lines) in `../.planning/codebase/` — STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS. **See [root CLAUDE.md](../CLAUDE.md#codebase-map) for the full table with descriptions and when-to-read guidance.**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Date off by one day | Use UTC functions, check timezone handling |
| Validation not catching error | Check you're using the right validator |
| Cascade not triggering | Ensure `applyCascade()` called on change |
| Import not found | `@/lib/perm` (frontend) vs `convex/lib/perm` (backend) |
| `ReferenceError: _ref is not defined` (prod only) | SWC minifier bug — replace `??` with `\|\|` in affected file. See [CONCERNS.md](../.planning/codebase/CONCERNS.md) TD-01 |
| `X is not defined` in prod build | Check: SWC minifier, `optimizePackageImports`, `concatenateModules`, React Compiler |
| Auth callback not firing | `createOrUpdateUser` skips password sign-ins — use client-side `LoginTracker` |
| Toast appears during sign-out | Import from `@/lib/toast`, not `sonner` directly |
| Convex action can't call another action | Use `ctx.scheduler.runAfter(0, ...)` to schedule instead |
| Sitemap dates stale after page edit | Update `lastModified` in `src/app/sitemap.ts` for static pages |

> **Deployment & project names:** See [root CLAUDE.md](../CLAUDE.md#deployment) — Vercel/Convex deploy commands, project name mapping.
