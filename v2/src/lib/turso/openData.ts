/**
 * The two open datasets' rows, read whole.
 *
 * Both tables are small and bounded by the calendar, not by traffic: one row
 * per visa bulletin (about 150) and one per DOL republication (a few a month),
 * so reading every row costs a few hundred rows a day at most. The LIMITs are
 * a ceiling against a runaway table, not a page size.
 *
 * Named so the revalidation tests see them: `getVisaBulletins...` reads the
 * bulletin, `getProcessingTimes...` reads DOL's snapshot, and the pages and
 * files that call them are expired when either source moves.
 */
import "server-only";

import { rows } from "./client";
import type { BulletinRecord, DolReading } from "@/lib/openData";

const parse = (v: string | null | undefined) => (v ? JSON.parse(v) : null);

export async function getVisaBulletinsArchive(): Promise<BulletinRecord[]> {
  const r = await rows<Record<string, string | null>>(
    "SELECT bulletin_month, source_url, final_action, dates_for_filing, family_final_action, family_dates_for_filing " +
      "FROM visa_bulletins ORDER BY bulletin_month LIMIT 2000",
  );
  return r.map((x) => ({
    bulletinMonth: x.bulletin_month as string,
    sourceUrl: x.source_url ?? null,
    finalAction: parse(x.final_action),
    datesForFiling: parse(x.dates_for_filing),
    familyFinalAction: parse(x.family_final_action),
    familyDatesForFiling: parse(x.family_dates_for_filing),
  }));
}

export async function getProcessingTimesArchive(): Promise<DolReading[]> {
  const r = await rows<{ json: string; fetched_at: number }>(
    "SELECT json, fetched_at FROM processing_times ORDER BY perm_as_of LIMIT 5000",
  );
  return r.map((x) => ({ ...(JSON.parse(x.json) as object), fetchedAt: Number(x.fetched_at) }) as DolReading);
}
