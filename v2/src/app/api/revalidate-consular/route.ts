/**
 * Expire the consulate pages the day a new IV Scheduling Status Tool table is stored.
 *
 * The table is copied in a browser monthly (State refuses scripts) and loaded on the server, which
 * POSTs here through nginx to both web copies. Takes no input, like `revalidate-bulletin`: a caller
 * either knows the secret and expires this fixed set, or does nothing.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { CONSULAR_PAGES, CONSULAR_PAGE_FAMILIES } from "./paths";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const path of CONSULAR_PAGES) revalidatePath(path);
  for (const family of CONSULAR_PAGE_FAMILIES) revalidatePath(family, "page");

  return NextResponse.json({ revalidated: CONSULAR_PAGES.length, families: CONSULAR_PAGE_FAMILIES, now: Date.now() });
}
