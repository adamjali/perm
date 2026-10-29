import { NextResponse } from "next/server";

import { SOC_CODE_RE, socGroup } from "@/lib/socCode";
import { wageLevelsInState } from "@/lib/db/reference";

/**
 * GET /api/wage-levels/areas?soc=15-1252&state=TX
 *
 * One occupation's four levels in every DOL wage area of a state, the newest wage year, all industries, for the
 * wage tool's "where a wage reaches each level". Read from our copy of DOL's published tables
 * (scripts/ingest_oflc_wages.py); a day at the edge, since the tables change once a year.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const soc = (url.searchParams.get("soc") ?? "").trim();
  const state = (url.searchParams.get("state") ?? "").trim().toUpperCase();
  if (!SOC_CODE_RE.test(soc) || !/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json({ ok: false, message: "soc and state are required: an SOC code and a two-letter state." }, { status: 400 });
  }
  try {
    const got = await wageLevelsInState(soc, state);
    return NextResponse.json(
      { ok: true, soc: socGroup(soc), state, wageYear: got?.wageYear ?? null, areas: got?.areas ?? [] },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ ok: false, message: "The stored wage tables couldn't be read just now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
