import { NextResponse } from "next/server";

import { getSweepCoverage } from "@/lib/db/sweepCoverage";

/**
 * GET /api/sweep-stamp: when our DOL sweep last finished (epoch ms), the time
 * pages print as "Checked against DOL". An open page asks every few minutes
 * (RefreshWhenStale) and redraws itself when this moves. Cloudflare doesn't
 * cache /api (it answers DYNAMIC), so each ask reaches the server: one point
 * read of the sweep's record, kept for the request. Null when no recent sweep
 * is on record.
 */
export async function GET() {
  const sweep = await getSweepCoverage().catch(() => null);
  return NextResponse.json(
    { checkedAt: sweep?.checkedAt ?? null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } },
  );
}
