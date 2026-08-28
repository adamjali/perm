/**
 * Unified email preferences, product-news consent, PWD queue rows, and the
 * visa-bulletin alert lifecycle.
 *
 * Same doctrine as caseAlerts.test.ts: the modules that send real email to
 * real people from unauthenticated endpoints are the ones that need tests.
 * The consent rules get the most coverage because every one of them encodes
 * a defect that has either shipped in a sibling or is one bad line away:
 * resurrection via replayed links, cross-address cancellation, a sweep that
 * mails the current value instead of a movement.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

const SECRET = "test-unsubscribe-secret";
const originalFetch = global.fetch;

function cellOf(v: string | number | null) {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}

function hranaResult(rows: Record<string, string | number | null>[]) {
  const cols = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return {
    type: "ok",
    response: {
      type: "execute",
      result: {
        cols: cols.map((name) => ({ name })),
        rows: rows.map((r) => cols.map((c) => cellOf(r[c] ?? null))),
      },
    },
  };
}

/** The bulletin the mocked Turso mirror serves, mutable per test. */
const bulletin = {
  month: "2026-09",
  finalAction: { EB2: { worldwide: "C", india: "01SEP21" } } as Record<
    string,
    Record<string, string>
  >,
};

/** Resend sends observed by the stub. */
let resendSends: { to: string; subject: string }[] = [];

function stubFetch() {
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(init?.body ?? "{}") as {
        requests: { type: string; stmt?: { sql: string } }[];
      };
      const results = body.requests.map((req) => {
        if (req.type !== "execute" || !req.stmt) {
          return { type: "ok", response: { type: "close" } };
        }
        const sql = req.stmt.sql.replace(/\s+/g, " ");
        if (sql.includes("FROM visa_bulletins")) {
          return hranaResult([
            {
              bulletin_month: bulletin.month,
              final_action: JSON.stringify(bulletin.finalAction),
            },
          ]);
        }
        return hranaResult([]);
      });
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (href.includes("api.resend.com")) {
      const body = JSON.parse(init?.body ?? "{}") as { to?: string; subject?: string };
      resendSends.push({ to: String(body.to), subject: String(body.subject) });
      return new Response(JSON.stringify({ id: `email_${resendSends.length}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected fetch in test: ${href}`);
  }) as typeof fetch;
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
  resendSends = [];
  bulletin.month = "2026-09";
  bulletin.finalAction = { EB2: { worldwide: "C", india: "01SEP21" } };
  stubFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const EMAIL = "person@example.com";

describe("product-news consent", () => {
  it("stages unconfirmed, confirms on an alert confirm, and stays inert without a stage", async () => {
    const t = createTestContext();

    // No stage: confirm is a no-op, no row invented.
    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });
    let row = await t.run(async (ctx) =>
      ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row).toBeNull();

    await t.mutation(internal.emailPrefs.stageNews, { email: EMAIL, source: "test" });
    row = await t.run(async (ctx) =>
      ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row).not.toBeNull();
    expect(row!.confirmedAt).toBeUndefined();

    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });
    row = await t.run(async (ctx) =>
      ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row!.confirmedAt).toBeDefined();
  });

  it("does not resurrect an opt-out from a replayed confirm; a fresh stage re-arms it", async () => {
    const t = createTestContext();
    await t.mutation(internal.emailPrefs.stageNews, { email: EMAIL });
    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });

    // Opt out.
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "prefs");
    await t.mutation(internal.emailPrefs.disableByToken, { token, kind: "news" });

    // Replayed confirm (an old link a scanner clicked): stays out.
    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });
    let row = await t.run(async (ctx) =>
      ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row!.unsubscribedAt).toBeDefined();

    // A fresh checkbox tick (stage) followed by a confirm: back on.
    await t.mutation(internal.emailPrefs.stageNews, { email: EMAIL });
    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });
    row = await t.run(async (ctx) =>
      ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row!.unsubscribedAt).toBeUndefined();
    expect(row!.confirmedAt).toBeDefined();
  });
});

describe("PWD queue rows on dolQueueAlerts", () => {
  it("keeps one row per (address, queue) and confirms all of them with one click", async () => {
    const t = createTestContext();
    await t.mutation(internal.queueAlerts.subscribe, {
      email: EMAIL,
      filingMonth: "2025-06",
      ip: "unknown",
    });
    await t.mutation(internal.queueAlerts.subscribe, {
      email: EMAIL,
      filingMonth: "2026-01",
      queue: "pwd-oews",
      ip: "unknown",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .collect(),
    );
    expect(rows).toHaveLength(2);

    const token = await makeUnsubscribeToken(EMAIL, SECRET, "queue-confirm");
    const result = await t.mutation(internal.queueAlerts.confirmByToken, { token });
    expect(result).not.toBeNull();

    const confirmed = await t.run(async (ctx) =>
      ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .collect(),
    );
    expect(confirmed.every((r) => r.confirmedAt !== undefined)).toBe(true);
  });

  it("sweeps each queue against its own frontier only", async () => {
    const t = createTestContext();
    await t.mutation(internal.queueAlerts.subscribe, {
      email: EMAIL,
      filingMonth: "2025-06",
      ip: "unknown",
    });
    await t.mutation(internal.queueAlerts.subscribe, {
      email: EMAIL,
      filingMonth: "2025-06",
      queue: "pwd-oews",
      ip: "unknown",
    });
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "queue-confirm");
    await t.mutation(internal.queueAlerts.confirmByToken, { token });

    // The PERM frontier has reached 2025-06; the PWD sweep must not pick the
    // PERM row up, and vice versa.
    const permDue = await t.query(internal.queueAlerts.dueForAlert, {
      frontier: "2025-06",
      limit: 10,
      queue: "perm",
    });
    expect(permDue).toHaveLength(1);
    const pwdDue = await t.query(internal.queueAlerts.dueForAlert, {
      frontier: "2025-06",
      limit: 10,
      queue: "pwd-oews",
    });
    expect(pwdDue).toHaveLength(1);
    expect(pwdDue[0]!._id).not.toEqual(permDue[0]!._id);
  });
});

describe("the preference center", () => {
  it("never touches a row belonging to a different address, even with its id", async () => {
    const t = createTestContext();
    const other = "someone-else@example.com";
    await t.mutation(internal.queueAlerts.subscribe, {
      email: other,
      filingMonth: "2025-03",
      ip: "unknown",
    });
    const otherRow = await t.run(async (ctx) =>
      ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_email", (q) => q.eq("email", other))
        .first(),
    );

    const token = await makeUnsubscribeToken(EMAIL, SECRET, "prefs");
    await t.mutation(internal.emailPrefs.disableByToken, {
      token,
      kind: "queue",
      id: otherRow!._id,
    });

    const after = await t.run(async (ctx) => ctx.db.get(otherRow!._id));
    expect(after!.unsubscribedAt).toBeUndefined();
  });

  it("unsubscribe-all tombstones every alert kind and the news row", async () => {
    const t = createTestContext();
    await t.mutation(internal.queueAlerts.subscribe, {
      email: EMAIL,
      filingMonth: "2025-06",
      ip: "unknown",
    });
    await t.mutation(internal.bulletinAlerts.subscribe, {
      email: EMAIL,
      category: "EB2",
      country: "india",
      ip: "unknown",
    });
    await t.mutation(internal.emailPrefs.stageNews, { email: EMAIL });
    await t.mutation(internal.emailPrefs.confirmNewsForEmail, { email: EMAIL });

    const token = await makeUnsubscribeToken(EMAIL, SECRET, "prefs");
    const state = await t.mutation(internal.emailPrefs.unsubscribeAllByToken, { token });
    expect(state).not.toBeNull();
    expect(state!.news).toBe(false);
    expect(state!.queueAlerts.every((a) => !a.active)).toBe(true);
    expect(state!.bulletinAlerts.every((a) => !a.active)).toBe(true);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .collect(),
    );
    expect(rows.every((r) => r.unsubscribedAt !== undefined)).toBe(true);
  });
});

describe("bulletin alerts", () => {
  async function confirmedSub(t: ReturnType<typeof createTestContext>) {
    await t.mutation(internal.bulletinAlerts.subscribe, {
      email: EMAIL,
      category: "EB2",
      country: "india",
      ip: "unknown",
    });
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "bulletin-confirm");
    const confirmed = await t.mutation(internal.bulletinAlerts.confirmByToken, { token });
    expect(confirmed).not.toBeNull();
  }

  it("baselines silently on the first sweep, then mails only a real movement", async () => {
    const t = createTestContext();
    await confirmedSub(t);

    // Confirmation emails from other tests' zero-delay scheduled sends drain
    // in the background and can land in `resendSends` mid-test, so movement
    // assertions count ALERT sends by their subject rather than the whole
    // array - the alert subject exists nowhere else.
    const alertSends = () =>
      resendSends.filter((s) => s.subject.includes("moved in the"));

    // First sweep: baseline, no send - the subscriber saw the current value
    // when they subscribed.
    let out = await t.action(internal.bulletinAlerts.sweep, {});
    expect(out.baselined).toBe(1);
    expect(out.sent).toBe(0);
    expect(alertSends()).toHaveLength(0);

    // A new bulletin that does NOT move the series: month stamp advances,
    // nothing is sent.
    bulletin.month = "2026-10";
    out = await t.action(internal.bulletinAlerts.sweep, {});
    expect(out.sent).toBe(0);
    expect(alertSends()).toHaveLength(0);

    // A new bulletin that moves it: exactly one email.
    bulletin.month = "2026-11";
    bulletin.finalAction = { EB2: { worldwide: "C", india: "01NOV21" } };
    out = await t.action(internal.bulletinAlerts.sweep, {});
    expect(out.sent).toBe(1);
    expect(alertSends()).toHaveLength(1);
    expect(alertSends()[0]!.subject).toContain("EB2 India");

    // Same bulletin again: no repeat.
    out = await t.action(internal.bulletinAlerts.sweep, {});
    expect(out.sent).toBe(0);
    expect(alertSends()).toHaveLength(1);
  });

  it("does not resurrect an unsubscribed series via a replayed confirm link", async () => {
    const t = createTestContext();
    await confirmedSub(t);

    const unsub = await makeUnsubscribeToken(EMAIL, SECRET, "bulletin-unsubscribe");
    expect(await t.mutation(internal.bulletinAlerts.unsubscribeByToken, { token: unsub })).toBe(
      true,
    );

    const confirm = await makeUnsubscribeToken(EMAIL, SECRET, "bulletin-confirm");
    const replayed = await t.mutation(internal.bulletinAlerts.confirmByToken, {
      token: confirm,
    });
    expect(replayed).toBeNull();

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("bulletinAlerts")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .first(),
    );
    expect(row!.unsubscribedAt).toBeDefined();
  });
});
