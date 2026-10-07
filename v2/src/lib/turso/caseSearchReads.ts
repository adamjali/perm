import "server-only";

import { one, rows } from "./client";
import { TEST_FIXTURE_EMPLOYER } from "./rfi";
import {
  CASE_COLS,
  narrowingClauses,
  toCaseRow,
  toLiveRow,
  type CaseDbRow,
  type LiveCaseRow,
  type LiveDbRow,
  type PermCaseRow,
} from "./cases";
import {
  DISCLOSED_COLS,
  FLAG_COLS,
  slugRange,
  toDisclosed,
  toFlagRow,
  type DisclosedDbRow,
  type FlagCaseRow,
  type FlagDbRow,
  type FlagDisclosedRow,
} from "./flagCases";
import type { Lead, Outcome, WageSourceKey } from "@/lib/caseSearchPlan";
import type { ChangeProgram } from "@/lib/changeProgram";
import { tableColumns } from "./tableColumns";
import { FLAG_ANNUAL_WAGE_SQL } from "./lcaWages";

/**
 * Every read the unified case search makes, and the index each one rides.
 *
 * ONE FILE FOR ONE REASON: the query PLAN is the load-bearing part, not the
 * SQL text, and a plan is decided by which column leads. Keeping all six
 * shapes here means one test can assert every SQL string this feature emits
 * and one reviewer can see whether any of them can degenerate.
 *
 * ## Why every statement names its index
 *
 * This database carries no `sqlite_stat1`, so SQLite plans from its
 * no-statistics heuristics, which prefer an EQUALITY over a RANGE. Measured
 * against production, an employer search with a status filter and no hint
 * planned as
 *
 *     SEARCH perm_cases USING INDEX idx_pc_status_dec (status=?)
 *
 * which reads every certified case in the corpus - about a quarter of a
 * million rows - and discards the ones belonging to other companies.
 * `state`, `fiscal_year` and, on the live tables, `filing_date` and
 * `current_status` all stole the plan the same way. `INDEXED BY` pins each
 * read to its lead, and it fails loudly if an index is ever dropped instead
 * of quietly turning into a scan.
 *
 * ## Which leads exist, and what each may be narrowed by
 *
 * See `src/lib/caseSearchPlan.ts` for the measured table. In short: an
 * EQUALITY lead lets the index supply `ORDER BY <date> DESC`, so `LIMIT`
 * stops the read at a hundred rows however selective the filters are. A RANGE
 * lead, and any filter the index does not carry, walks the whole slice - fine
 * for an employer (3,847 rows at Amazon, 5.69 s worst case) and not fine for a
 * state (67,742 rows in California, 44.72 s). So the three equality leads
 * accept only the outcome and a decided-date range, which are literally the
 * next two columns of `idx_pc_state_st_dec` and its siblings.
 */

/**
 * The non-PERM programs. `seasonal` is H-2A and H-2B (`H-300-`, `H-400-`,
 * `P-400-`): a live table only, because DOL's quarterly H-2A and H-2B files
 * are not loaded, so every published read for it answers empty.
 */
export type FlagProgramKey = "pwd" | "lca" | "seasonal";

export interface UnifiedNarrow {
  outcome?: Outcome;
  /** Case-insensitive "contains" on the job title. `%` and `_` are literal. */
  title?: string;
  /**
   * A DOL review stage as its status string and program, e.g.
   * `{ status: "APPLICATION ON HOLD", program: "perm" }`. Live record only:
   * applied with an employer lead through `readPermEmployerStage` or
   * `readFlagEmployerStage`; as a lead of its own it is `readPermStage` or
   * `readFlagStage`.
   */
  stage?: { status: string; program: "perm" | "pwd" | "lca" };
  /** Filing month, `YYYY-MM`, inclusive both ends. */
  from?: string;
  to?: string;
  /** Decision month, `YYYY-MM`, inclusive both ends. */
  decidedFrom?: string;
  decidedTo?: string;
  /**
   * A resolved `attorney_slug`. Published PERM only, because PERM is the only
   * program whose firm column this site has ingested - not because DOL keeps
   * it. `LAWFIRM_NAME_BUSINESS_NAME` is in the ETA-9035 and ETA-9141 FY2026 Q3
   * record layouts too.
   */
  firmSlug?: string;
  /** Two-letter worksite state. Published halves only. */
  state?: string;
  /** SOC code, `15-1252.00`. Published halves only. */
  socCode?: string;
  /** DOL fiscal year, `2025`. Published halves only. */
  fiscalYear?: string;
  /** Annualised wage bounds. Published halves only. */
  wageMin?: number;
  wageMax?: number;
  /**
   * The employer's NAICS code, as a PREFIX: `54` is the sector, `5415` a
   * group, `541511` one industry. Published PERM only, 2 to 6 digits.
   */
  naics?: string;
  /** Worksite city, compared case-insensitively. Published PERM only. */
  city?: string;
  /**
   * The worker's country of citizenship, of birth, and visa at filing, UPPER
   * CASE as DOL prints them. Published PERM only, and only on cases filed on
   * DOL's old form: the form in use since mid-2023 does not carry them.
   */
  citizenship?: string;
  birthCountry?: string;
  visaClass?: string;
  /** The worker's education and the job's minimum, compared case-insensitively. Old-form only. */
  education?: string;
  jobEducation?: string;
  /**
   * Where the prevailing wage came from (Section F of the ETA-9035). Published
   * LCAs only: no other record names it, so a search that sets it reads the
   * LCA file alone.
   */
  wageSource?: WageSourceKey;
  /**
   * Which end of the decided record the published PERM reads take. `desc`
   * (the default) is the newest hundred decisions; `asc` the OLDEST, which is
   * the only way to reach an employer's FY2016 cases when it has thousands
   * since. Both are exact: the index ends in `decision_date`, so SQLite walks
   * it from either end.
   */
  decidedOrder?: "asc" | "desc";
}

/**
 * The status strings behind each outcome bucket, per table.
 *
 * MEASURED, NOT REMEMBERED: read from the tables themselves and from the two
 * live summary docs:
 *
 *   perm_cases        certified | denied | withdrawn                (lower case)
 *   perm_live_recent  ANALYST REVIEW | RFI ISSUED | CERTIFIED | DENIED | WITHDRAWN
 *   pwd_cases         DETERMINATION ISSUED | WITHDRAWN | REDETERMINATION AFFIRMED
 *                     | REDETERMINATION MODIFIED
 *                     | CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION
 *                     | CENTER DIRECTOR REVIEW MODIFIED DETERMINATION
 *   pwd_case_status   the above plus IN PROCESS | RFI ISSUED | RETURNED UNPROCESSED
 *                     | PENDING REDETERMINATION | PENDING CENTER DIRECTOR REVIEW
 *   lca_cases         CERTIFIED | CERTIFIED - WITHDRAWN | WITHDRAWN | DENIED
 *   lca_case_status   CERTIFIED | WITHDRAWN | DENIED | IN PROCESS
 *
 * `RETURNED UNPROCESSED` is in no bucket on purpose: DOL neither granted nor
 * denied it and neither did the employer withdraw it, so filing it under one
 * of those would be an invention. It still shows in an unfiltered search.
 *
 * `CERTIFIED - EXPIRED` counts as granted: DOL certified the case, and the
 * 180-day I-140 window then lapsed. That is a clock running out, not a refusal.
 */
type DecidedOutcome = Exclude<Outcome, "open">;
type StatusBuckets = Record<DecidedOutcome, string[]>;

/**
 * Keyed explicitly rather than as a `Record<string, ...>` so
 * `noUncheckedIndexedAccess` cannot force a `!` on every read: a non-null
 * assertion here would be the one place a typo in a table key turns into a
 * runtime crash instead of a compile error.
 */
export const OUTCOME_STATUSES: {
  perm_cases: StatusBuckets;
  perm_live: StatusBuckets;
  pwd: StatusBuckets;
  lca: StatusBuckets;
  seasonal: StatusBuckets;
} = {
  perm_cases: {
    granted: ["certified"],
    denied: ["denied"],
    withdrawn: ["withdrawn"],
  },
  perm_live: {
    granted: ["CERTIFIED", "CERTIFIED - EXPIRED"],
    denied: ["DENIED"],
    withdrawn: ["WITHDRAWN"],
  },
  pwd: {
    granted: [
      "DETERMINATION ISSUED",
      "REDETERMINATION AFFIRMED",
      "REDETERMINATION MODIFIED",
      "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
      "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
    ],
    denied: ["DENIED"],
    withdrawn: ["WITHDRAWN"],
  },
  lca: {
    granted: ["CERTIFIED"],
    denied: ["DENIED"],
    withdrawn: ["WITHDRAWN", "CERTIFIED - WITHDRAWN", "CERTIFIED-WITHDRAWN"],
  },
  // seasonal_case_status, read off the table. An expired
  // certification counts as granted, as PERM's does: DOL certified it and the
  // period then ran out. BALCA OVERTURNED is left out: the board reversed a
  // wage decision, which is neither a grant nor a refusal of the filing.
  seasonal: {
    granted: [
      "FULL CERTIFICATION",
      "PARTIAL CERTIFICATION",
      "FULL CERTIFICATION - EXPIRED",
      "PARTIAL CERTIFICATION - EXPIRED",
      "DETERMINATION ISSUED",
      "REDETERMINATION AFFIRMED",
      "REDETERMINATION MODIFIED",
      "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
      "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
      // seasonal_cases, DOL's quarterly files, which print the decision as
      // "Determination Issued - ...". A certification DOL returned (H-2B's
      // "(Returned)") was still granted.
      "DETERMINATION ISSUED - CERTIFICATION",
      "DETERMINATION ISSUED - CERTIFICATION (EXPIRED)",
      "DETERMINATION ISSUED - CERTIFICATION (RETURNED)",
      "DETERMINATION ISSUED - PARTIAL CERTIFICATION",
      "DETERMINATION ISSUED - PARTIAL CERTIFICATION (EXPIRED)",
      "DETERMINATION ISSUED - PARTIAL CERTIFICATION (RETURNED)",
    ],
    denied: ["DENIED", "DETERMINATION ISSUED - DENIED", "DETERMINATION ISSUED - REJECTED"],
    withdrawn: [
      "WITHDRAWN",
      "FULL CERTIFICATION - WITHDRAWN",
      "PARTIAL CERTIFICATION - WITHDRAWN",
      "DETERMINATION ISSUED - WITHDRAWN",
    ],
  },
};

/**
 * A status predicate for a bucket.
 *
 * A single value becomes `col = ?` rather than `col IN (?)` because that is
 * what makes `idx_pc_state_st_dec (state, status, decision_date)` seek on both
 * columns; the measured plan is `(state=? AND status=?)`, with no temp b-tree
 * for the ordering. An `IN` over several values cannot do that, which is why
 * only PERM's published half - the only one whose buckets are one status each
 * - is ever used behind an equality lead.
 */
function statusClause(
  column: string,
  values: string[],
): { cond: string; params: string[] } {
  if (values.length === 1) return { cond: `${column} = ?`, params: values };
  return {
    cond: `${column} IN (${values.map(() => "?").join(", ")})`,
    params: values,
  };
}

/** Title, filed range and decided range, over the two date columns a table uses. */
function commonNarrowing(
  narrow: UnifiedNarrow,
  filedColumn: string,
  decidedColumn: string | null,
): { conds: string[]; params: string[] } {
  const conds: string[] = [];
  const params: string[] = [];
  // Called three times rather than once because `narrowingClauses` takes ONE
  // date column, and the filed range and the decided range are two different
  // columns on the same row. Passing the title only on the first call keeps it
  // from being emitted three times.
  const t = narrowingClauses(filedColumn, narrow.title ? { title: narrow.title } : {});
  conds.push(...t.conds);
  params.push(...t.params);

  const filed = narrowingClauses(filedColumn, {
    ...(narrow.from ? { from: narrow.from } : {}),
    ...(narrow.to ? { to: narrow.to } : {}),
  });
  conds.push(...filed.conds);
  params.push(...filed.params);

  if (decidedColumn && (narrow.decidedFrom || narrow.decidedTo)) {
    const decided = narrowingClauses(decidedColumn, {
      ...(narrow.decidedFrom ? { from: narrow.decidedFrom } : {}),
      ...(narrow.decidedTo ? { to: narrow.decidedTo } : {}),
    });
    conds.push(...decided.conds);
    params.push(...decided.params);
  }
  return { conds, params };
}

/**
 * How many of an employer's newest filings one program's read will look at
 * when a filter has to be applied row by row.
 *
 * MEASURED on the site's own database: the newest 2,000 filings of one of
 * the largest sponsors read in 8 ms (PERM) and 37 ms (LCA), so the window is
 * 5,000: nearly
 * every employer's whole history, and a search stays well under a second.
 */
export const SLICE_CAP = 5000;

export interface SliceResult<T> {
  rows: T[];
  /**
   * The filters ran inside a window of this employer's newest filings rather
   * than over everything they have filed. The page says so; a narrowed answer
   * that quietly came from a window is a wrong answer with a confident face.
   */
  windowed: boolean;
}

interface EmployerSlicePlan {
  table: string;
  /**
   * The index pass one is pinned to. `null` lets SQLite choose, which is what
   * `perm_cases_history` gets: its indexes may be dropped to save writes, and
   * an `INDEXED BY` naming a missing index fails the statement outright.
   */
  index: string | null;
  /** Which end of the date the reads take. Newest first unless asked. */
  dir?: "ASC" | "DESC";
  columns: string;
  /** The date the index ends in, which is therefore the free ordering. */
  orderColumn: string;
  /** Half-open slug range for the employer prefix. */
  range: { lo: string; hi: string };
  /** Conditions the index itself carries, so the first pass can apply them. */
  coveredConds: string[];
  coveredParams: (string | number)[];
  /** Everything else, applied to the rows the first pass picked out. */
  restConds: string[];
  restParams: (string | number)[];
  limit: number;
}

/**
 * An employer's newest filings, in two passes, because one pass is 55x slower.
 *
 * THE MEASUREMENT THAT FORCED THIS. An employer prefix is a RANGE on the
 * leading index column, so the index cannot supply `ORDER BY <date> DESC` and
 * SQLite has to read the employer's whole slice and sort it. Reading it as
 * TABLE ROWS is what costs: Amazon's 20,230 rows in `lca_cases` took
 * **137.5 s**, blew the read layer's 20 s deadline twice and threw, so that
 * source was silently dropped from the answer by the per-source catch.
 *
 * The same slice read through the COVERING index - the first pass below,
 * which selects `rowid` and nothing else - is **2.9 s**, and the whole
 * two-pass query measured **2.50 s** returning the same hundred rows. The
 * sort was never the problem; twenty thousand row lookups were.
 *
 *     pass 1  SEARCH lca_cases USING COVERING INDEX lca_cases_emp (...)
 *     pass 2  SEARCH lca_cases USING INTEGER PRIMARY KEY (rowid=?)
 *
 * Only the conditions the index carries can ride pass one and stay covering,
 * which is why the plan splits them. Everything else runs in pass two against
 * at most `SLICE_CAP` rows, and when pass one filled that window the result
 * says `windowed` so the page can tell the reader the filter was applied
 * inside it.
 *
 * The three equality leads do NOT come through here and must not: an equality
 * lets the index supply the ordering, so their `LIMIT` already stops the read
 * at a hundred rows (0.30 s for the whole of California).
 */
async function readEmployerSlice<Db, Out>(
  plan: EmployerSlicePlan,
  map: (r: Db) => Out,
): Promise<SliceResult<Out>> {
  const hasRest = plan.restConds.length > 0;
  const window = hasRest ? SLICE_CAP : plan.limit;
  const dir = plan.dir ?? "DESC";
  const pin = plan.index ? `INDEXED BY ${plan.index} ` : "";

  const firstConds = [
    `${"employer_slug"} >= ?`,
    `${"employer_slug"} < ?`,
    ...plan.coveredConds,
  ];
  const ids = await rows<{ rowid: number }>(
    `SELECT rowid FROM ${plan.table} ${pin}` +
      `WHERE ${firstConds.join(" AND ")} ` +
      `ORDER BY ${plan.orderColumn} ${dir} LIMIT ?`,
    [plan.range.lo, plan.range.hi, ...plan.coveredParams, window],
  );
  if (ids.length === 0) return { rows: [], windowed: false };

  // `NOT INDEXED` ON THE SECOND PASS, AND IT IS THE SAME DEFECT ONE LEVEL DOWN.
  // Without it SQLite planned the rowid fetch as
  // `SEARCH lca_case_status USING INDEX lca_case_status_stage (current_status=?)`
  // - it read every CERTIFIED LCA in the table, 287,881 rows, and used the
  // rowid list as a filter. Measured 30.63 s, against 1.04 s once the index was
  // forbidden. `NOT INDEXED` still permits the INTEGER PRIMARY KEY path, which
  // is the whole point of this statement, and unlike a `+` on each term it
  // cannot be undone by someone adding a filter here later.
  const placeholders = ids.map(() => "?").join(", ");
  const conds = [`rowid IN (${placeholders})`, ...plan.restConds];
  const found = await rows<Db>(
    `SELECT ${plan.columns} FROM ${plan.table} NOT INDEXED WHERE ${conds.join(" AND ")} ` +
      `ORDER BY ${plan.orderColumn} ${dir}, case_number ${dir} LIMIT ?`,
    [...ids.map((r) => r.rowid), ...plan.restParams, plan.limit],
  );
  return { rows: found.map(map), windowed: hasRest && ids.length >= SLICE_CAP };
}

// ---------------------------------------------------------------------------
// PERM, published (DOL's quarterly disclosure files)
// ---------------------------------------------------------------------------

/**
 * The index a lead rides on `perm_cases`, and whether the outcome joins the seek.
 *
 * Exported for the test, which asserts the choice rather than reading it back
 * out of the SQL: the pairing of lead to index IS the feature, and a test that
 * only checks the string would pass over a swap of two index names.
 */
export function permLeadIndex(
  lead: Lead,
  hasOutcome: boolean,
  narrow: UnifiedNarrow = {},
): string {
  // A SECOND EQUALITY BEATS THE OUTCOME, because it is far more selective.
  // Measured on the biggest firm in the corpus: `attorney_slug + state='WY'`
  // read 48,166 rows in 17.11 s through `idx_pc_att_dec` (walking the firm's
  // whole slice to return four rows) and 5 rows in 0.55 s through
  // `idx_pc_att_state_dec`. `state='CA' + a rare SOC` went 67,743 rows / 8.82 s
  // -> 0 rows / 0.43 s. An outcome bucket cannot come close to that, so when
  // both are present the pair of equalities wins and the status is tested on
  // the handful of rows the composite already narrowed to.
  const hasState = narrow.state !== undefined && narrow.state !== "";
  const hasSoc = narrow.socCode !== undefined && narrow.socCode !== "";
  const hasFirm = narrow.firmSlug !== undefined && narrow.firmSlug !== "";

  switch (lead.kind) {
    case "stage":
      throw new Error("a stage lead reads the live record only; it never reaches the published index");
    case "employer":
      // A RANGE, so the status column of the three-column index can never be
      // seeked. The narrower index is the cheaper walk.
      return "idx_pc_emp_dec";
    case "firm":
      if (hasState) return "idx_pc_att_state_dec";
      if (hasSoc) return "idx_pc_att_soc_dec";
      return hasOutcome ? "idx_pc_att_st_dec" : "idx_pc_att_dec";
    case "state":
      if (hasSoc) return "idx_pc_state_soc_dec";
      if (hasFirm) return "idx_pc_att_state_dec";
      return hasOutcome ? "idx_pc_state_st_dec" : "idx_pc_state_dec";
    case "occupation":
      if (hasState) return "idx_pc_state_soc_dec";
      if (hasFirm) return "idx_pc_att_soc_dec";
      // The `socg` pair is on `substr(soc_code, 1, 7)`, matching the WHERE
      // clause. The older `idx_pc_soc_dec` is on the bare column and cannot
      // serve the expression, so pinning it would force a scan of the whole
      // index while looking like a seek in the code.
      return hasOutcome ? "idx_pc_socg_st_dec" : "idx_pc_socg_dec";
    case "case":
      // A point read on the primary key; this function is never asked.
      return "sqlite_autoindex_perm_cases_1";
  }
}

export interface PermReadArgs {
  lead: Lead;
  narrow: UnifiedNarrow;
  limit: number;
}

/**
 * Published PERM cases under one lead.
 *
 * Ordered by `decision_date DESC` because that is the last column of every
 * index above, so the ordering is free on an equality lead. Ordering by the
 * filing date instead would move the plan onto `idx_pc_received` and undo the
 * whole arrangement.
 *
 * TWO SHAPES, because the two leads cost differently. An equality lead is one
 * indexed statement whose `LIMIT` stops the read at a hundred rows. An
 * employer prefix is a range, so it goes through `readEmployerSlice` and its
 * two passes; see the measurement there.
 */
/** The two tables published PERM lives in. */
export type PermTable = "perm_cases" | "perm_cases_history";
export const HISTORY_TABLE: PermTable = "perm_cases_history";

/**
 * The first decision day `perm_cases` holds, FY2024's first day. Everything
 * decided before it is in `perm_cases_history` (FY2016 on) or nowhere, so a
 * date or fiscal-year filter that falls wholly on one side reads one table.
 */
export const CURRENT_DECIDED_FROM = "2023-10-01";
const CURRENT_FIRST_FY = 2024;

/**
 * The columns beyond the fifteen every published PERM row has always had.
 * Filled by the loaders from DOL's files; the worker's five are on OLD-form
 * cases only. See `tableColumns` for why their presence is asked, not assumed.
 */
export const PERM_EXTRA_COLS = [
  "naics",
  "worksite_city",
  "citizenship",
  "birth_country",
  "visa_class",
  "education",
  "major",
  "institution",
  "job_education",
] as const;
type ExtraCol = (typeof PERM_EXTRA_COLS)[number];

export interface PermExtras {
  naics: string | null;
  worksiteCity: string | null;
  citizenship: string | null;
  birthCountry: string | null;
  visaClass: string | null;
  education: string | null;
  major: string | null;
  institution: string | null;
  jobEducation: string | null;
}

export type SearchDbRow = CaseDbRow & Partial<Record<ExtraCol, string | null>>;

/** A published PERM row with the extra columns and the table it came from. */
export type PermSearchRow = PermCaseRow & { extras: PermExtras; table: PermTable };

/** `CASE_COLS` plus each extra column, or a NULL in its place when the table lacks it. */
export function searchColumns(present: Set<string>): string {
  return [
    CASE_COLS,
    ...PERM_EXTRA_COLS.map((c) => (present.has(c) ? c : `NULL AS ${c}`)),
  ].join(", ");
}

const toSearchRow =
  (table: PermTable) =>
  (r: SearchDbRow): PermSearchRow => ({
    ...toCaseRow(r),
    table,
    extras: {
      naics: r.naics ?? null,
      worksiteCity: r.worksite_city ?? null,
      citizenship: r.citizenship ?? null,
      birthCountry: r.birth_country ?? null,
      visaClass: r.visa_class ?? null,
      education: r.education ?? null,
      major: r.major ?? null,
      institution: r.institution ?? null,
      jobEducation: r.job_education ?? null,
    },
  });

/** Upper case with runs of whitespace collapsed, the form every needle below is compared in. */
export function foldText(v: string): string {
  return v.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * The industry, city and worker filters as SQL, or `impossible` when this
 * table lacks a column one of them needs: a filter the table cannot answer
 * matches nothing there, rather than being quietly ignored.
 *
 * None of these columns is indexed on `perm_cases`, so each is a per-row test
 * against whatever the lead's index already narrowed to, the same cost shape
 * as the title filter. `citizenship` is compared as stored (upper case, and
 * `perm_cases_history` indexes it); the free-text columns fold both sides.
 */
export function extraNarrowing(
  narrow: UnifiedNarrow,
  present: Set<string>,
): { conds: string[]; params: (string | number)[]; impossible: boolean } {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  let impossible = false;
  const need = (col: ExtraCol) => {
    if (!present.has(col)) impossible = true;
  };
  if (narrow.naics) {
    need("naics");
    // A SECTOR RANGE such as `31-33`: Census gives Manufacturing three 2-digit
    // codes under one title, so the sector is all three.
    const range = /^(\d{2})-(\d{2})$/.exec(narrow.naics);
    const lo = range ? Number(range[1]) : 0;
    const hi = range ? Number(range[2]) : 0;
    if (range && lo <= hi && hi - lo <= 9) {
      const codes: string[] = [];
      for (let c = lo; c <= hi; c++) codes.push(String(c));
      conds.push(`substr(naics, 1, 2) IN (${codes.map(() => "?").join(", ")})`);
      params.push(...codes);
    } else if (/^\d{2,6}$/.test(narrow.naics)) {
      // A prefix, compared by length rather than with LIKE: a code is digits
      // only, and `substr` says exactly what is meant.
      conds.push("substr(naics, 1, ?) = ?");
      params.push(narrow.naics.length, narrow.naics);
    } else {
      impossible = true;
    }
  }
  if (narrow.city) {
    need("worksite_city");
    conds.push("upper(worksite_city) = ?");
    params.push(foldText(narrow.city));
  }
  if (narrow.citizenship) {
    need("citizenship");
    conds.push("citizenship = ?");
    params.push(foldText(narrow.citizenship));
  }
  if (narrow.birthCountry) {
    need("birth_country");
    conds.push("birth_country = ?");
    params.push(foldText(narrow.birthCountry));
  }
  if (narrow.visaClass) {
    need("visa_class");
    conds.push("upper(visa_class) = ?");
    params.push(foldText(narrow.visaClass));
  }
  if (narrow.education) {
    need("education");
    conds.push("upper(education) = ?");
    params.push(foldText(narrow.education));
  }
  if (narrow.jobEducation) {
    need("job_education");
    conds.push("upper(job_education) = ?");
    params.push(foldText(narrow.jobEducation));
  }
  return { conds, params, impossible };
}

/**
 * A PERM fiscal year as the decided months it spans. DOL files a determination
 * in the fiscal year it was DECIDED (Oct 1 to Sep 30), so FY2019 is decisions
 * from 2018-10 through 2019-09 (measured: A-18318-41042, decided 2019-02-12,
 * fiscal_year 2019). Null for anything that is not a plausible year.
 */
export function fiscalYearMonths(fy: string | undefined): { from: string; to: string } | null {
  const n = Number(fy);
  if (!fy || !Number.isInteger(n) || n < 2000 || n > 2100) return null;
  return { from: `${n - 1}-10`, to: `${n}-09` };
}

/** Whether a filter set can match anything in the current table, or in history. */
export function permTablesFor(narrow: UnifiedNarrow): { current: boolean; history: boolean } {
  let current = true;
  let history = true;
  if (narrow.fiscalYear) {
    const fy = Number(narrow.fiscalYear);
    current = fy >= CURRENT_FIRST_FY;
    history = fy < CURRENT_FIRST_FY;
  }
  // Decided months, `YYYY-MM`: the current table starts in 2023-10.
  if (narrow.decidedTo && narrow.decidedTo < CURRENT_DECIDED_FROM.slice(0, 7)) current = false;
  if (narrow.decidedFrom && narrow.decidedFrom >= CURRENT_DECIDED_FROM.slice(0, 7)) history = false;
  return { current, history };
}

/**
 * Published PERM cases under one lead, from the current table and the history
 * together, merged in decision order.
 *
 * Each table is read exactly as the current one always was (the history
 * unpinned, see `readPermTable`), each capped at `limit`, then the two lists
 * are merged and cut to `limit` again. A case that DOL decided in both eras
 * (reconsidered, then decided again) is kept once, from the current table.
 *
 * A table the filters rule out is not read at all: a fiscal year or a decided
 * range on one side of FY2024 costs nothing on the other.
 */
export async function readPermPublished(args: PermReadArgs): Promise<SliceResult<PermSearchRow>> {
  if (args.narrow.outcome === "open") return { rows: [], windowed: false };
  const want = permTablesFor(args.narrow);
  const [cur, hist] = await Promise.all([
    tableColumns("perm_cases"),
    want.history ? tableColumns(HISTORY_TABLE) : Promise.resolve(new Set<string>()),
  ]);
  const none: SliceResult<PermSearchRow> = { rows: [], windowed: false };
  // An unknown answer about the current table (an empty set) still means the
  // table is there: only the extra columns are in doubt, so they read as NULL.
  const [a, b] = await Promise.all([
    want.current ? readPermTable("perm_cases", cur, args) : Promise.resolve(none),
    want.history && hist.size > 0 ? readPermTable(HISTORY_TABLE, hist, args) : Promise.resolve(none),
  ]);
  if (b.rows.length === 0) return a;
  if (a.rows.length === 0) return b;
  const seen = new Set(a.rows.map((r) => r.caseNumber));
  const asc = args.narrow.decidedOrder === "asc";
  const merged = [...a.rows, ...b.rows.filter((r) => !seen.has(r.caseNumber))].sort((x, y) => {
    if (x.decisionDate !== y.decisionDate) {
      return (x.decisionDate < y.decisionDate ? -1 : 1) * (asc ? 1 : -1);
    }
    return (x.caseNumber < y.caseNumber ? -1 : 1) * (asc ? 1 : -1);
  });
  return { rows: merged.slice(0, args.limit), windowed: a.windowed || b.windowed };
}

async function readPermTable(
  table: PermTable,
  present: Set<string>,
  args: PermReadArgs,
): Promise<SliceResult<PermSearchRow>> {
  const { lead, narrow, limit } = args;
  const empty: SliceResult<PermSearchRow> = { rows: [], windowed: false };
  const dir = narrow.decidedOrder === "asc" ? "ASC" : "DESC";
  const extra = extraNarrowing(narrow, present);
  if (extra.impossible) return empty;
  const columns = searchColumns(present);
  const map = toSearchRow(table);

  if (narrow.outcome === "open") {
    // Every row in a disclosure file has a decision on it, so this can only
    // ever be empty. Returning without a query rather than running one that
    // cannot match: a read that is guaranteed to find nothing still costs a
    // read.
    return empty;
  }
  const bucket = narrow.outcome ? OUTCOME_STATUSES.perm_cases[narrow.outcome] : undefined;
  const index = permLeadIndex(lead, bucket !== undefined, narrow);
  // Only the current table is pinned. The history table's indexes may be
  // dropped to save writes, and `INDEXED BY` a missing index fails outright.
  const pinned = table === "perm_cases" ? index : null;

  const status = bucket ? statusClause("status", bucket) : null;

  if (lead.kind === "employer") {
    const range = slugRange(lead.value);
    if (!range) return empty;

    // `idx_pc_emp_dec` is `(employer_slug, decision_date)`, so the DECIDED
    // range is the only narrowing the covering pass can carry. The filed
    // range is on `received_date`, which the index does not hold.
    // A FISCAL YEAR RIDES THE COVERING PASS AS A DECIDED RANGE. As a plain
    // `fiscal_year = ?` it would sit in the second pass, which only sees the
    // newest SLICE_CAP decisions the first pass took, so an older year would
    // come back empty for any busy employer. The equality stays below as the
    // exact test.
    const fyMonths = fiscalYearMonths(narrow.fiscalYear);
    const decidedFrom = [narrow.decidedFrom, fyMonths?.from].filter(Boolean).sort().pop();
    const decidedTo = [narrow.decidedTo, fyMonths?.to].filter(Boolean).sort()[0];
    if (decidedFrom && decidedTo && decidedFrom > decidedTo) return empty;
    const covered = commonNarrowing(
      {
        ...(decidedFrom ? { decidedFrom } : {}),
        ...(decidedTo ? { decidedTo } : {}),
      },
      "received_date",
      "decision_date",
    );

    const restConds: string[] = [];
    const restParams: (string | number)[] = [];
    if (status) {
      restConds.push(status.cond);
      restParams.push(...status.params);
    }
    if (narrow.firmSlug) {
      restConds.push("attorney_slug = ?");
      restParams.push(narrow.firmSlug);
    }
    if (narrow.state) {
      restConds.push("state = ?");
      restParams.push(narrow.state);
    }
    if (narrow.socCode) {
      // THE GROUP, NOT AN EXACT MATCH, and the same rule the equality leads
      // use. `perm_cases` holds 302,081 dotted codes and 71,858 bare ones, so
      // `soc_code = '15-1252.00'` silently misses every bare row and
      // `= '15-1252'` misses every dotted one. One needle must not answer
      // differently depending on which box the reader filled.
      restConds.push(`${SOC_GROUP_EXPR} = ?`);
      restParams.push(narrow.socCode);
    }
    if (narrow.fiscalYear) {
      // TEXT in perm_cases, INTEGER in the flag disclosure tables. Binding a
      // number here would compare an integer against a string and match
      // nothing, silently.
      restConds.push("fiscal_year = ?");
      restParams.push(narrow.fiscalYear);
    }
    if (narrow.wageMin !== undefined) {
      restConds.push("wage >= ?");
      restParams.push(narrow.wageMin);
    }
    if (narrow.wageMax !== undefined) {
      restConds.push("wage <= ?");
      restParams.push(narrow.wageMax);
    }
    const rest = commonNarrowing(
      {
        ...(narrow.title ? { title: narrow.title } : {}),
        ...(narrow.from ? { from: narrow.from } : {}),
        ...(narrow.to ? { to: narrow.to } : {}),
      },
      "received_date",
      null,
    );
    restConds.push(...rest.conds);
    restParams.push(...rest.params);
    restConds.push(...extra.conds);
    restParams.push(...extra.params);

    return readEmployerSlice<SearchDbRow, PermSearchRow>(
      {
        table,
        index: pinned,
        dir,
        columns,
        orderColumn: "decision_date",
        range,
        coveredConds: covered.conds,
        coveredParams: covered.params,
        restConds,
        restParams,
        limit,
      },
      map,
    );
  }

  // An equality lead: one statement, and the index supplies the ordering.
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (lead.kind === "firm") {
    conds.push("attorney_slug = ?");
    params.push(lead.value);
  } else if (lead.kind === "state") {
    conds.push("state = ?");
    params.push(lead.value);
  } else if (lead.kind === "occupation") {
    // THE 6-DIGIT GROUP, NOT AN EXACT MATCH, and this was a correctness bug
    // rather than a performance one. `perm_cases` holds both spellings of the
    // same occupation - 302,081 dotted (`15-1252.00`) and 71,858 bare
    // (`15-1252`) - so `soc_code = ?` answers with whichever spelling the lead
    // happened to resolve to and silently drops the other. Measured: SOC
    // 13-2011 is 3,686 dotted plus 1,207 bare, so an exact match on the dotted
    // form lost 24.7% of the accountants. 29-1141 lost 31%.
    //
    // `idx_pc_socg_dec` and `idx_pc_socg_st_dec` are on the same expression,
    // so this stays a seek. The FLAG tables already did it this way; PERM was
    // the odd one out.
    // THE NEEDLE MUST BE THE GROUP TOO, not just the column. `substr(x, 1, 7)`
    // yields `15-1252`, so binding the lead's own `15-1252.00` compares seven
    // characters against ten and matches nothing at all. The FLAG path already
    // resolved this with `socGroup`; a test caught PERM doing it wrong here.
    const group = socGroup(lead.value);
    if (!group) return empty;
    conds.push(`${SOC_GROUP_EXPR} = ?`);
    params.push(group);
  } else {
    return empty;
  }
  if (status) {
    conds.push(status.cond);
    params.push(...status.params);
  }
  // THE SECOND AND THIRD EQUALITIES, when the lead is not already one of them.
  // These are what `permLeadIndex` just chose a composite index for, so they
  // are seeked rather than tested: putting them in the WHERE is what lets the
  // index do its job.
  if (lead.kind !== "firm" && narrow.firmSlug) {
    conds.push("attorney_slug = ?");
    params.push(narrow.firmSlug);
  }
  if (lead.kind !== "state" && narrow.state) {
    conds.push("state = ?");
    params.push(narrow.state);
  }
  if (lead.kind !== "occupation" && narrow.socCode) {
    conds.push(`${SOC_GROUP_EXPR} = ?`);
    params.push(narrow.socCode);
  }

  // EVERY REMAINING FILTER IS PASSED THROUGH RATHER THAN STRIPPED.
  //
  // It used to drop the title and the filed-month range here, on the grounds
  // that both walk the whole slice. That was true and it was measured, but it
  // made the controls permanently dead on three of the five leads, and a
  // reader who picked a law firm then found worksite state greyed out.
  //
  // What changed is the shape of the read, not the appetite for cost. The
  // three composite indexes above turn the pair of equalities into a seek, so
  // a title or a wage bound is now tested against the handful of rows that
  // survive it rather than against 67,742 Californian cases. And the walk was
  // never the disaster the old comment implied: `state='CA'` plus a title
  // LIKE measured 0.57 s. The genuinely slow case was a SELECTIVE second
  // equality, which is exactly what is now indexed.
  if (narrow.fiscalYear) {
    // TEXT in perm_cases, INTEGER in the flag disclosure tables. Binding a
    // number here would compare an integer against a string and match nothing,
    // silently.
    conds.push("fiscal_year = ?");
    params.push(narrow.fiscalYear);
  }
  if (narrow.wageMin !== undefined) {
    conds.push("wage >= ?");
    params.push(narrow.wageMin);
  }
  if (narrow.wageMax !== undefined) {
    conds.push("wage <= ?");
    params.push(narrow.wageMax);
  }

  const common = commonNarrowing(narrow, "received_date", "decision_date");
  conds.push(...common.conds);
  params.push(...common.params);
  conds.push(...extra.conds);
  params.push(...extra.params);

  const found = await rows<SearchDbRow>(
    `SELECT ${columns} FROM ${table} ${pinned ? `INDEXED BY ${pinned} ` : ""}` +
      `WHERE ${conds.join(" AND ")} ORDER BY decision_date ${dir} LIMIT ?`,
    [...params, limit],
  );
  return { rows: found.map(map), windowed: false };
}

// ---------------------------------------------------------------------------
// PERM, live (the daily check's remainder table)
// ---------------------------------------------------------------------------

const LIVE_COLS =
  "case_number, filing_date, status, is_final, employer_name, job_title";

/**
 * The outcome as a predicate on a live table.
 *
 * "Still open" reads off `is_final`, not off a status string: the live
 * vocabulary has five or more values and grows whenever DOL adds a review
 * stage, while `is_final` is the flag the ingest computes and the only thing
 * that stays true as the vocabulary moves.
 */
function liveOutcomeClause(
  column: string,
  program: "perm_live" | FlagProgramKey,
  outcome: Outcome | undefined,
): { cond: string; params: (string | number)[] } | null {
  if (!outcome) return null;
  if (outcome === "open") return { cond: "is_final = ?", params: [0] };
  const s = statusClause(column, OUTCOME_STATUSES[program][outcome]);
  return { cond: s.cond, params: s.params };
}

/**
 * Open and newly-decided PERM filings for one employer.
 *
 * EMPLOYER LEAD ONLY, because `perm_live_recent` carries exactly one index
 * that a search can lead with: `(employer_slug, filing_date DESC)`. There is
 * no firm, worksite or occupation column on a live row at all - DOL does not
 * publish those until the case reaches a quarterly file - so the other leads
 * are a data fact here, not a missing index.
 */
export async function readPermLive(
  employerText: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<LiveCaseRow>> {
  const range = slugRange(employerText);
  if (!range) return { rows: [], windowed: false };

  // The index is `(employer_slug, filing_date)`, so the filed range rides the
  // covering pass and everything else waits for the rows.
  const covered = commonNarrowing(
    {
      ...(narrow.from ? { from: narrow.from } : {}),
      ...(narrow.to ? { to: narrow.to } : {}),
    },
    "filing_date",
    null,
  );
  const restConds: string[] = [];
  const restParams: (string | number)[] = [];
  const outcome = liveOutcomeClause("status", "perm_live", narrow.outcome);
  if (outcome) {
    restConds.push(outcome.cond);
    restParams.push(...outcome.params);
  }
  const rest = commonNarrowing(narrow.title ? { title: narrow.title } : {}, "filing_date", null);
  restConds.push(...rest.conds);
  restParams.push(...rest.params);

  return readEmployerSlice<LiveDbRow, LiveCaseRow>(
    {
      table: "perm_live_recent",
      index: "perm_live_recent_emp",
      columns: LIVE_COLS,
      orderColumn: "filing_date",
      range,
      coveredConds: covered.conds,
      coveredParams: covered.params,
      restConds,
      restParams,
      limit,
    },
    toLiveRow,
  );
}

// ---------------------------------------------------------------------------
// Wage requests and LCAs
// ---------------------------------------------------------------------------

interface FlagTables {
  live: string;
  /** DOL's quarterly file for the program; absent when none is loaded. */
  published?: string;
  /** `visa_type` on the live table, when the program's form serves several visas. */
  visaType?: string;
  /** `visa_class` on the published table, same reason. */
  visaClass?: string;
}

/**
 * Table names per program, kept beside the reads that use them.
 *
 * The `PERM` scope on the wage-request program is not decoration: the ETA-9141
 * sets the wage for H-1B and H-2B filings too, and a PERM tracker listing an
 * H-1B wage request under an employer is a wrong answer that looks like a
 * right one. The same default is applied by `pwdCases.ts`.
 */
export const FLAG_TABLES: Record<FlagProgramKey, FlagTables> = {
  pwd: {
    live: "pwd_case_status",
    published: "pwd_cases",
    visaType: "PERM",
    visaClass: "PERM",
  },
  lca: { live: "lca_case_status", published: "lca_cases" },
  // DOL's H-2A, H-2B and CW-1 files share one table, the visa on each row.
  seasonal: { live: "seasonal_case_status", published: "seasonal_cases" },
};

export async function readFlagLive(
  program: FlagProgramKey,
  employerText: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<FlagCaseRow>> {
  const t = FLAG_TABLES[program];
  const range = slugRange(employerText);
  if (!range) return { rows: [], windowed: false };

  const covered = commonNarrowing(
    {
      ...(narrow.from ? { from: narrow.from } : {}),
      ...(narrow.to ? { to: narrow.to } : {}),
    },
    "filing_date",
    null,
  );
  const restConds: string[] = [];
  const restParams: (string | number)[] = [];
  if (t.visaType) {
    restConds.push("visa_type = ?");
    restParams.push(t.visaType);
  }
  const outcome = liveOutcomeClause("current_status", program, narrow.outcome);
  if (outcome) {
    restConds.push(outcome.cond);
    restParams.push(...outcome.params);
  }
  const rest = commonNarrowing(narrow.title ? { title: narrow.title } : {}, "filing_date", null);
  restConds.push(...rest.conds);
  restParams.push(...rest.params);

  return readEmployerSlice<FlagDbRow, FlagCaseRow>(
    {
      table: t.live,
      index: `${t.live}_emp`,
      columns: FLAG_COLS,
      orderColumn: "filing_date",
      range,
      coveredConds: covered.conds,
      coveredParams: covered.params,
      restConds,
      restParams,
      limit,
    },
    toFlagRow,
  );
}

/**
 * The 6-digit SOC group a code belongs to, or null when it is not a SOC code.
 *
 * THE THREE PROGRAMS SPELL THE OCCUPATION DIFFERENTLY, and an exact equality
 * across them matches nothing. Measured:
 *
 * | table | dotted `15-1252.00` | bare `15-1252` |
 * |---|---|---|
 * | `perm_cases` | 302,081 | 49,432 |
 * | `pwd_cases` | **0** | 614,015 |
 * | `lca_cases` | 434,314 | 3,182 |
 *
 * DOL's PW file publishes the 6-digit SOC and nothing finer, so the group is
 * the only key the three files share. An occupation lead resolved from
 * `perm_entities` arrives as either form (851 of its 1,410 occupation rows are
 * dotted) and is folded to the group before it reaches a flag table.
 *
 * THE COST OF THAT, STATED RATHER THAN HIDDEN: for a SOC group that O*NET
 * splits into detail occupations - `15-1299.08` and `15-1299.09` are different
 * jobs under one group - the wage-request and LCA halves answer at the group
 * level while the PERM half answers at the detail level. 62,007 of 434,314
 * dotted LCA rows carry a suffix other than `.00`, so it is roughly a seventh
 * of that table. There is no finer answer available: DOL does not publish one.
 */
export function socGroup(code: string): string | null {
  // `m?.[1] ?? null`, not `m ? m[1] : null`: `noUncheckedIndexedAccess` types
  // a capture group as `string | undefined` even when the regex guarantees it.
  return /^(\d{2}-\d{4})/.exec(code.trim())?.[1] ?? null;
}

/**
 * The indexed expression, written once.
 *
 * SQLite serves a filter on an expression from an index on that expression
 * only when the two parse to the same tree, so this constant and the
 * `CREATE INDEX` in `scripts/ingest_flag_disclosure.py` are one fact in two
 * files. Verified against production: the plan reads
 * `SEARCH pwd_cases USING INDEX pwd_cases_soc_dec (<expr>=?)`.
 */
const SOC_GROUP_EXPR = "substr(soc_code, 1, 7)";

/**
 * The index a lead rides on a published FLAG table, or null when that table
 * cannot answer the lead at all.
 *
 * Exported for its own test, for the reason `permLeadIndex` is: the pairing of
 * lead to index IS the feature, and reading it back out of the SQL string
 * would pass over two index names being swapped.
 *
 * `singleStatus` is not `hasOutcome`. Every PERM bucket is one status, so
 * there the two are the same question; here they are not. `pwd`'s granted
 * bucket holds five statuses and `lca`'s withdrawn bucket three, and an `IN`
 * list cannot seek the middle column of a three-column index - SQLite runs it
 * as several seeks and sorts the union. Measured on the plain index instead,
 * with the statuses applied as a filter: `lca_cases` state `CA` + the
 * three-status withdrawn bucket is 0.57 s, because the bucket is 7.7% of the
 * table and a hundred rows arrive after about 1,300. Behind the status index
 * the same read would have to materialise every withdrawal in California
 * before it could order them.
 */
export function flagLeadIndex(
  program: FlagProgramKey,
  lead: Lead,
  singleStatus: boolean,
): string | null {
  const t = FLAG_TABLES[program].published;
  if (!t) return null;
  switch (lead.kind) {
    case "stage":
      return null;
    case "employer":
      return `${t}_emp`;
    case "state":
      return singleStatus ? `${t}_state_st_dec` : `${t}_state_dec`;
    case "occupation":
      return singleStatus ? `${t}_soc_st_dec` : `${t}_soc_dec`;
    case "firm":
      // DOL publishes `LAWFIRM_NAME_BUSINESS_NAME` in the ETA-9035 and
      // ETA-9141 disclosure files and the ingest reads it. Null here would
      // make a firm lead answer from the PERM file alone and say "this firm
      // files no wage requests" by omission.
      return singleStatus ? `${t}_att_st_dec` : `${t}_att_dec`;
    case "case":
      // A point read on the primary key; this function is never asked.
      return null;
  }
}

/**
 * The prevailing wage source as a condition on `lca_cases`. DOL's file names
 * the OES year when the wage came from OES, and otherwise the other source
 * ("Survey", "CBA", "SCA", "DBA"); scripts/ingest_flag_disclosure.py reads both.
 */
export function wageSourceCondition(source: WageSourceKey): { cond: string; params: string[] } {
  switch (source) {
    case "oes":
      return { cond: "pw_oes_year IS NOT NULL", params: [] };
    case "survey":
      return { cond: "pw_other_source = ?", params: ["Survey"] };
    case "cba":
      return { cond: "pw_other_source = ?", params: ["CBA"] };
    case "contract":
      return { cond: "pw_other_source IN (?, ?)", params: ["SCA", "DBA"] };
  }
}

/**
 * The filters a published FLAG read tests row by row, beyond its lead: the
 * second and third equalities (whichever the lead is not), the fiscal year and
 * the yearly wage bounds. Shared by the employer path and the equality-lead
 * path, which used to drop all of these on a firm, state or occupation lead
 * (Oct 7 2026): "this firm, in Wyoming" answered with the firm's wage requests
 * and LCAs from every state, and nothing said so.
 */
function flagRowNarrowing(narrow: UnifiedNarrow, leadKind: Lead["kind"]): { conds: string[]; params: (string | number)[] } {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (leadKind !== "firm" && narrow.firmSlug) {
    conds.push("attorney_slug = ?");
    params.push(narrow.firmSlug);
  }
  if (leadKind !== "state" && narrow.state) {
    conds.push("worksite_state = ?");
    params.push(narrow.state);
  }
  if (leadKind !== "occupation" && narrow.socCode) {
    // THE 6-DIGIT GROUP, not the code as typed. `pwd_cases` holds ZERO dotted
    // SOC codes out of 634,638, so `soc_code = '15-1252.00'` matches nothing
    // there and would report an employer as having filed no wage requests for
    // an occupation they file constantly. See `socGroup`.
    const group = socGroup(narrow.socCode);
    if (group) {
      conds.push(`${SOC_GROUP_EXPR} = ?`);
      params.push(group);
    }
  }
  if (narrow.fiscalYear) {
    // INTEGER here, TEXT in perm_cases. Two columns of the same name and two
    // storage classes; binding the wrong one matches nothing and errors nowhere.
    conds.push("fiscal_year = ?");
    params.push(Number(narrow.fiscalYear));
  }
  // YEARLY FIGURES, LIKE THE BOXES SAY. These files quote the unit the
  // employer pays in, so the raw amount compared against "$100,000" dropped
  // every $50-an-hour offer ($104,000 a year) and kept a yearly salary typed
  // as "$100,000 per month". The expression annualises and reads a wrong-unit
  // amount as NULL, which no bound matches.
  if (narrow.wageMin !== undefined) {
    conds.push(`(${FLAG_ANNUAL_WAGE_SQL}) >= ?`);
    params.push(narrow.wageMin);
  }
  if (narrow.wageMax !== undefined) {
    conds.push(`(${FLAG_ANNUAL_WAGE_SQL}) <= ?`);
    params.push(narrow.wageMax);
  }
  return { conds, params };
}

export async function readFlagPublished(
  program: FlagProgramKey,
  lead: Lead,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<FlagDisclosedRow>> {
  const empty: SliceResult<FlagDisclosedRow> = { rows: [], windowed: false };
  if (narrow.outcome === "open") return empty;
  const t = FLAG_TABLES[program];
  // A program with no published table: nothing published to read.
  const published = t.published;
  if (!published) return empty;
  const bucket = narrow.outcome ? OUTCOME_STATUSES[program][narrow.outcome] : undefined;
  const index = flagLeadIndex(program, lead, bucket?.length === 1);
  if (!index) return empty;
  // An LCA-only filter on another program's file matches nothing; the runner
  // doesn't ask, and this keeps a direct caller honest too.
  const source = narrow.wageSource ? wageSourceCondition(narrow.wageSource) : null;
  if (source && program !== "lca") return empty;

  if (lead.kind !== "employer") {
    // AN EQUALITY LEAD: one statement, and the index supplies the ordering, so
    // `LIMIT` stops the read at a hundred rows however rare the needle is.
    // This is the path the two-pass employer read must NOT be used for, and
    // the reverse is true as well - see `readEmployerSlice`.
    const conds: string[] = [];
    const params: (string | number)[] = [];
    if (lead.kind === "state") {
      conds.push("worksite_state = ?");
      params.push(lead.value);
    } else if (lead.kind === "firm") {
      conds.push("attorney_slug = ?");
      params.push(lead.value);
    } else if (lead.kind === "occupation") {
      const group = socGroup(lead.value);
      if (!group) return empty;
      conds.push(`${SOC_GROUP_EXPR} = ?`);
      params.push(group);
    } else {
      return empty;
    }
    if (t.visaClass) {
      // 87.3% of `pwd_cases` is PERM, so this reads about 115 rows for every
      // hundred returned. Cheap enough to stay a filter rather than earn a
      // place in four more indexes.
      conds.push("visa_class = ?");
      params.push(t.visaClass);
    }
    if (bucket) {
      const s = statusClause("case_status", bucket);
      conds.push(s.cond);
      params.push(...s.params);
    }
    if (source) {
      conds.push(source.cond);
      params.push(...source.params);
    }
    // The decided range rides the seek: it is the last column of this index.
    const common = commonNarrowing(
      {
        ...(narrow.decidedFrom ? { decidedFrom: narrow.decidedFrom } : {}),
        ...(narrow.decidedTo ? { decidedTo: narrow.decidedTo } : {}),
      },
      "received_date",
      "decision_date",
    );
    conds.push(...common.conds);
    params.push(...common.params);

    // EVERY OTHER FILTER IS APPLIED, inside a window. These tables carry no
    // composite index for a second equality, so a selective one (a big firm
    // plus `state='WY'`) would walk the firm's whole slice. The rows are
    // tested against the newest SLICE_CAP of the lead instead, and the answer
    // says so when that window was full, as the employer path does.
    const rest = flagRowNarrowing(narrow, lead.kind);
    const filed = commonNarrowing(
      {
        ...(narrow.title ? { title: narrow.title } : {}),
        ...(narrow.from ? { from: narrow.from } : {}),
        ...(narrow.to ? { to: narrow.to } : {}),
      },
      "received_date",
      null,
    );
    const restConds = [...rest.conds, ...filed.conds];
    const restParams = [...rest.params, ...filed.params];
    if (restConds.length === 0) {
      const found = await rows<DisclosedDbRow>(
        `SELECT ${DISCLOSED_COLS} FROM ${published} INDEXED BY ${index} ` +
          `WHERE ${conds.join(" AND ")} ORDER BY decision_date DESC LIMIT ?`,
        [...params, limit],
      );
      return { rows: found.map(toDisclosed), windowed: false };
    }
    const ids = await rows<{ rowid: number }>(
      `SELECT rowid FROM ${published} INDEXED BY ${index} ` +
        `WHERE ${conds.join(" AND ")} ORDER BY decision_date DESC LIMIT ?`,
      [...params, SLICE_CAP],
    );
    if (ids.length === 0) return { rows: [], windowed: false };
    // `NOT INDEXED` for the reason given in `readEmployerSlice`: it keeps the
    // second pass on the rowid list instead of a status index.
    const found = await rows<DisclosedDbRow>(
      `SELECT ${DISCLOSED_COLS} FROM ${published} NOT INDEXED ` +
        `WHERE rowid IN (${ids.map(() => "?").join(", ")}) AND ${restConds.join(" AND ")} ` +
        `ORDER BY decision_date DESC, case_number DESC LIMIT ?`,
      [...ids.map((r) => r.rowid), ...restParams, limit],
    );
    return { rows: found.map(toDisclosed), windowed: ids.length >= SLICE_CAP };
  }

  const range = slugRange(lead.value);
  if (!range) return empty;

  // `(employer_slug, received_date)`, so the filed range rides the covering
  // pass. The decided range does not: `decision_date` is a table column here.
  const covered = commonNarrowing(
    {
      ...(narrow.from ? { from: narrow.from } : {}),
      ...(narrow.to ? { to: narrow.to } : {}),
    },
    "received_date",
    null,
  );

  const restConds: string[] = [];
  const restParams: (string | number)[] = [];
  if (t.visaClass) {
    restConds.push("visa_class = ?");
    restParams.push(t.visaClass);
  }
  if (bucket) {
    const s = statusClause("case_status", bucket);
    restConds.push(s.cond);
    restParams.push(...s.params);
  }
  const row = flagRowNarrowing(narrow, "employer");
  restConds.push(...row.conds);
  restParams.push(...row.params);
  if (source) {
    restConds.push(source.cond);
    restParams.push(...source.params);
  }
  const rest = commonNarrowing(
    {
      ...(narrow.title ? { title: narrow.title } : {}),
      ...(narrow.decidedFrom ? { decidedFrom: narrow.decidedFrom } : {}),
      ...(narrow.decidedTo ? { decidedTo: narrow.decidedTo } : {}),
    },
    "received_date",
    "decision_date",
  );
  restConds.push(...rest.conds);
  restParams.push(...rest.params);

  return readEmployerSlice<DisclosedDbRow, FlagDisclosedRow>(
    {
      table: published,
      index,
      columns: DISCLOSED_COLS,
      orderColumn: "received_date",
      range,
      coveredConds: covered.conds,
      coveredParams: covered.params,
      restConds,
      restParams,
      limit,
    },
    toDisclosed,
  );
}

// ---------------------------------------------------------------------------
// One case, by its number
// ---------------------------------------------------------------------------

/**
 * Which program a case number belongs to, from its prefix.
 *
 * DOL issues every foreign-labor case number off ONE serial counter and tells
 * the programs apart by the letter: `G-` and the legacy `A-` are PERM, `P-` is
 * a prevailing wage request, `I-` is an LCA. So the prefix decides which two
 * tables to read, and a lookup costs two primary-key point reads rather than
 * six. Anything else is treated as PERM, which is the shape the legacy `A-`
 * numbers and the rare `G-300-` variants take.
 */
export function programForCaseNumber(caseNumber: string): "perm" | FlagProgramKey {
  const head = caseNumber.trim().toUpperCase();
  // H-2A (`H-300-`, job order `JO-A-300-`), H-2B (`H-400-`), CW-1 (`C-500-`)
  // and the H-2B and CW-1 wage requests (`P-400-`, `P-500-`) come before the
  // bare letters: neither wage request is a PERM-queue one.
  if (/^(H-300|H-400|P-400|P-500|JO-A-300|C-500)-/.test(head)) return "seasonal";
  const letter = head.charAt(0);
  if (letter === "P") return "pwd";
  if (letter === "I") return "lca";
  return "perm";
}

export interface CaseLookupResult {
  program: "perm" | FlagProgramKey;
  permPublished: PermSearchRow | null;
  permLive: LiveCaseRow | null;
  flagPublished: FlagDisclosedRow | null;
  flagLive: FlagCaseRow | null;
}

/**
 * One case, from both halves of its own program.
 *
 * READS OUR OWN TABLES ONLY. The live half here is `perm_case_status`, the
 * whole live corpus, not the `perm_live_recent` remainder - a case DOL decided
 * since the last quarterly file has left the remainder and is still the row
 * somebody typing that number wants. Asking DOL itself is deliberately NOT
 * done here: that path has a daily request budget and its own page, and this
 * search must stay a cheap read. The page keeps the link to it, which is the
 * only thing that answers a filing DOL has not indexed for us yet.
 */
export async function lookupUnifiedCase(caseNumber: string): Promise<CaseLookupResult> {
  const program = programForCaseNumber(caseNumber);
  const blank: CaseLookupResult = {
    program,
    permPublished: null,
    permLive: null,
    flagPublished: null,
    flagLive: null,
  };

  if (program === "perm") {
    const [cur, hist] = await Promise.all([
      tableColumns("perm_cases"),
      tableColumns(HISTORY_TABLE),
    ]);
    const [pub, live] = await Promise.all([
      one<SearchDbRow>(
        `SELECT ${searchColumns(cur)} FROM perm_cases WHERE case_number = ?`,
        [caseNumber],
      ).catch(() => null),
      one<LiveDbRow>(
        `SELECT case_number, filing_date, current_status AS status, is_final,
                employer_name, job_title
           FROM perm_case_status WHERE case_number = ?`,
        [caseNumber],
      ).catch(() => null),
    ]);
    // THE FY2016 TO FY2023 DECISIONS, when the current table has no row. A
    // case decided before FY2024 is in `perm_cases_history` or nowhere, and
    // asking DOL live about it is not this search's job (see above); the
    // status page's lookup reads the same table in the same order.
    const old =
      pub || hist.size === 0
        ? null
        : await one<SearchDbRow>(
            `SELECT ${searchColumns(hist)} FROM ${HISTORY_TABLE} WHERE case_number = ?`,
            [caseNumber],
          ).catch(() => null);
    return {
      ...blank,
      permPublished: pub
        ? toSearchRow("perm_cases")(pub)
        : old
          ? toSearchRow(HISTORY_TABLE)(old)
          : null,
      permLive: live ? toLiveRow(live) : null,
    };
  }

  const t = FLAG_TABLES[program];
  const [pub, live] = await Promise.all([
    t.published
      ? one<DisclosedDbRow>(
          `SELECT ${DISCLOSED_COLS} FROM ${t.published} WHERE case_number = ?`,
          [caseNumber],
        ).catch(() => null)
      : null,
    one<FlagDbRow>(`SELECT ${FLAG_COLS} FROM ${t.live} WHERE case_number = ?`, [
      caseNumber,
    ]).catch(() => null),
  ]);
  return {
    ...blank,
    flagPublished: pub ? toDisclosed(pub) : null,
    flagLive: live ? toFlagRow(live) : null,
  };
}

/**
 * When we FIRST SAW a case reach a final status. Not when DOL decided it.
 *
 * WHY THIS IS NOT A DECISION DATE, and must never be rendered as one. DOL's
 * batch endpoint returns five fields on a case - number, status, visa type,
 * employer, job title, submitted date - and a determination date is not among
 * them. None of the three live tables even has the column. So for a case DOL
 * has decided but not yet published, the true date is unknown and this is an
 * UPPER BOUND: the case was final by the time our sweep looked, and could have
 * been decided any time between that sweep and the one before it.
 *
 * Measured on `perm_case_status`: about three in four live rows are already
 * final, which is why "live" is not a synonym for "pending". Most of those
 * also appear in a quarterly file, and the row deduper prefers the published
 * half, so they carry DOL's own date already. This exists for the rest.
 *
 * One seek per case number on the events table's primary key, and it is only
 * asked about rows that are live, final and undated - a handful of a page.
 */
export async function firstSeenDecided(
  program: ChangeProgram | "seasonal",
  caseNumbers: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (caseNumbers.length === 0) return out;
  const holes = caseNumbers.map(() => "?").join(",");
  const found = await rows<{ case_number: string; seen: number | string | null }>(
    `SELECT case_number, MIN(changed_at) AS seen
       FROM ${program}_case_events
      WHERE case_number IN (${holes}) AND to_final IN (1, '1')
      GROUP BY case_number`,
    [...caseNumbers],
  ).catch(() => []);
  for (const r of found) {
    const ms = Number(r.seen);
    if (!Number.isFinite(ms) || ms <= 0) continue;
    out.set(String(r.case_number), new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}


// ---------------------------------------------------------------------------
// Review stages: a live-record fact, read from the full live corpus
// ---------------------------------------------------------------------------

/**
 * The columns every stage read returns, mapped to the live row shape the
 * unified search already renders. The slug comes from `perm_live_recent`
 * when the case is in the remainder and from `perm_cases` when DOL has
 * published it (a denied case can sit at RECONSIDERATION APPEALS live while
 * its published row says denied), so the two are coalesced.
 */
const STAGE_COLS =
  "c.case_number, c.filing_date, c.current_status AS status, c.is_final, c.employer_name, " +
  "COALESCE(l.employer_slug, p.employer_slug) AS employer_slug, c.job_title";

interface StageDbRow {
  case_number: string;
  filing_date: string | null;
  status: string | null;
  is_final: number | string;
  employer_name: string | null;
  employer_slug: string | null;
  job_title: string | null;
}

const toStageRow = (r: StageDbRow): LiveCaseRow => ({
  caseNumber: String(r.case_number),
  filingDate: r.filing_date == null ? null : String(r.filing_date),
  status: r.status == null ? null : String(r.status),
  isFinal: Number(r.is_final) === 1,
  employerName: r.employer_name == null ? null : String(r.employer_name),
  employerSlug: r.employer_slug == null ? null : String(r.employer_slug),
  jobTitle: r.job_title == null ? null : String(r.job_title),
});

/** Title and filing-month narrowing on the live status table's own columns. */
function stageNarrowing(narrow: UnifiedNarrow): { conds: string[]; params: (string | number)[] } {
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (narrow.from) {
    conds.push("c.filing_date >= ?");
    params.push(`${narrow.from}-01`);
  }
  if (narrow.to) {
    conds.push("c.filing_date < ?");
    params.push(`${monthAfterYm(narrow.to)}-01`);
  }
  if (narrow.title) {
    conds.push("c.job_title LIKE ? ESCAPE '\\'");
    params.push(`%${narrow.title.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  return { conds, params };
}

function monthAfterYm(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Every pending case at one stage, oldest filing first.
 *
 * Served by `case_status_stage (current_status, is_final, filing_date)`: the
 * two equalities bound the read to the stage and the trailing column supplies
 * the order and the month narrowing, so a 90,000-case stage with a LIMIT of
 * 100 reads 100 rows. The two LEFT JOINs are primary-key lookups per row
 * returned, never per row scanned.
 */
export async function readPermStage(
  status: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<LiveCaseRow>> {
  const rest = stageNarrowing(narrow);
  const found = await rows<StageDbRow>(
    `SELECT ${STAGE_COLS}
       FROM perm_case_status c INDEXED BY case_status_stage
       LEFT JOIN perm_live_recent l ON l.case_number = c.case_number
       LEFT JOIN perm_cases p ON p.case_number = c.case_number
      WHERE c.current_status = ? AND c.is_final = 0 AND c.employer_name IS NOT ?` +
      (rest.conds.length ? ` AND ${rest.conds.join(" AND ")}` : "") +
      ` ORDER BY c.filing_date, c.case_number LIMIT ?`,
    [status, TEST_FIXTURE_EMPLOYER, ...rest.params, limit + 1],
  );
  return { rows: found.slice(0, limit).map(toStageRow), windowed: found.length > limit };
}

/**
 * An employer's pending cases at one stage.
 *
 * Read from the EMPLOYER side, never the stage side: the employer's live rows
 * come off `perm_live_recent_emp` and its published rows off
 * `idx_pc_emp_dec`, each a bounded slice, and the current status is one
 * primary-key lookup per row. Started from the stage, an analyst-review
 * search for one employer would scan 90,000 rows. The two halves are
 * unioned because a case DOL has published can still be at an appeal
 * stage live, and it belongs in this answer.
 */
export async function readPermEmployerStage(
  employerText: string,
  status: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<LiveCaseRow>> {
  const range = slugRange(employerText);
  if (!range) return { rows: [], windowed: false };
  const rest = stageNarrowing(narrow);
  const restSql = rest.conds.length ? ` AND ${rest.conds.join(" AND ")}` : "";
  const found = await rows<StageDbRow>(
    `SELECT * FROM (
       SELECT ${STAGE_COLS}
         FROM perm_live_recent l INDEXED BY perm_live_recent_emp
         JOIN perm_case_status c ON c.case_number = l.case_number
         LEFT JOIN perm_cases p ON p.case_number = l.case_number
        WHERE l.employer_slug >= ? AND l.employer_slug < ?
          AND c.current_status = ? AND c.is_final = 0${restSql}
       UNION
       SELECT ${STAGE_COLS}
         FROM perm_cases p INDEXED BY idx_pc_emp_dec
         JOIN perm_case_status c ON c.case_number = p.case_number
         LEFT JOIN perm_live_recent l ON l.case_number = p.case_number
        WHERE p.employer_slug >= ? AND p.employer_slug < ?
          AND c.current_status = ? AND c.is_final = 0${restSql}
     ) ORDER BY filing_date, case_number LIMIT ?`,
    [
      range.lo, range.hi, status, ...rest.params,
      range.lo, range.hi, status, ...rest.params,
      limit + 1,
    ],
  );
  return { rows: found.slice(0, limit).map(toStageRow), windowed: found.length > limit };
}


/**
 * Every pending wage request or LCA at one live status, oldest first.
 *
 * Served by `<live>_stage (current_status, is_final, filing_date)`, the same
 * shape as PERM's. The live table for these programs IS the full live corpus
 * (pending and decided alike), so no join is needed for the slug; the wage
 * request read pins `visa_type` to PERM as the other wage-request reads do.
 */
export async function readFlagStage(
  program: FlagProgramKey,
  status: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<FlagCaseRow>> {
  const t = FLAG_TABLES[program];
  const conds = ["current_status = ?", "is_final = 0"];
  const params: (string | number)[] = [status];
  if (t.visaType) {
    conds.push("visa_type = ?");
    params.push(t.visaType);
  }
  const rest = stageNarrowing(narrow);
  conds.push(...rest.conds.map((c) => c.replace(/\bc\./g, "")));
  params.push(...rest.params);
  const found = await rows<FlagDbRow>(
    `SELECT ${FLAG_COLS} FROM ${t.live} INDEXED BY ${t.live}_stage WHERE ${conds.join(" AND ")} ` +
      `ORDER BY filing_date, case_number LIMIT ?`,
    [...params, limit + 1],
  );
  return { rows: found.slice(0, limit).map(toFlagRow), windowed: found.length > limit };
}

/** An employer's pending wage requests or LCAs at one live status, from the employer side. */
export async function readFlagEmployerStage(
  program: FlagProgramKey,
  employerText: string,
  status: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<FlagCaseRow>> {
  const t = FLAG_TABLES[program];
  const range = slugRange(employerText);
  if (!range) return { rows: [], windowed: false };
  const conds = ["employer_slug >= ?", "employer_slug < ?", "current_status = ?", "is_final = 0"];
  const params: (string | number)[] = [range.lo, range.hi, status];
  if (t.visaType) {
    conds.push("visa_type = ?");
    params.push(t.visaType);
  }
  const rest = stageNarrowing(narrow);
  conds.push(...rest.conds.map((c) => c.replace(/\bc\./g, "")));
  params.push(...rest.params);
  const found = await rows<FlagDbRow>(
    `SELECT ${FLAG_COLS} FROM ${t.live} INDEXED BY ${t.live}_emp WHERE ${conds.join(" AND ")} ` +
      `ORDER BY filing_date, case_number LIMIT ?`,
    [...params, limit + 1],
  );
  return { rows: found.slice(0, limit).map(toFlagRow), windowed: found.length > limit };
}

/**
 * The fiscal years the history table holds case rows for, with how many, from
 * the history ingest's own record (`perm_docs['perm_history']`): one point
 * read, never a count over the table. The record is per FILE, and DOL's yearly
 * file is that year's determinations, so its case-row count is the year's.
 * Years the current table owns (FY2024 on) are left to its own list.
 */
export async function getPermHistoryYears(): Promise<{ fiscalYear: string; total: number }[]> {
  try {
    const r = await rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'perm_history'");
    const doc = JSON.parse(r[0]?.json ?? "{}") as { files?: Record<string, { fy?: unknown; caseRows?: unknown }> };
    const byYear = new Map<number, number>();
    for (const f of Object.values(doc.files ?? {})) {
      const fy = Number(f.fy);
      const n = Number(f.caseRows);
      if (!Number.isInteger(fy) || fy >= 2024 || !(n > 0)) continue;
      byYear.set(fy, (byYear.get(fy) ?? 0) + n);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([fy, total]) => ({ fiscalYear: String(fy), total }));
  } catch {
    return [];
  }
}

export interface FieldOption {
  value: string;
  /** Cases carrying the value, or null where the source gives no count. */
  n: number | null;
}
export type CaseFieldKey = "citizenship" | "birthCountry" | "visaClass" | "education" | "jobEducation";
export type CaseFieldOptions = Record<CaseFieldKey, FieldOption[]>;
const FIELD_KEYS: CaseFieldKey[] = ["citizenship", "birthCountry", "visaClass", "education", "jobEducation"];
/** More than any real vocabulary (about 200 countries), and a bound on a doc nobody checked. */
const MAX_OPTIONS = 400;

/**
 * The choices for the worker and job filters, so the page offers the values
 * DOL actually printed instead of asking a reader to guess a spelling that an
 * equality filter will then miss.
 *
 * NEVER A SCAN PER REQUEST. The lists come from `perm_docs['case_field_options']`,
 * which the ingest writes after a load. Until it exists, citizenship falls back
 * to `perm_country_years` (about 200 countries x 8 years, grouped once per page
 * render, and the page renders once a day), and country of birth borrows those
 * names without a count. The rest stay free text until the doc lands.
 */
export async function getCaseFieldOptions(): Promise<CaseFieldOptions> {
  const out: CaseFieldOptions = {
    citizenship: [], birthCountry: [], visaClass: [], education: [], jobEducation: [],
  };
  try {
    const r = await rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'case_field_options'");
    const doc = JSON.parse(r[0]?.json ?? "{}") as Record<string, unknown>;
    for (const k of FIELD_KEYS) {
      const list = Array.isArray(doc[k]) ? (doc[k] as unknown[]) : [];
      out[k] = list
        .filter((e): e is { value: string; n?: unknown } =>
          typeof e === "object" && e !== null && typeof (e as { value?: unknown }).value === "string" &&
          (e as { value: string }).value.trim() !== "")
        .slice(0, MAX_OPTIONS)
        .map((e) => ({ value: e.value, n: typeof e.n === "number" && Number.isFinite(e.n) ? e.n : null }));
    }
  } catch {
    // A missing or broken doc leaves the fallbacks below to answer.
  }
  if (out.citizenship.length === 0) {
    const countries = await rows<{ country: string; n: number | string }>(
      `SELECT country, SUM(certified + denied + withdrawn) AS n FROM perm_country_years
       WHERE fy >= 2016 AND country != '' GROUP BY country ORDER BY n DESC LIMIT ${MAX_OPTIONS}`,
    ).catch(() => []);
    out.citizenship = countries
      .filter((c) => typeof c.country === "string" && c.country)
      .map((c) => ({ value: c.country, n: Number(c.n) }));
  }
  if (out.birthCountry.length === 0) {
    out.birthCountry = out.citizenship.map((c) => ({ value: c.value, n: null }));
  }
  return out;
}
