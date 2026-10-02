/**
 * Expire the pages that render the visa bulletin, the day a new one is stored.
 *
 * The ingest reads State's index at 3 AM and the pages sit on a one-day window,
 * so without this a bulletin published during the day would show the old month
 * until the next morning, on the day most people check it and the day the
 * bulletin-alert emails link here. The ingest reports `bulletin_changed` and
 * the workflow POSTs here.
 *
 * Takes no input, like `revalidate-dol`: a caller either knows the secret and
 * expires this fixed set, or does nothing. `revalidatePath` marks a page stale;
 * the next visitor pays for one render.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { BULLETIN_PAGES, BULLETIN_PAGE_FAMILIES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const path of BULLETIN_PAGES) revalidatePath(path);
  for (const family of BULLETIN_PAGE_FAMILIES) revalidatePath(family, "page");

  return NextResponse.json({
    revalidated: BULLETIN_PAGES.length,
    families: BULLETIN_PAGE_FAMILIES,
    now: Date.now(),
  });
}
