import { NextResponse } from "next/server";

import { CENSUS_DAYS_FROM } from "@/lib/backlogMonths";
import { getCensusOn } from "@/lib/db/backlog";
import { analystPositionOf, getProcessingTimesOn } from "@/lib/db/processingTimes";
import { ISO_DATE_REGEX } from "@convex/lib/dateValidation";
import { easternDay } from "@convex/lib/time";

/**
 * GET /api/queue-day?day=YYYY-MM-DD: the PERM queue at the end of one past DOL
 * day (perm_census_days), folded by filing month as the queue page folds today,
 * with DOL's analyst-review position as DOL had published it by then.
 *
 * A past day changes only when the walk finds a case filed on or before it, so
 * Cloudflare keeps an answer a day. A day outside the series (before its first
 * day, or today and later) answers 404 without a read, so an invented date
 * can't mint a cache entry and a database read; a day the table doesn't hold
 * answers 404, a malformed one 400, a failed read 503: never an empty queue.
 */
export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") ?? "";
  if (!ISO_DATE_REGEX.test(day)) return NextResponse.json({ error: "day must be YYYY-MM-DD" }, { status: 400 });
  if (day < CENSUS_DAYS_FROM || day >= easternDay()) {
    return NextResponse.json({ error: `the queue is kept from ${CENSUS_DAYS_FROM} to yesterday` }, { status: 404 });
  }
  try {
    const [months, snapshot] = await Promise.all([getCensusOn(day), getProcessingTimesOn(day)]);
    if (months.length === 0) return NextResponse.json({ error: "no queue recorded for that day" }, { status: 404 });
    return NextResponse.json(
      { day, months, dol: snapshot ? analystPositionOf(snapshot) : null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    console.error("[queue-day] read failed", e);
    return NextResponse.json({ error: "the queue for that day couldn't be read; try again in a minute" }, { status: 503 });
  }
}
