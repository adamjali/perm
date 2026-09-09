"use node";

import * as webpush from "web-push";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { recordError } from "./lib/errorRecording";
import { createLogger } from "./lib/logging";
import { placeholders, query, type Statement } from "./lib/publicMirror";
import { canonicalStatus } from "../src/lib/caseStatusVocabulary";
import { programOf, statusTableFor, type FlagProgram } from "../src/lib/flagCaseNumber";
import { v } from "convex/values";

/**
 * The browser-push sweep. In its own file because `web-push` needs the Node
 * runtime ("use node"), and a Node file may hold only actions; the table's
 * mutations and queries stay in casePushAlerts.ts. See that file for the
 * design.
 */

const log = createLogger("CasePushAlertsSweep");
const SEND_CAP = 500;

function vapidReady(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:support@permtracker.app", pub, priv);
  return true;
}

const sweepResult = v.object({ checked: v.number(), seeded: v.number(), sent: v.number(), closed: v.number(), failed: v.number() });

/** Read every open subscription's case against the status tables and notify the ones that moved. */
export const sweep = internalAction({
  args: {},
  returns: sweepResult,
  handler: async (ctx): Promise<{ checked: number; seeded: number; sent: number; closed: number; failed: number }> => {
    const rows = await ctx.runQuery(internal.casePushAlerts.activeRows, {});
    const out = { checked: rows.length, seeded: 0, sent: 0, closed: 0, failed: 0 };
    if (rows.length === 0) return out;

    const byProgram = new Map<FlagProgram, Set<string>>();
    for (const r of rows) {
      const p = programOf(r.caseNumber);
      const set = byProgram.get(p) ?? new Set<string>();
      set.add(r.caseNumber);
      byProgram.set(p, set);
    }
    const statements: Statement[] = [];
    for (const [program, numbers] of byProgram) {
      const list = [...numbers];
      const marks = placeholders(list.length);
      if (!marks) continue;
      statements.push({ sql: `SELECT case_number, current_status, is_final FROM ${statusTableFor(program)} WHERE case_number IN (${marks})`, args: list });
    }
    const now = new Map<string, { status: string; isFinal: boolean }>();
    for (const row of (await query(statements)).flat()) {
      const n = row.case_number == null ? "" : String(row.case_number);
      const s = row.current_status == null ? "" : String(row.current_status);
      if (!n || !s) continue;
      now.set(n, { status: canonicalStatus(s), isFinal: Number(row.is_final) === 1 });
    }

    if (!vapidReady()) {
      log.error("VAPID keys not configured; push sweep sent nothing", { rows: rows.length });
      return out;
    }

    for (const r of rows) {
      const cur = now.get(r.caseNumber);
      if (!cur) continue;
      if (r.lastSeenStatus === undefined) {
        await ctx.runMutation(internal.casePushAlerts.seed, { id: r._id, status: cur.status });
        out.seeded++;
        continue;
      }
      if (cur.status === r.lastSeenStatus) continue;
      if (out.sent >= SEND_CAP) break;
      const payload = JSON.stringify({
        title: `${r.caseNumber} moved`,
        body: `DOL's status changed from ${r.lastSeenStatus} to ${cur.status}. Tap to open the case.`,
        tag: `case-${r.caseNumber}`,
        url: `https://permtracker.app/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`,
      });
      try {
        await webpush.sendNotification(JSON.parse(r.subscription), payload, { TTL: 24 * 60 * 60 });
        out.sent++;
        await ctx.runMutation(internal.casePushAlerts.markSeen, { id: r._id as Id<"caseStatusPushAlerts">, status: cur.status, close: cur.isFinal });
        if (cur.isFinal) out.closed++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await ctx.runMutation(internal.casePushAlerts.close, { id: r._id });
          out.closed++;
        } else {
          out.failed++;
          await ctx.runMutation(internal.casePushAlerts.bumpFailure, { id: r._id });
          await recordError(ctx, "action", "casePushAlerts.sweep.delivery", e).catch(() => undefined);
        }
      }
    }
    log.info("push sweep", out);
    return out;
  },
});
