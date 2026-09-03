import { NextResponse } from "next/server";

import { DAY_ROW_CAP, getChangeDay } from "@/lib/turso/changes";

/**
 * One day of FLAG adjudication events, by date. PERM, prevailing wage and LCA.
 *
 * WHY AN API ROUTE RATHER THAN A PAGE PARAM. Reading `searchParams` in
 * `/perm-decision-activity` would make that page dynamic, and a dynamic page
 * on this site pays its database cost once per REQUEST instead of once per
 * regeneration. That is what took Turso to 11.58 billion rows read in two days
 * in August. The page stays static and the browser fetches this instead, which
 * is the same shape the case browsers already use.
 *
 * WHAT THIS ROUTE DELIBERATELY DOES NOT DO: recompute the picker's day list.
 * The old version returned it with every response, and building it cost two
 * unbounded passes over a 147,000-row table on every single request. The
 * client already holds that list from the prerendered HTML, so the read here
 * is bounded to one day: a range on `changed_at` served by
 * `case_events_recent`, plus a primary-key join for the employer.
 *
 * Reachable by strangers, so the guards are cheap and ordered by cost:
 *   1. the date must be exactly `YYYY-MM-DD` (a shape test, no allocation);
 *   2. it must fall inside the window the record can possibly cover, which is
 *      arithmetic and touches no database. Without it a crawler could spray
 *      arbitrary dates and mint a cache entry plus an indexed miss for each;
 *   3. the row cap is enforced here rather than trusted from the caller.
 *
 * A day inside the window that holds nothing answers 200 with an empty day,
 * not 404: "DOL recorded nothing we saw" is a real answer, and the picker only
 * offers days that do hold something.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_ITEMS = 100;

/**
 * How far back a date may be asked about.
 *
 * The event record began 2026-08-27 and cannot be extended backwards, so this
 * is generous rather than tight - it exists to bound the key space, not to
 * describe the data. The page says what the record actually covers.
 */
const MAX_AGE_DAYS = 400;
const MS_PER_DAY = 86_400_000;

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;

  const date = p.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const asked = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(asked) || asked > today || asked < today - MAX_AGE_DAYS * MS_PER_DAY) {
    return NextResponse.json(
      { error: `date must be within the last ${MAX_AGE_DAYS} days` },
      { status: 400 },
    );
  }

  const raw = Number(p.get("limit") ?? DEFAULT_ITEMS);
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(1, Math.floor(raw)), DAY_ROW_CAP)
    : DEFAULT_ITEMS;

  const day = await getChangeDay(date, limit);

  return NextResponse.json(
    { day },
    {
      headers: {
        // A past day cannot gain events; today's can. Cache the settled ones
        // hard and today's briefly. This is what keeps the whole-day fetch
        // cheap: one Turso read per day per cache entry, not per visitor.
        "Cache-Control":
          asked === today
            ? "public, s-maxage=600, stale-while-revalidate=3600"
            : "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    },
  );
}
