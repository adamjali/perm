import { describe, expect, it } from "vitest";

import { otherEstimateRows } from "./otherEstimates";
import type { Cell, Summary } from "./score";

const cell = (over: Partial<Cell>): Cell => ({
  recorded: 0, graded: 0, typicalMissDays: null, biasDays: null, inBandShare: null, within14Share: null,
  settled: 0, settledHitShare: null, overdue: 0, overdueDays: null, missAtLeastDays: null, biasAtLeastDays: null,
  ...over,
});
const summary = (byModel: Record<string, Cell>): Summary => ({
  computedOn: "2026-10-08",
  since: "2026-10-08",
  bySource: { ours: { all: cell({}), byModel, byHorizon: {} as Summary["bySource"][string]["byHorizon"] } },
});

describe("otherEstimateRows", () => {
  it("lists the wage-request month and each seasonal method that has a record", () => {
    const rows = otherEstimateRows(
      summary({ "pwd-queue": cell({ recorded: 234, graded: 12, typicalMissDays: 9, inBandShare: 0.4 }), "pwd-queue-request-month": cell({ recorded: 144 }) }),
      summary({
        "H-2A-start": cell({ recorded: 12 }),
        "H-2B-filed-season": cell({ recorded: 10, graded: 2, typicalMissDays: 6, inBandShare: 0.5 }),
        "CW-1-filed": cell({ recorded: 0 }),
      }),
      { "H-2A": { share: 0.51, cases: 32539, quarters: 5 }, "H-2B": { share: 0.427, cases: 15225, quarters: 3 } },
    );
    expect(rows.map((r) => r.model)).toEqual(["pwd-queue", "H-2A-start", "H-2B-filed-season"]);
    expect(rows[0]).toMatchObject({ label: "Wage-request month", range: "the month", tested: null, inRangeShare: 0.4 });
    expect(rows[2]).toMatchObject({ range: "the middle half", tested: { share: 0.427, cases: 15225 } });
  });

  it("quotes the backtest only beside the method the backtest grades", () => {
    const rows = otherEstimateRows(null, summary({ "H-2B-filed": cell({ recorded: 3 }) }), {
      "H-2B": { share: 0.427, cases: 15225, quarters: 3 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tested).toBeNull();
  });

  it("is empty before anything is recorded", () => {
    expect(otherEstimateRows(null, undefined)).toEqual([]);
  });
});
