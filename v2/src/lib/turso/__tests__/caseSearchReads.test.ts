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
  lookupUnifiedCase,
  permLeadIndex,
  programForCaseNumber,
  readFlagLive,
  readFlagPublished,
  readPermLive,
  readPermPublished,
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
    expect(permLeadIndex(occupation, false)).toBe("idx_pc_soc_dec");
    expect(permLeadIndex(occupation, true)).toBe("idx_pc_soc_st_dec");
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
      "soc_code = ?",
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

  it("strips the narrowing an equality lead cannot carry, even if the caller sends it", async () => {
    // The route drops these and the UI greys them out. This makes it
    // structural: a state search plus a wage bound is the 67,742-row,
    // 44.7-second walk, and it must not be reachable from any caller.
    await readPermPublished({
      lead: state,
      narrow: { title: "engineer", from: "2024-01", to: "2024-12", wageMin: 100000, socCode: "x" },
      limit: 100,
    });
    // Read the WHERE clause, not the whole statement: every one of these
    // column names also appears in the SELECT list, so a naive `not.toContain`
    // over the string fails on a correct query and would be "fixed" by
    // weakening it.
    const where = firstPass().sql.split(" WHERE ")[1] ?? "";
    expect(where).not.toContain("job_title LIKE");
    expect(where).not.toContain("received_date");
    expect(where).not.toContain("wage >=");
    expect(where).not.toContain("soc_code");
    expect(firstPass().args).toEqual(["CA", 100]);
  });

  it("keeps the decided-date range, because the index carries it", async () => {
    await readPermPublished({
      lead: occupation,
      narrow: { decidedFrom: "2025-01", decidedTo: "2025-03" },
      limit: 100,
    });
    expect(firstPass().sql).toMatch(/INDEXED BY idx_pc_soc_dec WHERE soc_code = \?/);
    expect(firstPass().args).toEqual(["15-1252.00", "2025-01-01", "2025-04-01", 100]);
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

describe("readFlagPublished", () => {
  it("names its index, scopes the visa class and orders by the received date", async () => {
    await readFlagPublished("pwd", "amazon", {}, 100);
    expect(firstPass().sql).toMatch(/SELECT rowid FROM pwd_cases INDEXED BY pwd_cases_emp/);
    expect(secondPass().sql).toContain("visa_class = ?");
    expect(secondPass().sql).toMatch(/ORDER BY received_date DESC, case_number DESC LIMIT \?$/);
  });

  it("binds the fiscal year as a NUMBER here, where the column is INTEGER", async () => {
    // The same field name is TEXT on perm_cases. A string bound against an
    // INTEGER column matches nothing in SQLite and raises no error at all.
    await readFlagPublished("lca", "amazon", { fiscalYear: "2025" }, 100);
    expect(secondPass().args).toEqual([11, 22, 2025, 100]);
  });

  it("filters on worksite_state, which is what this file calls the column", async () => {
    await readFlagPublished("lca", "amazon", { state: "TX", socCode: "15-1252" }, 100);
    expect(secondPass().sql).toContain("worksite_state = ?");
    expect(secondPass().sql).toContain("soc_code = ?");
  });

  it('reads nothing for "still open"', async () => {
    expect(await readFlagPublished("pwd", "amazon", { outcome: "open" }, 100)).toEqual({
      rows: [],
      windowed: false,
    });
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
