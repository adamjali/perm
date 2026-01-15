# Test Utilities

Test fixtures and helpers for v2 dashboard and UI component testing.

## Quick Import

All utilities are available from a single barrel export:

```ts
import {
  // Render utilities
  renderWithProviders,

  // Fixtures
  createTestCase,
  createMockDashboardSummary,

  // Timer utilities
  useFakeTimers,
  useFakeTimersWithDate,
  useAutoAdvancingTimers,
} from '@/test-utils';
```

## Files

| File | Purpose | Exports |
|------|---------|---------|
| `index.ts` | **Barrel export** - single import point | All utilities |
| `timer-utils.ts` | **Fake timer utilities** | `useFakeTimers()`, `useFakeTimersWithDate()`, `useAutoAdvancingTimers()` |
| `ui-fixtures.ts` | Mock data factories for dashboard/UI testing | Dashboard summary, user data, navigation links, status colors |
| `render-utils.tsx` | React testing helpers with providers | `renderWithProviders()`, provider wrappers, mock hooks |
| `dashboard-fixtures.ts` | Full case data factories | `createTestCase()`, preset case scenarios by stage |
| `deadline-fixtures.ts` | Deadline panel fixtures | Deadline groups, urgency styles, scenarios |
| `activity-fixtures.ts` | Activity feed fixtures | Activity items, upcoming deadlines, scenarios |
| `convex.ts` | Convex function testing utilities | `createTestContext()`, `createAuthenticatedContext()` |
| `convex-api-mock.ts` | Convex API mock for components | Mock API object for component tests |

## Quick Start

### Testing Dashboard Components

```tsx
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/test-utils/render-utils";
import { createMockDashboardSummary } from "@/test-utils/ui-fixtures";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";

describe("DashboardSummary", () => {
  it("displays PWD count and subtext", () => {
    const summary = createMockDashboardSummary({
      pwd: { count: 10, subtext: "5 working, 5 filed" }
    });

    const { getByText } = renderWithProviders(
      <DashboardSummary data={summary} />
    );

    expect(getByText("10")).toBeInTheDocument();
    expect(getByText("5 working, 5 filed")).toBeInTheDocument();
  });
});
```

### Testing with Theme

```tsx
import { renderWithProviders } from "@/test-utils/render-utils";

// Light mode (default)
const { container } = renderWithProviders(<MyComponent />);

// Dark mode
const { container } = renderWithProviders(<MyComponent />, {
  providerProps: { theme: "dark" }
});
```

### Using Mock Hooks

```tsx
import { vi } from "vitest";
import { mockUsePathname, mockUseRouter } from "@/test-utils/render-utils";

// Mock pathname
vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname("/dashboard")
}));

// Mock router with spy
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter({ push: pushMock })
}));
```

### Using Status Colors

```tsx
import { STATUS_COLORS } from "@/test-utils/ui-fixtures";

// Access hex values
console.log(STATUS_COLORS.pwd.hex); // "#0066FF"

// Access CSS variable names
console.log(STATUS_COLORS.pwd.cssVar); // "--stage-pwd"

// Access Tailwind class names
console.log(STATUS_COLORS.pwd.className); // "text-stage-pwd"
console.log(STATUS_COLORS.pwd.bgClassName); // "bg-stage-pwd"
```

### Dashboard Scenarios

Pre-built realistic test scenarios:

```tsx
import { dashboardScenarios } from "@/test-utils/ui-fixtures";

// Empty dashboard (new user)
const empty = dashboardScenarios.empty;

// Minimal dashboard (1 case)
const minimal = dashboardScenarios.minimal;

// Balanced dashboard (realistic mix)
const balanced = dashboardScenarios.balanced;

// High-volume dashboard (busy firm)
const highVolume = dashboardScenarios.highVolume;

// End-stage heavy (many I-140s and completions)
const endStageHeavy = dashboardScenarios.endStageHeavy;
```

## Available Exports

### ui-fixtures.ts

**Factory Functions:**
- `createMockDashboardSummary(overrides?)` - Dashboard summary data
- `createMockUser(overrides?)` - Authenticated user data

**Constants:**
- `NAV_LINKS` - Authenticated app navigation (Dashboard, Cases, Calendar, etc.)
- `AUTH_NAV_LINKS` - Public page navigation (Home, Demo)
- `STATUS_COLORS` - Case status color mappings (PWD, Recruitment, ETA 9089, I-140, Closed)
- `URGENCY_COLORS` - Deadline urgency colors (Urgent, Soon, Normal)
- `TAG_COLORS` - Additional tag colors (Professional, RFI Active, RFE Active)

**Preset Scenarios:**
- `dashboardScenarios.empty` - Empty dashboard
- `dashboardScenarios.minimal` - 1 case
- `dashboardScenarios.balanced` - Realistic mix
- `dashboardScenarios.highVolume` - High-volume firm
- `dashboardScenarios.endStageHeavy` - Many I-140/Complete

### render-utils.tsx

**Render Helpers:**
- `renderWithProviders(ui, options?)` - Render with all providers (ThemeProvider)
- `AllProviders` - Provider wrapper component

**Mock Hooks:**
- `mockUsePathname(pathname)` - Mock Next.js usePathname
- `mockUseRouter(overrides)` - Mock Next.js useRouter
- `mockUseQuery(data, isLoading?)` - Mock Convex useQuery
- `mockUseMutation(mutateFn)` - Mock Convex useMutation

**Utilities:**
- `waitForAsync(ms?)` - Wait for async state updates
- `renderLoadingState(ui)` - Render with loading state
- `suppressConsoleError(callback)` - Suppress console errors during tests

### dashboard-fixtures.ts

**Factory:**
- `createTestCase(userId, overrides?)` - Full case data factory

**Preset Fixtures:**
- `fixtures.pwd.*` - PWD stage scenarios
- `fixtures.recruitment.*` - Recruitment stage scenarios
- `fixtures.eta9089.*` - ETA 9089 stage scenarios
- `fixtures.i140.*` - I-140 stage scenarios
- `fixtures.special.*` - Special cases (closed, deleted, overdue)

**Date Helpers:**
- `today()` - Today's date as ISO string
- `daysFromNow(days)` - Date N days from now
- `daysAgo(days)` - Date N days ago
- `formatISO(date)` - Format Date as ISO string

### timer-utils.ts

Centralized fake timer utilities with automatic cleanup. Eliminates duplicated `beforeEach`/`afterEach` boilerplate.

**Functions:**

| Function | Use Case |
|----------|----------|
| `useFakeTimers(options?)` | General fake timer setup with auto-cleanup |
| `useFakeTimersWithDate(date)` | Setup with specific system date |
| `useAutoAdvancingTimers(date?)` | For userEvent compatibility (auto-advance) |
| `setupFakeTimersOnce(date?, options?)` | Single-test setup (call `cleanup()` when done) |

**Example:**

```typescript
import { useFakeTimersWithDate } from "../../../test-utils";

describe("DeadlineTests", () => {
  const { advanceTime, setSystemTime } = useFakeTimersWithDate("2024-06-01");

  it("calculates PWD expiration", () => {
    // System time is 2024-06-01
    const result = calculatePWDExpiration("2024-06-01");
    expect(result).toBe("2025-06-30");
  });

  it("advances time for debounce", () => {
    // trigger debounced action
    advanceTime(300);
    // assert result
  });
});
```

**Available Controls:**

All timer functions return these controls:

- `advanceTime(ms)` - Advance timers by milliseconds
- `setSystemTime(date)` - Set system time to date string or Date
- `runAllTimers()` - Run all pending timers
- `runAllTimersAsync()` - Run all pending timers (async)
- `runOnlyPendingTimers()` - Run only currently pending timers
- `getTimerCount()` - Get count of pending timers
- `clearAllTimers()` - Clear all timers without running

## Design System Integration

All status colors match v1 exactly and are aligned with the v2 design system:

| Status | Hex | CSS Variable | Tailwind Classes |
|--------|-----|--------------|------------------|
| PWD | `#0066FF` | `--stage-pwd` | `text-stage-pwd` / `bg-stage-pwd` |
| Recruitment | `#9333ea` | `--stage-recruitment` | `text-stage-recruitment` / `bg-stage-recruitment` |
| ETA 9089 | `#D97706` | `--stage-eta9089` | `text-stage-eta9089` / `bg-stage-eta9089` |
| I-140 | `#059669` | `--stage-i140` | `text-stage-i140` / `bg-stage-i140` |
| Closed | `#6B7280` | `--stage-closed` | `text-stage-closed` / `bg-stage-closed` |

## Testing Philosophy

1. **Factory over hardcoded** - Use factories (`createMock*`) for flexibility
2. **Realistic data** - Fixtures follow PERM workflow rules from `perm_flow.md`
3. **Complete types** - All factories return fully-typed objects
4. **Test in isolation** - Each test gets clean state via factories
5. **Match production** - Colors, links, and data structures match v1/v2 exactly

## Running Tests

```bash
# All test-utils tests
npm run test -- test-utils/

# Specific fixture tests
npm run test -- test-utils/ui-fixtures.test.ts

# All tests (includes component tests using these utilities)
npm run test
```

## See Also

- **Design System:** `v2/docs/DESIGN_SYSTEM.md` - Component library and utility classes
- **PERM Workflow:** `perm_flow.md` - Source of truth for case statuses and deadlines
- **Dashboard Context:** `.planning/phases/20-dashboard/20-CONTEXT.md` - Dashboard requirements
- **Vitest Config:** `v2/vitest.config.ts` - Test environment configuration
