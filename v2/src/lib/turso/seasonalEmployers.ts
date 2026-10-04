import "server-only";

import { one, rows } from "./client";
import { medianOffset } from "@/lib/employerPrograms";
import { seasonalForm } from "@/lib/seasonalForms";

/**
 * Employers that file H-2A, H-2B or CW-1 and have no other page.
 *
 * `seasonal_employer_index` is written nightly by
 * scripts/build_seasonal_employers.py: one row per employer slug in DOL's
 * seasonal records (the live `seasonal_case_status` and the published
 * `seasonal_cases`) that resolves to no published, aliased or live-only PERM
 * employer. The employer page renders these after both other lookups miss, and
 * the sitemap lists every row through rank windows.
 *
 * Every read here keys on the EXACT slug, on `seasonal_case_status_emp
 * (employer_slug, filing_date)` and `seasonal_cases_emp (employer_slug,
 * received_date)`. Not a prefix range: `acme` would also catch
 * `acme-farms-llc`, a different employer.
 *
 * A missing table (before the first nightly build) reads as "no such
 * employer", so an unknown slug stays a 404 rather than a 500. Any other
 * failure throws: swallowing it would turn a real employer into a 404.
 */

export interface SeasonalEmployerRecord {
  slug: string;
  name: string;
  cases: number;
  h2a: number;
  h2b: number;
  cw1: number;
  firstFiled: string | null;
  lastChanged: string | null;
}

const isMissingTable = (e: unknown) => /no such table/i.test(String(e));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

export async function seasonalEmployerRecord(slug: string): Promise<SeasonalEmployerRecord | null> {
  if (!slug || slug.length > 80) return null;
  let r: Record<string, unknown> | null;
  try {
    r = await one<Record<string, unknown>>(
      "SELECT slug, name, cases, h2a, h2b, cw1, first_filed, last_changed FROM seasonal_employer_index WHERE slug = ?",
      [slug],
    );
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
  if (!r) return null;
  return {
    slug: String(r.slug),
    name: String(r.name),
    cases: num(r.cases),
    h2a: num(r.h2a),
    h2b: num(r.h2b),
    cw1: num(r.cw1),
    firstFiled: str(r.first_filed),
    lastChanged: str(r.last_changed),
  };
}

/** One of the employer's cases, the live status beside what DOL published. */
export interface SeasonalEmployerCase {
  caseNumber: string;
  form: string | null;
  status: string;
  isFinal: boolean;
  /** "live" when DOL's live status answered for it; "file" when only a quarterly file holds it. */
  source: "live" | "file";
  filed: string | null;
  decided: string | null;
  jobTitle: string | null;
  workers: number | null;
  workersCertified: number | null;
  wage: number | null;
  wageUnit: string | null;
  worksiteCity: string | null;
  worksiteState: string | null;
}

export interface SeasonalEmployerFigures {
  /** Decided cases in DOL's quarterly files. */
  published: number;
  /** Cases DOL's live status still shows open. */
  pending: number;
  workersCertified: number | null;
  /** The median hourly wage offered, over published rows paid by the hour ($5 to $200). */
  medianHourlyWage: number | null;
  hourlyN: number;
}

/**
 * The employer's newest cases, `limit` of them, with `more` when there are
 * others. The live row carries the status; the published row adds the
 * decision, the wage and the workers. A case only the file holds is listed
 * from the file.
 */
export async function seasonalEmployerCases(
  slug: string,
  limit: number,
): Promise<{ cases: SeasonalEmployerCase[]; more: boolean }> {
  const [live, file] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT case_number, current_status, is_final, filing_date, job_title
         FROM seasonal_case_status INDEXED BY seasonal_case_status_emp
        WHERE employer_slug = ? ORDER BY filing_date DESC LIMIT ?`,
      [slug, limit + 1],
    ),
    rows<Record<string, unknown>>(
      `SELECT case_number, case_status, received_date, decision_date, job_title, workers,
              workers_certified, wage, wage_unit, worksite_city, worksite_state
         FROM seasonal_cases INDEXED BY seasonal_cases_emp
        WHERE employer_slug = ? ORDER BY received_date DESC LIMIT ?`,
      [slug, limit + 1],
    ).catch((e: unknown) => {
      if (isMissingTable(e)) return [];
      throw e;
    }),
  ]);
  const byNumber = new Map<string, SeasonalEmployerCase>();
  for (const f of file) {
    const cn = String(f.case_number);
    byNumber.set(cn, {
      caseNumber: cn,
      form: seasonalForm(cn)?.label ?? null,
      status: String(f.case_status ?? ""),
      isFinal: true,
      source: "file",
      filed: str(f.received_date)?.slice(0, 10) ?? null,
      decided: str(f.decision_date)?.slice(0, 10) ?? null,
      jobTitle: str(f.job_title),
      workers: f.workers == null ? null : num(f.workers),
      workersCertified: f.workers_certified == null ? null : num(f.workers_certified),
      wage: f.wage == null ? null : num(f.wage),
      wageUnit: str(f.wage_unit),
      worksiteCity: str(f.worksite_city),
      worksiteState: str(f.worksite_state),
    });
  }
  for (const l of live) {
    const cn = String(l.case_number);
    const held = byNumber.get(cn);
    const status = String(l.current_status ?? "");
    const isFinal = num(l.is_final) === 1;
    if (held) {
      byNumber.set(cn, { ...held, status, isFinal, source: "live" });
    } else {
      byNumber.set(cn, {
        caseNumber: cn,
        form: seasonalForm(cn)?.label ?? null,
        status,
        isFinal,
        source: "live",
        filed: str(l.filing_date)?.slice(0, 10) ?? null,
        decided: null,
        jobTitle: str(l.job_title),
        workers: null,
        workersCertified: null,
        wage: null,
        wageUnit: null,
        worksiteCity: null,
        worksiteState: null,
      });
    }
  }
  // Newest filing first; the case number breaks a tie the same way every time.
  const key = (c: SeasonalEmployerCase) => `${c.filed ?? ""} ${c.caseNumber}`;
  const all = [...byNumber.values()].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
  return { cases: all.slice(0, limit), more: all.length > limit || live.length > limit || file.length > limit };
}

/** An hourly wage outside this range is a typo or another unit, not a seasonal wage. */
const MIN_HOURLY = 5;
const MAX_HOURLY = 200;

export async function seasonalEmployerFigures(slug: string): Promise<SeasonalEmployerFigures> {
  const hourly = "wage_unit IN ('HOUR', 'HOURLY') AND wage BETWEEN ? AND ?";
  const [counts, live] = await Promise.all([
    one<Record<string, unknown>>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN ${hourly} THEN 1 ELSE 0 END) AS hourly_n,
              SUM(workers_certified) AS certified
         FROM seasonal_cases INDEXED BY seasonal_cases_emp WHERE employer_slug = ?`,
      [MIN_HOURLY, MAX_HOURLY, slug],
    ).catch((e: unknown) => {
      if (isMissingTable(e)) return null;
      throw e;
    }),
    one<Record<string, unknown>>(
      `SELECT SUM(CASE WHEN is_final = 0 THEN 1 ELSE 0 END) AS pending
         FROM seasonal_case_status INDEXED BY seasonal_case_status_emp WHERE employer_slug = ?`,
      [slug],
    ),
  ]);
  const hourlyN = num(counts?.hourly_n);
  let median: number | null = null;
  if (hourlyN > 0) {
    const mid = await one<{ wage: unknown }>(
      `SELECT wage FROM seasonal_cases INDEXED BY seasonal_cases_emp
        WHERE employer_slug = ? AND ${hourly} ORDER BY wage LIMIT 1 OFFSET ?`,
      [slug, MIN_HOURLY, MAX_HOURLY, medianOffset(hourlyN)],
    );
    median = mid ? num(mid.wage) : null;
  }
  return {
    published: num(counts?.n),
    pending: num(live?.pending),
    workersCertified: counts?.certified == null ? null : num(counts.certified),
    medianHourlyWage: median,
    hourlyN,
  };
}

/** The seasonal-only employers, for the `seasonal-employer-N.xml` sitemap children. */
export async function getSeasonalEmployerSlugWindow(
  chunk: number,
  size: number,
): Promise<{ slug: string; lastChanged: string | null }[]> {
  const lo = chunk * size;
  const found = await rows<{ slug: string; last_changed: string | null }>(
    "SELECT slug, last_changed FROM seasonal_employer_index WHERE rank > ? AND rank <= ? ORDER BY rank",
    [lo, lo + size],
  );
  return found.map((r) => ({ slug: r.slug, lastChanged: r.last_changed ?? null }));
}

export async function countSeasonalEmployerRanks(): Promise<number> {
  const r = await one<{ n: number }>("SELECT max(rank) AS n FROM seasonal_employer_index");
  return num(r?.n);
}
