/**
 * PERM month alerts from our own daily check of DOL's case status (queueAlerts.sweepPermFromCheck).
 *
 * DOL's processing-times page stopped printing a filing month on Oct 31 2026, so the alerts people signed up
 * for ("email me when DOL reaches my month") are swept against the month our check names instead. The census is
 * mocked at the mirror; the subscriptions, the DOL snapshot and the send are real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const one = vi.fn();
vi.mock("../lib/publicMirror", () => ({ one, rows: vi.fn(), query: vi.fn(), placeholders: vi.fn() }));

const { createTestContext } = await import("../../test-utils/convex");
const { internal } = await import("../_generated/api");
const { easternDay } = await import("../lib/time");

const originalFetch = global.fetch;

/** Resend's HTTP call, keeping each body. */
function stubResend() {
  const bodies: Array<Record<string, unknown>> = [];
  global.fetch = (async (_url: unknown, init?: { body?: string }) => {
    bodies.push(init?.body ? JSON.parse(init.body) : {});
    return new Response(JSON.stringify({ id: "stub" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return bodies;
}

/** A census where January 2026 is the oldest busy month under half decided. */
const census = (asOf: string) => ({
  json: JSON.stringify({
    asOf,
    matrix: [
      { month: "2025-12", status: "CERTIFIED", is_final: 1, n: 900 },
      { month: "2025-12", status: "ANALYST REVIEW", is_final: 0, n: 100 },
      { month: "2026-01", status: "CERTIFIED", is_final: 1, n: 300 },
      { month: "2026-01", status: "ANALYST REVIEW", is_final: 0, n: 700 },
      { month: "2026-02", status: "ANALYST REVIEW", is_final: 0, n: 1000 },
    ],
  }),
});

async function seed(t: ReturnType<typeof createTestContext>, permQueues: { queue: string; priorityDate: string | null; raw: string }[]) {
  await t.run(async (ctx) => {
    await ctx.db.insert("dolProcessingTimes", {
      permAsOf: "2026-10-31",
      permQueues,
      permAverageDays: [{ determination: "Analyst Review", month: null, period: "Last 30 Days", calendarDays: 300, raw: "300" }],
      pwdQueues: [],
      pwdPermBacklog: [],
      sourceUrl: "https://flag.dol.gov/processingtimes",
      fetchedAt: Date.now(),
      contentHash: "h",
    });
    for (const [email, filingMonth] of [
      ["reached@example.com", "2026-01"],
      ["earlier@example.com", "2025-12"],
      ["later@example.com", "2026-02"],
    ] as const) {
      await ctx.db.insert("dolQueueAlerts", { email, filingMonth, confirmedAt: 1, createdAt: Date.now() });
    }
  });
}

beforeEach(() => {
  one.mockReset();
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-unsubscribe-secret");
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("sweepPermFromCheck", () => {
  it("alerts everyone whose month our check has reached, naming our check as the source", async () => {
    const t = createTestContext();
    await seed(t, []);
    one.mockResolvedValue(census(easternDay()));
    const bodies = stubResend();

    const res = await t.action(internal.queueAlerts.sweepPermFromCheck, {});

    expect(res).toEqual({ swept: true, reason: "line at 2026-01" });
    const to = bodies.map((b) => String(b.to)).sort();
    expect(to).toEqual(["earlier@example.com", "reached@example.com"]);
    const mail = bodies.find((b) => b.to === "reached@example.com")!;
    expect(String(mail.subject)).toBe("DOL has reached January 2026 in the PERM queue");
    expect(String(mail.text)).toContain("our daily check of DOL's case status");
    expect(String(mail.text)).not.toContain("flag.dol.gov/processingtimes");
    expect(String(mail.html)).toContain("permtracker.app/perm-queue");
    const rows = await t.run(async (ctx) => ctx.db.query("dolQueueAlerts").collect());
    expect(rows.find((r) => r.email === "later@example.com")?.notifiedAt).toBeUndefined();
    expect(rows.find((r) => r.email === "reached@example.com")?.notifiedAt).toBeDefined();
  });

  it("sends nothing twice when it runs again", async () => {
    const t = createTestContext();
    await seed(t, []);
    one.mockResolvedValue(census(easternDay()));
    stubResend();
    await t.action(internal.queueAlerts.sweepPermFromCheck, {});
    const again = stubResend();
    await t.action(internal.queueAlerts.sweepPermFromCheck, {});
    expect(again).toEqual([]);
  });

  it("stands down while DOL's reading still carries a month", async () => {
    const t = createTestContext();
    await seed(t, [{ queue: "Analyst Review", priorityDate: "2026-01", raw: "January 2026" }]);
    one.mockResolvedValue(census(easternDay()));
    const bodies = stubResend();

    expect(await t.action(internal.queueAlerts.sweepPermFromCheck, {})).toEqual({ swept: false, reason: "DOL prints a month" });
    expect(bodies).toEqual([]);
    expect(one).not.toHaveBeenCalled();
  });

  it("sends nothing from a census that is missing or too old", async () => {
    const t = createTestContext();
    await seed(t, []);
    const bodies = stubResend();

    one.mockResolvedValue(null);
    expect((await t.action(internal.queueAlerts.sweepPermFromCheck, {})).reason).toBe("no census");
    one.mockResolvedValue(census("2026-01-01"));
    expect((await t.action(internal.queueAlerts.sweepPermFromCheck, {})).reason).toBe("census too old");
    expect(bodies).toEqual([]);
  });
});
