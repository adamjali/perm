import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The employer page's H-2A, H-2B and CW-1 line: read over the employer's own
 * slug range on seasonal_cases and the live table, with the median taken over
 * hourly wages only, and absent for an employer that files none.
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ one, rows: vi.fn(), exec: vi.fn() }));

const { getEmployerPrograms } = await import("../employerPrograms");

const answer = (seasonal: { n: number; wage_n: number; certified: number | null }, pending: number, median: number) =>
  one.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM perm_entities")) return { merge_key: "mcrp farms" };
    if (sql.includes("FROM seasonal_case_status")) return { n: pending };
    if (sql.includes("COUNT(*) AS n") && sql.includes("FROM seasonal_cases")) return seasonal;
    if (sql.includes("FROM seasonal_cases")) return { wage: median };
    if (sql.includes("COUNT(*)")) return { n: 0, wage_n: 0 };
    return null;
  });

// Braces: a beforeEach that returns the mock has it called as a cleanup hook.
beforeEach(() => {
  one.mockReset();
});

describe("the seasonal line on an employer page", () => {
  it("counts the published applications, the open ones and the certified workers, with the hourly median", async () => {
    answer({ n: 12, wage_n: 11, certified: 340 }, 2, 16.08);
    const out = await getEmployerPrograms("mcrp-farms");
    expect(out?.seasonal).toEqual({
      program: "seasonal",
      published: 12,
      pending: 2,
      medianAnnualWage: null,
      wageN: 11,
      medianHourlyWage: 16.08,
      workersCertified: 340,
    });
    const sqls = one.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /FROM seasonal_cases INDEXED BY seasonal_cases_emp/.test(s))).toBe(true);
    expect(sqls.some((s) => /FROM seasonal_case_status INDEXED BY seasonal_case_status_emp .*is_final = 0/.test(s))).toBe(
      true,
    );
    // The median is the middle hourly wage: offset 5 of 11.
    const median = one.mock.calls.find((c) => String(c[0]).includes("ORDER BY wage"));
    expect(median?.[0]).toContain("wage_unit IN ('HOUR', 'HOURLY')");
    expect(median?.[1]).toEqual(["mcrp-farms", "mcrp-farmt", 5, 200, 5]);
  });

  it("is null for an employer that files none, so the page shows no empty line", async () => {
    answer({ n: 0, wage_n: 0, certified: null }, 0, 0);
    const out = await getEmployerPrograms("mcrp-farms");
    expect(out?.seasonal).toBeNull();
    expect(out?.perm).toBeTruthy();
  });

  it("keeps the other lines when the seasonal table can't be read", async () => {
    one.mockImplementation(async (sql: string) => {
      if (sql.includes("seasonal_cases")) throw new Error("no such table: seasonal_cases");
      if (sql.includes("FROM perm_entities")) return null;
      return { n: 3, wage_n: 0 };
    });
    const out = await getEmployerPrograms("mcrp-farms");
    expect(out?.seasonal).toBeNull();
    expect(out?.lca.published).toBe(3);
  });
});
