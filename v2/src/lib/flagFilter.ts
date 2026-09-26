import type { FlagDisclosedRow } from "@/lib/turso/flagCases";

/**
 * Filters over one wage-request or LCA search's loaded rows.
 *
 * A search answers from two halves: DOL's daily check (the status, and the only
 * record of anything pending) and DOL's quarterly file (the decided record,
 * with the wage, the worksite state, the occupation, the visa class and the law
 * firm). Everything past the status lives only in the file, so a filter on one
 * of those fields keeps a live row only when the file holds that case too. A
 * pending case has no file record yet and can't be evaluated, so it drops,
 * exactly as a wage filter drops a row with no wage. The panel says so.
 *
 * Plain module: the browser filters, and the arithmetic is tested without it.
 */

export type FlagFilterKey = "status" | "state" | "soc" | "firm" | "visa";

export interface FlagFilters {
  status?: string;
  state?: string;
  soc?: string;
  firm?: string;
  visa?: string;
  wageMin?: number;
  wageMax?: number;
}

/** One row of either half: the status it shows, and the file's record if any. */
export interface FlagFilterItem {
  status: string;
  file: FlagDisclosedRow | null;
}

export interface FlagFilterField {
  key: FlagFilterKey;
  label: string;
  get: (i: FlagFilterItem) => string | null;
}

export const FLAG_FILTER_FIELDS: readonly FlagFilterField[] = [
  { key: "status", label: "Status", get: (i) => i.status || null },
  { key: "state", label: "Worksite state", get: (i) => i.file?.worksiteState ?? null },
  { key: "soc", label: "Occupation", get: (i) => i.file?.socTitle ?? i.file?.socCode ?? null },
  { key: "firm", label: "Law firm", get: (i) => i.file?.attorneyName ?? null },
  { key: "visa", label: "Visa class", get: (i) => i.file?.visaClass ?? null },
];

/** The values a field takes across the rows, busiest first, then by name. */
export function flagFacetOptions(
  items: readonly FlagFilterItem[],
  field: FlagFilterField,
): { value: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const v = field.get(i);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
}

export function anyFlagFilter(f: FlagFilters): boolean {
  return Object.values(f).some((v) => v !== undefined && v !== "");
}

/** Whether one row passes every filter set. A wage bound drops a row with no wage. */
export function passesFlagFilters(i: FlagFilterItem, f: FlagFilters): boolean {
  for (const field of FLAG_FILTER_FIELDS) {
    const want = f[field.key];
    if (want && field.get(i) !== want) return false;
  }
  if (f.wageMin !== undefined || f.wageMax !== undefined) {
    const w = i.file?.wage ?? null;
    if (w === null) return false;
    if (f.wageMin !== undefined && w < f.wageMin) return false;
    if (f.wageMax !== undefined && w > f.wageMax) return false;
  }
  return true;
}
