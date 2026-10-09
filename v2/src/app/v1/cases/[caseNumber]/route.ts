import { hasScope } from "@convex/lib/apiPlans";
import { readCaseLive } from "@/lib/api/live";
import { apiGet } from "@/lib/api/route";
import { readCase } from "@/lib/api/reads";

export const dynamic = "force-dynamic";

/**
 * One case by number: PERM (G-100-...), prevailing wage (P-100-...), H-1B LCA
 * (I-200-...) or H-2A/H-2B/CW-1. With `live=1`, a number our records don't
 * hold yet is asked of DOL now (src/lib/api/live.ts); that needs a key with
 * the live_lookup scope.
 */
export const GET = apiGet<{ caseNumber: string }>(async ({ url, caller }, { caseNumber }) => {
  const live = url.searchParams.get("live");
  if (live !== null && live !== "1" && live !== "0") {
    return { ok: false, status: 400, code: "bad_request", message: "live must be 1 or 0." };
  }
  if (live !== "1") return readCase(caseNumber);
  if (!hasScope(caller.scopes, "live_lookup")) {
    return {
      ok: false,
      status: 403,
      code: "missing_scope",
      message: 'Asking DOL live needs a key with the "live_lookup" scope. Make one in Settings, under API keys, or leave out live=1.',
    };
  }
  return readCaseLive(caseNumber, { account: caller.account, plan: caller.plan });
});
