/**
 * The admin's Developers tab, Convex half: each account's keys, endpoints and
 * watches, the working keys by scope, and webhook health. The call counts
 * come from the public-data database and are read by the action, not here.
 */
import { describe, expect, it } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

const NOW = Date.UTC(2026, 9, 9, 12);
const H = 3_600_000;

describe("adminDevelopers.accounts", () => {
  it("counts each account's working keys, sandbox keys, endpoints and watches, and the scopes across them", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "dev@example.com" });
      await ctx.db.insert("apiAccounts", { userId, account: "acct_a", plan: "free", createdAt: NOW - 10 * H });
      const key = { userId, account: "acct_a", createdAt: NOW - H, name: "k" };
      await ctx.db.insert("apiKeys", { ...key, keyHash: "h1", keyId: "AAAAAAAA", scopes: ["read", "webhooks"] });
      await ctx.db.insert("apiKeys", { ...key, keyHash: "h2", keyId: "BBBBBBBB", scopes: ["read"], sandbox: true });
      await ctx.db.insert("apiKeys", { ...key, keyHash: "h3", keyId: "CCCCCCCC", revokedAt: NOW - H });
      await ctx.db.insert("apiKeys", { ...key, keyHash: "h4", keyId: "DDDDDDDD", expiresAt: NOW - H });
      const endpoint = { userId, account: "acct_a", events: ["queue.moved"], secretEnc: "x", secretHint: "abcd", createdAt: NOW - H };
      await ctx.db.insert("webhookEndpoints", { ...endpoint, url: "https://a.example.com/x" });
      await ctx.db.insert("webhookEndpoints", { ...endpoint, url: "https://b.example.com/x", pausedAt: NOW - H });
      await ctx.db.insert("webhookWatches", { userId, account: "acct_a", kind: "case", target: "G-100-26045-123456", createdAt: NOW - H });
    });
    const r = await t.query(internal.adminDevelopers.accounts, { now: NOW });
    expect(r.accounts).toEqual([
      expect.objectContaining({
        account: "acct_a",
        email: "dev@example.com",
        activeKeys: 1,
        sandboxKeys: 1,
        revokedKeys: 1,
        endpoints: 2,
        pausedEndpoints: 1,
        watches: 1,
      }),
    ]);
    expect(r.keys).toEqual({ live: 1, sandbox: 1, byScope: { read: 2, export: 0, live_lookup: 0, webhooks: 1, cases_read: 0 } });
    expect(r.webhooks).toMatchObject({ endpoints: 2, paused: 1, watches: 1 });
  });
});
