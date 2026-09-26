import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PolicySearch, filterPolicy, type PolicyItem } from "../PolicySearch";

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

  it("shows the page as it was until something is asked, then only the matches", () => {
    render(
      <PolicySearch items={ITEMS}>
        <p>the full lists</p>
      </PolicySearch>,
    );
    expect(screen.getByText("the full lists")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search every document"), { target: { value: "flag" } });
    expect(screen.queryByText("the full lists")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FLAG launch" })).toHaveAttribute("href", ITEMS[2]!.url);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 documents match");
  });
});
