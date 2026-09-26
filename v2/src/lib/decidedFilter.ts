import type { DecidedCase } from "@/lib/turso/decidedDays";

/**
 * Filtering the decided half of `/perm-decision-activity`, in the browser.
 *
 * The whole range is already in memory (one request, capped at 1,000 rows per
 * program), so every filter here is free: no control costs a database read.
 * The options are built from the rows themselves, busiest first, so a filter
 * can never offer a value that returns nothing.
 *
 * A PLAIN MODULE so the filtering can be tested without rendering the page.
 */

export type DecidedFilterKey =
  | "state"
  | "soc"
  | "firm"
  | "city"
  | "naics"
  | "citizenship"
  | "visaClass"
  | "education";

export interface DecidedFilterField {
  key: DecidedFilterKey;
  label: string;
  get: (c: DecidedCase) => string | null;
}

/** In the order the panel shows them. */
export const DECIDED_FILTER_FIELDS: readonly DecidedFilterField[] = [
  { key: "state", label: "Worksite state", get: (c) => c.state },
  { key: "city", label: "Worksite city", get: (c) => (c.worksiteCity ? cityLabel(c) : null) },
  { key: "soc", label: "Occupation", get: (c) => c.socTitle ?? c.socCode },
  { key: "firm", label: "Law firm", get: (c) => c.attorneyName },
  { key: "naics", label: "Industry (NAICS)", get: (c) => c.naics },
  { key: "citizenship", label: "Citizenship", get: (c) => c.citizenship },
  { key: "visaClass", label: "Visa", get: (c) => c.visaClass },
  { key: "education", label: "Education", get: (c) => c.education },
];

/** A city names its state, because Portland, OR is not Portland, ME. */
export function cityLabel(c: DecidedCase): string {
  const city = (c.worksiteCity ?? "").trim();
  return c.state ? `${city}, ${c.state}` : city;
}

export type DecidedFilters = Partial<Record<DecidedFilterKey, string>> & {
  wageMin?: number;
  wageMax?: number;
};

/** Distinct values of one field with their counts, busiest first, ties A to Z. */
export function facetOptions(
  rows: readonly DecidedCase[],
  field: DecidedFilterField,
): { value: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = field.get(r);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
}

/**
 * Keep the rows that match every chosen filter.
 *
 * A wage bound drops a row with no wage: "at least $100,000" cannot be true of
 * a wage nobody published. That is filtering; the table's SORT still keeps
 * those rows and puts them last.
 */
export function applyDecidedFilters(
  rows: readonly DecidedCase[],
  f: DecidedFilters,
): DecidedCase[] {
  const active = DECIDED_FILTER_FIELDS.filter((d) => f[d.key]);
  return rows.filter((r) => {
    for (const d of active) if (d.get(r) !== f[d.key]) return false;
    if (f.wageMin !== undefined && (r.wage === null || r.wage < f.wageMin)) return false;
    if (f.wageMax !== undefined && (r.wage === null || r.wage > f.wageMax)) return false;
    return true;
  });
}

/** True when any filter is set. */
export function anyDecidedFilter(f: DecidedFilters): boolean {
  return (
    DECIDED_FILTER_FIELDS.some((d) => Boolean(f[d.key])) ||
    f.wageMin !== undefined ||
    f.wageMax !== undefined
  );
}
