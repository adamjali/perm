# v2 Testing Guide

## Quick Start

```bash
pnpm test:run      # Run all unit tests
pnpm test:fast     # Unit + PERM tests (~40s)
pnpm test:e2e      # Run E2E tests
pnpm test:all      # Run all tests
```

---

## Recommended Dev Workflow

Use the right command for the situation - you rarely need the full 10-minute suite:

| When | Command | Time | Tests |
|------|---------|------|-------|
| **Active coding** | `pnpm test` | Instant on change | Only affected |
| **Working on one file** | `pnpm test path/to/file.test.ts` | ~2s | That file |
| **Before commit** | `pnpm test:fast` | ~40s | 1359 |
| **Before PR** | `pnpm test:run` | ~10 min | 3603 |

```bash
# While coding - watch mode re-tests on save (recommended)
pnpm test

# Quick sanity check before commit
pnpm test:fast

# Only test what you changed since last commit
pnpm test:changed

# Run specific test file
pnpm test src/hooks/useDebounce.test.ts
```

**Tip:** Watch mode (`pnpm test`) is the most efficient - it detects file changes and only re-runs affected tests instantly.

---

## Test Projects

The test suite is organized into **four Vitest projects** for optimal performance:

| Project | Environment | Test Location | Timeout | Notes |
|---------|-------------|---------------|---------|-------|
| `unit` | jsdom | `src/lib/**`, `src/hooks/**` | 5s | `isolate: false` for speed |
| `perm-unit` | jsdom | `convex/lib/perm/**`, `convex/lib/*.test.ts` | 5s | `isolate: false` - pure functions |
| `components` | jsdom | `src/components/**`, `src/app/**`, `src/emails/**` | 15s | Full isolation |
| `convex` | edge-runtime | `convex/*.test.ts`, `convex/__tests__/**` | 15s | Integration tests only |

Run specific projects:
```bash
pnpm test:unit        # src/lib and src/hooks tests
pnpm test:perm-unit   # PERM pure function tests (fast)
pnpm test:components  # Component tests only
pnpm test:convex      # Convex integration tests only
```

---

## Available Test Scripts

### Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `pnpm test:fast` | Unit + PERM tests (~40s, 1300+ tests) | During development |
| `pnpm test:perm` | PERM business logic only | Working on calculators/validators |
| `pnpm test:changed` | Changed files only | Before committing |
| `pnpm test:run` | Full suite (~10 min, 3600+ tests) | Before PR |

### All Scripts

**Basic:**
- `pnpm test` - Watch mode
- `pnpm test:run` - Run all tests once
- `pnpm test:watch` - Explicit watch mode

**By Project:**
- `pnpm test:unit` - Unit tests (src/lib, src/hooks)
- `pnpm test:perm-unit` - PERM pure function tests (convex/lib/perm)
- `pnpm test:components` - Component tests
- `pnpm test:convex` - Convex integration tests

**PERM-Specific:**
- `pnpm test:perm` - All PERM calculators and validators
- `pnpm test:validators` - Validation rules only
- `pnpm test:calculators` - Deadline calculators only

**Smart Testing:**
- `pnpm test:changed` - Files changed since last commit
- `pnpm test:related` - Tests related to changed files

**Coverage:**
- `pnpm test:coverage` - Full coverage report
- `pnpm test:coverage:perm` - PERM logic coverage only

**CI/E2E:**
- `pnpm test:ci` - CI pipeline (JSON output + GitHub Actions)
- `pnpm test:e2e` - E2E tests (Playwright)
- `pnpm test:e2e:ui` - E2E with UI runner
- `pnpm test:e2e:debug` - E2E debug mode
- `pnpm test:all` - Unit + E2E

---

## Unit Tests (Vitest + convex-test)

```bash
pnpm test          # Watch mode
pnpm test:run      # Single run
pnpm test:coverage # With coverage
```

**Location:**
- Convex function tests: `convex/*.test.ts`
- React component tests: `src/**/*.test.tsx`
- Test utilities tests: `test-utils/*.test.ts`

## E2E Tests (Playwright)

```bash
pnpm test:e2e       # Headless (starts servers automatically)
pnpm test:e2e:ui    # Interactive UI mode
pnpm test:e2e:debug # Debug mode
```

**Location:** `tests/e2e/*.spec.ts`

**Note:** E2E tests use `./run-e2e-tests.sh` which:
1. Starts Convex dev server
2. Waits for Convex functions to be ready
3. Starts Next.js dev server
4. Runs Playwright tests
5. Cleans up servers

## Test Utilities

See `test-utils/convex.ts` for Convex testing helpers:

```typescript
import { createTestContext, createAuthenticatedContext, fixtures } from "../test-utils/convex";

// Basic test context (isolated database)
const t = createTestContext();
const items = await t.query(api.yourModule.list);

// Authenticated context (mock user)
const t = createAuthenticatedContext("user-123", "Test User");

// Test fixtures
const item = fixtures.testItem({ text: "Custom" });
```

See `src/lib/testUtils.tsx` for React component testing helpers.

---

## Timer Utilities

Use centralized timer utilities from `test-utils/timer-utils.ts` to eliminate duplicated fake timer boilerplate.

### useFakeTimers()

Setup fake timers with automatic cleanup:

```typescript
import { useFakeTimers } from "../../../test-utils";

describe("MyTests", () => {
  const { advanceTime, setSystemTime } = useFakeTimers();

  it("debounces correctly", () => {
    // trigger action
    advanceTime(300);
    // assert result
  });
});
```

### useFakeTimersWithDate()

Setup with a specific system date:

```typescript
import { useFakeTimersWithDate } from "../../../test-utils";

describe("DeadlineTests", () => {
  const { advanceTime, setSystemTime } = useFakeTimersWithDate("2024-06-01");

  it("calculates PWD expiration", () => {
    // System time is 2024-06-01
    const result = calculatePWDExpiration("2024-06-01");
    expect(result).toBe("2025-06-30");
  });

  it("can change date mid-test", () => {
    setSystemTime("2024-07-15");
    // Now system time is 2024-07-15
  });
});
```

### useAutoAdvancingTimers()

For userEvent compatibility (timers auto-advance):

```typescript
import { useAutoAdvancingTimers } from "../../../test-utils";

describe("FormTests", () => {
  const { advanceTime } = useAutoAdvancingTimers();

  it("handles user input with debounce", async () => {
    const user = userEvent.setup();
    await user.type(input, "hello");
    advanceTime(300); // Debounce completes
  });
});
```

### Available Controls

All timer utilities return these controls:

| Method | Description |
|--------|-------------|
| `advanceTime(ms)` | Advance timers by milliseconds |
| `setSystemTime(date)` | Set system time to date string or Date |
| `runAllTimers()` | Run all pending timers |
| `runAllTimersAsync()` | Run all pending timers (async) |
| `runOnlyPendingTimers()` | Run only currently pending timers |
| `getTimerCount()` | Get count of pending timers |
| `clearAllTimers()` | Clear all timers without running |

---

## Coverage

### CI Thresholds

In CI environments, coverage is enforced with these thresholds:

| Metric | Threshold |
|--------|-----------|
| Lines | 75% |
| Functions | 75% |
| Statements | 75% |
| Branches | 70% |

### Running Coverage

```bash
pnpm test:coverage        # Full coverage report
pnpm test:coverage:perm   # PERM logic coverage only
open coverage/index.html  # View HTML report
```

### Coverage Output

Coverage reports are generated in `./coverage/`:
- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format (for CI tools)
- `coverage/coverage-summary.json` - JSON summary

---

## ⚠️ Critical Pitfalls to Avoid

### 1. Never put `import.meta.glob` in convex/ directory

**Problem:** `import.meta.glob` is a Vite-specific feature. Convex runtime doesn't support it.

**Error you'll see:**
```
Error: import.meta unsupported at <anonymous> (../../convex/lib/someFile.ts)
```

**Solution:** Keep test utilities using `import.meta.glob` OUTSIDE the `convex/` directory.
That's why `test-utils/convex.ts` exists - it's excluded from Convex deployment.

### 2. tsconfig.json must exclude test files

The main `tsconfig.json` excludes test files:
```json
"exclude": ["node_modules", "test-utils", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]
```

This prevents Convex's TypeScript checker from failing on Vite-specific code.

### 3. @ts-expect-error for Vite-specific features

The `test-utils/convex.ts` uses `@ts-expect-error` to suppress TypeScript errors:
```typescript
// @ts-expect-error - import.meta.glob is a Vite feature not in standard TypeScript
const modules = import.meta.glob("../convex/**/*.ts");
```

This is surgical and self-documenting. Vitest handles TypeScript with proper Vite support.

### 4. Test file naming conventions

| Type | Pattern | Environment |
|------|---------|-------------|
| Convex functions | `convex/*.test.ts` | edge-runtime |
| React components | `src/**/*.test.tsx` | jsdom |
| Test utilities | `test-utils/*.test.ts` | edge-runtime |
| E2E browser | `tests/e2e/*.spec.ts` | Playwright |

### 5. convex-test requires modules parameter

When using `convexTest()`, you MUST pass the modules:
```typescript
// WRONG - will fail with "Could not find _generated directory"
const t = convexTest(schema);

// CORRECT - modules loaded via import.meta.glob
const modules = import.meta.glob("../convex/**/*.ts");
const t = convexTest(schema, modules);
```

Use `createTestContext()` from `test-utils/convex.ts` to avoid this boilerplate.

---

## Architecture

```
v2/
├── convex/                   # Convex functions (deployed)
│   ├── *.test.ts            # Convex unit tests (NOT deployed)
│   └── _generated/          # Auto-generated types
├── test-utils/              # Test utilities (excluded from Convex)
│   ├── convex.ts            # Convex test helpers
│   └── convex.test.ts       # Tests for helpers
├── src/
│   └── lib/
│       └── testUtils.tsx    # React test helpers
├── tests/
│   └── e2e/                 # Playwright E2E tests
│       └── *.spec.ts
├── vitest.config.ts         # Vitest configuration
├── playwright.config.ts     # Playwright configuration
└── run-e2e-tests.sh         # E2E test runner script
```

## Current Test Counts

| Project | Tests | Files | Description |
|---------|-------|-------|-------------|
| `unit` | ~100 | 21 | src/lib and src/hooks |
| `perm-unit` | ~1260 | 23 | PERM calculators, validators, cascade |
| `components` | ~350 | 62 | React components, pages, test-utils |
| `convex` | ~1890 | 12 | Convex integration tests |
| **Total** | **3603** | **118** | |

### PERM Engine Test Breakdown

The PERM Engine is a comprehensive TypeScript library for PERM deadline calculations and validation with 100% test coverage:

| Module | Tests | Description |
|--------|-------|-------------|
| PWD calculators | 19 | PWD expiration date calculations |
| PWD validators | 23 | PWD phase validations |
| Recruitment calculators | 21 | Recruitment deadline calculations |
| Recruitment validators | 37 | Recruitment phase validations |
| ETA 9089 calculators | 19 | ETA 9089 filing window calculations |
| ETA 9089 validators | 26 | ETA 9089 phase validations |
| I-140 calculators | 6 | I-140 deadline calculations |
| I-140 validators | 21 | I-140 phase validations |
| RFI calculators | 8 | RFI due date calculations |
| RFI validators | 17 | RFI validations |
| RFE validators | 18 | RFE validations |
| Case validator | 7 | Complete case validations |
| Cascade | 25 | Automatic field update logic |
| Integration | 29 | End-to-end integration tests |
| Business days | 17 | Business day utilities |
| Holidays | 26 | Federal holiday calculations |
| **PERM Total** | **319** | |

**See:** `convex/lib/perm/` for complete API documentation.

**Key Features:**
- 10 deadline calculators (PWD, recruitment, ETA 9089, I-140, RFI)
- 44 validation rules across 8 categories
- 5 cascade rules for automatic field updates
- Full federal holiday and business day support
- 100% isomorphic (browser and Node.js)

---

*Last updated: 2026-01-08*
