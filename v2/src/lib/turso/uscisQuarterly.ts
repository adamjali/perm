import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import type { AwaitingCell, ClassCountryCell, OfficeRow } from "@/lib/uscisQuarterlyShape";

/**
 * USCIS's quarterly performance workbooks, as `scripts/ingest_uscis_quarterly.py`
 * stored them: every form's median months and workload per quarter, the
 * I-485 by field office, approved petitions awaiting a visa number, and I-140
 * receipts by class and country of birth, plus the historical median
 * factsheet in `perm_docs`.
 *
 * Every reader returns null when the table is empty or unreachable, and the
 * pages render a visible empty state naming the file that has not arrived.
 * Nothing here falls back to a slower query: there is no slower query, the
 * workbook is the only source, and a page that quietly showed last quarter's
 * figure under this quarter's date would be the defect these ingests exist
 * to end.
 */

export interface UscisFormRow {
  form: string;
  title: string;
  category: string;
  received: number | null;
  approved: number | null;
  denied: number | null;
  completed: number | null;
  pending: number | null;
  medianMonths: number | null;
  ytdReceived: number | null;
  ytdCompleted: number | null;
  ytdPending: number | null;
}

export interface UscisFormQuarter {
  fy: number;
  quarter: number;
  quarterStart: string;
  quarterEnd: string;
  sourceFile: string;
  /** Every form row except the service-wide TOTAL. */
  forms: UscisFormRow[];
  /** The service-wide TOTAL row USCIS prints, or null if the sheet lacked one. */
  total: UscisFormRow | null;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

function formRow(r: Record<string, unknown>): UscisFormRow {
  return {
    form: String(r.form),
    title: String(r.title),
    category: String(r.category ?? ""),
    received: num(r.received),
    approved: num(r.approved),
    denied: num(r.denied),
    completed: num(r.completed),
    pending: num(r.pending),
    medianMonths: num(r.median_months),
    ytdReceived: num(r.ytd_received),
    ytdCompleted: num(r.ytd_completed),
    ytdPending: num(r.ytd_pending),
  };
}

/** The newest quarter held, with every form USCIS listed in it. */
export const getUscisFormQuarter = cache(async (): Promise<UscisFormQuarter | null> => {
  const head = await one<{ fy: number; quarter: number }>(
    "SELECT fy, quarter FROM uscis_form_quarters ORDER BY fy DESC, quarter DESC LIMIT 1",
  ).catch(() => null);
  if (!head) return null;
  const list = await rows<Record<string, unknown>>(
    `SELECT form, title, category, quarter_start, quarter_end, source_file,
            received, approved, denied, completed, pending, median_months,
            ytd_received, ytd_completed, ytd_pending
       FROM uscis_form_quarters WHERE fy = ? AND quarter = ?
       ORDER BY rowid`,
    [head.fy, head.quarter],
  ).catch(() => []);
  if (list.length === 0) return null;
  const first = list[0]!;
  const all = list.map(formRow);
  return {
    fy: Number(head.fy),
    quarter: Number(head.quarter),
    quarterStart: String(first.quarter_start),
    quarterEnd: String(first.quarter_end),
    sourceFile: String(first.source_file),
    forms: all.filter((r) => r.form !== "TOTAL"),
    total: all.find((r) => r.form === "TOTAL") ?? null,
  };
});

export interface UscisFormHistoryPoint {
  fy: number;
  quarter: number;
  quarterEnd: string;
  title: string;
  medianMonths: number | null;
  pending: number | null;
  received: number | null;
  completed: number | null;
}

/** Every quarter held for one form, oldest first, one point per title row. */
export const getUscisFormHistory = cache(async (form: string): Promise<UscisFormHistoryPoint[]> => {
  const list = await rows<Record<string, unknown>>(
    `SELECT fy, quarter, quarter_end, title, median_months, pending, received, completed
       FROM uscis_form_quarters WHERE form = ? ORDER BY fy, quarter, rowid`,
    [form],
  ).catch(() => []);
  return list.map((r) => ({
    fy: Number(r.fy),
    quarter: Number(r.quarter),
    quarterEnd: String(r.quarter_end),
    title: String(r.title),
    medianMonths: num(r.median_months),
    pending: num(r.pending),
    received: num(r.received),
    completed: num(r.completed),
  }));
});

export interface UscisFormMedian {
  form: string;
  title: string;
  medianMonths: number;
  fy: number;
  quarter: number;
  quarterEnd: string;
  pending: number | null;
  completed: number | null;
}

/**
 * The newest quarterly median for one form, optionally one of its title rows
 * (`"I-485"` with `"Employment"` picks the employment-based line). Null when
 * USCIS printed N/A for it, so a caller shows nothing rather than a dash.
 */
export const getUscisFormMedian = cache(
  async (form: string, titleContains?: string): Promise<UscisFormMedian | null> => {
    const r = await one<Record<string, unknown>>(
      `SELECT form, title, median_months, fy, quarter, quarter_end, pending, completed
         FROM uscis_form_quarters
        WHERE form = ? AND median_months IS NOT NULL${titleContains ? " AND title LIKE ?" : ""}
        ORDER BY fy DESC, quarter DESC LIMIT 1`,
      titleContains ? [form, `%${titleContains}%`] : [form],
    ).catch(() => null);
    if (!r || r.median_months === null || r.median_months === undefined) return null;
    return {
      form: String(r.form),
      title: String(r.title),
      medianMonths: Number(r.median_months),
      fy: Number(r.fy),
      quarter: Number(r.quarter),
      quarterEnd: String(r.quarter_end),
      pending: num(r.pending),
      completed: num(r.completed),
    };
  },
);

// ---------------------------------------------------------------------------
// The I-485 by office
// ---------------------------------------------------------------------------

export interface I485Offices {
  fy: number;
  quarter: number;
  quarterEnd: string;
  sourceFile: string;
  /** The Total row USCIS prints (code ALL), or null. */
  total: OfficeRow | null;
  /** Every office and service center, the Total excluded. */
  offices: OfficeRow[];
  /** The previous quarter's employment pending by code, for movement, if held. */
  previous: { fy: number; quarter: number; empPendingByCode: Record<string, number | null> } | null;
}

const OFFICE_COLS = [
  "fam_received", "fam_approved", "fam_denied", "fam_pending",
  "emp_received", "emp_approved", "emp_denied", "emp_pending",
  "hum_received", "hum_approved", "hum_denied", "hum_pending",
  "oth_received", "oth_approved", "oth_denied", "oth_pending",
  "all_received", "all_approved", "all_denied", "all_pending",
] as const;

function officeRow(r: Record<string, unknown>): OfficeRow {
  const camel = (c: string) => c.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
  const out: Record<string, unknown> = {
    state: String(r.state ?? ""),
    office: String(r.office),
    code: String(r.code),
    suppressed: Number(r.suppressed ?? 0),
  };
  for (const c of OFFICE_COLS) out[camel(c)] = num(r[c]);
  return out as unknown as OfficeRow;
}

export const getI485Offices = cache(async (): Promise<I485Offices | null> => {
  const heads = await rows<{ fy: number; quarter: number }>(
    "SELECT DISTINCT fy, quarter FROM uscis_i485_offices ORDER BY fy DESC, quarter DESC LIMIT 2",
  ).catch(() => []);
  const head = heads[0];
  if (!head) return null;
  const list = await rows<Record<string, unknown>>(
    `SELECT state, office, code, suppressed, quarter_end, source_file, ${OFFICE_COLS.join(", ")}
       FROM uscis_i485_offices WHERE fy = ? AND quarter = ? ORDER BY rowid`,
    [head.fy, head.quarter],
  ).catch(() => []);
  if (list.length === 0) return null;
  const all = list.map(officeRow);
  let previous: I485Offices["previous"] = null;
  const prev = heads[1];
  if (prev) {
    const prevRows = await rows<{ code: string; emp_pending: number | null }>(
      "SELECT code, emp_pending FROM uscis_i485_offices WHERE fy = ? AND quarter = ?",
      [prev.fy, prev.quarter],
    ).catch(() => []);
    previous = {
      fy: Number(prev.fy),
      quarter: Number(prev.quarter),
      empPendingByCode: Object.fromEntries(prevRows.map((r) => [String(r.code), num(r.emp_pending)])),
    };
  }
  const first = list[0]!;
  return {
    fy: Number(head.fy),
    quarter: Number(head.quarter),
    quarterEnd: String(first.quarter_end),
    sourceFile: String(first.source_file),
    total: all.find((r) => r.code === "ALL") ?? null,
    offices: all.filter((r) => r.code !== "ALL"),
    previous,
  };
});

// ---------------------------------------------------------------------------
// Awaiting a visa number
// ---------------------------------------------------------------------------

export interface EbAwaitingVisa {
  /** "2026-06": the month USCIS states on the sheet. */
  asOf: string;
  sourceFile: string;
  cells: AwaitingCell[];
  previous: { asOf: string; cells: AwaitingCell[] } | null;
}

export const getEbAwaitingVisa = cache(async (): Promise<EbAwaitingVisa | null> => {
  const heads = await rows<{ as_of: string }>(
    "SELECT DISTINCT as_of FROM uscis_eb_awaiting_visa ORDER BY as_of DESC LIMIT 2",
  ).catch(() => []);
  const head = heads[0];
  if (!head) return null;
  const read = async (asOf: string) =>
    (await rows<Record<string, unknown>>(
      "SELECT country, category, count, source_file FROM uscis_eb_awaiting_visa WHERE as_of = ?",
      [asOf],
    ).catch(() => [])).map((r) => ({
      country: String(r.country), category: String(r.category), count: Number(r.count),
      sourceFile: String(r.source_file),
    }));
  const current = await read(String(head.as_of));
  if (current.length === 0) return null;
  const prevHead = heads[1];
  const previous = prevHead ? await read(String(prevHead.as_of)) : [];
  return {
    asOf: String(head.as_of),
    sourceFile: current[0]!.sourceFile,
    cells: current.map(({ country, category, count }) => ({ country, category, count })),
    previous: prevHead && previous.length
      ? { asOf: String(prevHead.as_of), cells: previous.map(({ country, category, count }) => ({ country, category, count })) }
      : null,
  };
});

// ---------------------------------------------------------------------------
// I-140 receipts by class and country
// ---------------------------------------------------------------------------

export interface I140ClassCountry {
  /** "2026-Q3": the file's quarter. */
  asOf: string;
  sourceFile: string;
  countries: string[];
  years: number[];
  cells: ClassCountryCell[];
}

export const getI140ClassCountry = cache(async (): Promise<I140ClassCountry | null> => {
  const head = await one<{ as_of: string }>(
    "SELECT as_of FROM uscis_i140_class_country ORDER BY as_of DESC LIMIT 1",
  ).catch(() => null);
  if (!head) return null;
  const list = await rows<Record<string, unknown>>(
    "SELECT country, preference, measure, fy, count, source_file FROM uscis_i140_class_country WHERE as_of = ?",
    [head.as_of],
  ).catch(() => []);
  if (list.length === 0) return null;
  const cells = list.map((r) => ({
    country: String(r.country), preference: String(r.preference), measure: String(r.measure),
    fy: Number(r.fy), count: Number(r.count),
  }));
  return {
    asOf: String(head.as_of),
    sourceFile: String(list[0]!.source_file),
    countries: [...new Set(cells.map((c) => c.country))],
    years: [...new Set(cells.map((c) => c.fy))].sort((a, b) => a - b),
    cells,
  };
});

// ---------------------------------------------------------------------------
// The historical factsheet
// ---------------------------------------------------------------------------

export interface HistoricalMedianRow {
  form: string;
  basis: string;
  /** One value per entry of `years`. */
  months: number[];
}

export interface HistoricalMedians {
  /** USCIS's own "Data as of" date on the factsheet. */
  asOf: string;
  years: number[];
  rows: HistoricalMedianRow[];
  note: string;
  source: string;
}

/**
 * USCIS's FY2016 to FY2024 median factsheet, from `perm_docs`. No age
 * cutoff: it is a static publication with its own as-of date printed on it,
 * and the page prints that date rather than ours.
 */
export const getHistoricalMedians = cache(async (): Promise<HistoricalMedians | null> => {
  const r = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = ?", ["uscis_historical_pt"],
  ).catch(() => null);
  if (!r) return null;
  try {
    const d = JSON.parse(String(r.json)) as Partial<HistoricalMedians>;
    if (!d.asOf || !Array.isArray(d.years) || !Array.isArray(d.rows)) return null;
    return {
      asOf: String(d.asOf),
      years: d.years.map(Number),
      rows: d.rows.map((row) => ({
        form: String(row.form), basis: String(row.basis), months: (row.months ?? []).map(Number),
      })),
      note: String(d.note ?? ""),
      source: String(d.source ?? ""),
    };
  } catch {
    return null;
  }
});
