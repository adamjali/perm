import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { citedLine, inspectionType, inspectionUrl, SafetyInspections } from "../SafetyInspections";
import type { OshaSummary } from "@/lib/db/osha";

/** The employer page's OSHA section: OSHA's sums first, its own words for each inspection, its cautions kept. */

const summary: OshaSummary = {
  inspections: 4, withViolations: 2, violations: 9, serious: 5, willful: 1, repeat: 0,
  penalty: 82000, initialPenalty: 151000, open: 1, afterHarm: 1, firstOpen: "2017-02-06", lastOpen: "2025-11-03",
  newest: [
    { activityNr: "1700000", name: "NORTHWIND TRADERS INC.", city: "Austin", state: "TX", type: "M", openDate: "2025-11-03",
      closeDate: null, violations: 3, serious: 2, willful: 1, repeat: 0, penalty: 70000 },
    { activityNr: "1600000", name: "NORTHWIND TRADERS INC.", city: "Austin", state: "TX", type: "H", openDate: "2019-04-01",
      closeDate: "2019-06-01", violations: 0, serious: 0, willful: 0, repeat: 0, penalty: 0 },
  ],
};

describe("the employer page's OSHA section", () => {
  it("leads with OSHA's sums and keeps its cautions", () => {
    const html = renderToStaticMarkup(<SafetyInspections summary={summary} pageName="Northwind Traders Inc." />);
    expect(html).toContain("OSHA inspections at Northwind Traders Inc.");
    expect(html).toContain("2 cited a violation");
    expect(html).toContain("$82,000");
    expect(html).toContain("$151,000 when first assessed");
    expect(html).toContain("1 inspection still open; 1 after an accident, a death or a catastrophe.");
    expect(html).toContain("different companies can have similar names");
    expect(html).toContain("After a death or catastrophe, still open.");
    expect(html).toContain("No violations cited.");
  });

  it("names each violation kind it found, worst first", () => {
    expect(citedLine({ violations: 3, serious: 2, willful: 1, repeat: 0, penalty: 70000 })).toBe(
      "3 violations (1 willful, 2 serious), $70,000 in penalties.",
    );
    expect(citedLine({ violations: 1, serious: 0, willful: 0, repeat: 0, penalty: 0 })).toBe("1 violation.");
    expect(citedLine({ violations: 0, serious: 0, willful: 0, repeat: 0, penalty: 0, open: true })).toBe("No violations cited yet.");
  });

  it("words every inspection type, and links OSHA's own record", () => {
    for (const code of "ABCDEFGHIJKLMN") expect(inspectionType(code)).not.toBe("Type not given");
    expect(inspectionType(null)).toBe("Type not given");
    expect(inspectionUrl("1700000")).toBe("https://www.osha.gov/ords/imis/establishment.inspection_detail?id=1700000");
  });

  it("draws nothing for a sponsor with no inspections", () => {
    expect(renderToStaticMarkup(<SafetyInspections summary={null} pageName="X" />)).toBe("");
  });
});
