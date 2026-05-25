/**
 * Convex function testing utilities.
 * Outside convex/ because import.meta.glob is Vite-only.
 */

import { convexTest } from "convex-test";
import { vi, beforeEach, afterEach } from "vitest";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
// Each component ships an official `register(t, name)` test helper that calls
// t.registerComponent(name, componentSchema, componentModules). Without this the
// harness throws `Component "rateLimiter" is not registered` for any mutation
// that calls rateLimiter.limit() (conversations.create, cases.create, etc.).
// `rag/test` also registers its nested workpool component internally.
import rateLimiter from "@convex-dev/rate-limiter/test";
import rag from "@convex-dev/rag/test";

// import.meta.glob is a Vite feature (typed via vite/client in the test env)
const modules = import.meta.glob("../convex/**/*.ts");

/** Create a new test context with clean database state and registered components */
export function createTestContext() {
  const t = convexTest(schema, modules);
  // Register the same components the running app uses (convex/convex.config.ts).
  rateLimiter.register(t);
  rag.register(t);
  return t;
}

export interface AuthenticatedContext {
  ctx: ReturnType<ReturnType<typeof createTestContext>["withIdentity"]>;
  userId: Id<"users">;
}

/** Create a test context with a mock authenticated user */
export async function createAuthenticatedContext(
  t: ReturnType<typeof createTestContext>,
  name?: string
): Promise<AuthenticatedContext & ReturnType<ReturnType<typeof createTestContext>["withIdentity"]>> {
  const tempAuthContext = t.withIdentity({
    subject: "temp-user-" + Math.random().toString(36).substring(7),
    name: name ?? "Test User",
  });

  const userId = await tempAuthContext.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: name ?? "Test User",
      email: `test-${Math.random().toString(36).substring(7)}@example.com`,
    });
  });

  const ctx = t.withIdentity({ subject: userId, name: name ?? "Test User" });

  return new Proxy({ ctx, userId } as AuthenticatedContext & typeof ctx, {
    get(target, prop) {
      if (prop === "ctx") return target.ctx;
      if (prop === "userId") return target.userId;
      const ctxValue = (target.ctx as Record<string | symbol, unknown>)[prop];
      if (typeof ctxValue === "function") return ctxValue.bind(target.ctx);
      return ctxValue;
    },
  });
}

/** Setup fake timers for scheduled function tests */
export function setupSchedulerTests() {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
}

/** Wait for all scheduled functions to complete */
export async function finishScheduledFunctions(
  t: ReturnType<typeof createTestContext>
) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Run a mutation then finish all scheduled functions */
export async function withScheduler<T>(
  t: ReturnType<typeof createTestContext>,
  mutationFn: () => Promise<T>
): Promise<T> {
  const result = await mutationFn();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return result;
}

/** Advance fake timer for distinct timestamps in tests */
export function advanceTime(ms: number = 1000) {
  vi.advanceTimersByTime(ms);
}

/**
 * Reset a per-user rate-limit bucket (from convex/rateLimitConfig.ts) so a test
 * can bulk-create past the production capacity without tripping the limiter.
 *
 * The production caps (e.g. caseCreate capacity 10) are correct for real users
 * but legitimate tests that seed >capacity rows in one shot would otherwise hit
 * `RateLimited`. Call this between operations in such loops. The limiter's
 * enforcement behavior itself is covered directly in
 * convex/lib/__tests__/rateLimit.test.ts + convex/__tests__/authRateLimit.test.ts.
 */
export async function resetRateLimit(
  t: ReturnType<typeof createTestContext>,
  name: string,
  key: string,
) {
  const { rateLimiter } = await import("../convex/rateLimitConfig");
  await t.run(async (ctx) => {
    // rateLimiter.reset needs a ctx with runMutation; t.run's ctx provides it.
    await rateLimiter.reset(ctx as never, name as never, { key });
  });
}
