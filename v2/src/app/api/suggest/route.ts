import { NextResponse } from "next/server";

import {
  SUGGEST_KINDS,
  SUGGEST_MAX_LENGTH,
  SUGGEST_MIN_LENGTH,
  suggestNames,
  type NameSuggestion,
  type SuggestKind,
} from "@/lib/turso/nameSuggest";

/**
 * GET /api/suggest?kind=employer|attorney|occupation|all&q=...
 *
 * The closest employer, law firm or occupation names to a search that found
 * nothing, for every "did you mean" on the site. A typo isn't a reason to
 * show nobody: the name index forgives one (src/lib/fuzzy.ts).
 *
 * A bad kind or a query outside 2 to 80 characters is a 400, never an empty
 * 200, so a mistake can't read as "no such name". The answer for one query
 * doesn't change between the nightly loads, so the edge may keep it an hour.
 */

const ALL_PER_KIND = 3;
const ALL_LIMIT = 6;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "all";
  const q = (url.searchParams.get("q") ?? "").trim();
  if (kind !== "all" && !SUGGEST_KINDS.includes(kind as SuggestKind)) {
    return NextResponse.json({ error: "kind must be employer, attorney, occupation or all" }, { status: 400 });
  }
  if (q.length < SUGGEST_MIN_LENGTH || q.length > SUGGEST_MAX_LENGTH) {
    return NextResponse.json(
      { error: `q must be ${SUGGEST_MIN_LENGTH} to ${SUGGEST_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }
  try {
    let suggestions: NameSuggestion[];
    if (kind === "all") {
      const per = await Promise.all(SUGGEST_KINDS.map((k) => suggestNames(k, q, ALL_PER_KIND)));
      suggestions = per.flat().sort((a, b) => b.score - a.score || b.cases - a.cases).slice(0, ALL_LIMIT);
    } else {
      suggestions = await suggestNames(kind as SuggestKind, q);
    }
    return NextResponse.json(
      { query: q, kind, suggestions },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } },
    );
  } catch (e) {
    console.error("[suggest] failed", e);
    return NextResponse.json({ error: "Name suggestions couldn't be read just now. Try again in a minute." }, { status: 503 });
  }
}
