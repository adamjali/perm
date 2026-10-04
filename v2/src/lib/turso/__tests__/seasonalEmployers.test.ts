import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seasonal-only employer page's reads: the record from the nightly index,
 * the case list merged from the live and published tables, and the figures.
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));

const { seasonalEmployerRecord, seasonalEmployerCases, seasonalEmployerFigures } = await import(
  "../seasonalEmployers"
);

// Braces: a beforeEach that returns the mock has it called as a cleanup hook.
beforeEach(() => {
  one.mockReset();
  rows.mockReset();
});

describe("the seasonal-only employer record", () => {
  it("reads the index row by its exact slug", async () => {
    one.mockResolvedValue({
      slug: "green-acres", name: "Green Acres Farm LLC", cases: "3", h2a: "2", h2b: "1", cw1: "0",
      first_filed: "2025-10-27", last_changed: "2026-04-10",
    });
    const r = await seasonalEmployerRecord("green-acres");
    expect(r).toEqual({
      slug: "green-acres", name: "Green Acres Farm LLC", cases: 3, h2a: 2, h2b: 1, cw1: 0,
      firstFiled: "2025-10-27", lastChanged: "2026-04-10",
    });
    expect(one.mock.calls[0]?.[0]).toContain("WHERE slug = ?");
    expect(one.mock.calls[0]?.[1]).toEqual(["green-acres"]);
  });

  it("is null before the first nightly build (no table), so the slug stays a 404", async () => {
    one.mockRejectedValue(new Error("SQLITE_ERROR: no such table: seasonal_employer_index"));
    await expect(seasonalEmployerRecord("green-acres")).resolves.toBeNull();
  });

  it("throws any other failure, so a real employer never reads as a 404", async () => {
    one.mockRejectedValue(new Error("turso query deadline (20000ms, attempt 2)"));
    await expect(seasonalEmployerRecord("green-acres")).rejects.toThrow(/deadline/);
  });
});

describe("the seasonal-only employer's cases", () => {
  it("keys both reads on the exact slug, and merges a case in both tables into one row with the live status", async () => {
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
    const { cases, more } = await seasonalEmployerCases("shore-crabs", 50);
    for (const call of rows.mock.calls) {
      expect(String(call[0])).toContain("WHERE employer_slug = ?");
      expect(call[1]).toEqual(["shore-crabs", 51]);
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
    const { cases, more } = await seasonalEmployerCases("big-farm", 2);
    expect(cases).toHaveLength(2);
    expect(more).toBe(true);
    expect(cases[0]!.caseNumber).toBe("H-300-26100-000003");
  });

  it("lists the live cases when the published table does not exist yet", async () => {
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM seasonal_cases ")) throw new Error("no such table: seasonal_cases");
      return [{ case_number: "H-300-26100-000001", current_status: "IN PROCESS", is_final: 0, filing_date: "2026-04-10" }];
    });
    const { cases } = await seasonalEmployerCases("new-farm", 50);
    expect(cases.map((c) => c.caseNumber)).toEqual(["H-300-26100-000001"]);
  });
});

describe("the seasonal-only employer's figures", () => {
  it("takes the median over hourly wages only, at the middle offset", async () => {
    one.mockImplementation(async (sql: string) => {
      if (sql.includes("COUNT(*) AS n")) return { n: 9, hourly_n: 7, certified: "210" };
      if (sql.includes("FROM seasonal_case_status")) return { pending: 2 };
      if (sql.includes("ORDER BY wage")) return { wage: "15.81" };
      return null;
    });
    const f = await seasonalEmployerFigures("big-farm");
    expect(f).toEqual({ published: 9, pending: 2, workersCertified: 210, medianHourlyWage: 15.81, hourlyN: 7 });
    const median = one.mock.calls.find((c) => String(c[0]).includes("ORDER BY wage"));
    expect(median?.[0]).toContain("wage_unit IN ('HOUR', 'HOURLY')");
    expect(median?.[1]).toEqual(["big-farm", 5, 200, 3]);
  });

  it("prints no wage when nothing is paid by the hour", async () => {
    one.mockImplementation(async (sql: string) => {
      if (sql.includes("COUNT(*) AS n")) return { n: 1, hourly_n: 0, certified: null };
      if (sql.includes("FROM seasonal_case_status")) return { pending: 0 };
      return null;
    });
    const f = await seasonalEmployerFigures("piece-rate-farm");
    expect(f.medianHourlyWage).toBeNull();
    expect(f.workersCertified).toBeNull();
    expect(one.mock.calls.some((c) => String(c[0]).includes("ORDER BY wage"))).toBe(false);
  });
});
