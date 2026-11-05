import { NextResponse } from "next/server";

import { getFiledOnProgram } from "@/lib/db/filingDay";
import { FILING_PROGRAMS, type FilingProgram } from "@/lib/filingsByDay";
import { FILINGS_FROM } from "@/lib/filingDay";
import { ISO_DATE_REGEX } from "@convex/lib/dateValidation";
import { easternDay } from "@convex/lib/time";

/**
 * GET /api/filed-on?day=YYYY-MM-DD&program=perm|pwd|lca|seasonal: one program's filings for
 * one day, DOL's live record and its published files together (src/lib/db/filingDay.ts). The
 * day page renders PERM cases and wage requests on the server and asks here for the rest when
 * a reader opens them.
 *
 * A day before FILINGS_FROM or after today answers 404 without a read, a malformed day or an
 * unknown program 400, a failed read 503: never an empty day. Statuses move with each sweep, so
 * an answer may be kept an hour.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const day = url.searchParams.get("day") ?? "";
  const program = url.searchParams.get("program") ?? "";
  if (!ISO_DATE_REGEX.test(day)) return NextResponse.json({ error: "day must be YYYY-MM-DD" }, { status: 400 });
  if (!(FILING_PROGRAMS as readonly string[]).includes(program)) {
    return NextResponse.json({ error: `program must be one of ${FILING_PROGRAMS.join(", ")}` }, { status: 400 });
  }
  if (day < FILINGS_FROM || day > easternDay()) {
    return NextResponse.json({ error: `filings are listed from ${FILINGS_FROM} to today` }, { status: 404 });
  }
  try {
    const { cases, capped } = await getFiledOnProgram(day, program as FilingProgram);
    // A day of LCAs is 1,500 rows, most with no file detail yet: an empty field is left out, not
    // spelled "null" (407 KB became about a third less on Nov 5 2026). The list reads a missing field as none.
    const body = JSON.stringify({ day, program, cases, capped }, (_k, v) => (v === null ? undefined : v));
    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" },
    });
  } catch (e) {
    console.error("[filed-on] read failed", e);
    return NextResponse.json({ error: "that day's filings couldn't be read; try again in a minute" }, { status: 503 });
  }
}
