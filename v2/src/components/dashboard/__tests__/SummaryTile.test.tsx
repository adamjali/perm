// @vitest-environment jsdom
/**
 * SummaryTile Component Tests
 *
 * Tests essential behavior:
 * - Renders label, count, subtext, and link
 * - Links to filtered cases list
 * - Handles edge cases (empty subtext, zero/large counts)
 * - Accessibility requirements met
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling (colors, hover effects, shadows) verified via Storybook.
 */

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
  describe("content rendering", () => {
    it("renders label, count, and subtext", () => {
      renderWithProviders(<SummaryTile {...defaultProps} />);

      expect(screen.getByText("PWD")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("3 working, 2 filed")).toBeInTheDocument();
    });

    it("is a link to the filtered cases list", () => {
      renderWithProviders(<SummaryTile {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/cases?status=pwd");
    });
  });

  describe("edge cases", () => {
    it("renders empty subtext gracefully", () => {
      renderWithProviders(
        <SummaryTile
          status="complete"
          label="Complete"
          count={12}
          subtext=""
          href="/cases?status=complete"
        />
      );

      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });

    it("handles zero count", () => {
      renderWithProviders(
        <SummaryTile {...defaultProps} count={0} subtext="" />
      );

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("handles large counts (100+)", () => {
      renderWithProviders(
        <SummaryTile {...defaultProps} count={150} />
      );

      expect(screen.getByText("150")).toBeInTheDocument();
    });

    it("handles long subtext gracefully", () => {
      renderWithProviders(
        <SummaryTile
          {...defaultProps}
          subtext="15 prep, 3 RFI (overdue: 2), 2 filed (1 awaiting certification)"
        />
      );

      expect(screen.getByText(/15 prep/)).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("link has accessible name containing the label", () => {
      renderWithProviders(<SummaryTile {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link.textContent).toContain("PWD");
    });
  });
});
