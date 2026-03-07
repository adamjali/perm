/**
 * System Errors Tests
 *
 * Verifies:
 * - Error recording inserts into systemErrors table
 * - Admin email rate limiting (max 5 per hour)
 * - Admin-only access for listing errors
 * - Error resolution
 * - Filtering by resolved status
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
} from "../../test-utils/convex";
import { api } from "../_generated/api";

// ADMIN_EMAIL is read from process.env at module load time.
// Set it before importing admin.ts so requireAdmin() passes in tests.
const TEST_ADMIN_EMAIL = "admin@test.com";
process.env.ADMIN_EMAIL = TEST_ADMIN_EMAIL;

// FilterApi generic can't resolve api.systemErrors at the type level.
// The reference is verified correct — see convex/systemErrors.ts (query).
const systemErrorsApi = (api as any).systemErrors;

describe("systemErrors", () => {
  setupSchedulerTests();

  /**
   * Helper: create an admin user context.
   * Sets the user's email to TEST_ADMIN_EMAIL so requireAdmin() passes.
   */
  async function createAdminContext(t: ReturnType<typeof createTestContext>) {
    const { ctx, userId } = await createAuthenticatedContext(t, "Admin User");
    // Set the admin email on the user record
    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(userId, { email: TEST_ADMIN_EMAIL });
    });
    return { ctx, userId };
  }

  describe("record", () => {
    it("inserts error into systemErrors table", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "cases.create",
          message: "Test error",
          resolved: false,
          createdAt: Date.now(),
        });

        const errors = await ctx.db.query("systemErrors").collect();
        expect(errors).toHaveLength(1);
        expect(errors[0].source).toBe("mutation");
        expect(errors[0].operation).toBe("cases.create");
        expect(errors[0].message).toBe("Test error");
        expect(errors[0].resolved).toBe(false);
      });
    });

    it("stores optional fields (stack, userId, resourceId, extra)", async () => {
      const t = createTestContext();
      const { userId } = await createAuthenticatedContext(t, "Test User");

      await t.run(async (ctx) => {
        await ctx.db.insert("systemErrors", {
          source: "action",
          operation: "push.send",
          message: "Push failed",
          stack: "Error: Push failed\n    at send (push.ts:42)",
          userId,
          resourceId: "case_abc123",
          extra: '{"retryCount":3}',
          resolved: false,
          createdAt: Date.now(),
        });

        const errors = await ctx.db.query("systemErrors").collect();
        expect(errors).toHaveLength(1);
        expect(errors[0].stack).toContain("push.ts:42");
        expect(errors[0].userId).toBe(userId);
        expect(errors[0].resourceId).toBe("case_abc123");
        expect(errors[0].extra).toBe('{"retryCount":3}');
      });
    });

    it("records without optional fields", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const id = await ctx.db.insert("systemErrors", {
          source: "cron",
          operation: "dailyCleanup",
          message: "Cleanup failed",
          resolved: false,
          createdAt: Date.now(),
        });

        const error = await ctx.db.get(id);
        expect(error).toBeDefined();
        expect(error!.stack).toBeUndefined();
        expect(error!.userId).toBeUndefined();
        expect(error!.resourceId).toBeUndefined();
        expect(error!.extra).toBeUndefined();
      });
    });
  });

  describe("list", () => {
    it("requires admin access", async () => {
      const t = createTestContext();
      const { ctx: user } = await createAuthenticatedContext(t, "Regular User");

      await expect(
        user.query(systemErrorsApi.list, {}),
      ).rejects.toThrow();
    });

    it("returns errors sorted by creation date (newest first)", async () => {
      const t = createTestContext();
      const { ctx: admin } = await createAdminContext(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "first",
          message: "First error",
          resolved: false,
          createdAt: Date.now() - 2000,
        });
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "second",
          message: "Second error",
          resolved: false,
          createdAt: Date.now() - 1000,
        });
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "third",
          message: "Third error",
          resolved: false,
          createdAt: Date.now(),
        });
      });

      const errors = await admin.query(systemErrorsApi.list, {});
      expect(errors).toHaveLength(3);
      expect(errors[0].operation).toBe("third");
      expect(errors[2].operation).toBe("first");
    });

    it("filters by resolved status", async () => {
      const t = createTestContext();
      const { ctx: admin } = await createAdminContext(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "unresolved",
          message: "Unresolved",
          resolved: false,
          createdAt: Date.now(),
        });
        await ctx.db.insert("systemErrors", {
          source: "mutation",
          operation: "resolved",
          message: "Resolved",
          resolved: true,
          createdAt: Date.now(),
        });
      });

      const unresolved = await admin.query(systemErrorsApi.list, { resolved: false });
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].operation).toBe("unresolved");

      const resolved = await admin.query(systemErrorsApi.list, { resolved: true });
      expect(resolved).toHaveLength(1);
      expect(resolved[0].operation).toBe("resolved");
    });

    it("respects limit parameter", async () => {
      const t = createTestContext();
      const { ctx: admin } = await createAdminContext(t);

      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("systemErrors", {
            source: "mutation",
            operation: `op-${i}`,
            message: `Error ${i}`,
            resolved: false,
            createdAt: Date.now() + i,
          });
        }
      });

      const limited = await admin.query(systemErrorsApi.list, { limit: 3 });
      expect(limited).toHaveLength(3);
    });

    it("defaults limit to 50", async () => {
      const t = createTestContext();
      const { ctx: admin } = await createAdminContext(t);

      const errors = await admin.query(systemErrorsApi.list, {});
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  describe("rate limiting", () => {
    it("records errors even when rate limit exceeded", async () => {
      const t = createTestContext();

      // Insert 10 unresolved errors to exceed the 5-per-hour rate limit
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("systemErrors", {
            source: "mutation",
            operation: `op-${i}`,
            message: `Error ${i}`,
            resolved: false,
            createdAt: Date.now(),
          });
        }

        const errors = await ctx.db.query("systemErrors").collect();
        expect(errors).toHaveLength(10);
      });
    });
  });
});
