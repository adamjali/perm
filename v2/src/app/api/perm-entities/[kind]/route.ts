import { NextResponse } from "next/server";

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
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  if (!isEntityKind(kind)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 404 });
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
