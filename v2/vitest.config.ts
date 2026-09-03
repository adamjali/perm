import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Pin the test timezone BEFORE vitest spawns its worker threads — they snapshot
// process.env at creation, so this must run at config module scope (the main
// process) to take effect. `test.env.TZ` does NOT work here: the threads-pool
// workers cache the zone before that per-test injection runs. Date-sensitive
// PERM tests are calibrated to the dev TZ (America/New_York); a UTC CI runner
// would otherwise read `new Date("YYYY-MM-DD")` (UTC midnight) as the previous
// local day and shift day-deltas by one (e.g. filingWindow 20 vs 21). Forcing
// it here makes the whole suite TZ-stable on every machine without touching any
// business logic or assertions.
process.env.TZ = "America/New_York";

const sharedConfig = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/test-utils": path.resolve(__dirname, "./test-utils"),
      "@/convex": path.resolve(__dirname, "./convex"),
      // `server-only` throws on import from anything with a DOM. Every vitest
      // project here runs happy-dom or edge-runtime, so a test of a SERVER
      // module - sitemap.ts, which reaches src/lib/turso/client.ts - fails to
      // load at all, with an error that reads like a client/server mistake and
      // is not one.
      //
      // This is not a stub. The package itself ships `empty.js` for the
      // `react-server` condition, and that is exactly what Next resolves when
      // it builds a Server Component. Pointing at the package's own empty
      // build reproduces the real server resolution rather than papering over
      // the guard.
      //
      // The guard still does its job where it matters: importing a server-only
      // module from a client component is a BUILD error, and `next build`
      // still catches it. There is a dedicated test asserting no "use client"
      // file imports lib/turso.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
};

// Unit-project test files that install per-file vi.mock factories for SHARED
// modules (next/navigation, convex/react, sonner, @ai-sdk/react). These must run
// with isolate:true so their mock state doesn't leak across files via the shared
// module registry (the cause of historical CI-only flakiness under shuffle).
// They run in the "unit-isolated" project; the "unit" project excludes them.
const ISOLATED_UNIT_FILES = [
  "src/lib/ai/__tests__/page-context.test.tsx",
  "src/lib/__tests__/toast.test.ts",
  "src/hooks/__tests__/useJobDescriptionTemplates.test.ts",
  "src/hooks/__tests__/useChatWithPersistence.test.ts",
  "src/hooks/__tests__/useToolOrchestrator.test.ts",
  // Turso read-layer tests that mock ../client and import modules which
  // share `../cases` underneath. In the shared pool the first file to load
  // `cases.ts` binds it to ITS mock; every later file's mock then sees no
  // calls (6 failures on 2026-09-02 that each passed alone).
  "src/lib/turso/__tests__/liveCases.test.ts",
  "src/lib/turso/__tests__/unifiedSearch.test.ts",
  "src/lib/turso/__tests__/caseSearchReads.test.ts",
  "src/lib/turso/__tests__/stageCohorts.test.ts",
  "src/lib/turso/__tests__/searchFilters.test.ts",
  "src/lib/turso/__tests__/pwdCases.test.ts",
  "src/lib/turso/__tests__/lcaCases.test.ts",
  "src/lib/turso/__tests__/entityReads.test.ts",
  // Added 2026-08-30. This file mocks `@/lib/turso/client`, and so do four
  // other files in the same project. With `isolate: false` they share one
  // module registry per worker, so whichever registers its factory first
  // wins and the others' `rows` resolves to a function that was never given
  // an implementation - `r` comes back undefined and the failure reads as a
  // bug in the code under test. It passed alone and failed in the full run,
  // which is the signature. The other turso mockers were already here or
  // are ordered such that they have not collided yet; this one collides.
  "src/lib/turso/__tests__/stageCases.test.ts",
  // Mocks `@libsql/client` and calls vi.resetModules() per case, so it needs
  // its own registry - under isolate:false it poisons whatever runs next.
  "src/lib/turso/__tests__/clientRetry.test.ts",
];

export default defineConfig({
  plugins: [react()],
  ...sharedConfig,
  // Cache directory for Vite (vitest uses cacheDir/vitest internally)
  cacheDir: "./node_modules/.vite",
  test: {
    // Reporter configuration
    reporters: process.env.CI ? ["json", "github-actions"] : ["default"],
    outputFile: {
      json: "./coverage/test-results.json",
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "convex/**/*.ts",
        "!**/__tests__/**",
        "!**/test-utils/**",
      ],
      exclude: [
        "src/**/*.d.ts",
        "convex/_generated/**",
        "**/*.stories.{ts,tsx}",
      ],
      thresholds: process.env.CI
        ? {
            global: {
              branches: 70,
              functions: 75,
              lines: 75,
              statements: 75,
            },
          }
        : undefined,
    },

    // Three-tier project structure optimized for SPEED
    projects: [
      {
        // Unit + PERM tests combined - fast, pure functions
        // Using happy-dom (faster than jsdom) with shared environment
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: [
            "src/lib/**/*.test.{ts,tsx}",
            "src/hooks/**/*.test.{ts,tsx}",
            "convex/lib/perm/**/*.test.ts",
            "convex/lib/*.test.ts",
          ],
          // These files install per-file vi.mock factories for SHARED modules
          // (next/navigation, convex/react, sonner, @ai-sdk/react) with mutable
          // state. Under isolate:false the module registry is shared across files
          // in the same worker, so their mocks leak into each other and flake
          // (only under sequence.shuffle / CI). Vitest's own guidance: keep files
          // that "depend on a fresh module instance for vi.mock factories"
          // isolated. They run in the "unit-isolated" project below instead.
          // `*.ssr.test.*` runs in the `ssr` project: real node, real
          // motion. See that project for why it cannot live here.
          exclude: [...ISOLATED_UNIT_FILES, "**/*.ssr.test.*"],
          globals: true,
          setupFiles: "./vitest.setup.ts",
          testTimeout: 5000,
          isolate: false, // Share environment for speed
        },
      },
      {
        // Mock-stateful unit files that need a fresh module graph per file.
        // Same happy-dom environment and setup as `unit`, but isolate:true so
        // their per-file vi.mock factories don't leak across files. Small set,
        // so the speed cost is negligible.
        extends: true,
        test: {
          name: "unit-isolated",
          environment: "happy-dom",
          include: ISOLATED_UNIT_FILES,
          exclude: ["**/*.ssr.test.*"],
          globals: true,
          setupFiles: "./vitest.setup.ts",
          testTimeout: 5000,
          isolate: true,
        },
      },
      {
        // SERVER-RENDER SHAPE TESTS. `*.ssr.test.{ts,tsx}`, anywhere.
        //
        // This project exists because the other three CANNOT see the class of
        // defect it covers, and reported a clean pass against a deliberately
        // broken component when probed on 2026-08-31. Two independent reasons,
        // either one sufficient:
        //
        //   1. They all run happy-dom, so `window` is defined. Motion branches
        //      on that and takes its CLIENT path, applying `initial` through
        //      the DOM after mount instead of serializing it into the markup.
        //   2. `vitest.setup.ts` mocks `motion/react` wholesale, replacing
        //      every motion component with a plain element.
        //
        // So: environment "node", and NO setupFiles. Both are load-bearing.
        // The defect that prompted this shipped `<div style="opacity:0">`
        // around 90% of every public page's HTML, invisible until hydration.
        extends: true,
        test: {
          name: "ssr",
          environment: "node",
          include: ["src/**/*.ssr.test.{ts,tsx}"],
          globals: true,
          testTimeout: 10000,
          isolate: true,
        },
      },
      {
        // Component tests - React components, app, emails
        // Using happy-dom (faster than jsdom), isolated for DOM state cleanliness
        extends: true,
        test: {
          name: "components",
          environment: "happy-dom",
          include: [
            "src/components/**/*.test.{ts,tsx}",
            "src/app/**/*.test.{ts,tsx}",
            "src/emails/**/*.test.{ts,tsx}",
            "test-utils/**/*.test.{ts,tsx}",
          ],
          // See the `ssr` project below. This one mocks motion and runs a DOM,
          // so a server-render assertion here is blind by construction.
          exclude: ["**/*.ssr.test.*"],
          globals: true,
          setupFiles: "./vitest.setup.ts",
          testTimeout: 10000,
          isolate: true, // Component tests need isolation for clean DOM state
        },
      },
      {
        // Convex integration tests - ONLY tests using convex-test
        // These require edge-runtime for database operations
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: [
            "convex/*.test.ts",
            "convex/__tests__/*.test.ts",
            "convex/lib/__tests__/*.test.ts",
          ],
          // Exclude pure function tests that run in unit
          exclude: [
            "convex/lib/perm/**/*.test.ts",
            "convex/lib/*.test.ts",
          ],
          globals: true,
          setupFiles: "./vitest.setup.convex.ts",
          testTimeout: 15000,
          // Isolate per file: these tests stub globals (e.g. global.fetch) and
          // run real convex-test DB contexts. Without isolation they inherit the
          // root isolate:false and share the module/global registry across files
          // in a worker, so one file's fetch stub captures another file's calls
          // (flaky call-count assertions) and pending console logs from late
          // scheduled functions race teardown (EnvironmentTeardownError).
          isolate: true,
          // convex-test runs scheduled functions AFTER the test transaction
          // closes; those fire-and-forget jobs emit console logs asynchronously.
          // Vitest's default console interception forwards logs to the main
          // thread over RPC, and a log still in flight when the worker tears down
          // throws "Closing rpc while onUserConsoleLog was pending"
          // (EnvironmentTeardownError) which flips the exit code despite all
          // tests passing. Routing console straight to the terminal (no RPC)
          // removes that race without changing any test behavior.
          disableConsoleIntercept: true,
          server: {
            deps: {
              inline: ["convex-test"],
            },
          },
        },
      },
    ],

    // Use threads pool for shared memory (faster than default forks)
    pool: "threads",

    // Disable isolation by default for speed (projects override as needed)
    isolate: false,

    // Only shuffle in CI to detect order dependencies
    sequence: {
      shuffle: !!process.env.CI,
    },

    // Fail fast
    bail: process.env.CI ? 5 : 1,

    // Global settings
    passWithNoTests: true,
    testTimeout: 10000,
  },
});
