import "server-only";

import { cache } from "react";

import { parseStragglerRates, type StragglerRates } from "@/lib/stragglerRates";
import { one } from "./client";

/**
 * How fast DOL is deciding the in-line cases its queue has already passed,
 * from `perm_docs['straggler_rates']` (scripts/build_straggler_rates.py, after
 * each nightly full sweep). Null when the doc is missing, stale or too thin to
 * stand on: the estimate then shows no date for such a case, never a guess.
 */
export const getStragglerRates = cache(async (): Promise<StragglerRates | null> => {
  const r = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'straggler_rates'",
  ).catch(() => null);
  return r ? parseStragglerRates(r.json, new Date().toISOString().slice(0, 10)) : null;
});
