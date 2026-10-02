import { NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { usageByKey, usageFor } from "@/lib/api/usage";

export const dynamic = "force-dynamic";

/**
 * The signed-in person's API calls, for Settings > API keys. The account id
 * comes from their own Convex session, never from the request, so nobody can
 * read another account's counts.
 */
export async function GET(): Promise<NextResponse> {
  const token = await convexAuthNextjsToken();
  if (!token) return NextResponse.json({ error: "Sign in to see your API usage." }, { status: 401 });
  const mine = await fetchQuery(api.apiKeys.mine, {}, { token });
  const headers = { "Cache-Control": "no-store" };
  if (!mine?.account) return NextResponse.json({ today: 0, month: 0, byKey: [] }, { headers });
  const [totals, byKey] = await Promise.all([usageFor(mine.account), usageByKey(mine.account)]);
  return NextResponse.json({ today: totals.today, month: totals.month, byKey }, { headers });
}
