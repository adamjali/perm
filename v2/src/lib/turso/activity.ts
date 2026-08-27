/**
 * Reads for the decision-activity surface, over `daily_decisions`.
 *
 * THREE SOURCES LIVE IN THAT TABLE AND ONLY TWO ARE OURS.
 *
 *   dol-disclosure  947 days, 2023-10-01 to 2026-06-30, 373,939 decisions.
 *                   Derived from our own case corpus by decision date.
 *   flag-live        14 days, 2026-08-13 onward, 9,457 decisions.
 *                   From the per-case scan of flag.dol.gov.
 *   permtrack        88 days, 2025-12-31 to 2026-03-31. The RIVAL'S series,
 *                   backfilled once for comparison.
 *
 * The permtrack rows OVERLAP ours on all 88 of their dates, so the table holds
 * 1,049 rows across 961 distinct dates. A query that reads the whole table and
 * sums by date double-counts a quarter of FY2026. Nothing here reads that
 * source; `getDailyDecisions` in publicData.ts defends the same boundary with
 * a source argument that defaults to ours.
 *
 * THE TWO SERIES ARE NOT SPLICED. Between 2026-06-30 and 2026-08-13 there are
 * 43 days with no record at all, because the quarterly file stops at the
 * quarter and the live scan had not started. Joining them into one line would
 * draw a slope across six weeks nobody measured, so they are returned as
 * separate series and the page draws them apart. Derivations are in
 * src/lib/activityStats.ts, outside the server-only boundary.
 */
import "server-only";

import type { ActivityDay } from "@/lib/activityStats";

import { rows } from "./client";

/** Our two first-party sources, oldest first. Never the rival's. */
export const FIRST_PARTY_SOURCES = ["dol-disclosure", "flag-live"] as const;
export type ActivitySource = (typeof FIRST_PARTY_SOURCES)[number];

export interface ActivitySeries {
  source: ActivitySource;
  days: ActivityDay[];
}

/** Every first-party day, grouped by source, each ascending by date. */
export async function getActivitySeries(): Promise<ActivitySeries[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT source, date, total, certified, denied, withdrawn
       FROM daily_decisions WHERE source IN (?, ?) ORDER BY date`,
    [...FIRST_PARTY_SOURCES],
  );
  return FIRST_PARTY_SOURCES.map((source) => ({
    source,
    days: r
      .filter((x) => String(x.source) === source)
      .map((x) => ({
        date: String(x.date),
        total: Number(x.total ?? 0),
        certified: Number(x.certified ?? 0),
        denied: Number(x.denied ?? 0),
        withdrawn: Number(x.withdrawn ?? 0),
      })),
  })).filter((s) => s.days.length > 0);
}
