import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));
vi.mock("../employerSlugs", () => ({
  employerMatch: vi.fn(async (slug: string) =>
    slug === "acme" ? { where: "employer_slug IN (?, ?)", args: ["acme", "acme-inc"], basis: "map", spellings: 2 } : null,
  ),
}));

const { lcaYears } = await import("../lcaYears");

beforeEach(() => {
  rows.mockReset();
});

describe("an employer's H-1B LCAs by fiscal year", () => {
  it("sums the page's own spellings by year, on the LCA database's table", async () => {
    rows.mockResolvedValueOnce([
      { fy: "2017", certified: "3", denied: "0", withdrawn: "1" },
      { fy: 2021, certified: 5, denied: 1, withdrawn: 0 },
    ]);
    expect(await lcaYears("acme")).toEqual([
      { fy: 2017, certified: 3, denied: 0, withdrawn: 1 },
      { fy: 2021, certified: 5, denied: 1, withdrawn: 0 },
    ]);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("FROM lca_cases_years WHERE employer_slug IN (?, ?) GROUP BY fy ORDER BY fy");
    expect(args).toEqual(["acme", "acme-inc"]);
  });

  it("reads nothing for a page with no spellings", async () => {
    expect(await lcaYears("nobody")).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });

  it("is empty while the table isn't built, and throws on any other failure", async () => {
    rows.mockRejectedValueOnce(new Error("SQLite error: no such table: lca_cases_years"));
    await expect(lcaYears("acme")).resolves.toEqual([]);
    rows.mockRejectedValueOnce(new Error("query deadline"));
    await expect(lcaYears("acme")).rejects.toThrow(/deadline/);
  });
});
