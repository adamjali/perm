/**
 * The DOL live-status watch for a saved case (convex/appCaseWatch.ts).
 *
 * Phase 1 of the in-app predictive layer: a saved case with a DOL number
 * watches itself through the SAME 5-minute sweep the public email alerts use,
 * records DOL's live status on the case WITHOUT ever touching the attorney's
 * own stage, and raises an in-app notification on a real change (an email only
 * by the user's own preference).
 *
 * The mirror is stubbed through `global.fetch`, exactly as caseAlerts.test.ts
 * does: the sweep reads the public DOL mirror over Hrana, so the fixture is a
 * map of case number to its current row.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildDefaultProfile } from "../lib/userDefaults";

const originalFetch = global.fetch;

/** Which status table holds a number. Re-derived, never imported (the control). */
function tableOf(caseNumber: string): string {
  if (/^P-\d{3}-/.test(caseNumber)) return "pwd_case_status";
  if (/^I-\d{3}-/.test(caseNumber)) return "lca_case_status";
  return "perm_case_status";
}

/** One Hrana cell. Integers travel as strings, as libSQL sends them. */
function cellOf(v: string | number | null) {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}

function hranaResult(rows: Record<string, string | number | null>[]) {
  const cols = rows.length > 0 ? Object.keys(rows[0]!) : ["case_number", "current_status", "is_final"];
  return {
    type: "ok",
    response: {
      type: "execute",
      result: {
        cols: cols.map((name) => ({ name })),
        rows: rows.map((r) => cols.map((c) => cellOf(r[c] ?? null))),
      },
    },
  };
}

/** The mirror the sweep reads: case number to its current row. Tests set it. */
let MIRROR: Map<string, { status: string; isFinal: boolean }> = new Map();

function installFetch() {
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(init?.body ?? "{}") as {
        requests: { type: string; stmt?: { sql: string } }[];
      };
      const results = body.requests.map((req) => {
        if (req.type !== "execute" || !req.stmt) {
          return { type: "ok", response: { type: "close" } };
        }
        const table = /FROM ((?:perm|pwd|lca)_case_status)\b/.exec(req.stmt.sql.replace(/\s+/g, " "))?.[1];
        const rows: Record<string, string | number | null>[] = [];
        for (const [num, row] of MIRROR) {
          if (table && tableOf(num) !== table) continue;
          rows.push({ case_number: num, current_status: row.status, is_final: row.isFinal ? 1 : 0 });
        }
        return hranaResult(rows);
      });
      return { ok: true, status: 200, json: async () => ({ results }) } as unknown as Response;
    }
    // Anything else (a scheduled email through Resend) gets a benign answer so
    // a background send cannot throw into the test.
    return { ok: true, status: 200, json: async () => ({ id: "test-email" }), text: async () => "{}" } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  MIRROR = new Map();
  vi.stubEnv("DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("DATABASE_AUTH_TOKEN", "stub-token");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  installFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

type T = ReturnType<typeof createTestContext>;

async function makeUser(t: T, email = `u-${Math.random().toString(36).slice(2)}@example.com`) {
  return await t.run(async (ctx) => ctx.db.insert("users", { name: "Attorney", email }));
}

async function makeCase(
  t: T,
  userId: Id<"users">,
  overrides: Record<string, unknown> = {},
): Promise<Id<"cases">> {
  const now = Date.now();
  return await t.run(async (ctx) =>
    ctx.db.insert("cases", {
      userId,
      employerName: "ACME Robotics",
      positionTitle: "Software Engineer",
      beneficiaryIdentifier: "A. Nguyen",
      caseNumber: "G-100-26100-111111",
      caseStatus: "recruitment",
      progressStatus: "working",
      rfiEntries: [],
      rfeEntries: [],
      notes: [],
      isProfessionalOccupation: false,
      isFavorite: false,
      priorityLevel: "normal",
      tags: [],
      calendarSyncEnabled: true,
      documents: [],
      recruitmentApplicantsCount: 0,
      additionalRecruitmentMethods: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }),
  );
}

async function makeProfile(t: T, userId: Id<"users">, overrides: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("userProfiles", { ...buildDefaultProfile(userId), ...overrides }),
  );
}

const sweep = (t: T) => t.action(internal.appCaseWatch.sweepAppCaseStatuses, {});
const getCase = (t: T, id: Id<"cases">) => t.run(async (ctx) => ctx.db.get(id));
const notifications = (t: T) => t.run(async (ctx) => ctx.db.query("notifications").collect());
const watchedNumbers = (t: T) =>
  t.query(internal.watchedCases.watchedCaseNumbers, {}).then((r) => r.caseNumbers);

describe("the saved case joins the watched set", () => {
  it("includes a saved case's number, and excludes one with watch off", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeCase(t, u, { caseNumber: "G-100-26100-111111" });
    await makeCase(t, u, { caseNumber: "G-100-26100-222222", watchEnabled: false });

    const nums = await watchedNumbers(t);
    expect(nums).toContain("G-100-26100-111111");
    expect(nums).not.toContain("G-100-26100-222222");
  });

  it("excludes a sample case, a deleted case, and a non-DOL number", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeCase(t, u, { caseNumber: "G-100-26100-111111", isSample: true });
    await makeCase(t, u, { caseNumber: "G-100-26100-222222", deletedAt: Date.now() });
    await makeCase(t, u, { caseNumber: "INTERNAL-REF-9" });

    expect(await watchedNumbers(t)).toEqual([]);
  });

  it("excludes every saved case when the account's global switch is off", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeProfile(t, u, { watchSavedCases: false });
    await makeCase(t, u, { caseNumber: "G-100-26100-111111" });

    expect(await watchedNumbers(t)).not.toContain("G-100-26100-111111");
  });
});

describe("the sweep records DOL's status without touching the firm's stage", () => {
  it("the first sighting sets a silent baseline and notifies no one", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    const c = await makeCase(t, u, { caseNumber: "G-100-26100-111111" });
    MIRROR.set("G-100-26100-111111", { status: "ANALYST REVIEW", isFinal: false });

    const res = await sweep(t);
    expect(res).toMatchObject({ seeded: 1, changed: 0, notified: 0, emailed: 0 });

    const doc = await getCase(t, c);
    expect(doc?.liveStatus).toBe("ANALYST REVIEW");
    expect(doc?.liveStatusSeenAt).toBeGreaterThan(0);
    expect(await notifications(t)).toHaveLength(0);
  });

  it("a real change is written to liveStatus, never to caseStatus or progressStatus", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    const c = await makeCase(t, u, {
      caseNumber: "G-100-26100-111111",
      caseStatus: "recruitment",
      progressStatus: "working",
      progressStatusOverride: true,
      liveStatus: "ANALYST REVIEW",
    });
    MIRROR.set("G-100-26100-111111", { status: "CERTIFIED", isFinal: true });

    const res = await sweep(t);
    expect(res).toMatchObject({ seeded: 0, changed: 1, notified: 1, emailed: 0 });

    const doc = await getCase(t, c);
    expect(doc?.liveStatus).toBe("CERTIFIED");
    expect(doc?.liveStatusIsFinal).toBe(true);
    // THE CRUX: the firm's own bookkeeping is untouched.
    expect(doc?.caseStatus).toBe("recruitment");
    expect(doc?.progressStatus).toBe("working");
    expect(doc?.progressStatusOverride).toBe(true);

    const notes = await notifications(t);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "status_change", caseId: c });
    expect(notes[0]!.message).toContain("CERTIFIED");
  });

  it("does not notify when DOL's status has not moved since we last recorded it", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeCase(t, u, { caseNumber: "G-100-26100-111111", liveStatus: "ANALYST REVIEW" });
    MIRROR.set("G-100-26100-111111", { status: "ANALYST REVIEW", isFinal: false });

    const res = await sweep(t);
    expect(res).toMatchObject({ seeded: 0, changed: 0, notified: 0 });
    expect(await notifications(t)).toHaveLength(0);
  });

  it("two sweeps on the same change notify exactly once (idempotent on the case)", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeCase(t, u, { caseNumber: "G-100-26100-111111", liveStatus: "ANALYST REVIEW" });
    MIRROR.set("G-100-26100-111111", { status: "CERTIFIED", isFinal: true });

    await sweep(t);
    const second = await sweep(t);
    expect(second).toMatchObject({ changed: 0, notified: 0 });
    expect(await notifications(t)).toHaveLength(1);
  });

  it("leaves a case the mirror does not hold alone", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    const c = await makeCase(t, u, { caseNumber: "G-100-26100-111111" });
    // MIRROR empty: a recent filing sits outside it for weeks.
    const res = await sweep(t);
    expect(res).toMatchObject({ seeded: 0, changed: 0, notified: 0 });
    expect((await getCase(t, c))?.liveStatus).toBeUndefined();
  });
});

describe("email is in-app-first, and deduped against a public subscription", () => {
  it("schedules an email only when the account opted into status emails", async () => {
    const t = createTestContext();
    const u = await makeUser(t);
    await makeProfile(t, u, { emailStatusUpdates: true });
    await makeCase(t, u, { caseNumber: "G-100-26100-111111", liveStatus: "ANALYST REVIEW" });
    MIRROR.set("G-100-26100-111111", { status: "CERTIFIED", isFinal: true });

    const res = await sweep(t);
    expect(res).toMatchObject({ changed: 1, notified: 1, emailed: 1 });
    // Drain the scheduled email against the benign fetch so it cannot leak.
    await t.finishInProgressScheduledFunctions();
  });

  it("does NOT email when the owner is already a confirmed public subscriber on this number", async () => {
    const t = createTestContext();
    const email = "owner@example.com";
    const u = await makeUser(t, email);
    await makeProfile(t, u, { emailStatusUpdates: true });
    await makeCase(t, u, { caseNumber: "G-100-26100-111111", liveStatus: "ANALYST REVIEW" });
    await t.run(async (ctx) =>
      ctx.db.insert("caseStatusAlerts", {
        email,
        caseNumber: "G-100-26100-111111",
        createdAt: Date.now(),
        confirmedAt: Date.now(),
      }),
    );
    MIRROR.set("G-100-26100-111111", { status: "CERTIFIED", isFinal: true });

    const res = await sweep(t);
    // The in-app notification still fires; the email is left to the public path.
    expect(res).toMatchObject({ changed: 1, notified: 1, emailed: 0 });
    expect(await notifications(t)).toHaveLength(1);
  });
});
