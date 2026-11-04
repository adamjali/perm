/**
 * Expire the pages that print USCIS's posted processing times, after the server's posted-times job
 * (`permtracker-uscis posted-times`). Takes no input: a caller knows the secret and expires this set, or does nothing.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { USCIS_TIMES_PAGES } from "./paths";
import { secretMatches } from "@/lib/secretMatch";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!(await secretMatches(secret, expected))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  for (const path of USCIS_TIMES_PAGES) revalidatePath(path);
  return NextResponse.json({ revalidated: USCIS_TIMES_PAGES.length, now: Date.now() });
}
