import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What DOL decided in a range, read across the published tables.
 *
 * The client is faked at the SQL level so each assertion is about the query
 * the module actually issues: which tables it asks, which filters reach the
 * WHERE, and what it does when a table lacks a column.
 */

const SCHEMA: Record<string, string[]> = {
  perm_cases: [
    "case_number", "status", "decision_date", "received_date", "employer_name", "employer_slug",
    "job_title", "soc_code", "soc_title", "state", "wage", "attorney_name", "attorney_slug",
    "naics", "worksite_city", "citizenship", "visa_class", "education",
  ],
  perm_cases_history: [
    "case_number", "status", "decision_date", "received_date", "employer_name", "employer_slug",
    "job_title", "soc_code", "soc_title", "state", "wage", "attorney_name", "attorney_slug",
    "naics", "worksite_city",
  ],
  pwd_cases: [
    "case_number", "case_status", "decision_date", "received_date", "employer_name", "employer_slug",
    "job_title", "soc_code", "soc_title", "worksite_state", "wage", "wage_unit", "visa_class",
    "attorney_name", "attorney_slug",
  ],
  lca_cases: [
    "case_number", "case_status", "decision_date", "received_date", "employer_name", "employer_slug",
    "job_title", "soc_code", "soc_title", "worksite_state", "wage", "wage_unit", "visa_class",
    "attorney_name", "attorney_slug",
  ],
};

const DATA: Record<string, Record<string, unknown>[]> = {};
const asked: string[] = [];

vi.mock("./client", () => ({
  rows: async (sql: string) => {
    const pragma = /PRAGMA table_info\((\w+)\)/.exec(sql);
    if (pragma) return (SCHEMA[pragma[1]!] ?? []).map((name) => ({ name }));
    if (/FROM perm_docs/.test(sql)) {
      return [{ json: JSON.stringify({ files: { a: { fy: 2016, caseRows: 10 }, b: { fy: 2010, caseRows: 0 } } }) }];
    }
    const table = /FROM (\w+)/.exec(sql)?.[1] ?? "";
    asked.push(sql.replace(/\s+/g, " "));
    // A select naming a column the table lacks would fail in SQLite.
    const named = [...sql.matchAll(/\b(citizenship|visa_class|education)\b(?! AS)/g)].map((m) => m[1]!);
    for (const c of named) {
      if (!new RegExp(`NULL AS ${c}`).test(sql) && !(SCHEMA[table] ?? []).includes(c)) {
        throw new Error(`no such column: ${c}`);
      }
    }
    if (/COUNT\(\*\)/.test(sql)) return [{ n: (DATA[table] ?? []).length }];
    return DATA[table] ?? [];
  },
}));

vi.mock("./flagCases", () => ({
  slugRange: (s: string) => (s.length >= 2 ? { lo: s, hi: `${s}~` } : null),
}));

import { getCoverageWindows, getDecidedFeed, resetColumnCache } from "./decidedDays";

function row(n: string, date: string, extra: Record<string, unknown> = {}) {
  return { case_number: n, status: "certified", case_status: "Certified", decision_date: date, ...extra };
}

beforeEach(() => {
  asked.length = 0;
  resetColumnCache();
  for (const k of Object.keys(DATA)) delete DATA[k];
});

describe("getDecidedFeed across PERM's two tables", () => {
  it("reads perm_cases_history for a range before FY2024 and merges it newest first", async () => {
    DATA.perm_cases = [row("G-100-1", "2023-10-02")];
    DATA.perm_cases_history = [row("A-1", "2023-09-29"), row("A-2", "2023-09-30")];
    const f = await getDecidedFeed({ range: { from: "2023-09-28", to: "2023-10-03" }, programs: ["perm"] });
    expect(f.cases.map((c) => c.caseNumber)).toEqual(["G-100-1", "A-2", "A-1"]);
    expect(asked.some((q) => q.includes("FROM perm_cases_history"))).toBe(true);
  });

  it("never asks the history table for a range after FY2023", async () => {
    await getDecidedFeed({ range: { from: "2025-03-01", to: "2025-03-01" }, programs: ["perm"] });
    expect(asked.some((q) => q.includes("perm_cases_history"))).toBe(false);
  });

  it("caps PERM across both tables, not per table", async () => {
    DATA.perm_cases = [row("G-1", "2023-10-02"), row("G-2", "2023-10-01")];
    DATA.perm_cases_history = [row("A-1", "2023-09-30"), row("A-2", "2023-09-29")];
    const f = await getDecidedFeed({ range: { from: "2023-09-01", to: "2023-10-05" }, programs: ["perm"], cap: 3 });
    expect(f.cases.map((c) => c.caseNumber)).toEqual(["G-1", "G-2", "A-1"]);
    expect(f.capped).toBe(true);
  });
});

describe("filters", () => {
  it("applies a law-firm filter to wage requests and LCAs instead of dropping it", async () => {
    await getDecidedFeed({ range: { from: "2025-03-01", to: "2025-03-01" }, narrow: { attorney: "fragomen" } });
    const pwd = asked.find((q) => q.includes("FROM pwd_cases") && !q.includes("COUNT"));
    expect(pwd).toMatch(/attorney_slug = \?/);
  });

  it("answers nothing for a program that can't carry a filter, rather than ignoring it", async () => {
    DATA.pwd_cases = [row("P-1", "2025-03-01")];
    DATA.perm_cases = [row("G-1", "2025-03-01", { citizenship: "INDIA" })];
    const f = await getDecidedFeed({ range: { from: "2025-03-01", to: "2025-03-01" }, narrow: { citizenship: "INDIA" } });
    expect(f.cases.map((c) => c.program)).toEqual(["perm"]);
    expect(asked.some((q) => q.includes("FROM pwd_cases") && !q.includes("COUNT"))).toBe(false);
  });

  it("selects a column a table hasn't gained yet as NULL instead of failing the table", async () => {
    DATA.perm_cases_history = [row("A-1", "2020-05-05")];
    const f = await getDecidedFeed({ range: { from: "2020-05-05", to: "2020-05-05" }, programs: ["perm"] });
    expect(f.cases.map((c) => c.caseNumber)).toEqual(["A-1"]);
    expect(f.cases[0]!.citizenship).toBeNull();
  });

  it("treats city, industry, citizenship, visa and education as unindexed, held to 92 days", async () => {
    const f = await getDecidedFeed({ range: { from: "2020-01-01", to: "2020-12-31" }, narrow: { city: "Seattle" } });
    expect(f.refused).toMatch(/92 days/);
  });

  it("matches an industry by its leading digits", async () => {
    await getDecidedFeed({ range: { from: "2025-03-01", to: "2025-03-01" }, programs: ["perm"], narrow: { naics: "5415" } });
    const q = asked.find((s) => s.includes("FROM perm_cases") && !s.includes("COUNT"));
    expect(q).toMatch(/naics LIKE \?/);
  });
});

describe("getCoverageWindows", () => {
  it("starts PERM at the history ingest's first stored year, from its record", async () => {
    DATA.perm_cases = [{ v: "2023-10-01" }];
    const w = await getCoverageWindows();
    expect(w.decidedByProgram?.perm?.from).toBe("2015-10-01");
    expect(w.decided?.from).toBe("2015-10-01");
  });
});
