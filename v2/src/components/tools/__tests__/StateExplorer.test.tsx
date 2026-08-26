import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  CENSUS_REGION,
  StateExplorer,
  StateStatTable,
  USStateMap,
  type StateStat,
} from "../USStateMap";

/**
 * The map's controls, tested by what they CHANGE.
 *
 * A metric selector that re-renders the same fills, or a floor that leaves a
 * twenty-case state shaded as though its rate were solid, would look and read
 * exactly like a working one. So every assertion here reads the rendered
 * `fill` or the rendered row, never the presence of a control.
 */

const CA: StateStat = {
  state: "CA", total: 1000, certified: 800, denied: 200, withdrawn: 0,
  medianDays: 400, medianAnnualWage: 150000,
};
const TX: StateStat = {
  state: "TX", total: 500, certified: 495, denied: 5, withdrawn: 0,
  medianDays: 380, medianAnnualWage: 120000,
};
/** Thin: 20 decided cases and a perfect record, which means almost nothing. */
const WY: StateStat = {
  state: "WY", total: 20, certified: 20, denied: 0, withdrawn: 0,
  medianDays: 300, medianAnnualWage: 90000,
};
/** A territory DOL records and the Albers composite can(?:’t|not) draw. */
const PR: StateStat = {
  state: "PR", total: 300, certified: 290, denied: 10, withdrawn: 0,
  medianDays: 470, medianAnnualWage: 40000,
};

const STATES = [CA, TX, WY, PR];

function fillOf(name: RegExp): string {
  return screen.getByRole("button", { name }).getAttribute("style") ?? "";
}

/**
 * The tint percentage a state is drawn at. Asserting on the ORDER of these
 * rather than on a literal is deliberate: the buckets are quantiles over the
 * states that carry a value, so which literal a state lands on depends on how
 * many states are in the fixture. The ordering is the claim the map makes.
 */
function mixOf(name: RegExp): number {
  const m = /var\(--primary\)\s+([\d.]+)%/.exec(fillOf(name));
  return m ? Number(m[1]) : Number.NaN;
}

describe("CENSUS_REGION", () => {
  it("covers every state the geometry can draw, plus the territories it cannot", () => {
    for (const abbr of ["CA", "NY", "TX", "IL", "DC", "AK", "HI"]) {
      expect(CENSUS_REGION[abbr]).toBeTruthy();
    }
    expect(CENSUS_REGION.PR).toBe("Territories");
  });
});

describe("USStateMap metric selector", () => {
  it("shades by filings first, darkest for the biggest filer", () => {
    render(<USStateMap states={STATES} />);
    expect(mixOf(/California/)).toBeGreaterThan(mixOf(/Texas/));
    expect(mixOf(/Texas/)).toBeGreaterThan(mixOf(/Wyoming/));
  });

  it("re-shades the map when the metric changes, and the order flips", () => {
    render(<USStateMap states={STATES} />);
    const beforeCa = mixOf(/California/);
    const beforeTx = mixOf(/Texas/);
    expect(beforeCa).toBeGreaterThan(beforeTx);

    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    // California approves 80%, Texas 99%. On approval rate the order reverses,
    // which is the only proof that the fills were recomputed at all.
    expect(mixOf(/Texas/)).toBeGreaterThan(mixOf(/California/));
  });

  it("names the metric and its range in the legend, so the scale is not a decoration", () => {
    render(<USStateMap states={STATES} />);
    // "Filings" also names an option and a panel figure, so the legend is
    // identified by the numbers only it carries.
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText(/4 of 4 shaded/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    // Wyoming is under the floor on a rate, so the range narrows to the three
    // that carry one and the legend says so.
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("99.0%")).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 shaded/)).toBeInTheDocument();
  });
});

describe("USStateMap population floor", () => {
  it("leaves a twenty-case state unshaded on a rate, rather than colouring noise", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    expect(fillOf(/Wyoming/)).toContain("data-none");
    expect(screen.getByText(/Fewer than 100 decided cases, not shaded/)).toBeInTheDocument();
  });

  it("shades it again when the floor is dropped, which is the control doing its job", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    expect(fillOf(/Wyoming/)).toContain("data-none");

    fireEvent.change(screen.getByRole("combobox", { name: /Min cases/ }), {
      target: { value: "0" },
    });
    // A perfect record over twenty cases now outranks California's 80% over a
    // thousand, which is exactly why the floor exists.
    expect(fillOf(/Wyoming/)).not.toContain("data-none");
    expect(mixOf(/Wyoming/)).toBeGreaterThan(mixOf(/California/));
  });

  it("never withholds a count, because a count over twenty cases is simply twenty", () => {
    render(<USStateMap states={STATES} />);
    // Metric is filings and the floor is at its default 100.
    expect(fillOf(/Wyoming/)).not.toContain("data-none");
    expect(screen.queryByText(/not shaded/)).not.toBeInTheDocument();
  });

  it("says in the panel why a state has no colour, rather than leaving it blank", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Wyoming/ }));
    expect(screen.getByText(/is withheld here/)).toBeInTheDocument();
    // The counts themselves are still on show.
    expect(screen.getByRole("heading", { name: "Wyoming" })).toBeInTheDocument();
  });
});

describe("USStateMap state selector", () => {
  it("pins the state chosen from the list, because a list is buttons and buttons select", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Go to/ }), {
      target: { value: "TX" },
    });
    expect(screen.getByRole("heading", { name: "Texas" })).toBeInTheDocument();
    expect(screen.getByText(/Pinned/)).toBeInTheDocument();
  });

  it("returns to the national view when the list is cleared", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Go to/ }), {
      target: { value: "TX" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Go to/ }), {
      target: { value: "" },
    });
    expect(screen.getByText("The whole country")).toBeInTheDocument();
  });

  it("only offers states the map can actually draw", () => {
    render(<USStateMap states={STATES} />);
    const go = screen.getByRole("combobox", { name: /Go to/ });
    expect(within(go).queryByRole("option", { name: "Puerto Rico" })).not.toBeInTheDocument();
    expect(within(go).getByRole("option", { name: "Texas" })).toBeInTheDocument();
  });

  it("puts the metric and its denominator in each state's accessible name", () => {
    render(<USStateMap states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Colour by/ }), {
      target: { value: "approval" },
    });
    expect(
      screen.getByRole("button", { name: /Texas: approval rate 99.0%, from 500 decided cases/ }),
    ).toBeInTheDocument();
  });
});

describe("StateStatTable", () => {
  it("carries the territories the map cannot draw", () => {
    render(<StateStatTable states={STATES} />);
    expect(screen.getByText(/Puerto Rico/)).toBeInTheDocument();
  });

  it("puts the denominator next to the rate, so no rate stands alone", () => {
    render(<StateStatTable states={STATES} />);
    const row = screen.getByText(/Wyoming/).closest("tr")!;
    // Trimmed: each cell carries a trailing separator space so that adjacent
    // cells do not read as one run to anything walking the DOM. Asserting a
    // cell's raw textContent including whitespace is brittle for no gain.
    const cells = within(row)
      .getAllByRole("cell")
      .map((c) => (c.textContent ?? "").trim());
    // #, State, Filings, Certified, Denied, Withdrawn, Decided, Approval, …
    expect(cells[6]).toBe("20");
    expect(cells[7]).toBe("100.0%");
  });

  it("filters by Census region", () => {
    render(<StateStatTable states={STATES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Region/ }), {
      target: { value: "West" },
    });
    expect(screen.getByText(/California/)).toBeInTheDocument();
    expect(screen.queryByText(/Texas/)).not.toBeInTheDocument();
  });

  it("re-sorts when a heading is pressed", () => {
    render(<StateStatTable states={STATES} />);
    const firstName = () =>
      within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[1]!.textContent;
    expect(firstName()).toContain("California");
    fireEvent.click(screen.getByRole("button", { name: /Median wage/ }));
    expect(firstName()).toContain("California");
    fireEvent.click(screen.getByRole("button", { name: /Median wage/ }));
    expect(firstName()).toContain("Puerto Rico");
  });
});

describe("StateExplorer", () => {
  it("runs the map and the table off one set of controls", () => {
    render(<StateExplorer states={STATES} />);
    // One metric select, one floor select, one state select. Two floors on a
    // page would be two answers to the same question.
    expect(screen.getAllByRole("combobox", { name: /Min cases/ })).toHaveLength(1);
    expect(screen.getAllByRole("combobox", { name: /Colour by/ })).toHaveLength(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
