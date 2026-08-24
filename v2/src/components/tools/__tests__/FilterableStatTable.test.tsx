import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { FilterableStatTable, type StatColumn } from "../FilterableStatTable";

interface Row {
  name: string;
  total: number;
}

const COLUMNS: StatColumn<Row>[] = [
  { key: "name", label: "Name", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "total", label: "Total", numeric: true, sortValue: (r) => r.total, render: (r) => String(r.total) },
];

const ROWS: Row[] = [
  { name: "Amazon", total: 300 },
  { name: "Google", total: 900 },
  { name: "Microsoft", total: 600 },
];

function bodyOrder(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1) // header
    .map((tr) => tr.textContent ?? "");
}

describe("FilterableStatTable", () => {
  it("sorts by the initial column, descending", () => {
    render(
      <FilterableStatTable
        rows={ROWS}
        columns={COLUMNS}
        searchText={(r) => r.name}
        searchPlaceholder="Find…"
        initialSort="total"
        caption="test table"
      />,
    );
    const order = bodyOrder();
    expect(order[0]).toContain("Google");
    expect(order[2]).toContain("Amazon");
  });

  it("filters and reports the visible count", () => {
    render(
      <FilterableStatTable
        rows={ROWS}
        columns={COLUMNS}
        searchText={(r) => r.name}
        searchPlaceholder="Find…"
        initialSort="total"
        caption="test table"
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "micro" } });
    expect(bodyOrder()).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 3")).toBeInTheDocument();
  });

  it("offers a way back from an empty filter", () => {
    render(
      <FilterableStatTable
        rows={ROWS}
        columns={COLUMNS}
        searchText={(r) => r.name}
        searchPlaceholder="Find…"
        initialSort="total"
        caption="test table"
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("re-sorts when a header is clicked, and flips on the second click", () => {
    render(
      <FilterableStatTable
        rows={ROWS}
        columns={COLUMNS}
        searchText={(r) => r.name}
        searchPlaceholder="Find…"
        initialSort="total"
        caption="test table"
      />,
    );
    const nameHeader = screen.getByRole("button", { name: /Name/ });
    fireEvent.click(nameHeader); // text column: ascending first
    expect(bodyOrder()[0]).toContain("Amazon");
    fireEvent.click(nameHeader);
    expect(bodyOrder()[0]).toContain("Microsoft");
  });
});
