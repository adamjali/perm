import { NextResponse } from "next/server";

import { categoriesIn } from "@/lib/db/bulletin";
import { getFamilyBulletinSeries, getVisaBulletinSeries } from "@/lib/db/publicData";
import type { CountryKey } from "@/lib/perm";

import { LINE_COUNTRIES, lineOf, type LineChartSet } from "@/lib/bulletinLineHistory";

/**
 * GET /api/bulletin-line?set=employment&category=EB2&country=india
 *
 * One visa bulletin line, every month the archive holds, both charts, as State printed each cell. The child age-out
 * calculator reads it in the browser. A category the archive doesn't hold answers 404 with the ones it does; a failed
 * read answers 503 and says so, never an empty line.
 */

export const dynamic = "force-dynamic";

const CATEGORY_RE = /^[A-Z0-9]{2,6}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const set = (url.searchParams.get("set") ?? "employment") as LineChartSet;
  const category = (url.searchParams.get("category") ?? "").trim().toUpperCase();
  const country = (url.searchParams.get("country") ?? "").trim().toLowerCase() as CountryKey;
  if ((set !== "employment" && set !== "family") || !CATEGORY_RE.test(category) || !LINE_COUNTRIES.includes(country)) {
    return NextResponse.json(
      { ok: false, message: "set (employment or family), a category such as EB2, and a country (worldwide, china, india, mexico or philippines) are required." },
      { status: 400 },
    );
  }
  let series;
  try {
    series = set === "family" ? await getFamilyBulletinSeries() : await getVisaBulletinSeries();
  } catch {
    return NextResponse.json({ ok: false, message: "The bulletin archive couldn't be read just now. Try again in a minute." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const held = categoriesIn(series);
  if (!held.includes(category)) {
    return NextResponse.json({ ok: false, message: `The archive holds no ${category} line. It holds ${held.join(", ")}.` }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, line: lineOf(set, category, country, series) },
    // A new bulletin lands once a month; an hour behind it is the most a reader sees.
    { headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } },
  );
}
