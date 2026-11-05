import { NextResponse } from "next/server";

import { getFilingsByDay } from "@/lib/db/filingsByDay";
import { FILING_PROGRAMS, RANGE_MAX_DAYS, type FilingDay, type FilingProgram } from "@/lib/filingsByDay";
import { FILINGS_FROM } from "@/lib/filingDay";
import { ISO_DATE_REGEX } from "@convex/lib/dateValidation";

/**
 * GET /api/filings-by-day?from=YYYY-MM-DD&to=YYYY-MM-DD: every program's filings by day for a
 * period, from perm_docs['filings_by_day'] (scripts/build_filings_by_day.py). /filings-by-day
 * carries the last year; a reader who picks an older period asks here.
 *
 * A malformed day, a reversed period or one longer than RANGE_MAX_DAYS answers 400, a document
 * not written yet 404, a failed read 503: never a period with no filings. The document moves
 * with each sweep, so an answer may be kept an hour.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!ISO_DATE_REGEX.test(from) || !ISO_DATE_REGEX.test(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  const span = (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000 + 1;
  if (!(span >= 1) || span > RANGE_MAX_DAYS) {
    return NextResponse.json({ error: `a period runs from its first day to its last, ${RANGE_MAX_DAYS} days at most` }, { status: 400 });
  }
  try {
    const doc = await getFilingsByDay();
    if (!doc) return NextResponse.json({ error: "the daily counts haven't been written yet" }, { status: 404 });
    const lo = from < FILINGS_FROM ? FILINGS_FROM : from;
    const programs = {} as Record<FilingProgram, FilingDay[]>;
    for (const p of FILING_PROGRAMS) programs[p] = doc.programs[p].days.filter((d) => d.day >= lo && d.day <= to);
    return NextResponse.json(
      { asOf: doc.asOf, computedAt: doc.computedAt, from: lo, to, programs },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
    );
  } catch (e) {
    console.error("[filings-by-day] read failed", e);
    return NextResponse.json({ error: "the daily counts couldn't be read; try again in a minute" }, { status: 503 });
  }
}
