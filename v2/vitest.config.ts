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
          exclude: ISOLATED_UNIT_FILES,
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
          globals: true,
          setupFiles: "./vitest.setup.ts",
          testTimeout: 5000,
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
