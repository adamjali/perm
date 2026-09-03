import { NextResponse } from "next/server";

import { getChangeFeed } from "@/lib/turso/changes";

/**
 * One day of DOL adjudication events, by date.
 *
 * WHY AN API ROUTE RATHER THAN A PAGE PARAM. Reading `searchParams` in
 * `/perm-decision-activity` would make that page dynamic, and a dynamic page
 * on this site pays its database cost once per REQUEST instead of once per
 * regeneration. That is what took Turso to 11.58 billion rows read in two days
 * in August. The page stays static and the picker fetches this instead, which
 * is the same shape the case browsers already use.
 *
 * The read is cheap and bounded: `perm_case_events` is small next to the
 * 414,000-row case table, the day is an indexed equality, and the row cap is
 * enforced here rather than trusted from the caller.
 *
 * Reachable by strangers, so the guards are cheap and first: the date must be
 * exactly `YYYY-MM-DD` before it reaches the query, and `getChangeFeed` only
 * accepts a date it has already listed as carrying events.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_ITEMS = 100;
const MAX_ITEMS = 500;

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;

  const date = p.get("date");
  if (date && !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const raw = Number(p.get("limit") ?? DEFAULT_ITEMS);
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(1, Math.floor(raw)), MAX_ITEMS)
    : DEFAULT_ITEMS;

  const feed = await getChangeFeed(date, limit);
  if (!feed) {
    // No events at all is a real state, not an error: the sweep records
    // transitions only from the day it started.
    return NextResponse.json({ feed: null }, { headers: { "Cache-Control": "public, s-maxage=600" } });
  }

  return NextResponse.json(
    { feed },
    {
      headers: {
        // A past day cannot gain events; today's can. Cache the settled ones
        // hard and today's briefly.
        "Cache-Control":
          feed.date === new Date().toISOString().slice(0, 10)
            ? "public, s-maxage=600, stale-while-revalidate=3600"
            : "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    },
  );
}
