/**
 * Expire the quarterly-disclosure pages the moment a new file lands.
 *
 * THE TRADE THIS MAKES. Without a trigger, a page reading data that changes
 * four times a year has to revalidate often enough to notice a change on its
 * own, which means ~364 wasted expiries a year to catch four real ones. Every
 * expiry a visitor walks into is a paid ISR render producing an identical
 * page. With this, the window can be long AND the page is correct within
 * minutes of the ingest finishing.
 *
 * The window is deliberately still finite (a week, not a month) so a run of
 * this endpoint that never happens - a failed workflow, a rotated secret -
 * bounds the staleness at seven days instead of thirty. A trigger that is the
 * ONLY way a page can update is a single point of failure with no floor.
 *
 * WHY A FIXED LIST AND NO INPUT, same as `revalidate-dol`: the set is static,
 * so taking no input means there is no path to validate, no traversal to
 * defend, and no way to aim this at anything else.
 *
 * WHAT THIS DOES NOT DO. `revalidatePath` MARKS a path stale; it does not
 * regenerate it. The next visitor pays for one render and everyone after them
 * gets it fresh, so a page nobody opens costs nothing.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { DISCLOSURE_PAGES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The data first, then the pages that render it. Without the tag the pages
  // regenerate and read the same cached freshness row straight back, so the
  // as-of stamp would not move. `{ expire: 0 }` is immediate expiry; called
  // with one argument `revalidateTag` warns and is deprecated in Next 16.
  revalidateTag("data-freshness", { expire: 0 });

  for (const path of DISCLOSURE_PAGES) {
    revalidatePath(path);
  }

  return NextResponse.json({
    revalidated: DISCLOSURE_PAGES.length,
    paths: DISCLOSURE_PAGES,
    now: Date.now(),
  });
}
