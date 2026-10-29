/**
 * OFLC's prevailing wage levels, read live from DOL's own wage search.
 *
 * The FLAG wage search posts to `/recaptcha/wageSearch` (the same path family
 * as the case-status search, which this site measured to be an open endpoint
 * with no captcha in the flow) and answers with the four OEWS levels for one
 * occupation in one area for one data-series year. This module holds the
 * request shape, the response parser and the validators; the route in
 * `src/app/api/wage-levels` does the fetching and the caching, and the tool
 * page renders it. Nothing here is computed by us: every dollar figure is
 * DOL's, printed with the series it belongs to.
 */

import { socGroup } from "@/lib/socCode";

export const WAGE_SEARCH_URL = "https://flag.dol.gov/recaptcha/wageSearch";
export const AREA_OPTIONS_URL = "https://flag.dol.gov/flag/api/getAreaOptions";
export const WAGE_SEARCH_PAGE = "https://flag.dol.gov/wage-data/wage-search";

/** BLS area codes are numeric, up to six digits. */
export const AREA_RE = /^\d{1,6}$/;

export interface WageLevel {
  level: "I" | "II" | "III" | "IV";
  hourly: number;
  yearly: number;
}

export interface WageLevelsResult {
  soc: string;
  area: number;
  /** The OEWS data series, by the July that opened it. */
  seriesYear: number;
  levels: WageLevel[];
  source: string;
}

/**
 * The series a given date falls in, named by the July that opened it: July
 * 2026 to June 2027 is `2026`. This is the site's name for a series, matching
 * DOL's own file names ("July 2026 Wage Year") and our stored tables.
 */
export function seriesYearFor(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 7 ? y : y - 1;
}

/**
 * The `year` DOL's live search takes for a series: the June that CLOSES it.
 * Measured Oct 5 2026 against DOL's own downloadable tables: year 2027 answers
 * with the July 2026 file's figures (pilots in Appleton, WI, Level I $139,960),
 * year 2026 with the 2025-26 file's ($53,310), for two occupations; the area
 * list follows the same rule (Connecticut's new area names arrive at 2026,
 * the year its 2025-26 file first carried them). Until this, the tool showed
 * last year's levels under this year's label.
 */
export function dolSearchYear(seriesYear: number): number {
  return seriesYear + 1;
}

/** The body DOL's search posts. `bls_area` is a metro or non-metro area; counties need a different type. */
export function wageSearchBody(soc: string, area: number, seriesYear: number): Record<string, unknown> {
  return { collectionType: "alc", year: dolSearchYear(seriesYear), socCode: socGroup(soc), area, areaType: "bls_area", rdFlag: "BOTH" };
}

/**
 * DOL's `{ rates: { I: { year, hour, ... }, ... } }`, narrowed. Every level
 * must be present and numeric; a level DOL prints as 0.00 means the search
 * matched nothing, and the caller treats that as no data rather than a wage.
 */
export function parseWageRates(json: unknown): WageLevel[] | null {
  if (typeof json !== "object" || json === null) return null;
  const rates = (json as { rates?: unknown }).rates;
  if (typeof rates !== "object" || rates === null) return null;
  const out: WageLevel[] = [];
  for (const level of ["I", "II", "III", "IV"] as const) {
    const r = (rates as Record<string, unknown>)[level];
    if (typeof r !== "object" || r === null) return null;
    const hourly = Number((r as { hour?: unknown }).hour);
    const yearly = Number((r as { year?: unknown }).year);
    if (!Number.isFinite(hourly) || !Number.isFinite(yearly)) return null;
    out.push({ level, hourly, yearly });
  }
  if (out.every((l) => l.hourly === 0 && l.yearly === 0)) return null;
  return out;
}

export interface AreaOption {
  value: number;
  label: string;
}

/** DOL's `{ areaOptions: [{ value, label }] }`, narrowed. */
export function parseAreaOptions(json: unknown): AreaOption[] {
  if (typeof json !== "object" || json === null) return [];
  const list = (json as { areaOptions?: unknown }).areaOptions;
  if (!Array.isArray(list)) return [];
  const out: AreaOption[] = [];
  for (const o of list) {
    if (typeof o !== "object" || o === null) continue;
    const v = Number((o as { value?: unknown }).value);
    const label = (o as { label?: unknown }).label;
    if (Number.isFinite(v) && typeof label === "string" && label.length > 0 && label.length < 120) out.push({ value: v, label });
  }
  return out;
}

/** How far a wage reaches up DOL's four levels: 0 below Level I, 4 at Level IV. */
export type LevelReached = 0 | 1 | 2 | 3 | 4;

/**
 * The highest of DOL's four levels a yearly wage meets or passes. A level is
 * reached at its own wage, as DOL sets a determination; a level DOL didn't
 * publish (a "High Wage" row's top levels) can't be reached, nor any above it.
 */
export function levelReached(yearly: readonly (number | null)[], wage: number): LevelReached {
  let reached = 0;
  for (let i = 0; i < 4; i++) {
    const v = yearly[i];
    if (v == null || wage < v) break;
    reached = i + 1;
  }
  return reached as LevelReached;
}

const LEVEL_NAMES = ["Below Level I", "Level I", "Level II", "Level III", "Level IV"] as const;

/** "Level III", or "Below Level I". */
export function levelName(n: LevelReached): (typeof LEVEL_NAMES)[number] {
  return LEVEL_NAMES[n];
}
