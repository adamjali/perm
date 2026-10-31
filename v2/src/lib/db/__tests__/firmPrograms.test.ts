import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A law firm's H-1B and wage-request work: read over every printed spelling
 * the nightly firm map assigns its page, on the attorney index, with the
 * employers it filed for linked to their pages (or printed as text).
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));
const tableColumns = vi.fn<(t: string) => Promise<Set<string>>>();
vi.mock("../tableColumns", () => ({ tableColumns }));
vi.mock("../entityLinks", () => ({
  keepLinkableSlugs: vi.fn(async (items: { employerSlug: string | null }[]) =>
    items.map((r) => (r.employerSlug === "apple-inc" ? r : { ...r, employerSlug: null })),
  ),
}));

const { getFirmPrograms } = await import("../firmPrograms");

beforeEach(() => {
  one.mockReset();
  rows.mockReset();
  tableColumns.mockReset();
});

describe("getFirmPrograms", () => {
  it("reads the firm's mapped spellings on the attorney index, and links only employers with a page", async () => {
    // The nightly firm map exists; the nightly lines table doesn't yet, so the page reads live.
    tableColumns.mockImplementation(async (t) => (t === "firm_page_map" ? new Set(["source_slug", "page_slug"]) : new Set()));
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM firm_page_map")) return [{ source_slug: "fragomen-llp" }, { source_slug: "fragomen-loewyllp" }];
      if (sql.includes("FROM lca_cases")) return [
        { employer_slug: "apple-inc", name: "Apple Inc.", n: "32377" },
        { employer_slug: "some-client-llc", name: "Some Client LLC", n: "12" },
      ];
      return [];
    });
    one.mockImplementation(async (sql: string) =>
      sql.includes("FROM lca_cases")
        ? { n: "527135", certified: "510877", first: "2020-01-02", last: "2026-06-30" }
        : { n: "0", certified: null, first: null, last: null },
    );
    const out = await getFirmPrograms("fragomen-llp");
    expect(out?.spellings).toBe(2);
    expect(out?.pwd).toBeNull();
    expect(out?.lca).toEqual({
      filings: 527135,
      certified: 510877,
      firstDecided: "2020-01-02",
      lastDecided: "2026-06-30",
      employers: [
        { name: "Apple Inc.", slug: "apple-inc", filings: 32377 },
        { name: "Some Client LLC", slug: null, filings: 12 },
      ],
    });
    const lcaCount = one.mock.calls.find((c) => String(c[0]).includes("FROM lca_cases"))!;
    expect(String(lcaCount[0])).toContain("INDEXED BY lca_cases_att_dec WHERE attorney_slug IN (?, ?)");
    expect(lcaCount[1]).toEqual(["fragomen-llp", "fragomen-loewyllp"]);
  });

  it("reads the page's own slug before the nightly map exists, and is null when no filing names the firm", async () => {
    tableColumns.mockResolvedValue(new Set());
    rows.mockResolvedValue([]);
    one.mockResolvedValue({ n: "0", certified: null, first: null, last: null });
    expect(await getFirmPrograms("small-firm")).toBeNull();
    expect(one.mock.calls.every((c) => JSON.stringify(c[1]) === JSON.stringify(["small-firm"]))).toBe(true);
  });

  it("throws when a program's table can't be read, never answering as if the firm filed none", async () => {
    tableColumns.mockResolvedValue(new Set());
    one.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM lca_cases")) throw new Error("database query deadline");
      return { n: "3", certified: null, first: "2026-01-02", last: "2026-03-04" };
    });
    rows.mockResolvedValue([]);
    await expect(getFirmPrograms("busy-firm")).rejects.toThrow("database query deadline");
  });

  it("reads the firm's nightly lines when the table is there, and never the program tables", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM firm_page_map")) return [{ source_slug: "fragomen-llp" }, { source_slug: "fragomen-loewyllp" }];
      if (sql.includes("FROM firm_programs"))
        return [
          {
            program: "lca", filings: "525175", certified: "500000", first_decided: "2019-10-01", last_decided: "2026-06-30",
            employers: JSON.stringify([{ slug: "apple-inc", name: "Apple Inc.", n: 9000 }, { slug: "tiny-co", name: "Tiny Co", n: 3 }]),
          },
          { program: "pwd", filings: "128435", certified: null, first_decided: "2021-10-18", last_decided: "2026-06-30", employers: "[]" },
        ];
      throw new Error(`unexpected read: ${sql}`);
    });
    const got = await getFirmPrograms("fragomen");
    expect(got).toEqual({
      lca: {
        filings: 525175, certified: 500000, firstDecided: "2019-10-01", lastDecided: "2026-06-30",
        employers: [{ name: "Apple Inc.", slug: "apple-inc", filings: 9000 }, { name: "Tiny Co", slug: null, filings: 3 }],
      },
      pwd: { filings: 128435, certified: null, firstDecided: "2021-10-18", lastDecided: "2026-06-30", employers: [] },
      seasonal: null,
      spellings: 2,
    });
    expect(one).not.toHaveBeenCalled();
  });

  it("is null from the nightly lines when the firm filed nothing outside PERM", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    rows.mockImplementation(async (sql: string) => (sql.includes("FROM firm_page_map") ? [{ source_slug: "small" }] : []));
    expect(await getFirmPrograms("small")).toBeNull();
  });
});
