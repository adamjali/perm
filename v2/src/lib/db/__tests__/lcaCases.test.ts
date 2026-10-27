import { beforeEach, describe, expect, it, vi } from "vitest";
import { pythonFinalSet } from "./pythonFinalSet";

/** The LCA program: same factory, different prefix, no default visa filter. */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const exec = vi.fn<(sql: string, args?: unknown[]) => Promise<number>>();
vi.mock("../client", () => ({ rows, one, exec }));

const { LCA_FINAL_STATUSES, listLcaCases, normaliseLcaCaseNumber, searchLcaCases, searchLcaDisclosed } = await import("../lcaCases");
const { BROAD_NAME_ROWS } = await import("../flagCases");

beforeEach(() => {
  rows.mockReset();
  rows.mockResolvedValue([]);
  one.mockReset();
});

describe("LCA numbers and finality", () => {
  it("accepts I- numbers of any visa-class segment and nothing else", () => {
    expect(normaliseLcaCaseNumber(" i-200-26239-199948 ")).toBe("I-200-26239-199948");
    expect(normaliseLcaCaseNumber("I-203-26239-199943")).toBe("I-203-26239-199943");
    expect(normaliseLcaCaseNumber("P-100-26240-200135")).toBeNull();
    expect(normaliseLcaCaseNumber("G-100-26240-200246")).toBeNull();
  });

  it("mirrors the Python ingest's final set byte for byte", () => {
    expect(pythonFinalSet("lca")).toEqual(new Set(LCA_FINAL_STATUSES));
  });
});

describe("LCA reads have no program filter, because every row is an LCA", () => {
  it("search", async () => {
    await searchLcaCases({ text: "versaflair" });
    const [sql, args] = rows.mock.calls[0]!;
    // INDEXED BY is asserted, not incidental: without it a status or month
    // narrowing moved the plan onto `lca_case_status_stage` and read every
    // LCA at that status for every employer in the country.
    expect(sql).toMatch(
      /FROM lca_case_status INDEXED BY lca_case_status_emp WHERE employer_slug >= \? AND employer_slug < \? ORDER BY/,
    );
    expect(args).toEqual(["versaflair", "versaflais", 200]);
  });

  it("list", async () => {
    await listLcaCases({ kind: "pending", numItems: 5 });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/FROM lca_case_status WHERE is_final = \? ORDER BY filing_date DESC, case_number DESC LIMIT \? OFFSET \?/);
    expect(args).toEqual([0, 6, 0]);
  });
});

describe("the published LCA file: a broad name is read newest-first (Sentry 59)", () => {
  it("counts the name's filings on the name index, at most one past the line", async () => {
    one.mockResolvedValueOnce({ n: 12 });
    await searchLcaDisclosed({ text: "Am" });
    const [sql, args] = one.mock.calls[0]!;
    expect(sql).toContain(`FROM lca_cases INDEXED BY lca_cases_emp WHERE employer_slug >= ? AND employer_slug < ? LIMIT ${BROAD_NAME_ROWS + 1}`);
    expect(args).toEqual(["am", "an"]);
  });

  it("reads a small name on the name index, sorted", async () => {
    one.mockResolvedValueOnce({ n: BROAD_NAME_ROWS });
    await searchLcaDisclosed({ text: "tuopu" });
    expect(rows.mock.calls[0]![0]).toContain("FROM lca_cases INDEXED BY lca_cases_emp WHERE");
  });

  it("reads a broad name newest-first and stops at the limit", async () => {
    // libSQL can hand the count back as a string.
    one.mockResolvedValueOnce({ n: String(BROAD_NAME_ROWS + 1) });
    await searchLcaDisclosed({ text: "Am" });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/FROM lca_cases INDEXED BY lca_cases_recv WHERE employer_slug >= \? AND employer_slug < \? ORDER BY received_date DESC, case_number DESC LIMIT \?/);
    expect(args).toEqual(["am", "an", 200]);
  });

  it("falls back to the name index when the count can't be read", async () => {
    one.mockResolvedValueOnce(null);
    await searchLcaDisclosed({ text: "Am" });
    expect(rows.mock.calls[0]![0]).toContain("INDEXED BY lca_cases_emp");
  });
});
