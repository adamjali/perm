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
 * 100 a day. A full CONFIRMATION pool queues the request since Sep 29 2026
 * (convex/confirmationQueue.ts, sent while Resend's own count leaves room);
 * `noteQueued` counts those and `noteRefusal` counts the people who got no
 * email at all, per pool per Eastern day, so the admin panel can say "this
 * pool queued 15 and turned away 0 this week". The first of each emails the
 * admin that day.
 */
import type { MutationCtx } from "../_generated/server";
import { etDay } from "./alertDelivery";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Raised Sep 29 2026 (Adam: "any limit we hit needs to be bigger"). Measured
 * first: the case pool's 15 ran out on Sep 28 to real people (44 distinct
 * addresses across four days, 31 of 40 checkable ones confirmed, traffic
 * ordinary at about 1,000 visitors), because sign-ups had grown to about 14
 * a day against a cap sized in August for 2 to 5. These are now per-kind
 * bounds against abuse, not shares of Resend's 100: that is guarded once, by
 * what was actually sent (convex/lib/emailLimits.ts), and a full pool queues
 * rather than refuses (convex/confirmationQueue.ts).
 */
export const BUDGETS = {
  caseConfirm: { key: "case_subscribe_global", limit: 60, label: "Case and employer confirmations" },
  caseAlert: { key: "case_alert_global", limit: 60, label: "Case and employer alerts" },
  queueConfirm: { key: "queue_subscribe_global", limit: 40, label: "Queue alert confirmations" },
  bulletinConfirm: { key: "bulletin_subscribe_global", limit: 30, label: "Bulletin alert confirmations" },
  bulletinAlert: { key: "bulletin_alert_global", limit: 40, label: "Bulletin alerts" },
  prefsLink: { key: "prefs_link_global", limit: 20, label: "Preference-page links" },
  /**
   * Sign-in and password-reset codes (convex/authMail.ts). Not list mail: these
   * are the emails whose absence locks someone out, so the pool sits above the
   * busiest measured day instead of inside the list ledger's remainder. See the
   * ledger in convex/caseAlerts.ts.
   */
  authMail: { key: "auth_mail_global", limit: 80, label: "Sign-in and reset codes" },
} as const;

/** The list-mail pools: everything but sign-in codes. */
export const LIST_MAIL_POOLS = [
  "caseConfirm",
  "caseAlert",
  "queueConfirm",
  "bulletinConfirm",
  "bulletinAlert",
  "prefsLink",
] as const satisfies readonly (keyof typeof BUDGETS)[];

/** Codes to one address, whatever kind: enough for a few resends, not a flood. */
export const AUTH_MAIL_ADDRESS_KEY = "auth_mail_address";
export const AUTH_MAIL_PER_ADDRESS = { limit: 5, windowMs: 60 * 60 * 1000 };

export type BudgetName = keyof typeof BUDGETS;

/** A pool as the rate limiter takes it. */
export function windowFor(name: BudgetName): { limit: number; windowMs: number } {
  return { limit: BUDGETS[name].limit, windowMs: DAY_MS };
}

export const CASE_CONFIRMATION_KEY = BUDGETS.caseConfirm.key;
export const CASE_CONFIRMATION_BUDGET = windowFor("caseConfirm");
export const CASE_ALERT_KEY = BUDGETS.caseAlert.key;
export const CASE_ALERT_BUDGET = windowFor("caseAlert");

/**
 * Count `n` refusals against a pool for today (Eastern): people who got no
 * email at all. Since Sep 29 2026 a full confirmation pool QUEUES the request
 * (convex/confirmationQueue.ts), so for confirmations this counts only what
 * the queue could not hold, or held past its limit. Alert pools still refuse.
 * Returns true when this is the first refusal of the day for the pool.
 */
export async function noteRefusal(ctx: MutationCtx, name: BudgetName, n = 1): Promise<boolean> {
  return bump(ctx, name, "count", n);
}

/**
 * Count `n` requests a full pool put in the queue today (Eastern). They are
 * not refusals: they go out as soon as the account has room. Returns true
 * when this is the first queued request of the day for the pool.
 */
export async function noteQueued(ctx: MutationCtx, name: BudgetName, n = 1): Promise<boolean> {
  return bump(ctx, name, "queued", n);
}

async function bump(ctx: MutationCtx, name: BudgetName, field: "count" | "queued", n: number): Promise<boolean> {
  if (n <= 0) return false;
  const day = etDay(Date.now());
  const row = await ctx.db
    .query("budgetRefusals")
    .withIndex("by_day_pool", (q) => q.eq("day", day).eq("pool", name))
    .unique();
  if (!row) {
    await ctx.db.insert("budgetRefusals", { day, pool: name, count: field === "count" ? n : 0, ...(field === "queued" ? { queued: n } : {}) });
    return true;
  }
  const before = field === "count" ? row.count : (row.queued ?? 0);
  await ctx.db.patch(row._id, field === "count" ? { count: row.count + n } : { queued: before + n });
  return before === 0;
}
