/**
 * The site's own reviews end to end: the form's route, the budgets, double sends, the owner's approval and
 * decline reasons, what the public read hands back (never an address, never an insider), prefill from a sealed
 * link and for a signed-in reader, the 90-day scrub of declined reviews, and the copy from Senja (once per
 * review). The field rules are tested in convex/lib/siteReview.test.ts, the sealed token in sealedEmail.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { DECLINED_KEEP_MS, GLOBAL_PER_DAY, IP_LIMIT, NOTE_KEEP_MS, NOTE_WINDOW_MS, THANKS } from "../siteReviews";
import { sealEmail } from "../lib/sealedEmail";
import { buildDefaultProfile } from "../lib/userDefaults";
import { INSIDER_REVIEW_IDS } from "../../src/lib/reviews/senjaParse";

type T = ReturnType<typeof createTestContext>;

const ADMIN = "admin@reviews-test.com";
const SECRET = "test-unsubscribe-secret-value";
const [INSIDER] = [...INSIDER_REVIEW_IDS];
const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("REVALIDATE_SECRET", "test-secret");
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  // Scheduled refreshes and owner emails run in the background; none may leave the test.
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const REVIEW = { rating: 4, text: "It told me the day my case moved.", name: "Pat", elapsed: 30_000 };

function post(t: T, body: Record<string, unknown>, ip = "203.0.113.7", path = "/review/submit") {
  return t.fetch(path, {
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
    const reply = (await res.json()) as { ok: boolean; message: string; reviewId?: string };
    expect(reply).toMatchObject({ ok: true, message: THANKS });
    const [row] = await rows(t);
    // The id goes back only to the browser that sent it, for the thanks screen's private note.
    expect(reply.reviewId).toBe(row?._id);
    expect(row).toMatchObject({ rating: 4, name: "Pat", email: "pat@example.com", status: "pending", source: "site" });
    expect(row?.quick).toBeUndefined();
    expect(await t.query(api.siteReviews.listPublished, {})).toEqual([]);
  });

  it("stores a rating with no words", async () => {
    const t = createTestContext();
    expect((await post(t, { rating: 5, name: "Pat", elapsed: 30_000 })).status).toBe(200);
    expect((await rows(t))[0]).toMatchObject({ rating: 5, text: "", status: "pending" });
  });

  it("answers a filled honeypot as if it worked and stores nothing", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, website: "https://spam.example" });
    expect(res.status).toBe(200);
    expect(await rows(t)).toHaveLength(0);
  });

  it("keeps a send faster than a person likely could, marked for the owner, never dropped", async () => {
    const t = createTestContext();
    expect((await post(t, { ...REVIEW, elapsed: 400 })).status).toBe(200);
    expect((await post(t, { ...REVIEW, text: "No timing at all.", elapsed: undefined })).status).toBe(200);
    expect((await rows(t)).map((r) => r.quick)).toEqual([true, true]);
  });

  it("stores a double send once", async () => {
    const t = createTestContext();
    expect((await post(t, REVIEW)).status).toBe(200);
    expect((await post(t, REVIEW)).status).toBe(200);
    expect(await rows(t)).toHaveLength(1);
  });

  it("refuses a bad review with the field and the reason, and stores nothing", async () => {
    const t = createTestContext();
    const res = await post(t, { ...REVIEW, rating: 9 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, field: "rating" });
    const link = await post(t, { ...REVIEW, text: "Great site, also try https://spam.example" });
    expect(await link.json()).toMatchObject({ field: "text", message: expect.stringMatching(/links/) });
    expect(await rows(t)).toHaveLength(0);
  });

  it("refuses a body far larger than any review, and a body that isn't an object", async () => {
    const t = createTestContext();
    expect((await post(t, { ...REVIEW, text: "x".repeat(20_000) })).status).toBe(413);
    const arr = await t.fetch("/review/submit", { method: "POST", body: "[1,2,3]" });
    expect(arr.status).toBe(400);
    const junk = await t.fetch("/review/submit", { method: "POST", body: "{not json" });
    expect(junk.status).toBe(400);
    expect(await rows(t)).toHaveLength(0);
  });

  it("stops at the day's budget for everyone together, before writing", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < GLOBAL_PER_DAY; i++) {
        await ctx.db.insert("siteReviews", { rating: 5, text: `Seeded review ${i}.`, name: `R${i}`, status: "pending", source: "site", createdAt: Date.now() - 1000 });
      }
    });
    const res = await post(t, REVIEW);
    expect(res.status).toBe(429);
    expect(await rows(t)).toHaveLength(GLOBAL_PER_DAY);
  });

  it("slows one address down after a few in an hour", async () => {
    const t = createTestContext();
    for (let i = 0; i < IP_LIMIT.limit; i++) expect((await post(t, { ...REVIEW, text: `Review number ${i}.` })).status).toBe(200);
    expect((await post(t, { ...REVIEW, text: "One more." })).status).toBe(429);
    expect((await post(t, { ...REVIEW, text: "From elsewhere." }, "198.51.100.9")).status).toBe(200);
  });
});

describe("prefill from a link we sent", () => {
  it("opens to the address, with a first name when the address has an account", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "pat@example.com" });
      await ctx.db.insert("userProfiles", { ...buildDefaultProfile(userId), fullName: "Pat Kim" });
    });
    const token = await sealEmail("pat@example.com", SECRET, Date.now() + 60_000);
    const res = await post(t, { t: token }, undefined, "/review/prefill");
    expect(await res.json()).toEqual({ email: "pat@example.com", name: "Pat" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers empty for an expired, altered or foreign token", async () => {
    const t = createTestContext();
    const expired = await sealEmail("pat@example.com", SECRET, Date.now() - 1);
    const foreign = await sealEmail("pat@example.com", "a-different-secret-value", Date.now() + 60_000);
    for (const tok of [expired, foreign, "junk", undefined]) {
      expect(await (await post(t, { t: tok }, undefined, "/review/prefill")).json()).toEqual({});
    }
  });

  it("marks a review sent with the link's address as confirmed, and fills a left-blank address", async () => {
    const t = createTestContext();
    const token = await sealEmail("pat@example.com", SECRET, Date.now() + 60_000);
    await post(t, { ...REVIEW, t: token });
    await post(t, { ...REVIEW, text: "Typed someone else's address.", email: "other@example.com", t: token });
    const [blank, other] = await rows(t);
    expect(blank).toMatchObject({ email: "pat@example.com", viaLink: true });
    expect(other).toMatchObject({ email: "other@example.com" });
    expect(other?.viaLink).toBeUndefined();
  });
});

describe("prefill for a signed-in reader", () => {
  it("gives the account's first name and address, and nothing to someone signed out", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { email: "lee@example.com" });
      await ctx.db.insert("userProfiles", { ...buildDefaultProfile(id), fullName: "Lee Park" });
      return id;
    });
    const me = t.withIdentity({ subject: userId, email: "lee@example.com" });
    expect(await me.query(api.siteReviews.prefillForMe, {})).toEqual({ name: "Lee", email: "lee@example.com" });
    expect(await t.query(api.siteReviews.prefillForMe, {})).toBeNull();
  });
});

describe("approving, declining and the public read", () => {
  it("shows an approved review newest first, never with its address, and hides it again on decline with a reason", async () => {
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

    await admin.mutation(api.siteReviews.decline, { id: newer, reason: "unrelated" });
    expect((await t.query(api.siteReviews.listPublished, {})).map((r) => r.name)).toEqual(["Sam"]);
    expect((await t.run((ctx) => ctx.db.get(newer)))?.declineReason).toBe("unrelated");
  });

  it("lets only the admin approve, decline or list", async () => {
    const t = createTestContext();
    const id = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "A real review.", name: "Pat", status: "pending", source: "site", createdAt: 1 }),
    );
    const stranger = await t.run(async (ctx) => ctx.db.insert("users", { email: "someone@example.com" }));
    const them = t.withIdentity({ subject: stranger, email: "someone@example.com" });
    await expect(them.mutation(api.siteReviews.approve, { id })).rejects.toThrow();
    await expect(them.mutation(api.siteReviews.decline, { id, reason: "spam" })).rejects.toThrow();
    await expect(t.mutation(api.siteReviews.approve, { id })).rejects.toThrow();
    await expect(t.query(api.siteReviews.listForAdmin, {})).rejects.toThrow();
    expect((await rows(t))[0]?.status).toBe("pending");
  });

  it("never shows or counts an insider's review, even approved", async () => {
    const t = createTestContext();
    await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "From the team.", name: "Team", status: "approved", source: "senja", insider: true, createdAt: 1 }),
    );
    expect(await t.query(api.siteReviews.listPublished, {})).toEqual([]);
  });

  it("tells the admin when a reviewer's address watches a case, and flags fast sends", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", { email: "pat@example.com", caseNumber: "G-100-26070-123456", createdAt: 1, confirmedAt: 2 });
      await ctx.db.insert("siteReviews", { rating: 5, text: "A real review.", name: "Pat", email: "pat@example.com", status: "pending", source: "site", createdAt: 3 });
      await ctx.db.insert("siteReviews", { rating: 5, text: "Another review.", name: "Sam", email: "sam@example.com", status: "pending", source: "site", createdAt: 4, quick: true });
    });
    const admin = await adminAuth(t);
    const { waiting } = await admin.query(api.siteReviews.listForAdmin, {});
    expect(waiting.map((r) => [r.name, r.watchesCase, r.quick])).toEqual([
      ["Pat", true, false],
      ["Sam", false, true],
    ]);
  });
});

describe("keeping nothing longer than needed", () => {
  it("deletes a declined review's words, name and address 90 days after the decision, keeping its rating and reason", async () => {
    const t = createTestContext();
    const now = Date.now();
    const old = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 1, text: "Spam text.", name: "Spammer", email: "s@example.com", status: "declined", declineReason: "spam", source: "site", createdAt: 1, reviewedAt: now - DECLINED_KEEP_MS - 1000 }),
    );
    const recent = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 2, text: "Recent decline.", name: "Recent", status: "declined", declineReason: "other", source: "site", createdAt: 2, reviewedAt: now - 1000 }),
    );
    const shown = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 5, text: "Shown review.", name: "Pat", status: "approved", source: "site", createdAt: 3, reviewedAt: now - DECLINED_KEEP_MS * 2 }),
    );
    expect(await t.mutation(internal.siteReviews.scrubDeclined, {})).toEqual({ scrubbed: 1, notes: 0 });
    const [a, b, c] = await t.run(async (ctx) => [await ctx.db.get(old), await ctx.db.get(recent), await ctx.db.get(shown)]);
    expect(a).toMatchObject({ rating: 1, text: "", name: "", declineReason: "spam" });
    expect(a?.email).toBeUndefined();
    expect(b?.text).toBe("Recent decline.");
    expect(c?.text).toBe("Shown review.");
    const admin = await adminAuth(t);
    await expect(admin.mutation(api.siteReviews.approve, { id: old })).rejects.toThrow(/deleted/);
  });
});

describe("a private note after a low rating", () => {
  const note = (t: T, reviewId: unknown, text: unknown) => post(t, { reviewId, note: text }, "203.0.113.7", "/review/note");
  const idOf = async (t: T, body: Record<string, unknown>) => ((await (await post(t, body)).json()) as { reviewId: string }).reviewId;

  it("adds one note to a review of 3 stars or fewer, private: the admin sees it, the public read never does", async () => {
    const t = createTestContext();
    const id = await idOf(t, { ...REVIEW, rating: 2, text: "It missed my RFI." });
    const res = await note(t, id, "  Tell me when an RFI\u202E comes in.  ");
    expect(res.status).toBe(200);
    expect((await rows(t))[0]).toMatchObject({ privateNote: "Tell me when an RFI comes in." });
    // A second note to the same review is refused, and the first is kept.
    expect((await note(t, id, "Another thought.")).status).toBe(409);
    expect((await rows(t))[0]?.privateNote).toBe("Tell me when an RFI comes in.");
    const admin = await adminAuth(t);
    await admin.mutation(api.siteReviews.approve, { id: (await rows(t))[0]!._id });
    expect(JSON.stringify(await t.query(api.siteReviews.listPublished, {}))).not.toContain("RFI comes in");
    const { decided } = await admin.query(api.siteReviews.listForAdmin, {});
    expect(decided[0]?.privateNote).toBe("Tell me when an RFI comes in.");
  });

  it("refuses a note on a 4 or 5, after the window, to a review that isn't there, and an empty one", async () => {
    const t = createTestContext();
    const happy = await idOf(t, { ...REVIEW, rating: 5, text: "All good." });
    expect((await note(t, happy, "Nothing to add.")).status).toBe(409);
    const late = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 1, text: "", name: "Late", status: "pending", source: "site", createdAt: Date.now() - NOTE_WINDOW_MS - 1000 }),
    );
    expect((await note(t, late, "Too late now.")).status).toBe(409);
    expect((await note(t, "not-a-real-id", "Hello there.")).status).toBe(409);
    expect((await note(t, undefined, "Hello there.")).status).toBe(400);
    const low = await idOf(t, { ...REVIEW, rating: 1, text: "Fell short." });
    expect((await note(t, low, "   ")).status).toBe(400);
    expect((await rows(t)).every((r) => r.privateNote === undefined)).toBe(true);
  });

  it("deletes a note 90 days after it was written, keeping the review", async () => {
    const t = createTestContext();
    const now = Date.now();
    const old = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 2, text: "Shown words.", name: "Pat", status: "approved", source: "site", createdAt: 1, privateNote: "Old note.", privateNoteAt: now - NOTE_KEEP_MS - 1000 }),
    );
    const fresh = await t.run((ctx) =>
      ctx.db.insert("siteReviews", { rating: 3, text: "", name: "Sam", status: "pending", source: "site", createdAt: 2, privateNote: "New note.", privateNoteAt: now - 1000 }),
    );
    expect(await t.mutation(internal.siteReviews.scrubDeclined, {})).toEqual({ scrubbed: 0, notes: 1 });
    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(old), await ctx.db.get(fresh)]);
    expect(a?.privateNote).toBeUndefined();
    expect(a?.text).toBe("Shown words.");
    expect(b?.privateNote).toBe("New note.");
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
