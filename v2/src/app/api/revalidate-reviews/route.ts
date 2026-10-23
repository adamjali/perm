/**
 * Refresh the pages that show the site's reviews when the owner approves or declines one (convex/siteReviews.ts).
 *
 * /reviews and the homepage sit on a daily window; an approval should show in minutes. Takes no input: the two
 * paths are fixed (REVIEW_PAGES in paths.ts), so nothing here can be aimed at another page. `revalidatePath` marks each
 * stale, with the review read it made; the next visitor pays for one render.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { REVIEW_PAGES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  for (const path of REVIEW_PAGES) revalidatePath(path);
  return NextResponse.json({ revalidated: REVIEW_PAGES, now: Date.now() });
}
