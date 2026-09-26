import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployerYears } from "../EmployerYears";

const YEARS = [
  { fy: 2008, certified: 10, denied: 2, withdrawn: 1 },
  { fy: 2010, certified: 30, denied: 0, withdrawn: 0 },
  { fy: 2021, certified: 5, denied: 1, withdrawn: 0 },
];
const CASES = [
  { caseNumber: "A-20001-11111", status: "certified", decisionDate: "2021-03-01", jobTitle: "Engineer", state: "WA", wage: 104000 },
];

describe("EmployerYears", () => {
  it("renders nothing when the employer has no years", () => {
    const { container } = render(<EmployerYears years={[]} cases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws every year from the first to the last, a missing year as zero", () => {
    const { container } = render(<EmployerYears years={YEARS} cases={[]} />);
    const rows = [...container.querySelectorAll("tbody tr")].map((r) => r.textContent?.trim().split(/\s+/)[0]);
    expect(rows).toEqual(Array.from({ length: 14 }, (_, i) => `FY${2008 + i}`));
    const fy2009 = [...container.querySelectorAll("tbody tr")][1]!;
    expect(fy2009.textContent).toMatch(/FY2009\s+0\s+0\s+0/);
    expect(screen.getByText(/49 PERM decisions from FY2008 to FY2021, busiest in FY2010 with 30/)).toBeInTheDocument();
  });

  it("says how many of the 2020 to 2023 cases it lists, and links each to its lookup", () => {
    render(<EmployerYears years={YEARS} cases={CASES} lastYearPartial="DOL's newest file runs through June 2026" />);
    expect(screen.getByText(/The 1 most recent of 6\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A-20001-11111" })).toHaveAttribute(
      "href", "/perm-case-status?case=A-20001-11111",
    );
    expect(screen.getByText(/FY2021 is partial: DOL's newest file runs through June 2026\./)).toBeInTheDocument();
  });
});
