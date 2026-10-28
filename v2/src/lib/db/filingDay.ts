import "server-only";

import { cache } from "react";

import type { DayCase, DayTally } from "@/lib/filingDay";

import { shiftMonth } from "@convex/lib/months";

import { rows } from "./client";

/**
 * Every PERM case and wage request DOL's record holds for one filing day, from the
 * sweep's live tables (published and pending alike). A day holds a few hundred of
 * each; the cap only stops a bad day from reading without bound, and the page says
 * when it was reached.
 */
export const DAY_MAX_ROWS = 5000;

export interface FiledOn {
  perm: DayCase[];
  pwd: DayCase[];
  /** A list stopped at DAY_MAX_ROWS. */
  capped: boolean;
}

type Row = { case_number: string; current_status: string | null; employer_name: string | null; job_title: string | null; is_final: number | null };

const toCase = (r: Row): DayCase => ({
  caseNumber: String(r.case_number),
  status: String(r.current_status ?? "").trim().toUpperCase() || "UNKNOWN",
  employer: String(r.employer_name ?? "").trim(),
  jobTitle: String(r.job_title ?? "").trim(),
  final: Number(r.is_final) === 1,
});

/** One day's cases. A failed read throws, so the page shows its error rather than an empty day. */
export const getFiledOn = cache(async (day: string): Promise<FiledOn> => {
  const [perm, pwd] = await Promise.all([
    // `is_final IN (0, 1)` lets the read seek the (is_final, filing_date) index twice.
    rows<Row>(
      `SELECT case_number, current_status, employer_name, job_title, is_final
         FROM perm_case_status WHERE is_final IN (0, 1) AND filing_date = ?
        ORDER BY employer_name, case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
    rows<Row>(
      `SELECT case_number, current_status, employer_name, job_title, is_final
         FROM pwd_case_status WHERE filing_date = ?
        ORDER BY employer_name, case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
  ]);
  return { perm: perm.map(toCase), pwd: pwd.map(toCase), capped: perm.length >= DAY_MAX_ROWS || pwd.length >= DAY_MAX_ROWS };
});

/**
 * A filing month's PERM cases by day: filed, and still waiting (not decided). The same
 * table and the same "waiting" as the day page, so a day's square and its page agree. One
 * read of the (is_final, filing_date) index, which covers it. A failed read throws.
 */
export const getMonthDays = cache(async (month: string): Promise<Record<string, DayTally>> => {
  const got = await rows<{ d: string; n: number; w: number }>(
    `SELECT filing_date AS d, COUNT(*) AS n, SUM(is_final = 0) AS w
       FROM perm_case_status WHERE is_final IN (0, 1) AND filing_date >= ? AND filing_date < ?
      GROUP BY filing_date`,
    [`${month}-01`, `${shiftMonth(month, 1)}-01`],
  );
  return Object.fromEntries(got.map((r) => [String(r.d), { filed: Number(r.n) || 0, waiting: Number(r.w) || 0 }]));
});
