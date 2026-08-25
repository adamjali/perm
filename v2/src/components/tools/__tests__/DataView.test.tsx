import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DataView, ScopeSelect } from "../DataView";
import { ViewToggle } from "../ViewToggle";

/**
 * THE POINT OF THIS FILE. A control that looks wired and is not renders
 * identically to one that works, and this codebase has shipped a filter bar, a
 * map panel and an FAQ with complete markup and no handler at all. So every
 * assertion here is about the rendered output CHANGING, never about a button
 * existing.
 *
 * The second subject is the crawler contract: both views are in the document
 * from the first render. A table fetched on demand is invisible to Google, and
 * "switch to table" would then be a promise the served HTML does not keep.
 */

function Fixture() {
  return (
    <DataView
      label="Test series"
      chart={<p>CHART BODY</p>}
      table={<p>TABLE BODY</p>}
    />
  );
}

describe("DataView", () => {
  it("puts BOTH views in the document, so a crawler reads the numbers either way", () => {
    render(<Fixture />);
    expect(screen.getByText("CHART BODY")).toBeInTheDocument();
    expect(screen.getByText("TABLE BODY")).toBeInTheDocument();
  });

  it("shows the chart and hides the table until the toggle is pressed", () => {
    render(<Fixture />);
    // `hidden` on a wrapper carrying no display class. A Tailwind display
    // utility on the same element would beat the attribute and leave a
    // "hidden" panel visible.
    expect(screen.getByText("CHART BODY").parentElement).not.toHaveAttribute("hidden");
    expect(screen.getByText("TABLE BODY").parentElement).toHaveAttribute("hidden");
  });

  it("actually swaps which view is displayed when the toggle is pressed", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByText("CHART BODY").parentElement).toHaveAttribute("hidden");
    expect(screen.getByText("TABLE BODY").parentElement).not.toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Chart" }));
    expect(screen.getByText("CHART BODY").parentElement).not.toHaveAttribute("hidden");
  });

  it("reports the current view to assistive technology", () => {
    render(<Fixture />);
    expect(screen.getByRole("button", { name: "Chart" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders the scoping controls it is handed", () => {
    render(
      <DataView
        label="Test series"
        chart={<p>CHART BODY</p>}
        table={<p>TABLE BODY</p>}
        controls={<p>CONTROL SLOT</p>}
      />,
    );
    expect(screen.getByText("CONTROL SLOT")).toBeInTheDocument();
  });
});

describe("ViewToggle", () => {
  it("calls back with the value that was pressed, not merely that something was", () => {
    const seen: string[] = [];
    render(
      <ViewToggle
        label="Test"
        value="a"
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onChange={(v) => seen.push(v)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(seen).toEqual(["b"]);
  });

  it("gives every option a 44px tap target", () => {
    render(
      <ViewToggle
        label="Test"
        value="a"
        options={[{ value: "a", label: "Alpha" }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Alpha" }).className).toContain(
      "min-h-[44px]",
    );
  });
});

describe("ScopeSelect", () => {
  it("reports the value chosen, so a caller cannot mistake it for a display-only control", () => {
    const seen: string[] = [];
    render(
      <ScopeSelect
        label="Min cases"
        value="100"
        onChange={(v) => seen.push(v)}
        options={[
          { value: "100", label: "100+" },
          { value: "500", label: "500+" },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "500" } });
    expect(seen).toEqual(["500"]);
  });

  it("keeps the visible label at the front of the accessible name when a hint is given", () => {
    render(
      <ScopeSelect
        label="Min cases"
        value="100"
        hint="Hides thin groups."
        onChange={() => {}}
        options={[{ value: "100", label: "100+" }]}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Min cases. Hides thin groups." }),
    ).toBeInTheDocument();
  });
});
