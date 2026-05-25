import { describe, it, expect } from "vitest";
import { createTestContext } from "../../../test-utils/convex";
import { RATE_LIMITS } from "../rateLimit";
import type { RateLimitConfig, RateLimitResult } from "../rateLimit";
import {
  checkRateLimit,
  recordRateLimitAttempt,
  checkAndRecordRateLimit,
  clearRateLimit,
} from "../rateLimit";

// ---------------------------------------------------------------------------
// Config constants — current (retuned) caps. These are intentionally
// permissive so legit users who mistype/forget aren't locked out; the actual
// enforcement behavior is covered by the runtime tests below.
// ---------------------------------------------------------------------------
describe("RATE_LIMITS configuration", () => {
  it("LOGIN allows 20 attempts per 15 minutes", () => {
    expect(RATE_LIMITS.LOGIN.limit).toBe(20);
    expect(RATE_LIMITS.LOGIN.windowMs).toBe(15 * 60 * 1000);
  });

  it("OTP_VERIFY allows 10 attempts per 15 minutes", () => {
    expect(RATE_LIMITS.OTP_VERIFY.limit).toBe(10);
    expect(RATE_LIMITS.OTP_VERIFY.windowMs).toBe(15 * 60 * 1000);
  });

  it("PASSWORD_RESET allows 5 attempts per hour", () => {
    expect(RATE_LIMITS.PASSWORD_RESET.limit).toBe(5);
    expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000);
  });

  it("EMAIL_SEND allows 5 per 10 minutes", () => {
    expect(RATE_LIMITS.EMAIL_SEND.limit).toBe(5);
    expect(RATE_LIMITS.EMAIL_SEND.windowMs).toBe(10 * 60 * 1000);
  });

  it("all configs have positive limits and windows", () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config.limit).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    }
  });

  it("relative restrictiveness: PASSWORD_RESET ≤ OTP_VERIFY ≤ LOGIN", () => {
    expect(RATE_LIMITS.PASSWORD_RESET.limit).toBeLessThanOrEqual(
      RATE_LIMITS.OTP_VERIFY.limit,
    );
    expect(RATE_LIMITS.OTP_VERIFY.limit).toBeLessThanOrEqual(
      RATE_LIMITS.LOGIN.limit,
    );
  });
});

describe("RateLimitResult type contract", () => {
  it("allowed result has remaining >= 0 and no message", () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 9,
      resetInMs: 900000,
    };
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.message).toBeUndefined();
  });

  it("blocked result has remaining 0 and includes message", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetInMs: 300000,
      message: "Too many requests. Please try again in 5 minutes.",
    };
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toContain("Too many requests");
  });
});

// ---------------------------------------------------------------------------
// Runtime limiter behavior — exercises the sliding-window logic against a real
// convex-test DB. This is the logic that actually enforces the caps; the config
// constants above are just inputs to it.
// ---------------------------------------------------------------------------

const SMALL: RateLimitConfig = { limit: 3, windowMs: 15 * 60 * 1000 };

describe("checkAndRecordRateLimit (runtime behavior)", () => {
  it("allows attempts up to the limit, then blocks the (limit+1)th", async () => {
    const t = createTestContext();

    const results = await t.run(async (ctx) => {
      const out: RateLimitResult[] = [];
      // 3 allowed attempts + 1 over the limit
      for (let i = 0; i < SMALL.limit + 1; i++) {
        out.push(
          await checkAndRecordRateLimit(ctx, "user@example.com", "login", SMALL),
        );
      }
      return out;
    });

    expect(results.slice(0, SMALL.limit).every((r) => r.allowed)).toBe(true);
    const blocked = results[SMALL.limit]!;
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.message).toMatch(/too many requests/i);
  });

  it("decrements `remaining` on each allowed attempt", async () => {
    const t = createTestContext();

    const remainings = await t.run(async (ctx) => {
      const out: number[] = [];
      for (let i = 0; i < SMALL.limit; i++) {
        const r = await checkAndRecordRateLimit(ctx, "a@b.com", "login", SMALL);
        out.push(r.remaining);
      }
      return out;
    });

    // limit=3 → first allowed leaves 2 remaining, then 1, then 0.
    expect(remainings).toEqual([2, 1, 0]);
  });

  it("isolates counters per identifier+action key", async () => {
    const t = createTestContext();

    const { aliceBlocked, bobFirst } = await t.run(async (ctx) => {
      // Exhaust alice's login bucket
      for (let i = 0; i < SMALL.limit; i++) {
        await checkAndRecordRateLimit(ctx, "alice@x.com", "login", SMALL);
      }
      const aliceBlocked = await checkAndRecordRateLimit(
        ctx,
        "alice@x.com",
        "login",
        SMALL,
      );
      // Bob is a different identifier — unaffected.
      const bobFirst = await checkAndRecordRateLimit(
        ctx,
        "bob@x.com",
        "login",
        SMALL,
      );
      return { aliceBlocked, bobFirst };
    });

    expect(aliceBlocked.allowed).toBe(false);
    expect(bobFirst.allowed).toBe(true);
  });

  it("does NOT record an attempt when the request is already blocked", async () => {
    const t = createTestContext();

    const count = await t.run(async (ctx) => {
      for (let i = 0; i < SMALL.limit; i++) {
        await checkAndRecordRateLimit(ctx, "c@d.com", "login", SMALL);
      }
      // Two extra blocked checks should not add rows (check returns !allowed,
      // so recordRateLimitAttempt is skipped).
      await checkAndRecordRateLimit(ctx, "c@d.com", "login", SMALL);
      await checkAndRecordRateLimit(ctx, "c@d.com", "login", SMALL);
      const rows = await ctx.db
        .query("rateLimits")
        .filter((q) => q.eq(q.field("identifier"), "c@d.com"))
        .collect();
      return rows.length;
    });

    // Only the `limit` allowed attempts are recorded.
    expect(count).toBe(SMALL.limit);
  });

  it("blocked result reports a positive resetInMs (time until window rolls off)", async () => {
    const t = createTestContext();

    const blocked = await t.run(async (ctx) => {
      for (let i = 0; i < SMALL.limit; i++) {
        await checkAndRecordRateLimit(ctx, "e@f.com", "login", SMALL);
      }
      return await checkAndRecordRateLimit(ctx, "e@f.com", "login", SMALL);
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.resetInMs).toBeGreaterThan(0);
    expect(blocked.resetInMs).toBeLessThanOrEqual(SMALL.windowMs);
  });
});

describe("checkRateLimit (read-only, does not record)", () => {
  it("never mutates the table", async () => {
    const t = createTestContext();

    const rowCount = await t.run(async (ctx) => {
      await checkRateLimit(ctx, "ro@x.com", "login", SMALL);
      await checkRateLimit(ctx, "ro@x.com", "login", SMALL);
      const rows = await ctx.db
        .query("rateLimits")
        .filter((q) => q.eq(q.field("identifier"), "ro@x.com"))
        .collect();
      return rows.length;
    });

    expect(rowCount).toBe(0);
  });
});

describe("clearRateLimit", () => {
  it("resets the counter so a blocked identifier is allowed again", async () => {
    const t = createTestContext();

    const { beforeClear, afterClear } = await t.run(async (ctx) => {
      for (let i = 0; i < SMALL.limit; i++) {
        await recordRateLimitAttempt(ctx, "g@h.com", "login");
      }
      const beforeClear = await checkRateLimit(ctx, "g@h.com", "login", SMALL);
      await clearRateLimit(ctx, "g@h.com", "login");
      const afterClear = await checkRateLimit(ctx, "g@h.com", "login", SMALL);
      return { beforeClear, afterClear };
    });

    expect(beforeClear.allowed).toBe(false);
    expect(afterClear.allowed).toBe(true);
  });

  it("only clears the targeted action, leaving other actions intact", async () => {
    const t = createTestContext();

    const { loginAfter, resetAfter } = await t.run(async (ctx) => {
      for (let i = 0; i < SMALL.limit; i++) {
        await recordRateLimitAttempt(ctx, "i@j.com", "login");
        await recordRateLimitAttempt(ctx, "i@j.com", "password_reset");
      }
      await clearRateLimit(ctx, "i@j.com", "login");
      const loginAfter = await checkRateLimit(ctx, "i@j.com", "login", SMALL);
      const resetAfter = await checkRateLimit(
        ctx,
        "i@j.com",
        "password_reset",
        SMALL,
      );
      return { loginAfter, resetAfter };
    });

    expect(loginAfter.allowed).toBe(true); // cleared
    expect(resetAfter.allowed).toBe(false); // untouched, still exhausted
  });
});
