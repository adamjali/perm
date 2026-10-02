import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsPrinted, SevpEmployerTable } from "../SevpEmployerTable";

/** ICE's top-200 tables: a blank cell stays blank, names link a search, ICE's slips are named. */
describe("SevpEmployerTable", () => {
  const list = {
    year: 2024,
    list: "opt" as const,
    asPrinted: [],
    rows: [
      { rank: 1, employer: "Amazon", total: 10167, opt: 5379, stemOpt: 6679, cpt: null },
      { rank: 2, employer: "Bright Mind Enrichment and Schooling", total: 1234, opt: 1234, stemOpt: null, cpt: null },
    ],
  };

  it("prints ICE's counts, with a blank STEM OPT cell left blank", () => {
    const { container } = render(<SevpEmployerTable list={list} />);
    const cells = [...container.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim()));
    expect(cells[0]).toEqual(["1", "10,167", "5,379", "6,679"]);
    expect(cells[1]).toEqual(["2", "1,234", "1,234", ""]);
  });

  it("links each name to a search, not a claimed employer page", () => {
    const { container } = render(<SevpEmployerTable list={list} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/perm-employers?q=Amazon");
  });

  it("names ICE's own ordering slips", () => {
    const { container } = render(<AsPrinted notes={["Apple, Inc (323) is listed below Populus Group (233)"]} />);
    expect(container.textContent).toContain("As ICE printed it: Apple, Inc (323) is listed below Populus Group (233).");
  });
});
