import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LcaYears } from "../LcaYears";

const y = (fy: number, certified: number, denied = 0, withdrawn = 0) => ({ fy, certified, denied, withdrawn });

describe("LcaYears", () => {
  it("draws the years from the first to the last, a missing year as a gap, with the busiest named", () => {
    render(<LcaYears years={[y(2009, 10), y(2012, 40, 2, 3), y(2021, 20)]} />);
    expect(screen.getByRole("heading", { name: "H-1B LCAs year by year since 2009" })).toBeTruthy();
    expect(document.body.textContent).toContain("75 H-1B LCAs DOL decided from FY2009 to FY2021, busiest in FY2012 with 45.");
    // FY2009 to FY2021 is thirteen bars in the table, the empty years included.
    expect(document.querySelectorAll("tbody tr")).toHaveLength(13);
    expect(screen.getByRole("img", { name: /^H-1B LCAs by fiscal year, FY2009 to FY2021/ })).toBeTruthy();
  });

  it("says nothing for a single year or for none", () => {
    const { container, rerender } = render(<LcaYears years={[y(2021, 20)]} />);
    expect(container.innerHTML).toBe("");
    rerender(<LcaYears years={[]} />);
    expect(container.innerHTML).toBe("");
    rerender(<LcaYears years={[y(2020, 0), y(2021, 0)]} />);
    expect(container.innerHTML).toBe("");
  });
});
