import type { UnifiedCase } from "@/lib/turso/unifiedSearch";

/**
 * The case search's answer as CSV, one row per case, every column named.
 *
 * THE SAME ROWS AS THE PAGE, not more. The search returns at most
 * `UNIFIED_MAX` cases (300), each source capped at `PER_SOURCE`, and the CSV is
 * that answer: a download cannot be a way to read the corpus in bulk that the
 * page itself refuses (see the Terms' bulk-extraction clause).
 *
 * A CELL THAT STARTS WITH =, +, - OR @ is prefixed with an apostrophe, because
 * a spreadsheet runs it as a formula; a job title or an employer name is text
 * DOL copied from a form, and a downloaded file is not the place to execute it.
 */

export const CSV_COLUMNS: readonly { key: string; label: string; get: (r: UnifiedCase) => unknown }[] = [
  { key: "case_number", label: "case_number", get: (r) => r.caseNumber },
  { key: "program", label: "program", get: (r) => r.program },
  { key: "record", label: "record", get: (r) => (r.half === "live" ? "live check" : r.era === "history" ? "published, FY2016-FY2023" : "published") },
  { key: "status", label: "status", get: (r) => r.status },
  { key: "filed", label: "filed", get: (r) => r.filedOn },
  { key: "decided", label: "decided", get: (r) => r.decidedOn },
  { key: "days", label: "days_to_decision", get: (r) => r.days },
  { key: "employer", label: "employer", get: (r) => r.employerName },
  { key: "job_title", label: "job_title", get: (r) => r.jobTitle },
  { key: "soc_code", label: "occupation_code", get: (r) => r.socCode },
  { key: "soc_title", label: "occupation", get: (r) => r.socTitle },
  { key: "state", label: "worksite_state", get: (r) => r.state },
  { key: "city", label: "worksite_city", get: (r) => r.city },
  { key: "firm", label: "law_firm", get: (r) => r.firmName },
  { key: "wage", label: "wage", get: (r) => r.wage },
  { key: "wage_unit", label: "wage_unit", get: (r) => r.wageUnit ?? (r.wage !== null && r.program === "perm" ? "Year" : null) },
  { key: "industry_code", label: "industry_naics", get: (r) => r.industryCode },
  { key: "industry", label: "industry", get: (r) => r.industryTitle },
  { key: "citizenship", label: "worker_citizenship", get: (r) => r.citizenship },
  { key: "birth_country", label: "worker_birth_country", get: (r) => r.birthCountry },
  { key: "visa_class", label: "worker_visa_at_filing", get: (r) => r.visaClass },
  { key: "education", label: "worker_education", get: (r) => r.education },
  { key: "major", label: "worker_field_of_study", get: (r) => r.major },
  { key: "institution", label: "worker_school", get: (r) => r.institution },
  { key: "job_education", label: "job_minimum_education", get: (r) => r.jobEducation },
];

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function casesToCsv(rows: readonly UnifiedCase[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.label).join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(c.get(r))).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
