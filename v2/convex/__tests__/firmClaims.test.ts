/**
 * Claiming a law firm's page.
 *
 * The tests that matter are the ones a green first day would hide: a stranger's
 * words under the firm's name, a personal or unrelated address publishing on
 * its own, an old or forwarded link still able to change a public page, a
 * refused request that still leaves a stamp, and a page that keeps showing a
 * profile after its claim is revoked.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { makeExpiringToken, verifyExpiringToken } from "../lib/expiringToken";
import { BUDGETS } from "../lib/alertBudgets";
import { CONFIRM_VALID_MS, EDIT_LINK_REPLY, NEUTRAL_REPLY } from "../firmClaims";
import { QUEUED_REPLY } from "../confirmationQueue";

const SECRET = "test-unsubscribe-secret";
const ADMIN = "admin@claims-test.com";
const originalFetch = global.fetch;
type T = ReturnType<typeof createTestContext>;

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

/** Turso answers firm names and the domain table; anything else (Resend, the refresh route) is recorded. */
function stub(domains: Record<string, { page_slug: string; program: string; filings: number; firm_filings: number }[]> = {}) {
  const calls: string[] = [];
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
        if (sql.includes("FROM perm_entities")) {
          return hrana(arg === "smith-immigration-pllc" ? [{ name: "Smith Immigration PLLC" }] : []);
        }
        if (sql.includes("FROM firm_email_domains")) return hrana(domains[arg] ?? []);
        return hrana([]);
      });
      return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    calls.push(href);
    return new Response(JSON.stringify({ id: "stub" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const SLUG = "smith-immigration-pllc";
const TIED = { "smithlaw.com": [{ page_slug: SLUG, program: "perm", filings: 14, firm_filings: 20 }] };
const PROFILE = {
  website: "https://www.smithlaw.com",
  description: "A small firm that files PERM and H-1B cases.",
  languages: ["Spanish"],
  offices: [{ city: "Tampa", state: "FL" }],
  focus: ["perm", "h1b"],
};

async function claimOverHttp(t: T, email: string, extra: Record<string, unknown> = {}) {
  return t.fetch("/firm-claim/request", {
    method: "POST",
    body: JSON.stringify({ email, slug: SLUG, role: "Partner", profile: PROFILE, ...extra }),
  });
}

async function claimRow(t: T, email: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("firmClaims")
      .withIndex("by_email_slug", (q) => q.eq("email", email).eq("slug", SLUG))
      .first(),
  );
}

async function adminAuth(t: T) {
  const id = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
  return t.withIdentity({ subject: id, email: ADMIN });
}

describe("the link tokens", () => {
  it("expire, are scoped to one purpose, and can't have their expiry edited", async () => {
    const now = Date.now();
    const token = await makeExpiringToken("Jane@SmithLaw.com", SECRET, "firm-edit", now + 1000);
    expect(await verifyExpiringToken(token, SECRET, "firm-edit", now)).toBe("jane@smithlaw.com");
    expect(await verifyExpiringToken(token, SECRET, "firm-edit", now + 1001)).toBeNull();
    expect(await verifyExpiringToken(token, SECRET, "firm-confirm", now)).toBeNull();
    const [e, , sig] = token.split(".");
    expect(await verifyExpiringToken(`${e}.${now + 10_000_000}.${sig}`, SECRET, "firm-edit", now)).toBeNull();
    expect(await verifyExpiringToken(token, "another-secret", "firm-edit", now)).toBeNull();
    expect(await verifyExpiringToken("junk", SECRET, "firm-edit", now)).toBeNull();
  });
});

describe("the request takes the firm's name from our records", () => {
  it("refuses a firm we don't hold and stages one we do, under OUR name", async () => {
    const t = createTestContext();
    stub(TIED);
    const bad = await t.fetch("/firm-claim/request", {
      method: "POST",
      body: JSON.stringify({ email: "a@smithlaw.com", slug: "no-such-firm", role: "Partner", profile: PROFILE }),
    });
    expect(bad.status).toBe(400);
    const ok = await claimOverHttp(t, "Jane@SmithLaw.com", { firmName: "Click here for a prize" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { message: string }).message).toBe(NEUTRAL_REPLY);
    const row = await claimRow(t, "jane@smithlaw.com");
    expect(row?.firmName).toBe("Smith Immigration PLLC");
    expect(row?.status).toBe("pending_email");
    expect(row?.domainReason).toBeUndefined();
  });

  it("refuses a profile that breaks the rules before anything is staged", async () => {
    const t = createTestContext();
    stub(TIED);
    const res = await claimOverHttp(t, "jane@smithlaw.com", {
      profile: { ...PROFILE, description: "Call us at (813) 555-0100" },
    });
    expect(res.status).toBe(400);
    expect(await claimRow(t, "jane@smithlaw.com")).toBeNull();
  });
});

describe("confirming a claim", () => {
  it("confirms a claim from a domain DOL ties to the firm, holds its words for review, and hands back an edit link", async () => {
    vi.useFakeTimers();
    const t = createTestContext();
    const { calls } = stub(TIED);
    vi.stubEnv("REVALIDATE_SECRET", "rv");
    await claimOverHttp(t, "jane@smithlaw.com");
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();

    const edit = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-edit", Date.now() + 60_000);
    expect(await t.mutation(internal.firmClaims.confirmByToken, { token: edit })).toBeNull();

    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + CONFIRM_VALID_MS);
    const res = await t.mutation(internal.firmClaims.confirmByToken, { token });
    expect(res?.published).toEqual([]);
    expect(res?.submitted).toEqual([{ slug: SLUG, firmName: "Smith Immigration PLLC" }]);
    expect(res?.editToken).toBeTruthy();
    expect((await claimRow(t, "jane@smithlaw.com"))?.status).toBe("verified");
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();

    const admin = await adminAuth(t);
    const list = await admin.query(api.firmClaims.listForAdmin, {});
    expect(list.edits).toHaveLength(1);
    expect(list.edits[0]).toMatchObject({ slug: SLUG, firmName: "Smith Immigration PLLC", before: null });
    expect(list.edits[0]!.after.description).toBe(PROFILE.description);

    await admin.mutation(api.firmClaims.approveProfile, { slug: SLUG });
    const shown = await t.query(api.firmClaims.publishedProfile, { slug: SLUG });
    expect(shown).toMatchObject({ website: "https://www.smithlaw.com/", languages: ["Spanish"], verifiedBy: "domain" });
    expect((await admin.query(api.firmClaims.listForAdmin, {})).edits).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    expect(calls.some((c) => c.endsWith("/api/revalidate-firm"))).toBe(true);
  });

  it("sends personal mail to review and publishes nothing", async () => {
    const t = createTestContext();
    stub({ "gmail.com": [{ page_slug: SLUG, program: "perm", filings: 40, firm_filings: 40 }] });
    await claimOverHttp(t, "jane.smith@gmail.com", { profile: { ...PROFILE, website: undefined } });
    expect((await claimRow(t, "jane.smith@gmail.com"))?.domainReason).toBe("personal");
    const token = await makeExpiringToken("jane.smith@gmail.com", SECRET, "firm-confirm", Date.now() + 60_000);
    const res = await t.mutation(internal.firmClaims.confirmByToken, { token });
    expect(res?.review).toEqual(["Smith Immigration PLLC"]);
    expect(res?.editToken).toBeUndefined();
    expect((await claimRow(t, "jane.smith@gmail.com"))?.status).toBe("pending_review");
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
  });

  it("refuses an expired confirmation link", async () => {
    const t = createTestContext();
    stub(TIED);
    await claimOverHttp(t, "jane@smithlaw.com");
    const old = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() - 1);
    expect(await t.mutation(internal.firmClaims.confirmByToken, { token: old })).toBeNull();
    expect((await claimRow(t, "jane@smithlaw.com"))?.status).toBe("pending_email");
  });

  it("renders a POST button on GET and changes nothing", async () => {
    const t = createTestContext();
    stub(TIED);
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    const page = await t.fetch(`/firm-claim/confirm?token=${encodeURIComponent(token)}`, { method: "GET" });
    expect(await page.text()).toContain('method="POST"');
    expect((await claimRow(t, "jane@smithlaw.com"))?.status).toBe("pending_email");
  });
});

describe("budgets and cooldowns", () => {
  it("charges the pool before the write: a full pool queues and stages nothing", async () => {
    const t = createTestContext();
    stub(TIED);
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < BUDGETS.firmClaim.limit; i++) {
        await ctx.db.insert("rateLimits", {
          key: `${BUDGETS.firmClaim.key}:all`,
          identifier: "all",
          action: BUDGETS.firmClaim.key,
          timestamp: now - i * 1000,
        });
      }
    });
    const res = await claimOverHttp(t, "jane@smithlaw.com");
    expect(((await res.json()) as { message: string }).message).toBe(QUEUED_REPLY);
    expect(await claimRow(t, "jane@smithlaw.com")).toBeNull();
    const queued = await t.run(async (ctx) => ctx.db.query("confirmationQueue").collect());
    expect(queued.map((q) => q.kind)).toEqual(["firm"]);
  });

  it("answers a repeat inside the cooldown with the same words and no second email", async () => {
    const t = createTestContext();
    stub(TIED);
    await claimOverHttp(t, "jane@smithlaw.com");
    const first = (await claimRow(t, "jane@smithlaw.com"))!.lastConfirmationSentAt;
    const again = await claimOverHttp(t, "jane@smithlaw.com");
    expect(((await again.json()) as { message: string }).message).toBe(NEUTRAL_REPLY);
    expect((await claimRow(t, "jane@smithlaw.com"))!.lastConfirmationSentAt).toBe(first);
  });

  it("asks for an edit link without spending the pool when there's no claim", async () => {
    const t = createTestContext();
    stub(TIED);
    const res = await t.mutation(internal.firmClaims.requestEditLink, { email: "nobody@smithlaw.com", slug: SLUG });
    expect(res.message).toBe(EDIT_LINK_REPLY);
    const spent = await t.run(async (ctx) =>
      ctx.db
        .query("rateLimits")
        .collect()
        .then((r) => r.filter((x) => x.action === BUDGETS.firmClaim.key)),
    );
    expect(spent).toHaveLength(0);
  });
});

describe("editing", () => {
  async function verified(t: T) {
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    await t.mutation(internal.firmClaims.confirmByToken, { token });
    const admin = await adminAuth(t);
    await admin.mutation(api.firmClaims.approveProfile, { slug: SLUG });
    return admin;
  }

  it("keeps links out of the description, and flags a website on another domain for the reviewer", async () => {
    const t = createTestContext();
    stub(TIED);
    const admin = await verified(t);
    const bad = await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "See www.smithlaw.com" },
    });
    expect(bad.ok).toBe(false);
    const elsewhere = await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, website: "https://someone-else.com" },
    });
    expect(elsewhere.ok).toBe(true);
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.website).toBe("https://www.smithlaw.com/");
    const edits = (await admin.query(api.firmClaims.listForAdmin, {})).edits;
    expect(edits[0]).toMatchObject({ websiteOffDomain: true });
    await admin.mutation(api.firmClaims.approveProfile, { slug: SLUG });
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.website).toBe("https://someone-else.com/");
  });

  it("still lets the admin pass a website held under the old rules", async () => {
    const t = createTestContext();
    stub(TIED);
    const admin = await verified(t);
    await t.run(async (ctx) => {
      const p = await ctx.db.query("firmProfiles").withIndex("by_slug", (q) => q.eq("slug", SLUG)).unique();
      await ctx.db.patch(p!._id, { pendingWebsite: "https://someone-else.com/" });
    });
    await admin.mutation(api.firmClaims.approveWebsite, { slug: SLUG });
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.website).toBe("https://someone-else.com/");
  });

  it("lets the firm take its profile down and put it back", async () => {
    const t = createTestContext();
    stub(TIED);
    await verified(t);
    await t.mutation(internal.firmClaims.saveProfile, { email: "jane@smithlaw.com", slug: SLUG, profile: {}, action: "hide" });
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
    await t.mutation(internal.firmClaims.saveProfile, { email: "jane@smithlaw.com", slug: SLUG, profile: {}, action: "show" });
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).not.toBeNull();
  });

  it("refuses an address with no verified claim on the firm", async () => {
    const t = createTestContext();
    stub(TIED);
    await verified(t);
    const res = await t.mutation(internal.firmClaims.saveProfile, {
      email: "intruder@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "Taken over." },
    });
    expect(res.ok).toBe(false);
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.description).toBe(PROFILE.description);
  });

  it("serves the edit page only on a live edit link", async () => {
    const t = createTestContext();
    stub(TIED);
    await verified(t);
    const old = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-edit", Date.now() - 1);
    expect((await t.fetch(`/firm-claim/edit?token=${encodeURIComponent(old)}`, { method: "GET" })).status).toBe(400);
    const live = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-edit", Date.now() + 60_000);
    const page = await t.fetch(`/firm-claim/edit?token=${encodeURIComponent(live)}`, { method: "GET" });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("Smith Immigration PLLC");
    expect(html).toContain('name="description"');
  });
});

describe("the admin", () => {
  it("approves a claim under review, and revoking the last claim takes the profile down", async () => {
    const t = createTestContext();
    stub({});
    await claimOverHttp(t, "jane@othermail-firm.com", { profile: { ...PROFILE, website: undefined } });
    const token = await makeExpiringToken("jane@othermail-firm.com", SECRET, "firm-confirm", Date.now() + 60_000);
    await t.mutation(internal.firmClaims.confirmByToken, { token });
    const admin = await adminAuth(t);
    const list = await admin.query(api.firmClaims.listForAdmin, {});
    expect(list.review.map((c) => c.firmName)).toEqual(["Smith Immigration PLLC"]);

    const claimId = list.review[0]!._id;
    await admin.mutation(api.firmClaims.approveClaim, { claimId });
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toMatchObject({ verifiedBy: "admin" });

    await admin.mutation(api.firmClaims.revokeClaim, { claimId });
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
  });

  it("refuses everyone who isn't the admin", async () => {
    const t = createTestContext();
    const id = await t.run(async (ctx) => ctx.db.insert("users", { email: "stranger@example.com" }));
    const auth = t.withIdentity({ subject: id, email: "stranger@example.com" });
    await expect(auth.query(api.firmClaims.listForAdmin, {})).rejects.toThrow(/Admin access required/);
  });

  it("keeps a revoked claimant from publishing itself again", async () => {
    const t = createTestContext();
    stub(TIED);
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    await t.mutation(internal.firmClaims.confirmByToken, { token });
    const admin = await adminAuth(t);
    const claim = (await claimRow(t, "jane@smithlaw.com"))!;
    await admin.mutation(api.firmClaims.revokeClaim, { claimId: claim._id });

    // Past the cooldown, the same address claims again from the same tied domain.
    await t.run(async (ctx) => ctx.db.patch(claim._id, { lastConfirmationSentAt: Date.now() - 3_600_000 }));
    await claimOverHttp(t, "jane@smithlaw.com");
    const again = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    const res = await t.mutation(internal.firmClaims.confirmByToken, { token: again });
    expect(res?.review).toEqual(["Smith Immigration PLLC"]);
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
  });
});

describe("a firm's own words wait for review", () => {
  async function live(t: T) {
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    await t.mutation(internal.firmClaims.confirmByToken, { token });
    const admin = await adminAuth(t);
    await admin.mutation(api.firmClaims.approveProfile, { slug: SLUG });
    return admin;
  }

  it("leaves the page as it was while an edit waits, and a decline keeps it so and says why", async () => {
    const t = createTestContext();
    stub(TIED);
    const admin = await live(t);
    const saved = await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "The best immigration firm in Florida." },
    });
    expect(saved.ok).toBe(true);
    expect(saved.message).toMatch(/review/i);
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.description).toBe(PROFILE.description);

    const edits = (await admin.query(api.firmClaims.listForAdmin, {})).edits;
    expect(edits).toHaveLength(1);
    expect(edits[0]!.before?.description).toBe(PROFILE.description);
    expect(edits[0]!.after.description).toBe("The best immigration firm in Florida.");

    await admin.mutation(api.firmClaims.rejectProfile, { slug: SLUG, reason: "Please state facts, not rankings." });
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.description).toBe(PROFILE.description);
    expect((await admin.query(api.firmClaims.listForAdmin, {})).edits).toEqual([]);

    const state = await t.query(internal.firmClaims.editStateFor, { email: "jane@smithlaw.com" });
    expect(state[0]!.pending).toBeNull();
    expect(state[0]!.declined?.reason).toBe("Please state facts, not rankings.");
    expect(state[0]!.declined?.version.description).toBe("The best immigration firm in Florida.");

    const link = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-edit", Date.now() + 60_000);
    const html = await (await t.fetch(`/firm-claim/edit?token=${encodeURIComponent(link)}`, { method: "GET" })).text();
    expect(html).toContain("Please state facts, not rankings.");
    expect(html).toContain("The best immigration firm in Florida.");
  });

  it("shows a waiting edit on the firm's edit page, and publishes it only on approval", async () => {
    vi.useFakeTimers();
    const t = createTestContext();
    const { calls } = stub(TIED);
    vi.stubEnv("REVALIDATE_SECRET", "rv");
    const admin = await live(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const before = calls.filter((c) => c.endsWith("/api/revalidate-firm")).length;
    await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, languages: ["Spanish", "Haitian Creole"] },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    // Nothing public changed, so nothing was refreshed.
    expect(calls.filter((c) => c.endsWith("/api/revalidate-firm")).length).toBe(before);
    const link = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-edit", Date.now() + 60_000);
    const html = await (await t.fetch(`/firm-claim/edit?token=${encodeURIComponent(link)}`, { method: "GET" })).text();
    expect(html).toMatch(/waiting for (our )?review/i);
    expect(html).toContain("Haitian Creole");

    await admin.mutation(api.firmClaims.approveProfile, { slug: SLUG });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    expect((await t.query(api.firmClaims.publishedProfile, { slug: SLUG }))?.languages).toEqual(["Spanish", "Haitian Creole"]);
    expect(calls.filter((c) => c.endsWith("/api/revalidate-firm")).length).toBeGreaterThan(before);
  });

  it("tells the admin about waiting work at most once a day", async () => {
    const t = createTestContext();
    stub(TIED);
    await live(t);
    await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "A second version." },
    });
    await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "A third version." },
    });
    const notices = await t.run(async (ctx) =>
      ctx.db
        .query("rateLimits")
        .collect()
        .then((r) => r.filter((x) => x.action === "firm_review_notice")),
    );
    expect(notices).toHaveLength(1);
  });

  it("lets only the admin approve or decline", async () => {
    const t = createTestContext();
    stub(TIED);
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    await t.mutation(internal.firmClaims.confirmByToken, { token });
    const id = await t.run(async (ctx) => ctx.db.insert("users", { email: "stranger@example.com" }));
    const stranger = t.withIdentity({ subject: id, email: "stranger@example.com" });
    await expect(stranger.mutation(api.firmClaims.approveProfile, { slug: SLUG })).rejects.toThrow(/Admin access required/);
    await expect(stranger.mutation(api.firmClaims.rejectProfile, { slug: SLUG })).rejects.toThrow(/Admin access required/);
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
  });

  it("holds the words in auto mode too, until an automatic check exists", async () => {
    const t = createTestContext();
    stub(TIED);
    vi.stubEnv("FIRM_PROFILE_REVIEW", "auto");
    await claimOverHttp(t, "jane@smithlaw.com");
    const token = await makeExpiringToken("jane@smithlaw.com", SECRET, "firm-confirm", Date.now() + 60_000);
    const res = await t.mutation(internal.firmClaims.confirmByToken, { token });
    expect(res?.submitted).toEqual([{ slug: SLUG, firmName: "Smith Immigration PLLC" }]);
    expect(await t.query(api.firmClaims.publishedProfile, { slug: SLUG })).toBeNull();
  });

  it("drops changes a revoked claimant sent", async () => {
    const t = createTestContext();
    stub(TIED);
    const admin = await live(t);
    await t.mutation(internal.firmClaims.saveProfile, {
      email: "jane@smithlaw.com",
      slug: SLUG,
      profile: { ...PROFILE, description: "Sent just before the revoke." },
    });
    const claim = (await claimRow(t, "jane@smithlaw.com"))!;
    await admin.mutation(api.firmClaims.revokeClaim, { claimId: claim._id });
    expect((await admin.query(api.firmClaims.listForAdmin, {})).edits).toEqual([]);
  });
});
