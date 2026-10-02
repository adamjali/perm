import { describe, expect, it } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { hashApiKey, parseApiKey } from "../lib/apiKeyFormat";
import { API_PLANS } from "../lib/apiPlans";

type T = ReturnType<typeof createTestContext>;

async function makeUser(t: T, email: string, verified = true): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      ...(verified ? { emailVerified: email } : {}),
    });
    return userId;
  });
}

const as = (t: T, userId: Id<"users">) => t.withIdentity({ subject: userId });

describe("API keys", () => {
  it("makes a key once, keeps only its hash, and verifies it by hash", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "  My script  " });
    if (!made.ok) throw new Error(made.message);
    expect(made.name).toBe("My script");
    expect(parseApiKey(made.key)?.keyId).toBe(made.keyId);

    const stored = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain(made.key);
    expect(stored[0]!.keyHash).toBe(await hashApiKey(made.key));

    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    expect(v).toMatchObject({ keyId: made.keyId, revoked: false, plan: "free" });
    expect(v && "account" in v ? v.account : "").toMatch(/^acct_[0-9A-Za-z]{20}$/);
  });

  it("lists the signed-in person's keys with the plan's limits, and nobody else's", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    await as(t, a).action(api.apiKeys.create, { name: "A" });
    const mine = await as(t, b).query(api.apiKeys.mine, {});
    expect(mine).toMatchObject({ plan: API_PLANS.free, account: null, keys: [] });
    expect(await t.query(api.apiKeys.mine, {})).toBeNull();
  });

  it("holds the Free plan to one key, saying how to make room", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await as(t, userId).action(api.apiKeys.create, { name: "first" });
    const second = await as(t, userId).action(api.apiKeys.create, { name: "second" });
    expect(second).toEqual({ ok: false, message: "The Free plan has one key. Revoke it to make a new one." });
  });

  it("refuses an account whose email isn't confirmed", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "new@example.com", false);
    const r = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    expect(r.ok).toBe(false);
  });

  it("stops a revoked key, and lets the account make another", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    if (!made.ok) throw new Error(made.message);
    await as(t, userId).mutation(api.apiKeys.revoke, { keyId: made.keyId });
    expect(await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) })).toEqual({
      keyId: made.keyId,
      revoked: true,
    });
    expect((await as(t, userId).action(api.apiKeys.create, { name: "y" })).ok).toBe(true);
  });

  it("won't let one person revoke another's key", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const made = await as(t, a).action(api.apiKeys.create, { name: "A" });
    if (!made.ok) throw new Error(made.message);
    await expect(as(t, b).mutation(api.apiKeys.revoke, { keyId: made.keyId })).rejects.toThrow();
  });

  it("stops a key the moment its account is being deleted", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    if (!made.ok) throw new Error(made.message);
    await t.run((ctx) => ctx.db.patch(userId, { deletedAt: Date.now() + 1000 }));
    expect(await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) })).toBeNull();
  });

  it("answers null for a hash nobody was issued, and for one that isn't a hash", async () => {
    const t = createTestContext();
    expect(await t.query(api.apiKeys.verify, { keyHash: "0".repeat(64) })).toBeNull();
    expect(await t.query(api.apiKeys.verify, { keyHash: "not-a-hash" })).toBeNull();
  });

  it("raises an account to Plus by hand, and the key reports it within its next check", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    if (!made.ok) throw new Error(made.message);
    await t.mutation(internal.apiKeys.setPlan, { email: "dev@example.com", plan: "plus" });
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    expect(v).toMatchObject({ plan: "plus" });
    expect((await as(t, userId).action(api.apiKeys.create, { name: "second" })).ok).toBe(true);
  });

  it("removes keys and the API account with the rest of the account's data", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await as(t, userId).action(api.apiKeys.create, { name: "x" });
    await t.run(async (ctx) => {
      const { purgeAllUserData } = await import("../lib/deletion");
      const result = await purgeAllUserData(ctx, userId);
      expect(result.apiKeys).toBe(1);
    });
    expect(await t.run((ctx) => ctx.db.query("apiKeys").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("apiAccounts").collect())).toEqual([]);
  });
});
