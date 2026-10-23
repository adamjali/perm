/**
 * The site's own reviews end to end: the form's route, the budgets, the owner's approval, what the public read
 * hands back (never an address, never an insider), and the copy from Senja (once per review). The field rules
 * are tested in convex/lib/siteReview.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { GLOBAL_PER_DAY, IP_LIMIT, THANKS } from "../siteReviews";
import { INSIDER_REVIEW_IDS } from "../../src/lib/reviews/senjaParse";

type T = ReturnType<typeof createTestContext>;

const ADMIN = "admin@reviews-test.com";
const [INSIDER] = [...INSIDER_REVIEW_IDS];
const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("REVALIDATE_SECRET", "test-secret");
  // Scheduled refreshes and owner emails run in the background; none may leave the test.
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const REVIEW = { rating: 4, text: "It told me the day my case moved.", name: "Pat", consent: true, elapsed: 30_000 };

function post(t: T, body: Record<string, unknown>, ip = "203.0.113.7") {
  return t.fetch("/review/submit", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const rows = (t: T) => t.run((ctx) => ctx.db.query("siteReviews").collect());

async function adminAuth(t: T) {
  const id = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
  return t.withIdentity({ subject: id, email: ADMIN });
}

describe("the review form's route", () => {
  it("stores a good review as waiting, unshown, and says so", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, email: "pat@example.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: THANKS });
    const [row] = await rows(t);
    expect(row).toMatchObject({ rating: 4, name: "Pat", email: "pat@example.com", status: "pending", source: "site" });
    expect(await t.query(api.siteReviews.listPublished, {})).toEqual([]);
  });

  it("answers a filled honeypot as if it worked and stores nothing", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, website: "https://spam.example" });
    expect(res.status).toBe(200);
    expect(await rows(t)).toHaveLength(0);
  });

  it("answers a post faster than anyone could write as if it worked, and stores nothing", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, elapsed: 400 });
    expect(res.status).toBe(200);
    expect(await rows(t)).toHaveLength(0);
  });

  it("refuses a review carrying a link, and says why", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, text: "Great site, also try https://spam.example" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/links/);
    expect(await rows(t)).toHaveLength(0);
  });

  it("refuses a bad review with the reason and stores nothing", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, rating: 9 });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/1 to 5 stars/);
    expect(await rows(t)).toHaveLength(0);
  });

  it("stops at the day's budget for everyone together, before writing", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < GLOBAL_PER_DAY; i++) {
        await ctx.db.insert("siteReviews", { rating: 5, text: "Seeded review.", name: `R${i}`, status: "pending", source: "site", createdAt: Date.now() - 1000 });
      }
    });
    const res = await post(t, REVIEW);
    expect(res.status).toBe(429);
    expect(await rows(t)).toHaveLength(GLOBAL_PER_DAY);
  });

  it("slows one address down after a few in an hour", async () => {
    const t = createTestContext();
    for (let i = 0; i < IP_LIMIT.limit; i++) expect((await post(t, REVIEW)).status).toBe(200);
    expect((await post(t, REVIEW)).status).toBe(429);
    expect((await post(t, REVIEW, "198.51.100.9")).status).toBe(200);
  });
});

describe("approving and the public read", () => {
  it("shows an approved review newest first, never with its address, and hides it again on decline", async () => {
    const t = createTestContext();
    const older = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "Older review here.", name: "Sam", email: "sam@example.com", status: "pending", source: "site", createdAt: 1000 }),
    );
    const newer = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 3, text: "Newer review here.", name: "Lee", status: "pending", source: "site", createdAt: 2000 }),
    );
    const admin = await adminAuth(t);
    await admin.mutation(api.siteReviews.approve, { id: older });
    await admin.mutation(api.siteReviews.approve, { id: newer });
    const shown = await t.query(api.siteReviews.listPublished, {});
    expect(shown.map((r) => r.name)).toEqual(["Lee", "Sam"]);
    expect(JSON.stringify(shown)).not.toContain("sam@example.com");

    await admin.mutation(api.siteReviews.decline, { id: newer });
    expect((await t.query(api.siteReviews.listPublished, {})).map((r) => r.name)).toEqual(["Sam"]);
  });

  it("lets only the admin approve", async () => {
    const t = createTestContext();
    const id = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "A real review.", name: "Pat", status: "pending", source: "site", createdAt: 1 }),
    );
    const stranger = await t.run(async (ctx) => ctx.db.insert("users", { email: "someone@example.com" }));
    await expect(t.withIdentity({ subject: stranger, email: "someone@example.com" }).mutation(api.siteReviews.approve, { id })).rejects.toThrow();
    await expect(t.mutation(api.siteReviews.approve, { id })).rejects.toThrow();
    expect((await rows(t))[0]?.status).toBe("pending");
  });

  it("never shows or counts an insider's review, even approved", async () => {
    const t = createTestContext();
    await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "From the team.", name: "Team", status: "approved", source: "senja", insider: true, createdAt: 1 }),
    );
    expect(await t.query(api.siteReviews.listPublished, {})).toEqual([]);
  });

  it("tells the admin when a reviewer's address watches a case", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", { email: "pat@example.com", caseNumber: "G-100-26070-123456", createdAt: 1, confirmedAt: 2 });
      await ctx.db.insert("siteReviews", { rating: 5, text: "A real review.", name: "Pat", email: "pat@example.com", status: "pending", source: "site", createdAt: 3 });
      await ctx.db.insert("siteReviews", { rating: 5, text: "Another review.", name: "Sam", email: "sam@example.com", status: "pending", source: "site", createdAt: 4 });
    });
    const admin = await adminAuth(t);
    const { waiting } = await admin.query(api.siteReviews.listForAdmin, {});
    expect(waiting.map((r) => [r.name, r.watchesCase])).toEqual([
      ["Pat", true],
      ["Sam", false],
    ]);
  });
});

describe("copying reviews left on Senja", () => {
  const senja = (senjaId: string, name: string) => ({ senjaId, rating: 5, text: "Left on Senja.", name, createdAt: 5000 });

  it("copies each review once, waiting for the owner; an insider's is kept and never shown", async () => {
    const t = createTestContext();
    const first = await t.mutation(internal.siteReviews.storeFromSenja, { reviews: [senja("s1", "Pat"), senja(INSIDER!, "Team")] });
    expect(first).toEqual({ added: 2, waiting: 1 });
    const again = await t.mutation(internal.siteReviews.storeFromSenja, { reviews: [senja("s1", "Pat"), senja(INSIDER!, "Team")] });
    expect(again).toEqual({ added: 0, waiting: 0 });
    const all = await rows(t);
    expect(all.map((r) => [r.name, r.status, r.insider === true])).toEqual([
      ["Pat", "pending", false],
      ["Team", "approved", true],
    ]);
    expect(await t.query(api.siteReviews.listPublished, {})).toEqual([]);
  });

  it("approves on the one-time first copy, for reviews the site already showed", async () => {
    const t = createTestContext();
    await t.mutation(internal.siteReviews.storeFromSenja, { reviews: [senja("s1", "Pat")], approve: true });
    expect((await t.query(api.siteReviews.listPublished, {})).map((r) => r.name)).toEqual(["Pat"]);
  });
});
