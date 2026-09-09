import { describe, expect, it } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { parseSubscription } from "../casePushAlerts";

/**
 * The browser push subscription endpoint: what it refuses, that one browser
 * cannot watch more than ten cases, that stop closes every row, and that the
 * daily budget refuses with nothing written past it. The budget fill throws
 * if it never refuses, so a vacuous pass is impossible.
 */

const sub = (n: number) => JSON.stringify({ endpoint: `https://push.example/${n}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } });
const hash = (s: string) => s.padStart(64, "0").slice(0, 64);
const CASE = "G-100-25324-425560";

describe("casePushAlerts.subscribe", () => {
  it("narrows the browser's subscription to what web-push needs", () => {
    expect(parseSubscription(sub(1))?.endpoint).toBe("https://push.example/1");
    expect(parseSubscription("not json")).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "http://plain.example", keys: { p256dh: "x", auth: "y" } }))).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "https://ok.example", keys: { p256dh: "x" } }))).toBeNull();
    expect(parseSubscription(JSON.stringify({ endpoint: "https://ok.example", keys: { p256dh: "x", auth: "y" } }))).not.toBeNull();
  });

  it("stores one row per browser and case, and reports a repeat without a second row", async () => {
    const t = createTestContext();
    const first = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(first.ok).toBe(true);
    const again = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(again.ok).toBe(true);
    expect(again.message).toMatch(/already/);
    const rows = await t.query(internal.casePushAlerts.activeRows, {});
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

  it("lets one browser watch ten cases and not an eleventh", async () => {
    const t = createTestContext();
    for (let i = 0; i < 10; i++) {
      const r = await t.mutation(internal.casePushAlerts.subscribe, {
        caseNumber: `G-100-25324-4${String(i).padStart(5, "0")}`,
        subscription: sub(1),
        endpointHash: hash("e1"),
        ipHash: hash(`ip${i}`),
      });
      expect(r.ok, `case ${i}`).toBe(true);
    }
    const eleventh = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip-x") });
    expect(eleventh.ok).toBe(false);
    expect(eleventh.message).toMatch(/10 cases/);
  });

  it("stop closes every row for the browser, and a later subscribe reopens with a fresh baseline", async () => {
    const t = createTestContext();
    await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: "P-100-26125-868956", subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const stopped = await t.mutation(internal.casePushAlerts.stop, { endpointHash: hash("e1") });
    expect(stopped.closed).toBe(2);
    expect(await t.query(internal.casePushAlerts.activeRows, {})).toHaveLength(0);
    const back = await t.mutation(internal.casePushAlerts.subscribe, { caseNumber: CASE, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip2") });
    expect(back.ok).toBe(true);
    const rows = await t.query(internal.casePushAlerts.activeRows, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastSeenStatus).toBeUndefined();
  });

  it("refuses everyone once the daily budget is spent, with nothing written past it", async () => {
    const t = createTestContext();
    const CAP = 220;
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
    expect(refusedAt).toBe(200);
    expect(await t.query(internal.casePushAlerts.activeRows, {})).toHaveLength(200);
  });
});
