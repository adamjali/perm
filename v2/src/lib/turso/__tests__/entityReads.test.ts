import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two entity-page reads that were the Turso bill.
 *
 * Both walked every row of the kind per render (71,512 employers) and were
 * invisible in dev. These pin the SQL shapes that the production EXPLAIN
 * showed to be index-served on 2026-09-02, so a "cleaner" rewrite cannot
 * quietly put the scan back.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one }));

const { nameVariants } = await import("../entityDetail");
const { fieldDistribution } = await import("../entities");

beforeEach(() => {
  rows.mockReset();
  one.mockReset();
  rows.mockResolvedValue([]);
});

describe("nameVariants", () => {
  it("is a half-open range on merge_key, never OR + LIKE", async () => {
    one.mockResolvedValueOnce({ merge_key: "deloitte consulting" });
    await nameVariants("employer", "deloitte-consulting-llp");
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/WHERE kind = \? AND merge_key >= \? AND merge_key < \? AND slug <> \?/);
    expect(sql).not.toMatch(/LIKE/);
    expect(args?.slice(0, 4)).toEqual(["employer", "deloitte", "deloitte!", "deloitte-consulting-llp"]);
  });
});

describe("fieldDistribution", () => {
  it("filters on the exact expression the index is built on, and sizes the kind from the top rank", async () => {
    one.mockResolvedValueOnce({ n: 71512 });
    const d = await fieldDistribution("employer", 5);
    const cohortSql = rows.mock.calls[0]![0];
    expect(cohortSql).toMatch(/WHERE kind = \? AND \(IFNULL\(certified, 0\) \+ IFNULL\(denied, 0\)\) >= \?/);
    const sizeSql = one.mock.calls[0]![0];
    expect(sizeSql).toMatch(/SELECT rank AS n FROM perm_entities WHERE kind = \? ORDER BY rank DESC LIMIT 1/);
    expect(sizeSql).not.toMatch(/count\(\*\)/i);
    expect(d.kindTotal).toBe(71512);
  });
});
