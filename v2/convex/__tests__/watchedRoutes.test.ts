/**
 * The two routes the server's watched-case check calls (convex/http.ts):
 * GET /watched-cases hands over case numbers only, and POST
 * /watched-cases/sweep runs the alert sweeps. Both stay shut without the
 * secret, and both are OFF (not open) when the deployment has no secret set.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";

const SECRET = "test-watched-secret-0123456789";

async function seed(t: ReturnType<typeof createTestContext>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("caseStatusAlerts", {
      email: "person@example.com",
      caseNumber: "g-100-26125-868956 ",
      createdAt: Date.now(),
      confirmedAt: Date.now(),
    });
    // Unconfirmed: never handed over.
    await ctx.db.insert("caseStatusAlerts", {
      email: "other@example.com",
      caseNumber: "G-100-26125-000001",
      createdAt: Date.now(),
    });
  });
}

describe("the watched-case routes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("are off, not open, when no secret is set", async () => {
    vi.stubEnv("WATCHED_CASES_SECRET", "");
    const t = createTestContext();
    const res = await t.fetch("/watched-cases", { headers: { "x-watched-secret": "anything" } });
    expect(res.status).toBe(503);
    const sweep = await t.fetch("/watched-cases/sweep", { method: "POST" });
    expect(sweep.status).toBe(503);
  });

  it("refuse a missing or wrong secret", async () => {
    vi.stubEnv("WATCHED_CASES_SECRET", SECRET);
    const t = createTestContext();
    await seed(t);
    expect((await t.fetch("/watched-cases")).status).toBe(401);
    const wrong = await t.fetch("/watched-cases", { headers: { "x-watched-secret": `${SECRET}x` } });
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).not.toContain("G-100");
    const sweep = await t.fetch("/watched-cases/sweep", { method: "POST", headers: { "x-watched-secret": "nope" } });
    expect(sweep.status).toBe(401);
  });

  it("hand over confirmed case numbers only, with the right secret", async () => {
    vi.stubEnv("WATCHED_CASES_SECRET", SECRET);
    const t = createTestContext();
    await seed(t);
    const res = await t.fetch("/watched-cases", { headers: { "x-watched-secret": SECRET } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: true, caseNumbers: ["G-100-26125-868956"], capped: false });
    expect(body, "no address ever leaves Convex").not.toContain("@");
  });

  it("schedule the email, push and webhook sweeps on a sweep request", async () => {
    vi.stubEnv("WATCHED_CASES_SECRET", SECRET);
    const t = createTestContext();
    const res = await t.fetch("/watched-cases/sweep", { method: "POST", headers: { "x-watched-secret": SECRET } });
    expect(res.status).toBe(202);
    const jobs = await t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.map((j) => j.name).sort()).toEqual([
      "caseAlerts:sweepCaseChanges",
      "casePushAlertsSweep:sweep",
      "webhookSweeps:sweepCaseWatches",
    ]);
  });
});
