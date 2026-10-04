import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An employer page's H-2A, H-2B and CW-1 case list: merged from the live and
 * published tables, read over the employer's own spellings.
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));

const { seasonalEmployerCases } = await import("../seasonalEmployers");

const exact = (slug: string) => ({ where: "employer_slug IN (?)", args: [slug] });

// Braces: a beforeEach that returns the mock has it called as a cleanup hook.
beforeEach(() => {
  one.mockReset();
  rows.mockReset();
});

describe("an employer's seasonal cases", () => {
  it("keys both reads on the employer's spellings, and merges a case in both tables into one row with the live status", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM seasonal_case_status")) {
        return [
          { case_number: "H-300-26100-000002", current_status: "IN PROCESS", is_final: 0, filing_date: "2026-04-10", job_title: "Farmworker" },
          { case_number: "H-400-25300-000001", current_status: "FULL CERTIFICATION - EXPIRED", is_final: "1", filing_date: "2025-10-27", job_title: "Crab picker" },
        ];
      }
      return [
        {
          case_number: "H-400-25300-000001", case_status: "Determination Issued - Certification", received_date: "2025-10-27",
          decision_date: "2025-12-01", job_title: "Crab picker", workers: 40, workers_certified: 38,
          wage: 16.08, wage_unit: "HOUR", worksite_city: "Hoopers Island", worksite_state: "MD",
        },
        {
          case_number: "C-500-25200-000003", case_status: "Determination Issued - Certification", received_date: "2025-07-19",
          decision_date: "2025-09-01", job_title: "Tour guide", workers: 2, workers_certified: 2,
          wage: 9.5, wage_unit: "HOUR", worksite_city: "Saipan", worksite_state: "MP",
        },
      ];
    });
    const { cases, more } = await seasonalEmployerCases(
      { where: "employer_slug IN (?, ?)", args: ["shore-crabs", "shore-crabs-llc"] },
      50,
    );
    for (const call of rows.mock.calls) {
      expect(String(call[0])).toContain("WHERE employer_slug IN (?, ?)");
      expect(call[1]).toEqual(["shore-crabs", "shore-crabs-llc", 51]);
    }
    expect(more).toBe(false);
    expect(cases.map((c) => c.caseNumber)).toEqual([
      "H-300-26100-000002", "H-400-25300-000001", "C-500-25200-000003",
    ]);
    const merged = cases[1]!;
    expect(merged.source).toBe("live");
    expect(merged.status).toBe("FULL CERTIFICATION - EXPIRED");
    expect(merged.isFinal).toBe(true);
    // What the file printed survives the merge.
    expect([merged.decided, merged.workersCertified, merged.wage, merged.worksiteCity]).toEqual([
      "2025-12-01", 38, 16.08, "Hoopers Island",
    ]);
    expect(cases[2]!.source).toBe("file");
    expect(cases[0]!.decided).toBeNull();
  });

  it("says there are more when either table holds more than the page lists", async () => {
    rows.mockImplementation(async (sql: string) =>
      sql.includes("FROM seasonal_case_status")
        ? [1, 2, 3].map((i) => ({ case_number: `H-300-26100-00000${i}`, current_status: "IN PROCESS", is_final: 0, filing_date: `2026-04-1${i}` }))
        : [],
    );
    const { cases, more } = await seasonalEmployerCases(exact("big-farm"), 2);
    expect(cases).toHaveLength(2);
    expect(more).toBe(true);
    expect(cases[0]!.caseNumber).toBe("H-300-26100-000003");
  });

  it("lists the live cases when the published table does not exist yet", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM seasonal_cases ")) throw new Error("no such table: seasonal_cases");
      return [{ case_number: "H-300-26100-000001", current_status: "IN PROCESS", is_final: 0, filing_date: "2026-04-10" }];
    });
    const { cases } = await seasonalEmployerCases(exact("new-farm"), 50);
    expect(cases.map((c) => c.caseNumber)).toEqual(["H-300-26100-000001"]);
  });
});
