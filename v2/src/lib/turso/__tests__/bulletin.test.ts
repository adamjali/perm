import { describe, expect, it, vi } from "vitest";

import type { BulletinMonth } from "@/lib/perm";

/**
 * The pace arithmetic, against fixtures rather than a database.
 *
 * The number these pin is the one the page leads with, and it is easy to get
 * subtly and invisibly wrong: a cutoff that advances 610 days across 35
 * months has gone FORWARD the whole time and still left everyone behind it
 * fifteen months further from the front. Publishing that as "advanced 610
 * days" and stopping is the half-truth the ratio exists to close.
 */

// The module under test reaches the database through publicData, which pulls
// in the libSQL client. Only the pure half is under test here.
vi.mock("../publicData", () => ({ getVisaBulletins: vi.fn() }));

const { summariseBulletins, categoriesIn, DAYS_PER_MONTH } = await import("../bulletin");

function b(
  month: string,
  finalAction: Record<string, Record<string, string>>,
): BulletinMonth {
  return { bulletinMonth: month, finalAction, datesForFiling: {} } as unknown as BulletinMonth;
}

/** Twelve bulletins whose EB-2 India cutoff advances exactly six months. */
function slowSeries(): BulletinMonth[] {
  const cells = [
    "01JAN13", "01JAN13", "15JAN13", "01FEB13", "15FEB13", "01MAR13",
    "15MAR13", "01APR13", "15APR13", "01MAY13", "15MAY13", "01JUL13",
  ];
  return cells.map((cell, i) =>
    b(`2025-${String(i + 1).padStart(2, "0")}`, { EB2: { india: cell } }),
  );
}

describe("categoriesIn", () => {
  it("reports what the archive holds, not what the bulletin publishes", () => {
    // The failure this closes was total and silent: a selector offering six
    // codes against an archive of three left every lookup undefined, so the
    // verdict, the retrogression note and the whole chart stopped rendering.
    const board = categoriesIn([
      b("2025-01", { EB1: { india: "C" }, EB3: { india: "01JAN14" } }),
      b("2025-02", { EB2: { india: "01JAN13" } }),
    ]);
    expect(board).toEqual(["EB1", "EB2", "EB3"]);
    expect(board).not.toContain("EB5");
  });

  it("keeps bulletin order rather than alphabetical order", () => {
    // EW3 sorts before EB4 alphabetically and after it in the bulletin, and a
    // reader scanning for their own row is scanning the bulletin's order.
    expect(
      categoriesIn([b("2025-01", { EW3: { india: "C" }, EB4: { india: "C" }, EB1: { india: "C" } })]),
    ).toEqual(["EB1", "EW3", "EB4"]);
  });

  it("keeps a code it has never heard of instead of dropping it", () => {
    const out = categoriesIn([b("2025-01", { EB1: { india: "C" }, EB2C: { india: "C" } })]);
    expect(out).toContain("EB2C");
  });
});

describe("summariseBulletins: the pace", () => {
  it("measures cutoff days gained per calendar month", () => {
    const board = summariseBulletins(slowSeries())!;
    const cell = board.finalAction.find((c) => c.category === "EB2" && c.country === "india")!;

    // 01JAN13 to 01JUL13 is 181 days, across 11 months of bulletins.
    expect(cell.movedDays).toBe(181);
    expect(cell.spanMonths).toBe(11);
    expect(cell.pace).toBeCloseTo(181 / (11 * DAYS_PER_MONTH), 6);
    // Well under 1.0: the queue got longer over a run in which the number on
    // the page went up every month.
    expect(cell.pace!).toBeLessThan(0.6);
  });

  it("puts a queue that outruns the calendar above 1.0", () => {
    const board = summariseBulletins([
      b("2025-01", { EB1: { india: "01JAN20" } }),
      b("2025-03", { EB1: { india: "01JAN22" } }),
    ])!;
    const cell = board.finalAction.find((c) => c.country === "india")!;
    expect(cell.pace!).toBeGreaterThan(1);
  });

  it("withholds the pace for a category that is currently shut", () => {
    // A pace measured up to the month a queue stopped describes a queue that
    // no longer exists, and next to a real cutoff it reads as a promise.
    const board = summariseBulletins([
      ...slowSeries(),
      b("2026-01", { EB2: { india: "U" } }),
    ])!;
    const cell = board.finalAction.find((c) => c.country === "india")!;

    expect(cell.latest).toEqual({ kind: "unavailable" });
    expect(cell.pace).toBeNull();
    // The movement itself is still reported, because it happened.
    expect(cell.movedDays).toBe(181);
  });

  it("withholds the pace for a category that published no cutoff at all", () => {
    const board = summariseBulletins([
      b("2025-01", { EB1: { worldwide: "C" } }),
      b("2025-02", { EB1: { worldwide: "C" } }),
    ])!;
    const cell = board.finalAction.find((c) => c.country === "worldwide")!;
    expect(cell.latest).toEqual({ kind: "current" });
    expect(cell.pace).toBeNull();
    expect(cell.movedDays).toBeNull();
  });

  it("withholds the pace when only one bulletin published a date", () => {
    const board = summariseBulletins([
      b("2025-01", { EB1: { india: "C" } }),
      b("2025-02", { EB1: { india: "01JAN20" } }),
    ])!;
    const cell = board.finalAction.find((c) => c.country === "india")!;
    expect(cell.pace).toBeNull();
  });
});

describe("summariseBulletins: retrogression", () => {
  it("counts a month that went backwards and a month that shut", () => {
    const board = summariseBulletins([
      b("2025-01", { EB2: { india: "01JAN14" } }),
      b("2025-02", { EB2: { india: "15JUL14" } }),
      b("2025-03", { EB2: { india: "01SEP13" } }),
      b("2025-04", { EB2: { india: "U" } }),
    ])!;
    const cell = board.finalAction.find((c) => c.country === "india")!;
    expect(cell.retrogressions).toEqual(["2025-03", "2025-04"]);
  });

  it("does not count a second closed month as a second retrogression", () => {
    const board = summariseBulletins([
      b("2025-01", { EB2: { india: "01JAN14" } }),
      b("2025-02", { EB2: { india: "U" } }),
      b("2025-03", { EB2: { india: "U" } }),
    ])!;
    expect(board.finalAction.find((c) => c.country === "india")!.retrogressions).toEqual([
      "2025-02",
    ]);
  });
});

describe("summariseBulletins: the window", () => {
  it("names its own range and sorts the input", () => {
    const board = summariseBulletins([
      b("2025-03", { EB1: { india: "01JAN20" } }),
      b("2025-01", { EB1: { india: "01JAN19" } }),
    ])!;
    expect(board.firstMonth).toBe("2025-01");
    expect(board.lastMonth).toBe("2025-03");
    expect(board.bulletinCount).toBe(2);
    // Sorted, so the movement is measured from the older end.
    expect(board.finalAction.find((c) => c.country === "india")!.movedDays).toBeGreaterThan(0);
  });

  it("returns null for an empty archive rather than an empty board", () => {
    expect(summariseBulletins([])).toBeNull();
  });

  it("omits a country the archive never publishes for that category", () => {
    const board = summariseBulletins([b("2025-01", { EB1: { india: "C" } })])!;
    expect(board.finalAction.map((c) => c.country)).toEqual(["india"]);
  });
});
