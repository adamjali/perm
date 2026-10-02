import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));
const tableColumns = vi.fn<(t: string) => Promise<Set<string>>>();
vi.mock("../tableColumns", () => ({ tableColumns }));
vi.mock("../employerPrograms", () => ({ employerSlugRange: vi.fn(async () => ({ lo: "acme", hi: "acmf" })) }));

const { getUscisH1bRecord, H1B_YEARS_SQL } = await import("../uscisH1b");

/**
 * The USCIS H-1B read: it must answer null, not throw, before the first load
 * creates the table, and it must read the employer's slug range on the
 * table's employer index, the same range the LCA panel reads.
 */
describe("getUscisH1bRecord", () => {
  beforeEach(() => {
    one.mockReset();
    rows.mockReset();
    tableColumns.mockReset();
  });

  it("answers null before the table exists, without querying it", async () => {
    tableColumns.mockResolvedValue(new Set());
    expect(await getUscisH1bRecord("acme")).toBeNull();
    expect(rows).not.toHaveBeenCalled();
  });

  it("reads the slug range on the employer index and shapes the years", async () => {
    tableColumns.mockResolvedValue(new Set(["fy", "employer"]));
    rows.mockImplementation(async (sql: string) =>
      sql === H1B_YEARS_SQL
        ? [{ fy: "2025", new_appr: "7", new_den: "1", chg_appr: "2" }]
        : [{ name: "ACME CORP", approved: "9" }],
    );
    one.mockResolvedValue({ n: "2" });
    const r = await getUscisH1bRecord("acme");
    expect(H1B_YEARS_SQL).toContain("INDEXED BY uscis_h1b_employers_emp");
    expect(rows.mock.calls[0]![1]).toEqual(["acme", "acmf"]);
    expect(r?.years[0]?.approved.new).toBe(7);
    expect(r?.names).toEqual([{ name: "ACME CORP", approved: 9 }]);
    expect(r?.nameCount).toBe(2);
  });
});
