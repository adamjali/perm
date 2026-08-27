import { NextResponse } from "next/server";

import {
  getWageByState,
  getWageHistogram,
  getWageStats,
  type WageFilters,
  type WageStatusFilter,
} from "@/lib/turso/publicData";
import { binWidth, clampBins, MIN_FOR_MEDIAN } from "@/lib/wageStats";

/**
 * The salary explorer's data, for a page with no ConvexProvider.
 *
 * Same shape and the same reasons as /api/perm-cases: the corpus lives in
 * Turso, whose credential must never reach a client bundle, so the browser
 * talks to this route and the credential stays on the server.
 *
 * PUBLIC AND UNAUTHENTICATED, so the guards are ordered by cost. Every length
 * cap runs BEFORE anything that parses or queries: a validator reachable from
 * an unauthenticated endpoint that accepts a large string is a
 * compute-exhaustion primitive until the cheap guard runs first.
 *
 * GET only, and it reads. Nothing here mutates, so a mail gateway or a link
 * prefetcher cannot cause anything.
 */
export const revalidate = 0;

// Nothing DOL prints is anywhere near these. They exist so a caller cannot
// hand us a megabyte and make us do work proportional to it.
const MAX_CODE = 16;
const MAX_STATE = 4;
const MAX_YEAR = 8;

const STATUSES: readonly WageStatusFilter[] = ["certified", "denied", "withdrawn", "all"];

function bad(message: string) {
  // 400, distinctly. Folding every rejection into one status makes a typo and
  // a hostile input indistinguishable in monitoring.
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;

  const socCode = p.get("soc");
  const state = p.get("state");
  const fiscalYear = p.get("fy");
  const statusRaw = p.get("status") ?? "certified";

  if (socCode !== null && socCode.length > MAX_CODE) return bad("soc too long");
  if (state !== null && state.length > MAX_STATE) return bad("state too long");
  if (fiscalYear !== null && fiscalYear.length > MAX_YEAR) return bad("fy too long");
  if (statusRaw.length > MAX_CODE) return bad("status too long");
  if (!(STATUSES as readonly string[]).includes(statusRaw)) {
    return bad(`status must be one of ${STATUSES.join(", ")}`);
  }

  const filters: WageFilters = {
    socCode: socCode || null,
    state: state || null,
    fiscalYear: fiscalYear || null,
    status: statusRaw as WageStatusFilter,
  };

  const stats = await getWageStats(filters);

  // Below the floor there is nothing to draw and nothing to break down, and
  // the histogram query would still cost a full scan of the filtered set.
  if (stats.n < MIN_FOR_MEDIAN) {
    return NextResponse.json({ stats, bins: [], binWidth: 0, below: 0, above: 0, byState: [] });
  }

  // Width comes from the SELECTED subset's own middle. A ladder that suits the
  // whole corpus puts every software developer in one bar.
  const width = binWidth(stats.p5, stats.p95);
  const [raw, byState] = await Promise.all([
    getWageHistogram(filters, width),
    // A per-state breakdown of one state is a table with one row.
    filters.state ? Promise.resolve([]) : getWageByState(filters, MIN_FOR_MEDIAN),
  ]);

  // Clamp to the reportable middle, folding the tails into counts rather than
  // dropping them, so the parts still add up to n.
  const lo = stats.p5 !== null ? Math.floor(stats.p5 / width) * width : 0;
  const hi = stats.p95 !== null ? Math.floor(stats.p95 / width) * width : 0;
  const { bins, below, above } = clampBins(raw, lo, hi);

  return NextResponse.json({ stats, bins, binWidth: width, below, above, byState });
}
