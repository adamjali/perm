import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WageHourCases } from "../WageHourCases";
import type { WhdSummary } from "@/lib/db/whd";

/** The employer page's Wage and Hour section: DOL's sums first, the visa programs named, DOL's cautions kept. */

const none = { cases: 0, violations: 0, backWages: 0, workers: 0 };
const summary: WhdSummary = {
  cases: 3, withViolations: 2, backWages: 15500.5, workersOwed: 7, penalties: 1200,
  h1b: { cases: 1, violations: 2, backWages: 12500, workers: 3 }, h2a: none, h2b: none,
  firstStart: "2019-01-01", lastEnd: "2024-06-30",
  newest: [
    { caseId: "9", name: "Northwind Traders Inc.", city: "Austin", state: "TX", findingsStart: "2023-01-01", findingsEnd: "2024-06-30",
      violations: 2, backWages: 12500, workersOwed: 3, penalties: 0, visa: [{ program: "H-1B", violations: 2, backWages: 12500, workers: 3 }] },
    { caseId: "4", name: "Northwind Traders Inc.", city: "Austin", state: "TX", findingsStart: "2019-01-01", findingsEnd: "2019-03-31",
      violations: 0, backWages: 0, workersOwed: 0, penalties: 0, visa: [] },
  ],
};

describe("the employer page's Wage and Hour section", () => {
  it("leads with DOL's sums, names the visa program, and says a no-violation case is one", () => {
    const html = renderToStaticMarkup(<WageHourCases summary={summary} pageName="Northwind Traders Inc." />);
    expect(html).toContain("Wage and Hour cases at Northwind Traders Inc.");
    expect(html).toContain("$15,501");
    expect(html).toMatch(/H-1B<\/span>1 case, 2 violations, \$12,500 in back wages to 3 workers/);
    expect(html).toContain("No violations found.");
    expect(html).toContain("agreed to pay, not what was paid");
  });

  it("draws nothing for an employer with no cases", () => {
    expect(renderToStaticMarkup(<WageHourCases summary={null} pageName="X" />)).toBe("");
  });
});
