import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { checkAndRecordRateLimit } from "./lib/rateLimit";

/**
 * Milestones people report for a case after DOL: the I-140 and the I-485.
 *
 * USCIS publishes nothing per case, so once a PERM is certified the public
 * record stops. These reports are the only per-case trace of what came next,
 * and they are labelled as unverified user reports everywhere they render.
 * Nothing here is ever blended into an estimate.
 *
 * Public endpoint checklist (convex/http.ts): the mutation is internal, the
 * HTTP layer narrows every field, cheap shape checks run before any limit,
 * the per-IP limit raises the cost of naive abuse and the GLOBAL daily budget
 * bounds the table's growth no matter how many addresses rotate, and a repeat
 * report of the same kind on the same case from the same address updates its
 * own row rather than adding one, so a visitor cannot inflate a count by
 * clicking. GET never mutates.
 */

export const MILESTONE_KINDS = ["i140-filed", "i140-approved", "i485-filed", "i485-approved"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  "i140-filed": "I-140 filed",
  "i140-approved": "I-140 approved",
  "i485-filed": "I-485 filed",
  "i485-approved": "I-485 approved",
};

/** PERM numbers only: the FLAG form and the older A- form. */
const PERM_CASE = /^(G-\d{3}-\d{5}-\d{6}|A-\d{5}-\d{5})$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Six reports an hour from one address. */
const PER_IP = { limit: 6, windowMs: 60 * 60 * 1000 };
/** Three hundred reports a day across everyone: the cap on the table's growth. */
const GLOBAL_BUDGET = { limit: 300, windowMs: 24 * 60 * 60 * 1000 };

const reportResult = v.object({
  ok: v.boolean(),
  message: v.string(),
  throttled: v.optional(v.boolean()),
});

export const report = internalMutation({
  args: {
    caseNumber: v.string(),
    kind: v.string(),
    eventDate: v.string(),
    /** SHA-256 of the forwarded address, computed by the HTTP layer. */
    ipHash: v.string(),
  },
  returns: reportResult,
  handler: async (ctx, a) => {
    // Cheap shape checks first, before anything is charged or written.
    const caseNumber = a.caseNumber.trim().toUpperCase();
    if (caseNumber.length > 24 || !PERM_CASE.test(caseNumber)) {
      return { ok: false, message: "Milestones are recorded against PERM case numbers only." };
    }
    const kind = MILESTONE_KINDS.find((k) => k === a.kind);
    if (!kind) return { ok: false, message: "That is not a milestone this page records." };
    const today = new Date().toISOString().slice(0, 10);
    if (!ISO.test(a.eventDate) || a.eventDate < "2015-01-01" || a.eventDate > today || Number.isNaN(Date.parse(`${a.eventDate}T00:00:00Z`))) {
      return { ok: false, message: "Enter the date as YYYY-MM-DD, not in the future." };
    }
    if (a.ipHash.length !== 64) return { ok: false, message: "Malformed request." };

    const perIp = await checkAndRecordRateLimit(ctx, a.ipHash, "milestone-report", PER_IP);
    if (!perIp.allowed) {
      return { ok: false, throttled: true, message: "That is enough reports for one hour. Try again later." };
    }
    const budget = await checkAndRecordRateLimit(ctx, "all", "milestone-report-global", GLOBAL_BUDGET);
    if (!budget.allowed) {
      return { ok: false, throttled: true, message: "Reports are paused for today. Try again tomorrow." };
    }

    const existing = await ctx.db
      .query("caseMilestones")
      .withIndex("by_case_ip_kind", (q) => q.eq("caseNumber", caseNumber).eq("ipHash", a.ipHash).eq("kind", kind))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { eventDate: a.eventDate, submittedAt: Date.now() });
      return { ok: true, message: "Your earlier report of this milestone was updated." };
    }
    await ctx.db.insert("caseMilestones", { caseNumber, kind, eventDate: a.eventDate, submittedAt: Date.now(), ipHash: a.ipHash });
    return { ok: true, message: "Recorded beside the case as a user report." };
  },
});

const summaryResult = v.object({
  caseNumber: v.string(),
  reports: v.number(),
  reporters: v.number(),
  kinds: v.array(
    v.object({
      kind: v.string(),
      label: v.string(),
      count: v.number(),
      /** The latest event date anyone gave for this kind. */
      latest: v.union(v.string(), v.null()),
    }),
  ),
});

/** Reads at most 500 rows for one case; a case with more has a problem this page is not the place to solve. */
const READ_CAP = 500;

export const summary = internalQuery({
  args: { caseNumber: v.string() },
  returns: summaryResult,
  handler: async (ctx, a) => {
    const caseNumber = a.caseNumber.trim().toUpperCase();
    const rows = PERM_CASE.test(caseNumber)
      ? await ctx.db
          .query("caseMilestones")
          .withIndex("by_case", (q) => q.eq("caseNumber", caseNumber))
          .take(READ_CAP)
      : [];
    const reporters = new Set(rows.map((r) => r.ipHash)).size;
    const kinds = MILESTONE_KINDS.map((kind) => {
      const of = rows.filter((r) => r.kind === kind);
      const latest = of.reduce<string | null>((m, r) => (m === null || r.eventDate > m ? r.eventDate : m), null);
      return { kind, label: MILESTONE_LABEL[kind], count: of.length, latest };
    });
    return { caseNumber, reports: rows.length, reporters, kinds };
  },
});
