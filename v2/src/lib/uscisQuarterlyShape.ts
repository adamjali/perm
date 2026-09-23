/**
 * The pure half of the USCIS quarterly data: labels, pivots and rankings
 * over the rows `src/lib/turso/uscisQuarterly.ts` reads.
 *
 * A plain module, not `server-only`, so the tests can exercise the shaping
 * without a database and a client component could share the labels. Nothing
 * in here is a figure: every number is USCIS's, rearranged.
 */

/** USCIS's fiscal quarters: Q1 is October to December of the PREVIOUS calendar year. */
const QUARTER_MONTHS: Record<number, [string, string]> = {
  1: ["Oct", "Dec"],
  2: ["Jan", "Mar"],
  3: ["Apr", "Jun"],
  4: ["Jul", "Sep"],
};

/** `FY2026 Q3` -> "FY2026 Q3 (Apr to Jun 2026)"; Q1 names the earlier calendar year. */
export function quarterLabel(fy: number, quarter: number): string {
  const months = QUARTER_MONTHS[quarter];
  if (!months) return `FY${fy} Q${quarter}`;
  const year = quarter === 1 ? fy - 1 : fy;
  return `FY${fy} Q${quarter} (${months[0]} to ${months[1]} ${year})`;
}

/** "2026-06" -> "June 2026"; anything else verbatim. */
export function monthLabel(asOf: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(asOf);
  if (!m) return asOf;
  const names = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${names[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** "2026-Q3" -> "FY2026 Q3". */
export function asOfQuarterLabel(asOf: string): string {
  const m = /^(\d{4})-Q(\d)$/.exec(asOf);
  return m ? `FY${m[1]} Q${m[2]}` : asOf;
}

/**
 * Months as USCIS prints them: one decimal, never a trailing ".0".
 * `3.9` -> "3.9", `7` -> "7", null -> "n/a" (USCIS's own N/A).
 */
export function monthsLabel(months: number | null): string {
  if (months === null || !Number.isFinite(months)) return "n/a";
  return Number.isInteger(months) ? String(months) : months.toFixed(1);
}

// ---------------------------------------------------------------------------
// Awaiting a visa number
// ---------------------------------------------------------------------------

export interface AwaitingCell {
  country: string;
  category: string;
  count: number;
}

/** The order and words the page uses for USCIS's nine columns. */
export const AWAITING_CATEGORY_LABELS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "EB1", label: "EB-1" },
  { code: "EB2", label: "EB-2" },
  { code: "EB3", label: "EB-3 professional and skilled" },
  { code: "EW3", label: "EB-3 other workers" },
  { code: "EB4", label: "EB-4 special immigrants" },
  { code: "EB4R", label: "EB-4 religious workers" },
  { code: "EB5U", label: "EB-5 unreserved" },
  { code: "EB5S", label: "EB-5 set-aside" },
  { code: "TOTAL", label: "All categories" },
];

export const AWAITING_COUNTRY_ORDER = ["India", "China", "Mexico", "Philippines", "Rest of the World", "TOTAL"] as const;

export interface AwaitingTable {
  countries: string[];
  categories: string[];
  /** country -> category -> count. Every cell USCIS printed is here. */
  cells: Record<string, Record<string, number>>;
}

/** Rows and columns out of the long cell list, in the page's order. */
export function pivotAwaiting(cells: readonly AwaitingCell[]): AwaitingTable {
  const table: Record<string, Record<string, number>> = {};
  for (const c of cells) {
    (table[c.country] ??= {})[c.category] = c.count;
  }
  const seen = new Set(Object.keys(table));
  const countries = [
    ...AWAITING_COUNTRY_ORDER.filter((c) => seen.has(c)),
    ...[...seen].filter((c) => !(AWAITING_COUNTRY_ORDER as readonly string[]).includes(c)).sort(),
  ];
  const cats = new Set(cells.map((c) => c.category));
  const categories = AWAITING_CATEGORY_LABELS.map((c) => c.code).filter((c) => cats.has(c));
  return { countries, categories, cells: table };
}

/** One country's share of a category's total, as a fraction, or null when the total is zero. */
export function shareOf(table: AwaitingTable, country: string, category: string): number | null {
  const total = table.cells.TOTAL?.[category];
  const n = table.cells[country]?.[category];
  if (!total || n === undefined) return null;
  return n / total;
}

export interface AwaitingMove {
  country: string;
  category: string;
  from: number;
  to: number;
  delta: number;
}

/**
 * Every cell's movement between two snapshots, largest absolute move first.
 * A cell absent from either side is skipped: a category USCIS added has no
 * "before", and a move from nothing is not a move.
 */
export function awaitingMoves(current: readonly AwaitingCell[], previous: readonly AwaitingCell[]): AwaitingMove[] {
  const before = new Map(previous.map((c) => [`${c.country}|${c.category}`, c.count]));
  const out: AwaitingMove[] = [];
  for (const c of current) {
    const from = before.get(`${c.country}|${c.category}`);
    if (from === undefined) continue;
    out.push({ country: c.country, category: c.category, from, to: c.count, delta: c.count - from });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ---------------------------------------------------------------------------
// The I-485 by office
// ---------------------------------------------------------------------------

export interface OfficeRow {
  state: string;
  office: string;
  code: string;
  suppressed: number;
  famReceived: number | null; famApproved: number | null; famDenied: number | null; famPending: number | null;
  empReceived: number | null; empApproved: number | null; empDenied: number | null; empPending: number | null;
  humReceived: number | null; humApproved: number | null; humDenied: number | null; humPending: number | null;
  othReceived: number | null; othApproved: number | null; othDenied: number | null; othPending: number | null;
  allReceived: number | null; allApproved: number | null; allDenied: number | null; allPending: number | null;
}

export type OfficeMeasure = keyof Omit<OfficeRow, "state" | "office" | "code" | "suppressed">;

export const SERVICE_CENTER_STATE = "Service Center";

/** Field offices only, the service centers only, or both: the three sets the page shows. */
export function splitOffices(rowsIn: readonly OfficeRow[]): { fieldOffices: OfficeRow[]; serviceCenters: OfficeRow[] } {
  return {
    fieldOffices: rowsIn.filter((r) => r.code !== "ALL" && r.state !== SERVICE_CENTER_STATE),
    serviceCenters: rowsIn.filter((r) => r.code !== "ALL" && r.state === SERVICE_CENTER_STATE),
  };
}

/**
 * The busiest offices on one measure, largest first, suppressed cells last.
 * A null is not a small number: USCIS withheld it, and ranking it as zero
 * would print an office with a handful of cases below one with none.
 */
export function rankOffices(rowsIn: readonly OfficeRow[], measure: OfficeMeasure, limit = 15): OfficeRow[] {
  return [...rowsIn]
    .filter((r) => r[measure] !== null)
    .sort((a, b) => (b[measure] as number) - (a[measure] as number))
    .slice(0, limit);
}

/**
 * Employment-based completions against the quarter's employment pending,
 * per office: how many quarters of work sit in the pile at this quarter's
 * pace. Null when the office decided nothing (the ratio is not a wait) or
 * when either figure is withheld.
 */
export function quartersOfWork(r: OfficeRow): number | null {
  const done = (r.empApproved ?? 0) + (r.empDenied ?? 0);
  if (r.empApproved === null || r.empDenied === null || r.empPending === null || done === 0) return null;
  return r.empPending / done;
}

/** Sum of a measure over rows, counting withheld cells as absent and saying how many were. */
export function sumMeasure(rowsIn: readonly OfficeRow[], measure: OfficeMeasure): { total: number; withheld: number } {
  let total = 0;
  let withheld = 0;
  for (const r of rowsIn) {
    const v = r[measure];
    if (v === null) withheld += 1;
    else total += v;
  }
  return { total, withheld };
}

/** Rows grouped by state, states alphabetical, the service centers last. */
export function groupByState(rowsIn: readonly OfficeRow[]): Array<{ state: string; offices: OfficeRow[] }> {
  const groups = new Map<string, OfficeRow[]>();
  for (const r of rowsIn) {
    if (r.code === "ALL") continue;
    (groups.get(r.state) ?? groups.set(r.state, []).get(r.state)!).push(r);
  }
  const states = [...groups.keys()].sort((a, b) => {
    if (a === SERVICE_CENTER_STATE) return 1;
    if (b === SERVICE_CENTER_STATE) return -1;
    return a.localeCompare(b);
  });
  return states.map((state) => ({ state, offices: groups.get(state)! }));
}

// ---------------------------------------------------------------------------
// I-140 receipts by class and country
// ---------------------------------------------------------------------------

export interface ClassCountryCell {
  country: string;
  preference: string;
  measure: string;
  fy: number;
  count: number;
}

export interface ClassCountryYear {
  fy: number;
  total: number;
  approved: number;
  denied: number;
  pending: number;
  /** Share of the year's petitions still pending, 0 to 1. */
  pendingShare: number;
  /** Denials as a share of decided petitions, or null before anything was decided. */
  denialRate: number | null;
}

/** One country's year-by-year line for a preference ("ALL" is every preference). */
export function yearsFor(cells: readonly ClassCountryCell[], country: string, preference: string): ClassCountryYear[] {
  const by = new Map<number, Partial<Record<string, number>>>();
  for (const c of cells) {
    if (c.country !== country || c.preference !== preference) continue;
    (by.get(c.fy) ?? by.set(c.fy, {}).get(c.fy)!)[c.measure] = c.count;
  }
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fy, m]) => {
      const total = m.total ?? 0;
      const approved = m.approved ?? 0;
      const denied = m.denied ?? 0;
      const pending = m.pending ?? 0;
      const decided = approved + denied;
      return {
        fy, total, approved, denied, pending,
        pendingShare: total ? pending / total : 0,
        denialRate: decided ? denied / decided : null,
      };
    });
}

export const CLASS_LABELS: ReadonlyArray<{ code: string; preference: string; label: string }> = [
  { code: "E11", preference: "EB1", label: "Extraordinary ability" },
  { code: "E12", preference: "EB1", label: "Outstanding professor or researcher" },
  { code: "E13", preference: "EB1", label: "Multinational executive or manager" },
  { code: "E21", preference: "EB2", label: "Advanced degree or exceptional ability" },
  { code: "NIW", preference: "EB2", label: "National interest waiver" },
  { code: "E31", preference: "EB3", label: "Skilled worker" },
  { code: "E32", preference: "EB3", label: "Professional" },
  { code: "EW3", preference: "EB3", label: "Other worker" },
];

/** Approvals by class for one country and year, in USCIS's class order. */
export function classApprovals(cells: readonly ClassCountryCell[], country: string, fy: number): Array<{ code: string; label: string; approved: number }> {
  const by = new Map<string, number>();
  for (const c of cells) {
    if (c.country === country && c.fy === fy && c.measure.startsWith("approved_")) {
      by.set(c.measure.slice("approved_".length), c.count);
    }
  }
  return CLASS_LABELS.filter((c) => by.has(c.code)).map((c) => ({ code: c.code, label: c.label, approved: by.get(c.code)! }));
}

/** Country sheets in the page's order: the total first, then the top five as USCIS ranks them. */
export function countryOrder(countries: readonly string[]): string[] {
  const preferred = ["All Countries", "India", "China", "Philippines", "Brazil", "Vietnam"];
  const set = new Set(countries);
  return [...preferred.filter((c) => set.has(c)), ...countries.filter((c) => !preferred.includes(c)).sort()];
}
