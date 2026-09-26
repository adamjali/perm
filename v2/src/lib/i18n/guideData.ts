import "server-only";

import { cache } from "react";

import { analystReviewAverage, analystReviewQueue } from "../../../convex/lib/dolProcessingTimes";
import type { BulletinMonth, CountryKey } from "@/lib/perm";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { getVisaBulletins } from "@/lib/turso/publicData";
import { countryCutoffRows, newestBulletin, type CutoffRow } from "./cutoffs";

/**
 * The live figures every localized guide prints, read once per render and
 * shared by all five pages. Each half fails on its own: a missing processing
 * snapshot hides the queue figures, a missing bulletin hides the cutoff table,
 * and the page says so in its own language rather than printing a stale number.
 */

export interface GuideData {
  perm: {
    /** The filing month DOL's analyst review is working, `YYYY-MM`. */
    month: string | null;
    /** DOL's own as-of stamp, `YYYY-MM-DD`. */
    asOf: string | null;
    averageDays: number | null;
  } | null;
  /** The receipt month DOL is working for PERM wage requests (OEWS), `YYYY-MM`. */
  pwdMonth: string | null;
  bulletin: {
    month: string;
    rows: Partial<Record<CountryKey, CutoffRow[]>>;
  } | null;
}

const COUNTRIES: readonly CountryKey[] = ["worldwide", "china", "india", "mexico", "philippines"];

export const getGuideData = cache(async (): Promise<GuideData> => {
  const [times, bulletins] = await Promise.all([
    getProcessingTimes().catch(() => null),
    getVisaBulletins().catch(() => []),
  ]);

  const analyst = times ? analystReviewQueue(times.permQueues ?? []) : undefined;
  const average = times ? analystReviewAverage(times.permAverageDays ?? []) : undefined;
  const pwd = times?.pwdQueues?.find((q) => q.program.toUpperCase() === "PERM");

  const newest = newestBulletin(
    bulletins.map((b) => ({
      bulletinMonth: b.bulletinMonth,
      finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
      datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
    })),
  );

  return {
    perm: times
      ? {
          month: analyst?.priorityDate ?? null,
          asOf: times.permAsOf ?? null,
          averageDays: average?.calendarDays ?? null,
        }
      : null,
    pwdMonth: pwd?.oewsReceiptDate ?? null,
    bulletin: newest
      ? {
          month: newest.bulletinMonth,
          rows: Object.fromEntries(COUNTRIES.map((c) => [c, countryCutoffRows(newest, c)])),
        }
      : null,
  };
});
