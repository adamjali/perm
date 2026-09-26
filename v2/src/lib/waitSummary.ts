/**
 * Filing-to-decision days, summarised. Plain module so the unit project can
 * test it; `src/lib/turso/employerWait.ts` feeds it rows.
 */

export interface WaitSummary {
  n: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

/** Under this many decisions an employer gets no median, only the count. */
export const EMPLOYER_MIN_DECISIONS = 5;

const ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** Pure: filing dates and final-event stamps to a summary. Exported for the test. */
export function summariseWaits(pairs: readonly { filed: string; stamp: number }[]): WaitSummary {
  const days = pairs
    .map((p) => {
      const decided = ET.format(new Date(p.stamp));
      return Math.round((Date.parse(`${decided}T00:00:00Z`) - Date.parse(`${p.filed.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
    })
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  if (days.length < EMPLOYER_MIN_DECISIONS) return { n: days.length, p25: null, p50: null, p75: null };
  const q = (x: number) => days[Math.min(days.length - 1, Math.floor(x * days.length))]!;
  return { n: days.length, p25: q(0.25), p50: q(0.5), p75: q(0.75) };
}

