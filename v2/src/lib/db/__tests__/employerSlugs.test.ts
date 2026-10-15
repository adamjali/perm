import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which rows belong to an employer page. Before the nightly map exists the
 * old name prefix is the fallback; once it exists, the page reads exactly the
 * spellings the map assigns it, and a page the map doesn't list reads its own
 * slug, never a prefix (a prefix is what counted Intellectt on Intel's page).
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));
const tableColumns = vi.fn<(t: string) => Promise<Set<string>>>();
vi.mock("../tableColumns", () => ({ tableColumns }));

const { employerMatch, pageForSpelling, slugListMatch } = await import("../employerSlugs");

beforeEach(() => {
  one.mockReset();
  rows.mockReset();
  tableColumns.mockReset();
});

describe("employerMatch", () => {
  it("falls back to the merge-key prefix while the map table doesn't exist", async () => {
    tableColumns.mockResolvedValue(new Set());
    one.mockResolvedValue({ merge_key: "intel" });
    const m = await employerMatch("intel-corporation-before-map");
    expect(m).toEqual({ where: "employer_slug >= ? AND employer_slug < ?", args: ["intel", "intem"], basis: "prefix", spellings: null });
    expect(rows).not.toHaveBeenCalled();
  });

  it("reads exactly the spellings the map assigns the page", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    rows.mockResolvedValue([{ source_slug: "salesforce-com-inc" }, { source_slug: "salesforce-inc" }]);
    const m = await employerMatch("salesforce-inc");
    expect(m).toEqual({
      where: "employer_slug IN (?, ?)",
      args: ["salesforce-com-inc", "salesforce-inc"],
      basis: "map",
      spellings: 2,
    });
    expect(String(rows.mock.calls[0]![0])).toContain("WHERE page_slug = ?");
    expect(rows.mock.calls[0]![1]).toEqual(["salesforce-inc"]);
  });

  it("reads the page's own slug, not a prefix, when the map has nothing for it", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    rows.mockResolvedValue([]);
    const m = await employerMatch("intel-corporation-new");
    expect(m).toEqual({ where: "employer_slug IN (?)", args: ["intel-corporation-new"], basis: "own", spellings: 1 });
    expect(one).not.toHaveBeenCalled();
  });

  it("builds one placeholder per spelling", () => {
    const m = slugListMatch(["a", "b", "c"], "map");
    expect(m.where).toBe("employer_slug IN (?, ?, ?)");
    expect((m.where.match(/\?/g) ?? []).length).toBe(m.args.length);
  });
});

describe("pageForSpelling", () => {
  it("names the page a spelling with no page of its own belongs to", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    one.mockResolvedValue({ page_slug: "salesforce-inc", page_kind: "perm" });
    expect(await pageForSpelling("salesforce-com-inc")).toEqual({ page: "salesforce-inc", kind: "perm" });
  });

  it("is null for a spelling that is its own page, or that the map doesn't know", async () => {
    tableColumns.mockResolvedValue(new Set(["source_slug", "page_slug"]));
    one.mockResolvedValueOnce({ page_slug: "acme", page_kind: "other" }).mockResolvedValueOnce(null);
    expect(await pageForSpelling("acme")).toBeNull();
    expect(await pageForSpelling("nobody")).toBeNull();
  });
});
