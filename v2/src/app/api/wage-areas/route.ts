import { NextResponse } from "next/server";

import { AREA_OPTIONS_URL, parseAreaOptions } from "@/lib/wageLevels";

/**
 * GET /api/wage-areas?state=CALIFORNIA&year=2026
 *
 * The BLS areas DOL's wage search offers for one state and series, read from
 * the same endpoint the search page calls and cached a week: the list changes
 * once a year, when the series does.
 */

export const dynamic = "force-dynamic";

const STATE_RE = /^[A-Z][A-Z ]{3,30}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = (url.searchParams.get("state") ?? "").trim().toUpperCase();
  const yearRaw = (url.searchParams.get("year") ?? "").trim();
  const year = Number(yearRaw);
  if (!STATE_RE.test(state) || !/^\d{4}$/.test(yearRaw) || year < 2020 || year > 2035) {
    return NextResponse.json({ ok: false, message: "state (as DOL spells it, e.g. CALIFORNIA) and a series year are required." }, { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${AREA_OPTIONS_URL}?state=${encodeURIComponent(state)}&year=${year}`, { signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ ok: false, message: `DOL answered ${res.status}.` }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const areas = parseAreaOptions(await res.json());
    return NextResponse.json({ ok: true, state, seriesYear: year, areas }, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({ ok: false, message: timedOut ? "DOL did not answer in time." : "DOL could not be reached." }, { status: 504, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
