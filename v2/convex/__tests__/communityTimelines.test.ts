import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";

/**
 * Community timelines: the save path's refusals and limits, that a person can
 * read, edit and remove only their own row, that the PERM half comes from
 * DOL's record and never from the body, and that the public board carries
 * nothing that identifies a case. The budget tests fill until the endpoint
 * says no and THROW if it never does, so an unexhausted limit cannot pass.
 */

const CASE = "G-100-25324-425560";
const KEY = "1".repeat(64);
const IP_A = "a".repeat(64);
const IP_B = "b".repeat(64);
const originalFetch = global.fetch;

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

/** DOL's record for CASE, as the mirror would answer. */
function fakeMirror(opts: { status?: string; published?: string | null; observedAt?: number | null } = {}) {
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    if (!String(url).includes("/v2/pipeline")) return new Response("{}", { status: 200 });
    const body = JSON.parse(init?.body ?? "{}") as { requests: { type: string; stmt?: { sql: string } }[] };
    const results = body.requests.map((req) => {
      if (req.type !== "execute" || !req.stmt) return { type: "ok", response: { type: "close" } };
      const sql = req.stmt.sql;
      if (sql.includes("FROM perm_case_status")) {
        return hrana([{ filing_date: "2025-11-20", current_status: opts.status ?? "CERTIFIED" }]);
      }
      if (sql.includes("FROM perm_cases")) {
        return hrana(opts.published ? [{ received_date: "2025-11-20", decision_date: opts.published }] : []);
      }
      if (sql.includes("FROM perm_case_events")) return hrana([{ at: opts.observedAt ?? null }]);
      return hrana([]);
    });
    return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
  fakeMirror();
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const save = (over: Record<string, unknown> = {}, who: { key?: string; ip?: string; caseNumber?: string } = {}) => ({
  caseNumber: who.caseNumber ?? CASE,
  editKeyHash: who.key ?? KEY,
  ipHash: who.ip ?? IP_A,
  input: { category: "eb3", route: "adjustment", i140FiledOn: "2026-05-01", ...over },
});

describe("communityTimelines.save", () => {
  it("records a timeline, and the owner reads it back by key; nobody else can", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.communityTimelines.save, save({ premium: true, public: true }));
    expect(r.ok).toBe(true);
    const mine = await t.query(internal.communityTimelines.mine, { caseNumber: CASE, editKeyHash: KEY });
    expect(mine?.input).toMatchObject({ category: "eb3", premium: true, public: true, i140FiledOn: "2026-05-01" });
    const stranger = await t.query(internal.communityTimelines.mine, { caseNumber: CASE, editKeyHash: "2".repeat(64) });
    expect(stranger).toBeNull();
  });

  it("an edit replaces every field, so a cleared date is really cleared", async () => {
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save({ i140ApprovedOn: "2026-05-12" }));
    const again = await t.mutation(internal.communityTimelines.save, save({ i140ApprovedOn: null }));
    expect(again.message).toMatch(/updated/);
    const mine = await t.query(internal.communityTimelines.mine, { caseNumber: CASE, editKeyHash: KEY });
    expect(mine?.input.i140ApprovedOn).toBeUndefined();
    const rows = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(rows).toHaveLength(1);
  });

  it.each([
    ["a non-PERM number", save({}, { caseNumber: "P-100-26125-868956" })],
    ["a malformed key", save({}, { key: "short" })],
    ["no date after PERM", save({ i140FiledOn: null })],
    ["a choice outside the list", save({ category: "eb5" })],
  ])("refuses %s and writes nothing", async (_, args) => {
    const t = createTestContext();
    const r = await t.mutation(internal.communityTimelines.save, args as never);
    expect(r.ok).toBe(false);
    const rows = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(rows).toHaveLength(0);
  });

  it("ignores any PERM date in the body: the PERM half is DOL's to supply", async () => {
    const t = createTestContext();
    const args = save();
    (args.input as Record<string, unknown>).permCertifiedOn = "2020-01-01";
    // The validator rejects the unknown field outright, so nothing is written.
    await expect(t.mutation(internal.communityTimelines.save, args as never)).rejects.toThrow();
    const rows = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(rows).toHaveLength(0);
  });

  it("caps timelines per case per address BEFORE charging any limit", async () => {
    const t = createTestContext();
    for (let i = 0; i < 3; i++) {
      const r = await t.mutation(internal.communityTimelines.save, save({}, { key: String(i + 3).repeat(64) }));
      expect(r.ok).toBe(true);
    }
    const before = await t.run(async (ctx) => ctx.db.query("rateLimits").take(1000));
    const fourth = await t.mutation(internal.communityTimelines.save, save({}, { key: "9".repeat(64) }));
    expect(fourth).toMatchObject({ ok: false, throttled: true });
    const after = await t.run(async (ctx) => ctx.db.query("rateLimits").take(1000));
    expect(after.length).toBe(before.length);
  });

  it("the per-address hourly limit refuses", async () => {
    const t = createTestContext();
    let refused = false;
    for (let i = 0; i < 20 && !refused; i++) {
      // Distinct cases so the per-case cap never fires first.
      const c = `G-100-25324-${String(425560 + i).padStart(6, "0")}`;
      const r = await t.mutation(internal.communityTimelines.save, save({}, { caseNumber: c }));
      if (!r.ok) {
        expect(r.throttled).toBe(true);
        refused = true;
      }
    }
    if (!refused) throw new Error("20 saves from one address were never refused");
  });

  it("the global daily budget refuses new timelines across rotating addresses", async () => {
    const t = createTestContext();
    let refused = false;
    for (let i = 0; i < 320 && !refused; i++) {
      const ip = i.toString(16).padStart(64, "0");
      const c = `G-100-25324-${String(100000 + i).padStart(6, "0")}`;
      const r = await t.mutation(internal.communityTimelines.save, save({}, { caseNumber: c, ip }));
      if (!r.ok) refused = true;
    }
    if (!refused) throw new Error("320 new timelines were never refused");
  });
});

describe("communityTimelines.remove", () => {
  it("removes the owner's row and only the owner's", async () => {
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save());
    await t.mutation(internal.communityTimelines.save, save({}, { key: "2".repeat(64), ip: IP_B }));
    const wrong = await t.mutation(internal.communityTimelines.remove, { caseNumber: CASE, editKeyHash: "3".repeat(64) });
    expect(wrong.ok).toBe(false);
    const right = await t.mutation(internal.communityTimelines.remove, { caseNumber: CASE, editKeyHash: KEY });
    expect(right.ok).toBe(true);
    const rows = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(rows.map((r) => r.editKeyHash)).toEqual(["2".repeat(64)]);
  });
});

describe("the PERM half", () => {
  it("takes the certification date from DOL's published file when it exists", async () => {
    fakeMirror({ published: "2026-04-02", observedAt: Date.UTC(2026, 8, 17) });
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save());
    await t.action(internal.communityTimelines.verifyCase, { caseNumber: CASE });
    const [row] = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(row).toMatchObject({ permFiledOn: "2025-11-20", permCertifiedOn: "2026-04-02", permCertifiedSource: "disclosure" });
  });

  it("falls back to the day the sweep saw it certified, only while DOL still says certified", async () => {
    fakeMirror({ published: null, observedAt: Date.UTC(2026, 8, 17, 14) });
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save());
    await t.action(internal.communityTimelines.verifyCase, { caseNumber: CASE });
    const [row] = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(row).toMatchObject({ permCertifiedOn: "2026-09-17", permCertifiedSource: "observed" });

    fakeMirror({ status: "ANALYST REVIEW", published: null, observedAt: Date.UTC(2026, 8, 17) });
    await t.action(internal.communityTimelines.verifyCase, { caseNumber: CASE });
    const [again] = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(again!.permCertifiedOn).toBeUndefined();
    expect(again!.permFiledOn).toBe("2025-11-20");
  });
});

describe("communityTimelines.board", () => {
  it("stays closed below the threshold and never returns a case number or a hash", async () => {
    fakeMirror({ published: "2026-04-02" });
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save({ public: true }));
    await t.action(internal.communityTimelines.verifyCase, { caseNumber: CASE });
    const b = await t.query(api.communityTimelines.board, {});
    expect(b).toMatchObject({ total: 1, shared: 1, open: false });
    expect(b.rows).toHaveLength(0);
    const text = JSON.stringify(b);
    expect(text).not.toContain(CASE);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(IP_A);
  });

  it("opens at the threshold and lists only shared rows, still without a case number", async () => {
    const t = createTestContext();
    const n = 25;
    for (let i = 0; i < n + 3; i++) {
      const c = `G-100-25324-${String(200000 + i).padStart(6, "0")}`;
      await t.mutation(
        internal.communityTimelines.save,
        save({ public: i < n }, { caseNumber: c, ip: i.toString(16).padStart(64, "0") }),
      );
    }
    const b = await t.query(api.communityTimelines.board, {});
    expect(b.open).toBe(true);
    expect(b.total).toBe(n + 3);
    expect(b.shared).toBe(n);
    expect(b.rows).toHaveLength(n);
    expect(JSON.stringify(b)).not.toMatch(/G-100-25324-2\d{5}/);
  });

  it("a hidden row leaves every count", async () => {
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save({ public: true }));
    const [row] = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    await t.mutation(internal.communityTimelines.hide, { id: row!._id, hidden: true });
    const b = await t.query(api.communityTimelines.board, {});
    expect(b.total).toBe(0);
  });
});

describe("the case summary", () => {
  it("counts timelines and legacy milestone reports toward the same stops", async () => {
    const t = createTestContext();
    await t.mutation(internal.communityTimelines.save, save({ i140ApprovedOn: "2026-05-12" }));
    await t.mutation(internal.caseMilestones.report, {
      caseNumber: CASE,
      kind: "i140-approved",
      eventDate: "2026-05-15",
      ipHash: IP_B,
    });
    const s = await t.query(internal.communityTimelines.caseSummary, { caseNumber: CASE });
    expect(s.timelines).toBe(1);
    expect(s.stops.find((x) => x.id === "i140ApprovedOn")!.count).toBe(2);
    expect(s.stops.find((x) => x.id === "i140FiledOn")!.count).toBe(1);
  });
});

describe("the HTTP layer", () => {
  it("hashes the key it is given, and refuses a missing key and an oversized body", async () => {
    const t = createTestContext();
    const post = (path: string, body: unknown) =>
      t.fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const bad = await post("/timeline/save", { caseNumber: CASE, i140FiledOn: "2026-05-01" });
    expect(bad.status).toBe(400);
    const ok = await post("/timeline/save", { caseNumber: CASE, key: "c".repeat(64), i140FiledOn: "2026-05-01", public: true });
    expect(ok.status).toBe(200);
    const [row] = await t.run(async (ctx) => ctx.db.query("communityTimelines").take(1000));
    expect(row!.editKeyHash).not.toBe("c".repeat(64));
    expect(row!.editKeyHash).toMatch(/^[0-9a-f]{64}$/);
    const mine = await post("/timeline/mine", { caseNumber: CASE, key: "c".repeat(64) });
    expect(((await mine.json()) as { mine: { input: { public: boolean } } }).mine.input.public).toBe(true);
    const huge = await post("/timeline/save", { caseNumber: CASE, key: "c".repeat(64), filler: "x".repeat(5000) });
    expect(huge.status).toBe(400);
  });
});
