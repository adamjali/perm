import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { addClick, cleanBrowser, cleanNote, looksLikeScanner, parseScore, ratingKey, ratingLink, scoreFrom } from "../alertRatings";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

/**
 * The 1-to-5 row in a case's last alert. Opening a box saves the pick at once
 * and goes straight on, for a case the address really watched, through a link
 * signed for rating and for nothing else; opens that look like a mail
 * scanner's are kept but never count as the rating.
 */

const SECRET = "test-secret";
const CASE = "G-100-26010-550166";
const EMAIL = "waiting@example.com";
/** A person's phone browser. */
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

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
  /** Opens a box the way the email does, as the given browser. */
  const open = async (t: ReturnType<typeof createTestContext>, score: number, browser: string | null = PHONE) =>
    t.fetch(await linkPath(score), { method: "GET", redirect: "manual", headers: browser ? { "user-agent": browser } : {} });

  it("saves a 3, 4 or 5 opened in the email at once, with when and which browser, and goes straight to the review form", async () => {
    const t = createTestContext();
    await watching(t);
    const res = await open(t, 4);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location") ?? "").toMatch(/^https:\/\/permtracker\.app\/reviews\?rating=4&t=[A-Za-z0-9_%-]+#write$/);
    const [row] = await ratings(t);
    expect(row).toMatchObject({ email: EMAIL, caseNumber: CASE, score: 4 });
    expect(row!.clicks).toHaveLength(1);
    expect(row!.clicks![0]).toMatchObject({ score: 4, via: "email", browser: PHONE });
    expect(row!.clicks![0]!.scanner).toBeUndefined();
  });

  it("saves a 1 or 2 opened in the email and opens the page that asks what went wrong", async () => {
    const t = createTestContext();
    await watching(t);
    const res = await open(t, 2);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/Sorry they fell short/);
    expect(html).toMatch(/What went wrong\?/);
    expect((await ratings(t))[0]).toMatchObject({ score: 2 });
  });

  it("counts nothing when a scanner opens every box, and still counts the person who taps later", async () => {
    const t = createTestContext();
    await watching(t);
    for (const score of [1, 2, 3, 4, 5]) await open(t, score);
    let [row] = await ratings(t);
    expect(row!.score).toBeUndefined();
    expect(row!.clicks!.every((c) => c.scanner)).toBe(true);
    // The person opens the email minutes later.
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("alertRatings").first())!;
      await ctx.db.patch(r._id, { clicks: r.clicks!.map((c) => ({ ...c, at: c.at - 5 * 60_000 })) });
    });
    await open(t, 5);
    [row] = await ratings(t);
    expect(row!.score).toBe(5);
    expect(row!.clicks![row!.clicks!.length - 1]!.scanner).toBeUndefined();
  });

  it("never counts an open from a fetcher's browser line, or from none", async () => {
    for (const browser of ["python-requests/2.32.3", "Mozilla/5.0 (compatible; Barracuda Sentinel)", null]) {
      const t = createTestContext();
      await watching(t);
      await open(t, 5, browser);
      const [row] = await ratings(t);
      expect(row!.score).toBeUndefined();
      expect(row!.clicks![0]!.scanner).toBe(true);
    }
  });

  it("stops writing a link opened in a loop, and still goes on to the page", async () => {
    const t = createTestContext();
    await watching(t);
    expect((await open(t, 4)).status).toBe(303);
    const first = (await ratings(t))[0]!.clicks![0]!.at;
    for (let i = 1; i < 24; i++) expect((await open(t, 4)).status).toBe(303);
    const [row] = await ratings(t);
    expect(row!.clicks!.length).toBe(20);
    // Writing stopped at 20: the first open is still the oldest kept, where a trim would have dropped it.
    expect(row!.clicks![0]!.at).toBe(first);
    expect(row!.score).toBe(4);
  });

  it("shows the boxes, and saves nothing, for a link without a score", async () => {
    const t = createTestContext();
    await watching(t);
    const res = await t.fetch(await linkPath(), { method: "GET", headers: { "user-agent": PHONE } });
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/<form method="POST" action="\/case-alert\/rate\?token=[^"]+&amp;c=G-100-26010-550166"/);
    expect(await ratings(t)).toHaveLength(0);
  });

  it("refuses a link for a case the address never watched, and saves nothing", async () => {
    const t = createTestContext();
    const res = await open(t, 5);
    expect(res.status).toBe(400);
    expect(await ratings(t)).toHaveLength(0);
  });

  const post = (t: ReturnType<typeof createTestContext>, fields: Record<string, string>) =>
    linkPath().then((path) =>
      t.fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields).toString(),
        redirect: "manual",
      }),
    );
  const tap = async (t: ReturnType<typeof createTestContext>, fields: Record<string, string>) => {
    const res = await post(t, fields);
    expect(res.status).toBe(200);
    return res.text();
  };

  it("sends a 3, 4 or 5 straight to the review form, its stars picked and the address sealed in", async () => {
    for (const score of [3, 4, 5]) {
      const t = createTestContext();
      await watching(t);
      const res = await post(t, { r: String(score) });
      expect(res.status).toBe(303);
      const to = res.headers.get("Location") ?? "";
      expect(to).toMatch(new RegExp(`^https://permtracker\\.app/reviews\\?rating=${score}&t=[A-Za-z0-9_%-]+#write$`));
      // The address is sealed: neither plain nor base64 is readable in the link.
      expect(to).not.toContain("waiting");
      expect(to).not.toContain(btoa(EMAIL).replace(/=+$/, "").slice(0, 12));
      expect((await ratings(t))[0]).toMatchObject({ score });
    }
  });

  it("still takes a note sent with a 3, 4 or 5 and thanks for it", async () => {
    const t = createTestContext();
    await watching(t);
    const html = await tap(t, { r: "5", note: "Faster alerts please" });
    expect(html).toMatch(/Thanks, glad they helped/);
    expect((await ratings(t))[0]).toMatchObject({ score: 5, note: "Faster alerts please" });
  });

  it("says sorry to a 1 or a 2, asks what went wrong, and still offers the review link", async () => {
    const t = createTestContext();
    await watching(t);
    const html = await tap(t, { r: "2" });
    expect(html).toMatch(/Sorry they fell short/);
    expect(html).toMatch(/What went wrong\?/);
    // Inviting only happy raters to review is deceptive (16 CFR 255.2, Example 11).
    expect(html).toContain("permtracker.app/reviews?rating=");
  });

  it("sends a certified case onward to the green card, and a denied one to its options", async () => {
    const certified = createTestContext();
    await watching(certified);
    expect(await tap(certified, { r: "2" })).toContain("/guides/waiting-on-your-green-card");

    const denied = createTestContext();
    await watching(denied, CASE, "DENIED");
    const html = await tap(denied, { r: "1" });
    expect(html).toContain("/guides/perm-denied-what-happens-next");
    expect(html).not.toContain("/guides/waiting-on-your-green-card");
    expect(html).not.toContain("/tools/green-card-line");
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

  it("tells a person's browser from a fetcher's", () => {
    expect(looksLikeScanner(PHONE)).toBe(false);
    expect(looksLikeScanner("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36")).toBe(false);
    for (const b of ["Googlebot/2.1", "curl/8.4.0", "Mozilla/5.0 HeadlessChrome/120", "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0)", undefined]) {
      expect(looksLikeScanner(b), String(b)).toBe(true);
    }
    expect(cleanBrowser("a\u0000b\nc")).toBe("a b c");
    expect(cleanBrowser("x".repeat(900))!.length).toBe(300);
  });

  it("marks a burst of different scores a scanner's, and scores the newest pick a person made", () => {
    const at = 1_000_000;
    let clicks = addClick([], { score: 1, at, via: "email" });
    clicks = addClick(clicks, { score: 2, at: at + 3_000, via: "email" });
    expect(clicks.every((c) => c.scanner)).toBe(true);
    expect(scoreFrom(clicks)).toBeUndefined();
    // The same box opened twice is one person, not a burst.
    const same = addClick(addClick([], { score: 4, at, via: "email" }), { score: 4, at: at + 2_000, via: "email" });
    expect(scoreFrom(same)).toBe(4);
    // A tap on the page is a person, whatever came before it.
    expect(scoreFrom(addClick(clicks, { score: 3, at: at + 4_000, via: "page" }))).toBe(3);
    // Only the newest are kept.
    let many: ReturnType<typeof addClick> = [];
    for (let i = 0; i < 30; i++) many = addClick(many, { score: 5, at: at + i * 120_000, via: "email" });
    expect(many).toHaveLength(20);
  });

  it("keeps a note as plain text, capped", () => {
    expect(cleanNote("  <script>x</script> hi\u0007 ")).toBe("x hi");
    expect(cleanNote("a".repeat(5000))!.length).toBe(1000);
    expect(cleanNote("   ")).toBeUndefined();
  });
});
