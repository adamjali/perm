import { NextResponse } from "next/server";

import {
  PROGRAMS,
  UNIFIED_MAX,
  isProgram,
  unifiedSearch,
  type Program,
} from "@/lib/turso/unifiedSearch";

/**
 * One search across PERM, prevailing wage requests and H-1B LCAs.
 *
 * A ROUTE, NOT A PAGE PARAM. Reading `searchParams` in the page would make it
 * dynamic, and every visit would then be a server render against Turso. That
 * is the cost that read 11.6 billion rows in two days in August. The page
 * stays static and the search is one JSON request.
 *
 * THE EMPLOYER IS REQUIRED AND THAT IS A DATA FACT, NOT LAZINESS. Every read
 * underneath is an indexed range over the employer slug. A title-only or
 * state-only search has no index to ride and would scan the whole corpus per
 * request. The page says so in words rather than offering a control that
 * quietly costs a fortune, and the other fields narrow what the employer
 * returns.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// Ahead of any comparison work: `v.string()`-scale input reaches a route
// handler, and a length cap is the cheap guard that belongs before anything
// that walks the string.
const MAX_TEXT = 120;
const MIN_TEXT = 2;

export const revalidate = 0;

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;

  const text = (p.get("text") ?? "").trim();
  if (text.length < MIN_TEXT || text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `text must be ${MIN_TEXT}-${MAX_TEXT} characters` },
      { status: 400 },
    );
  }

  const title = (p.get("title") ?? "").trim().slice(0, 80);
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  if ((from && !MONTH_RE.test(from)) || (to && !MONTH_RE.test(to))) {
    return NextResponse.json({ error: "from/to must be YYYY-MM" }, { status: 400 });
  }

  // An unknown program name narrows to nothing rather than erroring: the
  // parameter is a filter, and a typo that returns "no results for that
  // filter" is easier to understand than a 400 on a search that half worked.
  const asked = (p.get("programs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const programs: Program[] = asked.length ? asked.filter(isProgram) : [...PROGRAMS];
  if (asked.length && programs.length === 0) {
    return NextResponse.json({ rows: [], counts: { perm: 0, pwd: 0, lca: 0 }, truncated: false, capped: false });
  }

  const rawLimit = Number(p.get("limit") ?? UNIFIED_MAX);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), UNIFIED_MAX)
    : UNIFIED_MAX;

  try {
    const result = await unifiedSearch({
      text,
      ...(title ? { title } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      programs,
      limit,
    });
    return NextResponse.json(result, {
      // The corpus changes once a night. A short shared cache absorbs the
      // repeat of an identical search without letting a day-old answer stand.
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch (err) {
    // Named, so a failure here is distinguishable in the logs from a miss.
    console.error("[caseSearch] failed", err);
    return NextResponse.json({ error: "search unavailable" }, { status: 503 });
  }
}
