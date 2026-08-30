import { describe, expect, it, vi } from "vitest";

/**
 * The reads behind employers that exist only in the live feed.
 *
 * These assert the SQL the module ISSUES rather than mocking a result set,
 * for the same reason `changes.test.ts` does: every defect worth pinning here
 * lives in the predicate. A version that scanned `perm_live_recent` instead
 * of riding its index would return perfectly well-formed rows and be the
 * cost bug that got Turso reads blocked in August; a version that skipped the
 * published-entity filter would return correct rows under a heading claiming
 * no published record exists. Shaped fixture output passes either way.
 *
 * Every plan below was verified against production with EXPLAIN QUERY PLAN:
 *
 *   SEARCH perm_live_recent USING INDEX perm_live_recent_emp
 *          (employer_slug>? AND employer_slug<?)
 *   SEARCH perm_live_recent USING INDEX perm_live_recent_emp (employer_slug=?)
 *   SEARCH perm_entities USING COVERING INDEX
 *          sqlite_autoindex_perm_entities_1 (kind=? AND slug=?)
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one }));

const { liveEmployerRecord, searchLiveOnlyEmployers } = await import("../liveEmployers");

/** Every SQL string issued through `rows`, whitespace collapsed. */
function issued(): string[] {
  return rows.mock.calls.map((c) => String(c[0]).replace(/\s+/g, " "));
}

function reset() {
  rows.mockReset();
  one.mockReset();
}

describe("searchLiveOnlyEmployers", () => {
  it("matches an indexed slug prefix range, never a scan", async () => {
    reset();
    rows.mockResolvedValue([]);
    await searchLiveOnlyEmployers("Lorenz Bus");

    const sql = issued()[0]!;
    expect(sql).toContain("FROM perm_live_recent");
    expect(sql).toContain("WHERE employer_slug >= ? AND employer_slug < ?");
    // A LIKE over 137k rows on an endpoint a stranger can call is the exact
    // shape that blocked Turso reads in August.
    expect(sql).not.toContain("LIKE");
    const args = rows.mock.calls[0]![1] as unknown[];
    // The needle is SLUGIFIED, so it is comparable with the stored column.
    expect(args[0]).toBe("lorenz-bus");
    // Half-open upper bound: the last character's successor.
    expect(args[1]).toBe("lorenz-but");
  });

  it("excludes employers that already have a published record", async () => {
    reset();
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("ORDER BY cases DESC")) {
        return [
          { slug: "published-inc", cases: 4, pending: 1, latest: "2026-08-01" },
          { slug: "only-live-llc", cases: 2, pending: 2, latest: "2026-08-05" },
        ];
      }
      if (sql.includes("FROM perm_entities")) return [{ slug: "published-inc" }];
      if (sql.includes("GROUP BY employer_slug, employer_name")) {
        return [
          { employer_slug: "published-inc", employer_name: "Published Inc", n: 4 },
          { employer_slug: "only-live-llc", employer_name: "Only Live LLC", n: 2 },
        ];
      }
      return [];
    });

    const hits = await searchLiveOnlyEmployers("published");
    expect(hits.map((h) => h.slug)).toEqual(["only-live-llc"]);

    // AND the exclusion is a query against perm_entities, not a set
    // difference against the caller's own results. The two searches match
    // differently - name substring there, slug prefix here - so an employer
    // WITH a page can match this range while missing that substring, and
    // listing it under "no published record" would be a false claim about a
    // company whose page is one click away.
    const entityCheck = issued().find((s) => s.includes("FROM perm_entities"));
    expect(entityCheck).toContain("kind = 'employer' AND slug IN (?,?)");
  });

  it("names an employer by its COMMONEST spelling, not its newest", async () => {
    // Measured on production: lgs-staffing-llc-f-k-a-labor-guys-llc carries
    // four spellings differing only in whitespace, at 264 / 22 / 8 / 1. The
    // one-query version leans on SQLite's bare-column rule and would name the
    // employer after whichever row happened to carry MAX(filing_date) - which
    // can be the one-row truncated typo, rendering a name the employer's own
    // page then disagrees with.
    reset();
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("ORDER BY cases DESC")) {
        return [{ slug: "lgs-staffing", cases: 295, pending: 295, latest: "2026-08-08" }];
      }
      if (sql.includes("FROM perm_entities")) return [];
      if (sql.includes("GROUP BY employer_slug, employer_name")) {
        return [
          { employer_slug: "lgs-staffing", employer_name: "LGS Staffing LLC (typo", n: 1 },
          { employer_slug: "lgs-staffing", employer_name: "LGS Staffing LLC", n: 264 },
          { employer_slug: "lgs-staffing", employer_name: "LGS  Staffing LLC", n: 22 },
        ];
      }
      return [];
    });

    const hits = await searchLiveOnlyEmployers("lgs");
    expect(hits[0]!.name).toBe("LGS Staffing LLC");
    expect(hits).toHaveLength(1);
  });

  it("refuses a needle too short or too long to bound a range", async () => {
    reset();
    rows.mockResolvedValue([]);
    expect(await searchLiveOnlyEmployers("a")).toEqual([]);
    // The length cap runs BEFORE anything walks the string, because `text`
    // arrives from a stranger through /api/perm-entities/employer?q=.
    expect(await searchLiveOnlyEmployers("x".repeat(121))).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("liveEmployerRecord", () => {
  it("reads one employer by an indexed equality, and returns null for a junk slug", async () => {
    reset();
    // An aggregate over NO rows still returns one row, with count 0. A guard
    // that only checked for a row would hand every junk slug a page.
    one.mockResolvedValue({ cases: 0, pending: 0, first_filing: null, last_filing: null });
    expect(await liveEmployerRecord("zzz-not-a-real-employer")).toBeNull();

    const sql = String(one.mock.calls[0]![0]).replace(/\s+/g, " ");
    expect(sql).toContain("FROM perm_live_recent WHERE employer_slug = ?");
    expect(one.mock.calls[0]![1]).toEqual(["zzz-not-a-real-employer"]);
  });

  it("returns the record, its stages and its other spellings", async () => {
    reset();
    one.mockResolvedValue({
      cases: 174,
      pending: 173,
      first_filing: "2026-04-29",
      last_filing: "2026-08-08",
    });
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("GROUP BY status, is_final")) {
        return [
          { status: "analyst  review", is_final: 0, n: 173 },
          { status: "WITHDRAWN", is_final: 1, n: 1 },
        ];
      }
      if (sql.includes("GROUP BY employer_slug, employer_name")) {
        return [
          { employer_slug: "lorenz", employer_name: "Lorenz Bus Service, Inc.", n: 170 },
          { employer_slug: "lorenz", employer_name: "Lorenz Bus Service Inc", n: 4 },
        ];
      }
      return [];
    });

    const rec = await liveEmployerRecord("lorenz");
    expect(rec).not.toBeNull();
    expect(rec!.name).toBe("Lorenz Bus Service, Inc.");
    expect(rec!.otherNames).toEqual(["Lorenz Bus Service Inc"]);
    expect(rec!.cases).toBe(174);
    expect(rec!.pending).toBe(173);
    expect(rec!.firstFiling).toBe("2026-04-29");
    // Statuses are normalised the same way every other live reader does it,
    // or "ANALYST REVIEW" and "analyst  review" become two stages.
    expect(rec!.stages[0]).toEqual({ status: "ANALYST REVIEW", isFinal: false, n: 173 });
  });

  it("returns NOTHING that could be read as a published statistic", async () => {
    // The whole point. If this shape ever grows an approvalRate, medianDays,
    // rank or wage, some page will render it, and for these employers there
    // is no decided case anywhere in the disclosure corpus to compute it from.
    reset();
    one.mockResolvedValue({ cases: 3, pending: 3, first_filing: "2026-07-01", last_filing: "2026-08-01" });
    rows.mockImplementation(async (sql: string) =>
      sql.includes("employer_name")
        ? [{ employer_slug: "x", employer_name: "X LLC", n: 3 }]
        : [],
    );
    const rec = await liveEmployerRecord("x");
    expect(Object.keys(rec!).sort()).toEqual([
      "cases",
      "firstFiling",
      "lastFiling",
      "name",
      "otherNames",
      "pending",
      "slug",
      "stages",
    ]);
  });
});
