import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseNotFound } from "../CaseNotFound";
import { DolUnanswered } from "../DolUnanswered";

const base = {
  caseNumber: "G-100-26125-868956",
  parsed: null,
  cohort: null,
  wall: null,
  neighbours: [],
  publishedFront: null,
  publishedAsOf: null,
  mirrorSize: 426112,
};

describe("a lookup DOL could not settle never reads as \"no record\" (Sep 29 2026)", () => {
  it("says DOL didn't answer, with a retry, when DOL timed out", () => {
    render(<CaseNotFound {...base} dolMiss="unavailable" />);
    expect(screen.getByText("DOL didn't answer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/perm-case-status?case=G-100-26125-868956");
    expect(screen.queryByText("Not in our records")).toBeNull();
  });

  it("keeps the ordinary 'not in our records' when DOL answered without it", () => {
    render(<CaseNotFound {...base} dolMiss="none" />);
    expect(screen.getByText("Not in our records")).toBeInTheDocument();
  });

  it("the wage-request and LCA notice says which of the two happened", () => {
    const { rerender } = render(<DolUnanswered caseNumber="P-100-26161-003499" label="Prevailing wage request" miss="unavailable" />);
    expect(screen.getByRole("heading", { name: "DOL didn't answer" })).toBeInTheDocument();
    rerender(<DolUnanswered caseNumber="P-100-26161-003499" label="Prevailing wage request" miss="not-asked" />);
    expect(screen.getByRole("heading", { name: "Not checked with DOL" })).toBeInTheDocument();
  });
});
