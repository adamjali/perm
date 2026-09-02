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

interface DbRow {
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

const COLS =
  "case_number, filing_date, current_status, is_final, employer_name, employer_slug, " +
  "job_title, visa_type, submitted_date, first_seen_at, last_checked_at";

const toRow = (r: DbRow): FlagCaseRow => ({
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
    const r = await one<DbRow>(`SELECT ${COLS} FROM ${table} WHERE case_number = ?`, [cn]);
    if (r) return toRow(r);
    return discover(cn);
  };

  const search = async (args: SearchFlagArgs): Promise<FlagCaseRow[]> => {
    if (args.text.length > 120) return [];
    const needle = slugify(args.text.trim());
    if (needle.length < 2) return [];
    const upper =
      needle.slice(0, -1) + String.fromCharCode(needle.charCodeAt(needle.length - 1) + 1);
    const take = Math.min(Math.max(1, Math.floor(args.limit ?? LIVE_SEARCH_MAX)), LIVE_SEARCH_MAX);
    const narrow = narrowingClauses("filing_date", args);
    const conds = ["employer_slug >= ?", "employer_slug < ?", ...narrow.conds];
    const params: (string | number)[] = [needle, upper, ...narrow.params];
    const visa = visaClause(args.visa);
    if (visa.cond && visa.param) {
      conds.push(visa.cond);
      params.push(visa.param);
    }
    const found = await rows<DbRow>(
      `SELECT ${COLS} FROM ${table} WHERE ${conds.join(" AND ")} ` +
        "ORDER BY filing_date DESC, case_number DESC LIMIT ?",
      [...params, take],
    );
    return found.map(toRow);
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
    const found = await rows<DbRow>(
      `SELECT ${COLS} FROM ${table} WHERE ${where} ` +
        `ORDER BY filing_date ${dir}, case_number ${dir} LIMIT ? OFFSET ?`,
      [...params, take + 1, offset],
    );
    const page = found.slice(0, take).map(toRow);
    return {
      rows: page,
      isDone: found.length <= take,
      continueCursor: String(offset + page.length),
      kind: args.kind,
      month,
    };
  };

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
  };
}
