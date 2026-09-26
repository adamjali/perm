import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { OFFICE_COLUMNS, OfficeTable } from "../OfficeTable";
import type { OfficeRow } from "@/lib/uscisQuarterlyShape";

function o(over: Partial<OfficeRow>): OfficeRow {
  return {
    state: "Washington", office: "Seattle WA", code: "SEA", suppressed: 0,
    famReceived: 1, famApproved: 1, famDenied: 0, famPending: 900,
    empReceived: 100, empApproved: 80, empDenied: 20, empPending: 500,
    humReceived: 0, humApproved: 0, humDenied: 0, humPending: 0,
    othReceived: 0, othApproved: 0, othDenied: 0, othPending: 0,
    allReceived: 0, allApproved: 0, allDenied: 0, allPending: 0,
    ...over,
  } as OfficeRow;
}

describe("OfficeTable", () => {
  it("puts every office on the page, busiest first", () => {
    render(
      <OfficeTable
        rows={[o({}), o({ office: "Tampa FL", code: "TAM", state: "Florida", empPending: 900 }), o({ office: "Nebraska Service Center", code: "NSC", state: "Service Center", empPending: 50 })]}
      />,
    );
    const names = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(names[0]).toContain("Tampa FL");
    expect(names).toHaveLength(3);
  });

  it("filters to service centers, and searches by code", () => {
    render(<OfficeTable rows={[o({}), o({ office: "Nebraska Service Center", code: "NSC", state: "Service Center" })]} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Kind/ }), { target: { value: "center" } });
    expect(screen.queryByText("Seattle WA")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: /Kind/ }), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Office, state or code"), { target: { value: "nsc" } });
    expect(screen.queryByText("Seattle WA")).not.toBeInTheDocument();
    expect(screen.getByText("Nebraska Service Center")).toBeInTheDocument();
  });

  it("gives quarters of work as a sortable column, and prints a withheld count as withheld", () => {
    const q = OFFICE_COLUMNS.find((c) => c.key === "quarters")!;
    expect(q.sortValue(o({}))).toBe(5);
    expect(q.sortValue(o({ empApproved: null }))).toBeNull();
    render(<OfficeTable rows={[o({ empApproved: null })]} />);
    expect(screen.getAllByText("withheld").length).toBeGreaterThan(0);
  });
});
