import { NextResponse } from "next/server";

import { hasBasis, NATION, type H1bBasis } from "@/lib/h1bRanks";
import { getH1bSummary, getH1bView } from "@/lib/turso/h1bRanks";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * The top H-1B employers page's data route: one fiscal year, one place and one
 * ranking, at most 100 rows from `h1b_employer_ranks`. The page renders its
 * default view on the server; this answers the reader's other choices.
 */

export const revalidate = 0;

// The rows change when DOL or USCIS publishes (monthly at most), so an answer
// is cached at the edge for a day and served stale for a week while it refreshes.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const fyRaw = p.get("fy") ?? "";
  const stateRaw = (p.get("state") ?? NATION).toUpperCase();
  const byRaw = p.get("by") ?? "lca";
  // Cheap shape checks first, before anything touches the database.
  if (!/^\d{4}$/.test(fyRaw)) return bad("fy must be a fiscal year, such as 2025");
  if (stateRaw !== NATION && !(stateRaw in US_STATE_NAMES)) return bad("state must be US or a two-letter state code");
  if (byRaw !== "lca" && byRaw !== "uscis") return bad("by must be lca or uscis");
  const by = byRaw as H1bBasis;
  const summary = await getH1bSummary();
  if (!summary) return NextResponse.json({ error: "The rankings aren't built yet." }, { status: 503 });
  const year = summary.years.find((y) => y.fy === Number(fyRaw));
  if (!year) return bad(`fy must be one of ${summary.years.map((y) => y.fy).join(", ")}`);
  if (!hasBasis(year, by, stateRaw)) {
    return NextResponse.json({ fy: year.fy, state: stateRaw, by, rows: [], totals: year.places[stateRaw] ?? null }, {
      headers: CACHE_HEADERS,
    });
  }
  const view = await getH1bView(year.fy, stateRaw, by, summary);
  if (!view) return NextResponse.json({ error: "The rankings aren't built yet." }, { status: 503 });
  return NextResponse.json(view, { headers: CACHE_HEADERS });
}
