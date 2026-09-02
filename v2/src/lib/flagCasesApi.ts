import { NextResponse } from "next/server";
import type { FlagProgram } from "@/lib/turso/flagCases";
import { FLAG_DEFAULT_ITEMS, isFlagKind } from "@/lib/turso/flagCases";
import { MAX_TITLE_FILTER, SEARCH_MONTH_RE } from "@/lib/turso/cases";

/**
 * The GET handler for a FLAG program's cases (`/api/pwd-cases`,
 * `/api/lca-cases`). A route file may export only the handler names, so the
 * shared body lives here and each route is two lines.
 *
 * Reachable by strangers: cheap guards first (length, shape), and nothing
 * can be pointed at an unbounded read - every list is one indexed range,
 * every search one employer's slug range.
 */

const MAX_TEXT = 120;
const MAX_CURSOR = 200;

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function makeFlagCasesHandler(program: FlagProgram) {
  return async function GET(request: Request) {
    const p = new URL(request.url).searchParams;
    const action = p.get("action") ?? "list";

    if (action === "lookup") {
      const raw = p.get("caseNumber") ?? "";
      if (!raw || raw.length > 32) return bad("caseNumber missing or too long");
      const row = await program.lookup(raw);
      return NextResponse.json(
        { case: row },
        {
          headers: {
            "Cache-Control": row?.isFinal
              ? "public, s-maxage=86400, stale-while-revalidate=86400"
              : "public, s-maxage=600, stale-while-revalidate=3600",
          },
        },
      );
    }

    const title = p.get("title") ?? "";
    if (title.length > MAX_TITLE_FILTER) return bad("title filter too long");
    const from = p.get("from") ?? "";
    const to = p.get("to") ?? "";
    if ((from && !SEARCH_MONTH_RE.test(from)) || (to && !SEARCH_MONTH_RE.test(to))) {
      return bad("from and to must be YYYY-MM");
    }
    const visa = p.get("visa") === "all" ? "all" : "default";

    if (action === "search") {
      const text = p.get("text") ?? "";
      if (text.length < 2 || text.length > MAX_TEXT) return bad("text must be 2..120 chars");
      const cases = await program.search({
        text,
        ...(title ? { title } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        visa,
      });
      return NextResponse.json(
        { cases },
        { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
      );
    }

    if (action !== "list") return bad("unknown action");

    const kind = p.get("kind") ?? "all";
    if (!isFlagKind(kind)) return bad("kind must be pending, decided or all");
    const month = p.get("month");
    if (month && !SEARCH_MONTH_RE.test(month)) return bad("month must be YYYY-MM");
    const cursor = p.get("cursor");
    if (cursor && cursor.length > MAX_CURSOR) return bad("cursor too long");
    const order = p.get("order") === "oldest" ? "oldest" : "newest";
    const rawItems = Number(p.get("numItems") ?? FLAG_DEFAULT_ITEMS);
    const page = await program.list({
      kind,
      month: month ?? null,
      order,
      cursor: cursor ?? null,
      visa,
      ...(Number.isFinite(rawItems) ? { numItems: Math.floor(rawItems) } : {}),
    });
    return NextResponse.json(page, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" },
    });
  };
}
