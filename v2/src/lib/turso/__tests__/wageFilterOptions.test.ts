import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The salary explorer's filter facets must come from the precomputed doc, and
 * must fall back to the live queries rather than rendering empty dropdowns.
 *
 * WHY THIS EXISTS. The state facet is a GROUP BY over all of perm_cases that
 * no index can serve past its first predicate. Idle it is ~1.5s; under a
 * concurrent disclosure load this repo measured an ordinary GROUP BY state
 * going from ~0.3s to a worst of 59.2s. Sentry's week to 2026-09-12 carried
 * 11 "turso query deadline (20000ms, attempt 2): SELECT state, CO..." plus 4
 * SQLITE_NOMEM, all on that page.
 *
 * The fix is a point read by primary key, which cannot degrade the same way.
 * The speedup on an idle database is only about 2x and that is NOT the point -
 * what changes is the tail, so this test pins the SHAPE (doc preferred, live
 * fallback intact, stale floor rejected) rather than any timing.
 */
const rowsMock = vi.fn();
const oneMock = vi.fn();
vi.mock("../client", () => ({
  rows: (...a: unknown[]) => rowsMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
  turso: () => ({}),
  exec: vi.fn(),
}));

const DOC = {
  minCases: 30,
  occupations: [{ value: "15-1252", label: "Software Developers", n: 900 }],
  states: [{ value: "CA", label: "CA", n: 500 }],
  fiscalYears: ["2026", "2025"],
};

describe("getWageFilterOptions", () => {
  beforeEach(() => {
    rowsMock.mockReset();
    oneMock.mockReset();
  });

  it("reads the precomputed doc and issues NO table query", async () => {
    oneMock.mockResolvedValue({ json: JSON.stringify(DOC), computed_at: 1 });
    const { getWageFilterOptions } = await import("../publicData");
    const out = await getWageFilterOptions(30);
    expect(out.states).toEqual(DOC.states);
    expect(out.fiscalYears).toEqual(DOC.fiscalYears);
    // the whole point: the GROUP BY never runs
    expect(rowsMock).not.toHaveBeenCalled();
  });

  it("falls back to the live queries when the doc is missing", async () => {
    oneMock.mockResolvedValue(null);
    rowsMock
      .mockResolvedValueOnce([{ soc_code: "15-1252", soc_title: "Dev", n: 9 }])
      .mockResolvedValueOnce([{ state: "NY", n: 7 }])
      .mockResolvedValueOnce([{ fiscal_year: "2026" }]);
    const { getWageFilterOptions } = await import("../publicData");
    const out = await getWageFilterOptions(30);
    expect(rowsMock).toHaveBeenCalled();
    expect(out.states).toEqual([{ value: "NY", label: "NY", n: 7 }]);
  });

  it("ignores a doc built under a different floor", async () => {
    // A doc at minCases=5 would offer states the page then refuses a median
    // for, which reads as broken filtering rather than a stale document.
    oneMock.mockResolvedValue({
      json: JSON.stringify({ ...DOC, minCases: 5 }),
      computed_at: 1,
    });
    rowsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ state: "TX", n: 40 }])
      .mockResolvedValueOnce([{ fiscal_year: "2026" }]);
    const { getWageFilterOptions } = await import("../publicData");
    const out = await getWageFilterOptions(30);
    expect(rowsMock).toHaveBeenCalled();
    expect(out.states).toEqual([{ value: "TX", label: "TX", n: 40 }]);
  });

  it("ignores an empty doc rather than rendering empty dropdowns", async () => {
    oneMock.mockResolvedValue({
      json: JSON.stringify({ ...DOC, states: [] }),
      computed_at: 1,
    });
    rowsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ state: "WA", n: 33 }])
      .mockResolvedValueOnce([{ fiscal_year: "2026" }]);
    const { getWageFilterOptions } = await import("../publicData");
    const out = await getWageFilterOptions(30);
    expect(out.states).toEqual([{ value: "WA", label: "WA", n: 33 }]);
  });
});
