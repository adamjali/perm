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
 * 100 a day. A full CONFIRMATION pool queues the request
 * (convex/confirmationQueue.ts, sent while Resend's own count leaves room);
 * `noteQueued` counts those and `noteRefusal` counts the people who got no
 * email at all, per pool per Eastern day, so the admin panel can say "this
 * pool queued 15 and turned away 0 this week". The first of each emails the
 * admin that day.
 */
import type { MutationCtx } from "../_generated/server";
import { easternDay, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "./time";

/**
 * Per-kind bounds against abuse, not shares of Resend's 100: that is guarded
 * once, by what was actually sent (convex/lib/emailLimits.ts), and a full pool
 * queues rather than refuses (convex/confirmationQueue.ts). Each is set well
 * above measured real demand, so ordinary growth in sign-ups never meets it.
 */
export const BUDGETS = {
  caseConfirm: { key: "case_subscribe_global", limit: 60, label: "Case and employer confirmations" },
  caseAlert: { key: "case_alert_global", limit: 60, label: "Case and employer alerts" },
  queueConfirm: { key: "queue_subscribe_global", limit: 40, label: "Queue alert confirmations" },
  bulletinConfirm: { key: "bulletin_subscribe_global", limit: 30, label: "Bulletin alert confirmations" },
  bulletinAlert: { key: "bulletin_alert_global", limit: 40, label: "Bulletin alerts" },
  prefsLink: { key: "prefs_link_global", limit: 20, label: "Preference-page links" },
  /**
   * A law firm claiming its page (convex/firmClaims.ts): the confirmation
   * link, the approval note and edit links. Rare by nature, so the bound is low.
   */
  firmClaim: { key: "firm_claim_global", limit: 10, label: "Firm page claims" },
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
  "firmClaim",
] as const satisfies readonly (keyof typeof BUDGETS)[];

/** Codes to one address, whatever kind: enough for a few resends, not a flood. */
export const AUTH_MAIL_ADDRESS_KEY = "auth_mail_address";
export const AUTH_MAIL_PER_ADDRESS = { limit: 5, windowMs: MS_PER_HOUR };

/**
 * Minimum gap between confirmation emails to one address, for every alert
 * kind. It stops one address being mailed repeatedly. It does NOT stop a
 * caller cycling through many addresses, because a first-time address has no
 * previous send to compare against: the per-caller limit below and the global
 * pools above handle that.
 */
export const CONFIRMATION_COOLDOWN_MS = 10 * MS_PER_MINUTE;

/**
 * Per-caller ceiling on subscribe attempts, for every alert kind: 30 an hour,
 * so an office or a family behind one address can follow several things. The
 * identifier is the caller IP the HTTP route reports, which can be spoofed;
 * the global pools bound the mail whatever it says.
 */
export const SUBSCRIBE_IP_LIMIT = { limit: 30, windowMs: MS_PER_HOUR };

/**
 * Gap before a sweep that stopped on its batch limit runs again: long enough
 * for a rate limit to clear, short enough that a backlog drains the same day.
 */
export const SWEEP_RESUME_DELAY_MS = 5 * MS_PER_MINUTE;

export type BudgetName = keyof typeof BUDGETS;

/** A pool as the rate limiter takes it. */
export function windowFor(name: BudgetName): { limit: number; windowMs: number } {
  return { limit: BUDGETS[name].limit, windowMs: MS_PER_DAY };
}

export const CASE_CONFIRMATION_KEY = BUDGETS.caseConfirm.key;
export const CASE_CONFIRMATION_BUDGET = windowFor("caseConfirm");
export const CASE_ALERT_KEY = BUDGETS.caseAlert.key;
export const CASE_ALERT_BUDGET = windowFor("caseAlert");

/**
 * Count `n` refusals against a pool for today (Eastern): people who got no
 * email at all. A full confirmation pool QUEUES the request
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
  const day = easternDay(Date.now());
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
