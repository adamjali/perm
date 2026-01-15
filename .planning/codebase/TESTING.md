# Testing Patterns

**Analysis Date:** 2026-01-03

## Test Framework

**Runner:**
- Vitest 4.0.16 (primary unit/component tests)
- Playwright 1.57.0 (E2E browser tests)
- convex-test (Convex function testing)

**Assertion Library:**
- Vitest built-in expect
- @testing-library/jest-dom matchers
- Chai assertions (via Vitest)

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:coverage                 # Coverage report
npm run test:e2e                      # Playwright E2E tests
```

## Test File Organization

**Location:**
- Component tests: `src/**/__tests__/*.test.tsx` (colocated)
- Convex tests: `convex/*.test.ts` (colocated)
- PERM logic tests: `convex/lib/perm/**/__tests__/*.test.ts`
- E2E tests: `tests/e2e/*.spec.ts` (separate directory)
- Test utilities: `test-utils/`

**Naming:**
- Unit tests: `{module}.test.ts`
- Component tests: `{Component}.test.tsx`
- E2E tests: `{feature}.spec.ts`

**Structure:**
```
v2/
├── convex/
│   ├── cases.test.ts              # Convex function tests
│   ├── users.test.ts
│   └── lib/perm/
│       ├── calculators/
│       │   ├── pwd.ts
│       │   └── pwd.test.ts        # Colocated calculator tests
│       └── validators/
│           ├── pwd.ts
│           └── pwd.test.ts        # Colocated validator tests
├── src/components/
│   ├── dashboard/
│   │   ├── DeadlineHeroWidget.tsx
│   │   └── __tests__/
│   │       └── DeadlineHeroWidget.test.tsx
│   └── forms/
│       ├── DateInput.tsx
│       └── __tests__/
│           └── DateInput.test.tsx
├── test-utils/
│   ├── render-utils.tsx           # React render helpers
│   ├── dashboard-fixtures.ts      # Test data
│   └── convex.ts                  # Convex test helpers
└── tests/e2e/
    └── connection.spec.ts         # Playwright tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
  });

  describe('functionName', () => {
    describe('with valid input', () => {
      it('returns expected output', () => {
        // Arrange
        const input = createTestInput();

        // Act
        const result = functionName(input);

        // Assert
        expect(result).toEqual(expectedOutput);
      });
    });

    describe('with invalid input', () => {
      it('throws ValidationError', () => {
        expect(() => functionName(null)).toThrow('Invalid input');
      });
    });
  });
});
```

**Patterns:**
- Use beforeEach for per-test setup, avoid beforeAll
- Use afterEach to restore mocks: `vi.restoreAllMocks()`
- Arrange/Act/Assert pattern required
- One assertion focus per test (multiple expects OK)
- Descriptive test names: "should..." or "does..."

## Mocking

**Framework:**
- Vitest built-in mocking (vi)
- Module mocking via vi.mock() at top of file

**Patterns:**
```typescript
import { vi } from 'vitest';

// Mock module at top of file
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}));

describe('Component', () => {
  it('uses mocked function', () => {
    const mockRouter = vi.mocked(useRouter);
    mockRouter.mockReturnValue({ push: vi.fn() });

    // ... test

    expect(mockRouter().push).toHaveBeenCalledWith('/cases');
  });
});
```

**What to Mock:**
- External APIs (Google Calendar, Resend)
- Browser APIs (matchMedia, ResizeObserver)
- Next.js navigation (usePathname, useRouter)
- Convex hooks (useQuery, useMutation)
- Date/time (vi.useFakeTimers)

**What NOT to Mock:**
- Pure business logic functions
- Internal utilities (string manipulation, array helpers)
- Type definitions

## Fixtures and Factories

**Test Data:**
```typescript
// test-utils/dashboard-fixtures.ts
export function createMockDeadlineGroups(): DeadlineGroups {
  return {
    critical: [],
    overdue: [],
    thisWeek: [],
    upcoming: []
  };
}

// Factory with overrides
export function createTestCase(overrides?: Partial<CaseData>): CaseData {
  return {
    _id: 'test-case-id' as Id<'cases'>,
    beneficiaryName: 'Test Case',
    caseStatus: 'pwd' as CaseStatus,
    ...overrides
  };
}
```

**Location:**
- Shared fixtures: `test-utils/*.ts`
- Component-specific: In `__tests__/` alongside component
- Factory functions: Named `create*` or `mock*`

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on critical paths (PERM logic, auth, data mutations)
- PERM calculators/validators: ~100% coverage

**Configuration:**
- Vitest coverage via c8 (built-in)
- Excludes: *.test.ts(x), config files, _generated/

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Single function/module in isolation
- Mocking: All external dependencies
- Speed: <100ms per test
- Location: `*.test.ts` colocated with source
- Examples: pwd.test.ts, validateCase.test.ts

**Component Tests:**
- Scope: React component rendering and interaction
- Mocking: Convex hooks, browser APIs, navigation
- Environment: jsdom
- Location: `__tests__/` directories
- Examples: DeadlineHeroWidget.test.tsx, DateInput.test.tsx

**Convex Function Tests:**
- Scope: Queries, mutations, actions
- Mocking: External services only
- Environment: edge-runtime
- Location: `convex/*.test.ts`
- Pattern: Use `createTestContext()` helper

**E2E Tests:**
- Framework: Playwright
- Scope: Full user flows in real browser
- Location: `tests/e2e/`
- Examples: connection.spec.ts

## Common Patterns

**Async Testing:**
```typescript
it('handles async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
it('throws on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

// Async error
it('rejects on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message');
});
```

**Component Testing:**
```typescript
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render-utils';

it('renders correctly', () => {
  renderWithProviders(<Component data={mockData} />);
  expect(screen.getByRole('heading')).toBeInTheDocument();
});
```

**Convex Testing:**
```typescript
import { createTestContext, createAuthenticatedContext } from '@/test-utils/convex';

const t = createTestContext();
const asUser = await createAuthenticatedContext(t, 'test@example.com');

const result = await asUser.mutation(api.cases.create, { ... });
expect(result).toBeDefined();
```

**Timer Testing:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('debounces input', () => {
  // trigger action
  vi.advanceTimersByTime(300);
  expect(callback).toHaveBeenCalled();
});
```

## Vitest Configuration

**File:** vitest.config.ts

**Test Projects:**
```typescript
{
  test: {
    projects: [
      {
        name: 'components',
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
        setupFiles: './vitest.setup.ts'
      },
      {
        name: 'convex',
        environment: 'edge-runtime',
        include: ['convex/**/*.test.ts']
      }
    ]
  }
}
```

**Setup File (vitest.setup.ts):**
- Testing Library matchers
- next-themes mock
- next/navigation mocks
- motion/react mock
- JSDOM polyfills (matchMedia, ResizeObserver)

## Snapshot Testing

- Not used in this codebase
- Prefer explicit assertions for clarity

---

*Testing analysis: 2026-01-03*
*Update when test patterns change*
