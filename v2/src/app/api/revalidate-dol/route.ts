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
 * IT NOW CLEARS A TAG AS WELL AS THE PATHS, and the two do different jobs.
 * The tag drops the cached DATA, the paths drop the rendered PAGES that print
 * it. Without the tag the pages would regenerate and read the same cached
 * freshness row straight back, so the as-of stamp would not move.
 *
 * `revalidateTag` takes a SECOND argument in Next 16, a `cacheLife` profile
 * name or a `{ expire }` object; called with one argument it warns and is
 * deprecated. `{ expire: 0 }` is immediate expiry, which is what this wants:
 * DOL has published a new figure and the old one is now wrong. Read out of
 * Next 16.3.4's own `revalidate.js`, where `expire === 0` also marks the path
 * as revalidated. The named profiles are stale-while-revalidate windows
 * ("max" serves the old value for five more minutes), which is the wrong
 * semantic for a number that just changed.
 *
 * This is only safe from a Route Handler. The same source throws if
 * `revalidateTag` is called during a render, inside `use cache`, inside
 * `unstable_cache`, or inside `generateStaticParams`.
 *
 * The original reason a tag was not used. Tags attach to
 * data through `fetch` with `next.tags`, `unstable_cache`, or `cacheTag` inside
 * a `"use cache"` scope, and none of those are used: Turso is read through a raw
 * libSQL client. A tag call would return 200, log nothing, and leave every
 * prerender in place.
 *
 * WHAT THIS DOES NOT DO. `revalidatePath` MARKS a path stale; it does not
 * regenerate it. The next visitor pays for one render and everyone after them
 * gets it fresh, so a page nobody opens costs nothing.
 */

import { revalidatePath, revalidateTag } from "next/cache";
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

  // Data first, then the pages that render it. `data-freshness` is the tag on
  // getFreshness in src/lib/turso/publicData.ts.
  revalidateTag("data-freshness", { expire: 0 });

  for (const path of DOL_PAGES) {
    revalidatePath(path);
  }

  return NextResponse.json({
    revalidated: DOL_PAGES.length,
    paths: DOL_PAGES,
    now: Date.now(),
  });
}
