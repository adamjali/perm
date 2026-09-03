import { beforeEach, describe, expect, it, vi } from "vitest";
import { pythonFinalSet } from "./pythonFinalSet";

/**
 * The PWD read layer: the SQL it issues, the number shape it accepts, and
 * the one invariant shared with the Python ingest (the final-status set).
 */

vi.mock("server-only", () => ({}));


const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const exec = vi.fn<(sql: string, args?: unknown[]) => Promise<number>>();
vi.mock("../client", () => ({ rows, one, exec }));

const {
  PWD_FINAL_STATUSES,
  PWD_MAX_ITEMS,
  isPwdCaseNumber,
  listPwdCases,
  lookupPwdCase,
  normalisePwdCaseNumber,
  parsePwdSummaryDoc,
  searchPwdCases,
} = await import("../pwdCases");

beforeEach(() => {
  rows.mockReset();
  one.mockReset();
  exec.mockReset();
  rows.mockResolvedValue([]);
});

describe("the PWD number shape", () => {
  it("accepts the four-segment P- form, tidied, and nothing else", () => {
    expect(normalisePwdCaseNumber(" p-100-26240-200135 ")).toBe("P-100-26240-200135");
    expect(isPwdCaseNumber("P-100-26240-200135")).toBe(true);
    expect(normalisePwdCaseNumber("G-100-26240-200246")).toBeNull();
    expect(normalisePwdCaseNumber("A-23043-00641")).toBeNull();
    expect(normalisePwdCaseNumber("P-100-26240")).toBeNull();
  });
});

describe("PWD_FINAL_STATUSES mirrors the Python ingest", () => {
  it("is byte-for-byte the same set as PWD_FINAL in ingest_pwd_status_direct.py", () => {
    expect(pythonFinalSet("pwd")).toEqual(new Set(PWD_FINAL_STATUSES));
  });
});

describe("searchPwdCases", () => {
  it("is an indexed employer prefix range, PERM-only by default, narrowed like the PERM search", async () => {
    await searchPwdCases({ text: "deloitte", title: "consultant", from: "2026-08", to: "2026-08" });
    const [sql, args] = rows.mock.calls[0]!;
    // The named index is asserted with the predicate: without it the month
    // narrowing moved the plan onto `pwd_case_status_filed`, which reads every
    // wage request filed in that window for every employer in the country.
    expect(sql).toMatch(
      /FROM pwd_case_status INDEXED BY pwd_case_status_emp WHERE employer_slug >= \? AND employer_slug < \? AND job_title LIKE \? ESCAPE '\\' AND filing_date >= \? AND filing_date < \? AND visa_type = \?/,
    );
    expect(sql).toMatch(/ORDER BY filing_date DESC, case_number DESC LIMIT \?/);
    expect(args).toEqual(["deloitte", "deloittf", "%consultant%", "2026-08-01", "2026-09-01", "PERM", 200]);
  });

  it("can be asked for every program, and then has no visa clause", async () => {
    await searchPwdCases({ text: "deloitte", visa: "all" });
    expect(rows.mock.calls[0]![0]).not.toMatch(/visa_type = \?/);
  });
});

describe("listPwdCases", () => {
  it("pending is is_final = 0, a month is half-open, PERM-only, totally ordered, take + 1", async () => {
    await listPwdCases({ kind: "pending", month: "2025-12", numItems: 10, cursor: "20" });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/WHERE is_final = \? AND filing_date >= \? AND filing_date < \? AND visa_type = \?/);
    expect(sql).toMatch(/ORDER BY filing_date DESC, case_number DESC LIMIT \? OFFSET \?/);
    expect(args).toEqual([0, "2025-12-01", "2026-01-01", "PERM", 11, 20]);
  });

  it("clamps the page size", async () => {
    await listPwdCases({ kind: "all", numItems: 99_999 });
    expect(rows.mock.calls[0]![1]).toEqual(["PERM", PWD_MAX_ITEMS + 1, 0]);
  });

  it("maps a driver row, with is_final as a string", async () => {
    rows.mockResolvedValue([
      {
        case_number: "P-100-26240-200135",
        filing_date: "2026-08-28",
        current_status: "IN PROCESS",
        is_final: "0",
        employer_name: "Buckman Laboratories, Inc.",
        employer_slug: "buckman-laboratories-inc",
        job_title: "Sr. Financial Analyst- Pricing & FP&A",
        visa_type: "PERM",
        submitted_date: "2026-08-28T02:52:24.78Z",
        first_seen_at: "2026-09-02T19:00:00Z",
        last_checked_at: "2026-09-02T19:00:00Z",
      },
    ]);
    const page = await listPwdCases({ kind: "all" });
    expect(page.rows[0]?.isFinal).toBe(false);
    expect(page.rows[0]?.visaType).toBe("PERM");
    expect(page.isDone).toBe(true);
  });
});

describe("lookupPwdCase", () => {
  it("returns the table row without asking DOL when it exists", async () => {
    one.mockResolvedValueOnce({
      case_number: "P-100-26240-200135",
      filing_date: "2026-08-28",
      current_status: "IN PROCESS",
      is_final: 0,
      employer_name: "X",
      employer_slug: "x",
      job_title: null,
      visa_type: "PERM",
      submitted_date: null,
      first_seen_at: null,
      last_checked_at: null,
    });
    const r = await lookupPwdCase("p-100-26240-200135");
    expect(r?.status).toBe("IN PROCESS");
    expect(exec).not.toHaveBeenCalled();
  });

  it("refuses a PERM number outright", async () => {
    expect(await lookupPwdCase("G-100-26240-200246")).toBeNull();
    expect(one).not.toHaveBeenCalled();
  });
});

describe("parsePwdSummaryDoc", () => {
  const good = JSON.stringify({
    total: 507,
    pending: 498,
    decided: 9,
    byStatus: { "IN PROCESS": 498, "DETERMINATION ISSUED": 9 },
    byVisaType: { PERM: 500, "H-1B": 7 },
    byMonth: [{ month: "2026-08", total: 507, pending: 498, decided: 9 }],
    asOf: "2026-09-02T19:30:00Z",
  });
  const now = Date.UTC(2026, 8, 2, 20);
  it("reads a fresh doc and treats a stale one as absent", () => {
    expect(parsePwdSummaryDoc(good, now - 1000, now)?.pending).toBe(498);
    expect(parsePwdSummaryDoc(good, now - 9 * 86_400_000, now)).toBeNull();
    expect(parsePwdSummaryDoc("{", now, now)).toBeNull();
  });
});

const { lookupPwdDetermination, searchPwdDeterminations, getPwdDisclosureSummary } = await import("../pwdCases");
const { parseDisclosureSummaryDoc, slugRange } = await import("../flagCases");

describe("the decided half: DOL's quarterly file", () => {

  it("searches pwd_cases by the same slug range as the live half, PERM-only, on received_date", async () => {
    await searchPwdDeterminations({ text: "Google", from: "2026-01", to: "2026-03", title: "engineer" });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/FROM pwd_cases INDEXED BY pwd_cases_emp WHERE employer_slug >= \? AND employer_slug < \?/);
    expect(sql).toMatch(/job_title LIKE \? ESCAPE/);
    expect(sql).toMatch(/received_date >= \? AND received_date < \?/);
    expect(sql).toMatch(/visa_class = \?/);
    expect(sql).toMatch(/ORDER BY received_date DESC, case_number DESC LIMIT \?/);
    expect(args).toEqual(["google", "googlf", "%engineer%", "2026-01-01", "2026-04-01", "PERM", 200]);
    // the live half's range for the same text is byte-identical
    expect(slugRange("Google")).toEqual({ lo: "google", hi: "googlf" });
  });

  it("asks nothing for a needle that slugs to under two characters", async () => {
    expect(await searchPwdDeterminations({ text: "a" })).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });

  it("looks a determination up by number and maps the file's row, numbers as strings included", async () => {
    one.mockResolvedValueOnce({
      case_number: "P-100-26092-751498",
      case_status: "DETERMINATION ISSUED",
      received_date: "2026-04-02",
      decision_date: "2026-06-30",
      employer_name: "Google LLC",
      employer_slug: "google-llc",
      job_title: "Strategic Partnerships Development Manager",
      soc_code: "11-2021",
      soc_title: "Marketing Managers",
      wage: "241925.0",
      wage_unit: "YEAR",
      worksite_state: "NY",
      visa_class: "PERM",
      fiscal_year: "2026",
    });
    const d = await lookupPwdDetermination(" p-100-26092-751498 ");
    expect(one.mock.calls[0]![0]).toMatch(/FROM pwd_cases WHERE case_number = \?/);
    expect(one.mock.calls[0]![1]).toEqual(["P-100-26092-751498"]);
    expect(d).toMatchObject({ wage: 241925, fiscalYear: 2026, socCode: "11-2021", status: "DETERMINATION ISSUED" });
    expect(exec).not.toHaveBeenCalled(); // the file is never "discovered" from DOL
  });

  it("refuses a G- number without touching the table", async () => {
    expect(await lookupPwdDetermination("G-100-26240-200246")).toBeNull();
    expect(one).not.toHaveBeenCalled();
  });

  it("reads the ingest's summary doc with no age cutoff, and rejects a malformed one", async () => {
    const good = parseDisclosureSummaryDoc(
      JSON.stringify({ rows: 147244, earliestReceived: "2025-07-01", latestDecision: "2026-06-30", files: { a: 147244 } }),
      1,
    );
    expect(good).toMatchObject({ rows: 147244, latestDecision: "2026-06-30" });
    expect(parseDisclosureSummaryDoc("{\"rows\":\"many\"}", 1)).toBeNull();
    expect(parseDisclosureSummaryDoc("not json", 1)).toBeNull();
    // a date that is not YYYY-MM-DD is dropped, not passed through
    expect(parseDisclosureSummaryDoc(JSON.stringify({ rows: 1, latestDecision: "June 2026" }), 1)?.latestDecision).toBeNull();
    one.mockResolvedValueOnce({ json: JSON.stringify({ rows: 5, files: {} }), computed_at: 7 });
    expect(await getPwdDisclosureSummary()).toMatchObject({ rows: 5, computedAt: 7 });
    expect(one.mock.calls[0]![1]).toEqual(["flag_disclosure_summary_pw"]);
  });
});
