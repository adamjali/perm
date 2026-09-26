import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DebarmentBrowser, filterDebarments, type DebarmentView } from "../DebarmentBrowser";

function d(over: Partial<DebarmentView>): DebarmentView {
  return {
    program: "perm", entity: "ACME LLC", entitySlug: "acme-llc", entityType: "Employer",
    location: "Austin, TX", startDate: "2025-01-01", endDate: "2027-01-01",
    violation: "Failure to comply with audit", citation: "20 CFR 656.31(f)",
    sourceUrl: "https://www.dol.gov/x", phase: "in-force", ...over,
  };
}

const ROWS = [
  d({}),
  d({ entity: "ZED FARMS", program: "h2a", startDate: "2026-11-01", endDate: "2027-10-31", phase: "upcoming", entityType: "Agent", violation: "Wage violation" }),
  d({ entity: "OLD CORP", startDate: "2020-01-01", endDate: "2021-01-01", phase: "ended", location: "Reno, NV" }),
];
const SECTIONS = [
  { program: "perm" as const, label: "PERM", sourceUrl: "https://x", emptyNote: "None." },
  { program: "h2a" as const, label: "H-2A", sourceUrl: "https://x", emptyNote: "None." },
];

describe("debarment filters", () => {
  it("searches the name, the place and the violation", () => {
    const q = { text: "", status: "" as const, type: "", sort: "start" as const };
    expect(filterDebarments(ROWS, { ...q, text: "reno" }).map((r) => r.entity)).toEqual(["OLD CORP"]);
    expect(filterDebarments(ROWS, { ...q, text: "wage" }).map((r) => r.entity)).toEqual(["ZED FARMS"]);
  });

  it("filters by today's status and by who was barred, and sorts three ways", () => {
    const q = { text: "", status: "" as const, type: "", sort: "start" as const };
    expect(filterDebarments(ROWS, { ...q, status: "upcoming" }).map((r) => r.entity)).toEqual(["ZED FARMS"]);
    expect(filterDebarments(ROWS, { ...q, type: "Agent" })).toHaveLength(1);
    expect(filterDebarments(ROWS, q).map((r) => r.entity)).toEqual(["ZED FARMS", "ACME LLC", "OLD CORP"]);
    expect(filterDebarments(ROWS, { ...q, sort: "end" })[0]?.entity).toBe("OLD CORP");
    expect(filterDebarments(ROWS, { ...q, sort: "name" })[0]?.entity).toBe("ACME LLC");
  });

  it("hides a program with nothing matching, and says when nothing does", () => {
    render(<DebarmentBrowser rows={ROWS} sections={SECTIONS} />);
    expect(screen.getByRole("heading", { name: "H-2A" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search the lists"), { target: { value: "acme" } });
    expect(screen.queryByRole("heading", { name: "H-2A" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search the lists"), { target: { value: "nobody" } });
    expect(screen.getByRole("status")).toHaveTextContent(/Nothing on DOL's lists matches/);
  });
});
