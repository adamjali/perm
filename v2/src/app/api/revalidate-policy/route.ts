/**
 * Expire the pages that show the policy feed and the rule pipeline, the run
 * any policy source writes something.
 *
 * The sources are read every 30 minutes on the server (OIRA, the Federal
 * Register and its public inspection list, the White House, USCIS) and every
 * weekday hour on GitHub (DOL, OFLC), and the policy page sits on a six-hour
 * window, so a filing or a proclamation would otherwise wait up to six hours
 * to show. Each script POSTs here when it wrote something
 * (`scripts/lib_policy_feed.py`, `expire_policy_page`); the rule watch reports
 * `rules_changed` and its runner POSTs.
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
