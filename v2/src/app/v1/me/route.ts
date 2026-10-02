import { NextResponse } from "next/server";

import { authenticate } from "@/lib/api/auth";
import { apiError } from "@/lib/api/route";
import { resetsIn, takeMinute, usageFor } from "@/lib/api/usage";

export const dynamic = "force-dynamic";

/** Your plan, its limits and what you've used. Not counted against them. */
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
  const { plan, keyId, account } = auth.caller;
  const minute = takeMinute(keyId, plan.perMinute);
  if (!minute.ok) {
    return apiError(429, "rate_limited", `The ${plan.label} plan allows ${plan.perMinute} calls a minute. Try again in ${minute.reset} seconds.`, {
      retryAfter: minute.reset,
    });
  }
  const now = new Date();
  const used = await usageFor(account, now);
  const resets = resetsIn(now);
  return NextResponse.json(
    {
      data: {
        key: { id: keyId },
        plan: { id: plan.id, name: plan.label, perMinute: plan.perMinute, perDay: plan.perDay, perMonth: plan.perMonth },
        usage: {
          today: used.today,
          thisMonth: used.month,
          remainingToday: Math.max(0, Math.min(plan.perDay - used.today, plan.perMonth - used.month)),
          remainingThisMonth: Math.max(0, plan.perMonth - used.month),
          dayResetsInSeconds: resets.day,
          monthResetsInSeconds: resets.month,
        },
      },
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
