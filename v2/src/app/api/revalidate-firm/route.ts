/**
 * Refresh one law firm's page when its own profile changes.
 *
 * `/perm-attorneys/[slug]` sits on a 30-day window because its figures move
 * with DOL's quarterly files. A firm that claims its page (convex/firmClaims.ts)
 * expects its words to show, or come down, in minutes, so Convex POSTs the
 * firm's slug here whenever a profile is published, edited, hidden or revoked.
 * One literal path per call: nothing here can expire the whole family.
 *
 * `revalidatePath` marks the page stale (and the profile read it made with
 * it); the next visitor pays for one render.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Firm slugs as `slugify` makes them, with room to spare. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  const slug = (body as { slug?: unknown } | null)?.slug;
  if (typeof slug !== "string" || slug.length > 120 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Expected { slug: string }" }, { status: 400 });
  }
  revalidatePath(`/perm-attorneys/${slug}`);
  return NextResponse.json({ revalidated: `/perm-attorneys/${slug}`, now: Date.now() });
}
