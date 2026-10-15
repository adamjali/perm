import "server-only";

import { seasonalForm } from "@/lib/seasonalForms";

import { rows } from "./client";
import type { EmployerMatch } from "./employerSlugs";

/**
 * One employer's H-2A, H-2B and CW-1 cases, for its page: the live status
 * beside what DOL's quarterly file printed.
 *
 * Every read keys on the employer's own spellings (`employerMatch`, from the
 * nightly employer_page_map), on `seasonal_case_status_emp (employer_slug,
 * filing_date)` and `seasonal_cases_emp (employer_slug, received_date)`.
 * Never a prefix range: `acme` would also catch `acme-farms-llc`, a
 * different employer.
 */

const isMissingTable = (e: unknown) => /no such table/i.test(String(e));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

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

/**
 * The employer's newest cases, `limit` of them, with `more` when there are
 * others. The live row carries the status; the published row adds the
 * decision, the wage and the workers. A case only the file holds is listed
 * from the file.
 */
export async function seasonalEmployerCases(
  match: Pick<EmployerMatch, "where" | "args">,
  limit: number,
): Promise<{ cases: SeasonalEmployerCase[]; more: boolean }> {
  const [live, file] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT case_number, current_status, is_final, filing_date, job_title
         FROM seasonal_case_status INDEXED BY seasonal_case_status_emp
        WHERE ${match.where} ORDER BY filing_date DESC LIMIT ?`,
      [...match.args, limit + 1],
    ),
    rows<Record<string, unknown>>(
      `SELECT case_number, case_status, received_date, decision_date, job_title, workers,
              workers_certified, wage, wage_unit, worksite_city, worksite_state
         FROM seasonal_cases INDEXED BY seasonal_cases_emp
        WHERE ${match.where} ORDER BY received_date DESC LIMIT ?`,
      [...match.args, limit + 1],
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
