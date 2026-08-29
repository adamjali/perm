import { describe, expect, it, vi } from "vitest";

/**
 * The two filters that keep the daily change feed honest.
 *
 * Both exist because of one measured incident: on 2026-08-28 the first full
 * sweep wrote 92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows under two
 * timestamps. None of those expiries happened that day - they are 180-day
 * I-140 windows that lapsed across two years and were all noticed at once.
 * Rendered unfiltered, that is a fabricated surge on the busiest-looking day
 * in the record, which is the same defect class the RFI funnel guards against
 * one level down.
 *
 * These tests read the SQL the module actually issues rather than mocking a
 * result set, because the defect being pinned lives in the predicate: a feed
 * that dropped one of the two filters would return perfectly well-formed rows
 * and be wrong. Asserting on shaped fixture output would pass either way.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn() }));
vi.mock("../publicData", () => ({ doc: vi.fn() }));

const { getChangeDays, getChangeFeed } = await import("../changes");

/** Every SQL string the module issued, whitespace collapsed for matching. */
function issued(): string[] {
  return rows.mock.calls.map((c) => String(c[0]).replace(/\s+/g, " "));
}

describe("the daily change feed's filters", () => {
  it("excludes mechanical expiry from the day list", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    await getChangeDays(10);

    const sql = issued()[0]!;
    expect(sql).toContain("NOT (from_status = ? AND to_status = ?)");
    // The pair is passed as arguments, so the statuses must be bound - a
    // literal in the SQL would be a second place for them to drift.
    const args = rows.mock.calls[0]![1] as unknown[];
    expect(args[0]).toBe("CERTIFIED");
    expect(args[1]).toBe("CERTIFIED - EXPIRED");
  });

  it("drops any timestamp carrying a bulk catch-up write", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    await getChangeDays(10);

    const sql = issued()[0]!;
    expect(sql).toContain("GROUP BY changed_at HAVING COUNT(*) > ?");
    const args = rows.mock.calls[0]![1] as unknown[];
    // Far above DOL's heaviest measured day (~1,900) and far below the 92k
    // backfill. Three orders of magnitude of headroom either side.
    expect(args[2]).toBe(5000);
    expect(Number(args[2])).toBeGreaterThan(2000);
  });

  it("applies the identical predicate to the feed and to its own day list", async () => {
    // A feed and a day list computed under different predicates disagree about
    // which days hold data, so a reader picks a day and is told it is empty.
    rows.mockReset();
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("GROUP BY d")) return [{ d: "2026-08-29", n: 336 }];
      if (sql.includes("COUNT(*) AS n FROM perm_case_events")) return [{ n: 0 }];
      if (sql.includes("GROUP BY from_status")) return [];
      return [];
    });

    await getChangeFeed(null, 10);
    const feedSql = issued().find((s) => s.includes("LEFT JOIN perm_case_status"));
    expect(feedSql).toBeDefined();
    // Same two clauses, now qualified by the event table's alias.
    expect(feedSql).toContain("NOT (e.from_status = ? AND e.to_status = ?)");
    expect(feedSql).toContain("e.changed_at NOT IN");
  });

  it("counts the excluded expiries so the page can disclose them", async () => {
    // Silently dropping rows is indistinguishable from having no data, so the
    // number withheld is carried out of the module, not just discarded.
    rows.mockReset();
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("GROUP BY d")) return [{ d: "2026-08-28", n: 58 }];
      if (sql.includes("GROUP BY from_status")) return [];
      if (sql.includes("LEFT JOIN")) return [];
      return [{ n: 92_113 }];
    });

    const feed = await getChangeFeed("2026-08-28", 10);
    expect(feed?.expiriesExcluded).toBe(92_113);
    expect(feed?.total).toBe(58);
  });

  it("returns null rather than an empty shell when no day has events", async () => {
    rows.mockReset();
    rows.mockResolvedValue([]);
    expect(await getChangeFeed(null, 10)).toBeNull();
  });

  it("falls back to the newest day when asked for one that holds nothing", async () => {
    rows.mockReset();
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("GROUP BY d")) {
        return [{ d: "2026-08-29", n: 336 }, { d: "2026-08-27", n: 48 }];
      }
      if (sql.includes("GROUP BY from_status")) return [];
      if (sql.includes("LEFT JOIN")) return [];
      return [{ n: 0 }];
    });

    const feed = await getChangeFeed("1999-01-01", 10);
    expect(feed?.date).toBe("2026-08-29");
    expect(feed?.observedSince).toBe("2026-08-27");
  });
});
