import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecidedFilters } from "../DecidedFilters";
import type { DecidedCase } from "@/lib/turso/decidedDays";

function c(over: Partial<DecidedCase>): DecidedCase {
  return {
    caseNumber: "A-1", program: "perm", status: "certified", decidedOn: "2021-03-01",
    receivedOn: null, employerName: "ACME", employerSlug: "acme", jobTitle: "Engineer",
    socCode: "15-1252.00", socTitle: "Software Developers", state: "WA", wage: 120000,
    wageUnit: null, attorneyName: null, attorneySlug: null, worksiteCity: null, naics: null,
    citizenship: null, visaClass: null, education: null, ...over,
  };
}

describe("DecidedFilters", () => {
  it("offers only the fields the loaded rows carry, and names the missing ones", () => {
    render(<DecidedFilters rows={[c({ citizenship: "INDIA" })]} value={{}} onChange={() => {}} />);
    expect(screen.getByLabelText("Citizenship")).toBeInTheDocument();
    expect(screen.queryByLabelText("Education")).not.toBeInTheDocument();
    expect(screen.getByText(/Not published for any loaded case: .*education/)).toBeInTheDocument();
  });

  it("reports a choice with the rest of the filters kept", () => {
    const onChange = vi.fn();
    render(
      <DecidedFilters
        rows={[c({ citizenship: "INDIA" }), c({ caseNumber: "A-2", citizenship: "CHINA" })]}
        value={{ state: "WA" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Citizenship"), { target: { value: "CHINA" } });
    expect(onChange).toHaveBeenCalledWith({ state: "WA", citizenship: "CHINA" });
  });
});
