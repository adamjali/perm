/**
 * Test utilities for Convex function testing.
 * These patterns will be used throughout v2 development.
 *
 * NOTE: This file is intentionally OUTSIDE the convex/ directory
 * because import.meta.glob is a Vite-specific feature that Convex
 * runtime doesn't support. Keeping test utils here prevents deployment errors.
 */

import { convexTest } from "convex-test";
import { vi, beforeEach, afterEach } from "vitest";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

// Load all Convex modules for testing (Vite-specific)
// This pattern is required by convex-test to discover and load modules
// @ts-expect-error - import.meta.glob is a Vite feature not in standard TypeScript
const modules = import.meta.glob("../convex/**/*.ts");

/**
 * Create a new test context with clean database state.
 * Each test should call this to get isolated test data.
 */
export function createTestContext() {
  return convexTest(schema, modules);
}

/**
 * Authenticated context with the user ID for direct database operations.
 */
export interface AuthenticatedContext {
  /** The test context with identity applied - use for queries/mutations */
  ctx: ReturnType<ReturnType<typeof createTestContext>["withIdentity"]>;
  /** The user's ID - use for direct database inserts in tests */
  userId: Id<"users">;
}

/**
 * Create a test context with a mock authenticated user.
 * Use for testing user-specific queries/mutations.
 *
 * Creates a real user in the database and authenticates with that user's ID.
 * This ensures userId values are valid Convex IDs.
 *
 * Usage:
 *   const t = createTestContext();
 *   const { ctx: user, userId } = await createAuthenticatedContext(t);
 *   // Use `user` for queries/mutations
 *   // Use `userId` for direct db.insert operations
 *
 * Legacy usage (still supported via proxy):
 *   const t = createTestContext();
 *   const user = await createAuthenticatedContext(t);
 *   // All context methods work directly on the returned value
 */
export async function createAuthenticatedContext(
  t: ReturnType<typeof createTestContext>,
  name?: string
): Promise<AuthenticatedContext & ReturnType<ReturnType<typeof createTestContext>["withIdentity"]>> {
  // First, create a basic authenticated context with a temporary ID
  // This allows us to call mutations
  const tempAuthContext = t.withIdentity({
    subject: "temp-user-" + Math.random().toString(36).substring(7),
    name: name ?? "Test User",
  });

  // Create a real user in the database using an internal mutation
  const userId = await tempAuthContext.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: name ?? "Test User",
      email: `test-${Math.random().toString(36).substring(7)}@example.com`,
    });
  });

  // Create the authenticated context
  const ctx = t.withIdentity({
    subject: userId,
    name: name ?? "Test User",
  });

  // Return a proxy that:
  // 1. Has ctx and userId properties for new code
  // 2. Forwards all other property accesses to ctx for backward compatibility
  return new Proxy({ ctx, userId } as AuthenticatedContext & typeof ctx, {
    get(target, prop) {
      // First check for our explicit properties
      if (prop === "ctx") return target.ctx;
      if (prop === "userId") return target.userId;
      // Forward everything else to the context (backward compatibility)
      const ctxValue = (target.ctx as Record<string | symbol, unknown>)[prop];
      if (typeof ctxValue === "function") {
        return ctxValue.bind(target.ctx);
      }
      return ctxValue;
    },
  });
}

/**
 * Example of test data factory (will expand in Phase 16+).
 * Creates consistent test fixtures.
 */
export const fixtures = {
  testItem: (overrides?: Partial<{ text: string }>) => ({
    text: overrides?.text ?? "Test Item",
  }),
};

// ============================================================================
// Scheduled Functions Support
// ============================================================================

/**
 * Setup and teardown hooks for tests that use scheduled functions.
 * Call this at the top level of your describe block.
 *
 * This enables Vitest fake timers which are required for convex-test
 * to properly handle ctx.scheduler.runAfter() calls.
 *
 * Usage:
 *   describe("My Tests", () => {
 *     setupSchedulerTests();
 *     // ... your tests
 *   });
 */
export function setupSchedulerTests() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

/**
 * Wait for all scheduled functions to complete.
 * Call this after mutations that schedule work via ctx.scheduler.runAfter().
 *
 * This advances the fake timers and waits for scheduled functions to finish.
 * Per convex-test documentation, this is the standard pattern for testing
 * mutations that schedule other functions.
 *
 * Usage:
 *   await user.mutation(api.cases.create, { ... });
 *   await finishScheduledFunctions(t);
 *
 * @param t - The convex test context
 */
export async function finishScheduledFunctions(
  t: ReturnType<typeof createTestContext>
) {
  // Advance timers and wait for scheduled functions to complete
  // This handles chains of scheduled functions (mutation -> action -> action)
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/**
 * Higher-order function that wraps a mutation call and handles scheduled functions.
 * Use this for mutations that trigger ctx.scheduler.runAfter().
 *
 * Usage:
 *   const caseId = await withScheduler(t, () =>
 *     user.mutation(api.cases.create, { ... })
 *   );
 *
 * @param t - The convex test context (must have fake timers enabled)
 * @param mutationFn - Async function that performs the mutation
 * @returns The result of the mutation
 */
export async function withScheduler<T>(
  t: ReturnType<typeof createTestContext>,
  mutationFn: () => Promise<T>
): Promise<T> {
  const result = await mutationFn();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return result;
}

/**
 * Advance the fake timer by the specified milliseconds.
 * Use this when tests need distinct timestamps (e.g., ordering by createdAt/updatedAt).
 *
 * Usage:
 *   await auth.mutation(api.cases.create, { ... });
 *   await finishScheduledFunctions(t);
 *   advanceTime(1000); // Advance 1 second
 *   await auth.mutation(api.cases.create, { ... });
 *
 * @param ms - Milliseconds to advance (default: 1000)
 */
export function advanceTime(ms: number = 1000) {
  vi.advanceTimersByTime(ms);
}
