import "server-only";

import { cache } from "react";

import type { DayCase, DayTally } from "@/lib/filingDay";
import type { FilingProgram } from "@/lib/filingsByDay";
import { formatWage, looksYearly, LOOKS_YEARLY_SHORT } from "@/lib/wageFormat";

import { shiftMonth } from "@convex/lib/months";

import { rows } from "./client";
import { keepLinkableSlugs } from "./entityLinks";

/**
 * Every case DOL's record holds for one filing day, by program: the sweep's live table
 * (pending and decided alike) and DOL's published files, a case listed once (owner, Nov 5
 * 2026). A case the live table holds lists on its live filing day, with the decision day,
 * worksite state and wage its file adds and the file's own day when that differs; a decided
 * case only a file holds lists on the file's received day (the first file that holds it, as
 * scripts/build_filings_by_day.py counts it, so a day's list and its count agree). A day holds
 * a few hundred to two thousand of a program; the cap only stops a bad day reading without
 * bound, and the page says when it was reached.
 */
export const DAY_MAX_ROWS = 5000;

export interface FiledOn {
  perm: DayCase[];
  pwd: DayCase[];
  /** A list stopped at DAY_MAX_ROWS. */
  capped: boolean;
}

type LiveRow = {
  case_number: string;
  current_status: string | null;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  is_final: number | null;
  file_date: string | null;
  decided: string | null;
  state: string | null;
  wage: number | null;
  wage_unit: string | null;
};

type FileRow = {
  case_number: string;
  status: string | null;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  received_date: string | null;
  decided: string | null;
  state: string | null;
  wage: number | null;
  wage_unit: string | null;
};

const statusWord = (s: string | null) => String(s ?? "").trim().toUpperCase() || "UNKNOWN";
const dayOf = (s: string | null) => (s ? String(s).slice(0, 10) : null);

function wageText(wage: number | null, unit: string | null): string | null {
  const w = wage === null || wage === undefined ? null : Number(wage);
  const text = formatWage(w, unit);
  if (!text) return null;
  return looksYearly(w, unit) ? `${text} (${LOOKS_YEARLY_SHORT})` : text;
}

const fromLive = (day: string) => (r: LiveRow): DayCase => {
  const fileDate = dayOf(r.file_date);
  return {
    caseNumber: String(r.case_number),
    status: statusWord(r.current_status),
    employer: String(r.employer_name ?? "").trim(),
    employerSlug: r.employer_slug ? String(r.employer_slug) : null,
    jobTitle: String(r.job_title ?? "").trim(),
    final: Number(r.is_final) === 1,
    source: fileDate ? "both" : "live",
    fileDate: fileDate && fileDate !== day ? fileDate : null,
    decided: dayOf(r.decided),
    state: r.state ? String(r.state).trim().toUpperCase() : null,
    wage: wageText(r.wage, r.wage_unit),
  };
};

const fromFile = (r: FileRow): DayCase => ({
  caseNumber: String(r.case_number),
  status: statusWord(r.status),
  employer: String(r.employer_name ?? "").trim(),
  employerSlug: r.employer_slug ? String(r.employer_slug) : null,
  jobTitle: String(r.job_title ?? "").trim(),
  final: true,
  source: "file",
  fileDate: null,
  decided: dayOf(r.decided),
  state: r.state ? String(r.state).trim().toUpperCase() : null,
  wage: wageText(r.wage, r.wage_unit),
});

// The published columns each file names its own way: PERM's wage is yearly and has no unit column.
const FILE_COLS = {
  perm: "p.status AS status, p.state AS state, p.wage AS wage, 'Year' AS wage_unit",
  flag: "p.case_status AS status, p.worksite_state AS state, p.wage AS wage, p.wage_unit AS wage_unit",
};

async function permDay(day: string): Promise<DayCase[]> {
  // `is_final IN (0, 1)` lets the read seek the (is_final, filing_date) index twice. PERM's status
  // table carries no slug: the live remainder or a published file names it, each keyed by case number.
  const live = await rows<LiveRow>(
    `SELECT s.case_number, s.current_status, s.employer_name, s.job_title, s.is_final,
            COALESCE(lr.employer_slug, pc.employer_slug, h.employer_slug) AS employer_slug,
            COALESCE(pc.received_date, h.received_date) AS file_date,
            COALESCE(pc.decision_date, h.decision_date) AS decided,
            COALESCE(pc.state, h.state) AS state, COALESCE(pc.wage, h.wage) AS wage, 'Year' AS wage_unit
       FROM perm_case_status s
       LEFT JOIN perm_live_recent lr ON lr.case_number = s.case_number
       LEFT JOIN perm_cases pc ON pc.case_number = s.case_number
       LEFT JOIN perm_cases_history h ON h.case_number = s.case_number AND pc.case_number IS NULL
      WHERE s.is_final IN (0, 1) AND s.filing_date = ?
      ORDER BY s.employer_name, s.case_number LIMIT ?`,
    [day, DAY_MAX_ROWS],
  );
  const notLive = "NOT EXISTS (SELECT 1 FROM perm_case_status s WHERE s.case_number = p.case_number)";
  const cols = `p.case_number, p.employer_name, p.employer_slug, p.job_title, p.received_date, p.decision_date AS decided, ${FILE_COLS.perm}`;
  const [files, history] = await Promise.all([
    rows<FileRow>(`SELECT ${cols} FROM perm_cases p WHERE p.received_date = ? AND ${notLive} LIMIT ?`, [day, DAY_MAX_ROWS]),
    rows<FileRow>(
      `SELECT ${cols} FROM perm_cases_history p WHERE p.received_date = ? AND ${notLive}
          AND NOT EXISTS (SELECT 1 FROM perm_cases x WHERE x.case_number = p.case_number) LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
  ]);
  return [...live.map(fromLive(day)), ...files.map(fromFile), ...history.map(fromFile)];
}

/** Wage requests and the seasonal programs: one live table, one published file, both on the main database. */
async function flagDay(day: string, live: string, file: string): Promise<DayCase[]> {
  const [liveRows, fileRows] = await Promise.all([
    rows<LiveRow>(
      `SELECT s.case_number, s.current_status, s.employer_name, s.employer_slug, s.job_title, s.is_final,
              p.received_date AS file_date, p.decision_date AS decided,
              p.worksite_state AS state, p.wage AS wage, p.wage_unit AS wage_unit
         FROM ${live} s LEFT JOIN ${file} p ON p.case_number = s.case_number
        WHERE s.filing_date = ? ORDER BY s.employer_name, s.case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
    rows<FileRow>(
      `SELECT p.case_number, p.employer_name, p.employer_slug, p.job_title, p.received_date, p.decision_date AS decided,
              ${FILE_COLS.flag}
         FROM ${file} p
        WHERE p.received_date = ? AND NOT EXISTS (SELECT 1 FROM ${live} s WHERE s.case_number = p.case_number) LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
  ]);
  return [...liveRows.map(fromLive(day)), ...fileRows.map(fromFile)];
}

/**
 * H-1B LCAs: the live table and `lca_case_numbers` (the file's case numbers and days) are on the
 * main database, the file's rows on the LCA one, so the two are read apart and joined here. The
 * file's details for a live case come from the day's own file rows, or by case number when the
 * file dates it otherwise.
 */
async function lcaDay(day: string): Promise<DayCase[]> {
  const [live, file] = await Promise.all([
    rows<{ case_number: string; current_status: string | null; employer_name: string | null; employer_slug: string | null; job_title: string | null; is_final: number | null; file_date: string | null }>(
      `SELECT s.case_number, s.current_status, s.employer_name, s.employer_slug, s.job_title, s.is_final,
              n.received_date AS file_date
         FROM lca_case_status s LEFT JOIN lca_case_numbers n ON n.case_number = s.case_number
        WHERE s.filing_date = ? ORDER BY s.employer_name, s.case_number LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
    rows<FileRow>(
      `SELECT p.case_number, p.employer_name, p.employer_slug, p.job_title, p.received_date, p.decision_date AS decided,
              ${FILE_COLS.flag}
         FROM lca_cases p WHERE p.received_date = ? LIMIT ?`,
      [day, DAY_MAX_ROWS],
    ),
  ]);
  const byNumber = new Map(file.map((r) => [String(r.case_number), r]));
  const elsewhere = live.filter((r) => r.file_date && dayOf(r.file_date) !== day).map((r) => String(r.case_number));
  for (let i = 0; i < elsewhere.length; i += 500) {
    const chunk = elsewhere.slice(i, i + 500);
    const got = await rows<FileRow>(
      `SELECT p.case_number, p.employer_name, p.employer_slug, p.job_title, p.received_date, p.decision_date AS decided,
              ${FILE_COLS.flag}
         FROM lca_cases p WHERE p.case_number IN (${chunk.map(() => "?").join(",")})`,
      chunk,
    );
    for (const r of got) byNumber.set(String(r.case_number), r);
  }
  const liveNumbers = new Set(live.map((r) => String(r.case_number)));
  const liveCases = live.map((r) => {
    const f = byNumber.get(String(r.case_number));
    return fromLive(day)({
      ...r,
      decided: f?.decided ?? null,
      state: f?.state ?? null,
      wage: f?.wage ?? null,
      wage_unit: f?.wage_unit ?? null,
    });
  });
  const fileOnly = file.filter((r) => !liveNumbers.has(String(r.case_number))).map(fromFile);
  return [...liveCases, ...fileOnly];
}

/** One program's filings for one day, each slug pointed at its page or cleared. A failed read throws. */
export const getFiledOnProgram = cache(async (day: string, program: FilingProgram): Promise<{ cases: DayCase[]; capped: boolean }> => {
  const all =
    program === "perm" ? await permDay(day)
    : program === "pwd" ? await flagDay(day, "pwd_case_status", "pwd_cases")
    : program === "seasonal" ? await flagDay(day, "seasonal_case_status", "seasonal_cases")
    : await lcaDay(day);
  // Each read stops at DAY_MAX_ROWS; a list that long is said to be cut, never shown as the whole day.
  const capped = all.length >= DAY_MAX_ROWS;
  const cases = await keepLinkableSlugs(all.slice(0, DAY_MAX_ROWS));
  cases.sort((a, b) => a.employer.localeCompare(b.employer) || a.caseNumber.localeCompare(b.caseNumber));
  return { cases, capped };
});

/** PERM cases and wage requests for one day, which the day page renders on the server. */
export const getFiledOn = cache(async (day: string): Promise<FiledOn> => {
  const [perm, pwd] = await Promise.all([getFiledOnProgram(day, "perm"), getFiledOnProgram(day, "pwd")]);
  return { perm: perm.cases, pwd: pwd.cases, capped: perm.capped || pwd.capped };
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
