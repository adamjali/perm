/**
 * Expire the pages that show the rule pipeline, the run a rule moves.
 *
 * The rule watch reads OIRA's review lists and the Federal Register's public
 * inspection list at 3 AM and at 9 AM and 5 PM Eastern on weekdays, and the
 * policy page sits on a six-hour window, so a rule OIRA cleared that morning
 * would otherwise show as under review until the afternoon. The ingest reports
 * `rules_changed` and the workflow POSTs here.
 *
 * Takes no input, like `revalidate-bulletin`: a caller either knows the secret
 * and expires this fixed set, or does nothing.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { POLICY_PAGES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const path of POLICY_PAGES) revalidatePath(path);

  return NextResponse.json({ revalidated: POLICY_PAGES.length, now: Date.now() });
}
