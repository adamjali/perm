/**
 * Live DOL lookups through the API: a case number our records don't hold yet
 * is asked of DOL's own case-status endpoint now, the way the site's case page
 * asks, and recorded so the nightly sweep keeps it from then on.
 *
 * Asked as `GET /v1/cases/{caseNumber}?live=1` by a key with the `live_lookup`
 * scope. A case we already hold is answered from our record and costs no live
 * lookup: our record is at most a sweep old, and the sweep, not a caller, is
 * what notices a status change and sends the alerts.
 *
 * THREE CEILINGS, CHARGED BEFORE DOL IS ASKED, cheapest first:
 * 1. the plan's daily live lookups for the account (Plus 200);
 * 2. every API account together, `API_LIVE_DAILY_CAP` (20,000) a UTC day, a
 *    fifth of the site's own 100,000, so DOL never sees a spike from the API;
 * 3. the site-wide discovery budget every live ask already charges
 *    (src/lib/turso/caseDiscovery.ts).
 * The first two share one `perm_docs` row a UTC day, `api_live_<date>`, a
 * JSON map of account to count, and the all-accounts count is charged first,
 * so the map holds at most the ceiling's worth of accounts. Refused attempts
 * still count (increment-then-check, like the embed's counter): a flood
 * spends the counter, never DOL.
 *
 * Every refusal says which ceiling and when it resets, in Eastern time, with
 * the same words the site's case page uses (src/lib/dolMiss.ts).
 */
import "server-only";

import { SITE_URL } from "@/lib/constants/site";
import { budgetResetEastern, unsettledClause } from "@/lib/dolMiss";
import { normaliseFlagCaseNumber } from "@/lib/flagCaseNumber";
import { discoverCaseOutcome } from "@/lib/turso/caseDiscovery";
import { one } from "@/lib/turso/client";
import { bumpDocCount } from "@/lib/turso/embedLookup";
import { lca } from "@/lib/turso/lcaCases";
import { pwd } from "@/lib/turso/pwdCases";
import { seasonal } from "@/lib/turso/seasonalCases";
import { API_LIVE_DAILY_CAP, type ApiPlan } from "@convex/lib/apiPlans";
import type { DiscoveryMiss } from "@/lib/dolMiss";

import { readCase, type CaseRecord, type ReadResult } from "./reads";
import { resetsIn, utcDay } from "./usage";

export { API_LIVE_DAILY_CAP };

const counterKey = (now: Date) => `api_live_${utcDay(now)}`;

export type LiveCharge = { ok: true } | { ok: false; which: "plan" | "account" | "all" | "error" };

/** Count one live lookup for `account` and say whether it may go ahead. */
export async function chargeLiveLookup(account: string, plan: ApiPlan, now: Date = new Date()): Promise<LiveCharge> {
  if (plan.liveLookupsPerDay <= 0) return { ok: false, which: "plan" };
  if (account === "all" || !/^acct_[0-9A-Za-z]{20}$/.test(account)) return { ok: false, which: "error" };
  const key = counterKey(now);
  try {
    if ((await bumpDocCount(key, "all", now)) > API_LIVE_DAILY_CAP) return { ok: false, which: "all" };
    return (await bumpDocCount(key, account, now)) <= plan.liveLookupsPerDay ? { ok: true } : { ok: false, which: "account" };
  } catch (e) {
    console.error("[apiLive] counter failed:", e instanceof Error ? e.message : e);
    return { ok: false, which: "error" };
  }
}

/** Live lookups used today: this account's, and every account's together. */
export async function liveLookupsUsed(account: string, now: Date = new Date()): Promise<{ account: number; all: number }> {
  try {
    const row = await one<{ mine: number | string | null; everyone: number | string | null }>(
      `SELECT json_extract(json, ?) AS mine, json_extract(json, '$."all"') AS everyone FROM perm_docs WHERE key = ?`,
      [`$."${account}"`, counterKey(now)],
    );
    return { account: Number(row?.mine) || 0, all: Number(row?.everyone) || 0 };
  } catch {
    return { account: 0, all: 0 };
  }
}

type Refusal = Extract<ReadResult<never>, { ok: false }>;

/** The words for a refusal of each kind. Exported for the tests. */
export function refusalFor(which: Exclude<LiveCharge, { ok: true }>["which"], plan: ApiPlan, now: Date): Refusal {
  const retryAfter = resetsIn(now).day;
  const reset = `It resets at ${budgetResetEastern(now)} Eastern (midnight UTC).`;
  switch (which) {
    case "plan":
      return {
        ok: false,
        status: 403,
        code: "plan_feature",
        message: `Live DOL lookups aren't on the ${plan.label} plan. Without live=1, the API answers from our records, which the nightly sweep keeps current.`,
      };
    case "account":
      return {
        ok: false,
        status: 429,
        code: "live_daily_limit",
        message: `This account has used its ${plan.liveLookupsPerDay} live DOL lookups for today on the ${plan.label} plan. ${reset}`,
        retryAfter,
      };
    case "all":
      return {
        ok: false,
        status: 429,
        code: "live_api_limit",
        message: `The API's live DOL lookups for today are used up (${API_LIVE_DAILY_CAP.toLocaleString("en-US")} across every account, so DOL never sees a spike from us). ${reset}`,
        retryAfter,
      };
    case "error":
      return {
        ok: false,
        status: 503,
        code: "live_unavailable",
        message: "We couldn't count this live lookup just now, so DOL wasn't asked. Try again in a minute.",
        retryAfter: 60,
      };
  }
}

function missAnswer(miss: DiscoveryMiss | null, caseNumber: string, now: Date): Refusal {
  const url = `${SITE_URL}/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
  if (miss === "none" || miss === null) {
    return { ok: false, status: 404, code: "not_found", message: "DOL answered just now and holds no case by this number.", url };
  }
  const clause = unsettledClause(miss, now);
  if (miss === "budget") {
    return { ok: false, status: 429, code: "live_site_limit", message: `We hold no record for ${caseNumber} yet, ${clause}`, retryAfter: resetsIn(now).day, url };
  }
  return { ok: false, status: 503, code: "dol_unavailable", message: `We hold no record for ${caseNumber} yet, ${clause}`, retryAfter: 60, url };
}

export interface LiveAnswer extends CaseRecord {
  /** True when DOL was asked during this request; false when our record answered. */
  askedDolLive: boolean;
}

/**
 * One case by number, asking DOL live when our records don't hold it. The
 * caller has already checked the key's scope.
 */
export async function readCaseLive(
  input: string,
  who: { account: string; plan: ApiPlan },
  now: Date = new Date(),
  f: typeof fetch = fetch,
): Promise<ReadResult<LiveAnswer>> {
  const held = await readCase(input);
  if (held.ok) return { ...held, data: { ...held.data, askedDolLive: false } };
  if (held.status !== 404) return held;

  const ref = normaliseFlagCaseNumber(input.slice(0, 40));
  if (!ref) return held;

  const charge = await chargeLiveLookup(who.account, who.plan, now);
  if (!charge.ok) return refusalFor(charge.which, who.plan, now);

  const outcome =
    ref.program === "perm"
      ? await discoverCaseOutcome(ref.caseNumber, f, now).then(
          (o) => ({ found: o.found !== null, miss: o.miss }),
          () => ({ found: false, miss: "unavailable" as const }),
        )
      : await { pwd, lca, seasonal }[ref.program].discoverOutcome(ref.caseNumber, f, now).then(
          (o) => ({ found: o.row !== null, miss: o.miss }),
          () => ({ found: false, miss: "unavailable" as const }),
        );
  if (!outcome.found) return missAnswer(outcome.miss, ref.caseNumber, now);

  // Discovery recorded the case, so our own read now answers it, in the same
  // shape as every other case answer.
  const fresh = await readCase(ref.caseNumber);
  if (fresh.ok) return { ...fresh, data: { ...fresh.data, askedDolLive: true } };
  // DOL answered but the record didn't land (the write is logged as failed):
  // say so rather than call the case unknown.
  return {
    ok: false,
    status: 503,
    code: "record_failed",
    message: "DOL answered, but we couldn't record the case just now. Try again in a minute.",
    retryAfter: 60,
    url: `${SITE_URL}/perm-case-status?case=${encodeURIComponent(ref.caseNumber)}`,
  };
}
