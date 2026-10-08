/**
 * The release-day estimate for one coming bulletin, as the bulletin page
 * reads it (src/lib/bulletinRelease.ts): the day of the month before by which
 * half of the past bulletins were already captured, and the days by which a
 * quarter and three quarters were. The estimate scorecard records it before
 * the bulletin lands and grades it on the day this site first held it
 * (`bulletin_first_seen`, written by scripts/ingest_visa_bulletin.py).
 *
 * The captures are floors (a page existed by then), so the estimate leans
 * early; grading it is how that shows.
 *
 * Plain module, pure functions.
 */

import { monthBefore } from "@/lib/bulletinNext";
import { releaseByDay, type FirstCapture } from "@/lib/bulletinRelease";

export interface ReleaseEstimate {
  /** The bulletin, `YYYY-MM`. */
  bulletin: string;
  /** `YYYY-MM-DD` in the month before: the typical day, and the middle half. */
  typical: string;
  early: string;
  late: string;
}

const MIN_MONTHS = 6;

/** The month after `ym`. */
export function monthAfter(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${next[0]}-${String(next[1]).padStart(2, "0")}`;
}

export function releaseEstimate(bulletin: string, captures: readonly FirstCapture[]): ReleaseEstimate | null {
  const rows = releaseByDay(captures);
  const of = rows[30]?.of ?? 0;
  if (of < MIN_MONTHS) return null;
  const by = (share: number) => rows.find((r) => r.captured >= share * r.of)?.day ?? null;
  const [d25, d50, d75] = [by(0.25), by(0.5), by(0.75)];
  if (d25 === null || d50 === null || d75 === null) return null;
  const month = monthBefore(bulletin);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = (d: number) => `${month}-${String(Math.min(d, last)).padStart(2, "0")}`;
  return { bulletin, typical: day(d50), early: day(d25), late: day(d75) };
}
