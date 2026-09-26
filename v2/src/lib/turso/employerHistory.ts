import "server-only";

import { rows } from "./client";

/**
 * An employer's PERM record year by year, FY2008 onward, and its decided
 * cases from FY2020 to FY2023.
 *
 * Both tables are written by `scripts/ingest_perm_history.py`:
 * `perm_employer_years` from DOL's closed-year files (and FY2024 onward from
 * `perm_cases` after every load), `perm_cases_history` for FY2020 to FY2023.
 * A name that no longer matches today's page (a company renamed, a spelling
 * the merge does not join) is simply not in the series, which is why the
 * chart says "matched to this page" rather than "every filing".
 */

export interface EmployerYear {
  fy: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

export interface HistoryCase {
  caseNumber: string;
  status: string;
  decisionDate: string | null;
  jobTitle: string | null;
  state: string | null;
  wage: number | null;
}

/** Every year this employer has, oldest first. Empty when the table is absent. */
export async function employerYears(slug: string): Promise<EmployerYear[]> {
  const got = await rows<{ fy: number; certified: number; denied: number; withdrawn: number }>(
    "SELECT fy, certified, denied, withdrawn FROM perm_employer_years WHERE slug = ? ORDER BY fy",
    [slug],
  ).catch(() => []);
  return got.map((r) => ({
    fy: Number(r.fy),
    certified: Number(r.certified),
    denied: Number(r.denied),
    withdrawn: Number(r.withdrawn),
  }));
}

/** The newest decided cases from FY2020 to FY2023, off (employer_slug, decision_date). */
export async function employerHistoryCases(slug: string, limit = 25): Promise<HistoryCase[]> {
  const got = await rows<{
    case_number: string;
    status: string;
    decision_date: string | null;
    job_title: string | null;
    state: string | null;
    wage: number | null;
  }>(
    "SELECT case_number, status, decision_date, job_title, state, wage FROM perm_cases_history "
      + "WHERE employer_slug = ? ORDER BY decision_date DESC LIMIT ?",
    [slug, limit],
  ).catch(() => []);
  return got.map((r) => ({
    caseNumber: r.case_number,
    status: r.status,
    decisionDate: r.decision_date,
    jobTitle: r.job_title,
    state: r.state,
    wage: r.wage == null ? null : Number(r.wage),
  }));
}
