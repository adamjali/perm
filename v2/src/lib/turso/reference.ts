import "server-only";

import { cache } from "react";

import { one, rows } from "./client";

/**
 * The reference data beside the PERM record: what a job is (O*NET), what it
 * pays in the market (BLS OEWS) and where it's heading (BLS projections), the
 * prevailing wage tables DOL sets wages from (every wage year since 2021-22),
 * where a city sits (Census), what prices are there (BEA) and how many
 * immigrant visas State issued abroad.
 *
 * Every table here is loaded by a script in scripts/ingest_*.py. A read that
 * fails or finds nothing returns null or [] and the section that wanted it
 * stays out: these are additions to pages that stand on their own.
 */

/** "15-1252.00" and "15-1252" are one occupation here. */
export function soc7(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().slice(0, 7);
  return /^\d{2}-\d{4}$/.test(c) ? c : null;
}

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/* ------------------------------------------------------------------ O*NET */

export interface OnetOccupation {
  code: string;
  title: string;
  description: string;
  jobZone: number | null;
  bright: string[];
  education: { level: string; pct: number }[];
  titles: string[];
  tasks: string[];
  related: { code: string; title: string }[];
}

export interface JobZone {
  name: string;
  education: string;
  experience: string;
}

export interface OnetForSoc {
  /** The `.00` occupation first: it's the SOC code's own, the rest are specialties. */
  occupations: OnetOccupation[];
  zones: Record<string, JobZone>;
  version: string | null;
}

type OnetRow = { onet_code: string; title: string; description: string; job_zone: unknown; bright: string | null; detail: string };

export const onetForSoc = cache(async (code: string): Promise<OnetForSoc | null> => {
  const soc = soc7(code);
  if (!soc) return null;
  const [got, ref] = await Promise.all([
    rows<OnetRow>(
      "SELECT onet_code, title, description, job_zone, bright, detail FROM onet_occupations WHERE soc7 = ? ORDER BY onet_code",
      [soc],
    ).catch(() => []),
    one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'onet_reference'").catch(() => null),
  ]);
  if (!got.length) return null;
  const occupations = got.map((r): OnetOccupation => {
    let d: Partial<Pick<OnetOccupation, "education" | "titles" | "tasks" | "related">> = {};
    try {
      d = JSON.parse(String(r.detail));
    } catch {
      d = {};
    }
    return {
      code: r.onet_code,
      title: r.title,
      description: r.description,
      jobZone: num(r.job_zone),
      bright: r.bright ? r.bright.split(";").map((s) => s.trim()).filter(Boolean) : [],
      education: d.education ?? [],
      titles: d.titles ?? [],
      tasks: d.tasks ?? [],
      related: d.related ?? [],
    };
  });
  let zones: Record<string, JobZone> = {};
  let version: string | null = null;
  try {
    const doc = ref ? (JSON.parse(String(ref.json)) as { jobZones?: Record<string, JobZone>; version?: string }) : {};
    zones = doc.jobZones ?? {};
    version = doc.version ?? null;
  } catch {
    zones = {};
  }
  return { occupations, zones, version };
});

/* --------------------------------------------------------------- BLS OEWS */

export interface MarketPay {
  area: string;
  areaType: number;
  areaTitle: string;
  title: string;
  employment: number | null;
  mean: number | null;
  p10: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  /** Percentiles BLS printed as "#": at or above its top-coding ceiling. */
  topCoded: string[];
  annualOnly: boolean;
  series: string;
}

type OewsRow = Record<string, unknown>;

function marketPay(r: OewsRow): MarketPay {
  return {
    area: String(r.area),
    areaType: Number(r.area_type),
    areaTitle: String(r.area_title),
    title: String(r.title),
    employment: num(r.tot_emp),
    mean: num(r.a_mean),
    p10: num(r.a_p10),
    p25: num(r.a_p25),
    median: num(r.a_median),
    p75: num(r.a_p75),
    p90: num(r.a_p90),
    topCoded: r.top_coded ? String(r.top_coded).split(",") : [],
    annualOnly: Number(r.annual_only) === 1,
    series: String(r.series),
  };
}

const OEWS_COLS =
  "area, area_type, area_title, title, tot_emp, a_mean, a_p10, a_p25, a_median, a_p75, a_p90, top_coded, annual_only, series";

/** The occupation's national pay, BLS's area 99. */
export const marketPayNational = cache(async (code: string): Promise<MarketPay | null> => {
  const soc = soc7(code);
  if (!soc) return null;
  const r = await one<OewsRow>(`SELECT ${OEWS_COLS} FROM bls_oews WHERE soc7 = ? AND area = '99'`, [soc]).catch(() => null);
  return r ? marketPay(r) : null;
});

/** The occupation's pay in each of `areas` (OEWS area codes) that BLS published. */
export async function marketPayIn(code: string, areas: string[]): Promise<MarketPay[]> {
  const soc = soc7(code);
  const list = [...new Set(areas.filter((a) => /^\d{2,7}$/.test(a)))].slice(0, 40);
  if (!soc || !list.length) return [];
  const got = await rows<OewsRow>(
    `SELECT ${OEWS_COLS} FROM bls_oews WHERE soc7 = ? AND area IN (${list.map(() => "?").join(",")})`,
    [soc, ...list],
  ).catch(() => []);
  return got.map(marketPay);
}

export type MarketPayAt = MarketPay & { soc: string };

/** One area's pay for each of `codes`. */
export async function marketPayForArea(area: string, codes: string[]): Promise<MarketPayAt[]> {
  const socs = [...new Set(codes.map(soc7).filter((s): s is string => !!s))].slice(0, 40);
  if (!/^\d{2,7}$/.test(area) || !socs.length) return [];
  const got = await rows<OewsRow & { soc7: string }>(
    `SELECT soc7, ${OEWS_COLS} FROM bls_oews WHERE area = ? AND soc7 IN (${socs.map(() => "?").join(",")})`,
    [area, ...socs],
  ).catch(() => []);
  return got.map((r) => ({ ...marketPay(r), soc: String(r.soc7) }));
}

/* -------------------------------------------------------- BLS projections */

export interface Projection {
  title: string;
  baseYear: number;
  projYear: number;
  /** Thousands of jobs, as BLS publishes them. */
  empBase: number | null;
  empProj: number | null;
  changePct: number | null;
  /** Thousands of openings a year. */
  openings: number | null;
  medianWage: number | null;
  education: string | null;
  experience: string | null;
  training: string | null;
}

export const projectionFor = cache(async (code: string): Promise<Projection | null> => {
  const soc = soc7(code);
  if (!soc) return null;
  const r = await one<Record<string, unknown>>(
    "SELECT title, base_year, proj_year, emp_base, emp_proj, change_pct, openings, median_wage, education, experience, training FROM bls_projections WHERE soc7 = ?",
    [soc],
  ).catch(() => null);
  if (!r) return null;
  const text = (v: unknown) => (v == null || v === "" ? null : String(v));
  return {
    title: String(r.title),
    baseYear: Number(r.base_year),
    projYear: Number(r.proj_year),
    empBase: num(r.emp_base),
    empProj: num(r.emp_proj),
    changePct: num(r.change_pct),
    openings: num(r.openings),
    medianWage: num(r.median_wage),
    education: text(r.education),
    experience: text(r.experience),
    training: text(r.training),
  };
});

/* ------------------------------------------------- DOL's prevailing wages */

export interface DolBasis {
  wageYear: number;
  jobZone: string | null;
  education: string | null;
  /** null when that year's files carry no Appendix A list (before 2024-25). */
  appendixA: boolean | null;
}

/** DOL's Job Zone and education for the occupation's own O*NET code, newest wage year. */
export const dolBasisFor = cache(async (code: string): Promise<DolBasis | null> => {
  const soc = soc7(code);
  if (!soc) return null;
  const r = await one<Record<string, unknown>>(
    "SELECT wage_year, job_zone, education, appendix_a FROM oflc_occupation_basis WHERE soc7 = ? ORDER BY wage_year DESC, onet_code LIMIT 1",
    [soc],
  ).catch(() => null);
  if (!r) return null;
  return {
    wageYear: Number(r.wage_year),
    jobZone: r.job_zone == null ? null : String(r.job_zone),
    education: r.education == null ? null : String(r.education),
    appendixA: r.appendix_a == null ? null : Number(r.appendix_a) === 1,
  };
});

export interface WageLevelYear {
  wageYear: number;
  /** As DOL publishes them: hourly, or yearly when `annual`. */
  levels: [number | null, number | null, number | null, number | null];
  /** True when DOL labels the row "Annual Wage": its levels are already yearly. */
  annual: boolean;
  /** Each level as a yearly amount, whichever way DOL published it. */
  yearly: (number | null)[];
  label: string | null;
}

/** "2026-27" for the year that opened in July 2026. */
export function wageYearLabel(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** DOL counts a wage year as 2,080 hours. */
export const HOURS_PER_YEAR = 2080;

/**
 * DOL's label on a row whose four levels are yearly amounts. Teachers,
 * professors, pilots and athletes are published that way; multiplying their
 * levels by 2,080 turned a $139,960 pilot's wage into $291 million.
 */
export const ANNUAL_LABEL = "Annual Wage";

/**
 * DOL's 2021-22 and 2022-23 files have no label column, and about 60,000 rows
 * a year in them are yearly amounts all the same. Measured over every year
 * held: no hourly level passes $807 and no yearly one falls under $15,080, so
 * an unlabelled level at or over this is yearly.
 */
export const YEARLY_FLOOR = 5000;

/** Whether a row's levels are yearly amounts: DOL says so, or an unlabelled row's figures can only be. */
export function isAnnual(levels: (number | null)[], label: string | null): boolean {
  if (label === ANNUAL_LABEL) return true;
  return label == null && levels.some((v) => v != null && v >= YEARLY_FLOOR);
}

/** Four levels as yearly amounts: as published when the row is yearly, else hourly x 2,080. */
export function toYearly(levels: (number | null)[], label: string | null): (number | null)[] {
  const annual = isAnnual(levels, label);
  return levels.map((v) => (v == null ? null : Math.round(annual ? v : v * HOURS_PER_YEAR)));
}

function levelYear(r: Record<string, unknown>): WageLevelYear {
  const label = r.label == null || r.label === "" ? null : String(r.label);
  const levels: WageLevelYear["levels"] = [num(r.l1), num(r.l2), num(r.l3), num(r.l4)];
  return { wageYear: Number(r.wage_year), levels, annual: isAnnual(levels, label), yearly: toYearly(levels, label), label };
}

/** One occupation's four levels in one area, every wage year held, oldest first. */
export async function wageLevelHistory(code: string, area: string, collection: "alc" | "edc" = "alc"): Promise<WageLevelYear[]> {
  const soc = soc7(code);
  if (!soc || !/^\d{2,7}$/.test(area)) return [];
  const got = await rows<Record<string, unknown>>(
    "SELECT wage_year, l1, l2, l3, l4, label FROM oflc_wage_levels WHERE soc7 = ? AND area = ? AND collection = ? ORDER BY wage_year",
    [soc, area, collection],
  ).catch(() => []);
  return got.map(levelYear);
}

/** The newest wage year's four levels for each of `codes` in one area. */
export async function wageLevelsForArea(area: string, codes: string[]): Promise<(WageLevelYear & { soc: string })[]> {
  const socs = [...new Set(codes.map(soc7).filter((s): s is string => !!s))].slice(0, 40);
  if (!/^\d{2,7}$/.test(area) || !socs.length) return [];
  const got = await rows<Record<string, unknown>>(
    `SELECT soc7, wage_year, l1, l2, l3, l4, label FROM oflc_wage_levels
     WHERE area = ? AND collection = 'alc' AND soc7 IN (${socs.map(() => "?").join(",")})
       AND wage_year = (SELECT max(wage_year) FROM oflc_wage_levels)`,
    [area, ...socs],
  ).catch(() => []);
  return got.map((r) => ({ soc: String(r.soc7), ...levelYear(r) }));
}

/* ------------------------------------------------------------ Census, BEA */

export interface CityGeo {
  placeName: string | null;
  lat: number | null;
  lon: number | null;
  countyName: string | null;
  /** single | nearest | nearest-in-state: how the county was chosen. */
  countyBasis: string | null;
  cbsa: string | null;
  cbsaTitle: string | null;
  cbsaType: string | null;
  wageArea: string | null;
  wageAreaName: string | null;
  wageYear: number | null;
  /** Every current county the place spans, when it spans several; null for one. */
  counties: string[] | null;
  /** How many of DOL's wage areas those counties fall in; null for one county. */
  wageAreas: number | null;
}

/** A JSON list of county names, or null when absent or unreadable. */
function countyList(v: unknown): string[] | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const got = JSON.parse(v) as unknown;
    return Array.isArray(got) && got.length > 1 ? got.map(String) : null;
  } catch {
    return null;
  }
}

export const cityGeo = cache(async (cityKey: string): Promise<CityGeo | null> => {
  const r = await one<Record<string, unknown>>(
    // Every column, so a table loaded before `counties` and `wage_areas` were
    // added still answers (those read as unknown) instead of failing the query.
    "SELECT * FROM city_geo WHERE city_key = ?",
    [cityKey],
  ).catch(() => null);
  if (!r) return null;
  const text = (v: unknown) => (v == null || v === "" ? null : String(v));
  return {
    placeName: text(r.place_name),
    lat: num(r.lat),
    lon: num(r.lon),
    countyName: text(r.county_name),
    countyBasis: text(r.county_basis),
    cbsa: text(r.cbsa),
    cbsaTitle: text(r.cbsa_title),
    cbsaType: text(r.cbsa_type),
    wageArea: text(r.wage_area),
    wageAreaName: text(r.wage_area_name),
    wageYear: num(r.wage_year),
    counties: countyList(r.counties),
    wageAreas: num(r.wage_areas),
  };
});

/** Many cities at once: city key -> its geography. */
export async function cityGeoMany(cityKeys: string[]): Promise<Map<string, CityGeo>> {
  const keys = [...new Set(cityKeys)].slice(0, 60);
  const out = new Map<string, CityGeo>();
  if (!keys.length) return out;
  const got = await rows<Record<string, unknown>>(
    `SELECT city_key, place_name, county_name, cbsa, cbsa_title, wage_area, wage_area_name FROM city_geo WHERE city_key IN (${keys.map(() => "?").join(",")})`,
    keys,
  ).catch(() => []);
  for (const r of got) {
    out.set(String(r.city_key), {
      placeName: r.place_name == null ? null : String(r.place_name),
      lat: null,
      lon: null,
      countyName: r.county_name == null ? null : String(r.county_name),
      countyBasis: null,
      cbsa: r.cbsa == null ? null : String(r.cbsa),
      cbsaTitle: r.cbsa_title == null ? null : String(r.cbsa_title),
      cbsaType: null,
      wageArea: r.wage_area == null ? null : String(r.wage_area),
      wageAreaName: r.wage_area_name == null ? null : String(r.wage_area_name),
      wageYear: null,
      counties: null,
      wageAreas: null,
    });
  }
  return out;
}

export interface PriceParity {
  year: number;
  name: string;
  all: number | null;
  goods: number | null;
  housing: number | null;
  utilities: number | null;
  other: number | null;
}

/** BEA's newest price parities for a metro (its CBSA code) or a state (its FIPS + "000"). */
export const priceParity = cache(async (fips: string): Promise<PriceParity | null> => {
  if (!/^\d{5}$/.test(fips)) return null;
  const got = await rows<{ year: unknown; line: string; value: unknown; geo_name: string }>(
    "SELECT year, line, value, geo_name FROM bea_rpp WHERE geo_fips = ? AND year = (SELECT max(year) FROM bea_rpp WHERE geo_fips = ?)",
    [fips, fips],
  ).catch(() => []);
  const first = got[0];
  if (!first) return null;
  const v = Object.fromEntries(got.map((r) => [r.line, num(r.value)]));
  return {
    year: Number(first.year),
    name: first.geo_name,
    all: v.all ?? null,
    goods: v.goods ?? null,
    housing: v.housing ?? null,
    utilities: v.utilities ?? null,
    other: v.other ?? null,
  };
});

/** Our occupation page for each SOC code that has one: soc7 -> slug (the busiest row). */
export async function occupationSlugs(codes: string[]): Promise<Map<string, string>> {
  const socs = [...new Set(codes.map(soc7).filter((s): s is string => !!s))].slice(0, 40);
  const out = new Map<string, string>();
  if (!socs.length) return out;
  const got = await rows<{ soc: string; slug: string }>(
    `SELECT substr(code, 1, 7) AS soc, slug FROM perm_entities
     WHERE kind = 'occupation' AND substr(code, 1, 7) IN (${socs.map(() => "?").join(",")})
     ORDER BY total DESC`,
    socs,
  ).catch(() => []);
  for (const r of got) if (!out.has(r.soc)) out.set(r.soc, r.slug);
  return out;
}
