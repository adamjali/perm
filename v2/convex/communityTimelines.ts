import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server";
import {
  BOARD_OPENS_AT,
  CASE_STOPS,
  PERM_CASE,
  computeMetrics,
  summarizeRfes,
  toBoardRow,
  validateTimeline,
  type TimelineRecord,
} from "./lib/communityTimeline";
import { query as mirrorQuery } from "./lib/publicMirror";
import { checkAndRecordRateLimit } from "./lib/rateLimit";

/**
 * Community timelines: a person's dates after PERM, with DOL's own PERM dates
 * beside them. Rules and field lists: `convex/lib/communityTimeline.ts`.
 *
 * Public endpoint checklist (the routes are in convex/http.ts): every write is
 * an internal mutation behind an HTTP action that narrows the body and hashes
 * the address; cheap shape checks run before any limit is charged; a per-case
 * cap is READ before anything is charged, so a refused request leaves no
 * trace; the per-address limit raises the cost of naive abuse and the global
 * daily budget bounds the table whatever addresses rotate; GET never mutates.
 * No field is free text, so nothing a stranger types can reach the public
 * board except a date or a choice from a fixed list.
 */

/** Six saves an hour from one address, edits included. */
const PER_IP = { limit: 6, windowMs: 60 * 60 * 1000 };
/** Three hundred new timelines a day across everyone: the cap on the table's growth. */
const GLOBAL_BUDGET = { limit: 300, windowMs: 24 * 60 * 60 * 1000 };
/** At most three timelines on one case from one address (a household, not a flood). */
const PER_CASE_PER_IP = 3;
/** The board's scan bound. A table past this has outgrown a single read. */
const SCAN_CAP = 5_000;
/** Rows the public board lists, newest first. */
const BOARD_ROWS = 200;

const HEX64 = /^[0-9a-f]{64}$/;

const timelineInput = v.object({
  category: v.optional(v.union(v.string(), v.null())),
  country: v.optional(v.union(v.string(), v.null())),
  route: v.optional(v.union(v.string(), v.null())),
  premium: v.optional(v.union(v.boolean(), v.null())),
  i140Center: v.optional(v.union(v.string(), v.null())),
  i140FiledOn: v.optional(v.union(v.string(), v.null())),
  i140ApprovedOn: v.optional(v.union(v.string(), v.null())),
  i485FiledOn: v.optional(v.union(v.string(), v.null())),
  eadOn: v.optional(v.union(v.string(), v.null())),
  apOn: v.optional(v.union(v.string(), v.null())),
  interviewOn: v.optional(v.union(v.string(), v.null())),
  greenCardOn: v.optional(v.union(v.string(), v.null())),
  rfeForm: v.optional(v.union(v.string(), v.null())),
  rfeReason: v.optional(v.union(v.string(), v.null())),
  rfeIssuedOn: v.optional(v.union(v.string(), v.null())),
  rfeRespondedOn: v.optional(v.union(v.string(), v.null())),
  rfeOutcome: v.optional(v.union(v.string(), v.null())),
  public: v.optional(v.union(v.boolean(), v.null())),
});

/** The wire shape of a submission, for the HTTP layer that builds one. */
export type TimelineWire = Infer<typeof timelineInput>;

const saveResult = v.object({
  ok: v.boolean(),
  message: v.string(),
  throttled: v.optional(v.boolean()),
});

function normaliseCase(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return c.length <= 24 && PERM_CASE.test(c) ? c : null;
}

/** The self-reported fields of a row, every one written so an edit can clear it. */
const FIELD_KEYS = [
  "category", "country", "route", "premium", "i140Center",
  "i140FiledOn", "i140ApprovedOn", "i485FiledOn", "eadOn", "apOn", "interviewOn", "greenCardOn",
  "rfeForm", "rfeReason", "rfeIssuedOn", "rfeRespondedOn", "rfeOutcome",
] as const;

export const save = internalMutation({
  args: {
    caseNumber: v.string(),
    editKeyHash: v.string(),
    ipHash: v.string(),
    input: timelineInput,
  },
  returns: saveResult,
  handler: async (ctx, a) => {
    // Cheap shape checks first, before anything is read, charged or written.
    const caseNumber = normaliseCase(a.caseNumber);
    if (!caseNumber) return { ok: false, message: "Timelines are recorded against PERM case numbers only." };
    if (!HEX64.test(a.editKeyHash) || !HEX64.test(a.ipHash)) return { ok: false, message: "Malformed request." };
    const checked = validateTimeline(a.input);
    if (!checked.ok) return { ok: false, message: checked.message };
    const fields = checked.value;

    const now = Date.now();
    const existing = await ctx.db
      .query("communityTimelines")
      .withIndex("by_case_key", (q) => q.eq("caseNumber", caseNumber).eq("editKeyHash", a.editKeyHash))
      .first();

    if (!existing) {
      // READ the per-case cap before charging anything, so a refusal here
      // leaves no stamp on the address's limit or the global budget.
      const mine = await ctx.db
        .query("communityTimelines")
        .withIndex("by_case_ip", (q) => q.eq("caseNumber", caseNumber).eq("ipHash", a.ipHash))
        .take(PER_CASE_PER_IP);
      if (mine.length >= PER_CASE_PER_IP) {
        return { ok: false, throttled: true, message: "This case already has several timelines from this connection." };
      }
    }

    const perIp = await checkAndRecordRateLimit(ctx, a.ipHash, "timeline-save", PER_IP);
    if (!perIp.allowed) {
      return { ok: false, throttled: true, message: "That's enough saves for one hour. Try again later." };
    }

    // Every field is written, including the ones the person cleared, so an
    // edit that removes a date really removes it. Patching a field to
    // undefined deletes it, which is exactly what a cleared field means.
    const patch: Record<string, unknown> = { public: fields.public, updatedAt: now };
    for (const k of FIELD_KEYS) patch[k] = fields[k];

    if (existing) {
      await ctx.db.patch(existing._id, patch as Partial<Doc<"communityTimelines">>);
      return { ok: true, message: "Your timeline was updated." };
    }

    const budget = await checkAndRecordRateLimit(ctx, "all", "timeline-save-global", GLOBAL_BUDGET);
    if (!budget.allowed) {
      return { ok: false, throttled: true, message: "New timelines are paused for today. Try again tomorrow." };
    }
    // An insert carries only the fields that have a value.
    const present = Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined));
    await ctx.db.insert("communityTimelines", {
      ...(present as Partial<Doc<"communityTimelines">>),
      caseNumber,
      editKeyHash: a.editKeyHash,
      ipHash: a.ipHash,
      public: fields.public,
      createdAt: now,
      updatedAt: now,
    });
    // DOL's PERM dates for the case, read once now; the daily sweep retries
    // a case DOL has not certified yet.
    await ctx.scheduler.runAfter(0, internal.communityTimelines.verifyCase, { caseNumber });
    return { ok: true, message: "Your timeline is recorded." };
  },
});

export const remove = internalMutation({
  args: { caseNumber: v.string(), editKeyHash: v.string() },
  returns: saveResult,
  handler: async (ctx, a) => {
    const caseNumber = normaliseCase(a.caseNumber);
    if (!caseNumber || !HEX64.test(a.editKeyHash)) return { ok: false, message: "Malformed request." };
    const row = await ctx.db
      .query("communityTimelines")
      .withIndex("by_case_key", (q) => q.eq("caseNumber", caseNumber).eq("editKeyHash", a.editKeyHash))
      .first();
    if (!row) return { ok: false, message: "There's no timeline from this browser on this case." };
    await ctx.db.delete(row._id);
    return { ok: true, message: "Your timeline was removed." };
  },
});

const mineResult = v.union(
  v.null(),
  v.object({
    input: timelineInput,
    permFiledOn: v.union(v.string(), v.null()),
    permCertifiedOn: v.union(v.string(), v.null()),
  }),
);

/** The caller's own row, found by the edit key its browser holds. */
export const mine = internalQuery({
  args: { caseNumber: v.string(), editKeyHash: v.string() },
  returns: mineResult,
  handler: async (ctx, a) => {
    const caseNumber = normaliseCase(a.caseNumber);
    if (!caseNumber || !HEX64.test(a.editKeyHash)) return null;
    const row = await ctx.db
      .query("communityTimelines")
      .withIndex("by_case_key", (q) => q.eq("caseNumber", caseNumber).eq("editKeyHash", a.editKeyHash))
      .first();
    if (!row) return null;
    const input: Record<string, unknown> = { public: row.public };
    for (const k of FIELD_KEYS) if (row[k] !== undefined) input[k] = row[k];
    return {
      input: input as Infer<typeof timelineInput>,
      permFiledOn: row.permFiledOn ?? null,
      permCertifiedOn: row.permCertifiedOn ?? null,
    };
  },
});

/** The legacy milestone kinds, mapped onto the timeline's stops. */
const LEGACY_STOP: Record<string, string> = {
  "i140-filed": "i140FiledOn",
  "i140-approved": "i140ApprovedOn",
  "i485-filed": "i485FiledOn",
  "i485-approved": "greenCardOn",
};

const summaryResult = v.object({
  caseNumber: v.string(),
  timelines: v.number(),
  stops: v.array(v.object({ id: v.string(), label: v.string(), verified: v.boolean(), count: v.number() })),
});

/**
 * What people have reported for ONE case: counts per stop, nothing personal.
 * Legacy single-milestone reports count toward their stop.
 */
export const caseSummary = internalQuery({
  args: { caseNumber: v.string() },
  returns: summaryResult,
  handler: async (ctx, a) => {
    const caseNumber = normaliseCase(a.caseNumber) ?? a.caseNumber.trim().toUpperCase().slice(0, 24);
    const valid = PERM_CASE.test(caseNumber);
    const rows = valid
      ? (await ctx.db
          .query("communityTimelines")
          .withIndex("by_case", (q) => q.eq("caseNumber", caseNumber))
          .take(500)).filter((r) => r.hiddenAt === undefined)
      : [];
    const legacy = valid
      ? await ctx.db
          .query("caseMilestones")
          .withIndex("by_case", (q) => q.eq("caseNumber", caseNumber))
          .take(500)
      : [];
    const stops = CASE_STOPS.filter((s) => !s.verified).map((s) => ({
      id: s.id as string,
      label: s.label as string,
      verified: false,
      count:
        rows.filter((r) => (r as unknown as Record<string, unknown>)[s.id] !== undefined).length +
        legacy.filter((m) => LEGACY_STOP[m.kind] === s.id).length,
    }));
    return { caseNumber, timelines: rows.length, stops };
  },
});

/** A stored row as the pure helpers read it. */
function asRecord(r: Doc<"communityTimelines">): TimelineRecord {
  return r as unknown as TimelineRecord;
}

const metricV = v.object({
  id: v.string(),
  label: v.string(),
  verified: v.boolean(),
  n: v.number(),
  median: v.union(v.number(), v.null()),
  p25: v.union(v.number(), v.null()),
  p75: v.union(v.number(), v.null()),
});
const countV = v.object({ id: v.string(), label: v.string(), count: v.number() });
const boardRowV = v.object({
  filedMonth: v.union(v.string(), v.null()),
  category: v.union(v.string(), v.null()),
  country: v.union(v.string(), v.null()),
  route: v.union(v.string(), v.null()),
  premium: v.union(v.boolean(), v.null()),
  stops: v.array(v.object({ id: v.string(), day: v.union(v.number(), v.null()), month: v.union(v.string(), v.null()) })),
  permVerified: v.boolean(),
  rfe: v.union(
    v.null(),
    v.object({ form: v.string(), reason: v.union(v.string(), v.null()), outcome: v.union(v.string(), v.null()) }),
  ),
  updatedMonth: v.string(),
});

/**
 * The public board. PUBLIC on purpose: it returns only what the page prints.
 * No case number, no employer, no exact PERM date, no hash leaves this query.
 * Medians use every visible row (the form says so before saving); the listed
 * rows are only the ones whose owners ticked "show on the board", and only
 * once there are enough of them that no single row stands out.
 */
export const board = query({
  args: {},
  returns: v.object({
    total: v.number(),
    shared: v.number(),
    opensAt: v.number(),
    open: v.boolean(),
    metrics: v.array(metricV),
    rfe: v.object({
      total: v.number(),
      byForm: v.array(countV),
      byReason: v.array(countV),
      byOutcome: v.array(countV),
    }),
    rows: v.array(boardRowV),
  }),
  handler: async (ctx) => {
    const all = (await ctx.db.query("communityTimelines").take(SCAN_CAP)).filter((r) => r.hiddenAt === undefined);
    const records = all.map(asRecord);
    const shared = all.filter((r) => r.public);
    const open = shared.length >= BOARD_OPENS_AT;
    const rows = open
      ? shared
          .sort((x, y) => y.updatedAt - x.updatedAt)
          .slice(0, BOARD_ROWS)
          .map((r) => toBoardRow(asRecord(r)))
      : [];
    return {
      total: all.length,
      shared: shared.length,
      opensAt: BOARD_OPENS_AT,
      open,
      metrics: computeMetrics(records),
      rfe: summarizeRfes(records),
      rows,
    };
  },
});

/** Write DOL's PERM dates onto every row for a case. The only writer of `perm*`. */
export const setPermHalf = internalMutation({
  args: {
    caseNumber: v.string(),
    permFiledOn: v.union(v.string(), v.null()),
    permCertifiedOn: v.union(v.string(), v.null()),
    source: v.union(v.literal("disclosure"), v.literal("observed"), v.null()),
  },
  returns: v.number(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("communityTimelines")
      .withIndex("by_case", (q) => q.eq("caseNumber", a.caseNumber))
      .take(500);
    const now = Date.now();
    for (const r of rows) {
      await ctx.db.patch(r._id, {
        permFiledOn: a.permFiledOn ?? undefined,
        permCertifiedOn: a.permCertifiedOn ?? undefined,
        permCertifiedSource: a.source ?? undefined,
        permCheckedAt: now,
      });
    }
    return rows.length;
  },
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read DOL's record for one case from Turso (SELECT only, see
 * lib/publicMirror.ts) and write the PERM half.
 *
 * Filing date: the live status table, else the disclosure file. Certification
 * date: the disclosure file when DOL has published the decision (a real
 * decision date), else the day our own sweep first saw the case certified
 * (`observed`, which can trail DOL by a day), and only while DOL's current
 * status still reads CERTIFIED. A case that is not certified gets no date.
 */
async function verifyOne(ctx: ActionCtx, c: string): Promise<void> {
  let live: Record<string, unknown> | undefined;
  let published: Record<string, unknown> | undefined;
  let observed: Record<string, unknown> | undefined;
  try {
    const [l, p, o] = await mirrorQuery([
      { sql: "SELECT filing_date, current_status FROM perm_case_status WHERE case_number = ?", args: [c] },
      {
        sql: "SELECT received_date, decision_date FROM perm_cases WHERE case_number = ? AND status = 'certified'",
        args: [c],
      },
      {
        sql: "SELECT MIN(changed_at) AS at FROM perm_case_events WHERE case_number = ? AND to_status LIKE 'CERTIFIED%'",
        args: [c],
      },
    ]);
    live = l?.[0];
    published = p?.[0];
    observed = o?.[0];
  } catch (e) {
    // Leave the row unverified; the daily sweep asks again.
    console.warn("[communityTimelines.verify] mirror read failed", String(e));
    return;
  }
  const str = (x: unknown) => (typeof x === "string" && ISO_DATE.test(x.slice(0, 10)) ? x.slice(0, 10) : null);
  const filed = str(live?.filing_date) ?? str(published?.received_date);
  const status = typeof live?.current_status === "string" ? live.current_status.toUpperCase() : "";
  let certified: string | null = str(published?.decision_date);
  let source: "disclosure" | "observed" | null = certified ? "disclosure" : null;
  if (!certified && status.startsWith("CERTIFIED")) {
    const at = Number(observed?.at);
    if (Number.isFinite(at) && at > 0) {
      certified = new Date(at).toISOString().slice(0, 10);
      source = "observed";
    }
  }
  await ctx.runMutation(internal.communityTimelines.setPermHalf, {
    caseNumber: c,
    permFiledOn: filed,
    permCertifiedOn: certified,
    source,
  });
}

export const verifyCase = internalAction({
  args: { caseNumber: v.string() },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    await verifyOne(ctx, a.caseNumber);
    return null;
  },
});

/** Cases still waiting on a certification date, least recently checked first. */
export const casesToVerify = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, a) => {
    const dayAgo = Date.now() - 20 * 60 * 60 * 1000;
    const out = new Set<string>();
    let seen = 0;
    for await (const r of ctx.db.query("communityTimelines").withIndex("by_perm_checked")) {
      if (++seen > 2_000) break;
      if (r.permCheckedAt !== undefined && r.permCheckedAt > dayAgo) break;
      if (r.permCertifiedOn === undefined) out.add(r.caseNumber);
      if (out.size >= a.limit) break;
    }
    return [...out];
  },
});

/** Daily: re-read DOL for every case whose timeline has no certification date yet. */
export const verifySweep = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const cases: string[] = await ctx.runQuery(internal.communityTimelines.casesToVerify, { limit: 100 });
    for (const c of cases) await verifyOne(ctx, c);
    return cases.length;
  },
});

/** Admin: take a row off every surface, from the CLI (`npx convex run`). */
export const hide = internalMutation({
  args: { id: v.id("communityTimelines"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { hiddenAt: a.hidden ? Date.now() : undefined });
    return null;
  },
});
