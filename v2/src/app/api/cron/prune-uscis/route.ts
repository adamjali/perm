/**
 * Nightly retention for the USCIS case-status table.
 *
 * The privacy policy (section 18) promises that a stored lookup is deleted
 * twelve months after the last lookup of that receipt. `pruneUscisCaseStatus`
 * implements and tests that; this route is its clock. Vercel's cron calls it
 * with `Authorization: Bearer <CRON_SECRET>` (declared in vercel.json against
 * HOUSEKEEPING_JOBS in ../dispatch/jobs.ts, which the test there enforces).
 * Never a GET without the secret: a mail gateway or a crawler must not be
 * able to run a delete, even a correct one.
 */

import { NextResponse } from "next/server";

import { pruneUscisCaseStatus } from "@/lib/turso/uscisCaseStatus";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const deleted = await pruneUscisCaseStatus(new Date());
    console.log(`[prune-uscis] deleted ${deleted}`);
    return NextResponse.json({ deleted });
  } catch (e) {
    console.error("[prune-uscis] failed", e);
    return NextResponse.json({ error: "prune failed" }, { status: 500 });
  }
}
