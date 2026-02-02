# CLAUDE.md - PERM Tracker v2

> **Stack:** Next.js 16.1 + Convex 1.31 + React 19 + TypeScript (strict mode)
> **Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-01-16

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
| Dev server | `pnpm dev` | Next.js dev server (port 3000) |
| Build | `pnpm build` | Production build |
| **Unit tests** | `pnpm test` | Vitest watch mode |
| Quick check | `pnpm test:fast` | Unit + PERM tests (~30s) |
| Full suite | `pnpm test:run` | All 3600+ tests (~9 min) |
| Coverage | `pnpm test:coverage` | Coverage report |
| **E2E tests** | `pnpm test:e2e` | Playwright E2E tests |
| Storybook | `pnpm storybook` | Component dev (port 6006) |

**Two terminals required:** `npx convex dev` (Terminal 1) + `pnpm dev` (Terminal 2)

> Full testing docs: `TEST_README.md`

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
├── index.ts              <- Main entry point
├── types.ts              <- ISODateString, CaseData, ValidationResult
├── statusTypes.ts        <- CaseStatus, ProgressStatus enums
├── cascade.ts            <- applyCascade, applyCascadeMultiple
├── calculators/          <- PWD, ETA9089, recruitment, I-140, RFI
├── validators/           <- All validation rules + validateCase
├── dates/                <- Business days, holidays, filing window
├── recruitment/          <- isRecruitmentComplete
└── utils/                <- fieldMapper (snake_case <-> camelCase)
```

> Full API reference with examples: `docs/API.md`

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
├── convex/                  # Convex backend
│   ├── lib/
│   │   ├── perm/           # CENTRAL PERM LOGIC (canonical)
│   │   ├── auth.ts         # Auth helpers (getCurrentUserId)
│   │   └── notificationHelpers.ts
│   ├── cases.ts            # Case CRUD
│   ├── notifications.ts    # Notification queries/mutations
│   ├── notificationActions.ts  # Email/notification actions
│   ├── pushNotifications.ts    # Web push
│   ├── scheduledJobs.ts    # Scheduled job processing
│   ├── deadlineEnforcement.ts  # Deadline reminders
│   ├── crons.ts            # Cron definitions
│   └── schema.ts           # Database schema
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── emails/            # React Email templates
│   └── lib/perm/          # Frontend re-exports
├── docs/API.md            # Convex API reference
└── test-utils/            # Test utilities and fixtures
```

---

## Common Patterns

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
```

---

## Code Style

- **TypeScript strict mode** — no `any` types
- **ISO date strings** — YYYY-MM-DD everywhere
- **Central imports** — always from `@/lib/perm` or `convex/lib/perm`
- **TDD** — tests before implementation for business logic

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Date off by one day | Use UTC functions, check timezone handling |
| Validation not catching error | Check you're using the right validator |
| Cascade not triggering | Ensure `applyCascade()` called on change |
| Import not found | `@/lib/perm` (frontend) vs `convex/lib/perm` (backend) |
