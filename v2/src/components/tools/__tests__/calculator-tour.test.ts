import { describe, expect, it } from "vitest";

import { LOOK, TOOL_BANDS } from "../CalculatorTour";

/**
 * /calculators renders statically and throws on a step that has calculators and no band look, so a new menu group
 * with a calculator fails the production build. This fails first, in the suite (Oct 31 2026: "Students and OPT"
 * broke four builds before anyone looked).
 */
describe("the calculators page's bands", () => {
  it("has a look for every step that has calculators", () => {
    const missing = TOOL_BANDS.filter((b) => !LOOK[b.group]).map((b) => b.group);
    expect(missing).toEqual([]);
    expect(TOOL_BANDS.length).toBeGreaterThan(5);
  });
});
