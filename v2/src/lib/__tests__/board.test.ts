import { describe, expect, it } from "vitest";

import type { BulletinMonth } from "@/lib/perm";

import {
  aboutMonths,
  lengthParts,
  backlogStatus,
  bulletinMoves,
  bulletinStatus,
  cutoffPaceFact,
  decidedSpan,
  LEVEL_SHARE,
  lineFlow,
  paceFacts,
  paceReading,
  paceStatus,
  SPAN_MIN_DECISIONS,
  statusMoves,
} from "../board";

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

describe("step statuses", () => {
  it("calls a line that lost cases shrinking, and one that gained them growing", () => {
    expect(backlogStatus(lineFlow(9000, 12000))).toEqual({ kind: "shrinking", word: "Backlog shrinking", detail: "3,000 fewer in 30 days", tone: "good" });
    expect(backlogStatus(lineFlow(12000, 9000))).toEqual({ kind: "growing", word: "Backlog growing", detail: "3,000 more in 30 days", tone: "warn" });
    expect(backlogStatus(lineFlow(10000, 10050)).tone).toBe("flat");
  });

  it("calls a shorter median quicker and a longer one slower", () => {
    expect(paceStatus(4.2, 3.9).word).toBe("Getting quicker");
    expect(paceStatus(3.9, 4.2).word).toBe("Getting slower");
    expect(paceStatus(3.9, 3.9).tone).toBe("flat");
  });

  it("names a bulletin move advancing, retrogressed or holding", () => {
    expect(bulletinStatus("advanced")?.word).toBe("Advancing");
    expect(bulletinStatus("retrogressed")?.word).toBe("Retrogressed");
    expect(bulletinStatus("shut")?.tone).toBe("bad");
    expect(bulletinStatus("held")?.word).toBe("Holding");
    expect(bulletinStatus("unknown")).toBeNull();
  });
});

describe("aboutMonths: a span in words", () => {
  it("says days under a month, then months to the nearest half", () => {
    expect(aboutMonths(9)).toBe("about 9 days");
    expect(aboutMonths(31)).toBe("about 1 month");
    expect(aboutMonths(290)).toBe("about 9½ months");
  });

  it("says years once a span passes two, to the nearest half", () => {
    expect(aboutMonths(700)).toBe("about 23 months");
    expect(aboutMonths(12_340)).toBe("about 34 years");
    expect(aboutMonths(1_100)).toBe("about 3 years");
    expect(aboutMonths(1_280)).toBe("about 3½ years");
  });
});


describe("paceReading: a step's wait, its pace and how the wait changed", () => {
  const span = (middle: string) => ({ n: 600, middle, from: middle, to: middle });

  it("reads the wait, the filing days moved a day and the change over a month", () => {
    // Oct 27: the middle decision was filed Jan 13 (287 days). Sep 25: filed Dec 1 (298 days).
    const r = paceReading({ day: "2026-10-27", span: span("2026-01-13") }, { day: "2026-09-25", span: span("2025-12-01") })!;
    expect(r).toEqual({ waitDays: 287, perDay: 1.3, waitChange: -11, since: "2026-09-25" });
    expect(paceFacts(r, "Sep 25")).toEqual([
      "Waited 287 days, filed to decided",
      "DOL moved through 1.3 filing days a day since Sep 25; at 1 the wait holds level",
      "11 days shorter than on Sep 25",
    ]);
  });

  it("gives the wait alone without an earlier reading, and nothing without a span", () => {
    expect(paceReading({ day: "2026-10-27", span: span("2026-01-13") }, null)).toEqual({ waitDays: 287, perDay: null, waitChange: null, since: null });
    expect(paceFacts({ waitDays: 287, perDay: null, waitChange: null, since: null }, null)).toEqual(["Waited 287 days, filed to decided"]);
    expect(paceReading({ day: "2026-10-27", span: null }, null)).toBeNull();
  });

  it("says a wait that didn't change is the same", () => {
    const r = paceReading({ day: "2026-10-27", span: span("2026-01-13") }, { day: "2026-09-27", span: span("2025-12-14") })!;
    expect(r.waitChange).toBe(0);
    expect(paceFacts(r, "Sep 27").at(-1)).toBe("The same wait as on Sep 27");
  });

  it("words a bulletin line's pace, and nothing when there is none", () => {
    expect(cutoffPaceFact(0.43)).toBe("The cutoff has gained 0.4 months a month; at 1 the wait holds level, under 1 it grows");
    expect(cutoffPaceFact(1)).toBe("The cutoff has gained 1 month a month; at 1 the wait holds level, under 1 it grows");
    expect(cutoffPaceFact(null)).toBeNull();
  });
});

describe("lengthParts: the same span for a page in another language", () => {
  it("gives aboutMonths's own number and unit", () => {
    expect(lengthParts(288)).toEqual({ n: 9.5, unit: "months" });
    expect(lengthParts(31)).toEqual({ n: 1, unit: "months" });
    expect(lengthParts(1_280)).toEqual({ n: 3.5, unit: "years" });
    expect(lengthParts(9)).toEqual({ n: 1, unit: "months" });
  });
});
