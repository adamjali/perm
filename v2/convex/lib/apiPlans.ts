/**
 * What each API plan allows. One table, read by the Convex key functions (how
 * many keys), the site's API layer (calls a minute, a day, a month) and the
 * pages that print the limits, so the three can't disagree.
 *
 * Free is the plan every account starts on. Plus is the one paid plan (owner's
 * call, Oct 2 2026: one plan first, about $5 a month or $50 a year, priced on
 * the site once billing exists). Until then an account reaches Plus only when
 * set by hand (apiKeys.setPlan), for comped accounts.
 *
 * A call is one API request or one assistant tool call that did its work.
 * Days and months are UTC, and they reset at midnight UTC.
 */

export type ApiPlanId = "free" | "plus";

export interface ApiPlan {
  id: ApiPlanId;
  label: string;
  /** Active keys an account may hold at once. */
  keys: number;
  perMinute: number;
  perDay: number;
  perMonth: number;
}

export const API_PLANS: Record<ApiPlanId, ApiPlan> = {
  free: { id: "free", label: "Free", keys: 1, perMinute: 10, perDay: 300, perMonth: 3_000 },
  plus: { id: "plus", label: "Plus", keys: 3, perMinute: 30, perDay: 3_000, perMonth: 30_000 },
};

export function apiPlan(id: string | null | undefined): ApiPlan {
  return id === "plus" ? API_PLANS.plus : API_PLANS.free;
}
