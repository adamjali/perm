import { NextResponse } from "next/server";

import {
  getLcaWageByState,
  getLcaWageHistogram,
  getLcaWageStats,
  type LcaWageFilters,
  type LcaWageStatusFilter,
} from "@/lib/turso/lcaWages";
import { binWidth, clampBins, MIN_FOR_MEDIAN } from "@/lib/wageStats";

/**
 * The H-1B salary explorer's data route: the sibling of /api/perm-wages over
 * `lca_cases`. Same shape, same floors, same guards. It never receives a
 * reader's own salary: "compare my offer" fetches the distribution for a
 * selection and places the offer in it in the browser.
 */

export const revalidate = 0;

// The files behind these figures change four times a year, so a response is
// cached at the edge for a day and served stale for a week while it refreshes.
// Turso bills rows read: the software-developer group alone is ~120,000 rows
// per uncached call, and a reader dragging a filter fires several.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

const MAX_CODE = 16;
const MAX_STATE = 4;
const MAX_YEAR = 8;
const STATUSES: readonly LcaWageStatusFilter[] = ["certified", "denied", "withdrawn", "all"];

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const socCode = p.get("soc");
  const state = p.get("state");
  const fiscalYear = p.get("fy");
  const statusRaw = p.get("status") ?? "certified";
  // Cheap shape checks first, before anything touches the database.
  if (socCode !== null && socCode.length > MAX_CODE) return bad("soc too long");
  if (state !== null && state.length > MAX_STATE) return bad("state too long");
  if (fiscalYear !== null && fiscalYear.length > MAX_YEAR) return bad("fy too long");
  if (statusRaw.length > MAX_CODE) return bad("status too long");
  if (!(STATUSES as readonly string[]).includes(statusRaw)) {
    return bad(`status must be one of ${STATUSES.join(", ")}`);
  }
  if (fiscalYear !== null && fiscalYear !== "" && !/^\d{4}$/.test(fiscalYear)) return bad("fy must be a year");
  const filters: LcaWageFilters = {
    socCode: socCode || null,
    state: state || null,
    fiscalYear: fiscalYear || null,
    status: statusRaw as LcaWageStatusFilter,
  };
  const stats = await getLcaWageStats(filters);
  if (stats.n < MIN_FOR_MEDIAN) {
    return NextResponse.json({ stats, bins: [], binWidth: 0, below: 0, above: 0, byState: [] }, { headers: CACHE_HEADERS });
  }
  const width = binWidth(stats.p5, stats.p95);
  const [raw, byState] = await Promise.all([
    getLcaWageHistogram(filters, width),
    filters.state ? Promise.resolve([]) : getLcaWageByState(filters, MIN_FOR_MEDIAN),
  ]);
  const lo = stats.p5 !== null ? Math.floor(stats.p5 / width) * width : 0;
  const hi = stats.p95 !== null ? Math.floor(stats.p95 / width) * width : 0;
  const { bins, below, above } = clampBins(raw, lo, hi);
  return NextResponse.json({ stats, bins, binWidth: width, below, above, byState }, { headers: CACHE_HEADERS });
}
