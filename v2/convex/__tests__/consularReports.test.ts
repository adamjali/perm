import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext, fillRateWindow } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { GLOBAL_BUDGET, IP_HASH_KEEP_MS, PER_IP, PER_POST_PER_IP } from "../consularReports";

/**
 * Consulate reports: the save path's refusals and limits (each refusal leaves no charge and no row), that a
 * person can read, edit and remove only their own report, the three-report floor on every public figure,
 * that a hidden report leaves every figure, and that the address hash is cleared about a day later. The
 * budget tests fill until the endpoint says no and THROW if it never does, so an unexhausted limit can't pass.
 */

type T = ReturnType<typeof createTestContext>;

const POST = "mumbai";
const KEY = "1".repeat(64);
const IP_A = "a".repeat(64);
const IP_B = "b".repeat(64);
const ADMIN = "admin@consular-test.com";

/** A recent interview, so every report lands in the windows whatever day the suite runs. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const save = (over: Record<string, unknown> = {}, who: { key?: string; ip?: string; post?: string } = {}) => ({
  post: who.post ?? POST,
  editKeyHash: who.key ?? KEY,
  ipHash: who.ip ?? IP_A,
  input: { category: "employment", outcome: "issued", interviewOn: daysAgo(2), ...over },
});

const rows = (t: T) => t.run((ctx) => ctx.db.query("consularReports").take(1000));
const charges = (t: T) => t.run((ctx) => ctx.db.query("rateLimits").take(5000));
const hex = (i: number) => i.toString(16).padStart(64, "0");

async function adminAuth(t: T) {
  const id = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
  return t.withIdentity({ subject: id, email: ADMIN });
}

describe("consularReports.save", () => {
  it("records a report, and the owner reads it back by key; nobody else can", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.consularReports.save, save({ nvcCompleteMonth: "2026-03" }));
    expect(r.ok).toBe(true);
    const mine = await t.query(internal.consularReports.mine, { post: POST, editKeyHash: KEY });
    expect(mine).toMatchObject({ category: "employment", outcome: "issued", nvcCompleteMonth: "2026-03" });
    expect(await t.query(internal.consularReports.mine, { post: POST, editKeyHash: "2".repeat(64) })).toBeNull();
    // The key is scoped to its consulate.
    expect(await t.query(internal.consularReports.mine, { post: "manila", editKeyHash: KEY })).toBeNull();
  });

  it("keeps every detail a stamping report carries, and reads them back", async () => {
    const t = createTestContext();
    const details = {
      category: "h1b",
      mode: "interview",
      interviewOn: daysAgo(10),
      outcome: "221g",
      slipColor: "white",
      askedToEmailDocs: "yes",
      resolvedOn: daysAgo(3),
    };
    const r = await t.mutation(internal.consularReports.save, save(details));
    expect(r.ok).toBe(true);
    expect(await t.query(internal.consularReports.mine, { post: POST, editKeyHash: KEY })).toEqual(details);
  });

  it("an edit replaces every field, so a cleared date is really cleared, and keeps one row", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save({ scheduledOn: daysAgo(20) }));
    const again = await t.mutation(internal.consularReports.save, save({ scheduledOn: null, outcome: "221g" }));
    expect(again.message).toMatch(/updated/);
    const all = await rows(t);
    expect(all).toHaveLength(1);
    expect(all[0]!.scheduledOn).toBeUndefined();
    expect(all[0]!.outcome).toBe("221g");
  });

  it.each([
    ["a post that isn't a slug", save({}, { post: "Mumbai!" })],
    ["a malformed key hash", save({}, { key: "short" })],
    ["a malformed address hash", save({}, { ip: "nope" })],
    ["no date", save({ interviewOn: null })],
    ["a date in the future", save({ interviewOn: "2099-01-01" })],
    ["a date before 2020", save({ interviewOn: "2019-06-01" })],
    ["a category off the list", save({ category: "eb5" })],
    ["a refusal ground without a refusal", save({ refusalGround: "public-charge" })],
  ])("refuses %s, and writes and charges nothing", async (_, args) => {
    const t = createTestContext();
    const r = await t.mutation(internal.consularReports.save, args as never);
    expect(r.ok).toBe(false);
    expect(await rows(t)).toHaveLength(0);
    expect(await charges(t)).toHaveLength(0);
  });

  it("rejects a field the form doesn't have, such as a name or a case number", async () => {
    const t = createTestContext();
    const args = save();
    (args.input as Record<string, unknown>).name = "Pat";
    await expect(t.mutation(internal.consularReports.save, args as never)).rejects.toThrow();
    expect(await rows(t)).toHaveLength(0);
  });

  it("caps reports per consulate per address BEFORE charging any limit", async () => {
    const t = createTestContext();
    for (let i = 0; i < PER_POST_PER_IP; i++) {
      const r = await t.mutation(internal.consularReports.save, save({}, { key: hex(i + 10) }));
      expect(r.ok).toBe(true);
    }
    const before = await charges(t);
    const next = await t.mutation(internal.consularReports.save, save({}, { key: hex(99) }));
    expect(next).toMatchObject({ ok: false, throttled: true });
    expect((await charges(t)).length).toBe(before.length);
    expect(await rows(t)).toHaveLength(PER_POST_PER_IP);
    // Another consulate from the same address is still open.
    const elsewhere = await t.mutation(internal.consularReports.save, save({}, { key: hex(99), post: "manila" }));
    expect(elsewhere.ok).toBe(true);
  });

  it("the per-address hourly limit refuses", async () => {
    const t = createTestContext();
    await fillRateWindow(t, IP_A, "consular-report-save", PER_IP.limit);
    const r = await t.mutation(internal.consularReports.save, save());
    expect(r).toMatchObject({ ok: false, throttled: true });
    expect(await rows(t)).toHaveLength(0);
  });

  it("the global daily budget refuses new reports across rotating addresses, and a refusal charges the address nothing", async () => {
    const t = createTestContext();
    const LEFT = 3;
    await fillRateWindow(t, "all", "consular-report-global", GLOBAL_BUDGET.limit - LEFT);
    let refusedAt = -1;
    for (let i = 0; i < LEFT + 20 && refusedAt < 0; i++) {
      const r = await t.mutation(internal.consularReports.save, save({}, { key: hex(i + 1), ip: hex(i + 1000), post: `post-${i}` }));
      if (!r.ok) {
        expect(r.throttled).toBe(true);
        refusedAt = i;
      }
    }
    if (refusedAt < 0) throw new Error(`${LEFT + 20} new reports were never refused`);
    expect(refusedAt).toBe(LEFT);
    // The refused address was never charged: budget before the write, and no trace of a success.
    const refusedIp = hex(refusedAt + 1000);
    const charged = (await charges(t)).filter((c) => c.identifier === refusedIp);
    expect(charged).toHaveLength(0);
    expect(await rows(t)).toHaveLength(LEFT);
  });

  it("an edit isn't charged to the daily budget", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save());
    await fillRateWindow(t, "all", "consular-report-global", GLOBAL_BUDGET.limit);
    const edit = await t.mutation(internal.consularReports.save, save({ outcome: "221g" }));
    expect(edit.ok).toBe(true);
  });
});

describe("consularReports.remove", () => {
  it("removes the owner's report and only the owner's", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save());
    await t.mutation(internal.consularReports.save, save({}, { key: "2".repeat(64), ip: IP_B }));
    const wrong = await t.mutation(internal.consularReports.remove, { post: POST, editKeyHash: "3".repeat(64) });
    expect(wrong.ok).toBe(false);
    const right = await t.mutation(internal.consularReports.remove, { post: POST, editKeyHash: KEY });
    expect(right.ok).toBe(true);
    expect((await rows(t)).map((r) => r.editKeyHash)).toEqual(["2".repeat(64)]);
  });
});

describe("the public figures", () => {
  it("print only a count under three reports, and never a hash or a key", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save());
    await t.mutation(internal.consularReports.save, save({ outcome: "221g" }, { key: "2".repeat(64), ip: IP_B }));
    const v = await t.query(api.consularReports.forPost, { post: POST });
    expect(v.total).toBe(2);
    expect(v.windows.every((w) => !w.open && w.byOutcome.length === 0)).toBe(true);
    expect(v.results.n).toBeNull();
    expect(v.categories.every((c) => c.count === null)).toBe(true);
    const text = JSON.stringify(v);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(IP_A);
  });

  it("open at three, and the overview lists the post with its 221(g) share", async () => {
    const t = createTestContext();
    const outcomes = ["issued", "221g", "issued"];
    for (let i = 0; i < outcomes.length; i++) {
      await t.mutation(internal.consularReports.save, save({ outcome: outcomes[i] }, { key: hex(i + 1), ip: hex(i + 50) }));
    }
    await t.mutation(internal.consularReports.save, save({}, { key: hex(9), ip: hex(9), post: "manila" }));
    const v = await t.query(api.consularReports.forPost, { post: POST });
    expect(v.windows.find((w) => w.days === 30)).toMatchObject({ total: 3, open: true });
    expect(v.results).toMatchObject({ n: 3, g221: 1 });
    const o = await t.query(api.consularReports.overview, {});
    expect(o.all.total).toBe(4);
    expect(o.busiest).toEqual([{ post: POST, reports30: 3, results: 3, g221: 1, share: 1 / 3 }]);
    expect(JSON.stringify(o)).not.toContain(hex(50));
  });

  it("a hidden report leaves every figure, and an admin can put it back", async () => {
    const t = createTestContext();
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.consularReports.save, save({}, { key: hex(i + 1), ip: hex(i + 50) }));
    }
    const [first] = await rows(t);
    const admin = await adminAuth(t);
    await admin.mutation(api.consularReports.setHiddenForAdmin, { id: first!._id, hidden: true });
    const v = await t.query(api.consularReports.forPost, { post: POST });
    expect(v.total).toBe(2);
    expect(v.windows.every((w) => !w.open)).toBe(true);
    expect((await t.query(api.consularReports.overview, {})).busiest).toEqual([]);
    const listed = await admin.query(api.consularReports.listForAdmin, {});
    expect(listed.find((r) => r.id === first!._id)?.hidden).toBe(true);
    await admin.mutation(api.consularReports.setHiddenForAdmin, { id: first!._id, hidden: false });
    expect((await t.query(api.consularReports.forPost, { post: POST })).total).toBe(3);
  });

  it("the admin list and hide refuse anyone but the admin", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save());
    const [row] = await rows(t);
    const someone = await t.run(async (ctx) => ctx.db.insert("users", { email: "someone@example.com" }));
    const them = t.withIdentity({ subject: someone, email: "someone@example.com" });
    await expect(them.query(api.consularReports.listForAdmin, {})).rejects.toThrow();
    await expect(them.mutation(api.consularReports.setHiddenForAdmin, { id: row!._id, hidden: true })).rejects.toThrow();
    expect((await rows(t))[0]!.hidden).toBeUndefined();
  });

  it("the CLI hide mirrors the timelines' one", async () => {
    const t = createTestContext();
    await t.mutation(internal.consularReports.save, save());
    const [row] = await rows(t);
    await t.mutation(internal.consularReports.hide, { id: row!._id, hidden: true });
    expect((await t.query(api.consularReports.forPost, { post: POST })).total).toBe(0);
  });
});

describe("the address hash", () => {
  it("is cleared about a day after the report is saved, and the per-post cap opens with it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    const t = createTestContext();
    for (let i = 0; i < PER_POST_PER_IP; i++) {
      await t.mutation(internal.consularReports.save, save({ interviewOn: "2026-11-02" }, { key: hex(i + 10) }));
    }
    expect(await t.mutation(internal.consularReports.clearIpHashes, {})).toBe(0);
    expect((await rows(t)).every((r) => r.ipHash === IP_A)).toBe(true);

    vi.setSystemTime(new Date(Date.parse("2026-11-05T12:00:00Z") + IP_HASH_KEEP_MS + 60_000));
    expect(await t.mutation(internal.consularReports.clearIpHashes, {})).toBe(PER_POST_PER_IP);
    const after = await rows(t);
    expect(after.every((r) => r.ipHash === undefined && r.ipHashUntil === undefined)).toBe(true);
    // The rows themselves stay, and the same connection can report again.
    expect(after).toHaveLength(PER_POST_PER_IP);
    const again = await t.mutation(internal.consularReports.save, save({ interviewOn: "2026-11-02" }, { key: hex(77) }));
    expect(again.ok).toBe(true);
  });
});

describe("the HTTP routes", () => {
  const post = (t: T, path: string, body: unknown) =>
    t.fetch(path, { method: "POST", headers: { "x-forwarded-for": "203.0.113.7" }, body: JSON.stringify(body) });

  it("saves, reads back and removes by the browser's key, which is never stored as sent", async () => {
    const t = createTestContext();
    const key = "c".repeat(64);
    const saved = await post(t, "/consular-report/save", { post: POST, key, category: "h1b", outcome: "waiting", scheduledOn: daysAgo(3) });
    expect(saved.status).toBe(200);
    const [row] = await rows(t);
    expect(row!.editKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.editKeyHash).not.toBe(key);
    const mine = (await (await post(t, "/consular-report/mine", { post: POST, key })).json()) as { mine: { category: string } | null };
    expect(mine.mine?.category).toBe("h1b");
    const removed = await post(t, "/consular-report/remove", { post: POST, key });
    expect(removed.status).toBe(200);
    expect(await rows(t)).toHaveLength(0);
  });

  it("refuses an oversized or malformed body before anything else runs", async () => {
    const t = createTestContext();
    const big = await post(t, "/consular-report/save", { post: POST, key: "c".repeat(64), outcome: "x".repeat(5_000) });
    expect(big.status).toBe(400);
    const badKey = await post(t, "/consular-report/save", { post: POST, key: "nope", category: "h1b", outcome: "waiting" });
    expect(badKey.status).toBe(400);
    const longField = await post(t, "/consular-report/save", { post: POST, key: "c".repeat(64), category: "x".repeat(40), outcome: "waiting" });
    expect(longField.status).toBe(400);
    expect(await rows(t)).toHaveLength(0);
    expect(await charges(t)).toHaveLength(0);
  });

  it("answers a refusal by a limit with 429", async () => {
    const t = createTestContext();
    await fillRateWindow(t, "all", "consular-report-global", GLOBAL_BUDGET.limit);
    const res = await post(t, "/consular-report/save", { post: POST, key: "c".repeat(64), category: "h1b", outcome: "waiting", scheduledOn: daysAgo(3) });
    expect(res.status).toBe(429);
  });
});
