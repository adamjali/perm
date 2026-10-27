import "server-only";

import { cache } from "react";

import { parseDayQueue, type DayCounts } from "@/lib/queueAhead";
import { one } from "./client";

/**
 * The PERM line by filing day (perm_docs['perm_day_queue'], written by the
 * sweep beside the census). Null when it's missing, stale or can't be read,
 * and the count then spreads the filing month evenly, as it did before the
 * doc existed; the failure is logged so it isn't silent.
 */
export const getPermDayQueue = cache(async (): Promise<DayCounts | null> => {
  const r = await one<{ json: string; computed_at: number }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = 'perm_day_queue'",
  ).catch((e: unknown) => {
    console.warn("[permDayQueue] read failed; spreading the month evenly", e);
    return null;
  });
  if (!r) return null;
  return parseDayQueue(String(r.json), Number(r.computed_at), Date.now());
});
