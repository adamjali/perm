/**
 * Words for an employer page with no PERM record: one that files H-1B LCAs,
 * wage requests, or H-2A, H-2B and CW-1 applications, and no PERM case that
 * DOL's current files or its live record hold.
 *
 * Pure, so the page, its metadata, its social card and the tests read the
 * same phrases. The counts come from `employer_other_index`, built nightly by
 * scripts/build_employer_map.py.
 */

export interface OtherEmployerCounts {
  /** PERM cases in DOL's older files (FY2016 to FY2023) under a spelling no PERM page answers to. */
  perm: number;
  lca: number;
  pwd: number;
  h2a: number;
  h2b: number;
  cw1: number;
}

/** In the order a reader meets them: the H-1B, then the wage request, then the seasonal visas. */
const PARTS: { key: keyof OtherEmployerCounts; short: string; one: string; many: string }[] = [
  { key: "lca", short: "H-1B", one: "H-1B LCA", many: "H-1B LCAs" },
  { key: "pwd", short: "Wage Request", one: "wage request", many: "wage requests" },
  { key: "h2a", short: "H-2A", one: "H-2A filing", many: "H-2A filings" },
  { key: "h2b", short: "H-2B", one: "H-2B filing", many: "H-2B filings" },
  { key: "cw1", short: "CW-1", one: "CW-1 filing", many: "CW-1 filings" },
];

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "H-1B and Wage Request", for a title; the programs the employer files, in reading order. */
export function programsShort(c: OtherEmployerCounts): string {
  const v = PARTS.filter((p) => c[p.key] > 0).map((p) => p.short);
  return v.length ? list(v) : "DOL";
}

/** "12 H-1B LCAs, 3 wage requests and 1 H-2B filing". */
export function programsMix(c: OtherEmployerCounts, format: (n: number) => string): string {
  return list(
    PARTS.filter((p) => c[p.key] > 0).map((p) => `${format(c[p.key])} ${c[p.key] === 1 ? p.one : p.many}`),
  );
}

/** Which seasonal visas, if any, for the seasonal case list's heading. */
export function hasSeasonal(c: OtherEmployerCounts): boolean {
  return c.h2a + c.h2b + c.cw1 > 0;
}

/** The provenance lines the page shows: only the datasets it reads for this employer. */
export function otherEmployerDatasets(c: OtherEmployerCounts): string[] {
  const out: string[] = [];
  if (c.lca) out.push("lca-status", "lca-disclosure", "uscis-h1b-hub");
  if (c.pwd) out.push("pwd-status", "pw-disclosure");
  if (hasSeasonal(c)) out.push("seasonal-status");
  if (c.h2a) out.push("h2a-disclosure");
  if (c.h2b) out.push("h2b-disclosure");
  if (c.cw1) out.push("cw1-disclosure");
  if (c.perm) out.push("perm-cases");
  return out;
}
