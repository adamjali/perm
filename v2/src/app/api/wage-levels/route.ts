import { NextResponse } from "next/server";

import { AREA_RE, parseWageRates, SOC_RE, WAGE_SEARCH_PAGE, WAGE_SEARCH_URL, wageSearchBody } from "@/lib/wageLevels";

/**
 * GET /api/wage-levels?soc=15-1252&area=31080&year=2026
 *
 * One DOL wage-search request, validated, capped and cached. DOL answers in
 * about a quarter of a second; the CDN keeps each answer a day, so a popular
 * occupation costs DOL one request a day per area. Inputs are two short
 * patterns and a four-digit year, checked before anything is fetched. The
 * site's firewall rate-limits /api/* per address on top of this.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const soc = (url.searchParams.get("soc") ?? "").trim();
  const area = (url.searchParams.get("area") ?? "").trim();
  const yearRaw = (url.searchParams.get("year") ?? "").trim();
  const year = Number(yearRaw);
  if (!SOC_RE.test(soc) || !AREA_RE.test(area) || !/^\d{4}$/.test(yearRaw) || year < 2020 || year > 2035) {
    return NextResponse.json({ ok: false, message: "soc, area and year are required: an SOC code, a BLS area code and a series year." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(WAGE_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: "https://flag.dol.gov", Referer: WAGE_SEARCH_PAGE },
      body: JSON.stringify(wageSearchBody(soc, Number(area), year)),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: `DOL answered ${res.status}.` }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const levels = parseWageRates(await res.json());
    if (!levels) {
      return NextResponse.json(
        { ok: true, soc: soc.slice(0, 7), area: Number(area), seriesYear: year, levels: null, source: WAGE_SEARCH_PAGE, message: "DOL publishes no wage for that occupation in that area for that series." },
        { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
      );
    }
    return NextResponse.json(
      { ok: true, soc: soc.slice(0, 7), area: Number(area), seriesYear: year, levels, source: WAGE_SEARCH_PAGE },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({ ok: false, message: timedOut ? "DOL did not answer in time." : "DOL could not be reached." }, { status: 504, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
