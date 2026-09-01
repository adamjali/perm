/**
 * Expire the pages that render DOL's processing-times snapshot, the moment DOL
 * republishes it.
 *
 * THE PROBLEM THIS SOLVES. The homepage band reads "Live from the Department of
 * Labor · <date>", where the date is DOL's OWN as-of stamp, parsed from their
 * table caption. The ingest refreshes that daily, but the pages carrying it sit
 * on `revalidate = 86400`. So on the day DOL moves, the fresh number can be in
 * Turso while every public page still serves the old one for up to another 24
 * hours: worst case ~48h behind DOL when the two windows stack, on a band whose
 * whole claim is that it is live. `page.tsx` has said "The ingest should also
 * revalidate on demand" since it was written; this is that.
 *
 * WHY A FIXED LIST AND NO INPUT. The employer endpoint next door has to accept
 * slugs, because which employers moved is only known at runtime. Here the set is
 * static: it is exactly the pages that read `getProcessingTimes()` (directly or
 * through `lib/turso/estimate`), and it changes only when someone adds a page.
 * Taking no input at all means there is no path to validate, no traversal to
 * defend against, and no way to aim this at anything else. A caller either
 * knows the secret and expires these ten paths, or does nothing.
 *
 * WHY NOT A TAG. `revalidateTag` is a silent no-op in this app. Tags attach to
 * data through `fetch` with `next.tags`, `unstable_cache`, or `cacheTag` inside
 * a `"use cache"` scope, and none of those are used: Turso is read through a raw
 * libSQL client. A tag call would return 200, log nothing, and leave every
 * prerender in place.
 *
 * WHAT THIS DOES NOT DO. `revalidatePath` MARKS a path stale; it does not
 * regenerate it. The next visitor pays for one render and everyone after them
 * gets it fresh, so a page nobody opens costs nothing.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// The list lives in ./paths because a `route.ts` may export ONLY the known
// handler names; anything else fails Next's route type generation during
// `next build` (and nowhere earlier). See that file for what is in it and why.
import { DOL_PAGES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const path of DOL_PAGES) {
    revalidatePath(path);
  }

  return NextResponse.json({
    revalidated: DOL_PAGES.length,
    paths: DOL_PAGES,
    now: Date.now(),
  });
}
