import { describe, expect, it } from "vitest";

import { createTestContext, fillRateWindow } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { GLOBAL_BUDGET, LINES_PER_BROWSER } from "../bulletinPushAlerts";
import { CATEGORIES, COUNTRIES } from "../bulletinAlerts";

/**
 * Browser push for a new visa bulletin: what subscribe refuses, the per-browser allowance, stop, the
 * first-sweep seed, and the claim that makes overlapping sweeps send once. The budget fill throws if it never
 * refuses, so a vacuous pass is impossible.
 */

const sub = (n: number) => JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } });
const hash = (s: string) => s.padStart(64, "0").slice(0, 64);
const line = { category: "EB2", country: "india" };

describe("bulletinPushAlerts", () => {
  it("stores one row per browser and line, and reports a repeat without a second row", async () => {
    const t = createTestContext();
    const first = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(first.ok).toBe(true);
    const again = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(again.message).toMatch(/already/);
    const { rows } = await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastSeenBulletin).toBeUndefined();
  });

  it("refuses an unknown line or a bad subscription before charging any limit", async () => {
    const t = createTestContext();
    const badLine = await t.mutation(internal.bulletinPushAlerts.subscribe, { category: "EB9", country: "india", subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(badLine.ok).toBe(false);
    const badSub = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: "{}", endpointHash: hash("e1"), ipHash: hash("ip1") });
    expect(badSub.ok).toBe(false);
    expect(await t.run(async (ctx) => ctx.db.query("rateLimits").take(100))).toHaveLength(0);
  });

  it("lets one browser follow its allowance of lines and not one more", async () => {
    const t = createTestContext();
    const lines = CATEGORIES.flatMap((c) => COUNTRIES.map((n) => ({ category: c, country: n })));
    for (let i = 0; i < LINES_PER_BROWSER; i++) {
      const r = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...lines[i]!, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash(`ip${i}`) });
      expect(r.ok, `line ${i}`).toBe(true);
    }
    const oneMore = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...lines[LINES_PER_BROWSER]!, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ipx") });
    expect(oneMore.ok).toBe(false);
    expect(oneMore.message).toMatch(new RegExp(`${LINES_PER_BROWSER} lines`));
  });

  it("stop closes the browser's lines, and a later subscribe starts again from a fresh baseline", async () => {
    const t = createTestContext();
    await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const { rows } = await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null });
    await t.mutation(internal.bulletinPushAlerts.seed, { id: rows[0]!._id, month: "2026-11", cutoff: "01NOV13" });
    expect((await t.mutation(internal.bulletinPushAlerts.stop, { endpointHash: hash("e1") })).closed).toBe(1);
    expect((await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null })).rows).toHaveLength(0);
    await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const back = (await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null })).rows;
    expect(back).toHaveLength(1);
    expect(back[0]?.lastSeenBulletin).toBeUndefined();
  });

  it("claims a new bulletin once, so two sweeps at once send once; an older or the same month is no claim", async () => {
    const t = createTestContext();
    await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(1), endpointHash: hash("e1"), ipHash: hash("ip1") });
    const id = (await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null })).rows[0]!._id;
    await t.mutation(internal.bulletinPushAlerts.seed, { id, month: "2026-11", cutoff: "01NOV13" });
    expect(await t.mutation(internal.bulletinPushAlerts.claim, { id, month: "2026-11", cutoff: "01NOV13" })).toBe(false);
    expect(await t.mutation(internal.bulletinPushAlerts.claim, { id, month: "2026-12", cutoff: "01JAN14" })).toBe(true);
    expect(await t.mutation(internal.bulletinPushAlerts.claim, { id, month: "2026-12", cutoff: "01JAN14" })).toBe(false);
    // A failed delivery hands the month back, so the next sweep tries again.
    await t.mutation(internal.bulletinPushAlerts.unclaim, { id, claimed: "2026-12", month: "2026-11", cutoff: "01NOV13" });
    expect(await t.mutation(internal.bulletinPushAlerts.claim, { id, month: "2026-12", cutoff: "01JAN14" })).toBe(true);
  });

  it("refuses with nothing written once the day's budget is spent", async () => {
    const t = createTestContext();
    const LEFT = 3;
    await fillRateWindow(t, "all", "bulletin-push-subscribe-global", GLOBAL_BUDGET.limit - LEFT);
    let refusedAt = -1;
    for (let i = 0; i < LEFT + 5; i++) {
      const r = await t.mutation(internal.bulletinPushAlerts.subscribe, { ...line, subscription: sub(i), endpointHash: hash(`e${i}`), ipHash: hash(`ip${i}`) });
      if (!r.ok) {
        refusedAt = i;
        expect(r.throttled).toBe(true);
        break;
      }
    }
    if (refusedAt < 0) throw new Error("the budget never refused");
    expect(refusedAt).toBe(LEFT);
    expect((await t.query(internal.bulletinPushAlerts.activeRows, { cursor: null })).rows).toHaveLength(LEFT);
  });
});
