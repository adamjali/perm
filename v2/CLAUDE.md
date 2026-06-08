# CLAUDE.md — PERM Tracker v2

> **Stack:** Next.js 16.2.6 + Convex 1.39 + React 19.2.6 + TypeScript (strict)
> **Status:** Production | **Last Updated:** 2026-05-24

**Convex rules:** read [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md) before writing Convex code.
**Codebase deep-dives:** [`.planning/codebase/`](../.planning/codebase/) — STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS.
**API reference:** [`docs/API.md`](docs/API.md). **PERM flow:** [`../perm_flow.md`](../perm_flow.md).
**Docs (`docs/`):** [API](docs/API.md) · [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) · [ANIMATION_STORYBOARD](docs/ANIMATION_STORYBOARD.md) · [CRYPTO](docs/CRYPTO.md) · [compliance/](docs/compliance/) (SOC 2 evidence). Feature behaviour lives in the code + codebase deep-dives, not standalone docs.

## Quick Start

```bash
pnpm install
npx convex dev      # Terminal 1
pnpm dev            # Terminal 2
```

http://localhost:3000 · [Convex Dashboard](https://dashboard.convex.dev)

## Commands

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server (Turbopack, :3000) |
| `pnpm build` | Production build (Webpack — SWC bugs only appear here, see [CONCERNS.md](../.planning/codebase/CONCERNS.md) TD-01) |
| `pnpm typecheck` | `tsgo --noEmit` |
| `pnpm test` | Vitest watch |
| `pnpm test:fast` | ~1300 unit+PERM tests (~40s) |
| `pnpm test:run` | Full 3600+ suite (~9min) |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm storybook` | Component dev (:6006) |

Full test docs: [`TEST_README.md`](TEST_README.md).

---

## Central PERM Business Logic

**ALL PERM logic lives in ONE place** — NEVER recreate deadline/validation/cascade logic elsewhere.

```
convex/lib/perm/     ← canonical source
src/lib/perm/        ← frontend re-exports
```

```typescript
// Frontend
import { calculatePWDExpiration, validateCase, applyCascade } from '@/lib/perm';
// Convex functions
import { calculatePWDExpiration, validateCase, applyCascade } from '../lib/perm';
```

Structure: `calculators/` · `validators/` · `dates/` · `deadlines/` · `recruitment/` · `cascade.ts` · `statusCalculation.ts` · `constants.ts`. See [STRUCTURE.md](../.planning/codebase/STRUCTURE.md).

### Common usage

```typescript
// Form cascade
setFormData(applyCascade(formData, { field, value }));

// Validation
const result = validateCase(formData);
if (!result.valid) { setErrors(result.errors); return; }

// Filing window
const status = getFilingWindowStatusFromCase(caseData);
```

---

## Convex Patterns

| Type | Use | Import |
|---|---|---|
| `query` | Read | `from './_generated/server'` |
| `mutation` | Write | `from './_generated/server'` |
| `action` | Side effects, external APIs | `from './_generated/server'` |

`internalQuery`/`internalMutation`/`internalAction` for server-only, called via `internal.*`.

**Auth:** `getCurrentUserId(ctx)` (throws) or `getCurrentUserIdOrNull(ctx)` from `./lib/auth`.

**Auth callbacks gotcha:** `createOrUpdateUser` in `convex/auth.ts` is NOT called for password sign-ins of existing users. Login tracking is client-side via `LoginTracker` (`src/components/auth/LoginTracker.tsx`, localStorage + 30s debounce). `afterUserCreatedOrUpdated` is never used.

**Schema changes:** edit `convex/schema.ts` — `npx convex dev` auto-applies. Index naming: `by_fieldName` or `by_field1_field2`.

---

## Date Protocol

**ALL dates are ISO strings (YYYY-MM-DD).** Never store `Date` objects.

```typescript
import { parseISO, format, addDays } from 'date-fns';
const result = format(addDays(parseISO('2024-06-15'), 30), 'yyyy-MM-dd');
```

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

// DON'T: Use ?? in dense expressions (SWC minifier drops vars with ~20+ ?? chains → prod ReferenceError)
const value = a ?? b ?? c ?? d ?? e; // WRONG
// DO: Use || or ternary
const value = a || b || c || d || e;

// DON'T: Store Date objects in Convex
await ctx.db.patch(id, { pwdFilingDate: new Date() }); // WRONG
// DO: ISO strings
await ctx.db.patch(id, { pwdFilingDate: format(new Date(), "yyyy-MM-dd") });

// DON'T: Import toast from sonner directly (not auth-aware, fires during sign-out)
import { toast } from "sonner"; // WRONG
// DO:
import { toast } from "@/lib/toast";

// DON'T: Put client init (posthog.init, etc.) in a ROOT instrumentation-client.ts
// With a src/ app dir, Next.js loads ONLY src/instrumentation-client.ts — root is ignored → silent outage
// DO: keep posthog.init() + initBotId() together in src/instrumentation-client.ts  // see CONCERNS TD-06
```

SWC minifier bug details: [CONCERNS.md TD-01](../.planning/codebase/CONCERNS.md).

---

## Code Style

- **TypeScript strict** — no `any`, `noUncheckedIndexedAccess` enabled
- **ISO date strings** everywhere
- **Central imports** — `@/lib/perm` or `convex/lib/perm`
- **TDD** — tests first for business logic
- **Named exports** preferred (default only for page components)
- **Import order** — framework → third-party → `@/` → relative → types
- **Soft deletes** — filter `q.eq(q.field("deletedAt"), undefined)`
- **Errors** — frontend: `handleOperationError()` from `@/lib/errors`; backend: `recordError()` from `convex/lib/errorRecording`

Full conventions: [CONVENTIONS.md](../.planning/codebase/CONVENTIONS.md).

---

## Integrations (quick reference — details in INTEGRATIONS.md)

- **Sentry** — lazy-loaded client (`SentryClientInit`). Frontend: `captureError` from `@/lib/sentry`. Backend: `recordError` from `convex/lib/errorRecording` (writes DB + admin email + Sentry in one call).
- **PostHog** — always import `@/lib/analytics` (wrapper with try/catch), never raw `posthog-js`. Client init (`posthog.init`) lives in `src/instrumentation-client.ts` **alongside BotID** — Next.js loads only that ONE file (a root `instrumentation-client.ts` is silently ignored), so splitting them kills one. Proxied via `/ingest/*` (incl. `/ingest/array` for lazy bundles). Internal opt-out: `POSTHOG_EXCLUDED_EMAILS` Convex env var. See [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md).
- **Resend Email** — transactional via Resend MCP tools (list/send/contacts), `curl` for threaded replies (needs `In-Reply-To` header which MCP doesn't expose), or `admin.sendAdminEmail` mutation for UI sends (auth-required, auto-renders `AdminEmail` React template). `FROM_EMAIL = notifications@permtracker.app`.
- **AI Chat** — multi-provider fallback (Groq→Mistral→Gemini→OpenRouter→Cerebras) via custom `FallbackModel` in `src/lib/ai/providers.ts`. API route: `src/app/api/chat/route.ts`.

Full env vars, rate limits, webhooks: [INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md).

---

## Content Hub (MDX)

Content in `content/{blog,tutorials,guides,changelog,resources}/*.mdx`. Processed by `next-mdx-remote` + `gray-matter` + `reading-time`. MDX components registered in `src/lib/content/mdx-components.tsx`: `Callout`, `ProductCTA`, `StepByStep`/`Step`, `ComparisonTable`, `ScreenshotFigure`, `VideoFigure`, `VideoPlayer`.

---

## GSD Workflow

`/gsd:feature` for new features · `/gsd:quick` for small fixes · `/gsd:debug` for investigation · `/gsd:map-codebase` after major structural changes. Full command list: [root CLAUDE.md](../CLAUDE.md#gsd-workflow).

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Date off by one day | Use UTC functions |
| Validation not catching error | Check you're using the right validator |
| Cascade not triggering | Ensure `applyCascade()` called on change |
| Import not found | `@/lib/perm` (frontend) vs `convex/lib/perm` (backend) |
| `ReferenceError: _ref is not defined` (prod only) | SWC minifier bug — replace `??` with `\|\|`. See [CONCERNS.md TD-01](../.planning/codebase/CONCERNS.md) |
| `X is not defined` (prod build) | Check SWC minifier, `optimizePackageImports`, `concatenateModules`, React Compiler |
| Auth callback not firing | `createOrUpdateUser` skips password sign-ins — use `LoginTracker` |
| Toast during sign-out | Import `@/lib/toast`, not `sonner` |
| PostHog/analytics silently not capturing | Client init must be in `src/instrumentation-client.ts` (the only one Next.js loads; a root one is ignored) — PostHog + BotID coexist there. [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md) |
| Convex action can't call another action | `ctx.scheduler.runAfter(0, ...)` instead |
| Sitemap dates stale | Update `lastModified` in `src/app/sitemap.ts` |

Deployment + project names: [root CLAUDE.md](../CLAUDE.md#deployment).

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
