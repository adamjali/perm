import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";

const IP = "203.0.113.99";

// ---------------------------------------------------------------------------
// checkIpRateLimit
// ---------------------------------------------------------------------------

describe("checkIpRateLimit", () => {
  it("allows the first request from a fresh IP", async () => {
    const t = createTestContext();
    const r = await t.mutation(api.authRateLimit.checkIpRateLimit, {
      ip: IP,
      action: "ip_auth",
    });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThan(0);
  });

  it("fails open with remaining=0 on empty IP (signals can't-enforce)", async () => {
    const t = createTestContext();
    const r = await t.mutation(api.authRateLimit.checkIpRateLimit, {
      ip: "",
      action: "ip_auth",
    });
    expect(r.allowed).toBe(true);
    // remaining=0 (not 1) so callers can't cache phantom headroom — see
    // the comment in checkIpRateLimit for why.
    expect(r.remaining).toBe(0);
  });

  it("short-circuits when the IP is in the abuse blocklist", async () => {
    const t = createTestContext();
    // Pre-seed an active blocklist row
    await t.run(async (ctx) => {
      await ctx.db.insert("abuseBlocklist", {
        ip: IP,
        addedAt: Date.now(),
        expiresAt: Date.now() + 60 * 60_000,
        reason: "manual",
        strikes: 0,
        manualOverride: true,
      });
    });

    const r = await t.mutation(api.authRateLimit.checkIpRateLimit, {
      ip: IP,
      action: "ip_auth",
    });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.message).toMatch(/temporarily blocked/i);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("ignores expired blocklist rows", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("abuseBlocklist", {
        ip: IP,
        addedAt: Date.now() - 1000,
        expiresAt: Date.now() - 1, // already expired
        reason: "stale",
        strikes: 0,
        manualOverride: true,
      });
    });

    const r = await t.mutation(api.authRateLimit.checkIpRateLimit, {
      ip: IP,
      action: "ip_auth",
    });
    expect(r.allowed).toBe(true);
  });

  it("normalizes XFF chain so the first-hop IP is what gets gated", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("abuseBlocklist", {
        ip: IP, // already normalized form
        addedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        reason: "manual",
        strikes: 0,
        manualOverride: true,
      });
    });

    const r = await t.mutation(api.authRateLimit.checkIpRateLimit, {
      ip: `${IP}, 10.0.0.1`,
      action: "ip_auth",
    });
    expect(r.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkAuthRateLimit — per-email gate + signup carve-out
// ---------------------------------------------------------------------------

describe("checkAuthRateLimit — per-email", () => {
  it("allows a fresh email under the limit", async () => {
    const t = createTestContext();
    const r = await t.mutation(api.authRateLimit.checkAuthRateLimit, {
      email: "fresh@example.com",
      action: "login",
    });
    expect(r.allowed).toBe(true);
  });

  it("does NOT auto-suspend on signup rejections (signup carve-out)", async () => {
    const t = createTestContext();
    // Push the per-email rate to its ceiling for action=signup
    // (uses OTP_VERIFY config = 5/15min in current settings).
    const email = "signup-test@example.com";
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.authRateLimit.checkAuthRateLimit, {
        email,
        action: "signup",
      });
    }
    // No auto_fail rows should exist for signup — the carve-out at
    // checkAuthRateLimit's `args.action !== "signup"` gate suppresses them.
    const failRows = await t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .filter((q) => q.eq(q.field("action"), "auth_fail:signup"))
        .collect(),
    );
    expect(failRows).toHaveLength(0);
  });

  it("DOES record auth failures for login (auto-suspend feeder)", async () => {
    const t = createTestContext();
    const email = "login-test@example.com";
    // Push past the LOGIN limit to force a rejection.
    for (let i = 0; i < 30; i++) {
      await t.mutation(api.authRateLimit.checkAuthRateLimit, {
        email,
        action: "login",
      });
    }
    const failRows = await t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .filter((q) => q.eq(q.field("action"), "auth_fail:login"))
        .collect(),
    );
    // At least one failure should have been recorded once the limit tripped.
    expect(failRows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// clearAuthRateLimit — ownership check (I2)
//
// A successful sign-in clears the per-email brute-force counter. The mutation
// must clear ONLY the caller's OWN email — otherwise any authenticated user
// could wipe a victim's counter and defeat the login rate limit.
// ---------------------------------------------------------------------------

describe("clearAuthRateLimit — ownership enforcement", () => {
  /** Seed a user + identity-scoped ctx with a known email. */
  async function seedUser(t: ReturnType<typeof createTestContext>, email: string) {
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email }),
    );
    return t.withIdentity({ subject: userId as string });
  }

  /** Push the per-email login counter to a blocked state. */
  async function exhaustLogin(
    t: ReturnType<typeof createTestContext>,
    email: string,
  ) {
    let lastAllowed = true;
    for (let i = 0; i < 30 && lastAllowed; i++) {
      const r = await t.mutation(api.authRateLimit.checkAuthRateLimit, {
        email,
        action: "login",
      });
      lastAllowed = r.allowed;
    }
  }

  function loginRowCount(
    t: ReturnType<typeof createTestContext>,
    email: string,
  ) {
    return t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .filter((q) =>
          q.and(
            q.eq(q.field("identifier"), email),
            q.eq(q.field("action"), "login"),
          ),
        )
        .collect(),
    );
  }

  it("clears the caller's OWN email counter", async () => {
    const t = createTestContext();
    const owner = await seedUser(t, "owner@example.com");
    await exhaustLogin(t, "owner@example.com");

    expect((await loginRowCount(t, "owner@example.com")).length).toBeGreaterThan(0);

    await owner.mutation(api.authRateLimit.clearAuthRateLimit, {
      email: "owner@example.com",
      action: "login",
    });

    expect(await loginRowCount(t, "owner@example.com")).toHaveLength(0);
  });

  it("clears regardless of email casing/whitespace (normalizes both sides)", async () => {
    const t = createTestContext();
    const owner = await seedUser(t, "owner@example.com");
    await exhaustLogin(t, "owner@example.com");

    await owner.mutation(api.authRateLimit.clearAuthRateLimit, {
      email: "  Owner@Example.com  ",
      action: "login",
    });

    expect(await loginRowCount(t, "owner@example.com")).toHaveLength(0);
  });

  it("REJECTS clearing a DIFFERENT email — victim's counter is untouched", async () => {
    const t = createTestContext();
    // Attacker is authenticated as attacker@evil.com.
    const attacker = await seedUser(t, "attacker@evil.com");
    // Victim has an exhausted login counter we must not be able to wipe.
    await exhaustLogin(t, "victim@example.com");
    const before = (await loginRowCount(t, "victim@example.com")).length;
    expect(before).toBeGreaterThan(0);

    await attacker.mutation(api.authRateLimit.clearAuthRateLimit, {
      email: "victim@example.com",
      action: "login",
    });

    // Victim's counter is intact — the ownership check rejected the clear.
    expect((await loginRowCount(t, "victim@example.com")).length).toBe(before);
  });

  it("is a no-op for an unauthenticated caller", async () => {
    const t = createTestContext();
    await exhaustLogin(t, "victim@example.com");
    const before = (await loginRowCount(t, "victim@example.com")).length;

    // No identity attached → returns early, clears nothing.
    await t.mutation(api.authRateLimit.clearAuthRateLimit, {
      email: "victim@example.com",
      action: "login",
    });

    expect((await loginRowCount(t, "victim@example.com")).length).toBe(before);
  });
});
