import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The live-remainder listing: the SQL it issues, not a shaped result set.
 *
 * Same discipline as `changes.test.ts` and `stageCases.test.ts`. The defects
 * worth pinning here are all in the predicate: a "pending" list that forgets
 * `is_final`, a month filter that is closed on the wrong end and double-counts
 * the first of the next month, an ORDER BY with ties that lets LIMIT/OFFSET
 * repeat a row across pages. Fixture rows pass every one of those.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one }));

const {
  LIVE_DEFAULT_ITEMS,
  LIVE_MAX_ITEMS,
  isLiveKind,
  listLiveCases,
  monthAfter,
  parseLiveRemainderDoc,
  planLiveSql,
} = await import("../liveCases");

const DAY = 24 * 60 * 60 * 1000;

describe("planLiveSql", () => {
  it("pending and decided are the two values of is_final, nothing else", () => {
    expect(planLiveSql("pending", null)).toEqual({ where: "is_final = ?", params: [0] });
    expect(planLiveSql("decided", null)).toEqual({ where: "is_final = ?", params: [1] });
  });

  it("all is a true predicate so every caller can write WHERE ${where}", () => {
    expect(planLiveSql("all", null)).toEqual({ where: "1", params: [] });
  });

  it("a month is a half-open range, so December does not swallow 1 January", () => {
    const p = planLiveSql("pending", "2025-12");
    expect(p.where).toBe("is_final = ? AND filing_date >= ? AND filing_date < ?");
    expect(p.params).toEqual([0, "2025-12-01", "2026-01-01"]);
  });

  it("refuses anything that is not YYYY-MM before it reaches SQL", () => {
    for (const bad of ["2025-13", "2025-1", "202512", "abc", "2025-12-01", "2025-00"]) {
      expect(() => planLiveSql("all", bad), bad).toThrow();
    }
  });
});

describe("monthAfter", () => {
  it("rolls the year", () => {
    expect(monthAfter("2025-12")).toBe("2026-01");
    expect(monthAfter("2026-01")).toBe("2026-02");
    expect(monthAfter("2026-09")).toBe("2026-10");
  });
});

describe("isLiveKind", () => {
  it("accepts exactly the three kinds", () => {
    expect(isLiveKind("pending")).toBe(true);
    expect(isLiveKind("decided")).toBe(true);
    expect(isLiveKind("all")).toBe(true);
    expect(isLiveKind("certified")).toBe(false);
    expect(isLiveKind("")).toBe(false);
  });
});

describe("listLiveCases: the SQL it issues", () => {
  beforeEach(() => {
    rows.mockReset();
    rows.mockResolvedValue([]);
  });

  it("orders by filing date THEN case number, both in the same direction, and pages by offset", async () => {
    await listLiveCases({ kind: "pending", cursor: "100", numItems: 25 });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/FROM perm_live_recent WHERE is_final = \?/);
    expect(sql).toMatch(/ORDER BY filing_date DESC, case_number DESC LIMIT \? OFFSET \?/);
    // take + 1 so the page knows whether there is a next one without a COUNT.
    expect(args).toEqual([0, 26, 100]);
  });

  it("oldest first flips BOTH sort keys, or the tiebreak walks the wrong way inside a day", async () => {
    await listLiveCases({ kind: "all", order: "oldest" });
    const [sql] = rows.mock.calls[0]!;
    expect(sql).toMatch(/ORDER BY filing_date ASC, case_number ASC/);
  });

  it("clamps the page size and defaults it", async () => {
    await listLiveCases({ kind: "all", numItems: 10_000 });
    expect(rows.mock.calls[0]![1]).toEqual([LIVE_MAX_ITEMS + 1, 0]);
    await listLiveCases({ kind: "all", numItems: 0 });
    expect(rows.mock.calls[1]![1]).toEqual([2, 0]);
    await listLiveCases({ kind: "all" });
    expect(rows.mock.calls[2]![1]).toEqual([LIVE_DEFAULT_ITEMS + 1, 0]);
  });

  it("a cursor that is not a number reads as the first page, not NaN", async () => {
    await listLiveCases({ kind: "all", cursor: "sideways" });
    expect(rows.mock.calls[0]![1]).toEqual([LIVE_DEFAULT_ITEMS + 1, 0]);
  });

  it("selects the seen-on column and maps is_final however the driver types it", async () => {
    rows.mockResolvedValue([
      {
        case_number: "G-100-26077-713598",
        filing_date: "2026-03-09",
        status: "CERTIFIED",
        is_final: "1",
        employer_name: "Syracuse University",
        employer_slug: "syracuse-university",
        job_title: "Lecturer",
        decided_seen: "2026-09-01",
      },
      {
        case_number: "G-100-26077-713599",
        filing_date: "2026-03-09",
        status: "ANALYST REVIEW",
        is_final: 0,
        employer_name: "X",
        employer_slug: null,
        job_title: null,
        decided_seen: null,
      },
    ]);
    const page = await listLiveCases({ kind: "all", numItems: 5 });
    expect(rows.mock.calls[0]![0]).toMatch(/decided_seen/);
    expect(page.rows[0]).toEqual({
      caseNumber: "G-100-26077-713598",
      filingDate: "2026-03-09",
      status: "CERTIFIED",
      isFinal: true,
      employerName: "Syracuse University",
      employerSlug: "syracuse-university",
      jobTitle: "Lecturer",
      decidedSeen: "2026-09-01",
    });
    expect(page.rows[1]!.isFinal).toBe(false);
    expect(page.rows[1]!.employerSlug).toBeNull();
    expect(page.isDone).toBe(true);
    expect(page.continueCursor).toBe("2");
  });

  it("a full page plus one means there is a next page", async () => {
    rows.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        case_number: `G-${i}`,
        filing_date: "2026-01-01",
        status: "ANALYST REVIEW",
        is_final: 0,
        employer_name: "E",
        employer_slug: "e",
        job_title: null,
        decided_seen: null,
      })),
    );
    const page = await listLiveCases({ kind: "pending", numItems: 3, cursor: "6" });
    expect(page.rows).toHaveLength(3);
    expect(page.isDone).toBe(false);
    expect(page.continueCursor).toBe("9");
  });

  it("echoes the month and kind it listed, so the client cannot mislabel a page", async () => {
    const page = await listLiveCases({ kind: "decided", month: "2025-09" });
    expect(page.kind).toBe("decided");
    expect(page.month).toBe("2025-09");
  });
});

describe("parseLiveRemainderDoc", () => {
  const good = JSON.stringify({
    total: 137092,
    pending: 96157,
    decided: 40935,
    certified: 38187,
    denied: 1666,
    withdrawn: 1082,
    publishedThrough: "2026-06-30",
    asOf: "2026-09-02T18:00:00Z",
    byMonth: [
      { month: "2025-11", total: 14524, pending: 12909, decided: 1615 },
      { month: "2025-09", total: 13143, pending: 954, decided: 12189 },
    ],
  });
  const now = Date.UTC(2026, 8, 2, 20);

  it("reads a fresh doc", () => {
    const s = parseLiveRemainderDoc(good, now - DAY, now);
    expect(s?.pending).toBe(96157);
    expect(s?.decided).toBe(40935);
    expect(s?.publishedThrough).toBe("2026-06-30");
    expect(s?.byMonth.map((m) => m.month)).toEqual(["2025-11", "2025-09"]);
    expect(s?.computedAt).toBe(now - DAY);
  });

  it("treats a doc older than eight days as absent: a stale count is worse than none", () => {
    expect(parseLiveRemainderDoc(good, now - 9 * DAY, now)).toBeNull();
    expect(parseLiveRemainderDoc(good, now - 7 * DAY, now)).not.toBeNull();
  });

  it("returns null rather than a half-shaped summary", () => {
    expect(parseLiveRemainderDoc("{", now, now)).toBeNull();
    expect(parseLiveRemainderDoc(JSON.stringify({ pending: 1 }), now, now)).toBeNull();
    expect(parseLiveRemainderDoc(JSON.stringify({ ...JSON.parse(good), byMonth: "x" }), now, now)).toBeNull();
  });
});
