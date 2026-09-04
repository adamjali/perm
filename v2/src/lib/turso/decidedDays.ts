import "server-only";

import { rows } from "./client";
// ONE slug-range implementation, shared with the case search. A prefix
// computed differently in two readers is an employer whose cases answer
// differently depending on which page asked.
import { slugRange } from "./flagCases";
import { CHANGE_PROGRAMS, type ChangeProgram } from "@/lib/changeProgram";
// The pure half lives in a plain module so the browser can run the same
// coverage arithmetic this file's queries are bounded by.
import {
  daysInRange,
  isIsoDate,
  narrowIsIndexed,
  type DateRange,
  type CoverageWindows,
  type DecidedNarrow,
} from "@/lib/dateCoverage";

export * from "@/lib/dateCoverage";

/**
 * What DOL DECIDED on a given day, from the quarterly disclosure files.
 *
 * WHY THIS EXISTS BESIDE `changes.ts`. That module answers "which cases did we
 * OBSERVE change status on this day", from our own sweep's event log. It is
 * the only record of anything recent, and it cannot reach back before we
 * started watching: 2026-08-26 for PERM, 2026-09-02 for wage requests and
 * LCAs. Nothing can extend it backwards, because DOL returns a case's CURRENT
 * status and never says when it changed.
 *
 * But the published files carry an indexed `decision_date` on every decided
 * case, going back to 2023-10-01. So "what did DOL do on 12 March 2025" IS
 * answerable, in full detail, with the wage and the worksite and the
 * occupation attached. The day picker simply never looked there, which is why
 * it appeared capped at a week.
 *
 * THE TWO DIMENSIONS ARE NEVER SILENTLY MERGED. "Decided on this day" and
 * "changed status on this day" are different questions with different
 * coverage, and a decision is only one of the things the event log records -
 * it also carries RFIs issued, cases put on hold, and appeals opening.
 * Blending them into one undated feed would misstate both. Each is labelled,
 * and `coverageFor` says which one a given date can answer.
 *
 * ## Cost, because Turso bills rows READ
 *
 * An August incident read 11.6 billion rows in two days and got reads blocked.
 * Two rules keep this module bounded:
 *
 * **No `COUNT(*)` over a range.** Counting a year of decisions walks every
 * index entry in it, which is millions of rows for one headline number. An
 * exact count runs only for a SINGLE day, where it is at most a few thousand
 * index entries. A range reports what it fetched and says so.
 *
 * **Every fetch is `LIMIT`-capped and ordered by the indexed column.** The
 * index is on `decision_date`, so SQLite delivers rows already in order and
 * stops at the limit. A ten-year range therefore costs the same as a one-day
 * range - as long as the filter itself is indexed, which is what
 * `RANGE_MAX_DAYS_UNINDEXED` guards.
 */

/** One decided case, as the published file records it. */
export interface DecidedCase {
  caseNumber: string;
  program: ChangeProgram;
  /** The outcome DOL recorded. */
  status: string;
  /** ISO date DOL decided it. */
  decidedOn: string;
  /** ISO date DOL received it, when the file carries one. */
  receivedOn: string | null;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  socCode: string | null;
  socTitle: string | null;
  /** Worksite state. `perm_cases` calls the column `state`. */
  state: string | null;
  /** Offered or prevailing wage, as filed. Annualised is NOT attempted here. */
  wage: number | null;
  /**
   * The period the wage is quoted per: Year, Hour, Week, Bi-Weekly, Month.
   *
   * CARRIED, NOT ASSUMED. An hourly 45 and a yearly 95,000 render identically
   * without it, and DOL files quote both. `perm_cases` has no such column, so
   * PERM rows are null and the page says "as filed" rather than inventing
   * "per year".
   */
  wageUnit: string | null;
  /** PERM only: DOL names the attorney or agent on that file alone. */
  attorneyName: string | null;
  attorneySlug: string | null;
}

export interface DecidedFeed {
  range: DateRange;
  cases: DecidedCase[];
  /**
   * Exact per-program totals, or null when the selection is too wide to count
   * without an unbounded read. Null means "more than we listed", never zero.
   */
  totals: Record<ChangeProgram, number> | null;
  /** True when a program's rows were cut at the cap. */
  capped: boolean;
  /** Set when the range was refused for cost, with the reason in words. */
  refused: string | null;
}

/**
 * Rows per program per fetch.
 *
 * Nobody reads past a thousand rows, and the cap is what keeps a wide range
 * from turning into a several-megabyte response. The busiest single day in the
 * published record holds 3,581 LCA decisions, so a day CAN exceed this and the
 * page says when it did.
 */
export const DECIDED_ROW_CAP = 1000;

/**
 * How wide a range may be when a filter cannot ride an index.
 *
 * A wage bound is a comparison, not an equality, and no index leads with it,
 * so SQLite walks the whole date range testing each row. Bounding that walk to
 * a quarter keeps the worst case near a single busy day's cost. Filters that
 * DO have an index - employer, state, occupation, attorney - are unaffected
 * and may span the whole record.
 */
export const RANGE_MAX_DAYS_UNINDEXED = 92;

/** Column names differ across the three published tables. One map, not three. */
const PUBLISHED: Record<
  ChangeProgram,
  {
    table: string;
    status: string;
    state: string;
    hasAttorney: boolean;
    hasWageUnit: boolean;
  }
> = {
  perm: {
    table: "perm_cases",
    status: "status",
    state: "state",
    hasAttorney: true,
    hasWageUnit: false,
  },
  pwd: {
    table: "pwd_cases",
    status: "case_status",
    state: "worksite_state",
    hasAttorney: false,
    hasWageUnit: true,
  },
  lca: {
    table: "lca_cases",
    status: "case_status",
    state: "worksite_state",
    hasAttorney: false,
    hasWageUnit: true,
  },
};

/**
 * The two windows, measured rather than assumed.
 *
 * ONE AGGREGATE PER STATEMENT, and that is the whole trick. SQLite rewrites a
 * LONE `MIN(x)` or `MAX(x)` over an indexed column into a seek at one end of
 * the index; put BOTH in the same statement and it can no longer do that and
 * scans the whole covering index instead. Measured against production:
 *
 *     SELECT MIN(decision_date), MAX(decision_date) FROM perm_cases
 *       -> SCAN, 373,939 rows read
 *     SELECT MIN(decision_date) FROM perm_cases
 *       -> SEARCH, 1 row read
 *
 * This function asks six tables, so the combined form was reading about 1.45
 * million rows every time `/perm-decision-activity` regenerated - the exact
 * shape that took this database to 11.6 billion rows read in August. Twelve
 * one-row statements cost twelve rows.
 *
 * An earlier version of this comment asserted the combined form was "a seek at
 * each end, not a scan". It is not, and only an EXPLAIN said so.
 *
 * It is deliberately measured on every regeneration rather than hardcoded: the
 * decided window moves when a quarterly file lands, and a fixed date would
 * silently under-report coverage for months.
 */
export async function getCoverageWindows(): Promise<CoverageWindows> {
  const [decided, observed] = await Promise.all([
    Promise.all(
      CHANGE_PROGRAMS.map(async (p) => {
        const [lo, hi] = await Promise.all([
          rows<{ v: string | null }>(
            `SELECT MIN(decision_date) AS v FROM ${PUBLISHED[p].table}`,
          ).catch(() => []),
          rows<{ v: string | null }>(
            `SELECT MAX(decision_date) AS v FROM ${PUBLISHED[p].table}`,
          ).catch(() => []),
        ]);
        return [{ lo: lo[0]?.v ?? null, hi: hi[0]?.v ?? null }];
      }),
    ),
    Promise.all(
      CHANGE_PROGRAMS.map(async (p) => {
        const [lo, hi] = await Promise.all([
          rows<{ v: number | null }>(
            `SELECT MIN(changed_at) AS v FROM ${p}_case_events`,
          ).catch(() => []),
          rows<{ v: number | null }>(
            `SELECT MAX(changed_at) AS v FROM ${p}_case_events`,
          ).catch(() => []),
        ]);
        return [{ lo: lo[0]?.v ?? null, hi: hi[0]?.v ?? null }];
      }),
    ),
  ]);

  let dLo: string | null = null;
  let dHi: string | null = null;
  for (const r of decided) {
    const lo = r[0]?.lo ?? null;
    const hi = r[0]?.hi ?? null;
    if (lo && (!dLo || lo < dLo)) dLo = lo;
    if (hi && (!dHi || hi > dHi)) dHi = hi;
  }

  let oLo: number | null = null;
  let oHi: number | null = null;
  for (const r of observed) {
    const lo = r[0]?.lo == null ? null : Number(r[0].lo);
    const hi = r[0]?.hi == null ? null : Number(r[0].hi);
    if (lo !== null && (oLo === null || lo < oLo)) oLo = lo;
    if (hi !== null && (oHi === null || hi > oHi)) oHi = hi;
  }

  return {
    decided: dLo && dHi ? { from: dLo, to: dHi } : null,
    observed:
      oLo !== null && oHi !== null
        ? {
            from: new Date(oLo).toISOString().slice(0, 10),
            to: new Date(oHi).toISOString().slice(0, 10),
          }
        : null,
  };
}

/** Build the WHERE tail and its arguments for one program. */
function narrowClause(
  program: ChangeProgram,
  n: DecidedNarrow,
): { sql: string; args: unknown[] } | null {
  const meta = PUBLISHED[program];
  const parts: string[] = [];
  const args: unknown[] = [];
  if (n.employer) {
    // A PREFIX RANGE, NOT `LIKE`. LIKE is case-insensitive by default and so
    // cannot use an index on a BINARY-collated column; a range can. `null`
    // means the needle was too short or too long to be served, and the caller
    // turns that into a refusal rather than dropping the filter silently.
    const r = slugRange(n.employer);
    if (!r) return null;
    parts.push("employer_slug >= ? AND employer_slug < ?");
    args.push(r.lo, r.hi);
  }
  if (n.state) {
    parts.push(`${meta.state} = ?`);
    args.push(n.state);
  }
  if (n.socCode) {
    parts.push("soc_code = ?");
    args.push(n.socCode);
  }
  if (n.attorney && meta.hasAttorney) {
    parts.push("attorney_slug = ?");
    args.push(n.attorney);
  }
  if (n.status) {
    parts.push(`${meta.status} = ?`);
    args.push(n.status);
  }
  if (n.minWage !== undefined) {
    parts.push("wage IS NOT NULL AND wage >= ?");
    args.push(n.minWage);
  }
  if (n.maxWage !== undefined) {
    parts.push("wage IS NOT NULL AND wage <= ?");
    args.push(n.maxWage);
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", args };
}

function selectFor(program: ChangeProgram): string {
  const meta = PUBLISHED[program];
  const attorney = meta.hasAttorney
    ? "attorney_name, attorney_slug"
    : "NULL AS attorney_name, NULL AS attorney_slug";
  const unit = meta.hasWageUnit ? "wage_unit" : "NULL AS wage_unit";
  return `SELECT case_number, ${meta.status} AS status, decision_date,
                 received_date, employer_name, employer_slug, job_title,
                 soc_code, soc_title, ${meta.state} AS state, wage, ${unit}, ${attorney}
            FROM ${meta.table}
           WHERE decision_date >= ? AND decision_date <= ?`;
}

function toCase(program: ChangeProgram, r: Record<string, unknown>): DecidedCase {
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s === "" ? null : s;
  };
  return {
    caseNumber: String(r.case_number ?? ""),
    program,
    status: String(r.status ?? ""),
    decidedOn: String(r.decision_date ?? ""),
    receivedOn: str(r.received_date),
    employerName: str(r.employer_name),
    employerSlug: str(r.employer_slug),
    jobTitle: str(r.job_title),
    socCode: str(r.soc_code),
    socTitle: str(r.soc_title),
    state: str(r.state),
    wage: num(r.wage),
    wageUnit: str(r.wage_unit),
    attorneyName: str(r.attorney_name),
    attorneySlug: str(r.attorney_slug),
  };
}

/**
 * The decided cases in a date range, across the requested programs.
 *
 * Ordered newest decision first, then by case number so the order is total and
 * a capped page is reproducible rather than arbitrary.
 */
export async function getDecidedFeed(args: {
  range: DateRange;
  programs?: readonly ChangeProgram[];
  narrow?: DecidedNarrow;
  cap?: number;
}): Promise<DecidedFeed> {
  const { range } = args;
  const narrow = args.narrow ?? {};
  const programs = args.programs ?? CHANGE_PROGRAMS;
  const cap = args.cap ?? DECIDED_ROW_CAP;

  if (!isIsoDate(range.from) || !isIsoDate(range.to) || range.to < range.from) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused: "That is not a valid date range.",
    };
  }

  const span = daysInRange(range);
  if (!narrowIsIndexed(narrow) && span > RANGE_MAX_DAYS_UNINDEXED) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused:
        `A wage filter has to be checked on every case in the range, so it is ` +
        `limited to ${RANGE_MAX_DAYS_UNINDEXED} days. This range is ${span}. ` +
        `Narrow the dates, or drop the wage filter.`,
    };
  }

  // An unservable needle is a REFUSAL, not a dropped filter. Silently ignoring
  // it returns every case in the range under a heading naming one employer,
  // which is worse than an error because it looks like an answer.
  if (narrow.employer && !slugRange(narrow.employer)) {
    return {
      range,
      cases: [],
      totals: null,
      capped: false,
      refused: "That employer name is too short to search. Try two or more characters.",
    };
  }

  const fetched = await Promise.all(
    programs.map(async (p) => {
      const clause = narrowClause(p, narrow);
      if (!clause) return { program: p, r: [] as Record<string, unknown>[] };
      const { sql, args: nArgs } = clause;
      // cap + 1 so a full page is distinguishable from an exactly-full one.
      const r = await rows<Record<string, unknown>>(
        `${selectFor(p)}${sql}
          ORDER BY decision_date DESC, case_number DESC
          LIMIT ?`,
        [range.from, range.to, ...nArgs, cap + 1],
      ).catch(() => []);
      return { program: p, r };
    }),
  );

  let capped = false;
  const cases: DecidedCase[] = [];
  for (const { program, r } of fetched) {
    if (r.length > cap) capped = true;
    for (const row of r.slice(0, cap)) cases.push(toCase(program, row));
  }
  cases.sort((a, b) =>
    a.decidedOn === b.decidedOn
      ? b.caseNumber.localeCompare(a.caseNumber)
      : b.decidedOn.localeCompare(a.decidedOn),
  );

  return {
    range,
    cases,
    totals: span === 1 ? await countDay(range.from, programs, narrow) : null,
    capped,
    refused: null,
  };
}

/**
 * Exact per-program totals for ONE day.
 *
 * A single day is at most a few thousand index entries, so this is affordable
 * and the headline figure ("793 PERM decisions on 25 June") is worth being
 * exact. It is deliberately NOT offered for a range: counting a year walks
 * millions of index entries for one number, which is the read pattern that got
 * this database's reads blocked in August.
 */
async function countDay(
  date: string,
  programs: readonly ChangeProgram[],
  narrow: DecidedNarrow,
): Promise<Record<ChangeProgram, number>> {
  const out: Record<ChangeProgram, number> = { perm: 0, pwd: 0, lca: 0 };
  await Promise.all(
    programs.map(async (p) => {
      const clause = narrowClause(p, narrow);
      if (!clause) return;
      const { sql, args } = clause;
      const r = await rows<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${PUBLISHED[p].table}
          WHERE decision_date >= ? AND decision_date <= ?${sql}`,
        [date, date, ...args],
      ).catch(() => []);
      out[p] = Number(r[0]?.n ?? 0);
    }),
  );
  return out;
}
