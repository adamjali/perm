import { describe, expect, it } from "vitest";

import { parseRangeCoverage } from "../rangeCoverage";

const DOC = JSON.stringify({
  end: "2026-10-04",
  current: { within7Share: 0.781 },
  rangeCoverage: { judged: 8023, insideShare: 0.287 },
});

describe("parseRangeCoverage", () => {
  it("reads the backtest's own figures", () => {
    expect(parseRangeCoverage(DOC, "2026-10-07")).toEqual({
      insideShare: 0.287,
      judged: 8023,
      within7Share: 0.781,
      through: "2026-10-04",
    });
  });

  it("quotes nothing from a test that has stopped running", () => {
    expect(parseRangeCoverage(DOC, "2026-10-26")).toBeNull();
  });

  it("quotes nothing it can't read or that judged no case", () => {
    expect(parseRangeCoverage("{", "2026-10-07")).toBeNull();
    expect(parseRangeCoverage(JSON.stringify({ end: "2026-10-04", rangeCoverage: { judged: 0, insideShare: 0 } }), "2026-10-07")).toBeNull();
  });
});
