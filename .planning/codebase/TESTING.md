# Testing Patterns

**Analysis Date:** 2026-01-16

## Test Framework

**Runner:**
- Vitest 4.0+ with React plugin
- Config: `v2/vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`)
- `@testing-library/jest-dom/vitest` for DOM matchers

**Run Commands:**
```bash
pnpm test              # Watch mode (development)
pnpm test:fast         # Unit tests only (~30s)
pnpm test:run          # Full suite (~9 min, 3600+ tests)
pnpm test:unit         # Unit project only
pnpm test:components   # Component project only
pnpm test:convex       # Convex integration tests
pnpm test:perm         # PERM business logic only
pnpm test:coverage     # With coverage report
pnpm test:e2e          # Playwright E2E tests
```

## Test File Organization

**Location:**
- Co-located in `__tests__/` directories within component folders
- Business logic tests alongside implementation in `convex/lib/perm/`

**Naming:**
- `*.test.ts` for TypeScript tests
- `*.test.tsx` for React component tests
- Match implementation file name: `pwd.ts` → `pwd.test.ts`

**Structure:**
```
v2/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── __tests__/
│   │       │   ├── SummaryTile.test.tsx
│   │       │   └── DeadlineHeroWidget.test.tsx
│   │       └── SummaryTile.tsx
│   ├── hooks/
│   │   └── __tests__/
│   │       └── useFormCalculations.test.ts
│   └── lib/
│       └── __tests__/
│           └── animations.test.ts
├── convex/
│   ├── lib/
│   │   └── perm/
│   │       ├── calculators/
│   │       │   ├── pwd.ts
│   │       │   └── pwd.test.ts       # Co-located
│   │       └── validators/
│   │           ├── pwd.ts
│   │           └── pwd.test.ts
│   └── cases.test.ts                  # Integration tests
└── test-utils/                        # Shared utilities
    ├── index.ts
    ├── render-utils.tsx
    ├── convex.ts
    ├── ui-fixtures.ts
    └── dashboard-fixtures.ts
```

## Test Structure

**Suite Organization:**
```typescript
// @vitest-environment jsdom
/**
 * SummaryTile Component Tests
 *
 * Tests essential behavior:
 * - Renders label, count, and link
 * - Handles edge cases (zero count, empty subtext)
 * - Accessibility requirements met
 *
 * NOTE: Styling tests removed - verify via Storybook.
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render-utils";
import SummaryTile from "../SummaryTile";

const defaultProps = {
  status: "pwd" as const,
  label: "PWD",
  count: 5,
  subtext: "3 working, 2 filed",
  href: "/cases?status=pwd",
};

describe("SummaryTile", () => {
  describe("content rendering", () => {
    it("renders label, count, and subtext", () => {
      renderWithProviders(<SummaryTile {...defaultProps} />);

      expect(screen.getByText("PWD")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("3 working, 2 filed")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles zero count", () => {
      renderWithProviders(<SummaryTile {...defaultProps} count={0} subtext="" />);
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("link has accessible name containing the label", () => {
      renderWithProviders(<SummaryTile {...defaultProps} />);
      const link = screen.getByRole("link");
      expect(link.textContent).toContain("PWD");
    });
  });
});
```

**AAA Pattern (Arrange, Act, Assert):**
```typescript
it("should calculate May 15 → Aug 13", () => {
  // Arrange - implicit in pure function tests
  // Act
  const result = calculatePWDExpiration("2024-05-15");
  // Assert
  expect(result).toBe("2024-08-13");
});
```

## Mocking

**Framework:** Vitest's built-in `vi.mock()`

**Global Mocks (vitest.setup.ts):**
```typescript
// next/navigation - always mocked
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// next-themes - prevents script injection in tests
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

// motion/react - renders without animations
vi.mock("motion/react", () => ({
  motion: new Proxy({}, {
    get: (_, tag) => createMotionComponent(tag),
  }),
  AnimatePresence: ({ children }) => children,
}));
```

**Per-Test Mocks:**
```typescript
// Mock Convex hooks
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({ googleCalendarConnected: true }),
}));

// Mock Next.js router for specific tests
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));
```

**What to Mock:**
- External services (Convex queries/mutations in component tests)
- Browser APIs not in happy-dom (matchMedia, ResizeObserver)
- Next.js navigation hooks
- Animation libraries (for deterministic tests)

**What NOT to Mock:**
- Business logic under test
- Pure utility functions
- The component being tested
- Date-fns (use real implementations)

## Fixtures and Factories

**Test Data Factories:**
```typescript
// test-utils/dashboard-fixtures.ts
export function createTestCase(overrides?: Partial<TestCaseData>): TestCaseData {
  return {
    _id: "test-case-id" as any,
    employerName: "Acme Corp",
    beneficiaryIdentifier: "John Doe",
    caseStatus: "pwd",
    progressStatus: "working",
    nextDeadline: "2025-12-31",
    nextDeadlineLabel: "PWD expires",
    isFavorite: false,
    isProfessionalOccupation: false,
    hasActiveRfi: false,
    hasActiveRfe: false,
    calendarSyncEnabled: false,
    dates: {
      created: Date.now(),
      updated: Date.now(),
    },
    ...overrides,
  };
}
```

**Convex Test Context Factory:**
```typescript
// test-utils/convex.ts
import { convexTest } from "convex-test";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

export function createTestContext() {
  return convexTest(schema, modules);
}

export async function createAuthenticatedContext(
  t: ReturnType<typeof createTestContext>,
  name?: string
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: name ?? "Test User",
      email: `test-${Math.random().toString(36).substring(7)}@example.com`,
    });
  });

  return t.withIdentity({
    subject: userId,
    name: name ?? "Test User",
  });
}
```

**Render Helper with Providers:**
```typescript
// test-utils/render-utils.tsx
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { providerProps?: { theme?: "light" | "dark" } }
) {
  const Wrapper = ({ children }) => (
    <AuthProvider>
      <ThemeProvider defaultTheme={options?.providerProps?.theme ?? "light"}>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}
```

**Location:**
- `v2/test-utils/` - All test utilities
- `v2/test-utils/index.ts` - Barrel export for all fixtures

## Coverage

**Requirements:**
| Metric | CI Threshold |
|--------|--------------|
| Lines | 75% |
| Functions | 75% |
| Statements | 75% |
| Branches | 70% |

**View Coverage:**
```bash
pnpm test:coverage    # Generate HTML report
open coverage/index.html
```

**Critical Paths:**
- PERM business logic (`convex/lib/perm/`): 100% coverage required
- Convex mutations/queries: High coverage expected
- UI components: Behavior coverage, not CSS

## Test Types

**Unit Tests (Project: `unit`):**
- Pure functions, hooks, utilities
- Environment: `happy-dom`
- Timeout: 5s
- Location: `src/lib/**/*.test.ts`, `src/hooks/**/*.test.ts`, `convex/lib/perm/**/*.test.ts`
- Fast, no isolation (shared environment)

**Component Tests (Project: `components`):**
- React components with DOM assertions
- Environment: `happy-dom`
- Timeout: 10s
- Location: `src/components/**/*.test.tsx`, `src/app/**/*.test.tsx`, `src/emails/**/*.test.tsx`
- Isolated for clean DOM state

**Convex Integration Tests (Project: `convex`):**
- Database operations with `convex-test`
- Environment: `edge-runtime`
- Timeout: 15s
- Location: `convex/*.test.ts`, `convex/__tests__/*.test.ts`
- Tests security, user isolation, soft deletes

**E2E Tests:**
- Full user flows with Playwright
- Config: `v2/playwright.config.ts`
- Location: `v2/tests/`
- Run: `pnpm test:e2e`

## Common Patterns

**Async Testing:**
```typescript
it("should create a case", async () => {
  const t = createTestContext();
  const user = await createAuthenticatedContext(t, "User 1");

  const caseId = await user.mutation(api.cases.create, {
    employerName: "Test Corp",
    beneficiaryIdentifier: "John D.",
    positionTitle: "Engineer",
  });
  await finishScheduledFunctions(t);

  const result = await user.query(api.cases.get, { id: caseId });
  expect(result.employerName).toBe("Test Corp");
});
```

**Scheduled Function Testing:**
```typescript
import { setupSchedulerTests, finishScheduledFunctions } from "@/test-utils/convex";

describe("Cases with notifications", () => {
  setupSchedulerTests(); // Enables fake timers

  it("creates notification after case creation", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t);

    await user.mutation(api.cases.create, { ... });
    await finishScheduledFunctions(t); // Wait for scheduled jobs

    const notifications = await user.query(api.notifications.list, {});
    expect(notifications).toHaveLength(1);
  });
});
```

**Error Testing:**
```typescript
it("should reject unauthenticated create mutation", async () => {
  const t = createTestContext();
  await expect(
    t.mutation(api.cases.create, {
      employerName: "Test Corp",
      beneficiaryIdentifier: "John D.",
      positionTitle: "Engineer",
    })
  ).rejects.toThrow();
});
```

**Parameterized Testing:**
```typescript
describe("calculatePWDExpiration", () => {
  describe("Case 1: April 2 - June 30 (determination + 90 days)", () => {
    it.each([
      ["May 15 → Aug 13", "2024-05-15", "2024-08-13"],
      ["Apr 2 → Jul 1", "2024-04-02", "2024-07-01"],
      ["Jun 30 → Sep 28", "2024-06-30", "2024-09-28"],
    ])("should calculate %s", (_, input, expected) => {
      expect(calculatePWDExpiration(input)).toBe(expected);
    });
  });
});
```

**User Event Testing:**
```typescript
it("calls onClick when button is clicked", async () => {
  const { user, getByRole } = renderWithProviders(
    <CaseCard case={mockCase} />
  );

  await user.click(getByRole("button", { name: /favorite/i }));

  expect(mockToggleFavorite).toHaveBeenCalled();
});
```

## What NOT to Test

| DO NOT Test | DO Test Instead |
|-------------|-----------------|
| CSS classes (`toHaveClass('border-2')`) | Visual behavior (element visible/focused) |
| Styling (`text-3xl`, `font-bold`) | Use Storybook for visual QA |
| Third-party icons (lucide-react) | That clicking icon triggers action |
| Implementation details (internal state) | Public behavior and output |
| "Renders a div" | "Renders expected content" |

**Anti-patterns to Avoid:**
- Testing CSS class presence (brittle, not behavioral)
- Separate tests for each edge case (use parameterized tests)
- Giant test functions with unrelated assertions
- Tests that depend on execution order

## Test Consolidation

**Before (20+ lines):**
```typescript
it('shows PWD status') { ... }
it('shows Recruitment status') { ... }
it('shows ETA9089 status') { ... }
it('shows I-140 status') { ... }
```

**After (8 lines):**
```typescript
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

## Speed Optimization

**Development Workflow:**
1. `pnpm test` (watch mode) - Re-runs on save
2. `pnpm test:fast` - Quick validation (~30s)
3. `pnpm test:run` - Full suite only before commit

**Config Optimizations:**
- `happy-dom` over `jsdom` (faster)
- `isolate: false` for unit tests (shared env)
- `isolate: true` for component tests (clean DOM)
- `bail: 1` locally (fail fast)
- Test projects separate by environment needs

**WARNING:** Full test suite takes ~9 minutes. Do NOT run repeatedly during development.

## Vitest Project Configuration

```typescript
// vitest.config.ts
projects: [
  {
    // Unit tests - fastest
    test: {
      name: "unit",
      environment: "happy-dom",
      include: [
        "src/lib/**/*.test.{ts,tsx}",
        "src/hooks/**/*.test.{ts,tsx}",
        "convex/lib/perm/**/*.test.ts",
      ],
      isolate: false, // Share environment for speed
      testTimeout: 5000,
    },
  },
  {
    // Component tests - isolated
    test: {
      name: "components",
      environment: "happy-dom",
      include: ["src/components/**/*.test.{ts,tsx}"],
      isolate: true, // Clean DOM per test
      testTimeout: 10000,
    },
  },
  {
    // Convex integration - edge runtime
    test: {
      name: "convex",
      environment: "edge-runtime",
      include: ["convex/*.test.ts", "convex/__tests__/*.test.ts"],
      testTimeout: 15000,
    },
  },
],
```

---

*Testing analysis: 2026-01-16*
