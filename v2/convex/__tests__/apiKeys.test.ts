import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    // The paywall is off by default, so the key's limits are Plus's while the
    // account itself stays on Free.
    expect(v).toMatchObject({ keyId: made.keyId, revoked: false, plan: "plus", accountPlan: "free", paywall: false });
    expect(v && "account" in v ? v.account : "").toMatch(/^acct_[0-9A-Za-z]{20}$/);
  });

  it("lists the signed-in person's keys with the plan's limits, and nobody else's", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    await as(t, a).action(api.apiKeys.create, { name: "A" });
    const mine = await as(t, b).query(api.apiKeys.mine, {});
    expect(mine).toMatchObject({ plan: API_PLANS.plus, accountPlan: "free", paywall: false, account: null, keys: [] });
    expect(await t.query(api.apiKeys.mine, {})).toBeNull();
  });

  it("holds the Free plan to one key once the paywall is on, saying how to make room", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
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

  it("gives every account Plus's three keys while the paywall is off", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    for (const name of ["one", "two", "three"]) {
      expect((await as(t, userId).action(api.apiKeys.create, { name })).ok).toBe(true);
    }
    const fourth = await as(t, userId).action(api.apiKeys.create, { name: "four" });
    expect(fourth).toEqual({ ok: false, message: "The Plus plan has 3 keys. Revoke one to make a new one." });
  });

  it("raises an account to Plus by hand, and the key reports it within its next check", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    if (!made.ok) throw new Error(made.message);
    await t.mutation(internal.apiKeys.setPlan, { email: "dev@example.com", plan: "plus" });
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    expect(v).toMatchObject({ plan: "plus", accountPlan: "plus", paywall: true });
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

describe("what a key carries", () => {
  it("keeps the chosen scopes, always with read, and never writing cases", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x", scopes: ["export", "cases_write", "nonsense"] });
    if (!made.ok) throw new Error(made.message);
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    expect(v && "scopes" in v ? v.scopes : null).toEqual(["read", "export"]);
  });

  it("gives a key made without a choice the default scopes", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x" });
    if (!made.ok) throw new Error(made.message);
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    expect(v && "scopes" in v ? v.scopes : null).toEqual(["read", "export", "live_lookup", "webhooks"]);
  });

  it("records a lifetime as an end time, and refuses one out of range", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const before = Date.now();
    const made = await as(t, userId).action(api.apiKeys.create, { name: "x", expiresInDays: 30 });
    if (!made.ok) throw new Error(made.message);
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(made.key) });
    const expiresAt = v && "expiresAt" in v ? v.expiresAt : null;
    expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 86_400_000);
    expect(expiresAt).toBeLessThan(before + 31 * 86_400_000);
    expect((await as(t, userId).action(api.apiKeys.create, { name: "y", expiresInDays: 0 })).ok).toBe(false);
    expect((await as(t, userId).action(api.apiKeys.create, { name: "y", expiresInDays: 1.5 })).ok).toBe(false);
  });

  it("makes sandbox keys under their own allowance, marked as sandbox", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    expect((await as(t, userId).action(api.apiKeys.create, { name: "live" })).ok).toBe(true);
    const s1 = await as(t, userId).action(api.apiKeys.create, { name: "test 1", sandbox: true });
    if (!s1.ok) throw new Error(s1.message);
    expect(s1.key.startsWith("pt_test_")).toBe(true);
    expect((await as(t, userId).action(api.apiKeys.create, { name: "test 2", sandbox: true })).ok).toBe(true);
    const s3 = await as(t, userId).action(api.apiKeys.create, { name: "test 3", sandbox: true });
    expect(s3).toEqual({ ok: false, message: "The Free plan has 2 sandbox keys. Revoke one to make a new one." });
    const v = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(s1.key) });
    expect(v).toMatchObject({ sandbox: true });
  });

  it("lists scopes, kind and lifetime in Settings", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await as(t, userId).action(api.apiKeys.create, { name: "x", scopes: ["read"], expiresInDays: 7, sandbox: true });
    const mine = await as(t, userId).query(api.apiKeys.mine, {});
    expect(mine?.keys[0]).toMatchObject({ name: "x", scopes: ["read"], sandbox: true, graceUntil: null, replacedBy: null });
    expect(mine?.keys[0]?.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("rotating a key", () => {
  it("makes a new key with the same name and scopes, and keeps the old one working for 24 hours", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const old = await as(t, userId).action(api.apiKeys.create, { name: "deploy", scopes: ["read", "webhooks"] });
    if (!old.ok) throw new Error(old.message);
    const before = Date.now();
    const next = await as(t, userId).action(api.apiKeys.rotate, { keyId: old.keyId });
    if (!next.ok) throw new Error(next.message);
    expect(next.name).toBe("deploy");
    expect(next.key).not.toBe(old.key);

    const fresh = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(next.key) });
    expect(fresh).toMatchObject({ revoked: false, scopes: ["read", "webhooks"], graceUntil: null });
    const stale = await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(old.key) });
    const graceUntil = stale && "graceUntil" in stale ? stale.graceUntil : null;
    expect(stale).toMatchObject({ revoked: false });
    expect(graceUntil).toBeGreaterThanOrEqual(before + 24 * 3_600_000);
    expect(graceUntil).toBeLessThan(before + 25 * 3_600_000);
  });

  it("doesn't need a free place on the Free plan's one key", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const old = await as(t, userId).action(api.apiKeys.create, { name: "only" });
    if (!old.ok) throw new Error(old.message);
    expect((await as(t, userId).action(api.apiKeys.rotate, { keyId: old.keyId })).ok).toBe(true);
  });

  it("allows one rotation in flight, so rotating can't stack working keys", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const old = await as(t, userId).action(api.apiKeys.create, { name: "k" });
    if (!old.ok) throw new Error(old.message);
    const next = await as(t, userId).action(api.apiKeys.rotate, { keyId: old.keyId });
    if (!next.ok) throw new Error(next.message);
    const again = await as(t, userId).action(api.apiKeys.rotate, { keyId: next.keyId });
    expect(again.ok).toBe(false);
    expect(await as(t, userId).action(api.apiKeys.rotate, { keyId: old.keyId })).toMatchObject({ ok: false });
  });

  it("won't rotate someone else's key", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const made = await as(t, a).action(api.apiKeys.create, { name: "A" });
    if (!made.ok) throw new Error(made.message);
    expect(await as(t, b).action(api.apiKeys.rotate, { keyId: made.keyId })).toEqual({ ok: false, message: "That key isn't one of yours." });
  });

  it("never gives the new key a longer life than the old one had", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const old = await as(t, userId).action(api.apiKeys.create, { name: "k", expiresInDays: 10 });
    if (!old.ok) throw new Error(old.message);
    const oldEnd = (await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(old.key) })) as { expiresAt: number };
    const next = await as(t, userId).action(api.apiKeys.rotate, { keyId: old.keyId });
    if (!next.ok) throw new Error(next.message);
    const newEnd = (await t.query(api.apiKeys.verify, { keyHash: await hashApiKey(next.key) })) as { expiresAt: number };
    expect(newEnd.expiresAt).toBeLessThanOrEqual(oldEnd.expiresAt + 86_400_000);
  });
});

