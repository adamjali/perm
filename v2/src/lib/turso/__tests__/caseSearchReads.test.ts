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

const {
  OUTCOME_STATUSES,
  SLICE_CAP,
  flagLeadIndex,
  lookupUnifiedCase,
  permLeadIndex,
  programForCaseNumber,
  readFlagLive,
  readFlagPublished,
  readPermLive,
  readPermPublished,
  socGroup,
} = await import("../caseSearchReads");

/**
 * An employer lead issues TWO statements: a covering first pass that picks the
 * newest rowids, then a rowid lookup that fetches those rows. The default mock
 * returns two rowids so the second statement is always reached; a first pass
 * that returns nothing short-circuits by design, and a test that never got
 * past it would silently assert on the wrong statement.
 */
beforeEach(() => {
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

  it("filters on worksite_state, which is what this file calls the column", async () => {
    await readFlagPublished("lca", employer, { state: "TX", socCode: "15-1252.00" }, 100);
    expect(secondPass().sql).toContain("worksite_state = ?");
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

  it("strips the narrowing this index cannot carry, even if the caller sends it", async () => {
    // The route drops these and the UI greys them out. This makes it
    // structural, so no hand-crafted URL can reach a slice walk.
    rows.mockResolvedValueOnce([]);
    await readFlagPublished(
      "pwd",
      state,
      { title: "engineer", from: "2024-01", to: "2024-12", wageMin: 100000, fiscalYear: "2025" },
      100,
    );
    // The WHERE clause only: every one of these column names is in the SELECT
    // list too, so a check over the whole statement fails on a correct query.
    const where = firstPass().sql.split(" WHERE ")[1] ?? "";
    expect(where).not.toContain("job_title LIKE");
    expect(where).not.toContain("received_date");
    expect(where).not.toContain("wage >=");
    expect(where).not.toContain("fiscal_year");
    expect(firstPass().args).toEqual(["CA", "PERM", 100]);
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

  it("degrades one half at a time rather than failing the lookup", async () => {
    one.mockRejectedValueOnce(new Error("turso query deadline"));
    const out = await lookupUnifiedCase("G-100-26125-868956");
    expect(out.program).toBe("perm");
    expect(out.permPublished).toBeNull();
  });
});
