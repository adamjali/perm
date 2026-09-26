import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WARN_COLUMNS, WarnTable, sizeBand } from "../WarnTable";
import type { WarnNotice } from "@/lib/turso/warn";

function n(over: Partial<WarnNotice>): WarnNotice {
  return {
    id: "x", state: "WA", noticeDate: "2026-08-01", effectiveDate: null, company: "ACME",
    kind: "Layoff", employees: 60, county: "King", industry: null, employerSlug: "acme",
    sourceUrl: "https://example.gov", site: null, ...over,
  };
}

describe("WarnTable", () => {
  it("bands size so the options sort smallest first", () => {
    expect([sizeBand(10), sizeBand(60), sizeBand(120), sizeBand(900), sizeBand(null)]).toEqual(["0", "1", "2", "3", null]);
  });

  it("sorts on every column", () => {
    for (const c of WARN_COLUMNS) expect(typeof c.sortValue).toBe("function");
    expect(WARN_COLUMNS.map((c) => c.key)).toEqual(
      expect.arrayContaining(["notice", "company", "state", "kind", "employees", "county", "effective"]),
    );
  });

  it("filters by state and searches by site", () => {
    render(
      <WarnTable
        rows={[
          n({ id: "1", company: "ACME", state: "WA", site: "1 Main St, Redmond" }),
          n({ id: "2", company: "GLOBEX", state: "CA", county: "Santa Clara" }),
        ]}
      />,
    );
    expect(screen.getByText("GLOBEX")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: /State/ }), { target: { value: "WA" } });
    expect(screen.queryByText("GLOBEX")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: /State/ }), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Employer, site or county"), { target: { value: "redmond" } });
    expect(screen.queryByText("GLOBEX")).not.toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
  });
});
