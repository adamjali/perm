import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The digest's read of the policy feed. Mocked at the mirror, so the SQL's
 * windows and the mapping are what's tested.
 */

const rows = vi.fn();
vi.mock("../lib/publicMirror", () => ({ rows, one: vi.fn() }));

const { readNotices } = await import("../newsletter");

// Braces: a hook that returns the mock gets it called as the hook's cleanup.
beforeEach(() => {
  rows.mockReset();
});

describe("readNotices", () => {
  it("dates a bill by its latest action, names its number, and keeps decisions out of the first read", async () => {
    rows.mockImplementation(async (sql: string) =>
      sql.includes("first_seen_at")
        ? [{ title: "E. v. U.S. Department of State", url: "https://www.courtlistener.com/opinion/1/e/", publication_date: "2026-10-26",
             type: "Court opinion", document_number: "cl-1" }]
        : [{ title: "Fairness for High-Skilled Americans Act of 2025", url: "https://www.congress.gov/bill/119th-congress/house-bill/2315",
             publication_date: "2026-10-22", type: "Bill", document_number: "bill-119-hr-2315" }],
    );
    const got = await readNotices("2026-10-20");
    const [first, second] = rows.mock.calls;
    // A bill's day is its latest action's (`dates`), not the day it was introduced.
    expect(first?.[0]).toContain("CASE WHEN type = 'Bill'");
    expect(first?.[0]).toContain("type NOT IN ('Court opinion', 'BALCA decision')");
    // Decisions: first held this week, decided in the last 120 days, three at most.
    expect(second?.[0]).toContain("first_seen_at >= ?");
    expect(second?.[0]).toContain("'-120 days'");
    expect(second?.[0]).toContain("LIMIT 3");
    expect(second?.[1]).toEqual([Date.parse("2026-10-20T04:00:00Z"), "2026-10-20"]);
    expect(got).toEqual([
      { title: "H.R. 2315, Fairness for High-Skilled Americans Act of 2025", url: "https://www.congress.gov/bill/119th-congress/house-bill/2315",
        publicationDate: "2026-10-22", type: "Bill in Congress" },
      { title: "E. v. U.S. Department of State", url: "https://www.courtlistener.com/opinion/1/e/", publicationDate: "2026-10-26",
        type: "Court opinion" },
    ]);
  });
});
