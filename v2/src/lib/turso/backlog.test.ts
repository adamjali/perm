import { describe, expect, it } from "vitest";

import { censusFrom, foldBacklogRows } from "./backlog";

/**
 * The pure half of the backlog read layer.
 *
 * The SQL is not tested here; the folding is, because that is where a wrong
 * answer looks right. A month whose statuses were double counted still sums
 * to a plausible total, and a status silently dropped still renders a page.
 */

const row = (
  month: string,
  status: string,
  isFinal: 0 | 1,
  n: number,
) => ({ month, status, is_final: isFinal, n });

describe("foldBacklogRows", () => {
  it("splits a month into pending and decided by is_final, never by status name", () => {
    const [m] = foldBacklogRows([
      row("2025-11", "ANALYST REVIEW", 0, 14461),
      row("2025-11", "CERTIFIED", 1, 500),
      row("2025-11", "APPLICATION ON HOLD", 0, 6),
      row("2025-11", "WITHDRAWN", 1, 67),
    ]);

    expect(m).toBeDefined();
    expect(m?.month).toBe("2025-11");
    expect(m?.pending).toBe(14467);
    expect(m?.decided).toBe(567);
    expect(m?.total).toBe(15034);
    expect(m?.decidedPct).toBeCloseTo((567 / 15034) * 100, 6);
  });

  it("treats a status DOL has never printed before as pending, from is_final alone", () => {
    // The live table went from 15 distinct statuses to 16 mid-build, when
    // `DENIED - BALCA DISMISSED` arrived carrying one case. An allow-list
    // would have counted it as decided and looked entirely healthy.
    const [m] = foldBacklogRows([
      row("2026-01", "SOME STATUS DOL INVENTED ON TUESDAY", 0, 3),
      row("2026-01", "CERTIFIED", 1, 7),
    ]);
    expect(m?.pending).toBe(3);
    expect(m?.decided).toBe(7);
  });

  it("merges rows that differ only in case, rather than rendering two statuses", () => {
    // Unreachable from live data today, which is exactly why it needs a test:
    // the table is canonical upper case, so nothing else can exercise it.
    const [m] = foldBacklogRows([
      row("2026-02", "Analyst Review", 0, 10),
      row("2026-02", "ANALYST REVIEW", 0, 5),
      row("2026-02", "  analyst review  ", 0, 1),
    ]);
    expect(m?.statuses).toHaveLength(1);
    expect(m?.statuses[0]?.status).toBe("ANALYST REVIEW");
    expect(m?.statuses[0]?.count).toBe(16);
    expect(m?.pending).toBe(16);
  });

  it("resolves a final/non-final disagreement towards still pending", () => {
    // A genuine upstream integrity fault. Resolving it the other way would
    // understate the backlog, which is the one direction that flatters us.
    const [m] = foldBacklogRows([
      row("2026-03", "RFI ISSUED", 1, 4),
      row("2026-03", "RFI ISSUED", 0, 6),
    ]);
    expect(m?.pending).toBe(10);
    expect(m?.decided).toBe(0);
  });

  it("returns months oldest first and statuses largest first", () => {
    const months = foldBacklogRows([
      row("2026-01", "CERTIFIED", 1, 1),
      row("2025-11", "ANALYST REVIEW", 0, 2),
      row("2025-11", "RFI ISSUED", 0, 9),
      row("2024-06", "CERTIFIED", 1, 3),
    ]);
    expect(months.map((m) => m.month)).toEqual(["2024-06", "2025-11", "2026-01"]);
    expect(months[1]?.statuses.map((s) => s.status)).toEqual([
      "RFI ISSUED",
      "ANALYST REVIEW",
    ]);
  });

  it("drops rows with no month or no status instead of inventing one", () => {
    const months = foldBacklogRows([
      row("", "CERTIFIED", 1, 5),
      row("2026-01", "", 1, 5),
      row("2026-01", "CERTIFIED", 1, 5),
    ]);
    expect(months).toHaveLength(1);
    expect(months[0]?.total).toBe(5);
  });

  it("reports decidedPct as null for an empty month rather than zero", () => {
    // Zero would read as "nothing decided yet", which is a claim about a real
    // cohort. There is no cohort.
    const [m] = foldBacklogRows([row("2026-04", "CERTIFIED", 1, 0)]);
    expect(m?.total).toBe(0);
    expect(m?.decidedPct).toBeNull();
  });
});

describe("censusFrom", () => {
  it("sums to exactly what the months hold, so a headline cannot drift from its list", () => {
    const months = foldBacklogRows([
      row("2025-11", "ANALYST REVIEW", 0, 14461),
      row("2025-11", "CERTIFIED", 1, 500),
      row("2025-12", "ANALYST REVIEW", 0, 14222),
      row("2025-12", "APPLICATION ON HOLD", 0, 234),
      row("2025-12", "CERTIFIED", 1, 432),
    ]);
    const census = censusFrom(months);

    expect(census.pending).toBe(months.reduce((n, m) => n + m.pending, 0));
    expect(census.decided).toBe(months.reduce((n, m) => n + m.decided, 0));
    expect(census.total).toBe(census.pending + census.decided);
    expect(census.statuses.reduce((n, s) => n + s.count, 0)).toBe(census.total);
  });

  it("merges one status across months and keeps the largest first", () => {
    const census = censusFrom(
      foldBacklogRows([
        row("2025-11", "ANALYST REVIEW", 0, 100),
        row("2025-12", "ANALYST REVIEW", 0, 50),
        row("2025-12", "RFI ISSUED", 0, 200),
      ]),
    );
    expect(census.statuses.map((s) => [s.status, s.count])).toEqual([
      ["RFI ISSUED", 200],
      ["ANALYST REVIEW", 150],
    ]);
  });

  it("does not mutate the months it was handed", () => {
    const months = foldBacklogRows([row("2025-11", "ANALYST REVIEW", 0, 10)]);
    const before = months[0]?.statuses[0]?.count;
    censusFrom(months);
    censusFrom(months);
    expect(months[0]?.statuses[0]?.count).toBe(before);
  });
});
