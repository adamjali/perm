import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const sharedConfig = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/test-utils": path.resolve(__dirname, "./test-utils"),
      "@/convex": path.resolve(__dirname, "./convex"),
    },
  },
};

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
          globals: true,
          setupFiles: "./vitest.setup.ts",
          testTimeout: 5000,
          isolate: false, // Share environment for speed
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
          server: {
            deps: {
              inline: ["convex-test"],
            },
          },
        },
      },
    ],

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
