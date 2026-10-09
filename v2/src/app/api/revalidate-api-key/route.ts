/**
 * Drop the site's cached answer for API keys that were just revoked or
 * rotated, so they stop at once instead of within the cache's minute.
 *
 * Convex POSTs the keys' public ids here (apiKeys.pushRevoke) with the shared
 * REVALIDATE_SECRET. Each copy of the site caches keys in its own memory, and
 * nginx mirrors every `/api/revalidate-*` request to the second copy, which is
 * why this lives under that prefix. The ids name no person; the worst a caller
 * with the secret could do is make the next call with those keys ask Convex.
 */

import { NextResponse } from "next/server";

import { forgetKeys } from "@/lib/api/auth";

const KEY_ID_RE = /^[0-9A-Za-z]{8}$/;
const MAX_IDS = 20;

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  const ids = (body as { keyIds?: unknown } | null)?.keyIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every((id): id is string => typeof id === "string" && KEY_ID_RE.test(id))
  ) {
    return NextResponse.json({ error: `Expected { keyIds: string[] }, 1 to ${MAX_IDS} key ids` }, { status: 400 });
  }
  return NextResponse.json({ forgotten: forgetKeys(ids), now: Date.now() });
}
