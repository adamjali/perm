# CLAUDE.md - PERM Tracker v2

**LSP Priority** (all agents have access):
- `findReferences` > grep for "find usages"
- `goToDefinition` > grep for "where defined"
- `documentSymbol` > grep for "list symbols"
- `incomingCalls`/`outgoingCalls` for call chains
- FALLBACK to Glob/Grep if LSP errors or for pattern/text search

**Quality Standards:**
- DRY/KISS: Minimal, consolidated. No duplicates. Work within existing.
- Clean code: Maintainable, abstract-able, scalable, readable.
- Token-efficient: Save context, be concise.
- **MUST use frontend-design skill (its a plug-in)** for UI work.
- Subagents get full context + these standards.

---

> **Stack:** Next.js 16 + Convex + React + TypeScript (strict mode)
> **Status:** Active development | **Last Updated:** 2025-12-31

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Convex dev server (in terminal 1)
npx convex dev

# Start Next.js dev server (in terminal 2)
pnpm dev
```

**Local URLs:**
- Frontend: http://localhost:3000
- Convex Dashboard: https://dashboard.convex.dev

---

## Development Commands

### Terminal Setup

You need **two terminals** running simultaneously:

| Terminal | Command | Purpose |
|----------|---------|---------|
| Terminal 1 | `npx convex dev` | Convex dev server (hot-reloads functions & schema) |
| Terminal 2 | `pnpm dev` | Next.js dev server (port 3000) |

### All npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `pnpm dev` | Start Next.js dev server (port 3000) |
| Build | `pnpm build` | Production build |
| Start | `pnpm start` | Start production server |
| Lint | `pnpm lint` | Run ESLint |
| **Unit tests** | `pnpm test` | Run unit tests (Vitest, watch mode) |
| Unit tests (CI) | `pnpm test:run` | Run unit tests once (no watch) |
| Coverage | `pnpm test:coverage` | Run tests with coverage report |
| **E2E tests** | `pnpm test:e2e` | Run Playwright E2E tests |
| E2E with UI | `pnpm test:e2e:ui` | Run E2E tests with UI runner |
| E2E debug | `pnpm test:e2e:debug` | Run E2E tests in debug mode |
| All tests | `pnpm test:all` | Run all tests (unit + E2E) |
| Storybook | `pnpm storybook` | Start Storybook dev server (port 6006) |
| Build Storybook | `pnpm build-storybook` | Build static Storybook for deployment |

---

## Convex Workflows

### Schema Changes

Edit `convex/schema.ts` and `npx convex dev` applies changes automatically:

```typescript
// convex/schema.ts
export default defineSchema({
  cases: defineTable({
    // Add new field
    newField: v.optional(v.string()),
  })
    // Add index with standard naming: by_fieldName
    .index('by_userId', ['userId'])
    .index('by_status', ['status']),
});
```

**Index naming convention:** `by_fieldName` or `by_field1_field2` for compound indexes.

### Function Types

| Type | Use Case | Import |
|------|----------|--------|
| `query` | Read-only data fetching | `import { query } from './_generated/server'` |
| `mutation` | Write operations (create/update/delete) | `import { mutation } from './_generated/server'` |
| `action` | Side effects, external APIs, non-transactional | `import { action } from './_generated/server'` |

```typescript
// Query example (read-only)
export const getCase = query({
  args: { id: v.id('cases') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation example (write)
export const updateCase = mutation({
  args: { id: v.id('cases'), data: v.object({...}) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.data);
  },
});

// Action example (side effects)
export const sendEmail = action({
  args: { to: v.string(), subject: v.string() },
  handler: async (ctx, args) => {
    // Can call external APIs, use ctx.runMutation/ctx.runQuery
  },
});
```

### Internal Functions

Use `internalQuery`, `internalMutation`, `internalAction` for server-only logic:

```typescript
import { internalMutation } from './_generated/server';

// Only callable from other Convex functions, not from client
export const processDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Server-only business logic
  },
});

// Call with internal.*
await ctx.runMutation(internal.notifications.processDeadlines);
```

### Auth Pattern

```typescript
import { getCurrentUserId, getCurrentUserIdOrNull } from './lib/auth';

// Throws if not authenticated (use for protected routes)
const userId = await getCurrentUserId(ctx);

// Returns null if not authenticated (use for optional auth)
const userId = await getCurrentUserIdOrNull(ctx);
```

---

## CRITICAL: Central PERM Business Logic

### The Canonical Source of Truth

**ALL PERM business logic lives in ONE place:**

```
convex/lib/perm/           <- BACKEND (Convex functions)
src/lib/perm/              <- FRONTEND (re-exports from convex/lib/perm)
```

**ALWAYS import from these locations. NEVER recreate this logic elsewhere.**

### Import Patterns

```typescript
// Frontend components - use src/lib/perm
import {
  calculatePWDExpiration,
  validateRecruitment,
  isRecruitmentComplete,
  applyCascade,
} from '@/lib/perm';

// Convex functions - use convex/lib/perm
import {
  calculatePWDExpiration,
  validateRecruitment,
  isRecruitmentComplete,
  applyCascade,
} from '../lib/perm';
```

### Why This Matters

| Problem | Solution |
|---------|----------|
| Duplicate deadline calculations | Import from `@/lib/perm` |
| Inconsistent validation rules | Import validators from central module |
| Date cascade logic scattered | Use `applyCascade()` from central module |
| Different filing window calculations | Use `calculateFilingWindow()` |

**WARNING:** Creating deadline/validation/cascade logic outside `convex/lib/perm/` will cause bugs and inconsistencies. The PERM regulations are complex - one source of truth prevents drift.

---

## Module Architecture

```
convex/lib/perm/
├── index.ts                 <- MAIN ENTRY POINT (import from here)
├── types.ts                 <- Core types (ISODateString, CaseData, ValidationResult)
├── statusTypes.ts           <- CaseStatus, ProgressStatus enums
├── cascade.ts               <- Auto-calculation logic (applyCascade)
├── calculators/
│   ├── index.ts             <- Calculator exports
│   ├── pwd.ts               <- PWD expiration calculation
│   ├── eta9089.ts           <- ETA 9089 window/expiration
│   ├── recruitment.ts       <- Recruitment deadlines
│   ├── i140.ts              <- I-140 filing deadline
│   └── rfi.ts               <- RFI due date
├── validators/
│   ├── index.ts             <- Validator exports
│   ├── pwd.ts               <- PWD validation rules
│   ├── recruitment.ts       <- Recruitment validation
│   ├── eta9089.ts           <- ETA 9089 validation
│   ├── i140.ts              <- I-140 validation
│   ├── rfi.ts               <- RFI validation
│   ├── rfe.ts               <- RFE validation
│   └── validateCase.ts      <- Full case validation
├── dates/
│   ├── index.ts             <- Date utility exports
│   ├── businessDays.ts      <- Business day calculations
│   ├── holidays.ts          <- Federal holiday detection
│   └── filingWindow.ts      <- Filing window calculations
├── recruitment/
│   └── isRecruitmentComplete.ts  <- Recruitment completion checks
└── utils/
    └── fieldMapper.ts       <- snake_case ↔ camelCase conversion
```

---

## API Reference

### Calculators

```typescript
import {
  calculatePWDExpiration,      // PWD determination → expiration
  calculateETA9089Window,      // Recruitment dates → filing window
  calculateETA9089Expiration,  // Certification → expiration
  calculateRecruitmentDeadlines, // PWD expiration → all recruitment deadlines
  calculateI140FilingDeadline, // ETA certification → I-140 deadline
  calculateRFIDueDate,         // RFI received → due date (strict 30 days)
} from '@/lib/perm';
```

#### PWD Expiration
```typescript
const expiration = calculatePWDExpiration('2024-06-15');
// Returns: '2025-06-30' (per 20 CFR 656.40)
```

#### Recruitment Deadlines
```typescript
const deadlines = calculateRecruitmentDeadlines('2024-12-31'); // PWD expiration
// Returns: {
//   notice_of_filing_deadline: '2024-08-18',
//   job_order_start_deadline: '2024-08-28',
//   first_sunday_ad_deadline: '2024-09-15',
//   second_sunday_ad_deadline: '2024-09-22',
//   recruitment_window_closes: '2024-12-01'
// }
```

#### Filing Window
```typescript
import { calculateFilingWindow, getFilingWindowStatus } from '@/lib/perm';

const window = calculateFilingWindow({
  firstRecruitmentDate: '2024-01-15',
  lastRecruitmentDate: '2024-02-20',
  pwdExpirationDate: '2024-12-31',
});
// Returns: { opens: '2024-03-21', closes: '2024-07-13', isPwdLimited: false }

const status = getFilingWindowStatus(input);
// Returns: { status: 'open'|'waiting'|'closed', daysRemaining: 45, message: '...' }
```

### Validators

```typescript
import {
  validatePWD,          // PWD date sequence validation
  validateRecruitment,  // Recruitment date validation
  validateETA9089,      // ETA 9089 filing window validation
  validateI140,         // I-140 deadline validation
  validateRFI,          // RFI due date validation
  validateRFE,          // RFE validation
  validateCase,         // Full case validation (all rules)
} from '@/lib/perm';

// Example: Validate I-140
const result = validateI140({
  eta9089_certification_date: '2024-01-15',
  i140_filing_date: '2024-08-15', // Over 180 days!
});
// Returns: {
//   valid: false,
//   errors: [{ ruleId: 'V-I140-02', message: 'I-140 must be filed within 180 days' }],
//   warnings: []
// }
```

### Cascade Logic

Auto-calculate dependent dates when a source field changes:

```typescript
import { applyCascade, applyCascadeMultiple } from '@/lib/perm';

// Single change
const updated = applyCascade(currentCase, {
  field: 'pwd_determination_date',
  value: '2024-06-15'
});
// Automatically sets pwd_expiration_date

// Multiple changes
const updated = applyCascadeMultiple(currentCase, [
  { field: 'pwd_determination_date', value: '2024-06-15' },
  { field: 'notice_of_filing_start_date', value: '2024-08-01' },
]);
```

#### Cascade Rules

| Source Field | Auto-Calculated Field | Rule |
|--------------|----------------------|------|
| `pwd_determination_date` | `pwd_expiration_date` | Per 20 CFR 656.40 |
| `notice_of_filing_start_date` | `notice_of_filing_end_date` | +10 business days (extend only) |
| `job_order_start_date` | `job_order_end_date` | +30 days (extend only) |
| `eta9089_certification_date` | `eta9089_expiration_date` | +180 days |
| `rfi_received_date` | `rfi_due_date` | +30 calendar days (strict) |

### Recruitment Completion

```typescript
import { isRecruitmentComplete, isBasicRecruitmentComplete } from '@/lib/perm';

// Full check (basic + professional if applicable)
const complete = isRecruitmentComplete({
  jobOrderStartDate: '2024-01-15',
  jobOrderEndDate: '2024-02-14',
  sundayAdFirstDate: '2024-01-21',
  sundayAdSecondDate: '2024-01-28',
  noticeOfFilingStartDate: '2024-01-15',
  noticeOfFilingEndDate: '2024-01-29',
  isProfessionalOccupation: true,
  additionalRecruitmentMethods: [...], // 3+ methods required
});
```

### Types

```typescript
import type {
  ISODateString,       // Branded string type for YYYY-MM-DD
  CaseData,            // Complete case data interface
  ValidationResult,    // { valid, errors, warnings }
  ValidationIssue,     // { ruleId, severity, field, message }
  CaseStatus,          // 'pwd' | 'recruitment' | 'eta_9089' | 'i140' | 'complete'
  ProgressStatus,      // 'not_started' | 'in_progress' | 'on_hold' | ...
  FilingWindow,        // { opens, closes, isPwdLimited }
} from '@/lib/perm';
```

---

## Date Protocol

**ALL dates are ISO strings (YYYY-MM-DD).** Never use Date objects in storage.

```typescript
// CORRECT
const date = '2024-06-15';

// WRONG
const date = new Date('2024-06-15'); // Don't store Date objects
```

Parse only when doing math, then format back to string:

```typescript
import { parseISO, format } from 'date-fns';

const parsed = parseISO('2024-06-15');
const result = addDays(parsed, 30);
const output = format(result, 'yyyy-MM-dd'); // Back to string
```

---

## File Structure

```
v2/
├── convex/                  # Convex backend
│   ├── lib/
│   │   ├── perm/           # CENTRAL PERM LOGIC (canonical)
│   │   ├── auth.ts         # Auth helpers (getCurrentUserId)
│   │   └── notificationHelpers.ts  # Notification utilities
│   ├── cases.ts            # Case CRUD mutations/queries
│   ├── notifications.ts    # Notification queries/mutations
│   ├── notificationActions.ts  # Email/notification actions (Phase 24)
│   ├── pushNotifications.ts    # Web push notifications (Phase 24)
│   ├── pushSubscriptions.ts    # Push subscription management
│   ├── scheduledJobs.ts    # Scheduled job processing (Phase 24)
│   ├── deadlineEnforcement.ts  # Deadline reminder logic (Phase 24)
│   ├── crons.ts            # Cron job definitions (Phase 24)
│   └── schema.ts           # Database schema
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   │   ├── cases/         # Case-specific components
│   │   ├── notifications/ # Notification UI components
│   │   ├── ui/            # shadcn/ui components
│   │   └── layout/        # Layout components
│   ├── emails/            # React Email templates (Phase 24)
│   └── lib/
│       └── perm/          # FRONTEND RE-EXPORTS (from convex/lib/perm)
├── docs/
│   └── API.md             # Convex API reference documentation
└── test-utils/            # Test utilities and fixtures
```

---

## Testing

> **⚠️ TIMING WARNING:** Full test suite takes **~9 minutes** (3600+ tests). Use `test:fast` during development!

### Test Projects

The test suite is organized into **three Vitest projects** optimized for speed:

| Project | Environment | Location | Timeout | Notes |
|---------|-------------|----------|---------|-------|
| `unit` | happy-dom | `src/lib/**`, `src/hooks/**`, `convex/lib/perm/**`, `convex/lib/*.test.ts` | 5s | Shared env, fast |
| `components` | happy-dom | `src/components/**`, `src/app/**`, `src/emails/**` | 10s | Isolated for clean DOM |
| `convex` | edge-runtime | `convex/*.test.ts`, `convex/__tests__/**` | 15s | Integration tests |

### Recommended Workflow

| When | Command | Time | Notes |
|------|---------|------|-------|
| **Active coding** | `pnpm test` | Instant | Watch mode, re-runs on save |
| **Quick check** | `pnpm test:fast` | ~30s | Unit + PERM tests only |
| **Before commit** | `pnpm test:run` | ~9 min | Full suite - only when needed! |

**⚠️ DON'T run full test suite repeatedly during development.** Use `test:fast` or `test:unit` instead.

### Quick Commands

```bash
# Development (PREFERRED - fast feedback)
pnpm test             # Watch mode - re-tests on file save
pnpm test:fast        # Unit + PERM tests (~30s)
pnpm test:changed     # Only changed files since last commit
pnpm test:perm        # PERM business logic only

# Full suite (ONLY before commit/PR - takes ~9 min!)
pnpm test:run         # All 3600+ tests

# By project
pnpm test:unit        # Unit tests (src/lib, src/hooks, convex/lib/perm)
pnpm test:components  # Component tests (~2 min)
pnpm test:convex      # Convex integration tests

# Coverage
pnpm test:coverage    # Full coverage report

# E2E
pnpm test:e2e         # Playwright tests
pnpm test:all         # Unit + E2E
```

### What NOT to Test

Tests should verify **behavior**, not implementation details:

| ❌ DON'T Test | ✅ DO Test Instead |
|---------------|-------------------|
| CSS classes (`toHaveClass('border-2')`) | Visual behavior (element visible, focused) |
| Styling (`text-3xl`, `font-bold`) | Use Storybook for visual QA |
| Third-party icons (lucide-react) | That clicking icon triggers action |
| Native browser behavior | Your component's handling of events |
| "Renders a div" | "Renders expected content" |
| Individual element existence | Consolidated behavior test |

### Test Consolidation

Parameterize repetitive tests:

```typescript
// Before: 4 separate tests (20 lines)
it('shows PWD status') { ... }
it('shows Recruitment status') { ... }
it('shows ETA9089 status') { ... }
it('shows I-140 status') { ... }

// After: 1 parameterized test (8 lines)
it.each([
  ['pwd', 'PWD'],
  ['recruitment', 'Recruitment'],
  ['eta9089', 'ETA 9089'],
  ['i140', 'I-140'],
])('shows %s status correctly', (status, label) => {
  render(<StatusBadge status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});
```

### Test File Locations

| Location | Project | Purpose |
|----------|---------|---------|
| `src/lib/**/*.test.ts` | unit | Library/utility tests |
| `src/hooks/**/*.test.ts` | unit | Hook tests |
| `convex/lib/perm/**/*.test.ts` | unit | PERM calculators/validators |
| `convex/lib/*.test.ts` | unit | Convex lib helpers |
| `src/components/**/__tests__/` | components | Component tests |
| `convex/*.test.ts` | convex | Convex integration tests |
| `convex/__tests__/*.test.ts` | convex | Convex integration tests |
| `tests/` | - | E2E tests (Playwright) |
| `test-utils/` | - | Test utilities, fixtures, factories |

### Convex Test Helpers

```typescript
import { convexTest } from 'convex-test';
import { api, internal } from './_generated/api';
import schema from './schema';

describe('cases', () => {
  it('creates a case', async () => {
    const t = convexTest(schema);

    // Create test user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', { email: 'test@example.com' });
    });

    // Set authenticated user
    const asUser = t.withIdentity({ subject: userId });

    // Test mutation
    const caseId = await asUser.mutation(api.cases.create, {
      beneficiaryName: 'Test',
      employerName: 'Company',
    });

    // Verify with query
    const result = await asUser.query(api.cases.get, { id: caseId });
    expect(result.beneficiaryName).toBe('Test');
  });
});
```

### Test Data Factories

Use factories from `test-utils/` for consistent test data:

```typescript
import { createTestCase, createTestUser } from '@/test-utils';

const testCase = createTestCase({
  beneficiaryName: 'John Doe',
  // Override defaults as needed
});
```

### Coverage Expectations

- **Current:** 3500+ tests passing
- **PERM business logic:** 100% coverage required
- **Convex functions:** High coverage for all mutations/queries
- **Components:** Coverage for interactive behavior

**CI Coverage Thresholds:**
| Metric | Threshold |
|--------|-----------|
| Lines | 75% |
| Functions | 75% |
| Statements | 75% |
| Branches | 70% |

Test coverage for PERM logic is critical. All calculators and validators have comprehensive tests in `convex/lib/perm/__tests__/`.

**See:** `TEST_README.md` for comprehensive testing documentation.

---

## Code Style

- **TypeScript strict mode** - No `any` types
- **ISO date strings** - YYYY-MM-DD format everywhere
- **Central imports** - Always from `@/lib/perm` or `convex/lib/perm`
- **TDD** - Tests before implementation for business logic
- **JSDoc** - Document all public functions with examples

---

## Common Patterns

### Form with Cascade

```typescript
// In a form component
import { applyCascade } from '@/lib/perm';

const handleDateChange = (field: string, value: string) => {
  const updated = applyCascade(formData, { field, value });
  setFormData(updated);
};
```

### Validation on Save

```typescript
import { validateCase } from '@/lib/perm';

const handleSave = () => {
  const result = validateCase(formData);
  if (!result.valid) {
    setErrors(result.errors);
    return;
  }
  // Proceed with save
};
```

### Display Filing Window Status

```typescript
import { getFilingWindowStatusFromCase } from '@/lib/perm';

const FilingWindowBadge = ({ caseData }) => {
  const status = getFilingWindowStatusFromCase(caseData);
  return <Badge variant={status.status}>{status.message}</Badge>;
};
```

---

## Documentation References

| Topic | File |
|-------|------|
| **Convex API Reference** | `docs/API.md` |
| PERM Workflow (canonical) | `perm_flow.md` |
| Business Rules | `.planning/V2_BUSINESS_RULES.md` |
| Validation Rules (44 rules) | `.planning/V2_VALIDATION_RULES.md` |
| Deadline Formulas | `.planning/V2_DEADLINE_FLOWS.md` |
| Schema Reference | `.planning/V2_CONVEX_SCHEMA.md` |
| Design Tokens | `.planning/V2_DESIGN_TOKENS.json` |

---

## Anti-Patterns (DON'T DO THIS)

```typescript
// DON'T: Recreate deadline logic
const expiration = addDays(determinationDate, 365); // WRONG

// DO: Use the central calculator
import { calculatePWDExpiration } from '@/lib/perm';
const expiration = calculatePWDExpiration(determinationDate); // CORRECT
```

```typescript
// DON'T: Hardcode validation rules
if (filingDate > certDate + 180) { ... } // WRONG

// DO: Use the central validator
import { validateI140 } from '@/lib/perm';
const result = validateI140({ eta9089_certification_date, i140_filing_date }); // CORRECT
```

```typescript
// DON'T: Manually calculate business days
let days = 0;
while (days < 10) { ... } // WRONG

// DO: Use the central utility
import { addBusinessDays } from '@/lib/perm';
const deadline = addBusinessDays(startDate, 10); // CORRECT
```

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Date off by one day | Use UTC functions, check timezone handling |
| Validation not catching error | Check you're using the right validator |
| Cascade not triggering | Ensure you're calling `applyCascade()` on change |
| Import not found | Check import path (`@/lib/perm` vs `convex/lib/perm`) |

---

## Notification System

### Creating Notifications

Use the internal mutation to create notifications from any Convex function:

```typescript
import { internal } from './_generated/api';

// Inside a mutation or action handler
await ctx.runMutation(internal.notifications.createNotification, {
  userId,
  type: 'status_change',
  title: 'Case Status Updated',
  message: 'Status changed to Recruitment',
  priority: 'normal',
  caseId, // optional - links notification to a case
});
```

### Notification Types

| Type | Description | Use Case |
|------|-------------|----------|
| `deadline_reminder` | Deadline approaching or overdue | Scheduled reminders for upcoming/past deadlines |
| `status_change` | Case or progress status changed | When case status transitions |
| `rfi_alert` | RFI received or due | RFI-related notifications |
| `rfe_alert` | RFE received or due | RFE-related notifications |
| `system` | System notification | General system messages |
| `auto_closure` | Case auto-closed | When a case is automatically closed |

### Priority Levels

| Priority | Use When |
|----------|----------|
| `low` | Informational only, no action required |
| `normal` | Standard updates (status changes, general alerts) |
| `high` | Action needed soon (deadline within 7 days) |
| `urgent` | Immediate action required (overdue, critical deadlines) |

### Notification Cleanup

Notifications are **automatically deleted after 90 days** if read. The cleanup runs hourly via cron job.

---

## Scheduled Jobs

### Cron Configuration

Cron jobs are defined in `convex/crons.ts`:

| Job Name | Schedule | Purpose |
|----------|----------|---------|
| `deadline-reminders` | Daily 9 AM EST (14:00 UTC) | Check deadlines and send reminder notifications |
| `notification-cleanup` | Hourly at :30 | Delete read notifications older than 90 days |
| `weekly-digest` | Monday 9 AM EST (14:00 UTC) | Send weekly summary emails |

### Adding New Cron Jobs

**3-step process:**

1. **Define the handler** (internal action in appropriate file):
```typescript
// convex/scheduledJobs.ts
export const myNewJob = internalAction({
  args: {},
  handler: async (ctx) => {
    // Job logic here
    // Use ctx.runMutation/ctx.runQuery for DB operations
  },
});
```

2. **Register the cron** in `convex/crons.ts`:
```typescript
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily(
  'my-new-job',
  { hourUTC: 14, minuteUTC: 0 }, // 9 AM EST
  internal.scheduledJobs.myNewJob
);

export default crons;
```

3. **Deploy** - crons are automatically registered when `npx convex dev` runs.

### Handler Patterns

Always use **internal actions** for cron handlers:

```typescript
// CORRECT: Internal action for cron handler
export const processDeadlines = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch data via runQuery
    const cases = await ctx.runQuery(internal.cases.listWithDeadlines);

    // Process and create notifications via runMutation
    for (const case of cases) {
      await ctx.runMutation(internal.notifications.createNotification, {...});
    }
  },
});
```

---

## Push Notifications

### VAPID Configuration

Push notifications use VAPID (Voluntary Application Server Identification) for authentication:

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` / Convex env | Client-side subscription |
| `VAPID_PRIVATE_KEY` | Convex env only | Server-side signing (NEVER expose) |

VAPID subject: `mailto:support@permtracker.app`

### Subscription Flow

1. **Client requests permission** and subscribes:
```typescript
// Client-side
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
});

// Save to Convex
await savePushSubscription({ subscription: JSON.stringify(subscription) });
```

2. **Server saves subscription**:
```typescript
// convex/pushSubscriptions.ts
export const savePushSubscription = mutation({
  args: { subscription: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    // Store subscription linked to user
  },
});
```

3. **Server sends notification**:
```typescript
// convex/pushNotifications.ts
export const sendPushNotification = internalAction({
  args: { userId: v.id('users'), title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    // Fetch user's subscription
    // Use web-push library to send
  },
});
```

### Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxW

# Convex Dashboard (both dev and prod)
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Email Templates

### Template Locations

Email templates use **React Email** and are located in `src/emails/`:

```
src/emails/
├── DeadlineReminder.tsx    # Deadline approaching/overdue
├── StatusChange.tsx        # Case status changed
├── RfiAlert.tsx            # RFI received notification
├── RfeAlert.tsx            # RFE received notification
├── AutoClosure.tsx         # Case auto-closed notification
└── components/             # Shared email components
    ├── EmailLayout.tsx
    ├── Header.tsx
    └── Footer.tsx
```

### Rendering and Sending

```typescript
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { DeadlineReminder } from '../src/emails/DeadlineReminder';

// In a Convex action
export const sendDeadlineReminderEmail = internalAction({
  args: {
    to: v.string(),
    employerName: v.string(),
    beneficiaryName: v.string(),
    deadlineType: v.string(),
    deadlineDate: v.string(),
    daysUntil: v.number(),
    caseId: v.id('cases'),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = await render(
      DeadlineReminder({
        employerName: args.employerName,
        beneficiaryName: args.beneficiaryName,
        deadlineType: args.deadlineType,
        deadlineDate: args.deadlineDate,
        daysUntil: args.daysUntil,
      })
    );

    await resend.emails.send({
      from: 'PERM Tracker <noreply@permtracker.app>',
      to: args.to,
      subject: `Deadline Reminder: ${args.deadlineType}`,
      html,
    });
  },
});
```

### Scheduling Email from Notification

When creating a notification that should also send an email:

```typescript
// After creating the notification
ctx.scheduler.runAfter(0, internal.notificationActions.sendDeadlineReminderEmail, {
  notificationId,
  to: user.email,
  employerName: case.employerName,
  beneficiaryName: case.beneficiaryName,
  deadlineType: 'PWD Expiration',
  deadlineDate: case.pwdExpirationDate,
  daysUntil: 7,
  caseId: case._id,
});
```

### Resend API Integration

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (Convex env) |
| From address | `noreply@permtracker.app` (verified domain) |

**Rate limits:** Resend free tier allows 100 emails/day, 3000/month. Production tier recommended.
