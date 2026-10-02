import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ one, rows: vi.fn(), exec: vi.fn() }));
const tableColumns = vi.fn<(t: string) => Promise<Set<string>>>();
vi.mock("../tableColumns", () => ({ tableColumns }));
vi.mock("../employerPrograms", () => ({
  employerSlugRange: vi.fn(async (slug: string) => (slug === "none" ? null : { lo: "acme", hi: "acmf" })),
}));

const { getLcaProfile, lcaProfileSql, LCA_NEWEST_FLAGS_SQL } = await import("../lcaProfile");
const { shapeLcaProfile } = await import("../../lcaProfile");

/**
 * The LCA panel's read. Two things it must get right that a type can't see:
 * it must not name the detail columns before the backfill adds them (that
 * throws, and the page would lose the visa line too), and every column it
 * names must be one the pure half reads, or a figure silently stays zero.
 */
describe("getLcaProfile", () => {
  beforeEach(() => {
    one.mockReset();
    tableColumns.mockReset();
  });

  it("asks only for the visa line, and skips the declarations read, until the detail columns exist", async () => {
    tableColumns.mockResolvedValue(new Set(["case_number", "visa_class"]));
    one.mockResolvedValue({ filings: 4, visa_h1b: 3, visa_e3: 1 });
    const p = await getLcaProfile("acme");
    expect(one).toHaveBeenCalledTimes(1);
    const sql = one.mock.calls[0]![0];
    expect(sql).not.toMatch(/workers|wage_level|h1b_dependent/);
    expect(sql).toContain("INDEXED BY lca_cases_emp");
    expect(one.mock.calls[0]![1]).toEqual(["acme", "acmf"]);
    expect(p?.visas.find((v) => v.key === "e3")?.n).toBe(1);
  });

  it("reads the breakdown and the newest declaration once the columns exist", async () => {
    tableColumns.mockResolvedValue(new Set(["case_number", "workers"]));
    one.mockImplementation(async (sql: string) =>
      sql === LCA_NEWEST_FLAGS_SQL
        ? { h1b_dependent: 1, willful_violator: 0, filed: "2026-05-01" }
        : { filings: 2, detail_rows: 2, positions: 3, new_employment: 1, change_employer: 2, visa_h1b: 2 },
    );
    const p = await getLcaProfile("acme");
    expect(one).toHaveBeenCalledTimes(2);
    expect(p?.newest).toEqual({ dependent: true, violator: false, filed: "2026-05-01" });
    expect(p?.kinds.find((k) => k.kind.key === "changeEmployer")?.n).toBe(2);
  });

  it("returns null for an employer with no slug range", async () => {
    expect(await getLcaProfile("none")).toBeNull();
    expect(one).not.toHaveBeenCalled();
  });

  it("names exactly the columns the pure half reads", () => {
    const aliases = [...lcaProfileSql(true).matchAll(/ AS ([a-z0-9_]+)/g)].map((m) => m[1]!).sort();
    // Shape a row carrying each alias as a distinct value and check every one lands somewhere.
    const fixture = Object.fromEntries(aliases.map((a, i) => [a, i + 1]));
    const p = shapeLcaProfile(fixture as never, null)!;
    const landed = new Set<number>([
      p.filings, p.detailRows, p.positions, p.levelBlank,
      p.dependent.yes, p.dependent.of, p.violator.yes, p.violator.of,
      ...p.kinds.map((k) => k.n), ...p.levels.map((l) => l.n), ...p.visas.map((v) => v.n),
    ]);
    expect(aliases.filter((a) => !landed.has(fixture[a]!))).toEqual([]);
  });

  it("counts the breakdown over certified LCAs only, and the blank level only among rows the backfill reached", () => {
    const sql = lcaProfileSql(true);
    expect(sql).toMatch(/case_status = 'CERTIFIED' THEN workers END\) AS positions/);
    expect(sql).toMatch(/workers IS NOT NULL AND wage_level IS NULL THEN 1 ELSE 0 END\) AS level_blank/);
  });
});
