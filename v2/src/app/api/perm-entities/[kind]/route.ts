import { NextResponse } from "next/server";

import { api } from "@/../convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

import { fetchAllEntitiesServer } from "@/lib/entitySeed";
import { isEntityKind, packRow, type EntityPayload } from "@/lib/entityPayload";

/**
 * The whole of one entity kind, in the compact wire format.
 *
 * The index pages server-render a seed for search engines and first paint,
 * then fetch this once when a visitor searches, sorts, filters or pages past
 * the seed. 12,240 employers is roughly 900 KB here and a quarter of that
 * over the wire, which is a fine price for an interaction the visitor asked
 * for and a bad one to put in every page load.
 *
 * The data changes quarterly, so it is cached hard at the edge.
 */
// Daily, not hourly. This route returns an entire entity kind - 16,305
// employers - so it is the largest single regeneration on the site, and
// the disclosure files behind it are quarterly.
export const revalidate = 86400;

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  if (!isEntityKind(kind)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 404 });
  }

  // ?q= searches the WHOLE corpus rather than dumping it. The page lazily
  // loads a bounded head of the rank order, so a client-side search can only
  // see what was downloaded; for a small sponsor that means "no match" for a
  // row that plainly exists. A search-index read is bounded and cheap, so
  // this is the path that makes everything findable without a 7 MB payload.
  const q = new URL(_request.url).searchParams.get("q");
  if (q !== null) {
    const found = await fetchQuery(api.permEntities.searchByName, {
      kind,
      text: q.slice(0, 120),
      limit: 100,
    }).catch(() => []);
    const payload: EntityPayload = {
      kind,
      count: found.length,
      computedAt: null,
      rows: found.map((r) =>
        packRow({
          slug: r.slug,
          name: r.name,
          rank: r.rank,
          total: r.total,
          certified: r.certified,
          denied: r.denied,
          medianDays: r.medianDays,
          medianAnnualWage: r.medianAnnualWage ?? null,
          state: r.state ?? null,
          code: r.code ?? null,
        }),
      ),
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  const rows = await fetchAllEntitiesServer(kind);
  const payload: EntityPayload = {
    kind,
    count: rows.length,
    computedAt: null,
    rows: rows.map(packRow),
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
