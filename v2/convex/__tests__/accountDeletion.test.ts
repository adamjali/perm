import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

const DAY = 24 * 60 * 60 * 1000;

/**
 * cleanupAndPurge is the irreversible account-purge path. Its safety rests on a
 * grace-window gate (getDeletionInfo.shouldPurge) — these lock that gate so a
 * future refactor can't accidentally purge a user who is still inside their
 * 30-day cancellation window, or one who cancelled outright.
 */
describe("cleanupAndPurge — grace-window gate", () => {
  it("purges a user whose grace period has expired (deletedAt in the past)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "expired@example.com", deletedAt: Date.now() - DAY })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).toBeNull(); // fully purged
  });

  it("does NOT purge a user still inside the grace window (deletedAt in the future)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "grace@example.com", deletedAt: Date.now() + 30 * DAY })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).not.toBeNull(); // cancellation window respected
  });

  it("does NOT purge a user who cancelled (deletedAt unset)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "cancelled@example.com" })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).not.toBeNull();
  });
});
