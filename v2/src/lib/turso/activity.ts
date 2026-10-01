/**
 * Reads for the decision-activity surface, over `daily_decisions`.
 *
 * TWO SOURCES, BOTH OURS (measured Oct 1 2026):
 *
 *   dol-disclosure  947 days, 2023-10-01 to 2026-06-30, 373,939 decisions.
 *                   Derived from our own case corpus by decision date.
 *   sweep-observed  2026-08-30 onward, daily. Our own sweep's record of
 *                   when each case's status changed (perm_case_events).
 *
 * Two others were deleted on 2026-09-18 because neither was ours: `rival-b`
 * (a rival's series, backfilled once) and `flag-live` (labelled as our scan,
 * in fact mirrored from a rival). This reader kept asking for `flag-live`
 * until Oct 1 2026, so the page's "last 28 days" quietly fell back to the
 * disclosure series, which ends in June. Reading by source by name is what
 * keeps a deleted or foreign source out; `getDailyDecisions` in publicData.ts
 * defends the same boundary.
 *
 * THE TWO SERIES ARE NOT SPLICED. Between the end of the quarterly file and
 * the first sweep-observed day there is no record at all. Joining them into
 * one line would draw a slope across weeks nobody measured, so they are
 * returned as separate series and the page draws them apart. Derivations are
 * in src/lib/activityStats.ts, outside the server-only boundary.
 */
import "server-only";

import type { ActivityDay } from "@/lib/activityStats";

import { rows } from "./client";

/** Our two first-party sources, oldest first. Never the rival's. */
export const FIRST_PARTY_SOURCES = ["dol-disclosure", "sweep-observed"] as const;
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
