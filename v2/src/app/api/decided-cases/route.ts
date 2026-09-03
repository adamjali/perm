import { NextResponse } from "next/server";

import {
  CHANGE_PROGRAMS,
  isChangeProgram,
  type ChangeProgram,
} from "@/lib/changeProgram";
import {
  DECIDED_ROW_CAP,
  getDecidedFeed,
  isIsoDate,
  type DecidedNarrow,
} from "@/lib/turso/decidedDays";

/**
 * What DOL DECIDED in a date range, from the quarterly disclosure files.
 *
 * A SIBLING OF `/api/case-changes`, NOT AN OPTION ON IT. That route answers
 * "what did we observe change on this day", which reaches back only to
 * 2026-08-26 and carries no wage, worksite or occupation because DOL does not
 * return those on a live case. This one answers "what did DOL decide", which
 * reaches back to 2023-10-01 and carries the whole published record. They are
 * different questions with different coverage, and folding them into one route
 * with a mode flag would put two answer shapes behind one URL and one cache
 * entry.
 *
 * WHY AN API ROUTE RATHER THAN A PAGE PARAM. Reading `searchParams` in
 * `/perm-decision-activity` would make that page dynamic, and a dynamic page
 * here pays its database cost once per REQUEST instead of once per
 * regeneration. That is what took Turso to 11.58 billion rows read in two days
 * in August.
 *
 * Reachable by strangers, so the guards are cheap and ordered by cost:
 *   1. both dates must be exactly `YYYY-MM-DD` AND real calendar dates, which
 *      is a shape test plus one parse and touches no database;
 *   2. they must sit inside a static window, so a crawler cannot spray
 *      arbitrary dates and mint a cache entry plus an indexed miss for each;
 *   3. every filter is length-capped BEFORE it reaches SQL;
 *   4. the row cap is enforced here rather than trusted from the caller, and
 *      `getDecidedFeed` refuses a wide range whose filter cannot ride an index.
 *
 * A valid range holding nothing answers 200 with an empty list. "We hold
 * nothing for that day" is a real answer and the page says it in words; a 404
 * would read as a broken URL.
 */

/**
 * The oldest date this route will consider.
 *
 * Deliberately older than the data (the published record starts 2023-10-01) so
 * the page can say "we hold nothing back that far" rather than the route
 * refusing with a 400 that looks like a bug. It exists to bound the cache key
 * space, not to describe coverage.
 */
const FLOOR = "2015-01-01";

/** Longest a single filter value may be, before it reaches any query. */
const MAX_FILTER_LEN = 120;

function clean(v: string | null): string | undefined {
  if (v === null) return undefined;
  const s = v.trim();
  if (s === "" || s.length > MAX_FILTER_LEN) return undefined;
  return s;
}

function money(v: string | null): number | undefined {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  // Reject NaN, Infinity and negatives rather than passing them to SQL, where
  // a NaN silently becomes a comparison that matches nothing.
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;

  const from = p.get("from");
  const to = p.get("to") ?? from;
  if (!from || !to || !isIsoDate(from) || !isIsoDate(to)) {
    return NextResponse.json(
      { error: "from and to must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (to < from) {
    return NextResponse.json({ error: "to is before from" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (from < FLOOR || to > today) {
    return NextResponse.json(
      { error: `dates must be between ${FLOOR} and ${today}` },
      { status: 400 },
    );
  }

  const asked = p.getAll("program").filter(isChangeProgram);
  const programs: readonly ChangeProgram[] =
    asked.length > 0 ? asked : CHANGE_PROGRAMS;

  const narrow: DecidedNarrow = {
    employer: clean(p.get("employer")),
    state: clean(p.get("state")),
    socCode: clean(p.get("soc")),
    attorney: clean(p.get("firm")),
    status: clean(p.get("status")),
    minWage: money(p.get("minWage")),
    maxWage: money(p.get("maxWage")),
  };

  const raw = Number(p.get("limit") ?? DECIDED_ROW_CAP);
  const cap = Number.isFinite(raw)
    ? Math.min(Math.max(1, Math.floor(raw)), DECIDED_ROW_CAP)
    : DECIDED_ROW_CAP;

  const feed = await getDecidedFeed({
    range: { from, to },
    programs,
    narrow,
    cap,
  });

  // A REFUSAL IS 400, NOT 200 WITH AN EMPTY LIST. `refused` means the request
  // was too expensive to serve, which is a different thing from a range that
  // legitimately holds nothing, and a monitor that cannot tell them apart
  // reads every refusal as "no data".
  if (feed.refused) {
    return NextResponse.json({ error: feed.refused }, { status: 400 });
  }

  return NextResponse.json(
    { feed },
    {
      headers: {
        // The published files are immutable until the next quarterly load, so
        // a settled range can be cached hard. A range touching the last 30
        // days is kept short because a new file can extend it.
        "Cache-Control":
          to < new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
            ? "public, s-maxage=86400, stale-while-revalidate=604800"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
