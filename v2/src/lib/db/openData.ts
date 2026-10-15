/**
 * The two open datasets' rows, read whole.
 *
 * Both tables are small and bounded by the calendar, not by traffic: one row
 * per visa bulletin (about 250) and one per DOL republication (a few a month),
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

/**
 * Every reading DOL published: one per (PERM date, wage date) pair, kept by the
 * ingest in processing_time_readings since Oct 3 2026. processing_times holds
 * one per PERM date, so a wage-only move overwrote the earlier wage reading
 * there; it stays the fallback for a database the ingest hasn't reached yet.
 */
export async function getProcessingTimesArchive(): Promise<DolReading[]> {
  const read = (sql: string) => rows<{ json: string; fetched_at: number }>(sql);
  let r = await read(
    "SELECT json, fetched_at FROM processing_time_readings ORDER BY perm_as_of, pwd_as_of LIMIT 5000",
  ).catch(() => []);
  if (r.length === 0) r = await read("SELECT json, fetched_at FROM processing_times ORDER BY perm_as_of LIMIT 5000");
  return r.map((x) => ({ ...(JSON.parse(x.json) as object), fetchedAt: Number(x.fetched_at) }) as DolReading);
}
