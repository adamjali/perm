import "server-only";

import { cache } from "react";

import { parseSeasonalTiming, type SeasonalTiming } from "@/lib/seasonalTiming";
import { one } from "./client";

/**
 * perm_docs['seasonal_timing'], written by scripts/build_seasonal_timing.py
 * after every H-2A, H-2B or CW-1 load. Null when it is missing or unreadable,
 * and the case card then shows no timing line rather than a guess.
 */
export const getSeasonalTiming = cache(async (): Promise<SeasonalTiming | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'seasonal_timing'").catch(() => null);
  return r ? parseSeasonalTiming(String(r.json)) : null;
});
