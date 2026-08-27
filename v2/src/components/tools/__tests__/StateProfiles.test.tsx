import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { StateConcentration, StateLeaders } from "../StateProfiles";
import type { StateProfile } from "@/lib/turso/states";

function profile(over: Partial<StateProfile> & { state: string }): StateProfile {
  return {
    total: 1000,
    decided: 950,
    denied: 30,
    withdrawn: 50,
    denialRate: 3.16,
    topOccupations: [{ key: "15-1252", label: "Software Developers", count: 250 }],
    topEmployers: [{ key: "acme-inc", label: "Acme Inc.", count: 100 }],
    topOccupationShare: 25,
    topEmployerShare: 10,
    ...over,
  };
}

const STATES: StateProfile[] = [
  profile({
    state: "AL",
    total: 4986,
    topOccupations: [
      { key: "51-3022", label: "Meat, Poultry, and Fish Cutters and Trimmers", count: 3127 },
    ],
    topEmployers: [
      { key: "consolidated-catfish-producers-llc", label: "Consolidated Catfish Producers, LLC", count: 2417 },
    ],
    topOccupationShare: 62.7,
    topEmployerShare: 48.5,
  }),
  profile({
    state: "WA",
    total: 15746,
    topOccupations: [{ key: "15-1252", label: "Software Developers", count: 6944 }],
    topEmployers: [{ key: "microsoft-corporation", label: "Microsoft Corporation", count: 5820 }],
    topOccupationShare: 44.1,
    topEmployerShare: 37,
  }),
  profile({
    state: "CA",
    total: 67742,
    topOccupationShare: 25.6,
    topEmployerShare: 3.7,
    topEmployers: [{ key: "apple-inc", label: "APPLE INC.", count: 2494 }],
  }),
  // No leader recorded. It must not appear in a ranking at all rather than
  // ranking at zero, which would read as "this state has no concentration".
  profile({
    state: "VI",
    total: 12,
    topOccupations: [],
    topEmployers: [],
    topOccupationShare: null,
    topEmployerShare: null,
    denialRate: null,
  }),
];

/**
 * `DataView` keeps BOTH views in the served HTML and hides one, so that a
 * crawler and a reader with no JavaScript still get the figures. Every query
 * below therefore has to be scoped to the visible half; an unscoped
 * `getByText` finds the same number twice and fails for the wrong reason.
 */
function visible(container: HTMLElement): HTMLElement {
  const shown = Array.from(container.querySelectorAll<HTMLElement>("div"))
    .filter((el) => el.hasAttribute("hidden") === false)
    .find((el) => el.previousElementSibling !== null && el.querySelector("ul,table"));
  if (!shown) throw new Error("no visible DataView pane");
  return shown;
}

describe("StateConcentration", () => {
  it("ranks by share and names the occupation behind each bar", () => {
    const { container } = render(<StateConcentration states={STATES} />);
    const pane = within(visible(container));
    expect(pane.getByText("62.7%")).toBeInTheDocument();
    expect(
      pane.getByText(/Meat, Poultry, and Fish Cutters and Trimmers/),
    ).toBeInTheDocument();
    // Alabama's share is the largest, so it leads.
    const shares = pane.getAllByText(/^\d+\.\d%$/).map((el) => el.textContent);
    expect(shares[0]).toBe("62.7%");
  });

  it("switches axis on click and shows the employer leader", () => {
    const { container } = render(<StateConcentration states={STATES} />);
    expect(
      within(visible(container)).queryByText("Microsoft Corporation"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /one employer/i }));
    const pane = within(visible(container));
    expect(pane.getByText("Microsoft Corporation")).toBeInTheDocument();
    // Alabama still leads on this axis at 48.5, ahead of Washington's 37.
    expect(pane.getByText("48.5%")).toBeInTheDocument();
  });

  it("prints the count behind every share", () => {
    // A share with no numerator is unauditable, and these run over states as
    // small as a dozen filings.
    const { container } = render(<StateConcentration states={STATES} />);
    expect(within(visible(container)).getByText("3,127 of 4,986")).toBeInTheDocument();
  });

  it("omits a state with no leader rather than ranking it at zero", () => {
    render(<StateConcentration states={STATES} />);
    // Absent from BOTH panes, not merely from the one on screen.
    expect(screen.queryByText("U.S. Virgin Islands")).not.toBeInTheDocument();
  });

  it("scales bars against 100 percent, not against the leader", () => {
    // Normalising to the largest bar would draw a 62.7% share as a full bar and
    // make every state look near-total.
    const { container } = render(<StateConcentration states={STATES} />);
    const fills = Array.from(
      container.querySelectorAll<HTMLElement>("div.bg-primary"),
    ).map((el) => el.style.width);
    expect(fills[0]).toBe("62.7%");
    expect(fills).not.toContain("100%");
  });
});

describe("StateLeaders", () => {
  it("links an employer through its slug, not its spelling", () => {
    // DOL writes the same firm several ways; the slug is what the entity page
    // resolves on, so the link has to use it even when this row shows a
    // different capitalisation.
    render(<StateLeaders states={STATES} />);
    const link = screen.getByRole("link", { name: "APPLE INC." });
    expect(link).toHaveAttribute("href", "/perm-employers/apple-inc");
  });

  it("says so plainly when a state records no leader", () => {
    render(<StateLeaders states={STATES} />);
    const rows = screen.getAllByText("Not recorded");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("carries every state, biggest first", () => {
    render(<StateLeaders states={STATES} />);
    const table = screen.getByRole("table");
    const first = within(table).getAllByRole("row")[1];
    expect(within(first!).getByText("California")).toBeInTheDocument();
  });
});
