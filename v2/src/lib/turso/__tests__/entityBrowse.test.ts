import { describe, expect, it, vi } from "vitest";

import { BROWSE_OTHER, bucketRanges } from "@/lib/entityBrowse";
import { MIN_TOTAL_FOR_PAGE } from "@/lib/entityPayload";

/**
 * The browse queries, read as SQL rather than as results.
 *
 * Two things can go wrong here and neither shows up in the returned rows.
 *
 * A predicate written as `substr(slug, 1, 1) = ?` or `upper(name) LIKE 'S%'`
 * returns exactly the right entities and cannot use an index: it becomes
 * `SCAN perm_entities`, which is 71,512 rows per letter page for employers.
 * Turso reads are this project's binding cost and were BLOCKED mid-August
 * after a month of crawler traffic burned a 500M row-read budget, so a correct
 * result set from a scan is a real defect that no fixture would reveal.
 *
 * And a threshold restated as a literal `3` instead of imported would drift
 * from `MIN_TOTAL_FOR_PAGE` the day that constant moves, at which point the
 * index links to pages that 404, at scale.
 *
 * Measured against the live database, the shipped predicate plans as:
 *   SEARCH perm_entities USING INDEX sqlite_autoindex_perm_entities_1
 *          (kind=? AND slug>? AND slug<?)
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn() }));

const { BROWSE_MAX, browseBucket, browseCounts } = await import(
  "../entityBrowse"
);

/** The SQL of the last call, whitespace collapsed for matching. */
function lastSql(): string {
  const call = rows.mock.calls.at(-1);
  return String(call?.[0] ?? "").replace(/\s+/g, " ");
}

function lastArgs(): unknown[] {
  return (rows.mock.calls.at(-1)?.[1] ?? []) as unknown[];
}

describe("browseBucket's predicate", () => {
  it("ranges over the INDEXED slug column and never wraps it in a function", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    await browseBucket("employer", "s");

    const sql = lastSql();
    expect(sql).toContain("WHERE kind = ? AND total >= ? AND slug >= ? AND slug < ?");
    // The two shapes that silently turn this into a table scan.
    expect(sql).not.toMatch(/substr\s*\(/i);
    expect(sql).not.toMatch(/upper\s*\(|lower\s*\(/i);
    expect(sql).not.toMatch(/\bLIKE\b/i);
    // (kind, slug) is the PRIMARY KEY. Reading a different column here is what
    // would cost the index, so the column name is part of the contract.
    expect(sql).toContain("FROM perm_entities");
  });

  it("binds the half-open range the partition defines, and the shared threshold", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    await browseBucket("attorney", "l");

    const [lo, hi] = bucketRanges("l")[0]!;
    expect(lastArgs()).toEqual(["attorney", MIN_TOTAL_FOR_PAGE, lo, hi]);
  });

  it("issues the residue bucket as a UNION ALL of its two ranges", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    await browseBucket("employer", BROWSE_OTHER);

    // Each arm keeps its own indexed range. One arm with an OR between the
    // bounds would collapse to a scan; a `NOT BETWEEN` would too.
    expect(lastSql()).toContain("UNION ALL");
    expect(lastSql().match(/slug >= \? AND slug < \?/g)).toHaveLength(2);
    expect(lastArgs()).toHaveLength(8);
  });

  it("returns rows sorted by name, not by slug", async () => {
    rows.mockReset();
    // Deliberately out of order, and with a case difference: DOL prints
    // whatever the filer typed, so an index sorted case-sensitively would put
    // every all-caps name in a block ahead of the rest.
    rows.mockResolvedValue([
      { slug: "zeta-corp", name: "Zeta Corp", total: 4, rank: 900 },
      { slug: "acme-inc", name: "acme inc", total: 30, rank: 100 },
      { slug: "beta-llc", name: "BETA LLC", total: 12, rank: 400 },
    ]);
    const out = await browseBucket("employer", "a");
    expect(out.entries.map((e) => e.slug)).toEqual([
      "acme-inc",
      "beta-llc",
      "zeta-corp",
    ]);
    expect(out.total).toBe(3);
  });

  it("caps the rendered list AFTER sorting, and reports the true total", async () => {
    // Cutting in SQL, or before the sort, would take an arbitrary BROWSE_MAX
    // rows by storage order and present them as "the first N alphabetically".
    // Reversed input is the arrangement that catches it: if the cut happened
    // first this keeps the LAST names in the alphabet.
    rows.mockReset();
    rows.mockResolvedValue(
      Array.from({ length: BROWSE_MAX + 25 }, (_, i) => {
        const n = BROWSE_MAX + 24 - i;
        return {
          slug: `e-${String(n).padStart(5, "0")}`,
          name: `E ${String(n).padStart(5, "0")}`,
          total: 3,
          rank: n,
        };
      }),
    );
    const out = await browseBucket("employer", "e");
    expect(out.total).toBe(BROWSE_MAX + 25);
    expect(out.entries).toHaveLength(BROWSE_MAX);
    expect(out.entries[0]?.slug).toBe("e-00000");
    expect(out.entries[BROWSE_MAX - 1]?.slug).toBe(
      `e-${String(BROWSE_MAX - 1).padStart(5, "0")}`,
    );
  });

  it("takes the busiest and smallest from the whole letter, not the capped list", () => {
    // The page renders "the busiest is X with N cases" and "the smallest carry
    // N" as claims about the LETTER. Reduced over the capped slice they quietly
    // become claims about the first BROWSE_MAX names alphabetically instead -
    // a plausible wrong answer that reads perfectly on the page.
    //
    // The fixture puts BOTH extremes past the cap, which is the only
    // arrangement that separates the two implementations.
    rows.mockReset();
    rows.mockResolvedValue(
      Array.from({ length: BROWSE_MAX + 10 }, (_, i) => ({
        slug: `e-${String(i).padStart(5, "0")}`,
        name: `E ${String(i).padStart(5, "0")}`,
        total: i === BROWSE_MAX + 5 ? 9999 : i === BROWSE_MAX + 6 ? 1 : 50,
        rank: i + 1,
      })),
    );
    return browseBucket("employer", "e").then((out) => {
      expect(out.entries).toHaveLength(BROWSE_MAX);
      expect(out.busiest?.total).toBe(9999);
      expect(out.busiest?.slug).toBe(`e-${String(BROWSE_MAX + 5).padStart(5, "0")}`);
      expect(out.smallest).toBe(1);
    });
  });
});

describe("browseCounts", () => {
  it("counts only pageworthy rows and returns every bucket, zero included", async () => {
    rows.mockReset();
    rows.mockResolvedValue([
      { c: "a", n: 1488 },
      { c: "s", n: 1605 },
      { c: "3", n: 22 },
      { c: "7", n: 4 },
    ]);
    const counts = await browseCounts("employer");

    expect(lastSql()).toContain("WHERE kind = ? AND total >= ?");
    expect(lastArgs()).toEqual(["employer", MIN_TOTAL_FOR_PAGE]);
    expect(counts.a).toBe(1488);
    expect(counts.s).toBe(1605);
    // Every non-letter lead folds into one bucket, through the partition's own
    // `bucketOf` rather than a second copy of the rule written here.
    expect(counts[BROWSE_OTHER]).toBe(26);
    // A letter nobody uses is 0, not missing. A caller that had to tell those
    // apart would get it wrong, and an absent chip looks like a broken query.
    expect(counts.x).toBe(0);
    expect(Object.keys(counts)).toHaveLength(27);
  });

  it("serves the same kind from one read: 27 letter pages must not be 27 queries", async () => {
    rows.mockReset();
    rows.mockResolvedValue([{ c: "a", n: 5 }]);
    // A fresh kind, so this test does not depend on the cache state another
    // test left behind. The cache is module-level and deliberately survives
    // between renders, which is the whole point of it.
    await browseCounts("occupation");
    await browseCounts("occupation");
    await browseCounts("occupation");
    expect(rows).toHaveBeenCalledTimes(1);
  });
});
