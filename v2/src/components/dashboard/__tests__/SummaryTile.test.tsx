// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import SummaryTile from "../SummaryTile";

const defaultProps = {
  status: "pwd" as const,
  label: "PWD",
  count: 5,
  subtext: "3 working, 2 filed",
  href: "/cases?status=pwd",
};

describe("SummaryTile", () => {
  it("renders label, count, subtext, and links to filtered cases", () => {
    renderWithProviders(<SummaryTile {...defaultProps} />);

    expect(screen.getByText("PWD")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3 working, 2 filed")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/cases?status=pwd");
  });

  it("renders gracefully with empty subtext and zero count", () => {
    renderWithProviders(
      <SummaryTile status="complete" label="Complete" count={0} subtext="" href="/cases?status=complete" />
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
