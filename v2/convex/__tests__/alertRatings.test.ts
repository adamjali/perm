import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { cleanNote, parseScore, ratingKey, ratingLink } from "../alertRatings";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

/**
 * The 1-to-5 row in a case's last alert. A box opens a page and records
 * nothing; the tap on that page records it, for a case the address really
 * watched, through a link signed for rating and for nothing else.
 */

const SECRET = "test-secret";
const CASE = "G-100-26010-550166";
const EMAIL = "waiting@example.com";

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function watching(t: ReturnType<typeof createTestContext>, caseNumber = CASE, status = "CERTIFIED") {
  await t.run(async (ctx) => {
    await ctx.db.insert("caseStatusAlerts", {
      email: EMAIL,
      caseNumber,
      createdAt: 1,
      confirmedAt: 1,
      lastSeenStatus: status,
    });
  });
}

const ratings = (t: ReturnType<typeof createTestContext>) =>
  t.run(async (ctx) => ctx.db.query("alertRatings").collect());

/** The path and query of a rating link, as the email's box would open it. */
async function linkPath(score?: number) {
  const url = new URL(await ratingLink(EMAIL, CASE, SECRET));
  return `${url.pathname}${url.search}${score ? `&r=${score}` : ""}`;
}

describe("record", () => {
  it("keeps a rating for a case the address watched, and a second tap replaces the score", async () => {
    const t = createTestContext();
    await watching(t);
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "alert-rating");
    expect(
      await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score: 4, note: "Very clear <b>thanks</b>" }),
    ).toMatchObject({ caseNumber: CASE, score: 4, noted: true, anonymous: false });
    await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score: 5 });
    const [row] = await ratings(t);
    expect(row).toMatchObject({
      key: await ratingKey(EMAIL, CASE),
      email: EMAIL,
      caseNumber: CASE,
      score: 5,
      note: "Very clear thanks",
    });
    expect(await ratings(t)).toHaveLength(1);
  });

  it("keeps an anonymous note apart from the address and the case, for good", async () => {
    const t = createTestContext();
    await watching(t);
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "alert-rating");
    await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score: 2 });
    const res = await t.mutation(internal.alertRatings.record, {
      token,
      caseNumber: CASE,
      score: 2,
      note: "Too many emails",
      anonymous: true,
    });
    expect(res).toMatchObject({ noted: true, anonymous: true });
    // A later tap without the box ticked can't put the address back.
    await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score: 3 });
    const all = await ratings(t);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ score: 3, note: "Too many emails", anonymous: true });
    expect(all[0]!.email).toBeUndefined();
    expect(all[0]!.caseNumber).toBeUndefined();
  });

  it("refuses a case the address never watched, so a link can't rate someone else's", async () => {
    const t = createTestContext();
    await watching(t, "G-100-26010-550163");
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "alert-rating");
    expect(await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score: 5 })).toBeNull();
    expect(await ratings(t)).toHaveLength(0);
  });

  it("refuses a token signed for anything else, and a score off the scale", async () => {
    const t = createTestContext();
    await watching(t);
    const unsub = await makeUnsubscribeToken(EMAIL, SECRET, "case-unsubscribe");
    expect(await t.mutation(internal.alertRatings.record, { token: unsub, caseNumber: CASE, score: 5 })).toBeNull();
    const token = await makeUnsubscribeToken(EMAIL, SECRET, "alert-rating");
    for (const score of [0, 6, 2.5]) {
      expect(await t.mutation(internal.alertRatings.record, { token, caseNumber: CASE, score })).toBeNull();
    }
    expect(await ratings(t)).toHaveLength(0);
  });
});

describe("the page", () => {
  it("opens with the email's pick marked and records nothing on the GET", async () => {
    const t = createTestContext();
    await watching(t);
    const res = await t.fetch(await linkPath(4), { method: "GET" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/How useful were these alerts\?/);
    expect(html).toMatch(/aria-label="4 of 5, your pick"/);
    // The note waits for the thanks page, which can ask the right question.
    expect(html).not.toContain("<textarea");
    expect(html).toMatch(/<form method="POST" action="\/case-alert\/rate\?token=[^"]+&amp;c=G-100-26010-550166"/);
    expect(await ratings(t)).toHaveLength(0);
  });

  const tap = async (t: ReturnType<typeof createTestContext>, fields: Record<string, string>) => {
    const res = await t.fetch(await linkPath(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
    expect(res.status).toBe(200);
    return res.text();
  };

  it("thanks a 4 or a 5 with gladness and a review link, then asks for a note", async () => {
    const t = createTestContext();
    await watching(t);
    const html = await tap(t, { r: "5" });
    expect(html).toMatch(/Thanks, glad they helped/);
    expect(html).toMatch(/You rated these alerts 5 of 5/);
    expect(html).toContain('href="https://senja.io/p/perm-tracker/r/FXAjpr"');
    expect(html).toMatch(/Anything we could do better\?/);
    expect(html).toMatch(/name="anon" value="1"/);
    expect((await ratings(t))[0]).toMatchObject({ score: 5 });
  });

  it("says sorry to a 1 or a 2, asks what went wrong, and offers no review link", async () => {
    const t = createTestContext();
    await watching(t);
    const html = await tap(t, { r: "2" });
    expect(html).toMatch(/Sorry they fell short/);
    expect(html).toMatch(/What went wrong\?/);
    expect(html).not.toContain("senja.io");
  });

  it("sends a certified case onward to the green card, and a denied one to its options", async () => {
    const certified = createTestContext();
    await watching(certified);
    expect(await tap(certified, { r: "5" })).toContain("/guides/waiting-on-your-green-card");

    const denied = createTestContext();
    await watching(denied, CASE, "DENIED");
    const html = await tap(denied, { r: "4" });
    expect(html).toContain("/guides/perm-denied-what-happens-next");
    expect(html).not.toContain("/guides/waiting-on-your-green-card");
    expect(html).not.toContain("/tools/green-card-line");
  });

  it("asks a 3 what would have made it a 5, without a review link", async () => {
    const t = createTestContext();
    await watching(t);
    const html = await tap(t, { r: "3" });
    expect(html).toMatch(/What would have made it a 5\?/);
    expect(html).not.toContain("senja.io");
  });

  it("takes the note from the thanks page and stops asking for one", async () => {
    const t = createTestContext();
    await watching(t);
    await tap(t, { r: "2" });
    const html = await tap(t, { r: "2", note: "More detail on RFIs", anon: "1" });
    expect(html).toMatch(/Thanks for the note, kept without your email/);
    expect(html).not.toContain("<textarea");
    expect((await ratings(t))[0]).toMatchObject({ score: 2, note: "More detail on RFIs", anonymous: true });
  });

  it("answers a forged link with the bad-link page", async () => {
    const t = createTestContext();
    const res = await t.fetch(`/case-alert/rate?token=forged&c=${CASE}&r=5`, { method: "GET" });
    expect(res.status).toBe(400);
  });
});

describe("helpers", () => {
  it("reads only whole scores from 1 to 5", () => {
    expect(parseScore("4")).toBe(4);
    expect([parseScore("0"), parseScore("6"), parseScore("4.5"), parseScore(null)]).toEqual([null, null, null, null]);
  });

  it("keeps a note as plain text, capped", () => {
    expect(cleanNote("  <script>x</script> hi\u0007 ")).toBe("x hi");
    expect(cleanNote("a".repeat(5000))!.length).toBe(1000);
    expect(cleanNote("   ")).toBeUndefined();
  });
});
