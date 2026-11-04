import "server-only";

import { cache } from "react";

import { printedRangeCheck } from "@/lib/rangeCoverage";
import { estimateChecks, type CheckRow } from "@/lib/scorecard/checks";
import { getBulletinCheck } from "./bulletinCheck";
import { getEstimatorBacktest } from "./predictions";
import { getPwdDayData } from "./pwdDayQueue";
import { getSeasonalCheck } from "./seasonalTiming";

/**
 * Every check the site runs on its own estimates, read once a render (src/lib/scorecard/checks.ts builds the rows).
 * A check that can't be read is left out, so one missing doc costs its own row and nothing else.
 */
export const getEstimateChecks = cache(async (): Promise<CheckRow[]> => {
  const [perm, pwd, bulletin, seasonal] = await Promise.all([
    getEstimatorBacktest().catch(() => null),
    getPwdDayData().catch(() => null),
    getBulletinCheck().catch(() => null),
    getSeasonalCheck().catch(() => null),
  ]);
  return estimateChecks({
    perm,
    range: printedRangeCheck(perm),
    pwd: pwd?.tested ?? null,
    // A year past the cutoff: the distance the green card line tool quotes too.
    bulletin: bulletin?.[365] ?? null,
    seasonal,
  });
});
