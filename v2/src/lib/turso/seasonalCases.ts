import "server-only";
import { one } from "./client";
import { makeFlagProgram, parseDisclosureSummaryDoc, type FlagDisclosureSummary } from "./flagCases";

/**
 * The temporary-labor programs on DOL's FLAG counter: H-2A applications
 * (`H-300-`, ETA-9142A), H-2B applications (`H-400-`, ETA-9142B) and H-2B
 * prevailing wage requests (`P-400-`), and CW-1 prevailing wage requests
 * (`P-500-`, the Northern Mariana Islands' program). Same endpoint and same serial counter
 * as PERM, PWD and LCA, and the same factory as the PWD and LCA programs.
 *
 * `P-400-` is kept out of the PWD program on purpose: the PWD pages describe
 * the ETA-9141 queue PERM and H-1B wait in, and an H-2B wage request runs
 * through a different one.
 */

/** Must stay identical to PROGRAMS["seasonal"]["final"] in scripts/ingest_pwd_status_direct.py. */
export const SEASONAL_FINAL_STATUSES: ReadonlySet<string> = new Set([
  "FULL CERTIFICATION",
  "FULL CERTIFICATION - EXPIRED",
  "FULL CERTIFICATION - WITHDRAWN",
  "PARTIAL CERTIFICATION",
  "PARTIAL CERTIFICATION - EXPIRED",
  "PARTIAL CERTIFICATION - WITHDRAWN",
  "DENIED",
  "WITHDRAWN",
  "DETERMINATION ISSUED",
  "REDETERMINATION AFFIRMED",
  "REDETERMINATION MODIFIED",
  "RETURNED UNPROCESSED",
  "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
  "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
  "BALCA OVERTURNED",
  // An H-2A job order's own decision (JO-A-300).
  "APPROVED",
  // A rejection: every NOR case DOL's H-2B and CW-1 files hold (547 of 547,
  // filed Oct 2024 to May 2026) reads "DETERMINATION ISSUED - REJECTED".
  "NOR ISSUED",
]);

export const seasonal = makeFlagProgram({
  key: "seasonal",
  table: "seasonal_case_status",
  numberRe: /^(?:H-300|H-400|P-400|P-500|JO-A-300|C-500)-\d{5}-\d+$/,
  finalStatuses: SEASONAL_FINAL_STATUSES,
  docKey: "seasonal_live_summary",
  discoverySource: "flag.dol.gov/recaptcha/caseStatus (DOL, via lookup)",
  budgetPrefix: "seasonal_discovery_budget_",
  // DOL's quarterly H-2A, H-2B and CW-1 files, in one table (the visa on each
  // row), loaded by scripts/ingest_flag_disclosure.py: the decided record with
  // the wage, the workers and the work period.
  disclosureTable: "seasonal_cases",
});

export const normaliseSeasonalCaseNumber = seasonal.normalise;
export const isSeasonalCaseNumber = seasonal.isNumber;
export const lookupSeasonalCase = seasonal.lookup;
export const lookupSeasonalCaseOutcome = seasonal.lookupOutcome;
export const searchSeasonalCases = seasonal.search;
export const listSeasonalCases = seasonal.list;
export const getSeasonalSummary = seasonal.getSummary;

export { SEASONAL_FORMS, seasonalForm } from "@/lib/seasonalForms";

/**
 * DOL's published record of one seasonal case: its quarterly file's row.
 *
 * The H-2A, H-2B and CW-1 applications (`H-300-`, `H-400-`, `C-500-`) are in
 * `seasonal_cases`, with the workers and the work period; the H-2B and CW-1
 * wage requests (`P-400-`, `P-500-`) are in DOL's prevailing wage file
 * (`pwd_cases`), which has the wage and neither of those. A job order
 * (`JO-A-300-`) has no published file. Null when the case is not published or
 * the table is not there.
 */
export interface SeasonalRecord {
  caseNumber: string;
  status: string;
  receivedDate: string | null;
  decisionDate: string | null;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  socTitle: string | null;
  wage: number | null;
  wageUnit: string | null;
  workers: number | null;
  workersCertified: number | null;
  beginDate: string | null;
  endDate: string | null;
  worksiteCity: string | null;
  worksiteCounty: string | null;
  worksiteState: string | null;
  attorneyName: string | null;
  visaClass: string | null;
  sourceFile: string | null;
}

type RecordRow = Record<string, string | number | null>;

const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const BASE_COLS =
  "case_number, case_status, received_date, decision_date, employer_name, employer_slug, job_title, " +
  "soc_title, wage, wage_unit, worksite_city, worksite_state, attorney_name, visa_class, source_file";

export async function lookupSeasonalRecord(caseNumber: string): Promise<SeasonalRecord | null> {
  const cn = normaliseSeasonalCaseNumber(caseNumber);
  if (!cn) return null;
  const application = /^(?:H-300|H-400|C-500)-/.test(cn);
  const wageRequest = /^P-(?:400|500)-/.test(cn);
  if (!application && !wageRequest) return null;
  const r = application
    ? await one<RecordRow>(
        `SELECT ${BASE_COLS}, workers, workers_certified, begin_date, end_date, worksite_county ` +
          "FROM seasonal_cases WHERE case_number = ?",
        [cn],
      ).catch(() => null)
    : await one<RecordRow>(`SELECT ${BASE_COLS} FROM pwd_cases WHERE case_number = ?`, [cn]).catch(() => null);
  if (!r) return null;
  return {
    caseNumber: String(r.case_number),
    status: String(r.case_status ?? ""),
    receivedDate: str(r.received_date),
    decisionDate: str(r.decision_date),
    employerName: str(r.employer_name),
    employerSlug: str(r.employer_slug),
    jobTitle: str(r.job_title),
    socTitle: str(r.soc_title),
    wage: num(r.wage),
    wageUnit: str(r.wage_unit),
    workers: num(r.workers),
    workersCertified: num(r.workers_certified),
    beginDate: str(r.begin_date),
    endDate: str(r.end_date),
    worksiteCity: str(r.worksite_city),
    worksiteCounty: str(r.worksite_county),
    worksiteState: str(r.worksite_state),
    attorneyName: str(r.attorney_name),
    visaClass: str(r.visa_class),
    sourceFile: str(r.source_file),
  };
}

/**
 * The job as DOL accepted it, from SeasonalJobs.dol.gov's daily feed
 * (`seasonal_postings`, scripts/ingest_seasonal_jobs.py): what the live
 * status never says (the wage, the workers, the period, where), for an H-2A
 * or H-2B application or an H-2A job order DOL has accepted. Null when the
 * case was never in the feed (the feed began Feb 25 2024) or the table is not
 * there.
 */
export interface SeasonalPosting {
  caseNumber: string;
  feed: string;
  employerName: string | null;
  jobTitle: string | null;
  workers: number | null;
  workersForeign: number | null;
  beginDate: string | null;
  endDate: string | null;
  wage: number | null;
  wageUnit: string | null;
  worksiteCity: string | null;
  worksiteCounty: string | null;
  worksiteState: string | null;
  jobOrderNumber: string | null;
  pwdNumber: string | null;
  submittedDate: string | null;
  acceptedDate: string | null;
}

export async function lookupSeasonalPosting(caseNumber: string): Promise<SeasonalPosting | null> {
  const cn = normaliseSeasonalCaseNumber(caseNumber);
  if (!cn || !/^(?:H-300|H-400|JO-A-300)-/.test(cn)) return null;
  const r = await one<RecordRow>(
    "SELECT case_number, feed, employer_name, job_title, workers, workers_foreign, begin_date, end_date, wage, wage_unit, " +
      "worksite_city, worksite_county, worksite_state, job_order_number, pwd_number, submitted_date, accepted_date " +
      "FROM seasonal_postings WHERE case_number = ?",
    [cn],
  ).catch(() => null);
  if (!r) return null;
  return {
    caseNumber: String(r.case_number),
    feed: String(r.feed ?? ""),
    employerName: str(r.employer_name),
    jobTitle: str(r.job_title),
    workers: num(r.workers),
    workersForeign: num(r.workers_foreign),
    beginDate: str(r.begin_date),
    endDate: str(r.end_date),
    wage: num(r.wage),
    wageUnit: str(r.wage_unit),
    worksiteCity: str(r.worksite_city),
    worksiteCounty: str(r.worksite_county),
    worksiteState: str(r.worksite_state),
    jobOrderNumber: str(r.job_order_number),
    pwdNumber: str(r.pwd_number),
    submittedDate: str(r.submitted_date),
    acceptedDate: str(r.accepted_date),
  };
}

/**
 * What DOL's quarterly H-2A, H-2B and CW-1 files hold, one summary per visa:
 * the ingest writes `flag_disclosure_summary_<program>` after every load,
 * each counting only its own visa's rows in the shared table. A visa whose
 * file isn't loaded is simply absent.
 */
export async function getSeasonalPublishedSummary(): Promise<
  { visa: "H-2A" | "H-2B" | "CW-1"; summary: FlagDisclosureSummary }[]
> {
  const keys = [
    ["H-2A", "flag_disclosure_summary_h2a"],
    ["H-2B", "flag_disclosure_summary_h2b"],
    ["CW-1", "flag_disclosure_summary_cw1"],
  ] as const;
  const found = await Promise.all(
    keys.map(async ([visa, key]) => {
      const r = await one<{ json: string; computed_at: number }>(
        "SELECT json, computed_at FROM perm_docs WHERE key = ?",
        [key],
      ).catch(() => null);
      const summary = r ? parseDisclosureSummaryDoc(String(r.json), Number(r.computed_at)) : null;
      return summary && summary.rows > 0 ? { visa, summary } : null;
    }),
  );
  return found.filter((x): x is { visa: "H-2A" | "H-2B" | "CW-1"; summary: FlagDisclosureSummary } => !!x);
}
