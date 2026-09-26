/**
 * Employer follows and the one-email-a-day delivery path.
 *
 * Two features that only make sense together: following an employer is the
 * first alert kind people will hold several of at once, and the delivery path
 * is what stops several follows turning into several emails a day. The tests
 * that matter most are the ones a green first day would hide: a move told
 * twice, a move from before the follow, a stranger's words in someone else's
 * inbox, an opt-out that still leaves a queued email to go out.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";
import { etDay } from "../lib/alertDelivery";
import { bundleSubject } from "../alertOutbox";
import { employerSubject, unheard } from "../employerAlerts";

const SECRET = "test-unsubscribe-secret";
const originalFetch = global.fetch;

type T = ReturnType<typeof createTestContext>;

function isoMinus(days: number): string {
  const d = new Date(`${etDay(Date.now())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function cellOf(v: string | number | null) {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}
function hrana(rows: Record<string, string | number | null>[]) {
  const cols = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return {
    type: "ok",
    response: {
      type: "execute",
      result: { cols: cols.map((name) => ({ name })), rows: rows.map((r) => cols.map((c) => cellOf(r[c] ?? null))) },
    },
  };
}

interface Fixture {
  names?: Record<string, string>;
  holdMoves?: { date: string; name: string; slug: string | null; dir: "on" | "off"; to: string; n: number }[];
  decisionMoves?: { date: string; name: string; slug: string | null; to: string; n: number }[];
  resendStatus?: number;
}

/** Turso answers from the fixture; Resend records every send. */
function stub(f: Fixture) {
  const sends: Record<string, unknown>[] = [];
  const doc = {
    asOf: etDay(Date.now()),
    pendingTotal: 250,
    nationwide: { "ANALYST REVIEW": 30, "APPLICATION ON HOLD": 216, "RECONSIDERATION APPEALS": 4 },
    minPending: 5,
    employers: [
      {
        name: "Adobe Inc.",
        slug: "adobe-inc",
        pending: 250,
        review: 220,
        share: 0.88,
        byStatus: { "ANALYST REVIEW": 30, "APPLICATION ON HOLD": 216, "RECONSIDERATION APPEALS": 4 },
      },
    ],
    logFrom: "2026-08-27",
    holdMoves: f.holdMoves ?? [],
    decisionMoves: f.decisionMoves ?? [],
  };
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(init?.body ?? "{}") as {
        requests: { type: string; stmt?: { sql: string; args?: { value?: string }[] } }[];
      };
      const results = body.requests.map((req) => {
        if (req.type !== "execute" || !req.stmt) return { type: "ok", response: { type: "close" } };
        const sql = req.stmt.sql;
        const arg = req.stmt.args?.[0]?.value ?? "";
        if (sql.includes("FROM perm_docs")) return hrana([{ json: JSON.stringify(doc), computed_at: Date.now() }]);
        if (sql.includes("FROM perm_entities")) {
          const n = f.names?.[arg];
          return hrana(n ? [{ name: n }] : []);
        }
        if (sql.includes("FROM perm_live_only_index")) return hrana([]);
        return hrana([]);
      });
      return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const body = init?.body ? JSON.parse(init.body) : {};
    // Confirmations scheduled by an EARLIER test can land here, because the
    // harness runs scheduled functions in the background. Only alerts count.
    if (!String(body.subject ?? "").startsWith("Confirm:")) sends.push(body);
    const status = f.resendStatus ?? 200;
    if (status >= 400) {
      return new Response(JSON.stringify({ name: "rate_limit_exceeded", message: "stubbed failure" }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id: "stub" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { sends };
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

async function follow(t: T, email: string, slug = "adobe-inc", extra: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("employerAlerts", {
      email,
      slug,
      employerName: slug === "adobe-inc" ? "Adobe Inc." : "Maplebear Inc.",
      createdAt: Date.now(),
      confirmedAt: Date.now(),
      followingFrom: isoMinus(10),
      ...extra,
    }),
  );
}

const hold = (daysAgo: number, slug = "adobe-inc", n = 215) => ({
  date: isoMinus(daysAgo),
  name: slug === "adobe-inc" ? "Adobe Inc." : "Maplebear Inc.",
  slug,
  dir: "on" as const,
  to: "APPLICATION ON HOLD",
  n,
});

describe("the HTTP route takes the employer's name from our records", () => {
  it("refuses a slug we do not hold, and stages one we do under OUR name", async () => {
    const t = createTestContext();
    stub({ names: { "adobe-inc": "Adobe Inc." } });

    const bad = await t.fetch("/employer-alert/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", slug: "no-such-employer" }),
    });
    expect(bad.status).toBe(400);

    const injected = await t.fetch("/employer-alert/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", slug: "<script>" }),
    });
    expect(injected.status).toBe(400);

    const ok = await t.fetch("/employer-alert/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "A@Example.com", slug: "adobe-inc", employerName: "Click here to claim a prize" }),
    });
    expect(ok.status).toBe(200);
    const rows = await t.run(async (ctx) => ctx.db.query("employerAlerts").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("a@example.com");
    expect(rows[0]!.pendingName).toBe("Adobe Inc.");
    expect(rows[0]!.confirmedAt).toBeUndefined();
  });
});

describe("consent", () => {
  it("confirms only what a fresh request staged, and an unsubscribe token cannot confirm", async () => {
    const t = createTestContext();
    stub({});
    await t.mutation(internal.employerAlerts.subscribe, {
      email: "b@example.com",
      slug: "adobe-inc",
      employerName: "Adobe Inc.",
    });
    const wrong = await makeUnsubscribeToken("b@example.com", SECRET, "employer-unsubscribe");
    expect(await t.mutation(internal.employerAlerts.confirmByToken, { token: wrong })).toBeNull();

    const token = await makeUnsubscribeToken("b@example.com", SECRET, "employer-confirm");
    const first = await t.mutation(internal.employerAlerts.confirmByToken, { token });
    expect(first?.employers).toEqual(["Adobe Inc."]);
    expect(await t.mutation(internal.employerAlerts.confirmByToken, { token })).toBeNull();

    const off = await makeUnsubscribeToken("b@example.com", SECRET, "employer-unsubscribe");
    expect(await t.mutation(internal.employerAlerts.unsubscribeByToken, { token: off })).toBe(true);
    // A replayed confirm link cannot bring it back.
    expect(await t.mutation(internal.employerAlerts.confirmByToken, { token })).toBeNull();
    const row = await t.run(async (ctx) => ctx.db.query("employerAlerts").first());
    expect(row?.unsubscribedAt).toBeDefined();
  });

  it("draws confirmations from the case confirmations' budget, so the Resend arithmetic is unchanged", async () => {
    const t = createTestContext();
    stub({});
    let refused = 0;
    for (let i = 0; i < 20; i++) {
      const r = await t.mutation(internal.employerAlerts.subscribe, {
        email: `p${i}@example.com`,
        slug: "adobe-inc",
        employerName: "Adobe Inc.",
      });
      if (r.throttled) refused += 1;
    }
    expect(refused).toBe(5);
    const charges = await t.run(async (ctx) =>
      (await ctx.db.query("rateLimits").collect()).filter((r) => r.action === "case_subscribe_global").length,
    );
    expect(charges).toBe(15);
    // The five turned away are counted, for the admin panel's upgrade signal.
    const noted = await t.run(async (ctx) => ctx.db.query("budgetRefusals").take(10));
    expect(noted.map((r) => [r.pool, r.count])).toEqual([["caseConfirm", 5]]);
  });
});

describe("the change detector", () => {
  it("tells a follower each move once", async () => {
    const t = createTestContext();
    const { sends } = stub({ holdMoves: [hold(1)] });
    await follow(t, "c@example.com");

    const first = await t.action(internal.employerAlerts.sweep, {});
    expect(first.sent).toBe(1);
    expect(sends).toHaveLength(1);
    expect(String(sends[0]!.subject)).toBe("Adobe Inc.: DOL put 215 of its cases on hold");
    const headers = sends[0]!.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toContain("/employer-alert/unsubscribe");

    const second = await t.action(internal.employerAlerts.sweep, {});
    expect(second.sent + second.queued).toBe(0);
    expect(sends).toHaveLength(1);
  });

  it("stays silent on a move older than the freshness window or before the follow began", async () => {
    const t = createTestContext();
    const { sends } = stub({ holdMoves: [hold(6), hold(2, "maplebear-inc", 14)] });
    await follow(t, "d@example.com");
    await follow(t, "e@example.com", "maplebear-inc", { followingFrom: isoMinus(0) });
    const r = await t.action(internal.employerAlerts.sweep, {});
    expect(r.sent + r.queued).toBe(0);
    expect(sends).toHaveLength(0);
  });

  it("leaves a move unheard when the send fails, so the next sweep retries", async () => {
    const t = createTestContext();
    stub({ holdMoves: [hold(1)], resendStatus: 500 });
    const id = await follow(t, "f@example.com");
    const r = await t.action(internal.employerAlerts.sweep, {});
    expect(r.failed).toBe(1);
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.toldMoves ?? []).toEqual([]);
  });

  it("names who acted and gives no reason", async () => {
    const t = createTestContext();
    const { sends } = stub({
      decisionMoves: [{ date: isoMinus(1), name: "Adobe Inc.", slug: "adobe-inc", to: "WITHDRAWN", n: 12 }],
    });
    await follow(t, "g@example.com");
    await t.action(internal.employerAlerts.sweep, {});
    const text = String(sends[0]!.text);
    expect(text).toContain("12 of its cases were withdrawn by the employer");
    expect(text).not.toMatch(/DOL withdrew/i);
    expect(text).not.toMatch(/\b(?:suspended|investigat|fraud|audit(?:ed|ing) by)\b/i);
  });

  it("unheard() filters told keys and the follow date", () => {
    const moves = [
      { key: "k1", date: "2026-09-24", slug: "a", name: "A", sentence: "s", tone: "bad" as const, n: 5 },
      { key: "k2", date: "2026-09-20", slug: "a", name: "A", sentence: "s", tone: "bad" as const, n: 5 },
    ];
    expect(unheard(moves, ["k1"], undefined).map((m) => m.key)).toEqual(["k2"]);
    expect(unheard(moves, [], "2026-09-22").map((m) => m.key)).toEqual(["k1"]);
  });
});

describe("one email a day, whatever the address follows", () => {
  it("queues rather than sends for an address that follows two things, then sends ONE bundle", async () => {
    const t = createTestContext();
    const { sends } = stub({ holdMoves: [hold(1), hold(1, "maplebear-inc", 14)] });
    await follow(t, "h@example.com");
    await follow(t, "h@example.com", "maplebear-inc");

    const r = await t.action(internal.employerAlerts.sweep, {});
    expect(r.sent).toBe(0);
    expect(r.queued).toBe(2);
    expect(sends).toHaveLength(0);

    const b = await t.action(internal.alertOutbox.sendBundles, {});
    expect(b).toMatchObject({ emails: 1, items: 2, failed: 0 });
    expect(sends).toHaveLength(1);
    const headers = sends[0]!.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toContain("/prefs/unsubscribe");
    expect(headers["List-Unsubscribe"]).toContain("kind=alerts");
    expect(String(sends[0]!.text)).toContain("Adobe Inc.");
    expect(String(sends[0]!.text)).toContain("Maplebear Inc.");

    // A second run the same day sends nothing more.
    const again = await t.action(internal.alertOutbox.sendBundles, {});
    expect(again.emails).toBe(0);
    expect(sends).toHaveLength(1);
  });

  it("holds an address already mailed today until tomorrow", async () => {
    const t = createTestContext();
    const { sends } = stub({ holdMoves: [hold(1)] });
    await follow(t, "i@example.com");
    await t.run(async (ctx) =>
      ctx.db.insert("alertRecipients", {
        email: "i@example.com",
        lastSentDay: etDay(Date.now()),
        lastSentAt: Date.now(),
        emailsSent: 1,
      }),
    );
    const r = await t.action(internal.employerAlerts.sweep, {});
    expect(r.queued).toBe(1);
    const b = await t.action(internal.alertOutbox.sendBundles, {});
    expect(b).toMatchObject({ emails: 0, held: 1 });
    expect(sends).toHaveLength(0);
  });

  it("drops what is waiting when the person opts out before the bundle goes", async () => {
    const t = createTestContext();
    const { sends } = stub({ holdMoves: [hold(1), hold(1, "maplebear-inc", 14)] });
    await follow(t, "j@example.com");
    await follow(t, "j@example.com", "maplebear-inc");
    await t.action(internal.employerAlerts.sweep, {});
    const off = await makeUnsubscribeToken("j@example.com", SECRET, "employer-unsubscribe");
    await t.mutation(internal.employerAlerts.unsubscribeByToken, { token: off });
    const b = await t.action(internal.alertOutbox.sendBundles, {});
    expect(b.emails).toBe(0);
    expect(sends).toHaveLength(0);
    const statuses = await t.run(async (ctx) => (await ctx.db.query("alertOutbox").collect()).map((r) => r.status));
    expect(statuses).toEqual(["dropped", "dropped"]);
  });

  it("the bundle's one-click turns every alert kind off and nothing else", async () => {
    const t = createTestContext();
    stub({});
    await follow(t, "k@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", {
        email: "k@example.com",
        caseNumber: "G-100-26125-868956",
        createdAt: Date.now(),
        confirmedAt: Date.now(),
      });
      await ctx.db.insert("newsSubscribers", { email: "k@example.com", createdAt: Date.now(), confirmedAt: Date.now() });
    });
    const token = await makeUnsubscribeToken("k@example.com", SECRET, "prefs");
    const res = await t.fetch(`/prefs/unsubscribe?token=${encodeURIComponent(token)}&kind=alerts`, { method: "POST" });
    expect(res.status).toBe(200);
    const state = await t.run(async (ctx) => ({
      employer: await ctx.db.query("employerAlerts").first(),
      kase: await ctx.db.query("caseStatusAlerts").first(),
      news: await ctx.db.query("newsSubscribers").first(),
    }));
    expect(state.employer?.unsubscribedAt).toBeDefined();
    expect(state.kase?.unsubscribedAt).toBeDefined();
    expect(state.news?.unsubscribedAt).toBeUndefined();
  });

  it("gives up on an item after repeated failures and records it", async () => {
    const t = createTestContext();
    stub({ resendStatus: 500 });
    await t.run(async (ctx) => {
      for (const ref of ["case:a", "employer:b"]) {
        await ctx.db.insert("alertOutbox", {
          email: "l@example.com",
          kind: ref.startsWith("case") ? "case" : "employer",
          ref,
          status: "queued",
          subject: "s",
          text: "t",
          listUnsubscribe: "https://permtracker.app/x",
          summary: { title: "T", line: "L", url: "https://permtracker.app" },
          createdAt: Date.now(),
          attempts: 0,
        });
      }
    });
    for (let i = 0; i < 6; i++) await t.action(internal.alertOutbox.sendBundles, {});
    const rows = await t.run(async (ctx) => ctx.db.query("alertOutbox").collect());
    expect(rows.map((r) => r.status)).toEqual(["failed", "failed"]);
    expect(rows[0]!.attempts).toBe(6);
  });
});

describe("subjects stay inside an inbox line", () => {
  it("bundleSubject leads with the first item and falls back when long", () => {
    const one = { summary: { title: "Adobe Inc.", line: "DOL put 215 of its cases on hold" } };
    expect(bundleSubject([one, one])).toBe("Adobe Inc.: DOL put 215 of its cases on hold, and 1 more update");
    const long = { summary: { title: "A".repeat(60), line: "B".repeat(40) } };
    expect(bundleSubject([long, long, long])).toBe("3 updates from PERM Tracker");
  });

  it("employerSubject keeps to 78 characters", () => {
    const m = (sentence: string) => ({ key: "k", date: "2026-09-24", slug: "x", name: "X", sentence, tone: "bad" as const, n: 5 });
    expect(employerSubject("Adobe Inc.", [m("DOL put 215 of its cases on hold")])).toBe(
      "Adobe Inc.: DOL put 215 of its cases on hold",
    );
    const s = employerSubject("A Very Long Employer Name Holdings International Corporation", [
      m("DOL took 201 of its cases off hold, back to analyst review"),
      m("DOL certified 44 of its cases"),
    ]);
    expect(s.length).toBeLessThanOrEqual(78);
  });
});
