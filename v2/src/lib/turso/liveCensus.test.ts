import { describe, expect, it } from "vitest";

import {
  adjacentFrom,
  aheadPendingFrom,
  monthRowsFrom,
  parseLiveCensusDoc,
  statusTotalFrom,
  type CensusMatrixRow,
} from "./liveCensus";

/**
 * The pure half of the live-census read layer.
 *
 * The census doc replaced five per-request aggregate queries (measured at
 * ~1.8M row reads per case lookup) with one perm_docs read. Every derivation
 * that used to be SQL is now a fold over the matrix, and a wrong fold looks
 * exactly like a right one on a page, so the folds are what get tested.
 */

const row = (
  month: string,
  status: string,
  isFinal: 0 | 1,
  n: number,
): CensusMatrixRow => ({ month, status, is_final: isFinal, n });

const MATRIX: CensusMatrixRow[] = [
  row("2024-03", "CERTIFIED", 1, 9000),
  row("2024-03", "ANALYST REVIEW", 0, 120),
  row("2024-04", "CERTIFIED", 1, 7000),
  row("2024-04", "RFI ISSUED", 0, 40),
  row("2024-04", "WITHDRAWN", 1, 300),
  row("2024-06", "ANALYST REVIEW", 0, 8000),
  row("2024-06", "DENIED", 1, 150),
];

const NOW = 1_756_400_000_000; // fixed "now" so staleness is deterministic

const doc = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    asOf: "2026-08-28",
    totalCases: 24_610,
    noFilingDate: 0,
    source: "flag.dol.gov/recaptcha/caseStatus (DOL, direct)",
    matrix: MATRIX,
    ...over,
  });

describe("parseLiveCensusDoc", () => {
  it("parses a well-formed doc and carries every field through", () => {
    const c = parseLiveCensusDoc(doc(), NOW - 1000, NOW);
    expect(c).not.toBeNull();
    expect(c?.totalCases).toBe(24_610);
    expect(c?.matrix).toHaveLength(7);
    expect(c?.source).toContain("flag.dol.gov");
  });

  it("rejects a doc older than the staleness ceiling rather than serving it", () => {
    // 9 days old: a census that stale means the ingest has been down for
    // longer than the alerting cycle, and stale queue positions read as
    // current ones. Absence renders an honest empty state; staleness lies.
    const nineDays = NOW - 9 * 24 * 60 * 60 * 1000;
    expect(parseLiveCensusDoc(doc(), nineDays, NOW)).toBeNull();
    const sevenDays = NOW - 7 * 24 * 60 * 60 * 1000;
    expect(parseLiveCensusDoc(doc(), sevenDays, NOW)).not.toBeNull();
  });

  it("rejects a doc whose matrix carries a malformed row, whole", () => {
    // Half a census is worse than none: aheadPending over a partial matrix
    // returns a small plausible number, not an error.
    const bad = doc({ matrix: [...MATRIX, { month: "2024-07", n: 5 }] });
    expect(parseLiveCensusDoc(bad, NOW, NOW)).toBeNull();
  });

  it("rejects totals that do not reconcile with the matrix", () => {
    // sum(matrix) + noFilingDate must equal totalCases. A mismatch means the
    // writer's two queries saw different tables (mid-ingest write), and every
    // downstream figure would silently disagree with every other.
    const bad = doc({ totalCases: 99 });
    expect(parseLiveCensusDoc(bad, NOW, NOW)).toBeNull();
  });

  it("returns null for JSON that does not parse", () => {
    expect(parseLiveCensusDoc("{not json", NOW, NOW)).toBeNull();
  });
});

describe("monthRowsFrom", () => {
  it("returns exactly one month's rows", () => {
    const r = monthRowsFrom(MATRIX, "2024-04");
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.month === "2024-04")).toBe(true);
  });

  it("returns empty for a month the mirror has never seen", () => {
    expect(monthRowsFrom(MATRIX, "2019-01")).toHaveLength(0);
  });
});

describe("aheadPendingFrom", () => {
  it("counts PENDING cases in strictly earlier months only", () => {
    // Ahead of 2024-06: pending in 2024-03 (120) + 2024-04 (40). The 8,000
    // pending IN 2024-06 are the same month, not ahead of it, and every
    // decided case has left the queue entirely.
    expect(aheadPendingFrom(MATRIX, "2024-06")).toBe(160);
  });

  it("is zero for the oldest month", () => {
    expect(aheadPendingFrom(MATRIX, "2024-03")).toBe(0);
  });

  it("ignores rows with an empty month rather than sorting them first", () => {
    const withEmpty = [...MATRIX, row("", "ANALYST REVIEW", 0, 999)];
    expect(aheadPendingFrom(withEmpty, "2024-06")).toBe(160);
  });
});

describe("statusTotalFrom", () => {
  it("sums one status across every month", () => {
    expect(statusTotalFrom(MATRIX, "ANALYST REVIEW")).toBe(8120);
  });

  it("matches case-insensitively with collapsed whitespace", () => {
    expect(statusTotalFrom(MATRIX, "  analyst   review ")).toBe(8120);
  });

  it("returns zero for a status that does not exist", () => {
    expect(statusTotalFrom(MATRIX, "SUPERVISED RECRUITMENT")).toBe(0);
  });
});

describe("adjacentFrom", () => {
  it("skips a month with no cases instead of linking to a 404", () => {
    // 2024-05 holds nothing, so 2024-04's next is 2024-06.
    expect(adjacentFrom(MATRIX, "2024-04")).toEqual({
      previous: "2024-03",
      next: "2024-06",
    });
  });

  it("returns nulls at the edges", () => {
    expect(adjacentFrom(MATRIX, "2024-03").previous).toBeNull();
    expect(adjacentFrom(MATRIX, "2024-06").next).toBeNull();
  });
});
