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
  const index = permLeadIndex(lead, bucket !== undefined, narrow);

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

/**
 * The 6-digit SOC group a code belongs to, or null when it is not a SOC code.
 *
 * THE THREE PROGRAMS SPELL THE OCCUPATION DIFFERENTLY, and an exact equality
 * across them matches nothing. Measured on 2026-09-03:
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
  switch (lead.kind) {
    case "employer":
      return `${t}_emp`;
    case "state":
      return singleStatus ? `${t}_state_st_dec` : `${t}_state_dec`;
    case "occupation":
      return singleStatus ? `${t}_soc_st_dec` : `${t}_soc_dec`;
    case "firm":
      // DOL publishes `LAWFIRM_NAME_BUSINESS_NAME` in the ETA-9035 and
      // ETA-9141 disclosure files - read off the FY2026 Q3 record layouts on
      // 2026-09-03 - and as of the same day the ingest reads it. Before that
      // this returned null and the firm lead answered from the PERM file
      // alone, which said "this firm files no wage requests" by omission.
      return singleStatus ? `${t}_att_st_dec` : `${t}_att_dec`;
    case "case":
      // A point read on the primary key; this function is never asked.
      return null;
  }
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
  const bucket = narrow.outcome ? OUTCOME_STATUSES[program][narrow.outcome] : undefined;
  const index = flagLeadIndex(program, lead, bucket?.length === 1);
  if (!index) return empty;

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
    // The decided range only, and for the same reason as `readPermPublished`:
    // it is the last column of this index. The title and the filed range are
    // stripped rather than trusted, so no caller can reach the slice walk.
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

    const found = await rows<DisclosedDbRow>(
      `SELECT ${DISCLOSED_COLS} FROM ${t.published} INDEXED BY ${index} ` +
        `WHERE ${conds.join(" AND ")} ORDER BY decision_date DESC LIMIT ?`,
      [...params, limit],
    );
    return { rows: found.map(toDisclosed), windowed: false };
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
  if (narrow.state) {
    restConds.push("worksite_state = ?");
    restParams.push(narrow.state);
  }
  if (narrow.socCode) {
    // THE 6-DIGIT GROUP, not the code as typed. `pwd_cases` holds ZERO dotted
    // SOC codes out of 634,638, so `soc_code = '15-1252.00'` matches nothing
    // there and would report an employer as having filed no wage requests for
    // an occupation they file constantly. See `socGroup`.
    const group = socGroup(narrow.socCode);
    if (group) {
      restConds.push(`${SOC_GROUP_EXPR} = ?`);
      restParams.push(group);
    }
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
