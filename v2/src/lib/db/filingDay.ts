import "server-only";

import { cache } from "react";

import type { DayCase, DayTally } from "@/lib/filingDay";

import { shiftMonth } from "@convex/lib/months";

import { rows } from "./client";
import { keepLinkableSlugs } from "./entityLinks";

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

type Row = {
  case_number: string;
  current_status: string | null;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  is_final: number | null;
};

const toCase = (r: Row): DayCase => ({
  caseNumber: String(r.case_number),
  status: String(r.current_status ?? "").trim().toUpperCase() || "UNKNOWN",
  employer: String(r.employer_name ?? "").trim(),
  employerSlug: r.employer_slug ? String(r.employer_slug) : null,
  jobTitle: String(r.job_title ?? "").trim(),
  final: Number(r.is_final) === 1,
});

/** One day's cases. A failed read throws, so the page shows its error rather than an empty day. */
export const getFiledOn = cache(async (day: string): Promise<FiledOn> => {
  const [perm, pwd] = await Promise.all([
    // `is_final IN (0, 1)` lets the read seek the (is_final, filing_date) index twice.
    // PERM's status table carries no slug: the case is in the live remainder or in DOL's published file, both
    // keyed by case number, so the two joins are point reads.
    rows<Row>(
      `SELECT s.case_number, s.current_status, s.employer_name, s.job_title, s.is_final,
              COALESCE(lr.employer_slug, pc.employer_slug) AS employer_slug
         FROM perm_case_status s
         LEFT JOIN perm_live_recent lr ON lr.case_number = s.case_number
         LEFT JOIN perm_cases pc ON pc.case_number = s.case_number
        WHERE s.is_final IN (0, 1) AND s.filing_date = ?
        ORDER BY s.employer_name, s.case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
    rows<Row>(
      `SELECT case_number, current_status, employer_name, employer_slug, job_title, is_final
         FROM pwd_case_status WHERE filing_date = ?
        ORDER BY employer_name, case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
  ]);
  // Each slug pointed at its page, or cleared where there is none, so the list links no 404.
  const [permCases, pwdCases] = await Promise.all([
    keepLinkableSlugs(perm.map(toCase)),
    keepLinkableSlugs(pwd.map(toCase)),
  ]);
  return { perm: permCases, pwd: pwdCases, capped: perm.length >= DAY_MAX_ROWS || pwd.length >= DAY_MAX_ROWS };
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
