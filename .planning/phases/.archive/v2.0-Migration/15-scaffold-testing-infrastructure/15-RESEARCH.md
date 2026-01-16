# Phase 15: Scaffold + Testing Infrastructure - Research

**Researched:** 2025-12-20
**Domain:** Next.js 15 + Convex + Vitest + Playwright
**Confidence:** HIGH

<research_summary>
## Summary

Researched the complete stack for scaffolding a Next.js 15 + Convex project with comprehensive testing infrastructure. The standard approach uses Next.js 15 App Router with Convex as the real-time backend, Vitest with convex-test for unit testing Convex functions, and Playwright for E2E testing.

Key findings:
- **Next.js 15 is fully compatible with Convex** - no known issues, use App Router pattern
- **convex-test library** provides mock Convex backend for Vitest unit tests
- **Playwright** integrates seamlessly with Next.js via webServer config
- **pnpm** is the recommended package manager for 2025 (2-3x faster than npm, 70% less disk usage)
- **TypeScript strict mode** is fully supported and recommended

**Primary recommendation:** Use `npm create convex@latest` for quickest setup, then add Vitest + Playwright. Structure as `v2/` folder with `convex/` for backend functions, `app/` for Next.js pages, `tests/` for E2E tests.

</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x | React framework with App Router | Industry standard, Vercel integration, SSR/SSG |
| convex | 1.17.x+ | Real-time backend + database | TypeScript-first, subscriptions, serverless functions |
| react | 19.x | UI library | Next.js 15 default, latest features |
| typescript | 5.0.3+ | Type safety | Required by Convex, strict mode recommended |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.x | Unit/integration testing | Testing Convex functions, React components |
| convex-test | 0.0.21+ | Mock Convex backend | Unit testing queries/mutations/actions |
| @edge-runtime/vm | latest | Edge runtime environment | Required by convex-test |
| @playwright/test | 1.51+ | E2E browser testing | Full user flow testing |
| @testing-library/react | 16.x | React component testing | Component unit tests |

### Development
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | 4.x | Utility-first CSS | Styling (matches v1 design approach) |
| eslint | 9.x | Code linting | Code quality |
| prettier | 3.x | Code formatting | Consistent formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm | npm | npm is simpler but slower and uses more disk |
| pnpm | bun | bun is faster but less mature ecosystem |
| Vitest | Jest | Jest works but Vitest has better Vite/ESM support |
| convex-test | Real Convex | Real backend is slower, requires deployment |

**Installation:**
```bash
# Create project with pnpm
pnpm create next-app@latest v2 --typescript --tailwind --app --src-dir
cd v2

# Add Convex
pnpm add convex
pnpm add -D convex-test @edge-runtime/vm

# Add testing
pnpm add -D vitest @vitejs/plugin-react @testing-library/react
pnpm add -D @playwright/test

# Initialize
npx convex dev  # Sets up Convex project
npx playwright install  # Installs browsers
```

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
perm-tracker-test/
├── backend/              # v1 FastAPI (UNTOUCHED)
├── frontend/             # v1 Alpine.js (UNTOUCHED)
├── v2/                   # NEW: Next.js + Convex
│   ├── convex/           # Convex backend functions
│   │   ├── _generated/   # Auto-generated (git-ignored)
│   │   ├── schema.ts     # Database schema definition
│   │   ├── cases.ts      # Case-related functions
│   │   ├── deadlines.ts  # Deadline functions
│   │   └── *.test.ts     # Co-located unit tests
│   ├── src/
│   │   ├── app/          # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── providers.tsx  # ConvexClientProvider
│   │   │   └── (routes)/      # Route groups
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # Utilities, validators
│   │   └── types/        # TypeScript types
│   ├── tests/            # Playwright E2E tests
│   │   ├── e2e/
│   │   └── fixtures/
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── package.json
│   └── tsconfig.json
└── .planning/            # Shared planning docs
```

### Pattern 1: Convex Client Provider (App Router)
**What:** Wrap app with ConvexProvider for real-time subscriptions
**When to use:** Always - required for Convex React hooks
**Example:**
```typescript
// src/app/providers.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

```typescript
// src/app/layout.tsx
import { ConvexClientProvider } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

### Pattern 2: Convex Schema Definition
**What:** Define typed database schema with indexes
**When to use:** Always - provides type safety for all database operations
**Example:**
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cases: defineTable({
    beneficiaryName: v.string(),
    companyName: v.string(),
    stage: v.string(),
    priority: v.number(),
    userId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_stage", ["stage"]),

  deadlines: defineTable({
    caseId: v.id("cases"),
    deadlineType: v.string(),
    deadlineDate: v.string(),
    isCompleted: v.boolean(),
  })
    .index("by_case", ["caseId"])
    .index("by_date", ["deadlineDate"]),
});
```

### Pattern 3: Vitest Config for Convex
**What:** Configure Vitest with edge-runtime for convex-test
**When to use:** Always - required for convex-test to work
**Example:**
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Edge runtime for Convex function tests
    environmentMatchGlobs: [
      ["convex/**/*.test.ts", "edge-runtime"],
      ["src/**/*.test.{ts,tsx}", "jsdom"],
    ],
    server: { deps: { inline: ["convex-test"] } },
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
  },
});
```

### Pattern 4: Playwright Config for Next.js
**What:** Configure Playwright with webServer for dev server
**When to use:** E2E testing setup
**Example:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Anti-Patterns to Avoid
- **Creating ConvexReactClient per component:** Share single instance via provider
- **Testing against production Convex:** Use convex-test mock for unit tests
- **Skipping schema definition:** Lose type safety, methods return `Promise<any>`
- **Mixing Pages Router with App Router:** Stick to App Router for new projects
- **Not using edge-runtime for convex-test:** Tests will fail or behave incorrectly

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Convex mock for tests | Custom mock of Convex client | convex-test library | Handles edge runtime, schema types, scheduled functions |
| Real-time subscriptions | WebSocket + polling logic | Convex useQuery hook | Auto-reconnects, optimistic updates, type-safe |
| Database schema types | Manual TypeScript interfaces | defineSchema + v validators | Auto-generates types, runtime validation |
| E2E test server management | Manual process spawning | Playwright webServer config | Handles startup, shutdown, CI detection |
| Edge runtime environment | Custom test environment | @edge-runtime/vm | Required by convex-test, matches Convex runtime |
| React testing utilities | Manual DOM manipulation | @testing-library/react | Best practices, accessibility-focused |

**Key insight:** The Convex ecosystem has solved most testing and infrastructure problems. convex-test specifically replicates the Convex runtime behavior including scheduled functions, auth identity, and database transactions. Fighting these leads to flaky tests and runtime differences.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Wrong Vitest Environment for Convex Tests
**What goes wrong:** Tests fail with cryptic errors or behave differently than production
**Why it happens:** convex-test requires edge-runtime, not node or jsdom
**How to avoid:** Use `environmentMatchGlobs` to set edge-runtime for `convex/**` tests
**Warning signs:** `ReferenceError: Request is not defined`, `TextEncoder is not defined`

### Pitfall 2: Not Awaiting Async Request APIs in Next.js 15
**What goes wrong:** `cookies()`, `headers()`, `params` return Promises, not values
**Why it happens:** Breaking change in Next.js 15 for better performance
**How to avoid:** Always `await` these APIs: `const cookieStore = await cookies()`
**Warning signs:** Getting `[object Promise]` instead of actual values

### Pitfall 3: Expecting Caching by Default in Next.js 15
**What goes wrong:** Data fetches every request, unexpected behavior
**Why it happens:** Next.js 15 disabled default caching for fetch, Route Handlers
**How to avoid:** Explicitly opt-in to caching with `cache: 'force-cache'` or `revalidate`
**Warning signs:** Higher than expected API calls, slow page loads

### Pitfall 4: convex-test Limitations Not Understood
**What goes wrong:** Tests pass but production fails
**Why it happens:** convex-test is a mock, not the real Convex backend
**How to avoid:** Always manually verify critical paths; know the limitations:
  - Text search doesn't sort by relevance
  - Vector search uses naive similarity (no efficient index)
  - No cron job support (trigger manually)
  - No size/time limits enforced
  - Error messages differ from production
**Warning signs:** Tests pass but production has different behavior

### Pitfall 5: Missing Schema Definition
**What goes wrong:** All Convex methods return `Promise<any>`, no type safety
**Why it happens:** Schema is optional in Convex, but required for types
**How to avoid:** Always define `convex/schema.ts` first, before writing functions
**Warning signs:** No autocomplete on query/mutation results, TypeScript not catching bugs

### Pitfall 6: Provider Not Marked as Client Component
**What goes wrong:** `Error: Cannot read properties of null (reading 'useContext')`
**Why it happens:** ConvexProvider uses hooks, must be in Client Component
**How to avoid:** Add `"use client"` directive to provider file
**Warning signs:** Hydration errors, context-related errors

</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Convex Function Test with convex-test
```typescript
// convex/cases.test.ts
// Source: docs.convex.dev/testing/convex-test
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("cases", () => {
  it("creates and lists cases", async () => {
    const t = convexTest(schema, modules);

    // Test as authenticated user
    const asUser = t.withIdentity({ subject: "user123", name: "Test User" });

    await asUser.mutation(api.cases.create, {
      beneficiaryName: "John Doe",
      companyName: "Acme Corp",
      stage: "PWD",
    });

    const cases = await asUser.query(api.cases.list);
    expect(cases).toHaveLength(1);
    expect(cases[0].beneficiaryName).toBe("John Doe");
  });

  it("isolates data between users", async () => {
    const t = convexTest(schema, modules);

    const user1 = t.withIdentity({ subject: "user1" });
    const user2 = t.withIdentity({ subject: "user2" });

    await user1.mutation(api.cases.create, { beneficiaryName: "User1 Case" });

    const user2Cases = await user2.query(api.cases.list);
    expect(user2Cases).toHaveLength(0);
  });
});
```

### Testing Scheduled Functions
```typescript
// convex/notifications.test.ts
// Source: docs.convex.dev/testing/convex-test
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("scheduled notification fires", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema);

  await t.mutation(api.notifications.scheduleReminder, {
    caseId: "case123",
    delayMs: 60000,
  });

  // Advance time past scheduled execution
  vi.advanceTimersByTime(61000);
  vi.runAllTimers();

  // Wait for scheduled function to complete
  await t.finishInProgressScheduledFunctions();

  // Verify the notification was created
  const notifications = await t.run(async (ctx) => {
    return await ctx.db.query("notifications").collect();
  });
  expect(notifications).toHaveLength(1);

  vi.useRealTimers();
});
```

### Playwright E2E Test
```typescript
// tests/e2e/dashboard.spec.ts
// Source: playwright.dev/docs/best-practices
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("displays cases after login", async ({ page }) => {
    await page.goto("/");

    // Wait for Convex data to load
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Check case list renders
    await expect(page.getByTestId("case-list")).toBeVisible();
  });

  test("creates new case", async ({ page }) => {
    await page.goto("/cases/new");

    await page.getByLabel("Beneficiary Name").fill("Jane Doe");
    await page.getByLabel("Company Name").fill("Tech Corp");
    await page.getByRole("button", { name: "Create Case" }).click();

    // Verify redirect to case detail
    await expect(page).toHaveURL(/\/cases\/[a-z0-9]+/);
    await expect(page.getByText("Jane Doe")).toBeVisible();
  });
});
```

### TypeScript Strict Mode tsconfig.json
```json
// tsconfig.json
// Source: totaltypescript.com/tsconfig-cheat-sheet
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",

    // Strict mode (REQUIRED)
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Module handling
    "allowJs": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,

    // Build
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,

    // Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

</code_examples>

<sota_updates>
## State of the Art (2024-2025)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 sync APIs | Next.js 15 async APIs | Oct 2024 | `await cookies()`, `await headers()` required |
| Default caching ON | Default caching OFF | Next.js 15 | Explicit opt-in for caching needed |
| Jest for testing | Vitest preferred | 2023-2024 | Faster, better ESM support, native TypeScript |
| npm as default | pnpm recommended | 2024-2025 | 2-3x faster, 70% less disk space |
| Pages Router | App Router | 2023+ | Server Components, layouts, streaming |
| Manual Convex mocking | convex-test library | 2024 | Official mock with edge runtime support |

**New tools/patterns to consider:**
- **Next.js 15 turbopack:** Faster dev server, use `next dev --turbopack`
- **React 19 features:** Server Actions, use client/server directives
- **Convex Auth:** Built-in auth solution, Clerk-compatible architecture
- **Bun runtime:** Alternative to Node.js, faster but less mature

**Deprecated/outdated:**
- **Pages Router for new projects:** Use App Router exclusively
- **getServerSideProps/getStaticProps:** Use Server Components instead
- **create-react-app:** Use Next.js or Vite instead
- **npm ci in CI/CD:** Consider pnpm for faster builds

</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Convex Auth vs Clerk for Phase 18**
   - What we know: Both work with Convex, Clerk has more features
   - What's unclear: Which provides better DX for this project's needs
   - Recommendation: Research during Phase 18 planning, defer decision

2. **Bun vs pnpm for package manager**
   - What we know: Bun is 7x faster, pnpm is proven stable
   - What's unclear: Bun compatibility with all Convex/Playwright deps
   - Recommendation: Start with pnpm, evaluate Bun for v2.1

3. **Monorepo structure for v1/v2 coexistence**
   - What we know: v2/ folder works as sibling to v1 folders
   - What's unclear: Whether pnpm workspaces would help or add complexity
   - Recommendation: Keep simple flat structure, no workspaces needed

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Context7 /llmstxt/convex_dev_llms-full_txt - Next.js setup, testing, schema
- Context7 /websites/nextjs_app - App Router patterns, project structure
- Context7 /vitest-dev/vitest - Vitest configuration, environments
- Context7 /microsoft/playwright - Playwright configuration, webServer
- docs.convex.dev/quickstart/nextjs - Official Convex + Next.js guide
- docs.convex.dev/testing/convex-test - Official convex-test documentation

### Secondary (MEDIUM confidence)
- nextjs.org/blog/next-15 - Next.js 15 release notes, breaking changes
- totaltypescript.com/tsconfig-cheat-sheet - TypeScript strict mode recommendations
- playwright.dev/docs/best-practices - Playwright testing patterns

### Tertiary (LOW confidence - needs validation)
- Package manager comparisons from dev.to - pnpm recommendation (validated against npm docs)

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Next.js 15 + Convex
- Ecosystem: Vitest, Playwright, pnpm, TypeScript
- Patterns: App Router, convex-test, E2E testing
- Pitfalls: Next.js 15 breaking changes, convex-test limitations

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7, official docs
- Architecture: HIGH - from official examples and quickstarts
- Pitfalls: HIGH - documented in release notes and official docs
- Code examples: HIGH - from Context7/official sources

**Research date:** 2025-12-20
**Valid until:** 2026-01-20 (30 days - ecosystem relatively stable)

</metadata>

---

*Phase: 15-scaffold-testing-infrastructure*
*Research completed: 2025-12-20*
*Ready for planning: yes*
