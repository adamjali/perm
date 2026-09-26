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
// `unstable_cache` needs Next's incremental-cache context, which does not
// exist in a bare unit test: it throws "Invariant: incrementalCache missing".
// These tests assert the SQL that reaches the driver, so the cache is mocked
// to a pass-through. That keeps the subject of the test the query, not the
// caching layer wrapped around it.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));

vi.mock("../client", () => ({ rows, one }));

const { nameVariants } = await import("../entityDetail");
const { fieldDistribution } = await import("../entities");
const { countPageworthy, getEntitySeed } = await import("../publicData");

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

describe("countPageworthy", () => {
  // 67.25B of the 98.4B rows billed Sep 2 to Sep 26 2026 were a count(*)
  // over the kind, three per entity-page render. The last rank is the count
  // whenever the tail clears the floor.
  it("reads the last-ranked row, not a count, when the tail clears the floor", async () => {
    one.mockResolvedValueOnce({ rank: 71512, total: 1 });
    expect(await countPageworthy("employer")).toBe(71512);
    expect(one).toHaveBeenCalledTimes(1);
    const [sql, args] = one.mock.calls[0]!;
    expect(sql).toMatch(/SELECT rank, total FROM perm_entities WHERE kind = \? ORDER BY rank DESC LIMIT 1/);
    expect(sql).not.toMatch(/count\(\*\)/i);
    expect(args).toEqual(["employer"]);
  });

  it("falls back to counting when the last-ranked entity is under the floor", async () => {
    one.mockResolvedValueOnce({ rank: 900, total: 0 }).mockResolvedValueOnce({ n: "850" });
    expect(await countPageworthy("attorney")).toBe(850);
    expect(one.mock.calls[1]![0]).toMatch(/count\(\*\)/i);
  });

  it("is what the seed prints as the kind's size", async () => {
    rows.mockResolvedValueOnce([]);
    one.mockResolvedValueOnce({ rank: 1410, total: 3 });
    const seed = await getEntitySeed("occupation", 10);
    expect(seed.total).toBe(1410);
    expect(one.mock.calls.every(([sql]) => !/count\(\*\)/i.test(sql))).toBe(true);
  });
});
