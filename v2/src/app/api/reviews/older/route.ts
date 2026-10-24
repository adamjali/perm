import { NextResponse, type NextRequest } from "next/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";

export const dynamic = "force-dynamic";

/**
 * The next page of shown reviews older than `before` (a time in milliseconds): what "Show older reviews" on
 * /reviews loads once the page's own newest 500 run out, so every review stays reachable however many there are.
 * Public data only (the same fields /reviews prints). A bad `before` is a 400; a failed read a 503 with its reason,
 * never an empty page that would read as "no older reviews". Cached at the edge for five minutes.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = req.nextUrl.searchParams.get("before") ?? "";
  const before = /^\d{1,15}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isFinite(before)) {
    return NextResponse.json({ error: "before must be a time in milliseconds" }, { status: 400 });
  }
  try {
    const page = await fetchQuery(api.siteReviews.listOlder, { before });
    return NextResponse.json(page, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (error) {
    console.warn("[reviews/older] couldn't read older reviews:", String(error));
    return NextResponse.json(
      { error: "Older reviews couldn't be loaded just now. Please try again in a minute." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
