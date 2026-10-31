import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FederalExclusions, agencyName, periodLine } from "@/components/entities/FederalExclusions";

const row = {
  name: "Royal Caribbean Cruises, Ltd.",
  city: "Miami",
  state: "FL",
  classification: "Firm",
  agency: "EPA",
  kind: "Prohibition/Restriction",
  active: "1998-10-14",
  ends: null,
  indefinite: true,
};

describe("FederalExclusions", () => {
  it("prints SAM's record: who excluded the firm, how, and since when", () => {
    render(<FederalExclusions rows={[row]} pageName="Royal Caribbean Cruises Ltd." />);
    expect(screen.getByRole("heading", { name: "Excluded from federal contracts" })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toContain("excluded by the Environmental Protection Agency (Prohibition/Restriction), from Oct 14, 1998, with no end date.");
    expect(text).toContain("by name and city");
    expect(text).toMatch(/isn.t a finding about the firm.s immigration filings/);
  });

  it("renders nothing for a page with none", () => {
    const { container } = render(<FederalExclusions rows={[]} pageName="X" />);
    expect(container.innerHTML).toBe("");
  });

  it("names an agency only where its code is certain, and says when SAM names none", () => {
    expect(agencyName("USCIS")).toBe("U.S. Citizenship and Immigration Services");
    expect(agencyName("USA")).toBe("USA");
    expect(agencyName(null)).toBe("an agency SAM doesn't name");
  });

  it("says a dated end, an open end and missing dates plainly", () => {
    expect(periodLine({ active: "2026-09-16", ends: "2069-08-16", indefinite: false })).toBe("from Sep 16, 2026 to Aug 16, 2069");
    expect(periodLine({ active: null, ends: null, indefinite: false })).toBe("dates not given");
  });
});
