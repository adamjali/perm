import { NextResponse } from "next/server";

import { authenticate } from "@/lib/api/auth";
import { liveLookupsUsed } from "@/lib/api/live";
import { apiError } from "@/lib/api/route";
import { resetsIn, takeMinute, usageFor } from "@/lib/api/usage";
import { API_PLANS } from "@convex/lib/apiPlans";

export const dynamic = "force-dynamic";

/**
 * Your key, the plan that applies, its limits and what you've used. Not
 * counted against them, so it answers even when a day's allowance is spent.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return auth.code === "key_check_failed"
      ? apiError(503, auth.code, auth.message, { retryAfter: 60 })
      : apiError(401, auth.code, auth.message);
  }
  if (auth.caller.kind !== "key") {
    return apiError(401, "missing_key", "Send your key as Authorization: Bearer <key> to see its plan and usage.");
  }
  const { plan, keyId, account, accountPlan, paywall, scopes, sandbox, expiresAt } = auth.caller;
  const minute = takeMinute(keyId, plan.perMinute);
  if (!minute.ok) {
    return apiError(429, "rate_limited", `The ${plan.label} plan allows ${plan.perMinute} calls a minute. Try again in ${minute.reset} seconds.`, {
      retryAfter: minute.reset,
    });
  }
  const now = new Date();
  // A sandbox key's calls are never counted, so its usage is zero by design.
  const [used, live] = sandbox
    ? [{ today: 0, month: 0 }, { account: 0, all: 0 }]
    : await Promise.all([usageFor(account, now), liveLookupsUsed(account, now)]);
  const resets = resetsIn(now);
  return NextResponse.json(
    {
      data: {
        key: {
          id: keyId,
          sandbox,
          scopes,
          expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString(),
        },
        plan: {
          id: plan.id,
          name: plan.label,
          perMinute: plan.perMinute,
          perDay: plan.perDay,
          perMonth: plan.perMonth,
          keys: plan.keys,
          sandboxKeys: plan.sandboxKeys,
          exportRows: plan.exportRows,
          liveLookupsPerDay: plan.liveLookupsPerDay,
          webhookEndpoints: plan.webhookEndpoints,
          webhookWatches: plan.webhookWatches,
        },
        accountPlan: { id: accountPlan, name: API_PLANS[accountPlan].label },
        paywall: {
          enforced: paywall,
          note: paywall
            ? "Your account's own plan sets these limits."
            : "Paid features are free for now: every account gets the Plus plan's limits until billing opens.",
        },
        usage: {
          today: used.today,
          thisMonth: used.month,
          remainingToday: Math.max(0, Math.min(plan.perDay - used.today, plan.perMonth - used.month)),
          remainingThisMonth: Math.max(0, plan.perMonth - used.month),
          liveLookupsToday: live.account,
          liveLookupsRemainingToday: Math.max(0, plan.liveLookupsPerDay - live.account),
          dayResetsInSeconds: resets.day,
          monthResetsInSeconds: resets.month,
          ...(sandbox ? { note: "Sandbox keys aren't counted." } : {}),
        },
      },
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
