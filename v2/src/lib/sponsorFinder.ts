/**
 * The sponsor finder's filters, sorts and query, pure so they can be tested
 * without a database. The page reads the URL (a GET form, so every search has
 * an address) and runs `finderSql` over `sponsor_jobs` joined to
 * `sponsor_index`, both built nightly by scripts/build_sponsor_index.py.
 *
 * Two kinds of figure, and the page names each:
 *
 * - The job's own (`j.`): filings, approval rate, median offered wage and
 *   typical days to a decision, for the chosen occupation and state, from
 *   DOL's published files. "Every job" and "every state" are rollup rows, so
 *   one query shape serves every choice.
 * - The employer's (`s.`): filings in the last 12 months and cases waiting with
 *   DOL now (both from DOL's live record too), its newest filing, sector,
 *   H-1B record and debarment. The live record names no occupation or
 *   worksite, so these can't be split by job.
 *
 * Every filter is a fact the tables hold; nothing here predicts whether a
 * sponsor will sponsor a particular person, and the page says so.
 */

import { MIN_DECIDED_FOR_MEDIAN, MIN_DECIDED_FOR_RATE } from "@/lib/entityPayload";
import { sectorGroup } from "@/lib/naicsSectors";
import { SUGGEST_MAX_LENGTH } from "@/lib/search/limits";
import { DAYS_PER_MONTH } from "@/lib/time";

export const PATH = "/sponsor-finder";
/**
 * Where a search lands: the answer below the form. On a phone the form runs
 * about two screens, so a search that reloaded at the top hid what it found.
 */
export const ANSWER_ID = "answer";

/** "Every job" and "every state" in sponsor_jobs (ANY in scripts/build_sponsor_index.py). */
export const ANY = "";

export const RECENT_STEPS = [1, 5, 25, 100] as const;
export const RATE_STEPS = [0.9, 0.95, 0.99] as const;
/**
 * Median offered wage floors. Measured Oct 18 2026 over sponsors with 20 or
 * more filings: a quarter at $44,408 or less, half at $113,318, three quarters
 * at $139,464, so the steps span the middle of the field and its top.
 */
export const WAGE_STEPS = [50_000, 75_000, 100_000, 125_000, 150_000] as const;
/**
 * "Typical decision within" choices, in months. Measured Oct 18 2026: a
 * sponsor's median days from receipt to decision ran from 395 (a tenth of
 * sponsors) to 495 (nine tenths), so one-month steps across that range.
 */
export const MONTH_STEPS = [13, 14, 15, 16] as const;
export const PAGE_SIZE = 50;
/** A transfer-friendly sponsor: a fifth or more of its certified H-1B positions were transfers. */
export const TRANSFER_SHARE = 0.2;
/** Mostly senior roles: half or more of its leveled LCAs at wage level III or IV. */
export const SENIOR_SHARE = 0.5;
/** Pages past this stop: a person never reads 10,000 rows, a crawler would. */
const MAX_PAGE = 200;

const DECIDED = "(j.certified + j.denied)";
const RATE = `(CAST(j.certified AS REAL) / ${DECIDED})`;
/** A rate is shown, filtered and sorted only over the employer page's own floor. */
const HAS_RATE = `${DECIDED} >= ${MIN_DECIDED_FOR_RATE}`;
/** A median likewise, at the page's median floor. */
const HAS_MEDIAN = `${DECIDED} >= ${MIN_DECIDED_FOR_MEDIAN}`;

interface SortSpec {
  label: string;
  order: string;
  /** What a row needs to have a place in this order (a rate needs enough decided cases). */
  needs?: string;
}

export const SORTS = {
  recent: { label: "PERM filings, last 12 months", order: "s.perm_recent DESC" },
  filed: { label: "PERM filings in DOL's files", order: "j.filed DESC" },
  waiting: { label: "Cases waiting with DOL now", order: "s.pending_now DESC" },
  latest: { label: "Newest filing", order: "s.latest_filed DESC", needs: "s.latest_filed IS NOT NULL" },
  rate: { label: "Approval rate", order: `${RATE} DESC, ${DECIDED} DESC`, needs: HAS_RATE },
  wage: { label: "Median offered wage", order: "j.median_wage DESC", needs: `${HAS_MEDIAN} AND j.median_wage IS NOT NULL` },
  quickest: { label: "Quickest typical decision", order: "j.median_days ASC", needs: `${HAS_MEDIAN} AND j.median_days IS NOT NULL` },
  lca: { label: "H-1B LCAs, last 24 months", order: "s.lca_24m DESC" },
  transfers: {
    label: "Share of H-1B positions that were transfers",
    order: "s.transfer_share DESC",
    needs: "s.transfer_share IS NOT NULL",
  },
} as const satisfies Record<string, SortSpec>;
export type FinderSort = keyof typeof SORTS;
const DEFAULT_SORT: FinderSort = "recent";

export interface FinderFilters {
  /** The job box as typed: an occupation page's slug, or words to find one by. */
  job: string;
  state: string | null;
  /** A Census sector's value (`31`), from SECTOR_GROUPS. */
  sector: string | null;
  minRecent: number;
  minRate: number | null;
  minWage: number | null;
  withinMonths: number | null;
  waitingNow: boolean;
  transfers: boolean;
  senior: boolean;
  capExempt: boolean;
  includeDebarred: boolean;
  sort: FinderSort;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends number>(steps: readonly T[], v: number): T | null =>
  (steps as readonly number[]).includes(v) ? (v as T) : null;

export function parseFinder(params: Params, states: ReadonlySet<string>): FinderFilters {
  const state = first(params.state).toUpperCase();
  const sector = first(params.sector);
  const sort = first(params.sort);
  const page = Math.floor(Number(first(params.page)));
  return {
    job: first(params.job).trim().slice(0, SUGGEST_MAX_LENGTH),
    state: states.has(state) ? state : null,
    sector: sectorGroup(sector) ? sector : null,
    minRecent: oneOf(RECENT_STEPS, Number(first(params.recent))) ?? RECENT_STEPS[0],
    minRate: oneOf(RATE_STEPS, Number(first(params.rate))),
    minWage: oneOf(WAGE_STEPS, Number(first(params.wage))),
    withinMonths: oneOf(MONTH_STEPS, Number(first(params.within))),
    waitingNow: first(params.waiting) === "1",
    transfers: first(params.transfers) === "1",
    senior: first(params.senior) === "1",
    capExempt: first(params.cap) === "1",
    includeDebarred: first(params.debarred) === "1",
    sort: sort in SORTS ? (sort as FinderSort) : DEFAULT_SORT,
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Every filter at its default: the finder before anyone has chosen anything. */
export const DEFAULT_FILTERS: FinderFilters = parseFinder({}, new Set());

/** The URL for a set of filters, defaults left out, so a link is short and canonical. */
export function finderHref(f: FinderFilters, page = f.page): string {
  const q = new URLSearchParams();
  if (f.job) q.set("job", f.job);
  if (f.state) q.set("state", f.state);
  if (f.sector) q.set("sector", f.sector);
  if (f.minRecent !== RECENT_STEPS[0]) q.set("recent", String(f.minRecent));
  if (f.minRate !== null) q.set("rate", String(f.minRate));
  if (f.minWage !== null) q.set("wage", String(f.minWage));
  if (f.withinMonths !== null) q.set("within", String(f.withinMonths));
  if (f.waitingNow) q.set("waiting", "1");
  if (f.transfers) q.set("transfers", "1");
  if (f.senior) q.set("senior", "1");
  if (f.capExempt) q.set("cap", "1");
  if (f.includeDebarred) q.set("debarred", "1");
  if (f.sort !== DEFAULT_SORT) q.set("sort", f.sort);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `${PATH}?${s}#${ANSWER_ID}` : PATH;
}

/**
 * The WHERE clause and its arguments, for one occupation group (`soc`, or ANY
 * for every job). A floor a filter or a sort needs is a guard with no
 * argument, added once however many ask for it.
 */
export function finderWhere(f: FinderFilters, soc: string): { where: string; args: (string | number)[] } {
  const conds = ["j.soc = ?", "j.state = ?", "s.perm_recent >= ?"];
  const args: (string | number)[] = [soc, f.state ?? ANY, f.minRecent];
  const guards = new Set<string>();
  const sortNeeds: string | undefined = (SORTS[f.sort] as SortSpec).needs;
  if (sortNeeds) guards.add(sortNeeds);
  if (f.sector) {
    conds.push("s.sector = ?");
    args.push(f.sector);
  }
  if (f.minRate !== null) {
    guards.add(HAS_RATE);
    conds.push(`${RATE} >= ?`);
    args.push(f.minRate);
  }
  if (f.minWage !== null) {
    guards.add(HAS_MEDIAN);
    conds.push("j.median_wage >= ?");
    args.push(f.minWage);
  }
  if (f.withinMonths !== null) {
    guards.add(HAS_MEDIAN);
    conds.push("j.median_days <= ?");
    args.push(Math.round(f.withinMonths * DAYS_PER_MONTH));
  }
  if (f.waitingNow) conds.push("s.pending_now > 0");
  if (f.transfers) {
    conds.push("s.transfer_share >= ?");
    args.push(TRANSFER_SHARE);
  }
  if (f.senior) {
    conds.push("s.senior_share >= ?");
    args.push(SENIOR_SHARE);
  }
  if (f.capExempt) conds.push("s.cap_exempt = 1");
  if (!f.includeDebarred) conds.push("s.debarred = 0");
  return { where: [...conds, ...guards].join(" AND "), args };
}

const FROM = "FROM sponsor_jobs j JOIN sponsor_index s ON s.slug = j.slug";
const COLUMNS =
  "s.slug, s.name, s.state AS home_state, s.sector_label, s.cap_exempt, s.debarred, s.live_only, s.perm_recent, " +
  "s.pending_now, s.latest_filed, s.lca_24m, s.transfer_share, j.state, j.filed, j.certified, j.denied, " +
  "j.median_wage, j.median_days";

export function finderSql(
  f: FinderFilters,
  soc: string,
): { count: string; page: string; args: (string | number)[]; pageArgs: (string | number)[] } {
  const { where, args } = finderWhere(f, soc);
  return {
    count: `SELECT COUNT(*) AS n ${FROM} WHERE ${where}`,
    page: `SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY ${SORTS[f.sort].order}, s.slug LIMIT ? OFFSET ?`,
    args,
    pageArgs: [...args, PAGE_SIZE, (f.page - 1) * PAGE_SIZE],
  };
}
