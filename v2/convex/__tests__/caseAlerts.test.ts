/**
 * Per-case status alert tests.
 *
 * Every test here covers a defect that is either live in a sibling module's
 * history or one bad line away in this one. The shape of the file follows the
 * lesson from the queue-alert review: the module that sends real email to real
 * people from an unauthenticated endpoint is the one that needs the tests, not
 * the pure function next to it that happens to be easy to test.
 *
 * The change detector gets the most coverage because it is the whole feature.
 * A detector that fires on every sweep and a detector that never fires both
 * look like "it works" from the outside for the first day.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

const SECRET = "test-unsubscribe-secret";
const CASE = "P-100-26125-868956";
const originalFetch = global.fetch;

/** One Hrana cell. Integers travel as strings, exactly as libSQL sends them. */
function cellOf(v: string | number | null) {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}

/** One Hrana `execute` result from an array of plain row objects. */
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

interface MirrorFixture {
  /**
   * Case number to its current row in `perm_case_status`.
   *
   * `lastCheckedAt` is an ISO-8601 STRING, matching the real column. It is the
   * UPSTREAM's check time, not ours, and 11,955 pending rows carry none, so
   * `null` is a first-class fixture value rather than an edge case.
   */
  cases: Record<
    string,
    { status: string; isFinal: boolean; lastCheckedAt?: string | null }
  >;
}

/**
 * Route both outbound calls this module makes: Turso and Resend.
 *
 * Turso is answered by inspecting the SQL, which is crude and is the right
 * amount of machinery here: the alternative is a second fake database, and the
 * thing under test is the comparison, not the SQL.
 */
function stubMirrorAndResend(fixture: MirrorFixture, resendStatus = 200) {
  const sends: Record<string, unknown>[] = [];

  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    const href = String(url);

    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(init?.body ?? "{}") as {
        requests: { type: string; stmt?: { sql: string; args?: unknown[] } }[];
      };
      const results = body.requests.map((req) => {
        if (req.type !== "execute" || !req.stmt) return { type: "ok", response: { type: "close" } };
        const sql = req.stmt.sql.replace(/\s+/g, " ");

        if (sql.includes("FROM data_freshness")) {
          return hranaResult([{ as_of: "2026-08-26" }]);
        }
        if (sql.includes("FROM rfi_funnel")) {
          return hranaResult([
            {
              total_tracked: 211719,
              rfi_resolved: 2151,
              rfi_certified: 1799,
              rfi_denied: 210,
              rfi_withdrawn: 142,
              observed_at: 1787801119434,
            },
          ]);
        }
        if (sql.includes("FROM perm_entities")) {
          return hranaResult([]);
        }
        if (sql.includes("count(*) AS n FROM perm_case_status WHERE current_status")) {
          return hranaResult([{ n: 906 }]);
        }
        if (sql.includes("count(*) AS total")) {
          return hranaResult([{ total: 8172, decided: 273 }]);
        }
        if (sql.includes("is_final = 0 AND substr")) {
          return hranaResult([{ n: 70455 }]);
        }
        if (sql.includes("SELECT filing_date, employer_name, job_title")) {
          return hranaResult([
            {
              filing_date: "2026-05-05",
              employer_name: "Psomagen, Inc.",
              job_title: "Senior Biomedical Laboratory Technologist",
            },
          ]);
        }
        if (sql.includes("SELECT employer_name FROM perm_case_status")) {
          return hranaResult([{ employer_name: "Psomagen, Inc." }]);
        }
        // The batch read, and the confirmation's single-case read.
        const args = (req.stmt.args ?? []) as { value?: string }[];
        const wanted = args.map((a) => a.value ?? "");
        const rowsOut = wanted
          .filter((n) => fixture.cases[n] !== undefined)
          .map((n) => ({
            case_number: n,
            current_status: fixture.cases[n]!.status,
            is_final: fixture.cases[n]!.isFinal ? 1 : 0,
            employer_name: "Psomagen, Inc.",
            last_checked_at:
              fixture.cases[n]!.lastCheckedAt === undefined
                ? "2026-08-05T22:31:24"
                : fixture.cases[n]!.lastCheckedAt,
          }));
        return hranaResult(rowsOut);
      });
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Resend.
    const body = init?.body ? JSON.parse(init.body) : {};
    sends.push(body);
    if (resendStatus >= 400) {
      return new Response(
        JSON.stringify({ name: "rate_limit_exceeded", message: "stubbed failure" }),
        { status: resendStatus, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: "stub" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return { sends, alerts: () => sends.filter((s) => String(s.subject).includes("is now")) };
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

/**
 * How many confirmation sends the global budget has been charged for.
 *
 * One charge is one scheduled send, so this counts the mail that would go out
 * without needing to drive the scheduler, which the harness only supports under
 * fake timers.
 */
async function globalCharges(t: ReturnType<typeof createTestContext>) {
  return await t.run(async (ctx) => {
    const all = await ctx.db.query("rateLimits").collect();
    return all.filter((r) => r.action === "case_subscribe_global").length;
  });
}

/**
 * Claims this product may never make about an individual case.
 *
 * Every one is an AFFIRMATIVE construction. "Prediction" on its own is not
 * bannable, because the alert's own disclaimer contains the word, and the
 * negated forms below are asserted to stay clean.
 */
const BANNED_CLAIMS: RegExp[] = [
  /\byour (?:case|application) (?:will|should|is likely|is expected)\b/i,
  /\b(?:we|our)\b[^.]{0,24}\b(?:predict|forecast)(?:s|ing)?\b(?![^.]{0,30}\bnot\b)/i,
  /\bour (?:prediction|forecast|estimate) (?:is|for)\b/i,
  /\bwe expect (?:a |an )?(?:decision|approval|certification|denial)\b/i,
  /\b\d+\s?% (?:chance|likely|likelihood|probability)\b/i,
  /\bthe odds\b/i,
  /\bestimated (?:decision|approval|certification) date\b/i,
];

/** A confirmed, live subscription sitting at `seen`. */
async function seededSubscription(
  t: ReturnType<typeof createTestContext>,
  email: string,
  seen: string | undefined,
  caseNumber = CASE,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("caseStatusAlerts", {
      email,
      caseNumber,
      createdAt: Date.now(),
      confirmedAt: Date.now(),
      ...(seen === undefined ? {} : { lastSeenStatus: seen }),
    });
  });
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("subscribe input validation", () => {
  it("rejects a long address without running the backtracking regex", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });

    /*
     * `[^\s@]` matches `.`, so `[^\s@]+\.[^\s@]{2,}$` backtracks
     * QUADRATICALLY on a long failing input: measured in V8 at 8.2 seconds for
     * 80k characters when the length check ran second, and 0.005 ms with it
     * first. `v.string()` accepts about a megabyte, so the ordering is what
     * stops an anonymous caller buying seconds of server compute per request.
     *
     * The assertion is a RATIO, not a wall-clock budget. A budget is a
     * measurement of the machine as much as of the code: this test's first
     * version asserted under 1s, passed at 201ms alone, and failed at 1459ms
     * with four test files running concurrently. Nothing about the guard had
     * changed. The ratio cancels machine load and module-load overhead out of
     * both sides and measures the actual property, which is that cost does not
     * grow with input length.
     */
    const time = async (email: string) => {
      const started = performance.now();
      const res = await t.mutation(internal.caseAlerts.subscribe, {
        email,
        caseNumber: CASE,
      });
      return { ms: performance.now() - started, ok: res.ok };
    };

    // Warm up first, or the measurement includes a one-off module load that
    // lands entirely on whichever call happens to run first.
    await time("warmup@example.com");

    const short = await time("a@" + ".".repeat(200) + "@");
    const long = await time("a@" + ".".repeat(80_000) + "@");

    expect(short.ok).toBe(false);
    expect(long.ok).toBe(false);

    // 400x the input. Unguarded that is ~160,000x the work; guarded both are a
    // length check and the ratio sits near 1. Ten is far above the noise floor
    // and far below anything quadratic.
    const ratio = long.ms / Math.max(short.ms, 0.01);
    expect(
      ratio,
      `400x the input took ${ratio.toFixed(1)}x the time ` +
        `(${short.ms.toFixed(1)}ms then ${long.ms.toFixed(1)}ms)`,
    ).toBeLessThan(10);

    // A generous absolute backstop, so a machine slow enough to make both
    // sides equally terrible still fails rather than passing on the ratio.
    expect(long.ms).toBeLessThan(5_000);
  });

  it("rejects anything that is not a DOL case number", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    for (const caseNumber of [
      "",
      "hello",
      "P-100-26125",
      "12345678",
      "<script>alert(1)</script>",
      "P-100-26125-868956; DROP TABLE x",
    ]) {
      const res = await t.mutation(internal.caseAlerts.subscribe, {
        email: "a@example.com",
        caseNumber,
      });
      expect(res.ok, `should have rejected ${JSON.stringify(caseNumber)}`).toBe(false);
    }
  });

  it("normalises case and whitespace before storing", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    const res = await t.mutation(internal.caseAlerts.subscribe, {
      email: "  Person@Example.COM ",
      caseNumber: " p-100-26125-868956 ",
    });
    expect(res.ok).toBe(true);
    const stored = await t.run(async (ctx) => ctx.db.query("caseStatusAlerts").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0]!.email).toBe("person@example.com");
    expect(stored[0]!.caseNumber).toBe(CASE);
  });
});

// ---------------------------------------------------------------------------
// Abuse limits
// ---------------------------------------------------------------------------

describe("abuse limits", () => {
  it("stops one IP after five attempts even with a fresh address each time", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });

    const results = [];
    for (let i = 0; i < 8; i++) {
      results.push(
        await t.mutation(internal.caseAlerts.subscribe, {
          email: `person${i}@example.com`,
          caseNumber: CASE,
          ip: "203.0.113.9",
        }),
      );
    }
    // The per-address cooldown cannot catch this: every address is new.
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results.slice(5).every((r) => !r.ok)).toBe(true);
  });

  it("caps confirmations globally when BOTH the address and the IP rotate", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });

    // The scenario neither per-identity limit can touch: a fresh address and a
    // fresh IP on every single request. Only a budget on the shared resource
    // itself can stop this, which is why one exists.
    for (let i = 0; i < 30; i++) {
      await t.mutation(internal.caseAlerts.subscribe, {
        email: `rotator${i}@example.com`,
        caseNumber: CASE,
        ip: `198.51.100.${i}`,
      });
    }

    // Counted on the budget's own charges rather than on delivered mail: one
    // charge is exactly one scheduled confirmation, and it is observable
    // without driving the scheduler. 15 is CONFIRMATION_GLOBAL_BUDGET, so ~85
    // of Resend's shared 100/day stay available for password resets and OTP.
    expect(await globalCharges(t)).toBe(15);
  });

  it("does not let ten case numbers buy ten confirmation emails to one inbox", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });

    // The cooldown is keyed per ADDRESS, not per (address, case). Keyed per
    // case this loop would mail the same person ten times in one minute.
    for (let i = 0; i < 10; i++) {
      await t.mutation(internal.caseAlerts.subscribe, {
        email: "victim@example.com",
        caseNumber: `P-100-2612${i}-868956`,
        ip: `198.51.100.${i}`,
      });
    }
    expect(await globalCharges(t)).toBe(1);
  });

  it("refuses a 26th case on one address without saying so", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    await t.run(async (ctx) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("caseStatusAlerts", {
          email: "hoarder@example.com",
          caseNumber: `P-100-26125-8689${String(i).padStart(2, "0")}`,
          createdAt: Date.now(),
          confirmedAt: Date.now(),
        });
      }
    });

    const res = await t.mutation(internal.caseAlerts.subscribe, {
      email: "hoarder@example.com",
      caseNumber: "G-300-26237-193005",
      ip: "203.0.113.77",
    });
    // The reply is the same neutral string as every other outcome, so it can
    // never be used to probe what an address is watching.
    expect(res.ok).toBe(true);
    expect(res.message).toBe("Check your inbox to confirm.");

    const rows = await t.run(async (ctx) => ctx.db.query("caseStatusAlerts").collect());
    expect(rows).toHaveLength(25);
  });
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

describe("action tokens", () => {
  it("refuses an unsubscribe token replayed against the confirm route", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    await t.mutation(internal.caseAlerts.subscribe, {
      email: "person@example.com",
      caseNumber: CASE,
    });

    const wrong = await makeUnsubscribeToken(
      "person@example.com",
      SECRET,
      "case-unsubscribe",
    );
    expect(
      await t.mutation(internal.caseAlerts.confirmByToken, { token: wrong }),
    ).toBeNull();

    // And the correctly-scoped one still works, so the test above is measuring
    // the scoping rather than a broken token.
    const right = await makeUnsubscribeToken(
      "person@example.com",
      SECRET,
      "case-confirm",
    );
    expect(
      await t.mutation(internal.caseAlerts.confirmByToken, { token: right }),
    ).not.toBeNull();
  });

  it("cannot resurrect an opt-out by replaying an old confirm link", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    const email = "person@example.com";
    await t.mutation(internal.caseAlerts.subscribe, { email, caseNumber: CASE });

    const confirm = await makeUnsubscribeToken(email, SECRET, "case-confirm");
    const unsub = await makeUnsubscribeToken(email, SECRET, "case-unsubscribe");

    await t.mutation(internal.caseAlerts.confirmByToken, { token: confirm });
    expect(await t.mutation(internal.caseAlerts.unsubscribeByToken, { token: unsub })).toBe(true);

    // These tokens never expire and are readable by anyone who saw the email,
    // including a corporate link scanner. A valid one must NOT be treated as a
    // fresh act of consent.
    expect(await t.mutation(internal.caseAlerts.confirmByToken, { token: confirm })).toBeNull();
    const row = await t.run(async (ctx) => ctx.db.query("caseStatusAlerts").first());
    expect(row!.unsubscribedAt).toBeDefined();
  });

  it("one-click unsubscribe silences every case on the address", async () => {
    const t = createTestContext();
    stubMirrorAndResend({ cases: {} });
    const email = "person@example.com";
    await seededSubscription(t, email, "ANALYST REVIEW", "P-100-26125-868956");
    await seededSubscription(t, email, "ANALYST REVIEW", "G-300-26237-193005");

    const unsub = await makeUnsubscribeToken(email, SECRET, "case-unsubscribe");
    expect(await t.mutation(internal.caseAlerts.unsubscribeByToken, { token: unsub })).toBe(true);

    const rows = await t.run(async (ctx) => ctx.db.query("caseStatusAlerts").collect());
    // "Stop mailing me" in Gmail means every case, not the one that happened to
    // be in the message they clicked from.
    expect(rows.every((r) => r.unsubscribedAt !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The change detector
// ---------------------------------------------------------------------------

describe("the change detector", () => {
  it("sends nothing when the status has not moved", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "ANALYST REVIEW", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.checked).toBe(1);
    expect(res.sent).toBe(0);
    expect(alerts()).toHaveLength(0);
  });

  it("sends exactly one alert when the status HAS moved", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.sent).toBe(1);
    const sent = alerts();
    expect(sent).toHaveLength(1);
    expect(String(sent[0]!.subject)).toContain("RFI ISSUED");
    // Both sides of the transition must be in the body, or the reader cannot
    // tell what moved.
    expect(String(sent[0]!.text)).toContain("ANALYST REVIEW");
    expect(String(sent[0]!.text)).toContain("RFI ISSUED");
  });

  it("does not send twice for the same move", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    await t.action(internal.caseAlerts.sweepCaseChanges, {});
    await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(alerts()).toHaveLength(1);
  });

  it("stays silent on the FIRST sighting of a case it did not hold", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "ANALYST REVIEW", isFinal: false } },
    });
    const id = await seededSubscription(t, "person@example.com", undefined);

    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    // Our first sight cannot tell "it just arrived" from "it has been sitting
    // in this status for eight months". Mailing the second as though it were
    // the first is a false alarm, and false alarms are how an alert product
    // loses somebody permanently.
    expect(res.seeded).toBe(1);
    expect(res.sent).toBe(0);
    expect(alerts()).toHaveLength(0);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.lastSeenStatus).toBe("ANALYST REVIEW");

    // And the NEXT real move does send, so the silence above is a baseline
    // rather than a permanently broken subscription.
    stubMirrorAndResend({ cases: { [CASE]: { status: "CERTIFIED", isFinal: true } } });
    const second = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(second.sent).toBe(1);
  });

  it("treats a casing difference as no change", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      // The upstream emits the same status in two casings. Comparing raw
      // against canonical would mark every row as a transition and mail the
      // entire subscriber list at once.
      cases: { [CASE]: { status: "Analyst Review", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.sent).toBe(0);
    expect(alerts()).toHaveLength(0);
  });

  it("sends nothing for a case the mirror does not hold", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({ cases: {} });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.sent).toBe(0);
    expect(alerts()).toHaveLength(0);
  });

  it("ignores an unconfirmed subscription entirely", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "CERTIFIED", isFinal: true } },
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", {
        email: "person@example.com",
        caseNumber: CASE,
        createdAt: Date.now(),
        lastSeenStatus: "ANALYST REVIEW",
      });
    });
    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.checked).toBe(0);
    expect(alerts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Failure handling and lifecycle
// ---------------------------------------------------------------------------

describe("failure handling", () => {
  it("does NOT advance lastSeenStatus when the send fails", async () => {
    const t = createTestContext();
    // Resend returns `{ data: null, error }` for a 429; it does not throw. A
    // bare try/catch would run the line after the send and stamp the row, which
    // makes the transition look like old news forever and destroys the one
    // alert this subscriber signed up for.
    stubMirrorAndResend(
      { cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } } },
      429,
    );
    const id = await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(1);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.lastSeenStatus).toBe("ANALYST REVIEW");
    expect(row!.lastAlertSentAt).toBeUndefined();

    // Still due, so a later sweep retries them.
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    const retry = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(retry.sent).toBe(1);
    expect(alerts()).toHaveLength(1);
  });

  it("retires a subscription once the case reaches a final status", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "CERTIFIED", isFinal: true } },
    });
    const id = await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    const res = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(res.sent).toBe(1);
    expect(String(alerts()[0]!.text)).toContain("last alert");

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.caseClosedAt).toBeDefined();

    // A certified case cannot move again, so it must drop out of the sweep
    // rather than being read forever.
    const after = await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(after.checked).toBe(0);
  });

  it("advances the cursor for rows that did NOT change", async () => {
    const t = createTestContext();
    stubMirrorAndResend({
      cases: { [CASE]: { status: "ANALYST REVIEW", isFinal: false } },
    });
    const id = await seededSubscription(t, "person@example.com", "ANALYST REVIEW");

    await t.action(internal.caseAlerts.sweepCaseChanges, {});
    const row = await t.run(async (ctx) => ctx.db.get(id));
    // Using the SEND stamp as the cursor starves the tail of the table: a
    // subscription whose case never moves never gets a send, so it sorts first
    // on every run and the rows behind it are never reached.
    expect(row!.lastCheckedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// The alert budget
// ---------------------------------------------------------------------------

describe("the global alert budget", () => {
  it("caps sends in one day however many subscriptions are due", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [
          `P-100-2612${i % 10}-86895${i}`,
          { status: "CERTIFIED", isFinal: true },
        ]),
      ),
    });
    for (let i = 0; i < 60; i++) {
      await seededSubscription(
        t,
        `person${i}@example.com`,
        "ANALYST REVIEW",
        `P-100-2612${i % 10}-86895${i}`,
      );
    }

    // Sweep repeatedly. The batch limit alone would let the self-reschedule
    // drain all 60 in one day; the GLOBAL budget is what stops the shared
    // Resend quota being eaten by this one feature.
    for (let i = 0; i < 6; i++) await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(alerts().length).toBeLessThanOrEqual(25);
    expect(alerts().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// What goes out
// ---------------------------------------------------------------------------

describe("the alert that goes out", () => {
  it("carries html AND text, and the one-click unsubscribe headers", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});

    const body = alerts()[0]!;
    expect(typeof body.html).toBe("string");
    expect(typeof body.text).toBe("string");
    const headers = body.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toContain("/case-alert/unsubscribe");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("shows the RFI funnel on an RFI and on nothing else", async () => {
    const t = createTestContext();
    const rfi = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    await seededSubscription(t, "rfi@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(String(rfi.alerts()[0]!.text)).toContain("1,799");

    // Pasting a reassuring statistic into a denial would be grotesque.
    const t2 = createTestContext();
    const denied = stubMirrorAndResend({
      cases: { [CASE]: { status: "DENIED", isFinal: true } },
    });
    await seededSubscription(t2, "denied@example.com", "ANALYST REVIEW");
    await t2.action(internal.caseAlerts.sweepCaseChanges, {});
    expect(String(denied.alerts()[0]!.text)).not.toContain("1,799");
  });

  it("dates the observation with the UPSTREAM's check time", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: {
        [CASE]: {
          status: "RFI ISSUED",
          isFinal: false,
          lastCheckedAt: "2026-08-05T22:31:24",
        },
      },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});

    const text = String(alerts()[0]!.text);
    // We mirror a tracker that reads DOL; we do not check DOL. The email dates
    // the reading and attributes it to DOL, and claims nothing about now.
    expect(text).toContain("DOL showed this status when the case was last checked, on August 5, 2026");
    expect(text).not.toMatch(/\bwe (?:checked|verified)\b/i);
  });

  it("says so when a case carries no check date", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: {
        [CASE]: { status: "RFI ISSUED", isFinal: false, lastCheckedAt: null },
      },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});

    // A null check date silently omitted reads as a fresh observation, which is
    // the same class of bug as a truthiness change detector: the absent case
    // and the good case become indistinguishable to the reader.
    const text = String(alerts()[0]!.text);
    expect(text).toContain("don't have a check date");
    expect(text).not.toContain("last checked, on");
  });

  it("never compares the check stamp as a number", async () => {
    const t = createTestContext();
    const sqls: string[] = [];
    const inner = global.fetch;
    stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    const wrapped = global.fetch;
    global.fetch = (async (url: unknown, init?: { body?: string }) => {
      if (String(url).includes("/v2/pipeline") && init?.body) {
        const body = JSON.parse(init.body) as {
          requests: { stmt?: { sql: string } }[];
        };
        for (const r of body.requests) if (r.stmt) sqls.push(r.stmt.sql);
      }
      return wrapped(url as string, init as RequestInit);
    }) as unknown as typeof fetch;

    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});
    global.fetch = inner;

    // SQLite sorts any string above any number, so `last_checked_at >= <int>`
    // is TRUE for every non-null row and returns a clean-looking result that is
    // entirely artefact. The column is only ever selected, never compared.
    expect(sqls.length).toBeGreaterThan(0);
    for (const sql of sqls) {
      expect(sql, `numeric comparison on the check stamp: ${sql}`).not.toMatch(
        /last_checked_at\s*[<>=!]+\s*\d/,
      );
    }
    // Control: the sweep really did read the column, so the sweep above is not
    // passing because it never touched it.
    expect(sqls.some((q) => q.includes("last_checked_at"))).toBe(true);
  });

  it("never predicts a date or odds for this reader's own case", async () => {
    const t = createTestContext();
    const { alerts } = stubMirrorAndResend({
      cases: { [CASE]: { status: "RFI ISSUED", isFinal: false } },
    });
    await seededSubscription(t, "person@example.com", "ANALYST REVIEW");
    await t.action(internal.caseAlerts.sweepCaseChanges, {});

    const text = String(alerts()[0]!.text);
    for (const banned of BANNED_CLAIMS) {
      expect(text, `alert copy matched ${banned}`).not.toMatch(banned);
    }
    // The absence of a prediction and the presence of the sentence saying so
    // are two different assertions, and only the second survives someone
    // deleting the disclaimer.
    expect(text).toContain("isn't a prediction of one");
  });

  /**
   * The gate above, probed against inputs it MUST catch and inputs it must not.
   *
   * Its first version was a bare /\bpredict/i and it failed on the alert's own
   * disclaimer, "it isn't a prediction of one". A gate that flags the guardrail
   * it exists to protect is worse than no gate: the obvious fix is to delete
   * the disclaimer. So the patterns below match AFFIRMATIVE claims only, and
   * the negated forms are controls that must stay clean.
   */
  it("the prediction gate catches predictions and leaves the disclaimer alone", () => {
    const mustFlag = [
      "Your case will be decided by November.",
      "Your application should be certified soon.",
      "We expect a decision in about four months.",
      "Our estimate is a decision around March 2027.",
      "There's a 92% chance of certification.",
      "The odds are good from here.",
      "Estimated decision date: 2027-03-14.",
      "We predict this clears in six weeks.",
    ];
    const mustPass = [
      "It isn't a prediction of one.",
      "It is not a prediction of your decision date.",
      "This is not a forecast and we make no prediction.",
      "Of 2,151 resolved RFIs, 1,799 ended certified.",
      "Cases now at this status: 906.",
    ];
    for (const bad of mustFlag) {
      expect(
        BANNED_CLAIMS.some((re) => re.test(bad)),
        `gate missed a real prediction: ${bad}`,
      ).toBe(true);
    }
    for (const good of mustPass) {
      const hit = BANNED_CLAIMS.find((re) => re.test(good));
      expect(hit, `gate flagged legitimate copy: ${good} (${hit})`).toBeUndefined();
    }
  });
});
