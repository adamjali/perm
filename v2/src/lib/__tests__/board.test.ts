import { describe, expect, it } from "vitest";

import type { BulletinMonth } from "@/lib/perm";

import { bulletinMoves, decidedSpan, LEVEL_SHARE, lineFlow, SPAN_MIN_DECISIONS, statusMoves } from "../board";

const days = (spec: [string, number][]) => spec.flatMap(([d, n]) => Array.from({ length: n }, () => d));

describe("decidedSpan: where one day's decisions fell in the filing calendar", () => {
  it("gives the middle and the middle 80%, leaving out stragglers and quick cases", () => {
    // Oct 27 2026's shape: a few old stragglers, a month worked in name order, one quick case.
    const span = decidedSpan(days([["2025-11-03", 2], ["2026-01-02", 30], ["2026-01-13", 40], ["2026-01-29", 30], ["2026-05-29", 1]]))!;
    expect(span.middle).toBe("2026-01-13");
    expect(span.from).toBe("2026-01-02");
    expect(span.to).toBe("2026-01-29");
    expect(span.n).toBe(103);
  });

  it("says nothing from too few decisions, and ignores what isn't a date", () => {
    expect(decidedSpan(days([["2026-01-13", SPAN_MIN_DECISIONS - 1]]))).toBeNull();
    expect(decidedSpan([...days([["2026-01-13", SPAN_MIN_DECISIONS - 1]]), "", "Jan 13"])).toBeNull();
    expect(decidedSpan(days([["2026-01-13", SPAN_MIN_DECISIONS]]))?.middle).toBe("2026-01-13");
  });
});

describe("lineFlow: what came in against what went out", () => {
  it("calls a line shrinking when more were decided than filed", () => {
    expect(lineFlow(10_000, 16_956)).toEqual({ filed: 10_000, decided: 16_956, change: -6_956, trend: "shrinking" });
  });

  it("calls it growing the other way, and level within a few percent of the decisions", () => {
    expect(lineFlow(12_000, 10_000).trend).toBe("growing");
    expect(lineFlow(10_000 + 10_000 * LEVEL_SHARE, 10_000).trend).toBe("level");
    expect(lineFlow(10_000 + 10_000 * LEVEL_SHARE + 1, 10_000).trend).toBe("growing");
    expect(lineFlow(0, 0).trend).toBe("level");
  });
});

describe("statusMoves: each status's in and out over a window", () => {
  it("counts both ends of every move, and new filings into the first stage", () => {
    const moves = statusMoves(
      [
        { from: "ANALYST REVIEW", to: "CERTIFIED", n: 700 },
        { from: "ANALYST REVIEW", to: "RFI ISSUED", n: 40 },
        { from: "RFI ISSUED", to: "ANALYST REVIEW", n: 30 },
        { from: "analyst review", to: "Application on hold", n: 5 },
      ],
      "ANALYST REVIEW",
      400,
    );
    const by = Object.fromEntries(moves.map((m) => [m.status, m]));
    expect(by["ANALYST REVIEW"]).toEqual({ status: "ANALYST REVIEW", in: 430, out: 745, net: -315 });
    expect(by["RFI ISSUED"]!.net).toBe(10);
    expect(by["CERTIFIED"]!.net).toBe(700);
    expect(by["APPLICATION ON HOLD"]!.net).toBe(5);
    // Biggest move first.
    expect(moves[0]!.status).toBe("CERTIFIED");
  });

  it("ignores a row that isn't a move", () => {
    expect(statusMoves([{ from: "RFI ISSUED", to: "rfi issued", n: 9 }], "ANALYST REVIEW", 0)).toEqual([]);
  });
});

describe("bulletinMoves: each cutoff and how it moved", () => {
  // The archive's own keys: EB2, not "EB-2" (the board read "not listed" with the hyphen).
  const month = (m: string, eb2: string, eb1: string): BulletinMonth => ({
    bulletinMonth: m,
    finalAction: { EB1: { worldwide: eb1, india: "U" }, EB2: { worldwide: eb2, india: "U" } },
    datesForFiling: {},
  });

  it("reads the archive's keys and says how far a date moved", () => {
    const rows = bulletinMoves(month("2026-11", "01APR25", "C"), month("2026-10", "01JAN25", "C"), ["EB2"], ["worldwide"]);
    expect(rows[0]!.cells[0]).toMatchObject({ latest: "Apr 1, 2025", move: "+90 days", kind: "advanced" });
  });

  it("says unchanged for a cell that stays Current or Unavailable, not its own label twice", () => {
    const [eb1] = bulletinMoves(month("2026-11", "01APR25", "C"), month("2026-10", "01JAN25", "C"), ["EB1"], ["worldwide", "india"]);
    expect(eb1!.cells.map((c) => c.move)).toEqual(["unchanged", "unchanged"]);
  });

  it("leaves the move blank when the bulletin before isn't the month right before", () => {
    const [eb2] = bulletinMoves(month("2026-11", "01APR25", "C"), month("2026-08", "01JAN25", "C"), ["EB2"], ["worldwide"]);
    expect(eb2!.cells[0]!.move).toBe("");
  });
});
