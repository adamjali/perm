import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YearBars, yearTip } from "../YearBars";

/**
 * The chart's words must not glue for anything reading the DOM. The rendered
 * audit found "FY16FY18FY20" on the axis and "withdrawnFiscal years" between
 * the legend and the note (Sep 26 to 27 2026); both are block or flex
 * siblings, so a browser shows them apart and textContent does not.
 */
const YEARS = [
  { fy: 2016, certified: 10, denied: 2, withdrawn: 1 },
  { fy: 2017, certified: 12, denied: 1, withdrawn: 0 },
  { fy: 2018, certified: 9, denied: 0, withdrawn: 2 },
  { fy: 2019, certified: 14, denied: 3, withdrawn: 1 },
];

describe("YearBars text", () => {
  it("keeps axis labels, legend, note and toggle apart", () => {
    const { container } = render(<YearBars years={YEARS} note="Fiscal years run October to September." />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/FY\d\dFY/);
    expect(text).not.toMatch(/withdrawnFiscal/);
    expect(text).not.toMatch(/September\.Every/);
    expect(text).toMatch(/FY16 /);
  });
});

describe("YearBars tooltips", () => {
  it("gives each year its total and every outcome", () => {
    expect(yearTip(YEARS[0]!)).toBe("FY2016\n13 decided\n10 certified\n2 denied\n1 withdrawn");
  });

  it("puts a tip on every year, a gap year included, and no native title beside it", () => {
    const { container } = render(<YearBars years={[YEARS[0]!, YEARS[2]!]} />);
    const tips = [...container.querySelectorAll("[data-tip]")].map((el) => el.getAttribute("data-tip"));
    expect(tips).toHaveLength(3);
    expect(tips[1]).toBe("FY2017\n0 decided\n0 certified\n0 denied\n0 withdrawn");
    expect(container.querySelector("[title]")).toBeNull();
  });
});
