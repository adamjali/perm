import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal, api } from "../_generated/api";
import { normalizeIp } from "../abuseBlocklist";

const IP = "203.0.113.42";

// ---------------------------------------------------------------------------
// normalizeIp — pure helper, no Convex
// ---------------------------------------------------------------------------

describe("normalizeIp", () => {
  it("lower-cases + trims", () => {
    expect(normalizeIp("  203.0.113.42  ")).toBe("203.0.113.42");
    expect(normalizeIp("203.0.113.42")).toBe("203.0.113.42");
  });

  it("takes the first hop from a comma-separated XFF chain", () => {
    expect(normalizeIp("203.0.113.42, 10.0.0.1")).toBe("203.0.113.42");
    expect(normalizeIp("203.0.113.42,10.0.0.1,10.0.0.2")).toBe("203.0.113.42");
  });

  it("trims whitespace inside the chain", () => {
    expect(normalizeIp("  203.0.113.42  ,  10.0.0.1")).toBe("203.0.113.42");
  });
});

// ---------------------------------------------------------------------------
// recordStrike — auto-block after threshold
// ---------------------------------------------------------------------------

describe("recordStrike — strike accumulation + auto-block", () => {
  it("records strikes below the threshold without blocking", async () => {
    const t = createTestContext();

    const r1 = await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: IP,
      reason: "test_strike",
    });
    expect(r1.blocked).toBe(false);
    expect(r1.strikes).toBe(1);

    const r2 = await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: IP,
      reason: "test_strike",
    });
    expect(r2.blocked).toBe(false);
    expect(r2.strikes).toBe(2);

    // No abuseBlocklist row inserted yet
    const blocks = await t.run((ctx) => ctx.db.query("abuseBlocklist").collect());
    expect(blocks).toHaveLength(0);
  });

  it("auto-blocks on the 3rd strike with a 24h window", async () => {
    const t = createTestContext();

    await t.mutation(internal.abuseBlocklist.recordStrike, { ip: IP, reason: "x" });
    await t.mutation(internal.abuseBlocklist.recordStrike, { ip: IP, reason: "x" });
    const r3 = await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: IP,
      reason: "x_limit_tripped",
    });

    expect(r3.blocked).toBe(true);
    expect(r3.strikes).toBe(3);

    const blocks = await t.run((ctx) => ctx.db.query("abuseBlocklist").collect());
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.ip).toBe(IP);
    expect(blocks[0]!.reason).toBe("x_limit_tripped");
    expect(blocks[0]!.manualOverride).toBe(false);
    // 24h window
    const remaining = blocks[0]!.expiresAt - Date.now();
    expect(remaining).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("uses the first hop of an XFF chain as the keyed IP", async () => {
    const t = createTestContext();

    await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: "203.0.113.42, 10.0.0.1",
      reason: "x",
    });
    await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: "203.0.113.42",
      reason: "x",
    });
    const r3 = await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: "  203.0.113.42  ",
      reason: "x",
    });

    expect(r3.blocked).toBe(true);

    const blocks = await t.run((ctx) => ctx.db.query("abuseBlocklist").collect());
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.ip).toBe("203.0.113.42");
  });

  it("ignores empty / unparseable IP", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.abuseBlocklist.recordStrike, {
      ip: "",
      reason: "x",
    });
    expect(r.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isIpBlocked — read path used by the middleware
// ---------------------------------------------------------------------------

describe("isIpBlocked", () => {
  it("returns blocked=false for an unknown IP", async () => {
    const t = createTestContext();
    const r = await t.query(api.abuseBlocklist.isIpBlocked, { ip: IP });
    expect(r.blocked).toBe(false);
  });

  it("returns blocked=true for an active row", async () => {
    const t = createTestContext();
    // Insert directly — the admin mutation path is exercised separately.
    await t.run(async (ctx) => {
      await ctx.db.insert("abuseBlocklist", {
        ip: normalizeIp(IP),
        addedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        reason: "manual",
        strikes: 0,
        manualOverride: true,
      });
    });
    const r = await t.query(api.abuseBlocklist.isIpBlocked, { ip: IP });
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.reason).toBe("manual");
      expect(r.manualOverride).toBe(true);
    }
  });

  it("returns blocked=false for an expired row (live filter)", async () => {
    const t = createTestContext();
    // Insert a row that expired 1 ms ago
    await t.run(async (ctx) => {
      await ctx.db.insert("abuseBlocklist", {
        ip: normalizeIp(IP),
        addedAt: Date.now() - 1000,
        expiresAt: Date.now() - 1,
        reason: "stale",
        strikes: 0,
        manualOverride: true,
      });
    });
    const r = await t.query(api.abuseBlocklist.isIpBlocked, { ip: IP });
    expect(r.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adminBlockIp / adminUnblockIp — manual override path
// ---------------------------------------------------------------------------

describe("admin manual block flow", () => {
  it("admin block creates a row + admin unblock removes it", async () => {
    const t = createTestContext();
    // Need an admin identity. Insert an admin user so requireAdmin passes.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      // Skip this test in environments without ADMIN_EMAIL configured.
      return;
    }
    const adminUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: adminEmail }),
    );
    const auth = t.withIdentity({ subject: adminUserId, email: adminEmail });

    await auth.mutation(api.abuseBlocklist.adminBlockIp, {
      ip: IP,
      reason: "manual_block",
      durationMs: 60 * 60_000,
    });
    const blocksAfterBlock = await t.run((ctx) =>
      ctx.db.query("abuseBlocklist").collect(),
    );
    expect(blocksAfterBlock).toHaveLength(1);
    expect(blocksAfterBlock[0]!.manualOverride).toBe(true);

    await auth.mutation(api.abuseBlocklist.adminUnblockIp, { ip: IP });
    const blocksAfterUnblock = await t.run((ctx) =>
      ctx.db.query("abuseBlocklist").collect(),
    );
    expect(blocksAfterUnblock).toHaveLength(0);
  });
});
