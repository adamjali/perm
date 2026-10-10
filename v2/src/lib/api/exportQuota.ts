/**
 * The daily export allowance: rows, not calls. One export counts as one call
 * against the plan's call allowance, so calls alone let a Plus account (every
 * account while the paywall is off) export about 30 million rows a month. The
 * plan's `exportRowsPerDay` (Plus 20,000) bounds the rows an account takes in
 * a UTC day, all exports together (owner's call, Oct 10 2026).
 *
 * One `perm_docs` row a UTC day, `api_export_<date>`, a JSON map of account to
 * rows taken, the same shape the live-lookup counter uses. Read before an
 * export to size it, charged after with the rows it returned. Two exports in
 * flight at once can each read the same count and go a little past the day's
 * rows together; the per-minute limit bounds how far.
 */
import "server-only";

import { budgetResetEastern } from "@/lib/dolMiss";
import { one } from "@/lib/turso/client";
import { bumpDocCount } from "@/lib/turso/embedLookup";
import type { ApiPlan } from "@convex/lib/apiPlans";

import { resetsIn, utcDay } from "./usage";

const counterKey = (now: Date) => `api_export_${utcDay(now)}`;

/** Rows this account has exported today, or null when the count can't be read. */
export async function exportRowsUsed(account: string, now: Date = new Date()): Promise<number | null> {
  if (!/^acct_[0-9A-Za-z]{20}$/.test(account)) return null;
  try {
    const row = await one<{ n: number | string | null }>(
      "SELECT json_extract(json, ?) AS n FROM perm_docs WHERE key = ?",
      [`$."${account}"`, counterKey(now)],
    );
    const n = Number(row?.n ?? 0);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.error("[apiExport] count read failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Add an export's rows to today's count. A failure is logged; the export already went. */
export async function chargeExportRows(account: string, rows: number, now: Date = new Date()): Promise<void> {
  if (rows <= 0 || !/^acct_[0-9A-Za-z]{20}$/.test(account)) return;
  try {
    await bumpDocCount(counterKey(now), account, now, rows);
  } catch (e) {
    console.error("[apiExport] count write failed:", e instanceof Error ? e.message : e);
  }
}

/** The refusal once the day's rows are taken, in the words the live-lookup cap uses. */
export function exportDayRefusal(plan: ApiPlan, now: Date = new Date()) {
  return {
    status: 429 as const,
    code: "export_daily_limit",
    message:
      `This account has exported its ${plan.exportRowsPerDay.toLocaleString("en-US")} rows for today on the ` +
      `${plan.label} plan. It resets at ${budgetResetEastern(now)} Eastern (midnight UTC).`,
    retryAfter: resetsIn(now).day,
  };
}
