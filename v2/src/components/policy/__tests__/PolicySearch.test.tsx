import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PolicySearch, filterPolicy, type PolicyItem } from "../PolicySearch";
import { policyFacets } from "@/lib/policySearch";

function item(over: Partial<PolicyItem>): PolicyItem {
  return {
    id: "2026-1", date: "2026-09-01", kind: "Final rule", title: "Prevailing wage levels",
    url: "https://www.federalregister.gov/d/2026-1", agencies: "Employment and Training Administration",
    text: "prevailing wage levels employment and training administration", commentsOpen: false, ...over,
  };
}

const ITEMS = [
  item({}),
  item({ id: "2026-2", kind: "Proposed rule", title: "H-1B weighted selection", text: "h-1b weighted selection uscis", commentsOpen: true }),
  item({ id: "oflc-1", date: "2019-03-02", kind: "OFLC", title: "FLAG launch", text: "flag launch" }),
];
const q = { text: "", kind: "", year: "", openOnly: false };
const facets = policyFacets(ITEMS);

describe("policy search", () => {
  it("matches every word, in any order, across title and agency", () => {
    expect(filterPolicy(ITEMS, { ...q, text: "wage prevailing" }).map((i) => i.id)).toEqual(["2026-1"]);
    expect(filterPolicy(ITEMS, { ...q, text: "training" })).toHaveLength(1);
  });

  it("filters by kind, year and an open comment window", () => {
    expect(filterPolicy(ITEMS, { ...q, kind: "OFLC" }).map((i) => i.id)).toEqual(["oflc-1"]);
    expect(filterPolicy(ITEMS, { ...q, year: "2019" })).toHaveLength(1);
    expect(filterPolicy(ITEMS, { ...q, openOnly: true }).map((i) => i.id)).toEqual(["2026-2"]);
  });

  it("the page carries only the box's parts: kinds, years newest first, the count", () => {
    expect(facets).toEqual({ kinds: ["Final rule", "OFLC", "Proposed rule"], years: ["2026", "2019"], anyOpen: true, count: 3 });
  });

  it("asks for the documents only once the box is used, and once", async () => {
    const load = vi.fn(async () => ITEMS);
    render(
      <PolicySearch facets={facets} load={load}>
        <p>the full lists</p>
      </PolicySearch>,
    );
    expect(load).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByLabelText("Search every document"));
    fireEvent.change(screen.getByLabelText("Search every document"), { target: { value: "flag" } });
    expect(await screen.findByRole("link", { name: "FLAG launch" })).toHaveAttribute("href", ITEMS[2]!.url);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shows the page as it was until something is asked, then only the matches", async () => {
    render(
      <PolicySearch facets={facets} load={async () => ITEMS}>
        <p>the full lists</p>
      </PolicySearch>,
    );
    expect(screen.getByText("the full lists")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search every document"), { target: { value: "flag" } });
    expect(screen.queryByText("the full lists")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "FLAG launch" })).toHaveAttribute("href", ITEMS[2]!.url);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 documents match");
  });

  it("says it's searching while the documents arrive, never that nothing matched", () => {
    render(
      <PolicySearch facets={facets} load={() => new Promise<PolicyItem[]>(() => {})}>
        <p>the full lists</p>
      </PolicySearch>,
    );
    fireEvent.change(screen.getByLabelText("Search every document"), { target: { value: "flag" } });
    expect(screen.getByRole("status")).toHaveTextContent("Searching 3 documents");
    expect(screen.getByRole("status")).not.toHaveTextContent("match");
  });

  it("a failed load says so and offers a retry that asks again", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(ITEMS);
    render(
      <PolicySearch facets={facets} load={load}>
        <p>the full lists</p>
      </PolicySearch>,
    );
    fireEvent.change(screen.getByLabelText("Search every document"), { target: { value: "flag" } });
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "FLAG launch" })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
