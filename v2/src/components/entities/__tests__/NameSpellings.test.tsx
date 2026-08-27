/**
 * The module that tells the reader what the rank does NOT count.
 *
 * The merge fixed most of DOL's spelling problem and deliberately refused
 * the rest, so the page has to say which is which. The failure mode is
 * over-claiming: a page that implies every spelling was pooled while
 * Fragomen still prints twenty ways is worse than one that says nothing.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NameVariant } from "@/lib/turso/entityDetail";

import { NameSpellings } from "../NameSpellings";

const VARIANTS: NameVariant[] = [
  { slug: "fragomen-del-rey-bernsen-lowey-llp", name: "Fragomen, Del Rey, Bernsen Lowey, LLP", total: 125 },
  { slug: "fragomen-chicago", name: "Fragomen - Chicago", total: 1 },
];

describe("NameSpellings", () => {
  it("renders nothing when there is neither a merge nor a near neighbour", () => {
    const { container } = render(
      <NameSpellings
        variants={[]}
        absorbed={0}
        subject="firm"
        hrefBase="/perm-attorneys"
        rank={1}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says how many spellings were folded in, rather than implying it", () => {
    render(
      <NameSpellings
        variants={[]}
        absorbed={3}
        subject="firm"
        hrefBase="/perm-attorneys"
        rank={1}
      />,
    );
    expect(screen.getByText(/3 other spellings of this name were folded/)).toBeInTheDocument();
    // With nothing left nearby, the page may say so, and only then.
    expect(screen.getByText(/Nothing else in the file starts the same way/)).toBeInTheDocument();
  });

  it("lists the spellings it did NOT merge and links each one", () => {
    render(
      <NameSpellings
        variants={VARIANTS}
        absorbed={3}
        subject="firm"
        hrefBase="/perm-attorneys"
        rank={1}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Fragomen, Del Rey, Bernsen Lowey, LLP/ }),
    ).toHaveAttribute("href", "/perm-attorneys/fragomen-del-rey-bernsen-lowey-llp");
    expect(screen.getByRole("link", { name: /Fragomen - Chicago/ })).toBeInTheDocument();
  });

  it("scopes the rank to this page's cases and totals the residue", () => {
    render(
      <NameSpellings
        variants={VARIANTS}
        absorbed={3}
        subject="firm"
        hrefBase="/perm-attorneys"
        rank={1}
      />,
    );
    expect(screen.getByText(/counts this page's cases only/)).toBeInTheDocument();
    // 125 + 1. The reader can see exactly how much sits elsewhere.
    expect(screen.getByText(/126 filings sit on those pages/)).toBeInTheDocument();
  });

  it("uses the singular when exactly one spelling was folded in", () => {
    render(
      <NameSpellings
        variants={[]}
        absorbed={1}
        subject="sponsor"
        hrefBase="/perm-employers"
        rank={9}
      />,
    );
    expect(screen.getByText(/1 other spelling of this name was folded/)).toBeInTheDocument();
  });
});
