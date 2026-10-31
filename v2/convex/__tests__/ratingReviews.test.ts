/**
 * A rating tapped in a case's last alert becomes a review waiting for the owner (owner's call, Oct 31 2026):
 * stars only, "Case alert reader", no address kept on it, one per person, every score alike, and a written review
 * from the same person takes its place once approved. The form's own daily budget is the form's alone.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { ALERT_READER_NAME, GLOBAL_PER_DAY, raterKeyFor } from "../siteReviews";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

type T = ReturnType<typeof createTestContext>;

const SECRET = "test-secret";
const ADMIN = "admin@rating-reviews-test.com";
const EMAIL = "waiting@example.com";
const CASE = "G-100-26010-550166";
const OTHER_CASE = "G-100-26011-550200";
const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("REVALIDATE_SECRET", "test-secret");
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

async function watching(t: T, caseNumber = CASE) {
  await t.run(async (ctx) => {
    await ctx.db.insert("caseStatusAlerts", { email: EMAIL, caseNumber, createdAt: 1, confirmedAt: 1, lastSeenStatus: "CERTIFIED" });
  });
}

async function rate(t: T, score: number, caseNumber = CASE) {
  const token = await makeUnsubscribeToken(EMAIL, SECRET, "alert-rating");
  return t.mutation(internal.alertRatings.record, { token, caseNumber, score });
}

const reviews = (t: T) => t.run((ctx) => ctx.db.query("siteReviews").collect());
const tally = (t: T) => t.run(async (ctx) => (await ctx.db.query("siteReviewTally").first())?.stars ?? null);

async function adminAuth(t: T) {
  const id = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
  return t.withIdentity({ subject: id, email: ADMIN });
}

describe("a rating from an alert email", () => {
  it("waits for the owner as a review with no words, no name and no address", async () => {
    // Arrange
    const t = createTestContext();
    await watching(t);
    // Act
    await rate(t, 5);
    // Assert
    const rows = await reviews(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "alert",
      status: "pending",
      rating: 5,
      text: "",
      name: ALERT_READER_NAME,
      raterKey: await raterKeyFor(EMAIL),
    });
    expect(rows[0]!.email).toBeUndefined();
  });

  it("counts every score the same, a 1 included", async () => {
    const t = createTestContext();
    await watching(t);
    await rate(t, 1);
    expect((await reviews(t))[0]).toMatchObject({ rating: 1, status: "pending" });
  });

  it("is one review per person: a second case updates it with the newest score", async () => {
    const t = createTestContext();
    await watching(t);
    await watching(t, OTHER_CASE);
    await rate(t, 4);
    await rate(t, 2, OTHER_CASE);
    const rows = await reviews(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rating).toBe(2);
  });

  it("moves the count when a posted rating's score changes", async () => {
    // Arrange: the rating posted, the tally counting its 5.
    const t = createTestContext();
    await watching(t);
    await rate(t, 5);
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("siteReviews").first())!;
      await ctx.db.patch(r._id, { status: "approved" });
      await ctx.db.insert("siteReviewTally", { key: "shown", stars: [0, 0, 0, 0, 1], updatedAt: 1 });
    });
    // Act
    await rate(t, 3);
    // Assert
    expect(await tally(t)).toEqual([0, 0, 1, 0, 0]);
    expect((await reviews(t))[0]).toMatchObject({ rating: 3, status: "approved" });
  });

  it("isn't queued for someone who already wrote a review", async () => {
    const t = createTestContext();
    await watching(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("siteReviews", {
        rating: 4, text: "Useful.", name: "Pat", email: EMAIL, raterKey: await raterKeyFor(EMAIL),
        status: "approved", source: "site", createdAt: 1,
      });
    });
    await rate(t, 5);
    expect((await reviews(t)).filter((r) => r.source === "alert")).toHaveLength(0);
  });

  it("gives way to the same person's written review once that is approved", async () => {
    // Arrange: the rating posted, then the same person writes a review.
    const t = createTestContext();
    await watching(t);
    await rate(t, 5);
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("siteReviews").first())!;
      await ctx.db.patch(r._id, { status: "approved" });
      await ctx.db.insert("siteReviewTally", { key: "shown", stars: [0, 0, 0, 0, 1], updatedAt: 1 });
    });
    const sent = await t.mutation(internal.siteReviews.submit, {
      rating: 4, text: "It told me the day my case moved.", name: "Pat", email: EMAIL, ip: "203.0.113.7", quick: false,
    });
    expect(sent.ok).toBe(true);
    // The rating stays posted until the words are.
    expect((await reviews(t)).filter((r) => r.source === "alert" && r.status === "approved")).toHaveLength(1);
    // Act
    const admin = await adminAuth(t);
    const written = (await reviews(t)).find((r) => r.source === "site")!;
    await admin.mutation(api.siteReviews.approve, { id: written._id });
    // Assert: one person, one review, counted once.
    const rows = await reviews(t);
    expect(rows.map((r) => r.source)).toEqual(["site"]);
    expect(await tally(t)).toEqual([0, 0, 0, 1, 0]);
  });

  it("doesn't use up the review form's daily budget", async () => {
    // Arrange: a day's worth of alert ratings, more than the form's budget.
    const t = createTestContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < GLOBAL_PER_DAY + 5; i += 1) {
        await ctx.db.insert("siteReviews", {
          rating: 5, text: "", name: ALERT_READER_NAME, status: "pending", source: "alert", raterKey: `k${i}`, createdAt: Date.now(),
        });
      }
    });
    // Act
    const sent = await t.mutation(internal.siteReviews.submit, { rating: 5, text: "", name: "Sam", ip: "203.0.113.8", quick: false });
    // Assert
    expect(sent.ok).toBe(true);
  });

  it("shows on the site as a rating from an alert email, never with an address", async () => {
    const t = createTestContext();
    await watching(t);
    await rate(t, 5);
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("siteReviews").first())!;
      await ctx.db.patch(r._id, { status: "approved" });
    });
    const shown = await t.query(api.siteReviews.listPublished, {});
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ name: ALERT_READER_NAME, rating: 5, text: "", viaAlert: true });
    expect(JSON.stringify(shown)).not.toContain(EMAIL);
  });

  it("tells the owner who rated and for which case, and no one else", async () => {
    // Arrange
    const t = createTestContext();
    await watching(t);
    await rate(t, 5);
    // Act
    const admin = await adminAuth(t);
    const listed = await admin.query(api.siteReviews.listForAdmin, {});
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("siteReviews").first())!;
      await ctx.db.patch(r._id, { status: "approved" });
    });
    const shown = await t.query(api.siteReviews.listPublished, {});
    // Assert
    expect(listed.waiting[0]!.rater).toEqual({ email: EMAIL, caseNumber: CASE });
    expect(JSON.stringify(shown)).not.toContain(CASE);
  });

  it("queues chosen older ratings once, and says why it skips the rest", async () => {
    // Arrange: one rating with an address, one that went anonymous.
    const t = createTestContext();
    const [named, anonymous] = await t.run(async (ctx) => [
      await ctx.db.insert("alertRatings", { key: "a", email: EMAIL, caseNumber: CASE, score: 5, clicks: [], createdAt: 10, updatedAt: 10 }),
      await ctx.db.insert("alertRatings", { key: "b", anonymous: true, score: 4, clicks: [], createdAt: 11, updatedAt: 11 }),
    ]);
    // Act
    const dry = await t.mutation(internal.alertRatings.queueExistingAsReviews, { ids: [named, anonymous], dryRun: true });
    expect(await reviews(t)).toHaveLength(0);
    const done = await t.mutation(internal.alertRatings.queueExistingAsReviews, { ids: [named, anonymous], dryRun: false });
    // Assert
    expect(dry.map((d) => d.result)).toEqual(["would queue 5 of 5", "anonymous: no address to count it once"]);
    expect(done[0]!.result).toBe("queued 5 of 5");
    expect(await reviews(t)).toMatchObject([{ source: "alert", rating: 5, createdAt: 10, ratingId: named }]);
  });
});
