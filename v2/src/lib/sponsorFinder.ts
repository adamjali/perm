/**
 * The sponsor finder's filters and query, pure so they can be tested without
 * a database. The page reads the URL (a GET form, so every search has an
 * address) and runs `finderSql` over `sponsor_index`.
 *
 * Every filter is a fact the index already holds; nothing here predicts
 * whether a sponsor will sponsor a particular person. The page says so.
 */

/** NAICS two-digit sectors, mirrored from scripts/build_sponsor_index.py (a test holds them together). */
export const SECTORS: Record<string, string> = {
  "11": "Agriculture, forestry, fishing and hunting",
  "21": "Mining, oil and gas",
  "22": "Utilities",
  "23": "Construction",
  "31": "Manufacturing",
  "42": "Wholesale trade",
  "44": "Retail trade",
  "48": "Transportation and warehousing",
  "51": "Information",
  "52": "Finance and insurance",
  "53": "Real estate",
  "54": "Professional, scientific and technical services",
  "55": "Management of companies",
  "56": "Administrative and support services",
  "61": "Educational services",
  "62": "Health care and social assistance",
  "71": "Arts, entertainment and recreation",
  "72": "Accommodation and food services",
  "81": "Other services",
  "92": "Public administration",
};

export const SORTS = {
  recent: "PERM filings in the last 12 months",
  rate: "PERM approval rate",
  lca: "H-1B LCAs in the last 24 months",
  transfers: "Share of H-1B positions that were transfers",
} as const;
export type FinderSort = keyof typeof SORTS;

export const RECENT_STEPS = [1, 5, 25, 100] as const;
export const RATE_STEPS = [0.9, 0.95, 0.99] as const;
export const PAGE_SIZE = 50;
/** A transfer-friendly sponsor: a fifth or more of its certified H-1B positions were transfers. */
export const TRANSFER_SHARE = 0.2;
/** Mostly senior roles: half or more of its leveled LCAs at wage level III or IV. */
export const SENIOR_SHARE = 0.5;
const MAX_PAGE = 200;

export interface FinderFilters {
  state: string | null;
  sector: string | null;
  minRecent: number;
  minRate: number | null;
  transfers: boolean;
  senior: boolean;
  capExempt: boolean;
  includeDebarred: boolean;
  sort: FinderSort;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFinder(params: Params, states: ReadonlySet<string>): FinderFilters {
  const state = first(params.state).toUpperCase();
  const sector = first(params.sector);
  const recent = Number(first(params.recent));
  const rate = Number(first(params.rate));
  const sort = first(params.sort) as FinderSort;
  const page = Math.floor(Number(first(params.page)));
  return {
    state: states.has(state) ? state : null,
    sector: sector in SECTORS ? sector : null,
    minRecent: (RECENT_STEPS as readonly number[]).includes(recent) ? recent : 1,
    minRate: (RATE_STEPS as readonly number[]).includes(rate) ? rate : null,
    transfers: first(params.transfers) === "1",
    senior: first(params.senior) === "1",
    capExempt: first(params.cap) === "1",
    includeDebarred: first(params.debarred) === "1",
    sort: sort in SORTS ? sort : "recent",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** The URL for a set of filters, defaults left out, so a link is short and canonical. */
export function finderHref(f: FinderFilters, page = f.page): string {
  const q = new URLSearchParams();
  if (f.state) q.set("state", f.state);
  if (f.sector) q.set("sector", f.sector);
  if (f.minRecent !== 1) q.set("recent", String(f.minRecent));
  if (f.minRate !== null) q.set("rate", String(f.minRate));
  if (f.transfers) q.set("transfers", "1");
  if (f.senior) q.set("senior", "1");
  if (f.capExempt) q.set("cap", "1");
  if (f.includeDebarred) q.set("debarred", "1");
  if (f.sort !== "recent") q.set("sort", f.sort);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/sponsor-finder?${s}` : "/sponsor-finder";
}

const ORDER: Record<FinderSort, string> = {
  recent: "perm_recent DESC, slug",
  rate: "perm_rate DESC, perm_decided DESC, slug",
  lca: "lca_24m DESC, slug",
  transfers: "transfer_share DESC, slug",
};

/** The WHERE clause and its arguments; the page runs a count and a page over it. */
export function finderWhere(f: FinderFilters): { where: string; args: (string | number)[] } {
  const conds = ["perm_recent >= ?"];
  const args: (string | number)[] = [f.minRecent];
  if (f.state) {
    conds.push("state = ?");
    args.push(f.state);
  }
  if (f.sector) {
    conds.push("sector = ?");
    args.push(f.sector);
  }
  if (f.minRate !== null || f.sort === "rate") {
    // A rate is only a rate over 20 or more decided cases, the index's own floor.
    conds.push("perm_decided >= 20");
  }
  if (f.minRate !== null) {
    conds.push("perm_rate >= ?");
    args.push(f.minRate);
  }
  if (f.transfers || f.sort === "transfers") conds.push("transfer_share IS NOT NULL");
  if (f.transfers) {
    conds.push("transfer_share >= ?");
    args.push(TRANSFER_SHARE);
  }
  if (f.senior) {
    conds.push("senior_share >= ?");
    args.push(SENIOR_SHARE);
  }
  if (f.capExempt) conds.push("cap_exempt = 1");
  if (!f.includeDebarred) conds.push("debarred = 0");
  return { where: conds.join(" AND "), args };
}

export function finderSql(f: FinderFilters): { count: string; page: string; args: (string | number)[]; pageArgs: (string | number)[] } {
  const { where, args } = finderWhere(f);
  return {
    count: `SELECT COUNT(*) AS n FROM sponsor_index WHERE ${where}`,
    page:
      "SELECT slug, name, state, sector_label, cap_exempt, perm_recent, perm_decided, perm_rate, lca_24m, " +
      `transfer_share, senior_share, debarred, warn_2y FROM sponsor_index WHERE ${where} ` +
      `ORDER BY ${ORDER[f.sort]} LIMIT ? OFFSET ?`,
    args,
    pageArgs: [...args, PAGE_SIZE, (f.page - 1) * PAGE_SIZE],
  };
}
