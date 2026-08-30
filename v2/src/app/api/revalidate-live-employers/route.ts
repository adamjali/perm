/**
 * Expire the cached pages of live-only employers whose cases moved last night.
 *
 * THE PROBLEM THIS SOLVES. `/perm-employers/[slug]` carries `revalidate =
 * 2592000`. Thirty days is correct for its main branch, which renders the
 * QUARTERLY disclosure corpus, and it is not negotiable downward: there are
 * ~21,495 live-only employer pages, every expiry a crawler walks into is a
 * paid ISR write, and a weekly window on that tail is most of what took the
 * Vercel cache-write meter to 100% on 2026-08-29. But the same route file has
 * a second branch for employers that exist ONLY in `perm_live_recent`, and
 * that data is rebuilt nightly. Those pages were serving statuses up to a
 * month stale while telling the reader they lag "by days".
 *
 * `export const revalidate` is route-segment config: one statically analysable
 * value per segment. It cannot be conditional, so the two branches cannot have
 * two windows. Path-level invalidation is the way out - it expires the few
 * hundred pages that actually changed and leaves the other twenty thousand on
 * their thirty-day window.
 *
 * WHY NOT A TAG. `revalidateTag` would be a SILENT NO-OP here. Tags attach to
 * data through exactly three mechanisms - `fetch` with `next.tags`,
 * `unstable_cache`, or `cacheTag` inside a `"use cache"` scope - and this app
 * uses none of them: Turso is read through a raw libSQL client. A tag call
 * would return 200, log nothing, and leave every prerender in place. That is
 * the "wired is not proven" failure this codebase keeps meeting, and it would
 * have read as working for months.
 *
 * A tag would also be the wrong SHAPE even if it worked. One tag over all
 * 21,495 pages expires all of them at once, and each becomes a paid write on
 * first visit - reproducing the exact cost failure the thirty-day window was
 * set to fix.
 *
 * WHAT THIS DOES NOT DO. `revalidatePath` from a route handler MARKS a path
 * stale; it does not regenerate it. The next visitor pays for the render and
 * everyone after them gets it fresh. That is the behaviour we want: a page
 * nobody opens costs nothing.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * A global cap on the shared resource, not a per-caller one.
 *
 * A per-identity limit cannot stop identity rotation, so the only limit worth
 * having on a public route is one on the finite thing being protected - here,
 * ISR writes. A normal night changes a few hundred employers; anything asking
 * for thousands is either a bug in the ingest or someone trying to make us pay
 * to regenerate the whole tail, and both deserve the same answer.
 */
const MAX_PATHS = 800;

/** `slugify` truncates at 60. Loose, so widening it later cannot 400 valid slugs. */
const MAX_SLUG = 80;

export async function POST(request: Request): Promise<NextResponse> {
  // Cheapest guard first. Everything below this line is only reachable by the
  // ingest, which keeps the parsing and the loop off a stranger's request.
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const raw = (body as { slugs?: unknown } | null)?.slugs;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Expected { slugs: string[] }" }, { status: 400 });
  }

  // Shape checks before the length check would let a caller hand us a
  // megabyte of strings to validate. Count first.
  if (raw.length > MAX_PATHS) {
    return NextResponse.json(
      { error: `Too many paths: ${raw.length} > ${MAX_PATHS}`, limit: MAX_PATHS },
      // 429, not 400: the request is well formed and the caller should retry
      // with fewer. A 400 here would read as a malformed payload in
      // monitoring and send the next person debugging the JSON.
      { status: 429 },
    );
  }

  const slugs = [
    ...new Set(
      raw.filter(
        (s): s is string =>
          typeof s === "string" &&
          s.length > 0 &&
          s.length <= MAX_SLUG &&
          // The slug alphabet the writer can actually produce. This is also
          // what stops a path from escaping its segment: without it, "../.."
          // would be handed straight to revalidatePath.
          /^[a-z0-9-]+$/.test(s),
      ),
    ),
  ];

  if (slugs.length === 0) {
    return NextResponse.json({ error: "No usable slugs" }, { status: 400 });
  }

  for (const slug of slugs) {
    // A LITERAL path, never the `('/perm-employers/[slug]', 'page')` pattern
    // form. The pattern form invalidates all 12,240 published pages AND all
    // 21,495 live-only ones in one call, which is the catastrophic version of
    // this endpoint rather than a shortcut.
    revalidatePath(`/perm-employers/${slug}`);
  }

  return NextResponse.json({
    revalidated: slugs.length,
    skipped: raw.length - slugs.length,
    now: Date.now(),
  });
}
