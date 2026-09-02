import "server-only";
import { cache } from "react";
import { one, rows } from "./client";

/**
 * The live remainder as a BROWSABLE list, and its summary.
 *
 * WHY THIS EXISTS. The site's rule is "storage separate, experience unified":
 * the published half (DOL's quarterly files, decided cases only, through the
 * last quarter) and the live half (DOL's daily check, everything the files do
 * not hold yet) are stored apart, and every page that lists cases is meant to
 * answer from both, labelled. Lookup and search did. The `/perm-cases` browse
 * table and the `/perm-queue/[month]` pages did not: they read the published
 * half only, so a visitor scrolling the table saw June 30 as the newest
 * decision while the corpus held 40,935 newer decisions and 96,157 pending
 * cases (measured 2026-09-02). This module is the read side of closing that.
 *
 * WHAT A LIVE ROW CAN AND CANNOT SAY. DOL's per-case lookup returns status,
 * employer, job title and filing date. It never returns a decision date, a
 * wage, a state, an occupation code or a law firm; those arrive only when DOL
 * publishes the decided case. So this list has the columns a live row HAS,
 * plus `decided_seen`: the day OUR sweep first saw the case in a final status,
 * which is an observation date and is labelled as one. It is null for the
 * ~37k cases that were already decided when the corpus was seeded.
 *
 * COST. `perm_live_recent` is ~137k rows, rebuilt by diff nightly. Every list
 * here is served by one of two indexes, `(is_final, filing_date, case_number)`
 * or `(filing_date, case_number)`, so a page is `take + 1` row reads however
 * deep the offset. The counts come from `perm_docs['live_remainder']`, written
 * by the same nightly build, because a `count(*)` over 137k rows per request
 * is the class of read that got Turso blocked in August.
 */

export type LiveKind = "pending" | "decided" | "all";
export const LIVE_KINDS = ["pending", "decided", "all"] as const;

export function isLiveKind(v: string): v is LiveKind {
  return (LIVE_KINDS as readonly string[]).includes(v);
}

/** `YYYY-MM`, with a real month. `2025-13` and `2025-1` are not months. */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `2025-12` -> `2026-01`. The upper bound of a half-open month range. */
export function monthAfter(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export interface LivePlan {
  /** Everything after WHERE. Never empty: "1" when nothing filters. */
  where: string;
  params: (string | number)[];
}

/**
 * Turn a kind and an optional month into a WHERE clause.
 *
 * The month range is HALF-OPEN: `>= first of month AND < first of next`.
 * A closed range on the last day (`<= 2025-12-31`) reads right and is right
 * for a date column, but this one is compared as text and a later ingest
 * could carry a timestamp; the half-open form is correct under both.
 */
export function planLiveSql(kind: LiveKind, month: string | null | undefined): LivePlan {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (kind === "pending") {
    conds.push("is_final = ?");
    params.push(0);
  } else if (kind === "decided") {
    conds.push("is_final = ?");
    params.push(1);
  }
  if (month) {
    if (!MONTH_RE.test(month)) throw new Error(`not a month: ${month}`);
    conds.push("filing_date >= ?", "filing_date < ?");
    params.push(`${month}-01`, `${monthAfter(month)}-01`);
  }
  return { where: conds.length ? conds.join(" AND ") : "1", params };
}

export interface LiveListRow {
  caseNumber: string;
  filingDate: string | null;
  status: string | null;
  isFinal: boolean;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  /** The day our sweep first saw a final status. Observation, not DOL's date. */
  decidedSeen: string | null;
}

interface LiveListDbRow {
  case_number: string;
  filing_date: string | null;
  status: string | null;
  is_final: number | string;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
  decided_seen: string | null;
}

export interface LiveListArgs {
  kind: LiveKind;
  month?: string | null;
  order?: "newest" | "oldest";
  numItems?: number;
  cursor?: string | null;
}

export interface LiveListPage {
  rows: LiveListRow[];
  isDone: boolean;
  continueCursor: string;
  kind: LiveKind;
  month: string | null;
  order: "newest" | "oldest";
}

export const LIVE_DEFAULT_ITEMS = 50;
export const LIVE_MAX_ITEMS = 200;

function clamp(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return LIVE_DEFAULT_ITEMS;
  return Math.min(Math.max(1, Math.floor(n)), LIVE_MAX_ITEMS);
}

/** Offset cursor, same contract as the published table. Garbage reads as 0. */
function parseCursor(cursor: string | null | undefined): number {
  const n = Number(cursor ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

const LIVE_COLS =
  "case_number, filing_date, status, is_final, employer_name, employer_slug, job_title, decided_seen";

const toRow = (r: LiveListDbRow): LiveListRow => ({
  caseNumber: r.case_number,
  filingDate: r.filing_date,
  status: r.status,
  // libSQL may hand an integer back as a string; Boolean("0") is true.
  isFinal: Number(r.is_final) === 1,
  employerName: r.employer_name,
  employerSlug: r.employer_slug,
  jobTitle: r.job_title,
  decidedSeen: r.decided_seen,
});

/**
 * One page of the live remainder.
 *
 * `ORDER BY filing_date, case_number` in ONE direction: filing_date alone has
 * thousands of ties (a busy day is 500 filings), and LIMIT/OFFSET over a
 * non-total order can repeat or skip rows between pages. The case number is
 * unique, so the pair is a total order the index can serve without a sort.
 */
export async function listLiveCases(args: LiveListArgs): Promise<LiveListPage> {
  const month = args.month || null;
  const plan = planLiveSql(args.kind, month);
  const take = clamp(args.numItems);
  const offset = parseCursor(args.cursor);
  const order = args.order === "oldest" ? "oldest" : "newest";
  const dir = order === "oldest" ? "ASC" : "DESC";

  const found = await rows<LiveListDbRow>(
    `SELECT ${LIVE_COLS} FROM perm_live_recent WHERE ${plan.where} ` +
      `ORDER BY filing_date ${dir}, case_number ${dir} LIMIT ? OFFSET ?`,
    [...plan.params, take + 1, offset],
  );

  const page = found.slice(0, take).map(toRow);
  return {
    rows: page,
    isDone: found.length <= take,
    continueCursor: String(offset + page.length),
    kind: args.kind,
    month,
    order,
  };
}

// ---------------------------------------------------------------------------
// The summary doc
// ---------------------------------------------------------------------------

export interface LiveRemainderMonth {
  month: string;
  total: number;
  pending: number;
  decided: number;
}

export interface LiveRemainderSummary {
  total: number;
  pending: number;
  decided: number;
  certified: number;
  denied: number;
  withdrawn: number;
  /** The last decision date in DOL's published files, `YYYY-MM-DD`. */
  publishedThrough: string | null;
  /** When the nightly build computed it, ISO. */
  asOf: string | null;
  /** Every filing month with live rows, busiest first. */
  byMonth: LiveRemainderMonth[];
  /** ms epoch of the perm_docs write. */
  computedAt: number;
}

/**
 * Same posture as the live census: a doc older than eight days is treated
 * as absent. The build runs nightly; eight days of silence means the sweep
 * or the build has been failing for a week, and a count that says "as of
 * last week" under a heading that says "live" is the misleading case.
 */
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function parseLiveRemainderDoc(
  json: string,
  computedAt: number,
  now: number,
): LiveRemainderSummary | null {
  if (!Number.isFinite(computedAt) || now - computedAt > MAX_AGE_MS) return null;
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const nums = ["total", "pending", "decided", "certified", "denied", "withdrawn"] as const;
  for (const k of nums) if (!isInt(o[k])) return null;
  if (!Array.isArray(o.byMonth)) return null;
  const byMonth: LiveRemainderMonth[] = [];
  for (const m of o.byMonth) {
    if (!m || typeof m !== "object") return null;
    const r = m as Record<string, unknown>;
    if (typeof r.month !== "string" || !isInt(r.total) || !isInt(r.pending) || !isInt(r.decided)) {
      return null;
    }
    byMonth.push({ month: r.month, total: r.total, pending: r.pending, decided: r.decided });
  }
  return {
    total: o.total as number,
    pending: o.pending as number,
    decided: o.decided as number,
    certified: o.certified as number,
    denied: o.denied as number,
    withdrawn: o.withdrawn as number,
    publishedThrough: typeof o.publishedThrough === "string" ? o.publishedThrough : null,
    asOf: typeof o.asOf === "string" ? o.asOf : null,
    byMonth,
    computedAt,
  };
}

/** One doc read per render, deduped by React's cache(). */
export const getLiveRemainderSummary = cache(async (): Promise<LiveRemainderSummary | null> => {
  const r = await one<{ json: string; computed_at: number }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = 'live_remainder'",
  );
  if (!r) return null;
  return parseLiveRemainderDoc(String(r.json), Number(r.computed_at), Date.now());
});
