import { NextResponse } from "next/server";

import { STAGE_FEED_MAX } from "./limits";

import { stageFromSlug, stageMeta } from "@/components/rfi/stageMeta";
import { LISTABLE_STAGE_MAX, listStageCases } from "@/lib/turso/rfi";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

/**
 * Every case at one review stage, as JSON or CSV.
 *
 * This is the data half of the stage browser: the static stage page seeds the
 * table with the oldest rows and the browser asks here for the whole cohort
 * when someone searches, sorts or pages past the seed. The stage comes from
 * the same registry the pages are built from, so a slug that has no page
 * cannot have a feed, and analyst review (over the listable ceiling, split by
 * filing month on `/perm-queue`) answers 400 with the reason rather than a
 * 90,000-row body.
 *
 * Cost: one index-bounded read per stage per six hours at the edge, whatever
 * the traffic. The read is `case_status_stage (current_status, is_final,
 * filing_date)`, the same one the page uses, so the count here and the count
 * on the page cannot come from different populations.
 */

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };

function bad(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function csvCell(v: string | null): string {
  if (v === null || v === "") return "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const slug = (p.get("stage") ?? "").trim().toLowerCase();
  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) return bad("stage must be a stage slug");
  const status = stageFromSlug(slug);
  if (!status) return bad("unknown stage", 404);
  const format = (p.get("format") ?? "json").trim().toLowerCase();
  if (format !== "json" && format !== "csv") return bad("format must be json or csv");

  const [rows, sweep] = await Promise.all([
    listStageCases(status, STAGE_FEED_MAX, 0),
    getSweepCoverage().catch(() => null),
  ]);
  if (rows.length > LISTABLE_STAGE_MAX) {
    return bad("this stage is above the listable size; it is split by filing month on /perm-queue", 400);
  }
  const asOf = sweep?.finishedOn ?? null;
  const label = stageMeta(status).label;

  if (format === "csv") {
    const lines = [
      ["case_number", "filing_date", "employer", "job_title", "status", "as_of"].join(","),
      ...rows.map((r) =>
        [r.caseNumber, r.filingDate, r.employer, r.jobTitle, status, asOf].map((v) => csvCell(v ?? null)).join(","),
      ),
    ];
    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        ...CACHE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="perm-${slug}-${asOf ?? "cases"}.csv"`,
      },
    });
  }
  return NextResponse.json(
    { stage: slug, status, label, asOf, count: rows.length, rows },
    { headers: CACHE_HEADERS },
  );
}
