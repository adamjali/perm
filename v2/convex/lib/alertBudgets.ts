/**
 * Every daily email budget in one table, and the record of refusals.
 *
 * The Resend arithmetic in convex/caseAlerts.ts is the argument; these are
 * the numbers it argues about, kept once so the senders that enforce them and
 * the admin panel that reports them cannot disagree. Every pool is GLOBAL,
 * keyed on the literal "all", over a rolling 24 hours.
 *
 * Following an employer claimed no new line: its confirmations draw from the
 * case confirmations' pool and its alerts from the case alerts' pool.
 *
 * A REFUSAL IS THE UPGRADE SIGNAL. The free Resend plan caps the account at
 * 100 a day, and a pool at its ceiling turns real people away with "try again
 * later". `noteRefusal` counts those per pool per Eastern day, so the admin
 * panel can say "this pool refused 7 people this week" instead of leaving it
 * to a log line nobody reads.
 */
import type { MutationCtx } from "../_generated/server";
import { etDay } from "./alertDelivery";

const DAY_MS = 24 * 60 * 60 * 1000;

export const BUDGETS = {
  caseConfirm: { key: "case_subscribe_global", limit: 15, label: "Case and employer confirmations" },
  caseAlert: { key: "case_alert_global", limit: 18, label: "Case and employer alerts" },
  queueConfirm: { key: "queue_subscribe_global", limit: 18, label: "Queue alert confirmations" },
  bulletinConfirm: { key: "bulletin_subscribe_global", limit: 6, label: "Bulletin alert confirmations" },
  bulletinAlert: { key: "bulletin_alert_global", limit: 12, label: "Bulletin alerts" },
  prefsLink: { key: "prefs_link_global", limit: 6, label: "Preference-page links" },
} as const;

export type BudgetName = keyof typeof BUDGETS;

/** A pool as the rate limiter takes it. */
export function windowFor(name: BudgetName): { limit: number; windowMs: number } {
  return { limit: BUDGETS[name].limit, windowMs: DAY_MS };
}

export const CASE_CONFIRMATION_KEY = BUDGETS.caseConfirm.key;
export const CASE_CONFIRMATION_BUDGET = windowFor("caseConfirm");
export const CASE_ALERT_KEY = BUDGETS.caseAlert.key;
export const CASE_ALERT_BUDGET = windowFor("caseAlert");

/** Count `n` refusals against a pool for today (Eastern). Never throws. */
export async function noteRefusal(ctx: MutationCtx, name: BudgetName, n = 1): Promise<void> {
  if (n <= 0) return;
  const day = etDay(Date.now());
  const row = await ctx.db
    .query("budgetRefusals")
    .withIndex("by_day_pool", (q) => q.eq("day", day).eq("pool", name))
    .unique();
  if (row) await ctx.db.patch(row._id, { count: row.count + n });
  else await ctx.db.insert("budgetRefusals", { day, pool: name, count: n });
}
