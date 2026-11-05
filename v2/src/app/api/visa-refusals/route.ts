import { NextResponse } from "next/server";

import { refusalSummary, refusalsYear } from "@/lib/db/visaRefusals";
import { isFiscalYear } from "@/lib/visaRefusals";

/**
 * GET /api/visa-refusals?fy=2019
 *
 * Every ground of one fiscal year from State's table of visa refusals, in State's order, with
 * State's totals for the year. /visa-refusals renders its newest year and asks here when a reader
 * picks another. A year not held answers 404 with the years that are; a failed read answers 503
 * and says so, never an empty year.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fy = isFiscalYear(new URL(req.url).searchParams.get("fy"));
  if (fy === null) {
    return NextResponse.json({ ok: false, message: "A fiscal year is required, such as fy=2024." }, { status: 400 });
  }
  let summary;
  let grounds;
  try {
    summary = await refusalSummary();
    grounds = summary?.years.includes(fy) ? await refusalsYear(fy) : [];
  } catch {
    return NextResponse.json(
      { ok: false, message: "State's refusal tables couldn't be read just now. Try again in a minute." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!summary?.years.includes(fy) || !grounds.length) {
    const held = summary?.years ?? [];
    return NextResponse.json(
      { ok: false, message: held.length ? `No table for FY${fy}. This site holds FY${held[0]} to FY${held.at(-1)}.` : "No year's table is loaded yet." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { ok: true, fy, grounds, totals: summary.totals[String(fy)] ?? null, knownGaps: summary.knownGaps[String(fy)] ?? [] },
    // A year's table never changes once State posts it; a day behind a correction is the most a reader sees.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
