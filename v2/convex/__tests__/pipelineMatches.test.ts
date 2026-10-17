/**
 * The wage request to PERM match, end to end through the sweep: which
 * watched requests it looks at, what it reads from the mirror, what it sends
 * and what it remembers. The title and cap rules themselves are tested in
 * src/lib/__tests__/pipelineMatch.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

const originalFetch = global.fetch;
const PWD = "P-100-26118-846661";
const SLUG = "example-systems-inc";
/** 2:30 PM EDT on Sep 2 2026: DOL's record showed the wage issued that day. */
const ISSUED_AT = Date.parse("2026-09-02T18:30:00Z");

interface PermRow {
  case_number: string;
  filing_date: string;
  employer_slug: string;
  employer_name: string;
  job_title: string;
}

interface Fixture {
  pwd: Record<string, { employer_slug: string; employer_name: string; job_title: string; seen?: number | null }>;
  perms: PermRow[];
  /** Spellings the page map ties together, as the SQL's page lookup would. */
  spellings?: Record<string, string[]>;
}

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
      result: { cols: cols.map((name) => ({ name })), rows: rows.map((r) => cols.map((c) => cellOf(r[c] ?? null))) },
    },
  };
}

function stub(fixture: Fixture) {
  const sends: Record<string, unknown>[] = [];
  const permReads: string[][] = [];
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(init?.body ?? "{}") as {
        requests: { type: string; stmt?: { sql: string; args?: { value?: string }[] } }[];
      };
      const results = body.requests.map((req) => {
        if (req.type !== "execute" || !req.stmt) return { type: "ok", response: { type: "close" } };
        const sql = req.stmt.sql.replace(/\s+/g, " ");
        const args = (req.stmt.args ?? []).map((a) => a.value ?? "");
        if (sql.includes("FROM pwd_case_status")) {
          return hranaResult(
            args
              .filter((n) => fixture.pwd[n])
              .map((n) => {
                const { seen: _seen, ...row } = fixture.pwd[n]!;
                return { case_number: n, ...row };
              }),
          );
        }
        if (sql.includes("FROM pwd_case_events")) {
          return hranaResult(
            args
              .filter((n) => fixture.pwd[n] && fixture.pwd[n]!.seen !== null)
              .map((n) => ({ case_number: n, seen: fixture.pwd[n]!.seen ?? ISSUED_AT })),
          );
        }
        if (sql.includes("FROM pwd_cases")) return hranaResult([]);
        if (sql.includes("FROM perm_live_recent")) {
          const slug = args[0]!;
          const since = args[args.length - 1]!;
          const slugs = new Set([slug, ...(fixture.spellings?.[slug] ?? [])]);
          permReads.push([...slugs, since]);
          return hranaResult(
            fixture.perms
              .filter((p) => slugs.has(p.employer_slug) && p.filing_date >= since)
              .map(({ employer_slug: _s, ...p }) => p),
          );
        }
        return hranaResult([]);
      });
      return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    sends.push(init?.body ? JSON.parse(init.body) : {});
    return new Response(JSON.stringify({ id: "stub" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { sends, permReads, matches: () => sends.filter((s) => String(s.subject).includes("may be yours")) };
}

async function watch(
  t: ReturnType<typeof createTestContext>,
  email: string,
  caseNumber = PWD,
  extra: { lastSeenStatus?: string; confirmed?: boolean } = {},
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("caseStatusAlerts", {
      email,
      caseNumber,
      createdAt: Date.now(),
      ...(extra.confirmed === false ? {} : { confirmedAt: Date.now() }),
      lastSeenStatus: extra.lastSeenStatus ?? "DETERMINATION ISSUED",
    }),
  );
}

const pwdRow = { employer_slug: SLUG, employer_name: "Example Systems, Inc.", job_title: "IT Project Manager Lead" };
const permOf = (n: string, filed: string, title = "IT Project Manager Lead", slug = SLUG): PermRow => ({
  case_number: n,
  filing_date: filed,
  employer_slug: slug,
  employer_name: "EXAMPLE SYSTEMS INC",
  job_title: title,
});

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-unsubscribe-secret");
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  vi.stubEnv("DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("DATABASE_AUTH_TOKEN", "stub-token");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("the wage request to PERM match", () => {
  it("tells the subscriber about a matching PERM filed after the wage, once, as a possibility", async () => {
    const t = createTestContext();
    const { matches, permReads } = stub({
      pwd: { [PWD]: pwdRow },
      perms: [
        permOf("G-100-26244-111111", "2026-09-01"),
        permOf("G-100-26286-296040", "2026-10-13"),
        permOf("G-100-26286-296041", "2026-10-13", "Accountant"),
      ],
    });
    const id = await watch(t, "person@example.com");

    const res = await t.action(internal.pipelineMatches.sweep, {});
    expect(res).toMatchObject({ looked: 1, sent: 1, failed: 0 });
    // Read from the day DOL's record showed the wage issued, by the request's own slug.
    expect(permReads[0]).toEqual([SLUG, "2026-09-02"]);
    const sent = matches();
    expect(sent).toHaveLength(1);
    const text = String(sent[0]!.text);
    expect(text).toContain("G-100-26286-296040");
    expect(text, "filed before the wage was issued").not.toContain("G-100-26244-111111");
    expect(text, "another job title").not.toContain("G-100-26286-296041");
    expect(text).toContain("we can't tell whether this is yours");
    expect(text).not.toMatch(/\bis your (PERM|case)\b|\byour PERM (was|has been) filed\b/i);

    const told = await t.run(async (ctx) => ctx.db.query("permMatchNotices").collect());
    expect(told.map((r) => [r.subscriptionId, r.permCaseNumber])).toEqual([[id, "G-100-26286-296040"]]);
    const outbox = await t.run(async (ctx) => ctx.db.query("alertOutbox").collect());
    expect(outbox.map((r) => [r.kind, r.ref])).toEqual([["match", `match:${id}`]]);

    // The next run has nothing new to say.
    await t.action(internal.pipelineMatches.sweep, {});
    expect(matches()).toHaveLength(1);
  });

  it("reads every spelling the page map ties to the employer", async () => {
    const t = createTestContext();
    const { matches } = stub({
      pwd: { [PWD]: pwdRow },
      perms: [permOf("G-100-26286-296040", "2026-10-13", "IT Project Manager Lead", "example-systems")],
      spellings: { [SLUG]: ["example-systems"] },
    });
    await watch(t, "person@example.com");
    await t.action(internal.pipelineMatches.sweep, {});
    expect(matches()).toHaveLength(1);
  });

  it("never matches another employer's PERM with the same title", async () => {
    const t = createTestContext();
    const { matches } = stub({
      pwd: { [PWD]: pwdRow },
      perms: [permOf("G-100-26286-296040", "2026-10-13", "IT Project Manager Lead", "someone-else-llc")],
    });
    await watch(t, "person@example.com");
    await t.action(internal.pipelineMatches.sweep, {});
    expect(matches()).toHaveLength(0);
  });

  it("lists up to three in one email, and says nothing past three", async () => {
    const t = createTestContext();
    const three = [11, 12, 13].map((d) => permOf(`G-100-262${d}-1`, `2026-10-${d}`));
    const { matches } = stub({ pwd: { [PWD]: pwdRow }, perms: three });
    await watch(t, "person@example.com");
    await t.action(internal.pipelineMatches.sweep, {});
    const sent = matches();
    expect(sent).toHaveLength(1);
    expect(String(sent[0]!.subject)).toBe("PERM applications that may be yours");
    for (const p of three) expect(String(sent[0]!.text)).toContain(p.case_number);

    const t2 = createTestContext();
    const four = [11, 12, 13, 14].map((d) => permOf(`G-100-262${d}-1`, `2026-10-${d}`));
    const second = stub({ pwd: { [PWD]: pwdRow }, perms: four });
    await watch(t2, "person@example.com");
    const res = await t2.action(internal.pipelineMatches.sweep, {});
    expect(res.sent + res.queued).toBe(0);
    expect(second.matches()).toHaveLength(0);
  });

  it("stops looking once three have been told", async () => {
    const t = createTestContext();
    const id = await watch(t, "person@example.com");
    await t.run(async (ctx) => {
      for (const n of ["G-100-26201-1", "G-100-26202-1", "G-100-26203-1"]) {
        await ctx.db.insert("permMatchNotices", {
          subscriptionId: id,
          email: "person@example.com",
          pwdCaseNumber: PWD,
          permCaseNumber: n,
          filingDate: "2026-09-20",
          toldAt: Date.now(),
        });
      }
    });
    const { matches, permReads } = stub({ pwd: { [PWD]: pwdRow }, perms: [permOf("G-100-26286-296040", "2026-10-13")] });
    await t.action(internal.pipelineMatches.sweep, {});
    expect(matches()).toHaveLength(0);
    expect(permReads, "no read for a request that has had its three").toHaveLength(0);
  });

  it("doesn't tell an address about a case it already watches, or twice across two requests", async () => {
    const t = createTestContext();
    const OTHER = "P-100-26119-846700";
    const { matches } = stub({
      pwd: { [PWD]: pwdRow, [OTHER]: pwdRow },
      perms: [permOf("G-100-26286-296040", "2026-10-13"), permOf("G-100-26287-296050", "2026-10-14")],
    });
    await watch(t, "person@example.com", PWD);
    await watch(t, "person@example.com", OTHER);
    await watch(t, "person@example.com", "G-100-26287-296050", { lastSeenStatus: "ANALYST REVIEW" });
    await t.action(internal.pipelineMatches.sweep, {});
    const all = matches().map((s) => String(s.text)).join("\n");
    expect(all).not.toContain("G-100-26287-296050");
    const told = await t.run(async (ctx) => ctx.db.query("permMatchNotices").collect());
    expect(told.map((r) => r.permCaseNumber)).toEqual(["G-100-26286-296040"]);
  });

  it("looks only at confirmed PERM-job wage requests whose wage DOL has issued", async () => {
    const t = createTestContext();
    const H1B = "P-200-26118-846662";
    const { matches, permReads } = stub({
      pwd: { [PWD]: pwdRow, [H1B]: pwdRow },
      perms: [permOf("G-100-26286-296040", "2026-10-13")],
    });
    await watch(t, "a@example.com", H1B);
    await watch(t, "b@example.com", PWD, { confirmed: false });
    await watch(t, "c@example.com", PWD, { lastSeenStatus: "IN PROCESS" });
    const res = await t.action(internal.pipelineMatches.sweep, {});
    expect(res.looked).toBe(0);
    expect(permReads).toHaveLength(0);
    expect(matches()).toHaveLength(0);
  });

  it("waits for a request whose issue day it can't read", async () => {
    const t = createTestContext();
    const { matches } = stub({ pwd: { [PWD]: { ...pwdRow, seen: null } }, perms: [permOf("G-100-26286-296040", "2026-10-13")] });
    await watch(t, "person@example.com");
    await t.action(internal.pipelineMatches.sweep, {});
    expect(matches()).toHaveLength(0);
  });

  it("charges its own pool once per email", async () => {
    const t = createTestContext();
    stub({ pwd: { [PWD]: pwdRow }, perms: [permOf("G-100-26286-296040", "2026-10-13"), permOf("G-100-26287-1", "2026-10-14")] });
    await watch(t, "person@example.com");
    await t.action(internal.pipelineMatches.sweep, {});
    const charges = await t.run(async (ctx) =>
      (await ctx.db.query("rateLimits").collect()).filter((r) => r.action === "pipeline_match_global"),
    );
    expect(charges).toHaveLength(1);
  });
});
