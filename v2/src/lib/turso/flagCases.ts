import "server-only";
import { cache } from "react";
import { exec, one, rows } from "./client";
import { slugify } from "@/lib/entitySlug";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { LIVE_SEARCH_MAX, narrowingClauses } from "./cases";
import { fetchDolCase, underDailyBudget } from "./caseDiscovery";

/**
 * One read layer for every non-PERM program DOL's case-status endpoint
 * serves: prevailing wage requests (`P-`) and labor condition applications
 * (`I-`). Each program is a table with the same columns, a prefix rule, a
 * final-status set and a summary doc; `makeFlagProgram` builds the lookup,
 * discovery, search, list and summary readers from that description, so
 * the two programs cannot drift apart in the predicate that matters.
 *
 * Why not one table with a program column: the PERM tables feed the queue
 * census, the review-stage pages, the RFI funnel and the alert sweep, all
 * written against a PERM status vocabulary; ten P-/I- rows had leaked into
 * them through the web lookup before any of this existed. Separate tables
 * keep every PERM invariant true by construction. The Python side is
 * `scripts/ingest_pwd_status_direct.py`, whose PROGRAMS dict this mirrors;
 * the final-status sets are pinned against it by tests.
 */

export interface FlagProgramConfig {
  /** Short key, also the summary doc's prefix: `pwd`, `lca`. */
  key: string;
  table: string;
  /** Anchored regex for a tidied number, e.g. /^P-\d{3}-\d{5}-\d+$/. */
  numberRe: RegExp;
  finalStatuses: ReadonlySet<string>;
  /** perm_docs key written by the ingest. */
  docKey: string;
  /** Source stamp for a case recorded by a visitor's lookup. */
  discoverySource: string;
  /** perm_docs counter prefix for the daily discovery budget. */
  budgetPrefix: string;
  /** When set, every list and search filters `visa_type` to it by default. */
  defaultVisaType?: string;
  /**
   * DOL's quarterly disclosure table for the program (`pwd_cases`,
   * `lca_cases`), loaded by scripts/ingest_flag_disclosure.py. Decided cases
   * only, with what the live endpoint never says: the wage. Absent when the
   * program has no such file.
   */
  disclosureTable?: string;
  /** perm_docs key of the ingest's summary (rows, date span, files). */
  disclosureDocKey?: string;
  /** `visa_class` value that means "this program's PERM half" in the file. */
  defaultVisaClass?: string;
}

/** One row of DOL's quarterly disclosure file: the decided record, wage included. */
export interface FlagDisclosedRow {
  caseNumber: string;
  status: string;
  receivedDate: string | null;
  decisionDate: string | null;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  socCode: string | null;
  socTitle: string | null;
  wage: number | null;
  wageUnit: string | null;
  worksiteState: string | null;
  visaClass: string | null;
  fiscalYear: number | null;
}

export interface DisclosedDbRow {
  case_number: string;
  case_status: string;
  received_date: string | null;
  decision_date: string | null;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  soc_code: string | null;
  soc_title: string | null;
  wage: number | string | null;
  wage_unit: string | null;
  worksite_state: string | null;
  visa_class: string | null;
  fiscal_year: number | string | null;
}

export const DISCLOSED_COLS =
  "case_number, case_status, received_date, decision_date, employer_name, employer_slug, " +
  "job_title, soc_code, soc_title, wage, wage_unit, worksite_state, visa_class, fiscal_year";

const num = (v: number | string | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const toDisclosed = (r: DisclosedDbRow): FlagDisclosedRow => ({
  caseNumber: r.case_number,
  status: r.case_status,
  receivedDate: r.received_date,
  decisionDate: r.decision_date,
  employerName: r.employer_name,
  employerSlug: r.employer_slug,
  jobTitle: r.job_title,
  socCode: r.soc_code,
  socTitle: r.soc_title,
  wage: num(r.wage),
  wageUnit: r.wage_unit,
  worksiteState: r.worksite_state,
  visaClass: r.visa_class,
  fiscalYear: num(r.fiscal_year),
});

export interface FlagDisclosureSummary {
  rows: number;
  earliestReceived: string | null;
  latestDecision: string | null;
  files: Record<string, number>;
  computedAt: number;
}

/**
 * The ingest's summary doc. No age cutoff, unlike the live summary: the
 * file is quarterly and a count of it stays true until the next load
 * replaces it. Shape is still checked, so a half-written doc reads as absent.
 */
export function parseDisclosureSummaryDoc(json: string, computedAt: number): FlagDisclosureSummary | null {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (!isInt(o.rows) || !isCountMap(o.files ?? {})) return null;
  const date = (v: unknown): string | null =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  return {
    rows: o.rows,
    earliestReceived: date(o.earliestReceived),
    latestDecision: date(o.latestDecision),
    files: (o.files as Record<string, number> | undefined) ?? {},
    computedAt: Number.isFinite(computedAt) ? computedAt : 0,
  };
}

/**
 * The half-open slug range for an employer-name prefix, or null when the
 * text slugs to nothing searchable. Shared by the live and disclosed
 * searches so the two halves answer the same needle.
 */
export function slugRange(text: string): { lo: string; hi: string } | null {
  if (text.length > 120) return null;
  const needle = slugify(text.trim());
  if (needle.length < 2) return null;
  const hi = needle.slice(0, -1) + String.fromCharCode(needle.charCodeAt(needle.length - 1) + 1);
  return { lo: needle, hi };
}

export interface FlagCaseRow {
  caseNumber: string;
  filingDate: string | null;
  status: string;
  isFinal: boolean;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  visaType: string | null;
  submittedDate: string | null;
  firstSeenAt: string | null;
  lastCheckedAt: string | null;
}

export interface FlagDbRow {
  case_number: string;
  filing_date: string | null;
  current_status: string;
  is_final: number | string;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  visa_type: string | null;
  submitted_date: string | null;
  first_seen_at: string | null;
  last_checked_at: string | null;
}

export const FLAG_COLS =
  "case_number, filing_date, current_status, is_final, employer_name, employer_slug, " +
  "job_title, visa_type, submitted_date, first_seen_at, last_checked_at";

export const toFlagRow = (r: FlagDbRow): FlagCaseRow => ({
  caseNumber: r.case_number,
  filingDate: r.filing_date,
  status: r.current_status,
  // libSQL may hand an integer back as a string; Boolean("0") is true.
  isFinal: Number(r.is_final) === 1,
  employerName: r.employer_name,
  employerSlug: r.employer_slug,
  jobTitle: r.job_title,
  visaType: r.visa_type,
  submittedDate: r.submitted_date,
  firstSeenAt: r.first_seen_at,
  lastCheckedAt: r.last_checked_at,
});

export type FlagVisaScope = "default" | "all";
export type FlagKind = "pending" | "decided" | "all";
export const FLAG_KINDS = ["pending", "decided", "all"] as const;
export function isFlagKind(v: string): v is FlagKind {
  return (FLAG_KINDS as readonly string[]).includes(v);
}

export interface SearchFlagArgs {
  text: string;
  title?: string;
  from?: string;
  to?: string;
  limit?: number;
  visa?: FlagVisaScope;
}

export interface ListFlagArgs {
  kind: FlagKind;
  month?: string | null;
  order?: "newest" | "oldest";
  numItems?: number;
  cursor?: string | null;
  visa?: FlagVisaScope;
}

export interface FlagListPage {
  rows: FlagCaseRow[];
  isDone: boolean;
  continueCursor: string;
  kind: FlagKind;
  month: string | null;
}

export const FLAG_DEFAULT_ITEMS = 50;
export const FLAG_MAX_ITEMS = 200;

export interface FlagMonth {
  month: string;
  total: number;
  pending: number;
  decided: number;
}

export interface FlagSummary {
  total: number;
  pending: number;
  decided: number;
  byStatus: Record<string, number>;
  byVisaType: Record<string, number>;
  byMonth: FlagMonth[];
  asOf: string | null;
  computedAt: number;
}

/** A doc older than eight days is absent: a stale "live" count is the misleading case. */
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isCountMap = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === "object" && Object.values(v as object).every(isInt);

export function parseFlagSummaryDoc(json: string, computedAt: number, now: number): FlagSummary | null {
  if (!Number.isFinite(computedAt) || now - computedAt > MAX_AGE_MS) return null;
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (!isInt(o.total) || !isInt(o.pending) || !isInt(o.decided)) return null;
  if (!isCountMap(o.byStatus) || !Array.isArray(o.byMonth)) return null;
  const byMonth: FlagMonth[] = [];
  for (const m of o.byMonth) {
    const r = m as Record<string, unknown>;
    if (!r || typeof r.month !== "string" || !isInt(r.total) || !isInt(r.pending) || !isInt(r.decided)) {
      return null;
    }
    byMonth.push({ month: r.month, total: r.total, pending: r.pending, decided: r.decided });
  }
  return {
    total: o.total,
    pending: o.pending,
    decided: o.decided,
    byStatus: o.byStatus,
    byVisaType: isCountMap(o.byVisaType) ? o.byVisaType : {},
    byMonth,
    asOf: typeof o.asOf === "string" ? o.asOf : null,
    computedAt,
  };
}

export interface FlagProgram {
  config: FlagProgramConfig;
  normalise: (input: string) => string | null;
  isNumber: (input: string) => boolean;
  lookup: (input: string) => Promise<FlagCaseRow | null>;
  discover: (caseNumber: string, f?: typeof fetch, now?: Date) => Promise<FlagCaseRow | null>;
  search: (args: SearchFlagArgs) => Promise<FlagCaseRow[]>;
  list: (args: ListFlagArgs) => Promise<FlagListPage>;
  getSummary: () => Promise<FlagSummary | null>;
  /** DOL's decided record from the quarterly file, or null (no file, or not in it). */
  lookupDisclosed: (input: string) => Promise<FlagDisclosedRow | null>;
  /** Decided cases under an employer prefix, newest received first. Empty without a file. */
  searchDisclosed: (args: SearchFlagArgs) => Promise<FlagDisclosedRow[]>;
  getDisclosureSummary: () => Promise<FlagDisclosureSummary | null>;
}

export function makeFlagProgram(config: FlagProgramConfig): FlagProgram {
  const { table } = config;

  const normalise = (input: string): string | null => {
    const raw = input.trim().toUpperCase().replace(/\s+/g, "");
    return config.numberRe.test(raw) ? raw : null;
  };

  const visaClause = (scope: FlagVisaScope | undefined): { cond: string | null; param: string | null } => {
    if ((scope ?? "default") === "default" && config.defaultVisaType) {
      return { cond: "visa_type = ?", param: config.defaultVisaType };
    }
    return { cond: null, param: null };
  };

  const discover = async (
    caseNumber: string,
    f: typeof fetch = fetch,
    now: Date = new Date(),
  ): Promise<FlagCaseRow | null> => {
    // Every failure below is caught and NAMED in the logs; the page renders
    // an ordinary miss, never an error, and never a silent one.
    try {
      if (!(await underDailyBudget(now, config.budgetPrefix))) {
        console.error(`[${config.key}Discovery] daily budget refused`, caseNumber);
        return null;
      }
    } catch (e) {
      console.error(`[${config.key}Discovery] budget write failed:`, e);
      return null;
    }
    const rec = await fetchDolCase(caseNumber, f);
    if (!rec) {
      console.error(`[${config.key}Discovery] DOL returned no exact match`, caseNumber);
      return null;
    }
    const status = rec.caseStatus.trim();
    const isFinal = config.finalStatuses.has(status.toUpperCase());
    const filingDate =
      parseCaseNumber(caseNumber)?.filingDate ?? rec.submittedDate?.slice(0, 10) ?? null;
    const nowIso = now.toISOString();
    const name = rec.employerName?.trim() || null;
    const slug = name ? slugify(name) : null;
    try {
      await exec(
        `INSERT OR IGNORE INTO ${table}
           (case_number, filing_date, current_status, is_final, employer_name,
            employer_slug, job_title, visa_type, submitted_date, first_seen_at,
            last_checked_at, source, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseNumber,
          filingDate,
          status,
          isFinal ? 1 : 0,
          name,
          slug,
          rec.jobTitle,
          rec.visaType,
          rec.submittedDate,
          nowIso,
          nowIso,
          config.discoverySource,
          now.getTime(),
        ],
      );
    } catch (e) {
      console.error(`[${config.key}Discovery] record failed:`, e);
    }
    return {
      caseNumber,
      filingDate,
      status,
      isFinal,
      employerName: name,
      employerSlug: slug,
      jobTitle: rec.jobTitle,
      visaType: rec.visaType,
      submittedDate: rec.submittedDate,
      firstSeenAt: nowIso,
      lastCheckedAt: nowIso,
    };
  };

  const lookup = async (input: string): Promise<FlagCaseRow | null> => {
    const cn = normalise(input);
    if (!cn) return null;
    const r = await one<FlagDbRow>(`SELECT ${FLAG_COLS} FROM ${table} WHERE case_number = ?`, [cn]);
    if (r) return toFlagRow(r);
    return discover(cn);
  };

  const search = async (args: SearchFlagArgs): Promise<FlagCaseRow[]> => {
    const range = slugRange(args.text);
    if (!range) return [];
    const take = Math.min(Math.max(1, Math.floor(args.limit ?? LIVE_SEARCH_MAX)), LIVE_SEARCH_MAX);
    const narrow = narrowingClauses("filing_date", args);
    const conds = ["employer_slug >= ?", "employer_slug < ?", ...narrow.conds];
    const params: (string | number)[] = [range.lo, range.hi, ...narrow.params];
    const visa = visaClause(args.visa);
    if (visa.cond && visa.param) {
      conds.push(visa.cond);
      params.push(visa.param);
    }
    // INDEXED BY, for the reason recorded in cases.ts: without it a status
    // or month narrowing moved the plan onto `<table>_stage (current_status=?)`
    // or `<table>_filed (filing_date>?)`, both of which read the whole slice
    // for every employer in the country. Measured 2026-09-03.
    const found = await rows<FlagDbRow>(
      `SELECT ${FLAG_COLS} FROM ${table} INDEXED BY ${table}_emp ` +
        `WHERE ${conds.join(" AND ")} ` +
        "ORDER BY filing_date DESC, case_number DESC LIMIT ?",
      [...params, take],
    );
    return found.map(toFlagRow);
  };

  const list = async (args: ListFlagArgs): Promise<FlagListPage> => {
    const month = args.month || null;
    const conds: string[] = [];
    const params: (string | number)[] = [];
    if (args.kind === "pending") {
      conds.push("is_final = ?");
      params.push(0);
    } else if (args.kind === "decided") {
      conds.push("is_final = ?");
      params.push(1);
    }
    const narrow = narrowingClauses("filing_date", month ? { from: month, to: month } : {});
    conds.push(...narrow.conds);
    params.push(...narrow.params);
    const visa = visaClause(args.visa);
    if (visa.cond && visa.param) {
      conds.push(visa.cond);
      params.push(visa.param);
    }
    const where = conds.length ? conds.join(" AND ") : "1";
    const n = args.numItems;
    const take =
      n === undefined || !Number.isFinite(n)
        ? FLAG_DEFAULT_ITEMS
        : Math.min(Math.max(1, Math.floor(n)), FLAG_MAX_ITEMS);
    const off = Number(args.cursor ?? 0);
    const offset = Number.isFinite(off) && off >= 0 ? Math.floor(off) : 0;
    const dir = args.order === "oldest" ? "ASC" : "DESC";
    const found = await rows<FlagDbRow>(
      `SELECT ${FLAG_COLS} FROM ${table} WHERE ${where} ` +
        `ORDER BY filing_date ${dir}, case_number ${dir} LIMIT ? OFFSET ?`,
      [...params, take + 1, offset],
    );
    const page = found.slice(0, take).map(toFlagRow);
    return {
      rows: page,
      isDone: found.length <= take,
      continueCursor: String(offset + page.length),
      kind: args.kind,
      month,
    };
  };

  const disclosureTable = config.disclosureTable;

  const lookupDisclosed = async (input: string): Promise<FlagDisclosedRow | null> => {
    if (!disclosureTable) return null;
    const cn = normalise(input);
    if (!cn) return null;
    const r = await one<DisclosedDbRow>(
      `SELECT ${DISCLOSED_COLS} FROM ${disclosureTable} WHERE case_number = ?`,
      [cn],
    );
    return r ? toDisclosed(r) : null;
  };

  const searchDisclosed = async (args: SearchFlagArgs): Promise<FlagDisclosedRow[]> => {
    if (!disclosureTable) return [];
    const range = slugRange(args.text);
    if (!range) return [];
    const take = Math.min(Math.max(1, Math.floor(args.limit ?? LIVE_SEARCH_MAX)), LIVE_SEARCH_MAX);
    // received_date is the file's filing date, and the second column of the
    // ingest's (employer_slug, received_date) index, so the month narrowing
    // and the ordering both ride the same range read.
    const narrow = narrowingClauses("received_date", args);
    const conds = ["employer_slug >= ?", "employer_slug < ?", ...narrow.conds];
    const params: (string | number)[] = [range.lo, range.hi, ...narrow.params];
    if ((args.visa ?? "default") === "default" && config.defaultVisaClass) {
      conds.push("visa_class = ?");
      params.push(config.defaultVisaClass);
    }
    const found = await rows<DisclosedDbRow>(
      `SELECT ${DISCLOSED_COLS} FROM ${disclosureTable} INDEXED BY ${disclosureTable}_emp ` +
        `WHERE ${conds.join(" AND ")} ` +
        "ORDER BY received_date DESC, case_number DESC LIMIT ?",
      [...params, take],
    );
    return found.map(toDisclosed);
  };

  const getDisclosureSummary = cache(async (): Promise<FlagDisclosureSummary | null> => {
    if (!config.disclosureDocKey) return null;
    const r = await one<{ json: string; computed_at: number }>(
      "SELECT json, computed_at FROM perm_docs WHERE key = ?",
      [config.disclosureDocKey],
    );
    if (!r) return null;
    return parseDisclosureSummaryDoc(String(r.json), Number(r.computed_at));
  });

  const getSummary = cache(async (): Promise<FlagSummary | null> => {
    const r = await one<{ json: string; computed_at: number }>(
      "SELECT json, computed_at FROM perm_docs WHERE key = ?",
      [config.docKey],
    );
    if (!r) return null;
    return parseFlagSummaryDoc(String(r.json), Number(r.computed_at), Date.now());
  });

  return {
    config,
    normalise,
    isNumber: (input) => normalise(input) !== null,
    lookup,
    discover,
    search,
    list,
    getSummary,
    lookupDisclosed,
    searchDisclosed,
    getDisclosureSummary,
  };
}
