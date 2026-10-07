import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lead } from "@/lib/caseSearchPlan";

/**
 * The SQL the unified search emits, asserted statement by statement.
 *
 * ASSERTS THE PLAN, NOT THE RESULT SET. Every defect this file exists to catch
 * is invisible in the rows that come back: an index that stops being named and
 * lets an equality filter steal the plan, a filter applied to one half of a
 * program and not the other, a fiscal year bound as a string against an integer
 * column. All three return a perfectly plausible answer and cost a fortune or
 * silently match nothing, so a shaped fixture would pass over every one.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

/**
 * Which columns each table has. The default is the world before the history
 * load: `perm_cases` unknown (so its extra columns read as NULL) and no history
 * table at all, which keeps every older assertion below about ONE table's SQL.
 * The history tests set it.
 */
const columns: Record<string, Set<string>> = {};
const tableColumns = vi.fn(async (t: string) => columns[t] ?? new Set<string>());
vi.mock("../tableColumns", () => ({ tableColumns }));

const {
  OUTCOME_STATUSES,
  SLICE_CAP,
  flagLeadIndex,
  getCaseFieldOptions,
  getPermHistoryYears,
  lookupUnifiedCase,
  permLeadIndex,
  programForCaseNumber,
  readFlagLive,
  readFlagPublished,
  readPermEmployerStage,
  readPermLive,
  readPermPublished,
  readPermStage,
  readFlagEmployerStage,
  readFlagStage,
  socGroup,
  wageSourceCondition,
} = await import("../caseSearchReads");

/**
 * An employer lead issues TWO statements: a covering first pass that picks the
 * newest rowids, then a rowid lookup that fetches those rows. The default mock
 * returns two rowids so the second statement is always reached; a first pass
 * that returns nothing short-circuits by design, and a test that never got
 * past it would silently assert on the wrong statement.
 */
beforeEach(() => {
  for (const k of Object.keys(columns)) delete columns[k];
  rows.mockReset();
  // Keyed on the statement rather than on call order, so a test that issues
  // more than one read still gets rowids from every first pass. Returning
  // rowid rows from the SECOND pass instead would feed them to a row mapper
  // and throw somewhere unrelated.
  rows.mockImplementation(async (sql: string) =>
    sql.startsWith("SELECT rowid") ? [{ rowid: 11 }, { rowid: 22 }] : [],
  );
  one.mockReset();
  one.mockResolvedValue(null);
});

/** The covering first pass of a two-pass employer read. */
const firstPass = () => ({
  sql: String(rows.mock.calls[0]?.[0] ?? ""),
  args: rows.mock.calls[0]?.[1] ?? [],
});
/** The rowid lookup that fetches the rows. */
const secondPass = () => ({
  sql: String(rows.mock.calls[1]?.[0] ?? ""),
  args: rows.mock.calls[1]?.[1] ?? [],
});

const employer: Lead = { kind: "employer", value: "amazon" };
const state: Lead = { kind: "state", value: "CA" };
const firm: Lead = { kind: "firm", value: "fragomen-del-rey-bernsen-loewy-llp" };
const occupation: Lead = { kind: "occupation", value: "15-1252.00" };

describe("permLeadIndex", () => {
  // The pairing of lead to index IS the feature. Reading it back out of the
  // SQL string would pass over a swap of two index names.
  it("uses the two-column index for a range lead, because status cannot be seeked after a range", () => {
    expect(permLeadIndex(employer, false)).toBe("idx_pc_emp_dec");
    expect(permLeadIndex(employer, true)).toBe("idx_pc_emp_dec");
  });

  it("adds status to the seek for the three equality leads", () => {
    expect(permLeadIndex(state, false)).toBe("idx_pc_state_dec");
    expect(permLeadIndex(state, true)).toBe("idx_pc_state_st_dec");
    expect(permLeadIndex(firm, false)).toBe("idx_pc_att_dec");
    expect(permLeadIndex(firm, true)).toBe("idx_pc_att_st_dec");
    // The occupation pair is on `substr(soc_code, 1, 7)`, matching the WHERE
    // clause. `idx_pc_soc_dec` is on the bare column and cannot serve the
    // expression, so pinning it would scan the whole index while reading like
    // a seek.
    expect(permLeadIndex(occupation, false)).toBe("idx_pc_socg_dec");
    expect(permLeadIndex(occupation, true)).toBe("idx_pc_socg_st_dec");
  });

  it("prefers a second equality over the outcome, because it is far more selective", () => {
    // Measured on the biggest firm in the corpus, fresh request each time:
    //   attorney_slug + state='WY' through idx_pc_att_dec   48,166 rows 17.11 s
    //   the same through idx_pc_att_state_dec                    5 rows  0.55 s
    // An outcome bucket cannot narrow like that, so when both are present the
    // pair of equalities takes the index and the status is tested on what is
    // left.
    expect(permLeadIndex(firm, true, { state: "CA" })).toBe("idx_pc_att_state_dec");
    expect(permLeadIndex(firm, true, { socCode: "15-1252" })).toBe("idx_pc_att_soc_dec");
    expect(permLeadIndex(state, true, { socCode: "15-1252" })).toBe("idx_pc_state_soc_dec");
    expect(permLeadIndex(occupation, true, { state: "CA" })).toBe("idx_pc_state_soc_dec");
    expect(permLeadIndex(state, true, { firmSlug: "fragomen" })).toBe("idx_pc_att_state_dec");
    // An empty string is not a filter, and must not steal the plan.
    expect(permLeadIndex(firm, true, { state: "" })).toBe("idx_pc_att_st_dec");
  });
});

describe("readPermPublished, employer lead", () => {
  it("reads in two passes, and the first one is covering", async () => {
    // THE MEASUREMENT BEHIND THIS. An employer prefix is a range, so the index
    // cannot supply the ordering and the slice has to be sorted. Sorting it as
    // TABLE ROWS took 137.5 s on Amazon's 20,230 LCAs and blew the read
    // deadline; the same slice through the covering index is 2.9 s. A revert
    // to one statement is invisible in the rows and catastrophic in the bill.
    await readPermPublished({ lead: employer, narrow: {}, limit: 100 });
    expect(rows).toHaveBeenCalledTimes(2);
    expect(firstPass().sql).toMatch(
      /SELECT rowid FROM perm_cases INDEXED BY idx_pc_emp_dec WHERE employer_slug >= \? AND employer_slug < \? ORDER BY decision_date DESC LIMIT \?/,
    );
    expect(firstPass().args).toEqual(["amazon", "amazoo", 100]);
    // `NOT INDEXED` is asserted because without it SQLite planned the rowid
    // fetch through `lca_case_status_stage (current_status=?)` and read every
    // CERTIFIED LCA in the table: 30.63 s against 1.04 s.
    expect(secondPass().sql).toMatch(/FROM perm_cases NOT INDEXED WHERE rowid IN \(\?, \?\)/);
    expect(secondPass().args).toEqual([11, 22, 100]);
  });

  it("does not fetch any rows when the first pass finds none", async () => {
    rows.mockResolvedValueOnce([]);
    const out = await readPermPublished({ lead: employer, narrow: {}, limit: 100 });
    expect(out).toEqual({ rows: [], windowed: false });
    expect(rows).toHaveBeenCalledTimes(1);
  });

  it("puts the decided range in the first pass, which the index carries", async () => {
    await readPermPublished({
      lead: employer,
      narrow: { decidedFrom: "2025-01", decidedTo: "2025-03" },
      limit: 100,
    });
    expect(firstPass().sql).toContain("decision_date >= ?");
    expect(firstPass().args).toEqual(["amazon", "amazoo", "2025-01-01", "2025-04-01", 100]);
  });

  it("turns a fiscal year into the first pass's decided range, so an old year is reached", async () => {
    // Adobe FY2019 answered 0 rows on Sep 27 2026 with 184 in the table: the
    // year was tested only over the newest window the first pass had taken.
    columns.perm_cases_history = new Set(["case_number", "employer_slug", "decision_date", "fiscal_year"]);
    await readPermPublished({ lead: employer, narrow: { fiscalYear: "2019" }, limit: 100 });
    expect(firstPass().sql).toMatch(/perm_cases_history .*decision_date >= \? AND decision_date < \?/);
    expect(firstPass().args.slice(0, 4)).toEqual(["amazon", "amazoo", "2018-10-01", "2019-10-01"]);
    expect(secondPass().sql).toContain("fiscal_year = ?");
  });

  it("intersects a fiscal year with a decided range, and an empty intersection reads nothing", async () => {
    columns.perm_cases_history = new Set(["case_number", "employer_slug", "decision_date", "fiscal_year"]);
    await readPermPublished({
      lead: employer,
      narrow: { fiscalYear: "2019", decidedFrom: "2019-03" },
      limit: 100,
    });
    expect(firstPass().args.slice(0, 4)).toEqual(["amazon", "amazoo", "2019-03-01", "2019-10-01"]);
    rows.mockClear();
    const out = await readPermPublished({
      lead: employer,
      narrow: { fiscalYear: "2019", decidedFrom: "2020-01" },
      limit: 100,
    });
    expect(out.rows).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });

  it("puts every other filter in the second pass, over the window", async () => {
    await readPermPublished({
      lead: employer,
      narrow: {
        outcome: "granted",
        title: "engineer",
        from: "2024-01",
        to: "2024-12",
        firmSlug: "firm-llp",
        state: "WA",
        socCode: "15-1252.00",
        fiscalYear: "2025",
        wageMin: 100000,
        wageMax: 300000,
      },
      limit: 100,
    });
    const sql = secondPass().sql;
    for (const clause of [
      "status = ?",
      "attorney_slug = ?",
      "state = ?",
      // THE 6-DIGIT GROUP, NOT AN EXACT MATCH. `perm_cases` holds 302,081
      // dotted codes (`15-1252.00`) and 71,858 bare ones (`15-1252`), so an
      // equality matches one spelling and silently misses the other. The
      // equality leads have always used the group; the employer path used to
      // use `soc_code = ?`, which meant the same occupation answered
      // differently depending on which box the reader filled.
      "substr(soc_code, 1, 7) = ?",
      "fiscal_year = ?",
      "wage >= ?",
      "wage <= ?",
      "job_title LIKE ?",
      "received_date >= ?",
      "received_date < ?",
    ]) {
      expect(sql).toContain(clause);
    }
    // The fiscal year is TEXT on this table and INTEGER on the flag files.
    // Binding the wrong storage class matches nothing and errors nowhere.
    expect(secondPass().args).toContain("2025");
    // With filters the first pass widens to the slice cap rather than the
    // answer's own limit, so the filter has a window to work in.
    expect(firstPass().args.at(-1)).toBe(SLICE_CAP);
  });

  it("says `windowed` only when the filtered first pass filled its cap", async () => {
    rows.mockReset();
    rows.mockResolvedValueOnce(Array.from({ length: SLICE_CAP }, (_, i) => ({ rowid: i })));
    rows.mockResolvedValueOnce([]);
    const full = await readPermPublished({ lead: employer, narrow: { wageMin: 1 }, limit: 100 });
    expect(full.windowed).toBe(true);

    rows.mockReset();
    rows.mockResolvedValueOnce([{ rowid: 1 }]);
    rows.mockResolvedValueOnce([]);
    const short = await readPermPublished({ lead: employer, narrow: { wageMin: 1 }, limit: 100 });
    expect(short.windowed).toBe(false);
  });

  it("never says `windowed` when nothing was filtered inside the window", async () => {
    rows.mockReset();
    rows.mockResolvedValueOnce(Array.from({ length: SLICE_CAP }, (_, i) => ({ rowid: i })));
    rows.mockResolvedValueOnce([]);
    const out = await readPermPublished({ lead: employer, narrow: {}, limit: 100 });
    expect(out.windowed).toBe(false);
  });

  it("returns nothing for a needle too short to slug", async () => {
    expect(
      await readPermPublished({ lead: { kind: "employer", value: "a" }, narrow: {}, limit: 10 }),
    ).toEqual({ rows: [], windowed: false });
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("readPermPublished, equality leads", () => {
  it("is ONE statement, because the index supplies the ordering", async () => {
    // 0.30 s for the whole of California, measured. The two-pass read exists
    // for the range lead and would only add a round trip here.
    await readPermPublished({ lead: state, narrow: {}, limit: 100 });
    expect(rows).toHaveBeenCalledTimes(1);
    expect(firstPass().sql).toMatch(
      /SELECT case_number.* FROM perm_cases INDEXED BY idx_pc_state_dec WHERE state = \? ORDER BY decision_date DESC LIMIT \?/,
    );
    expect(firstPass().args).toEqual(["CA", 100]);
  });

  it("moves to the status index when an outcome is asked for", async () => {
    await readPermPublished({ lead: state, narrow: { outcome: "denied" }, limit: 50 });
    expect(firstPass().sql).toMatch(/INDEXED BY idx_pc_state_st_dec WHERE state = \? AND status = \?/);
    expect(firstPass().args).toEqual(["CA", "denied", 50]);
  });

  it("translates each outcome into the vocabulary this table actually uses", async () => {
    // perm_cases stores its three statuses in LOWER CASE; the live tables shout.
    // A bucket built from memory rather than measurement matches nothing here.
    for (const [outcome, status] of [
      ["granted", "certified"],
      ["denied", "denied"],
      ["withdrawn", "withdrawn"],
    ] as const) {
      rows.mockClear();
      await readPermPublished({ lead: state, narrow: { outcome }, limit: 10 });
      expect(firstPass().args).toEqual(["CA", status, 10]);
    }
  });

  it('reads nothing at all for "still open"', async () => {
    // Every row in a disclosure file has a decision on it, so this can only be
    // empty. A read guaranteed to find nothing is still a read Turso charges.
    const out = await readPermPublished({ lead: employer, narrow: { outcome: "open" }, limit: 100 });
    expect(out).toEqual({ rows: [], windowed: false });
    expect(rows).not.toHaveBeenCalled();
  });

  it("carries every narrowing an equality lead is given, and seeks the pair", async () => {
    // THE INVERSE OF WHAT THIS ASSERTED, and the inversion is the point. These
    // used to be stripped here so that a state search plus a wage bound could
    // not be reached from any caller. The cost that justified it was a
    // SELECTIVE second equality walking the lead's whole slice: firm plus
    // `state='WY'` read 48,166 rows in 17.11 s to return four cases.
    //
    // `idx_pc_state_soc_dec` and its two siblings make that pair the leading
    // columns of an index, so the same shape reads 5 rows in 0.55 s. Stripping
    // the filters now would only mean returning cases the reader explicitly
    // excluded.
    await readPermPublished({
      lead: state,
      narrow: {
        title: "engineer",
        from: "2024-01",
        to: "2024-12",
        wageMin: 100000,
        socCode: "15-1252",
      },
      limit: 100,
    });
    // Read the WHERE clause, not the whole statement: every one of these
    // column names also appears in the SELECT list, so a naive `toContain`
    // over the string would pass on a query that filtered by none of them.
    const where = firstPass().sql.split(" WHERE ")[1] ?? "";
    for (const clause of [
      "state = ?",
      "substr(soc_code, 1, 7) = ?",
      "job_title LIKE",
      "received_date",
      "wage >= ?",
    ]) {
      expect([clause, where.includes(clause)]).toEqual([clause, true]);
    }
    // AND THE PAIR PICKS THE COMPOSITE INDEX. Without this the filters would
    // be honoured by walking, which is the slow shape the restriction existed
    // to prevent.
    expect(firstPass().sql).toContain("INDEXED BY idx_pc_state_soc_dec");
  });

  it("keeps the decided-date range, because the index carries it", async () => {
    await readPermPublished({
      lead: occupation,
      narrow: { decidedFrom: "2025-01", decidedTo: "2025-03" },
      limit: 100,
    });
    expect(firstPass().sql).toMatch(
      /INDEXED BY idx_pc_socg_dec WHERE substr\(soc_code, 1, 7\) = \?/,
    );
    // THE NEEDLE IS THE GROUP, NOT THE LEAD'S OWN SPELLING. `substr(x, 1, 7)`
    // is seven characters, so binding `15-1252.00` compares ten against seven
    // and matches nothing. This assertion is what caught it.
    expect(firstPass().args).toEqual(["15-1252", "2025-01-01", "2025-04-01", 100]);
  });
});

describe("readPermLive", () => {
  it("names its index, and the filed range rides the covering first pass", async () => {
    await readPermLive("amazon", { title: "engineer", from: "2026-01", to: "2026-02" }, 100);
    expect(firstPass().sql).toMatch(
      /SELECT rowid FROM perm_live_recent INDEXED BY perm_live_recent_emp/,
    );
    expect(firstPass().args).toEqual(["amazon", "amazoo", "2026-01-01", "2026-03-01", SLICE_CAP]);
    expect(secondPass().sql).toContain("job_title LIKE ?");
    expect(secondPass().sql).toMatch(/ORDER BY filing_date DESC, case_number DESC LIMIT \?$/);
  });

  it('reads "still open" off is_final, not off a status string', async () => {
    // The live vocabulary has five or more values and grows whenever DOL adds a
    // review stage. `is_final` is the flag the ingest computes and the only one
    // that stays true as the vocabulary moves.
    await readPermLive("amazon", { outcome: "open" }, 100);
    expect(secondPass().sql).toContain("is_final = ?");
    expect(secondPass().args).toEqual([11, 22, 0, 100]);
  });

  it("uses an IN list where a bucket holds several statuses", async () => {
    await readPermLive("amazon", { outcome: "granted" }, 100);
    expect(secondPass().sql).toContain("status IN (?, ?)");
    expect(secondPass().args).toEqual([11, 22, "CERTIFIED", "CERTIFIED - EXPIRED", 100]);
  });

  it("has no decided-date range to apply, because a live row has no decision date", async () => {
    await readPermLive("amazon", { decidedFrom: "2025-01" }, 100);
    expect(firstPass().sql).not.toContain("decision_date");
    expect(secondPass().sql).not.toContain("decision_date");
  });
});

describe("readFlagLive", () => {
  it("scopes the wage-request program to PERM and names its index", async () => {
    await readFlagLive("pwd", "amazon", {}, 100);
    expect(firstPass().sql).toMatch(
      /SELECT rowid FROM pwd_case_status INDEXED BY pwd_case_status_emp/,
    );
    expect(secondPass().sql).toContain("visa_type = ?");
    expect(secondPass().args).toEqual([11, 22, "PERM", 100]);
  });

  it("has no visa scope on the LCA program, because every row there is one", async () => {
    await readFlagLive("lca", "amazon", {}, 100);
    expect(firstPass().sql).toMatch(
      /SELECT rowid FROM lca_case_status INDEXED BY lca_case_status_emp/,
    );
    // The WHERE clause: `visa_type` is one of the SELECTed columns on this
    // table too, so the whole statement always contains the word.
    expect(secondPass().sql.split(" WHERE ")[1] ?? "").not.toContain("visa_type");
  });

  it("uses each program's own status vocabulary", async () => {
    await readFlagLive("pwd", "amazon", { outcome: "granted" }, 100);
    expect(secondPass().args).toEqual([
      11,
      22,
      "PERM",
      ...OUTCOME_STATUSES.pwd.granted,
      100,
    ]);
  });
});

describe("socGroup", () => {
  // THE THREE PROGRAMS SPELL THE OCCUPATION DIFFERENTLY and an exact equality
  // across them matches nothing: `pwd_cases` holds ZERO dotted codes out of
  // 634,638, `lca_cases` holds 434,314 of them, and the leads resolved from
  // `perm_entities` arrive in both forms. None of that shows in a result set -
  // it shows as a program contributing no rows, which looks exactly like a
  // program with no rows to contribute.
  it.each([
    ["15-1252.00", "15-1252"],
    ["15-1299.09", "15-1299"],
    ["49-3051", "49-3051"],
    ["  15-1252.00  ", "15-1252"],
  ])("folds %s to its 6-digit group", (code, group) => {
    expect(socGroup(code)).toBe(group);
  });

  it("returns null for anything that is not a SOC code, rather than binding it", () => {
    for (const junk of ["", "software", "15", "15-125", "'; DROP TABLE"]) {
      expect(socGroup(junk)).toBeNull();
    }
  });
});

describe("flagLeadIndex", () => {
  // The pairing of lead to index IS the feature, and reading it back out of
  // the SQL would pass over two index names being swapped.
  it("adds the status column to the seek only for a SINGLE-status bucket", () => {
    expect(flagLeadIndex("pwd", state, false)).toBe("pwd_cases_state_dec");
    expect(flagLeadIndex("pwd", state, true)).toBe("pwd_cases_state_st_dec");
    expect(flagLeadIndex("lca", occupation, false)).toBe("lca_cases_soc_dec");
    expect(flagLeadIndex("lca", occupation, true)).toBe("lca_cases_soc_st_dec");
  });

  it("keeps the employer index for a range lead", () => {
    expect(flagLeadIndex("lca", employer, true)).toBe("lca_cases_emp");
  });

  it("seeks a firm on both programs, now that the column is ingested", () => {
    // THIS USED TO ASSERT NULL, and the reason was true at the time: DOL
    // publishes `LAWFIRM_NAME_BUSINESS_NAME` in both the ETA-9035 and the
    // ETA-9141 disclosure files, and `ingest_flag_disclosure.py` had never
    // mapped it, so there was no column here to seek. A missing ingest, not a
    // missing index. The ingest reads it now and backfills it with
    // `--backfill-attorney`, so a firm lead reaches all three programs and a
    // law firm's page can stop implying it files no wage requests.
    expect(flagLeadIndex("pwd", firm, false)).toBe("pwd_cases_att_dec");
    expect(flagLeadIndex("pwd", firm, true)).toBe("pwd_cases_att_st_dec");
    expect(flagLeadIndex("lca", firm, false)).toBe("lca_cases_att_dec");
    expect(flagLeadIndex("lca", firm, true)).toBe("lca_cases_att_st_dec");
  });
});

describe("the index names, against the DDL that creates them", () => {
  // A DRIFT HERE IS SILENT, WHICH IS WHY IT IS GATED. `INDEXED BY <name>` over
  // an index that does not exist raises "no such index", and `unifiedSearch`
  // catches every read individually so one program's failure narrows the
  // answer rather than blanking the page. So a renamed index does not error:
  // the wage-request half just stops appearing, which is indistinguishable
  // from an employer who has filed no wage requests.
  const ddl = readFileSync(
    join(process.cwd(), "scripts/ingest_flag_disclosure.py"),
    "utf8",
  );

  it.each(["pwd", "lca"] as const)("%s: every index this file names is created", (program) => {
    const names = new Set<string>();
    for (const lead of [employer, state, occupation]) {
      for (const single of [true, false]) {
        const n = flagLeadIndex(program, lead, single);
        if (n) names.add(n);
      }
    }
    // Five per program: the employer index plus the four created for the
    // state and occupation leads. A count guard, so a `flagLeadIndex` that
    // started returning null for everything could not pass this vacuously.
    expect(names.size).toBe(5);
    // The Python builds these from an f-string, so the file holds the TEMPLATE
    // (`{table}_emp`) and never the interpolated name. Matching the
    // interpolated form is what the first version of this gate did, and it
    // failed against a correct DDL - the tenth time a new gate's first run was
    // mostly the gate.
    const table = program === "pwd" ? "pwd_cases" : "lca_cases";
    for (const name of names) {
      const suffix = name.slice(table.length);
      expect(ddl, `${name} is not created by ingest_flag_disclosure.py`).toContain(
        "CREATE INDEX IF NOT EXISTS {table}" + suffix + " ON {table} (",
      );
    }
  });

  it("builds the SOC indexes on the expression the reads filter by", () => {
    // SQLite serves a filter on an expression only from an index on the SAME
    // expression. A space added on one side of this and the plan silently
    // falls back to `SCAN <table> USING INDEX <table>_decided`, which read
    // 437,496 rows to return none before these indexes existed.
    expect(ddl).toContain("(substr(soc_code, 1, 7), decision_date)");
    expect(ddl).toContain("(substr(soc_code, 1, 7), case_status, decision_date)");
  });
});

describe("readFlagPublished, the seasonal file", () => {
  it("reads seasonal_cases, where DOL's H-2A, H-2B and CW-1 files land, by its own indexes", async () => {
    await readFlagPublished("seasonal", employer, {}, 100);
    expect(firstPass().sql).toMatch(/SELECT rowid FROM seasonal_cases INDEXED BY seasonal_cases_emp/);
    rows.mockClear();
    await readFlagPublished("seasonal", { kind: "state", value: "GA" }, {}, 100);
    expect(rows.mock.calls[0]?.[0]).toMatch(/FROM seasonal_cases INDEXED BY seasonal_cases_state_dec/);
  });

  it("scopes no visa class: the visa is the program here, and all three belong to it", async () => {
    await readFlagPublished("seasonal", { kind: "firm", value: "fragomen" }, {}, 100);
    expect(rows.mock.calls[0]?.[0]).not.toContain("visa_class = ?");
  });

  it("counts a published certification, partial or expired, as granted", async () => {
    await readFlagPublished("seasonal", { kind: "state", value: "GA" }, { outcome: "granted" }, 100);
    const args = rows.mock.calls[0]?.[1] as unknown[];
    expect(args).toContain("DETERMINATION ISSUED - CERTIFICATION");
    expect(args).toContain("DETERMINATION ISSUED - PARTIAL CERTIFICATION (EXPIRED)");
    expect(args).not.toContain("DETERMINATION ISSUED - DENIED");
  });
});

describe("readFlagPublished, employer lead", () => {
  it("names its index, scopes the visa class and orders by the received date", async () => {
    await readFlagPublished("pwd", employer, {}, 100);
    expect(firstPass().sql).toMatch(/SELECT rowid FROM pwd_cases INDEXED BY pwd_cases_emp/);
    expect(secondPass().sql).toContain("visa_class = ?");
    expect(secondPass().sql).toMatch(/ORDER BY received_date DESC, case_number DESC LIMIT \?$/);
  });

  it("binds the fiscal year as a NUMBER here, where the column is INTEGER", async () => {
    // The same field name is TEXT on perm_cases. A string bound against an
    // INTEGER column matches nothing in SQLite and raises no error at all.
    await readFlagPublished("lca", employer, { fiscalYear: "2025" }, 100);
    expect(secondPass().args).toEqual([11, 22, 2025, 100]);
  });

  it("compares the wage bounds as yearly figures, the way the boxes are labelled", async () => {
    // These files quote the unit the employer pays in. Against the raw amount,
    // "at least $100,000" dropped every $50-an-hour offer ($104,000 a year)
    // and kept a yearly salary filed as "$100,000 per month".
    await readFlagPublished("lca", employer, { wageMin: 100000, wageMax: 300000 }, 100);
    const sql = secondPass().sql;
    expect(sql).toContain("WHEN wage_unit IN ('HOUR', 'HOURLY') THEN wage * 2080");
    expect(sql).toMatch(/END\) >= \?/);
    expect(sql).toMatch(/END\) <= \?/);
    expect(sql).not.toMatch(/ AND wage >= \? /);
    expect(secondPass().args).toEqual(expect.arrayContaining([100000, 300000]));
  });

  it("filters on worksite_state, which is what this file calls the column", async () => {
    await readFlagPublished("lca", employer, { state: "TX", socCode: "15-1252.00" }, 100);
    expect(secondPass().sql).toContain("worksite_state = ?");
  });

  it("applies the law-firm filter too, which it once ignored", async () => {
    await readFlagPublished("pwd", employer, { firmSlug: "fragomen" }, 100);
    expect(secondPass().sql).toContain("attorney_slug = ?");
    expect(secondPass().args).toContain("fragomen");
  });

  it("narrows by the SOC GROUP, because a dotted code matches nothing here", async () => {
    // `soc_code = '15-1252.00'` against pwd_cases matches 0 of 634,638 rows,
    // so an employer who files wage requests for that occupation constantly
    // would come back with none and nothing would error.
    await readFlagPublished("pwd", employer, { socCode: "15-1252.00" }, 100);
    expect(secondPass().sql).toContain("substr(soc_code, 1, 7) = ?");
    expect(secondPass().args).toContain("15-1252");
    expect(secondPass().args).not.toContain("15-1252.00");
  });

  it('reads nothing for "still open"', async () => {
    expect(await readFlagPublished("pwd", employer, { outcome: "open" }, 100)).toEqual({
      rows: [],
      windowed: false,
    });
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("readFlagPublished, equality leads", () => {
  // ONE STATEMENT, NOT TWO. The two-pass employer read exists because a prefix
  // range cannot supply the ordering; an equality can, so the same shape here
  // would read a covering pass it does not need.
  it("reads a state lead in one indexed statement", async () => {
    rows.mockResolvedValueOnce([]);
    await readFlagPublished("pwd", state, {}, 100);
    expect(rows).toHaveBeenCalledTimes(1);
    expect(firstPass().sql).toMatch(
      /SELECT case_number.* FROM pwd_cases INDEXED BY pwd_cases_state_dec WHERE worksite_state = \? AND visa_class = \? ORDER BY decision_date DESC LIMIT \?/,
    );
    expect(firstPass().args).toEqual(["CA", "PERM", 100]);
  });

  it("moves to the status index only when the bucket is one status", async () => {
    // pwd's granted bucket holds FIVE statuses, so it rides the plain index
    // and filters: an IN list cannot seek the middle column of a three-column
    // index, and SQLite would sort the union instead of streaming it.
    rows.mockResolvedValue([]);
    await readFlagPublished("lca", state, { outcome: "denied" }, 100);
    expect(firstPass().sql).toContain("INDEXED BY lca_cases_state_st_dec");
    rows.mockClear();
    await readFlagPublished("pwd", state, { outcome: "granted" }, 100);
    expect(firstPass().sql).toContain("INDEXED BY pwd_cases_state_dec");
    expect(firstPass().sql).toContain("case_status IN (?, ?, ?, ?, ?)");
  });

  it("seeks the SOC group expression the index is built on", async () => {
    rows.mockResolvedValueOnce([]);
    await readFlagPublished("lca", occupation, {}, 100);
    expect(firstPass().sql).toContain("INDEXED BY lca_cases_soc_dec");
    // SQLite serves a filter on an expression only from an index on the SAME
    // expression, so this string and the CREATE INDEX are one fact.
    expect(firstPass().sql).toContain("substr(soc_code, 1, 7) = ?");
    expect(firstPass().args).toEqual(["15-1252", 100]);
  });

  it("keeps the decided range, which is the last column of the index", async () => {
    rows.mockResolvedValueOnce([]);
    await readFlagPublished("lca", state, { decidedFrom: "2025-01", decidedTo: "2025-03" }, 100);
    expect(firstPass().args).toEqual(["CA", "2025-01-01", "2025-04-01", 100]);
  });

  it("applies every other filter inside a window of the lead, rather than dropping it", async () => {
    // It used to strip these, while the form offered them and the route passed
    // them through, so "this firm, in Wyoming" answered with the firm's wage
    // requests and LCAs from every state (found Oct 7 2026). PERM applies them;
    // so does every program now.
    await readFlagPublished(
      "pwd",
      state,
      { title: "engineer", from: "2024-01", to: "2024-12", wageMin: 100000, fiscalYear: "2025", firmSlug: "fragomen" },
      100,
    );
    // The seek: the lead and the visa class only, over the newest SLICE_CAP.
    expect(firstPass().sql).toMatch(/^SELECT rowid FROM pwd_cases INDEXED BY pwd_cases_state_dec WHERE worksite_state = \? AND visa_class = \?/);
    expect(firstPass().args).toEqual(["CA", "PERM", SLICE_CAP]);
    // The test: every filter, on the rows the seek found.
    const second = String(rows.mock.calls[1]?.[0] ?? "");
    const where = second.split(" WHERE ")[1] ?? "";
    expect(second).toContain("NOT INDEXED");
    expect(where).toContain("rowid IN (?, ?)");
    expect(where).toContain("attorney_slug = ?");
    expect(where).toContain("fiscal_year = ?");
    expect(where).toMatch(/>= \?/);
    expect(where).toContain("job_title LIKE");
    expect(where).toContain("received_date");
    const args = rows.mock.calls[1]?.[1] as unknown[];
    expect(args).toContain("fragomen");
    expect(args).toContain(2025);
    expect(args).toContain(100000);
  });

  it("applies a second equality on a firm lead", async () => {
    await readFlagPublished("lca", firm, { state: "WY", socCode: "15-1252.00" }, 100);
    expect(firstPass().sql).toContain("INDEXED BY lca_cases_att_dec");
    const where = String(rows.mock.calls[1]?.[0] ?? "").split(" WHERE ")[1] ?? "";
    expect(where).toContain("worksite_state = ?");
    expect(where).toContain("substr(soc_code, 1, 7) = ?");
    expect(rows.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["WY", "15-1252"]));
  });

  it("says the filters ran inside a window when the window was full", async () => {
    rows.mockImplementation(async (sql: string) =>
      sql.startsWith("SELECT rowid") ? Array.from({ length: SLICE_CAP }, (_, i) => ({ rowid: i + 1 })) : [],
    );
    expect((await readFlagPublished("pwd", state, { firmSlug: "fragomen" }, 100)).windowed).toBe(true);
    rows.mockImplementation(async (sql: string) => (sql.startsWith("SELECT rowid") ? [{ rowid: 1 }] : []));
    expect((await readFlagPublished("pwd", state, { firmSlug: "fragomen" }, 100)).windowed).toBe(false);
  });

  it("seeks the firm rather than reading nothing, now that it is ingested", async () => {
    // This asserted "no statement at all", which was right while the column
    // did not exist: a read guaranteed to find nothing is still a read Turso
    // charges for. The column is ingested now, so the correct behaviour is a
    // seek on the firm index.
    await readFlagPublished("lca", firm, {}, 100);
    const sql = (rows as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as string;
    expect(sql).toContain("INDEXED BY lca_cases_att_dec");
    expect(sql).toContain("attorney_slug = ?");
  });

  it("reads nothing when the occupation lead is not a SOC code", async () => {
    expect(
      await readFlagPublished("lca", { kind: "occupation", value: "software" }, {}, 100),
    ).toEqual({ rows: [], windowed: false });
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("programForCaseNumber", () => {
  // DOL draws every foreign-labor number off ONE serial counter and tells the
  // programs apart by the letter, so this decides which two tables to read.
  it.each([
    ["G-100-26125-868956", "perm"],
    ["A-23043-00641", "perm"],
    ["G-300-25075-779669", "perm"],
    ["P-100-26232-000009", "pwd"],
    ["I-200-26232-000001", "lca"],
    ["I-203-26232-000001", "lca"],
    // H-2A, H-2B and the H-2B wage request: P-400 is NOT the PERM-queue
    // wage request, which is P-100.
    ["H-300-26272-266803", "seasonal"],
    ["H-400-26050-650195", "seasonal"],
    ["P-400-26272-268643", "seasonal"],
  ])("%s is %s", (n, program) => {
    expect(programForCaseNumber(n)).toBe(program);
  });
});

describe("lookupUnifiedCase", () => {
  it("reads two primary keys, not six tables", async () => {
    await lookupUnifiedCase("G-100-26125-868956");
    expect(one).toHaveBeenCalledTimes(2);
    const sqls = one.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /FROM perm_cases WHERE case_number = \?/.test(s))).toBe(true);
    // The WHOLE live corpus, not the `perm_live_recent` remainder: a case DOL
    // decided since the last quarterly file has left the remainder and is
    // still the row somebody typing that number wants.
    expect(sqls.some((s) => /FROM perm_case_status WHERE case_number = \?/.test(s))).toBe(true);
  });

  it("reads the wage-request tables for a P- number and no PERM table", async () => {
    await lookupUnifiedCase("P-100-26232-000009");
    const sqls = one.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes("FROM pwd_cases"))).toBe(true);
    expect(sqls.some((s) => s.includes("FROM pwd_case_status"))).toBe(true);
    expect(sqls.some((s) => s.includes("perm_cases"))).toBe(false);
  });

  it("reads the H-2A and H-2B tables for an H- number, live and published, and no PERM table", async () => {
    await lookupUnifiedCase("H-300-26272-266803");
    const sqls = one.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes("FROM seasonal_case_status WHERE case_number = ?"))).toBe(true);
    expect(sqls.some((s) => s.includes("FROM seasonal_cases WHERE case_number = ?"))).toBe(true);
    expect(sqls.some((s) => s.includes("perm_cases"))).toBe(false);
  });

  it("degrades one half at a time rather than failing the lookup", async () => {
    one.mockRejectedValueOnce(new Error("turso query deadline"));
    const out = await lookupUnifiedCase("G-100-26125-868956");
    expect(out.program).toBe("perm");
    expect(out.permPublished).toBeNull();
  });
});

describe("the stage readers", () => {
  beforeEach(() => {
    rows.mockReset();
    rows.mockResolvedValue([]);
  });

  it("reads a stage through its own index, oldest first, fixture excluded, month and title narrowed", async () => {
    await readPermStage("APPLICATION ON HOLD", { from: "2026-01", to: "2026-01", title: "analyst" }, 100);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("FROM perm_case_status c INDEXED BY case_status_stage");
    expect(sql).toContain("c.current_status = ? AND c.is_final = 0 AND c.employer_name IS NOT ?");
    expect(sql).toContain("c.filing_date >= ?");
    expect(sql).toContain("c.filing_date < ?");
    expect(sql).toContain("c.job_title LIKE ? ESCAPE");
    expect(sql).toContain("ORDER BY c.filing_date, c.case_number LIMIT ?");
    // The slug comes from whichever table holds the case.
    expect(sql).toContain("COALESCE(l.employer_slug, p.employer_slug) AS employer_slug");
    expect(args).toEqual(["APPLICATION ON HOLD", "bah-test-company-name", "2026-01-01", "2026-02-01", "%analyst%", 101]);
  });

  it("reads an employer's stage from the employer side, both halves unioned, never from the stage side", async () => {
    await readPermEmployerStage("Cognizant", "ANALYST REVIEW", {}, 100);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("FROM perm_live_recent l INDEXED BY perm_live_recent_emp");
    expect(sql).toContain("FROM perm_cases p INDEXED BY idx_pc_emp_dec");
    expect(sql).toContain("UNION");
    expect(sql).not.toContain("INDEXED BY case_status_stage");
    expect(args).toEqual(["cognizant", "cognizanu", "ANALYST REVIEW", "cognizant", "cognizanu", "ANALYST REVIEW", 101]);
  });

  it("reports windowed when a row past the limit came back, and maps the live row shape", async () => {
    rows.mockResolvedValue([
      { case_number: "G-100-26030-100001", filing_date: "2026-01-30", status: "RFI ISSUED", is_final: "0", employer_name: "Acme", employer_slug: "acme", job_title: "Dev" },
      { case_number: "G-100-26030-100002", filing_date: "2026-01-31", status: "RFI ISSUED", is_final: 0, employer_name: "Acme", employer_slug: null, job_title: null },
    ]);
    const out = await readPermStage("RFI ISSUED", {}, 1);
    expect(out.windowed).toBe(true);
    expect(out.rows).toEqual([
      { caseNumber: "G-100-26030-100001", filingDate: "2026-01-30", status: "RFI ISSUED", isFinal: false, employerName: "Acme", employerSlug: "acme", jobTitle: "Dev" },
    ]);
  });

  it("refuses an employer needle too short to bound the slice", async () => {
    const out = await readPermEmployerStage("x", "RFI ISSUED", {}, 100);
    expect(out).toEqual({ rows: [], windowed: false });
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("the wage-request and LCA stage readers", () => {
  beforeEach(() => {
    rows.mockReset();
    rows.mockResolvedValue([]);
  });

  it("reads a wage-request stage through its own index with the PERM visa type pinned", async () => {
    await readFlagStage("pwd", "RFI ISSUED", { from: "2026-01" }, 50);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("FROM pwd_case_status INDEXED BY pwd_case_status_stage");
    expect(sql).toContain("current_status = ? AND is_final = 0 AND visa_type = ? AND filing_date >= ?");
    expect(sql).not.toContain("c.");
    expect(args).toEqual(["RFI ISSUED", "PERM", "2026-01-01", 51]);
  });

  it("reads an employer's LCA stage from the employer index, no visa type", async () => {
    await readFlagEmployerStage("lca", "Cognizant", "IN PROCESS", {}, 50);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("FROM lca_case_status INDEXED BY lca_case_status_emp");
    expect(sql).toContain("employer_slug >= ? AND employer_slug < ? AND current_status = ? AND is_final = 0");
    // `visa_type` is one of the columns returned; it must not be a predicate here.
    expect(sql).not.toContain("visa_type = ?");
    expect(args).toEqual(["cognizant", "cognizanu", "IN PROCESS", 51]);
  });
});

describe("published PERM across the current table and the FY2016-FY2023 history", () => {
  const BASE = [
    "case_number", "status", "received_date", "decision_date", "days", "employer_name",
    "employer_slug", "state", "job_title", "soc_code", "soc_title", "attorney_name",
    "attorney_slug", "wage",
  ];
  const WITH_EXTRAS = new Set([
    ...BASE, "naics", "worksite_city", "citizenship", "birth_country", "visa_class",
    "education", "major", "institution", "job_education",
  ]);
  const dbRow = (case_number: string, decision_date: string, extra: Record<string, unknown> = {}) => ({
    case_number, status: "certified", received_date: "2020-01-02", decision_date, days: 100,
    employer_name: "ACME", employer_slug: "acme", state: "CA", job_title: "Engineer",
    soc_code: "15-1252.00", soc_title: "Software Developers", attorney_name: null,
    attorney_slug: null, wage: 100000, ...extra,
  });
  const sqls = () => rows.mock.calls.map((c) => String(c[0]));
  const onTable = (t: string) => sqls().filter((s) => new RegExp(`FROM ${t}\\b`).test(s));

  beforeEach(() => {
    columns.perm_cases = WITH_EXTRAS;
    columns.perm_cases_history = WITH_EXTRAS;
  });

  it("reads both tables under an equality lead, pinning only the current one", async () => {
    await readPermPublished({ lead: state, narrow: {}, limit: 100 });
    const cur = onTable("perm_cases");
    const hist = onTable("perm_cases_history");
    expect(cur).toHaveLength(1);
    expect(hist).toHaveLength(1);
    expect(cur[0]).toMatch(/FROM perm_cases INDEXED BY idx_pc_state_dec WHERE state = \?/);
    // Unpinned: its indexes may be dropped for the write budget, and INDEXED
    // BY a missing index fails the statement.
    expect(hist[0]).not.toMatch(/INDEXED BY/);
    expect(hist[0]).toMatch(/FROM perm_cases_history WHERE state = \? ORDER BY decision_date DESC LIMIT \?/);
  });

  it("merges newest-decided first, cuts to the limit, and keeps a case once, from the current table", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (/FROM perm_cases_history/.test(sql)) {
        // The duplicate sits INSIDE the limit, so a merge that forgot to
        // dedupe would print it twice rather than lose it off the end.
        return [dbRow("G-DUP", "2023-09-01"), dbRow("A-1", "2023-05-01"), dbRow("A-2", "2022-01-01")];
      }
      return [dbRow("G-1", "2025-02-01"), dbRow("G-DUP", "2024-03-01", { status: "denied" })];
    });
    const out = await readPermPublished({ lead: state, narrow: {}, limit: 5 });
    expect(out.rows.map((r) => r.caseNumber)).toEqual(["G-1", "G-DUP", "A-1", "A-2"]);
    expect(out.rows.find((r) => r.caseNumber === "G-DUP")?.status).toBe("denied");
    expect(out.rows.find((r) => r.caseNumber === "A-1")?.table).toBe("perm_cases_history");
  });

  it.each([
    [{ fiscalYear: "2019" }, false, true],
    [{ fiscalYear: "2025" }, true, false],
    [{ decidedTo: "2023-05" }, false, true],
    [{ decidedFrom: "2024-01" }, true, false],
    [{ decidedFrom: "2023-06", decidedTo: "2023-12" }, true, true],
  ])("reads only the table a date filter can reach (%o)", async (narrow, current, history) => {
    await readPermPublished({ lead: state, narrow, limit: 100 });
    expect(onTable("perm_cases").length > 0).toBe(current);
    expect(onTable("perm_cases_history").length > 0).toBe(history);
  });

  it("skips the history entirely when the table is not there yet", async () => {
    delete columns.perm_cases_history;
    await readPermPublished({ lead: state, narrow: {}, limit: 100 });
    expect(onTable("perm_cases_history")).toHaveLength(0);
    expect(onTable("perm_cases")).toHaveLength(1);
  });

  it("walks from the oldest decision when asked, on both tables and both passes", async () => {
    await readPermPublished({ lead: state, narrow: { decidedOrder: "asc" }, limit: 100 });
    for (const s of sqls()) expect(s).toMatch(/ORDER BY decision_date ASC LIMIT/);
    rows.mockClear();
    await readPermPublished({ lead: employer, narrow: { decidedOrder: "asc" }, limit: 100 });
    const first = sqls().filter((s) => s.startsWith("SELECT rowid"));
    expect(first).toHaveLength(2);
    for (const s of first) expect(s).toMatch(/ORDER BY decision_date ASC LIMIT \?/);
    // The history's first pass is not pinned either.
    expect(first.find((s) => s.includes("perm_cases_history"))).not.toMatch(/INDEXED BY/);
  });

  it("filters industry by prefix, city and the worker's fields case-insensitively", async () => {
    await readPermPublished({
      lead: state,
      narrow: {
        naics: "5415", city: " san  jose ", citizenship: "india", birthCountry: "India",
        visaClass: "h-1b", education: "master's", jobEducation: "bachelor's",
      },
      limit: 100,
    });
    const [sql, args] = rows.mock.calls.find((c) => /FROM perm_cases INDEXED/.test(String(c[0])))!;
    expect(String(sql)).toMatch(/substr\(naics, 1, \?\) = \?/);
    expect(String(sql)).toMatch(/upper\(worksite_city\) = \?/);
    expect(String(sql)).toMatch(/citizenship = \? AND birth_country = \? AND upper\(visa_class\) = \?/);
    expect(String(sql)).toMatch(/upper\(education\) = \? AND upper\(job_education\) = \?/);
    expect(args).toEqual(
      expect.arrayContaining([4, "5415", "SAN JOSE", "INDIA", "H-1B", "MASTER'S", "BACHELOR'S"]),
    );
  });

  it("reads a sector range as each of its 2-digit codes", async () => {
    await readPermPublished({ lead: state, narrow: { naics: "31-33" }, limit: 100 });
    const [sql, args] = rows.mock.calls.find((c) => /FROM perm_cases INDEXED/.test(String(c[0])))!;
    expect(String(sql)).toMatch(/substr\(naics, 1, 2\) IN \(\?, \?, \?\)/);
    expect(args).toEqual(expect.arrayContaining(["31", "32", "33"]));
  });

  it("puts the new filters in the second pass of an employer read, over the window", async () => {
    await readPermPublished({ lead: employer, narrow: { citizenship: "CHINA" }, limit: 100 });
    const second = rows.mock.calls.find((c) => /FROM perm_cases NOT INDEXED/.test(String(c[0])))!;
    expect(String(second[0])).toMatch(/citizenship = \?/);
    expect(second[1]).toContain("CHINA");
  });

  it("does not read a table that lacks a filter's column, and says nothing matched there", async () => {
    columns.perm_cases = new Set(BASE); // before the loader adds the worker columns
    await readPermPublished({ lead: state, narrow: { citizenship: "INDIA" }, limit: 100 });
    expect(onTable("perm_cases")).toHaveLength(0);
    expect(onTable("perm_cases_history")).toHaveLength(1);
  });

  it("selects a missing extra column as NULL rather than naming it", async () => {
    columns.perm_cases = new Set([...BASE, "naics"]);
    await readPermPublished({ lead: state, narrow: {}, limit: 100 });
    const cur = onTable("perm_cases")[0]!;
    expect(cur).toMatch(/, naics, NULL AS worksite_city, NULL AS citizenship/);
  });

  it("maps the extra columns onto the row", async () => {
    rows.mockImplementation(async (sql: string) =>
      /FROM perm_cases_history/.test(sql)
        ? [dbRow("A-9", "2019-06-01", { citizenship: "INDIA", visa_class: "H-1B", naics: "541511", worksite_city: "Austin" })]
        : [],
    );
    const out = await readPermPublished({ lead: state, narrow: {}, limit: 100 });
    expect(out.rows[0]?.extras).toMatchObject({
      citizenship: "INDIA", visaClass: "H-1B", naics: "541511", worksiteCity: "Austin", education: null,
    });
  });
});

describe("lookupUnifiedCase and the history", () => {
  const WITH = new Set(["case_number", "status", "decision_date"]);
  it("falls back to perm_cases_history when the current table has no row", async () => {
    columns.perm_cases_history = WITH;
    one.mockImplementation(async (sql: string) =>
      /FROM perm_cases_history/.test(sql)
        ? { case_number: "A-20001-11111", status: "certified", decision_date: "2021-03-01" }
        : null,
    );
    const out = await lookupUnifiedCase("A-20001-11111");
    expect(out.permPublished?.caseNumber).toBe("A-20001-11111");
    expect(out.permPublished?.table).toBe("perm_cases_history");
  });

  it("never reads the history when the current table answers", async () => {
    columns.perm_cases_history = WITH;
    one.mockImplementation(async (sql: string) =>
      /FROM perm_cases WHERE/.test(sql) ? { case_number: "G-1", status: "denied" } : null,
    );
    await lookupUnifiedCase("G-100-26125-868956");
    expect(one.mock.calls.some((c) => /perm_cases_history/.test(String(c[0])))).toBe(false);
  });
});

describe("getPermHistoryYears", () => {
  const doc = (files: Record<string, unknown>) => [{ json: JSON.stringify({ files }) }];

  it("sums the history load's case rows by fiscal year, newest first, from one point read", async () => {
    rows.mockResolvedValue(
      doc({
        "PERM_FY2015.xlsx": { fy: 2015, caseRows: 0 },
        "PERM_FY2019.xlsx": { fy: 2019, caseRows: 90_000 },
        "PERM_FY2016.xlsx": { fy: 2016, caseRows: 120_000 },
        "PERM_FY2019_v2.xlsx": { fy: 2019, caseRows: 10 },
      }),
    );
    expect(await getPermHistoryYears()).toEqual([
      { fiscalYear: "2019", total: 90_010 },
      { fiscalYear: "2016", total: 120_000 },
    ]);
    expect(rows).toHaveBeenCalledTimes(1);
    expect(String(rows.mock.calls[0]?.[0])).toMatch(/FROM perm_docs WHERE key = 'perm_history'/);
  });

  it("holds no year the current table owns, and reads a missing or broken doc as nothing loaded", async () => {
    rows.mockResolvedValue(doc({ "PERM_FY2024.xlsx": { fy: 2024, caseRows: 5 } }));
    expect(await getPermHistoryYears()).toEqual([]);
    rows.mockResolvedValue([{ json: "{not json" }]);
    expect(await getPermHistoryYears()).toEqual([]);
    rows.mockRejectedValue(new Error("down"));
    expect(await getPermHistoryYears()).toEqual([]);
  });
});

describe("getCaseFieldOptions", () => {
  it("takes every list from the precomputed doc when it is there, and reads nothing else", async () => {
    rows.mockImplementation(async (sql: string) =>
      /case_field_options/.test(sql)
        ? [{ json: JSON.stringify({
            citizenship: [{ value: "INDIA", n: 5 }, { value: 7, n: 1 }, { value: "CHINA", n: "x" }],
            birthCountry: [{ value: "INDIA", n: 4 }],
            visaClass: [{ value: "H-1B", n: 3 }],
            education: [{ value: "Master's", n: 2 }],
            jobEducation: [{ value: "Bachelor's", n: 1 }],
          }) }]
        : [],
    );
    const out = await getCaseFieldOptions();
    // A malformed entry is dropped, never rendered as a blank option.
    expect(out.citizenship).toEqual([{ value: "INDIA", n: 5 }, { value: "CHINA", n: null }]);
    expect(out.education).toEqual([{ value: "Master's", n: 2 }]);
    expect(rows.mock.calls.some((c) => /perm_country_years/.test(String(c[0])))).toBe(false);
  });

  it("falls back to the national country table, bounded and grouped once, when the doc is missing", async () => {
    rows.mockImplementation(async (sql: string) =>
      /perm_country_years/.test(sql) ? [{ country: "INDIA", n: "120" }, { country: "CHINA", n: 40 }] : [],
    );
    const out = await getCaseFieldOptions();
    expect(out.citizenship).toEqual([{ value: "INDIA", n: 120 }, { value: "CHINA", n: 40 }]);
    // Birth country takes the same country names without a count it does not have.
    expect(out.birthCountry).toEqual([{ value: "INDIA", n: null }, { value: "CHINA", n: null }]);
    expect(out.visaClass).toEqual([]);
    const sql = String(rows.mock.calls.find((c) => /perm_country_years/.test(String(c[0])))?.[0]);
    expect(sql).toMatch(/fy >= 2016/);
    expect(sql).toMatch(/LIMIT \d+/);
  });

  it("answers empty lists, never throws, when neither source can be read", async () => {
    rows.mockRejectedValue(new Error("down"));
    expect(await getCaseFieldOptions()).toEqual({
      citizenship: [], birthCountry: [], visaClass: [], education: [], jobEducation: [],
    });
  });
});

describe("the prevailing wage source", () => {
  it("matches each source the way DOL's LCA file spells it", () => {
    // Measured on production, every fiscal year: "Survey", "CBA", "SCA", "DBA",
    // and an OES year where the wage came from OES.
    expect(wageSourceCondition("oes")).toEqual({ cond: "pw_oes_year IS NOT NULL", params: [] });
    expect(wageSourceCondition("survey")).toEqual({ cond: "pw_other_source = ?", params: ["Survey"] });
    expect(wageSourceCondition("cba")).toEqual({ cond: "pw_other_source = ?", params: ["CBA"] });
    expect(wageSourceCondition("contract")).toEqual({ cond: "pw_other_source IN (?, ?)", params: ["SCA", "DBA"] });
  });

  it("narrows an employer's published LCAs on the second pass", async () => {
    await readFlagPublished("lca", employer, { wageSource: "survey" }, 100);
    expect(secondPass().sql).toContain("pw_other_source = ?");
    expect(secondPass().args).toContain("Survey");
  });

  it("narrows an equality lead in its one statement", async () => {
    rows.mockResolvedValueOnce([]);
    await readFlagPublished("lca", { kind: "state", value: "CA" }, { wageSource: "contract" }, 100);
    expect(firstPass().sql).toContain("pw_other_source IN (?, ?)");
    expect(firstPass().args).toEqual(expect.arrayContaining(["SCA", "DBA"]));
  });

  it("reads nothing from a file that doesn't carry the field", async () => {
    for (const program of ["pwd", "seasonal"] as const) {
      expect(await readFlagPublished(program, employer, { wageSource: "oes" }, 100)).toEqual({
        rows: [],
        windowed: false,
      });
    }
    expect(rows).not.toHaveBeenCalled();
  });
});
