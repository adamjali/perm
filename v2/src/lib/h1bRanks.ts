import { slugify } from "@/lib/entitySlug";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * The busiest H-1B employers by fiscal year and state: the pure half of
 * /h1b-employers. scripts/build_h1b_ranks.py writes the rows and the summary
 * doc; this module reads them and decides what a view shows, so the page, its
 * API route and the browser all agree.
 *
 * Two sources rank the same employers two ways, and "state" means something
 * different for each, which is why a state view shows only the ranked
 * source's own figures:
 *
 * - DOL's certified H-1B LCAs (FY2020 on), by WORKSITE state;
 * - USCIS's H-1B approvals (FY2009 on), by the PETITIONER's state.
 */

export type H1bBasis = "lca" | "uscis";
export const NATION = "US";
export const LIST_SHOWN = 25;
export const TOP_SHARE = 10;

export interface H1bPlaceTotals {
  lcas: number;
  lcaEmployers: number;
  lcaTop10: number;
  positions: number;
  uscisAppr: number;
  uscisEmployers: number;
  uscisTop10: number;
  uscisNew: number;
}

export interface H1bYear {
  fy: number;
  /** The last decision day DOL's files hold for the year, or null with no LCA data. */
  lcaThrough: string | null;
  /** The last day USCIS's counts cover for the year, or null with no Data Hub year. */
  uscisThrough: string | null;
  places: Record<string, H1bPlaceTotals>;
}

export interface H1bSummary {
  /** Newest first. */
  years: H1bYear[];
  top: number;
}

export interface H1bRankRow {
  slug: string;
  linked: boolean;
  name: string;
  rankLca: number | null;
  rankUscis: number | null;
  lcas: number;
  positions: number;
  transfers: number;
  senior: number;
  leveled: number;
  wageMedian: number | null;
  uscisNew: number;
  uscisAppr: number;
  uscisDen: number;
  /** True when most of the year's LCAs declared the employer H-1B dependent. */
  dependent: boolean | null;
  willful: number;
  onHold: number;
  warn2y: number;
  debarred: boolean;
}

export interface H1bView {
  fy: number;
  state: string;
  by: H1bBasis;
  rows: H1bRankRow[];
  totals: H1bPlaceTotals | null;
}

const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** perm_docs['h1b_ranks_summary'], or null when it can't be read. */
export function parseH1bSummary(json: string): H1bSummary | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const yearsRaw = (raw as { years?: Record<string, unknown> } | null)?.years;
  if (!yearsRaw || typeof yearsRaw !== "object") return null;
  const years: H1bYear[] = [];
  for (const [key, v] of Object.entries(yearsRaw)) {
    const fy = Number(key);
    if (!Number.isInteger(fy) || !v || typeof v !== "object") continue;
    const y = v as { lcaThrough?: unknown; uscisThrough?: unknown; places?: Record<string, unknown> };
    const places: Record<string, H1bPlaceTotals> = {};
    for (const [p, t] of Object.entries(y.places ?? {})) {
      if (!t || typeof t !== "object") continue;
      const o = t as Record<string, unknown>;
      places[p] = {
        lcas: int(o.lcas),
        lcaEmployers: int(o.lcaEmployers),
        lcaTop10: int(o.lcaTop10),
        positions: int(o.positions),
        uscisAppr: int(o.uscisAppr),
        uscisEmployers: int(o.uscisEmployers),
        uscisTop10: int(o.uscisTop10),
        uscisNew: int(o.uscisNew),
      };
    }
    years.push({ fy, lcaThrough: date(y.lcaThrough), uscisThrough: date(y.uscisThrough), places });
  }
  if (years.length === 0) return null;
  years.sort((a, b) => b.fy - a.fy);
  return { years, top: int((raw as { top?: unknown }).top) || 100 };
}

/** The states with a page: any state the national default year ranks on either source. */
export function rankedStates(s: H1bSummary): string[] {
  const y = defaultYear(s);
  return Object.keys(y.places).filter(
    (code) => code !== NATION && code in US_STATE_NAMES && (hasBasis(y, "lca", code) || hasBasis(y, "uscis", code)),
  );
}

/** A fiscal year runs October 1 to September 30; FY2025 ends Sep 30 2025. */
export function yearComplete(y: H1bYear, by: H1bBasis): boolean {
  const through = by === "lca" ? y.lcaThrough : y.uscisThrough;
  return through !== null && through >= `${y.fy}-09-01`;
}

export function hasBasis(y: H1bYear | undefined, by: H1bBasis, state = NATION): boolean {
  const t = y?.places[state];
  return !!t && (by === "lca" ? t.lcas > 0 : t.uscisAppr > 0);
}

/**
 * The view a bare page opens on: the newest complete year DOL's LCAs cover for
 * the page's place, else the newest complete year USCIS's do. The browser gets
 * a summary holding only its own place, so the place is always passed.
 */
export function defaultYear(s: H1bSummary, state: string = NATION): H1bYear {
  return (
    s.years.find((y) => yearComplete(y, "lca") && hasBasis(y, "lca", state)) ??
    s.years.find((y) => yearComplete(y, "uscis") && hasBasis(y, "uscis", state)) ??
    s.years[0]!
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];
const monthOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "FY2025 (October 2024 to September 2025)", or "FY2026 so far (October 2025 to June 2026)". */
export function fyLabel(y: H1bYear, by: H1bBasis): string {
  const start = `October ${y.fy - 1}`;
  if (yearComplete(y, by)) return `FY${y.fy} (${start} to September ${y.fy})`;
  const through = by === "lca" ? y.lcaThrough : y.uscisThrough;
  return through ? `FY${y.fy} so far (${start} to ${monthOf(through)})` : `FY${y.fy}`;
}

/** The pick-list label: short, with "so far" on a year still in progress. */
export function fyShort(y: H1bYear, by: H1bBasis): string {
  return yearComplete(y, by) ? `FY${y.fy}` : `FY${y.fy} so far`;
}

/** "1 in 6" for a share under a half, else a whole percent. */
export function shareWords(part: number, whole: number): string {
  if (!(whole > 0) || part <= 0) return "none";
  const share = part / whole;
  if (share >= 0.5) return `${Math.round(share * 100)}%`;
  return `1 in ${Math.round(1 / share)}`;
}

/** The ranked list's three bands: the 10 busiest, the next ones listed, everyone else. */
export function concentration(rows: readonly H1bRankRow[], totals: H1bPlaceTotals, by: H1bBasis) {
  const value = (r: H1bRankRow) => (by === "lca" ? r.lcas : r.uscisAppr);
  const rank = (r: H1bRankRow) => (by === "lca" ? r.rankLca : r.rankUscis);
  const whole = by === "lca" ? totals.lcas : totals.uscisAppr;
  const employers = by === "lca" ? totals.lcaEmployers : totals.uscisEmployers;
  let top = 0;
  let next = 0;
  let listed = 0;
  for (const r of rows) {
    const k = rank(r);
    if (k === null) continue;
    listed += 1;
    if (k <= TOP_SHARE) top += value(r);
    else next += value(r);
  }
  const rest = Math.max(0, whole - top - next);
  return {
    whole,
    employers,
    top,
    next,
    rest,
    topCount: Math.min(TOP_SHARE, listed),
    nextCount: Math.max(0, listed - TOP_SHARE),
    restCount: Math.max(0, employers - listed),
  };
}

/** The rows a view lists, ranked by its basis. */
export function rankedRows(rows: readonly H1bRankRow[], by: H1bBasis): H1bRankRow[] {
  const rank = (r: H1bRankRow) => (by === "lca" ? r.rankLca : r.rankUscis);
  return rows.filter((r) => rank(r) !== null).sort((a, b) => rank(a)! - rank(b)!);
}

/** A willful-violator mark is shown only when most of the year's LCAs carry it. */
export const willfulShown = (r: H1bRankRow) => r.lcas > 0 && r.willful * 2 > r.lcas;

/** A state's address segment: "texas", "district-of-columbia". */
export function stateSlug(code: string): string {
  return slugify(US_STATE_NAMES[code.toUpperCase()] ?? code);
}

const FROM_SLUG: Record<string, string> = Object.fromEntries(
  Object.keys(US_STATE_NAMES).map((code) => [stateSlug(code), code]),
);

/** The two-letter code for an address segment, or null. */
export function stateFromSlug(slug: string): string | null {
  return FROM_SLUG[slug.toLowerCase()] ?? null;
}

/** "the whole country", or the state's name. */
export function placeName(state: string): string {
  return state === NATION ? "the whole country" : (US_STATE_NAMES[state] ?? state);
}

/** The view a URL asks for, given the years held. Unknown values fall back. */
export function parseView(
  params: URLSearchParams,
  s: H1bSummary,
  state: string = NATION,
): { year: H1bYear; by: H1bBasis; asked: boolean } {
  const fyAsked = Number(params.get("fy"));
  const year = s.years.find((y) => y.fy === fyAsked) ?? defaultYear(s, state);
  const byAsked = params.get("by");
  let by: H1bBasis = byAsked === "uscis" ? "uscis" : "lca";
  // A year DOL's LCA files don't reach opens on USCIS's ranking.
  if (by === "lca" && !hasBasis(year, "lca", state) && hasBasis(year, "uscis", state)) by = "uscis";
  return { year, by, asked: params.has("fy") || params.has("by") };
}

/** The query string for a view, empty for the default one. */
export function viewQuery(fy: number, by: H1bBasis, s: H1bSummary, state: string = NATION): string {
  const q = new URLSearchParams();
  if (fy !== defaultYear(s, state).fy) q.set("fy", String(fy));
  if (by !== "lca") q.set("by", by);
  const str = q.toString();
  return str ? `?${str}` : "";
}
