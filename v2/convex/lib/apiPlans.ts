/**
 * What each API plan allows, which scopes a key can carry, and the one switch
 * that decides whether the plan or the paywall-free default applies.
 *
 * One table, read by the Convex key and webhook functions (how many keys,
 * endpoints and watches), the site's API layer (calls a minute, a day, a
 * month; export rows; live lookups) and the pages that print the limits, so
 * they can't disagree.
 *
 * Free is the plan every account starts on. Plus is the one paid plan (owner's
 * call, Oct 2 2026: one plan first, about $5 a month or $50 a year, priced on
 * the site once billing exists). Until billing exists an account reaches Plus
 * only when set by hand (apiKeys.setPlan), for comped accounts.
 *
 * THE PAYWALL SWITCH. `PAYWALL_ENFORCED` on the Convex deployment, unset by
 * default. While it's off every account gets Plus's limits and features
 * ("pay wall coming soon, can be free for now", Oct 8 2026); turned on, the
 * account's own plan decides. It's read in ONE place, Convex (`apiKeys.verify`
 * and the key and webhook functions call `entitlement`), and the site reads
 * the answer from there, so flipping it needs no site deploy and takes effect
 * within the key cache's minute.
 *
 * A call is one API request or one assistant tool call that did its work.
 * Days and months are UTC, and they reset at midnight UTC.
 */

export type ApiPlanId = "free" | "plus";

export interface ApiPlan {
  id: ApiPlanId;
  label: string;
  /** Active live keys an account may hold at once. */
  keys: number;
  /** Active sandbox keys (pt_test_), which answer fixed sample data. */
  sandboxKeys: number;
  perMinute: number;
  perDay: number;
  perMonth: number;
  /** Rows one export may return. 0: no exports on this plan. */
  exportRows: number;
  /** Live DOL lookups a day for the account. 0: none on this plan. */
  liveLookupsPerDay: number;
  /** Webhook endpoints the account may register. 0: no webhooks on this plan. */
  webhookEndpoints: number;
  /** Case numbers and employers the account's webhooks may watch. */
  webhookWatches: number;
}

export const API_PLANS: Record<ApiPlanId, ApiPlan> = {
  free: {
    id: "free",
    label: "Free",
    keys: 1,
    sandboxKeys: 2,
    perMinute: 10,
    perDay: 300,
    perMonth: 3_000,
    exportRows: 0,
    liveLookupsPerDay: 0,
    webhookEndpoints: 0,
    webhookWatches: 0,
  },
  plus: {
    id: "plus",
    label: "Plus",
    keys: 3,
    sandboxKeys: 2,
    perMinute: 30,
    perDay: 3_000,
    perMonth: 30_000,
    exportRows: 1_000,
    liveLookupsPerDay: 200,
    webhookEndpoints: 5,
    webhookWatches: 100,
  },
};

/**
 * Live DOL lookups a UTC day for every API account together, whatever their
 * plans allow (src/lib/api/live.ts enforces it). Kept here so the docs, the
 * admin page and the morning report print the same number.
 */
export const API_LIVE_DAILY_CAP = 20_000;

/** The refusal for a plan with no webhooks: one sentence, used by every door. */
export const NO_WEBHOOKS_MESSAGE = "Webhooks come with the Plus plan.";

export function apiPlan(id: string | null | undefined): ApiPlan {
  return id === "plus" ? API_PLANS.plus : API_PLANS.free;
}

/** Whether the switch reads on: "1", "true" or "on", any case. Anything else is off. */
export function paywallEnforced(raw: string | undefined = process.env.PAYWALL_ENFORCED): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

export interface ApiEntitlement {
  /** The limits and features that apply to the account now. */
  plan: ApiPlan;
  /** The plan the account is on (what billing will charge for). */
  accountPlan: ApiPlanId;
  /** Whether the plan decides (true) or everyone gets Plus (false). */
  paywall: boolean;
}

/**
 * The one decision every gate asks. Off: Plus for everyone. On: the account's
 * own plan.
 */
export function entitlement(accountPlan: string | null | undefined, paywall: boolean = paywallEnforced()): ApiEntitlement {
  const own = apiPlan(accountPlan);
  return { plan: paywall ? own : API_PLANS.plus, accountPlan: own.id, paywall };
}

/* ------------------------------------------------------------------ */
/* Scopes                                                              */
/* ------------------------------------------------------------------ */

/**
 * What a key may do. `read` (the public records) is every key's. `cases_write`
 * is reserved for the firm tools and can't be granted yet.
 */
export const API_SCOPES = ["read", "export", "live_lookup", "webhooks", "cases_read", "cases_write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const GRANTABLE_SCOPES: readonly ApiScope[] = ["read", "export", "live_lookup", "webhooks", "cases_read"];

/** What a new key gets unless its maker chooses, and what a key made before scopes holds. */
export const DEFAULT_SCOPES: readonly ApiScope[] = ["read", "export", "live_lookup", "webhooks"];

export const SCOPE_LABELS: Record<ApiScope, string> = {
  read: "Read public records",
  export: "Export search results",
  live_lookup: "Ask DOL live",
  webhooks: "Manage webhooks",
  cases_read: "Read your own cases",
  cases_write: "Change your cases (not available yet)",
};

export function isApiScope(s: string): s is ApiScope {
  return (API_SCOPES as readonly string[]).includes(s);
}

/** Grantable scopes only, in the canonical order, always with `read`. */
export function normaliseScopes(asked: readonly string[]): ApiScope[] {
  const want = new Set<string>(asked);
  want.add("read");
  return GRANTABLE_SCOPES.filter((s) => want.has(s));
}

/** Whether a key's stored scopes include `scope`. A key made before scopes holds the default set. */
export function hasScope(stored: readonly string[] | undefined, scope: ApiScope): boolean {
  if (scope === "cases_write") return false;
  return (stored ?? DEFAULT_SCOPES).includes(scope);
}
