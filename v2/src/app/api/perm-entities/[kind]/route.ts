import { NextResponse } from "next/server";

import { fetchAllEntitiesServer } from "@/lib/entitySeed";
import { searchByName } from "@/lib/turso/entities";
import { searchLiveOnlyEmployers } from "@/lib/turso/liveEmployers";
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

/**
 * How many name matches one answer carries: published rows, and live-only
 * employers. Each is asked for ONE over, so the answer can say "more match,
 * type more of the name" instead of implying it holds everything. They were
 * 100 and 25 with no such flag until Sep 29 2026, and the table said "searched
 * across all of them" over a capped list. Rows are ~80 bytes packed, so 200
 * is ~16 KB.
 */
const NAME_MATCHES_SHOWN = 200;
const LIVE_MATCHES_SHOWN = 50;

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
  // row that plainly exists. Scanning one kind is at most 16,305 rows and
  // measured at 42 ms, so this makes everything findable without a 7 MB
  // payload. It is a substring match in rank order and nothing ranks by
  // relevance: `perm_entities` has no full-text index.
  const url = new URL(_request.url);
  const q = url.searchParams.get("q");
  if (q !== null) {
    const needle = q.slice(0, 120);
    // TWO CORPORA, ONE QUESTION. `perm_entities` is built from DOL's
    // published quarterly files, so it only holds employers with a decided
    // case in a published quarter. `perm_live_recent` is everything the
    // published files do not hold, and on 2026-08-30 it named 37,813
    // employers, 21,495 of them with NO entity row at all - 23% of the
    // 93,007 employers we hold, unreachable from the one box a person
    // types a name into.
    // They come back in their own field, never merged into `rows`: they have
    // no rank, no rate and no median, and a packed row of zeros would render
    // as a real record of a company that certified nothing.
    //
    // Employers only. The live feed has no law-firm name and no occupation,
    // so for the other two kinds there is nothing to search rather than
    // nothing found.
    //
    // ## Why `scope=live` exists, and it is a COST control not a feature flag
    //
    // The two halves cost wildly different amounts and are wanted at
    // different times. `searchByName` is a LIKE, which SQLite serves by
    // walking all 71,512 employer rows in rank order, so it only runs when
    // the client's downloaded slice could not answer - its original trigger.
    // The live half is an indexed prefix range whose worst measured 2-char
    // prefix touches 5,365 rows, 13x cheaper, and it answers a question the
    // client cannot answer locally AT ALL: a search for "lorenz" matches 5
    // published employers, so the table fills, the remote call would never
    // fire under the old trigger, and LORENZ BUS SERVICE INC - 174 live
    // cases, no published record - stays invisible. So the client asks for
    // the live half on every settled query and pairs it with the expensive
    // half only when it needs it.
    const liveOnly = url.searchParams.get("scope") === "live";
    // ?limit= lets a small caller (the search palette shows five) ask for
    // less and still learn whether more match. Never above the caps.
    const asked = Math.floor(Number(url.searchParams.get("limit")));
    const nameCap = asked > 0 ? Math.min(asked, NAME_MATCHES_SHOWN) : NAME_MATCHES_SHOWN;
    const liveCap = asked > 0 ? Math.min(asked, LIVE_MATCHES_SHOWN) : LIVE_MATCHES_SHOWN;
    const [found, live] = await Promise.all([
      liveOnly ? Promise.resolve([]) : searchByName(kind, needle, nameCap + 1),
      kind === "employer" ? searchLiveOnlyEmployers(needle, liveCap + 1) : Promise.resolve([]),
    ]);
    const shown = found.slice(0, nameCap);
    const payload: EntityPayload = {
      kind,
      count: shown.length,
      computedAt: null,
      rows: shown.map(packRow),
      live: live.slice(0, liveCap),
      more: found.length > nameCap,
      liveMore: live.length > liveCap,
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
