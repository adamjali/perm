/**
 * The facet modules carry the same small-n discipline as the rest of the
 * site, and one extra job: two facet rows can share a label because DOL
 * accepts two SOC vintages, so the code has to be printed.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FacetRow } from "@/lib/turso/entityDetail";

import { OccupationMix, PartyMix, StateMix } from "../FilingMakeup";

function facet(over: Partial<FacetRow> = {}): FacetRow {
  return {
    key: "software-developers",
    label: "Software Developers",
    code: "15-1252.00",
    n: 749,
    certified: 700,
    denied: 40,
    ...over,
  };
}

describe("OccupationMix", () => {
  it("leads with the dominant occupation and its share of the whole", () => {
    render(<OccupationMix rows={[facet()]} total={2490} />);
    expect(screen.getByRole("link", { name: "Software Developers" })).toHaveAttribute(
      "href",
      "/perm-wages/software-developers",
    );
    expect(screen.getByText(/30% of everything they file/)).toBeInTheDocument();
  });

  it("prints the rate once the decided count can carry one", () => {
    render(<OccupationMix rows={[facet()]} total={2490} />);
    // 700 certified of 740 decided, which is over the site-wide floor.
    expect(screen.getByText(/94\.6% approved/)).toBeInTheDocument();
  });

  it("withholds the rate below the floor and still prints the count", () => {
    render(
      <OccupationMix rows={[facet({ n: 4, certified: 3, denied: 1 })]} total={4} />,
    );
    // Three of four is not a 75% approval rate. It is four cases.
    expect(screen.queryByText(/approved/)).not.toBeInTheDocument();
    expect(screen.getByText(/4 filings/)).toBeInTheDocument();
  });

  it("prints the SOC code, because one job can appear under two vintages", () => {
    render(
      <OccupationMix
        rows={[
          facet({ key: "electronics-engineers-except-computer", code: "17-2072.00", n: 527 }),
          facet({
            key: "electronics-engineers-except-computer-2",
            label: "Electronics Engineers, Except Computer",
            code: "17-2072",
            n: 70,
          }),
        ]}
        total={2490}
      />,
    );
    // Two rows, identical label, different codes. Without the code printed
    // this reads as a duplicate-rendering bug rather than as DOL's own data.
    expect(screen.getByText(/SOC 17-2072\.00/)).toBeInTheDocument();
    expect(screen.getByText("17-2072")).toBeInTheDocument();
  });

  it("renders nothing when there are no rows", () => {
    const { container } = render(<OccupationMix rows={[]} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StateMix", () => {
  it("spells the state out and does not pretend the chip is tappable", () => {
    const { container } = render(
      <StateMix rows={[facet({ key: "CA", label: "CA", code: null, n: 1520 })]} total={2490} />,
    );
    expect(screen.getByText("California")).toBeInTheDocument();
    // `/perm-by-state` is one page, not a route per state. A chip styled as a
    // control that goes nowhere is worse than a chip that is plainly not one.
    expect(container.querySelectorAll("li a")).toHaveLength(0);
  });

  it("keeps the one link it does have pointed at the state map", () => {
    render(<StateMix rows={[facet({ key: "CA", label: "CA", code: null })]} total={2490} />);
    expect(screen.getByRole("link", { name: "state map" })).toHaveAttribute(
      "href",
      "/perm-by-state",
    );
  });
});

describe("PartyMix", () => {
  it("links each party to its own page and states the covered share", () => {
    render(
      <PartyMix
        rows={[facet({ key: "apple-inc", label: "APPLE INC.", code: null, n: 2800 })]}
        total={4000}
        title="Who they file for"
        note="The employers named on the most applications."
        hrefBase="/perm-employers"
      />,
    );
    expect(screen.getByRole("link", { name: "APPLE INC." })).toHaveAttribute(
      "href",
      "/perm-employers/apple-inc",
    );
    expect(screen.getByText(/2,800 of 4,000 filings, 70% of the\s+total/)).toBeInTheDocument();
  });

  it("renders a plain name when the party has no page to link to", () => {
    render(
      <PartyMix
        rows={[facet({ key: null, label: "SOME EMPLOYER", code: null, n: 12 })]}
        total={12}
        title="Who they file for"
        note="Note."
        hrefBase="/perm-employers"
      />,
    );
    expect(screen.queryByRole("link", { name: "SOME EMPLOYER" })).not.toBeInTheDocument();
    expect(screen.getByText("SOME EMPLOYER")).toBeInTheDocument();
  });
});
