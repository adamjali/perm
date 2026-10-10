import { describe, expect, it } from "vitest";

import { createTestContext, fillRateWindow } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { CASES_PER_BROWSER, GLOBAL_BUDGET } from "../casePushAlerts";
import { parseSubscription } from "../casePushAlerts";

/**
 * The browser push subscription endpoint: what it refuses, that one browser
 * cannot watch more than ten cases, that stop closes every row, and that the
 * daily budget refuses with nothing written past it. The budget fill throws
 * if it never refuses, so a vacuous pass is impossible.
 */

const sub = (n: number) => JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } });
const hash = (s: string) => s.padStart(64, "0").slice(0, 64);
const CASE = "G-100-25324-425560";

describe("casePushAlerts.subscribe", () => {
  it("narrows the browser's subscription to what web-push needs", () => {
    expect(parseSubscription(sub(1))?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/1");
    expect(parseSubscription("not json")).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "http://plain.example", keys: { p256dh: "x", auth: "y" } }))).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "https://web.push.apple.com/x", keys: { p256dh: "x" } }))).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "https://web.push.apple.com/x", keys: { p256dh: "x", auth: "y" } }))).not.toBeNull();
    // Only the browsers' own push services: every host production holds, and nothing else.
    for (const ok of ["https://fcm.googleapis.com/fcm/send/a", "https://updates.push.services.mozilla.com/wpush/v2/a",
      "https://wns2-by3p.notify.windows.com/w/?token=a", "https://web.push.apple.com/a"]) {
      expect(parseSubscription(JSON.stringify({ endpoint: ok, keys: { p256dh: "x", auth: "y" } })), ok).not.toBeNull();
    }
    for (const bad of ["https://ok.example/a", "https://fcm.googleapis.com.evil.example/a", "https://evilnotify.windows.com.example/a",
      "https://fcm.googleapis.com:8443/a"]) {
      expect(parseSubscription(JSON.stringify({ endpoint: bad, keys: { p256dh: "x", auth: "y" } })), bad).toBeNull();
    }
  });

  it("stores one row per browser and case, and reports a repeat without a second row", async () => {
    const t = createTestContext();
    const first = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(first.ok).toBe(true);
    const again = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(again.ok).toBe(true);
    expect(again.message).toMatch(/already/);
    const { rows } = await t.query(internal.casePushAlerts.activeRows, { cursor: null });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastSeenStatus).toBeUndefined();
  });

  it("refuses a bad case number or subscription before charging any limit", async () => {
    const t = createTestContext();
    const bad = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: "hello", subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(bad.ok).toBe(false);
    const badSub = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: "{}", endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(badSub.ok).toBe(false);
    const limits = await t.run(async (ctx) => ctx.db.query("rateLimits").take(100));
    expect(limits).toHaveLength(0);
  });

  it("lets one browser watch its allowance of cases and not one more", async () => {
    const t = createTestContext();
    for (let i = 0; i < CASES_PER_BROWSER; i++) {
      const r = await t.mutation(internal.casePushAlerts.subscribe, {
        caseNumber: `G-100-25324-4${String(i).padStart(5, "0")}`,
        subscription: sub(1),
        endpointHash: hash("e1"),
        ipHash: hash(`ip${i}`),
      });
      expect(r.ok, `case ${i}`).toBe(true);
    }
    const oneMore = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip-x") });
    expect(oneMore.ok).toBe(false);
    expect(oneMore.message).toMatch(new RegExp(`${CASES_PER_BROWSER} cases`));
  });

  it("stop closes every row for the browser, and a later subscribe reopens with a fresh baseline", async () => {
    const t = createTestContext();
    await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: "P-100-26125-868956", subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const stopped = await t.mutation(internal.casePushAlerts.stop, { endpointHash: hash("e1") });
    expect(stopped.closed).toBe(2);
    expect((await t.query(internal.casePushAlerts.activeRows, { cursor: null })).rows).toHaveLength(0);
    const back = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip2") });
    expect(back.ok).toBe(true);
    const { rows } = await t.query(internal.casePushAlerts.activeRows, { cursor: null });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastSeenStatus).toBeUndefined();
  });

  it("lets one of two sweeps claim a new status, and puts the old one back when delivery fails", async () => {
    const t = createTestContext();
    await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const { rows } = await t.query(internal.casePushAlerts.activeRows, { cursor: null });
    const id = rows[0]!._id;
    await t.mutation(internal.casePushAlerts.seed, { id, status: "ANALYST REVIEW" });
    const first = await t.mutation(internal.casePushAlerts.claimPush, { id, status: "RFI ISSUED" });
    const second = await t.mutation(internal.casePushAlerts.claimPush, { id, status: "RFI ISSUED" });
    expect([first, second]).toEqual([true, false]);
    await t.mutation(internal.casePushAlerts.unclaimPush, { id, claimed: "RFI ISSUED", previous: "ANALYST REVIEW" });
    expect(await t.mutation(internal.casePushAlerts.claimPush, { id, status: "RFI ISSUED" })).toBe(true);
  });

  it("reads open subscriptions page by page, so rows past the first page are reached", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < 2005; i++) {
        await ctx.db.insert("caseStatusPushAlerts", {
          caseNumber: `G-100-25324-${String(200000 + i)}`,
          subscription: sub(i),
          endpointHash: hash(`p${i}`),
          failures: 0,
          createdAt: Date.now(),
        });
      }
    });
    const first = await t.query(internal.casePushAlerts.activeRows, { cursor: null });
    expect(first.isDone).toBe(false);
    const second = await t.query(internal.casePushAlerts.activeRows, { cursor: first.cursor });
    expect(first.rows.length + second.rows.length).toBe(2005);
    expect(second.isDone).toBe(true);
  });

  it("refuses everyone once the daily budget is spent, with nothing written past it", async () => {
    const t = createTestContext();
    const LEFT = 3;
    await fillRateWindow(t, "all", "push-subscribe-global", GLOBAL_BUDGET.limit - LEFT);
    const CAP = LEFT + 20;
    let refusedAt = -1;
    for (let i = 0; i < CAP; i++) {
      const r = await t.mutation(internal.casePushAlerts.subscribe, {
        caseNumber: `G-100-25324-${String(100000 + i)}`,
        subscription: sub(i),
        endpointHash: hash(`e${i}`),
        ipHash: hash(`ip${i}`),
      });
      if (!r.ok) {
        expect(r.throttled).toBe(true);
        refusedAt = i;
        break;
      }
    }
    if (refusedAt < 0) throw new Error(`budget not exhausted after ${CAP} subscriptions`);
    expect(refusedAt).toBe(LEFT);
    expect((await t.query(internal.casePushAlerts.activeRows, { cursor: null })).rows).toHaveLength(LEFT);
  });
});
