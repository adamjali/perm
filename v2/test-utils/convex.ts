/**
 * Convex function testing utilities.
 * Outside convex/ because import.meta.glob is Vite-only.
 */

import { convexTest } from "convex-test";
import { vi, beforeEach, afterEach } from "vitest";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

// @ts-expect-error - import.meta.glob is a Vite feature
const modules = import.meta.glob("../convex/**/*.ts");

/** Create a new test context with clean database state */
export function createTestContext() {
  return convexTest(schema, modules);
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
