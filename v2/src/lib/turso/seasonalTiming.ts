import "server-only";

import { cache } from "react";

import { parseSeasonalCheck, parseSeasonalTiming, type SeasonalCheck, type SeasonalTiming } from "@/lib/seasonalTiming";
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

/**
 * perm_docs['seasonal_backtest'], written weekly by scripts/backtest_seasonal.py:
 * how the method each visa's panel uses did against later decisions. Null when
 * missing, and the panel then prints no "tested on" line.
 */
export const getSeasonalCheck = cache(async (): Promise<SeasonalCheck | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'seasonal_backtest'").catch(() => null);
  return r ? parseSeasonalCheck(String(r.json)) : null;
});
