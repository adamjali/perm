/**
 * The State Department's immigrant visa waiting list at the National Visa
 * Center, as `scripts/ingest_nvc_waiting_list.py` stores it in
 * `perm_docs['nvc_waiting_list']`. Pure: shapes and small arithmetic.
 *
 * What the list is, in State's words, is the first thing the page says: it
 * counts people whose visas will be processed ABROAD, families included; it
 * leaves out everyone adjusting status at USCIS, so for employment categories
 * it understates demand; and consulates cull cases that are unlikely to move.
 */

export type NvcKey =
  | "F1" | "F2" | "F2A" | "F2B" | "F3" | "F4" | "F"
  | "E1" | "E2" | "E3" | "E3S" | "EW" | "E4" | "E5" | "E"
  | "ALL";

export interface NvcPoint extends Record<NvcKey, number> {
  /** November 1 of the year, `YYYY-MM-DD`. */
  asOf: string;
}

export interface NvcWaitingListDoc {
  series: NvcPoint[];
  revisions: Array<{ asOf: string; restatedIn: string; changes: Record<string, [number, number]> }>;
  newest: string;
  employmentByCountry: Array<{ country: string; applicants: number }>;
  /** as-of date -> where that report was read. */
  sources: Record<string, string>;
  statsPage: string;
}

export const EMPLOYMENT_ROWS: ReadonlyArray<{ key: NvcKey; label: string }> = [
  { key: "E1", label: "EB-1" },
  { key: "E2", label: "EB-2" },
  { key: "E3S", label: "EB-3 skilled and professional" },
  { key: "EW", label: "EB-3 Other Workers" },
  { key: "E4", label: "EB-4" },
  { key: "E5", label: "EB-5" },
];

export const FAMILY_ROWS: ReadonlyArray<{ key: NvcKey; label: string }> = [
  { key: "F1", label: "F1, adult children of citizens" },
  { key: "F2A", label: "F2A, spouses and children of permanent residents" },
  { key: "F2B", label: "F2B, adult children of permanent residents" },
  { key: "F3", label: "F3, married children of citizens" },
  { key: "F4", label: "F4, brothers and sisters of adult citizens" },
];

export interface CategorySeries {
  key: NvcKey;
  label: string;
  points: Array<{ asOf: string; n: number }>;
  latest: number;
  /** Against the year before, as a share; null for the first year or a zero base. */
  change: number | null;
}

export function categorySeries(doc: NvcWaitingListDoc, rows: ReadonlyArray<{ key: NvcKey; label: string }>): CategorySeries[] {
  const series = [...doc.series].sort((a, z) => a.asOf.localeCompare(z.asOf));
  return rows.map(({ key, label }) => {
    const points = series.map((p) => ({ asOf: p.asOf, n: p[key] }));
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    return {
      key,
      label,
      points,
      latest: last?.n ?? 0,
      change: last && prev && prev.n > 0 ? (last.n - prev.n) / prev.n : null,
    };
  });
}

/** "+55%", "-3.6%": whole percent from 10% up, one decimal below, as State prints it. */
export function changeLabel(change: number): string {
  const pct = change * 100;
  const text = Math.abs(pct) >= 10 ? Math.round(pct).toString() : pct.toFixed(1);
  return `${pct > 0 ? "+" : ""}${text}%`;
}
