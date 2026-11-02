import "server-only";

import { dolDayOf } from "@/lib/dolDay";
import {
  lookaheadEnd,
  lookbackStart,
  mergePermCases,
  mergeWageRequests,
  permWindowStart,
  type EmployerPermCases,
  WAGE_REQUESTS_SHOWN,
  type EmployerWageRequests,
  type FileWageRow,
  type LiveWageRow,
} from "@/lib/employerWageRequests";

import { one, rows } from "./client";
import { employerMatch, pageForSpelling } from "./employerSlugs";

/** The statuses that carry an issued wage (lib/employerWageRequests.ts WAGE_ISSUED_RE), as SQL. */
const ISSUED_SQL = (col: string) =>
  `(${col} LIKE 'DETERMINATION ISSUED%' OR ${col} LIKE 'REDETERMINATION%' OR ${col} LIKE 'CENTER DIRECTOR REVIEW%')`;

/**
 * The day DOL decided each request, keyed by case number: DOL's published file first (a primary-key read),
 * then, for a request the file doesn't hold yet (it ends at the last quarter), the DOL day our sweep first saw
 * it final in the event log. A request with neither stays out of the map: its day isn't known.
 */
async function decidedDays(caseNumbers: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (caseNumbers.length === 0) return out;
  const marks = caseNumbers.map(() => "?").join(",");
  const published = await rows<{ case_number: string; decision_date: string | null }>(
    `SELECT case_number, decision_date FROM pwd_cases WHERE case_number IN (${marks})`,
    [...caseNumbers],
  );
  for (const r of published) if (r.decision_date) out.set(String(r.case_number), String(r.decision_date).slice(0, 10));
  const rest = caseNumbers.filter((c) => !out.has(c));
  if (rest.length === 0) return out;
  const seen = await rows<{ case_number: string; t: number | string | null }>(
    `SELECT case_number, MIN(changed_at) AS t FROM pwd_case_events
      WHERE case_number IN (${rest.map(() => "?").join(",")}) AND to_final = 1 GROUP BY case_number`,
    [...rest],
  );
  for (const r of seen) {
    const ms = Number(r.t);
    if (Number.isFinite(ms) && ms > 0) out.set(String(r.case_number), dolDayOf(ms));
  }
  return out;
}

/**
 * The employer's PERM wage requests for a pending PERM case's job (lib/employerWageRequests.ts says why these
 * and not "this case's"). Reads: the case's employer slug (two primary-key reads), the employer's spellings
 * (employer_page_map), then each wage-request table on its (employer_slug, date) index, filtered by job title.
 * Null when the case has no employer, title or filing date to go on; a failed read throws, and the page drops
 * the section.
 */
export async function getEmployerWageRequests(
  caseNumber: string,
  jobTitle: string | null,
  filingDate: string | null,
): Promise<EmployerWageRequests | null> {
  const title = (jobTitle ?? "").trim();
  const since = filingDate ? lookbackStart(filingDate) : null;
  if (!title || !filingDate || !since) return null;

  const slugRow =
    (await one<{ employer_slug: string | null }>("SELECT employer_slug FROM perm_live_recent WHERE case_number = ?", [caseNumber])) ??
    (await one<{ employer_slug: string | null }>("SELECT employer_slug FROM perm_cases WHERE case_number = ?", [caseNumber]));
  const slug = slugRow?.employer_slug ? String(slugRow.employer_slug) : null;
  if (!slug) return null;
  const page = (await pageForSpelling(slug))?.page ?? slug;
  const match = await employerMatch(page);
  if (!match) return null;

  const until = filingDate.slice(0, 10);
  const [live, file] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT case_number, current_status, filing_date, job_title FROM pwd_case_status
        WHERE ${match.where} AND filing_date >= ? AND filing_date <= ?
          AND upper(trim(job_title)) = upper(?) AND case_number LIKE 'P-100-%' AND ${ISSUED_SQL("current_status")}
        ORDER BY filing_date DESC LIMIT ?`,
      [...match.args, since, until, title, WAGE_REQUESTS_SHOWN * 3],
    ),
    rows<Record<string, unknown>>(
      `SELECT case_number, case_status, received_date, decision_date, job_title, wage, wage_unit FROM pwd_cases
        WHERE ${match.where} AND received_date >= ? AND received_date <= ?
          AND upper(trim(job_title)) = upper(?) AND case_number LIKE 'P-100-%' AND ${ISSUED_SQL("case_status")}
          AND (decision_date IS NULL OR decision_date <= ?)
        ORDER BY received_date DESC LIMIT ?`,
      [...match.args, since, until, title, until, WAGE_REQUESTS_SHOWN * 3],
    ),
  ]);
  const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inFile = new Set(file.map((r) => String(r.case_number)));
  const seen = await decidedDays(live.map((r) => String(r.case_number)).filter((c) => !inFile.has(c)));
  const liveRows: LiveWageRow[] = live.map((r) => ({
    caseNumber: String(r.case_number),
    status: text(r.current_status),
    filed: text(r.filing_date),
    jobTitle: text(r.job_title),
    decided: seen.get(String(r.case_number)) ?? null,
  }));
  const fileRows: FileWageRow[] = file.map((r) => ({
    caseNumber: String(r.case_number),
    status: text(r.case_status),
    received: text(r.received_date),
    decided: text(r.decision_date),
    jobTitle: text(r.job_title),
    wage: num(r.wage),
    wageUnit: text(r.wage_unit),
  }));
  return mergeWageRequests(liveRows, fileRows, until);
}

/**
 * The reverse: the employer's PERM cases for a wage request's job, filed on or after the day DOL issued its wage
 * and within the window a PERM using it could be filed. A wage request's page lists the decided PERM cases that
 * NAME it (DOL's file); these are the ones that may, pending ones included. None while no wage is issued: no
 * PERM case can rest on it yet. perm_cases is read on its (employer_slug, decision_date) index, bounded by the
 * window; the live remainder on (employer_slug, filing_date).
 */
export async function getEmployerPermsForWageRequest(
  caseNumber: string,
  employerSlug: string | null,
  jobTitle: string | null,
  req: { status: string | null; decided: string | null; filed: string | null },
): Promise<EmployerPermCases | null> {
  const title = (jobTitle ?? "").trim();
  const decided = req.decided ?? (await decidedDays([caseNumber])).get(caseNumber) ?? null;
  const from = permWindowStart({ ...req, decided });
  const to = from ? lookaheadEnd(from) : null;
  if (!employerSlug || !title || !from || !to) return null;
  const page = (await pageForSpelling(employerSlug))?.page ?? employerSlug;
  const match = await employerMatch(page);
  if (!match) return null;
  const [live, file] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT case_number, status, filing_date FROM perm_live_recent
        WHERE ${match.where} AND filing_date >= ? AND filing_date < ? AND upper(trim(job_title)) = upper(?)
        ORDER BY filing_date DESC LIMIT ?`,
      [...match.args, from, to, title, WAGE_REQUESTS_SHOWN * 2],
    ),
    rows<Record<string, unknown>>(
      `SELECT case_number, status, received_date, decision_date FROM perm_cases
        WHERE ${match.where} AND decision_date >= ? AND received_date >= ? AND received_date < ?
          AND upper(trim(job_title)) = upper(?)
        ORDER BY received_date DESC LIMIT ?`,
      [...match.args, from, from, to, title, WAGE_REQUESTS_SHOWN * 2],
    ),
  ]);
  const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
  return mergePermCases(
    live.map((r) => ({ caseNumber: String(r.case_number), status: text(r.status), filed: text(r.filing_date) })),
    file.map((r) => ({
      caseNumber: String(r.case_number),
      status: text(r.status),
      filed: text(r.received_date),
      decided: text(r.decision_date),
    })),
  );
}
