/**
 * Expire the pages that render our DOL sweep's figures, when the sweep ends.
 *
 * Called by .github/workflows/case-status-direct.yml and pwd-status-direct.yml after each pass, with
 * the shared revalidation secret. Same shape as /api/revalidate-dol: a fixed
 * list and no input, so there is nothing to validate and no way to aim it at
 * another page. `revalidatePath` marks a path stale; the next visitor pays for
 * one render and everyone after them reads the new figures.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { SWEEP_PAGES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  for (const path of SWEEP_PAGES) revalidatePath(path);
  return NextResponse.json({ revalidated: SWEEP_PAGES.length, paths: SWEEP_PAGES, now: Date.now() });
}
