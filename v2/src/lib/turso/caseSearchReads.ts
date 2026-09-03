import "server-only";

import { one, rows } from "./client";
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
import type { Lead, Outcome } from "@/lib/caseSearchPlan";

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
 * Turso forbids `ANALYZE` and this database has no `sqlite_stat1`, so SQLite
 * plans from its no-statistics heuristics, which prefer an EQUALITY over a
 * RANGE. Measured against production on 2026-09-03, an employer search with
 * a status filter and no hint planned as
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

export type FlagProgramKey = "pwd" | "lca";

export interface UnifiedNarrow {
  outcome?: Outcome;
  /** Case-insensitive "contains" on the job title. `%` and `_` are literal. */
  title?: string;
  /** Filing month, `YYYY-MM`, inclusive both ends. */
  from?: string;
  to?: string;
  /** Decision month, `YYYY-MM`, inclusive both ends. */
  decidedFrom?: string;
  decidedTo?: string;
  /** A resolved `attorney_slug`. Published PERM only - DOL names no firm elsewhere. */
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
}

/**
 * The status strings behind each outcome bucket, per table.
 *
 * MEASURED, NOT REMEMBERED. Read on 2026-09-03 from the tables themselves and
 * from the two live summary docs:
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
 * MEASURED. Reading a table row on this database costs about 1.5 ms on
 * `perm_cases` and about 6.8 ms on the colder `lca_cases`, so the cap is what
 * bounds a search rather than the row cap on the answer.
 */
export const SLICE_CAP = 400;

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
  index: string;
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

  const firstConds = [
    `${"employer_slug"} >= ?`,
    `${"employer_slug"} < ?`,
    ...plan.coveredConds,
  ];
  const ids = await rows<{ rowid: number }>(
    `SELECT rowid FROM ${plan.table} INDEXED BY ${plan.index} ` +
      `WHERE ${firstConds.join(" AND ")} ` +
      `ORDER BY ${plan.orderColumn} DESC LIMIT ?`,
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
      `ORDER BY ${plan.orderColumn} DESC, case_number DESC LIMIT ?`,
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
export function permLeadIndex(lead: Lead, hasOutcome: boolean): string {
  switch (lead.kind) {
    case "employer":
      // A RANGE, so the status column of the three-column index can never be
      // seeked. The narrower index is the cheaper walk.
      return "idx_pc_emp_dec";
    case "firm":
      return hasOutcome ? "idx_pc_att_st_dec" : "idx_pc_att_dec";
    case "state":
      return hasOutcome ? "idx_pc_state_st_dec" : "idx_pc_state_dec";
    case "occupation":
      return hasOutcome ? "idx_pc_soc_st_dec" : "idx_pc_soc_dec";
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
export async function readPermPublished(args: PermReadArgs): Promise<SliceResult<PermCaseRow>> {
  const { lead, narrow, limit } = args;
  const empty: SliceResult<PermCaseRow> = { rows: [], windowed: false };

  if (narrow.outcome === "open") {
    // Every row in a disclosure file has a decision on it, so this can only
    // ever be empty. Returning without a query rather than running one that
    // cannot match: a read that is guaranteed to find nothing is still a read
    // Turso charges for.
    return empty;
  }
  const bucket = narrow.outcome ? OUTCOME_STATUSES.perm_cases[narrow.outcome] : undefined;
  const index = permLeadIndex(lead, bucket !== undefined);

  const status = bucket ? statusClause("status", bucket) : null;

  if (lead.kind === "employer") {
    const range = slugRange(lead.value);
    if (!range) return empty;

    // `idx_pc_emp_dec` is `(employer_slug, decision_date)`, so the DECIDED
    // range is the only narrowing the covering pass can carry. The filed
    // range is on `received_date`, which the index does not hold.
    const covered = commonNarrowing(
      {
        ...(narrow.decidedFrom ? { decidedFrom: narrow.decidedFrom } : {}),
        ...(narrow.decidedTo ? { decidedTo: narrow.decidedTo } : {}),
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
      restConds.push("soc_code = ?");
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

    return readEmployerSlice<CaseDbRow, PermCaseRow>(
      {
        table: "perm_cases",
        index,
        columns: CASE_COLS,
        orderColumn: "decision_date",
        range,
        coveredConds: covered.conds,
        coveredParams: covered.params,
        restConds,
        restParams,
        limit,
      },
      toCaseRow,
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
    conds.push("soc_code = ?");
    params.push(lead.value);
  } else {
    return empty;
  }
  if (status) {
    conds.push(status.cond);
    params.push(...status.params);
  }
  // Under an equality lead the title and the filed-month range are stripped
  // rather than trusted: both are walks of the whole slice, the UI turns them
  // off, and this makes that structural instead of a convention two files
  // apart have to agree on. The decided range survives because it is the last
  // column of the same index.
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

  const found = await rows<CaseDbRow>(
    `SELECT ${CASE_COLS} FROM perm_cases INDEXED BY ${index} ` +
      `WHERE ${conds.join(" AND ")} ORDER BY decision_date DESC LIMIT ?`,
    [...params, limit],
  );
  return { rows: found.map(toCaseRow), windowed: false };
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
  published: string;
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

export async function readFlagPublished(
  program: FlagProgramKey,
  employerText: string,
  narrow: UnifiedNarrow,
  limit: number,
): Promise<SliceResult<FlagDisclosedRow>> {
  const empty: SliceResult<FlagDisclosedRow> = { rows: [], windowed: false };
  if (narrow.outcome === "open") return empty;
  const t = FLAG_TABLES[program];
  const range = slugRange(employerText);
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
  if (narrow.outcome) {
    const s = statusClause("case_status", OUTCOME_STATUSES[program][narrow.outcome]);
    restConds.push(s.cond);
    restParams.push(...s.params);
  }
  if (narrow.state) {
    restConds.push("worksite_state = ?");
    restParams.push(narrow.state);
  }
  if (narrow.socCode) {
    restConds.push("soc_code = ?");
    restParams.push(narrow.socCode);
  }
  if (narrow.fiscalYear) {
    // INTEGER here, TEXT in perm_cases. Two columns of the same name and two
    // storage classes; binding the wrong one matches nothing and errors nowhere.
    restConds.push("fiscal_year = ?");
    restParams.push(Number(narrow.fiscalYear));
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
      table: t.published,
      index: `${t.published}_emp`,
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
  const letter = caseNumber.charAt(0).toUpperCase();
  if (letter === "P") return "pwd";
  if (letter === "I") return "lca";
  return "perm";
}

export interface CaseLookupResult {
  program: "perm" | FlagProgramKey;
  permPublished: PermCaseRow | null;
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
    const [pub, live] = await Promise.all([
      one<CaseDbRow>(`SELECT ${CASE_COLS} FROM perm_cases WHERE case_number = ?`, [
        caseNumber,
      ]).catch(() => null),
      one<LiveDbRow>(
        `SELECT case_number, filing_date, current_status AS status, is_final,
                employer_name, job_title
           FROM perm_case_status WHERE case_number = ?`,
        [caseNumber],
      ).catch(() => null),
    ]);
    return {
      ...blank,
      permPublished: pub ? toCaseRow(pub) : null,
      permLive: live ? toLiveRow(live) : null,
    };
  }

  const t = FLAG_TABLES[program];
  const [pub, live] = await Promise.all([
    one<DisclosedDbRow>(
      `SELECT ${DISCLOSED_COLS} FROM ${t.published} WHERE case_number = ?`,
      [caseNumber],
    ).catch(() => null),
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
