import { describe, it, expect } from "vitest";
import {
  createTestContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../../test-utils/convex";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildDefaultProfile } from "../lib/userDefaults";

// ---------------------------------------------------------------------------
// I3 — abuseDetection
//   * checkEmailSuspension (public, unauthenticated): returns a MINIMAL neutral
//     shape — { suspended, reason } — and NEVER leaks the internal auto-reason.
//   * recordAuthFailure (auto-suspend feeder): only flips suspendedAt after the
//     failure threshold AND a corroborating ip_strike exists in the window. A
//     low-and-slow single-email lockout (no ip_strike) must NOT suspend.
// ---------------------------------------------------------------------------

const FAIL_THRESHOLD = 10;
const FAIL_WINDOW_MS = 30 * 60 * 1000;

/** Seed a user + matching userProfiles row; returns the userId. */
async function seedUserWithProfile(
  t: ReturnType<typeof createTestContext>,
  email: string,
): Promise<Id<"users">> {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    await ctx.db.insert("userProfiles", buildDefaultProfile(userId));
    return userId;
  });
}

/** Write N auth_fail:login rows for an email inside the live window. */
async function seedAuthFailures(
  t: ReturnType<typeof createTestContext>,
  email: string,
  n: number,
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      await ctx.db.insert("rateLimits", {
        key: `auth_fail:${email}`,
        timestamp: now - i * 1000, // all within the window
        identifier: email,
        action: "auth_fail:login",
      });
    }
  });
}

/** Write a corroborating ip_strike row inside the live window. */
async function seedIpStrike(t: ReturnType<typeof createTestContext>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("rateLimits", {
      key: "ip_strike:203.0.113.7",
      timestamp: Date.now(),
      identifier: "203.0.113.7",
      action: "ip_strike",
    });
  });
}

describe("checkEmailSuspension — neutral response shape", () => {
  it("returns { suspended: false, reason: null } for an unknown email", async () => {
    const t = createTestContext();
    const r = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "nobody@example.com",
    });
    expect(r).toEqual({ suspended: false, reason: null });
  });

  it("returns { suspended: false, reason: null } for empty email", async () => {
    const t = createTestContext();
    const r = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "   ",
    });
    expect(r).toEqual({ suspended: false, reason: null });
  });

  it("returns { suspended: false, reason: null } for a known but not-suspended user", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "active@example.com");
    const r = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "active@example.com",
    });
    expect(r).toEqual({ suspended: false, reason: null });
  });

  it("returns suspended:true with a NEUTRAL reason code — never the internal auto-reason", async () => {
    const t = createTestContext();
    const userId = await seedUserWithProfile(t, "locked@example.com");
    const internalReason = "auto: 12 auth failures in 30min";
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(profile!._id, {
        suspendedAt: Date.now(),
        suspendedReason: internalReason,
        suspendedUntil: Date.now() + 60_000,
      });
    });

    const r = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "locked@example.com",
    });
    expect(r.suspended).toBe(true);
    // The neutral code is exposed; the internal mechanics-leaking reason is NOT.
    expect(r.reason).toBe("locked");
    expect(r.reason).not.toBe(internalReason);
    // Timestamps must not leak in the unauthenticated shape.
    expect(r).not.toHaveProperty("suspendedUntil");
    expect(r).not.toHaveProperty("at");
  });

  it("auto-lifts: a suspension past its `until` reads as not-suspended", async () => {
    const t = createTestContext();
    const userId = await seedUserWithProfile(t, "expired@example.com");
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(profile!._id, {
        suspendedAt: Date.now() - 100_000,
        suspendedReason: "auto",
        suspendedUntil: Date.now() - 1, // already lapsed
      });
    });

    const r = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "expired@example.com",
    });
    expect(r).toEqual({ suspended: false, reason: null });
  });
});

describe("recordAuthFailure — corroboration-gated auto-suspend", () => {
  setupSchedulerTests();

  it("does NOT suspend below the failure threshold", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "few@example.com");
    await seedAuthFailures(t, "few@example.com", FAIL_THRESHOLD - 2);
    await seedIpStrike(t); // corroboration present, but threshold not met

    const result = await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "few@example.com",
      action: "login",
    });
    await finishScheduledFunctions(t);

    expect(result.suspended).toBe(false);
  });

  it("does NOT suspend at threshold WITHOUT a corroborating ip_strike (targeted-lockout DoS guard)", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "noip@example.com");
    // Threshold-minus-1 pre-seeded; this call inserts the Nth, hitting threshold.
    await seedAuthFailures(t, "noip@example.com", FAIL_THRESHOLD - 1);
    // No ip_strike seeded.

    const result = await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "noip@example.com",
      action: "login",
    });
    await finishScheduledFunctions(t);

    expect(result.suspended).toBe(false);
    expect(result.uncorroborated).toBe(true);

    // Profile must remain unsuspended.
    const stillActive = await t.query(
      api.abuseDetection.checkEmailSuspension,
      { email: "noip@example.com" },
    );
    expect(stillActive.suspended).toBe(false);
  });

  it("SUSPENDS at threshold WITH a corroborating ip_strike", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "victim@example.com");
    await seedAuthFailures(t, "victim@example.com", FAIL_THRESHOLD - 1);
    await seedIpStrike(t);

    const result = await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "victim@example.com",
      action: "login",
    });
    await finishScheduledFunctions(t);

    expect(result.suspended).toBe(true);
    expect(result.failures).toBeGreaterThanOrEqual(FAIL_THRESHOLD);

    // checkEmailSuspension now reports locked.
    const status = await t.query(api.abuseDetection.checkEmailSuspension, {
      email: "victim@example.com",
    });
    expect(status.suspended).toBe(true);
    expect(status.reason).toBe("locked");
  });

  it("does NOT double-suspend an already-suspended user", async () => {
    const t = createTestContext();
    const userId = await seedUserWithProfile(t, "already@example.com");
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(profile!._id, {
        suspendedAt: Date.now() - 1000,
        suspendedReason: "auto: earlier",
        suspendedUntil: Date.now() + 60_000,
      });
    });
    await seedAuthFailures(t, "already@example.com", FAIL_THRESHOLD - 1);
    await seedIpStrike(t);

    const result = await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "already@example.com",
      action: "login",
    });
    await finishScheduledFunctions(t);

    expect(result.suspended).toBe(false);
    expect(result.alreadySuspended).toBe(true);
  });

  it("ignores ip_strikes OUTSIDE the rolling window (no corroboration)", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "stale-ip@example.com");
    await seedAuthFailures(t, "stale-ip@example.com", FAIL_THRESHOLD - 1);
    // ip_strike from before the window — must not corroborate.
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", {
        key: "ip_strike:1.2.3.4",
        timestamp: Date.now() - FAIL_WINDOW_MS - 60_000,
        identifier: "1.2.3.4",
        action: "ip_strike",
      });
    });

    const result = await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "stale-ip@example.com",
      action: "login",
    });
    await finishScheduledFunctions(t);

    expect(result.suspended).toBe(false);
    expect(result.uncorroborated).toBe(true);
  });

  it("records the failure row even when it does not suspend", async () => {
    const t = createTestContext();
    await seedUserWithProfile(t, "logged@example.com");

    await t.mutation(internal.abuseDetection.recordAuthFailure, {
      email: "logged@example.com",
      action: "password_reset",
    });
    await finishScheduledFunctions(t);

    const rows = await t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .filter((q) => q.eq(q.field("action"), "auth_fail:password_reset"))
        .collect(),
    );
    expect(rows.length).toBe(1);
    expect(rows[0]!.identifier).toBe("logged@example.com");
  });
});
