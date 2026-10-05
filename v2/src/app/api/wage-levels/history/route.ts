import { NextResponse } from "next/server";

import { AREA_RE, SOC_RE } from "@/lib/wageLevels";
import { marketPayIn, wageLevelHistory } from "@/lib/turso/reference";

/**
 * GET /api/wage-levels/history?soc=15-1252&area=41940
 *
 * Every wage year DOL's tables hold for one occupation in one area, both the
 * all-industries table and the higher-education (ACWIA) one, plus BLS's market
 * pay for the same job and area. Read from our copy of DOL's published files
 * (scripts/ingest_oflc_wages.py), not from DOL live, so it answers for years
 * DOL's wage search no longer serves. A day at the edge: the tables change
 * once a year.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const soc = (url.searchParams.get("soc") ?? "").trim();
  const area = (url.searchParams.get("area") ?? "").trim();
  if (!SOC_RE.test(soc) || !AREA_RE.test(area)) {
    return NextResponse.json({ ok: false, message: "soc and area are required: an SOC code and a BLS area code." }, { status: 400 });
  }
  try {
    const [alc, edc, market] = await Promise.all([
      wageLevelHistory(soc, area, "alc"),
      wageLevelHistory(soc, area, "edc"),
      marketPayIn(soc, [area]),
    ]);
    return NextResponse.json(
      { ok: true, soc: soc.slice(0, 7), area, alc, edc, market: market[0] ?? null },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ ok: false, message: "The stored wage tables couldn't be read just now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
