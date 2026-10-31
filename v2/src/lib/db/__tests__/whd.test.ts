import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { whdForSlug } = await import("../whd");

/** An employer's Wage and Hour cases: DOL's sums, the newest cases, and nothing invented when a read fails. */

const totals = {
  cases: 3, with_v: 2, bw: 15500.5, w: 7, pen: 1200,
  h1b_cases: 1, h1b_v: 2, h1b_bw: 12500, h1b_w: 3,
  h2a_cases: 0, h2a_v: 0, h2a_bw: 0, h2a_w: 0,
  h2b_cases: 0, h2b_v: 0, h2b_bw: 0, h2b_w: 0,
  first_start: "2019-01-01", last_end: "2024-06-30",
};
const newest = [
  { case_id: "9", legal_name: "Northwind Traders Inc.", trade_name: "Northwind", city: "Austin", state: "TX",
    findings_start: "2023-01-01", findings_end: "2024-06-30", violations: 2, back_wages: 12500, workers_owed: 3, penalties: 0,
    h1b_violations: 2, h1b_back_wages: 12500, h1b_workers: 3, h2a_violations: 0, h2a_back_wages: 0, h2a_workers: 0,
    h2b_violations: 0, h2b_back_wages: 0, h2b_workers: 0 },
  { case_id: "4", legal_name: "Northwind Traders Inc.", trade_name: "", city: "Austin", state: "TX",
    findings_start: "2019-01-01", findings_end: "2019-03-31", violations: 0, back_wages: 0, workers_owed: 0, penalties: 0,
    h1b_violations: 0, h1b_back_wages: 0, h1b_workers: 0, h2a_violations: 0, h2a_back_wages: 0, h2a_workers: 0,
    h2b_violations: 0, h2b_back_wages: 0, h2b_workers: 0 },
];

describe("whdForSlug", () => {
  beforeEach(() => {
    rows.mockReset();
  });

  it("sums every case and lists the newest, findings end first", async () => {
    rows.mockImplementation(async (sql) => (sql.startsWith("SELECT COUNT(*)") ? [totals] : newest));
    const s = await whdForSlug("northwind-traders-inc");
    expect(rows.mock.calls[1]![0]).toContain("ORDER BY findings_end IS NULL, findings_end DESC");
    expect(s?.cases).toBe(3);
    expect(s?.h1b).toEqual({ cases: 1, violations: 2, backWages: 12500, workers: 3 });
    expect(s?.newest[0]?.visa).toEqual([{ program: "H-1B", violations: 2, backWages: 12500, workers: 3 }]);
    expect(s?.newest[1]?.visa).toEqual([]);
  });

  it("answers nothing for an employer with no cases, and before the table exists", async () => {
    rows.mockImplementation(async (sql) => (sql.startsWith("SELECT COUNT(*)") ? [{ cases: 0 }] : []));
    expect(await whdForSlug("no-cases-llc")).toBeNull();
    rows.mockRejectedValue(new Error("SQLITE_ERROR: no such table: whd_cases"));
    expect(await whdForSlug("before-the-load-llc")).toBeNull();
  });

  it("throws on any other failed read, so the page keeps its last render", async () => {
    rows.mockRejectedValue(new Error("database query deadline"));
    await expect(whdForSlug("contoso-llc")).rejects.toThrow("deadline");
  });
});
