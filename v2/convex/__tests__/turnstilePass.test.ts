/**
 * The one-time Turnstile pass: a passed check issues it, a new password
 * account can't be created without it, and no pass works twice. These drive
 * the real action and the real createOrUpdateUser hook, not copies of them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { authCallbacks } from "../auth";
import {
  PASS_REFUSED,
  PASS_TTL_MS,
  PRUNE_PER_ISSUE,
  consumePass,
  hashPass,
  issuePass,
  newPass,
} from "../lib/turnstilePass";
import { isSecurityCheckExpired } from "../../src/lib/auth/auth-errors";

type Hook = typeof authCallbacks.createOrUpdateUser;
type HookArgs = Parameters<Hook>[1];

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Cloudflare's siteverify, answering `success`. */
function stubSiteverify(success: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ success }), { status: 200 })),
  );
}

/** Call the real hook the way Convex Auth does for a new account. */
function hook(ctx: MutationCtx, over: Partial<HookArgs> & { pass?: string; providerId?: string }) {
  const { pass, providerId = "password", ...rest } = over;
  const args = {
    existingUserId: null,
    type: providerId === "google" ? "oauth" : "credentials",
    provider: { id: providerId, type: providerId === "google" ? "oauth" : "credentials" },
    profile: {
      email: "new.person@example.com",
      name: "New Person",
      ...(pass === undefined ? {} : { turnstilePass: pass }),
    },
    ...rest,
  } as unknown as HookArgs;
  return authCallbacks.createOrUpdateUser(ctx as unknown as Parameters<Hook>[0], args);
}

describe("verifyTurnstileToken issues a pass", () => {
  it("returns a pass on success and stores only its hash", async () => {
    const t = createTestContext();
    stubSiteverify(true);
    const r = await t.action(api.turnstile.verifyTurnstileToken, { token: "tok" });
    expect(r.success).toBe(true);
    expect(r.pass).toMatch(/^[0-9a-f]{64}$/);
    const rows = await t.run((ctx) => ctx.db.query("turnstilePasses").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hash).toBe(await hashPass(r.pass!));
    expect(rows[0]!.hash).not.toBe(r.pass);
  });

  it("returns no pass and stores nothing when Cloudflare says no", async () => {
    const t = createTestContext();
    stubSiteverify(false);
    const r = await t.action(api.turnstile.verifyTurnstileToken, { token: "tok" });
    expect(r.success).toBe(false);
    expect(r.pass).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("turnstilePasses").collect())).toHaveLength(0);
  });
});

describe("the pass table", () => {
  it("gives a pass ten minutes and prunes expired ones as new ones arrive", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const now = 1_000_000_000;
      for (let i = 0; i < PRUNE_PER_ISSUE + 5; i++) {
        await ctx.db.insert("turnstilePasses", { hash: `old${i}`, expiresAt: now - 1 });
      }
      await issuePass(ctx, "fresh", now);
      const rows = await ctx.db.query("turnstilePasses").collect();
      // One issue deletes at most PRUNE_PER_ISSUE, so 5 old rows survive it.
      expect(rows).toHaveLength(6);
      expect(rows.find((r) => r.hash === "fresh")!.expiresAt).toBe(now + PASS_TTL_MS);
      await issuePass(ctx, "fresh2", now);
      expect((await ctx.db.query("turnstilePasses").collect()).map((r) => r.hash).sort()).toEqual([
        "fresh",
        "fresh2",
      ]);
    });
  });

  it("a pass works once, an expired one never, and junk is refused", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const now = Date.now();
      const good = newPass();
      const stale = newPass();
      await issuePass(ctx, await hashPass(good), now);
      await ctx.db.insert("turnstilePasses", { hash: await hashPass(stale), expiresAt: now - 1 });

      expect(await consumePass(ctx, good, now)).toBe(true);
      expect(await consumePass(ctx, good, now)).toBe(false);
      expect(await consumePass(ctx, stale, now)).toBe(false);
      expect(await consumePass(ctx, newPass(), now)).toBe(false);
      expect(await consumePass(ctx, undefined, now)).toBe(false);
      expect(await consumePass(ctx, "short", now)).toBe(false);
      // Used and expired rows are both gone.
      expect(await ctx.db.query("turnstilePasses").collect()).toHaveLength(0);
    });
  });
});

describe("createOrUpdateUser needs a pass for a new password account", () => {
  it("refuses without a pass and creates no user", async () => {
    const t = createTestContext();
    await expect(t.run((ctx) => hook(ctx, {}))).rejects.toThrow(PASS_REFUSED);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  it("creates the user with a pass from the check, never stores the pass, and uses it up", async () => {
    const t = createTestContext();
    stubSiteverify(true);
    const { pass } = await t.action(api.turnstile.verifyTurnstileToken, { token: "tok" });
    await t.run((ctx) => hook(ctx, { pass }));

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]!.email).toBe("new.person@example.com");
    expect(JSON.stringify(users[0])).not.toContain(pass!);
    expect(await t.run((ctx) => ctx.db.query("turnstilePasses").collect())).toHaveLength(0);

    // The same pass can't open a second account.
    await expect(
      t.run((ctx) =>
        hook(ctx, { pass, profile: { email: "second@example.com", turnstilePass: pass } }),
      ),
    ).rejects.toThrow(PASS_REFUSED);
  });

  it("refuses an expired pass", async () => {
    const t = createTestContext();
    const pass = newPass();
    await t.run(async (ctx) => {
      await ctx.db.insert("turnstilePasses", { hash: await hashPass(pass), expiresAt: Date.now() - 1 });
    });
    await expect(t.run((ctx) => hook(ctx, { pass }))).rejects.toThrow(PASS_REFUSED);
  });

  it("won't link a new password account to an existing user without a pass", async () => {
    const t = createTestContext();
    await t.run((ctx) => ctx.db.insert("users", { email: "new.person@example.com" }));
    await expect(t.run((ctx) => hook(ctx, {}))).rejects.toThrow(PASS_REFUSED);
  });

  it("asks nothing of Google sign-ups or returning users", async () => {
    const t = createTestContext();
    const googleId = await t.run((ctx) => hook(ctx, { providerId: "google" }));
    expect(googleId).toBeTruthy();
    const again = await t.run((ctx) => hook(ctx, { existingUserId: googleId }));
    expect(again).toBe(googleId);
  });
});

it("the browser recognises the refusal", () => {
  expect(isSecurityCheckExpired(PASS_REFUSED)).toBe(true);
  expect(isSecurityCheckExpired(`[CONVEX A(auth:signIn)] Uncaught ConvexError: ${PASS_REFUSED}`)).toBe(true);
  expect(isSecurityCheckExpired("Invalid credentials")).toBe(false);
});
