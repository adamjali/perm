import "server-only";

import { cache } from "react";

import type { ActivityDay } from "@/lib/activityStats";

import { rows } from "./client";
import { OBSERVED_SOURCE } from "./decisionPace";

/**
 * The newest days of PERM decisions our own sweep observed, oldest first.
 *
 * `sweep-observed` only: it is the series dated by when DOL's case status
 * changed under our daily check, and the only one that reaches yesterday.
 * DOL's quarterly files end at the last quarter, so a "yesterday" read from
 * them is months old. One index range on (date, source), at most `limit` rows.
 */
export const getObservedDays = cache(async (limit = 56): Promise<ActivityDay[]> => {
  const r = await rows<Record<string, unknown>>(
    `SELECT date, total, certified, denied, withdrawn
       FROM daily_decisions WHERE source = ? ORDER BY date DESC LIMIT ?`,
    [OBSERVED_SOURCE, limit],
  );
  return r
    .map((x) => ({
      date: String(x.date),
      total: Number(x.total ?? 0),
      certified: Number(x.certified ?? 0),
      denied: Number(x.denied ?? 0),
      withdrawn: Number(x.withdrawn ?? 0),
    }))
    .reverse();
});
