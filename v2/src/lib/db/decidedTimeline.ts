import "server-only";

import type { DecidedRecord } from "@/lib/decidedTimeline";

import { one, rows } from "./client";

/**
 * One decided case's own dates from DOL's current published file, joined to the wage request it
 * names. perm_cases only: the older FY2016 to FY2023 history table carries neither the recruitment
 * columns nor the wage request's number, and the shared lookup that reads both is left alone.
 * Null when the file doesn't hold the case.
 */
export interface DecidedTimelineRead {
  record: DecidedRecord;
  /** What the employer put on the application: its headcount and the year it began. */
  employer: { employees: number | null; since: number | null };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getDecidedTimeline(caseNumber: string): Promise<DecidedTimelineRead | null> {
  const r = await one<Record<string, unknown>>(
    `SELECT p.received_date, p.decision_date, p.status, p.job_order_start, p.job_order_end,
            p.paper1, p.ad1, p.paper2, p.ad2, p.recr_steps, p.pwd_number, p.emp_payroll, p.emp_year,
            w.case_number AS pwd_case, w.received_date AS pwd_filed, w.determined_on, w.decision_date AS pwd_decided,
            w.wage_level, w.wage AS pwd_wage, w.wage_unit AS pwd_unit, w.pw_expires
       FROM perm_cases p LEFT JOIN pwd_cases w ON w.case_number = p.pwd_number
      WHERE p.case_number = ?`,
    [caseNumber],
  );
  if (!r) return null;
  const pwdCase = str(r.pwd_case);
  const employees = num(r.emp_payroll);
  const since = num(r.emp_year);
  return {
    record: {
      receivedDate: str(r.received_date),
      decisionDate: str(r.decision_date),
      status: str(r.status),
      jobOrderStart: str(r.job_order_start),
      jobOrderEnd: str(r.job_order_end),
      paper1: str(r.paper1),
      ad1: str(r.ad1),
      paper2: str(r.paper2),
      ad2: str(r.ad2),
      recrSteps: str(r.recr_steps),
      pwd: pwdCase
        ? {
            number: pwdCase,
            filed: str(r.pwd_filed),
            // The first determination; DOL's newest decision date where the file predates the column.
            determined: str(r.determined_on) ?? str(r.pwd_decided),
            level: str(r.wage_level),
            // The wage request's file prints the determined wage in `wage`; `pw_*` is the LCA file's column set.
            wage: num(r.pwd_wage),
            unit: str(r.pwd_unit),
            expires: str(r.pw_expires),
          }
        : null,
    },
    // A year before 1700 or a headcount of 0 is a typing slip in the form, not a fact.
    employer: { employees: employees && employees > 0 ? employees : null, since: since && since >= 1700 ? since : null },
  };
}

/** A decided PERM that names a wage request: the link back from the wage request's own page. */
export interface PermNamingPwd {
  caseNumber: string;
  status: string;
  decisionDate: string | null;
}

/**
 * The decided PERM cases in DOL's published file that name this wage request, newest first, on
 * `idx_pc_pwd_number`. A pending PERM's live record doesn't name its wage request, so an empty
 * answer means no decided PERM names it yet, never that none was filed.
 */
export async function getPermsNamingPwd(pwdNumber: string): Promise<PermNamingPwd[]> {
  const got = await rows<Record<string, unknown>>(
    "SELECT case_number, status, decision_date FROM perm_cases WHERE pwd_number = ? ORDER BY decision_date DESC LIMIT 5",
    [pwdNumber],
  );
  return got.flatMap((r) => {
    const caseNumber = str(r.case_number);
    const status = str(r.status);
    return caseNumber && status ? [{ caseNumber, status, decisionDate: str(r.decision_date) }] : [];
  });
}
