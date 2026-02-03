// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockDashboardSummary,
  dashboardScenarios,
} from "../../../../test-utils/ui-fixtures";
import SummaryTilesGrid from "../SummaryTilesGrid";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "convex/react";

describe("SummaryTilesGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders skeleton when data is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = renderWithProviders(<SummaryTilesGrid />);

    expect(container.querySelectorAll(".h-36").length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText("Case Summary")).not.toBeInTheDocument();
  });

  describe("with data", () => {
    const mockData = createMockDashboardSummary();

    beforeEach(() => vi.mocked(useQuery).mockReturnValue(mockData));

    it("renders heading and all 6 status tiles with correct data", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("Case Summary")).toBeInTheDocument();

      // All status labels present
      for (const label of ["PWD", "Recruitment", "ETA 9089", "I-140", "Complete", "Closed"]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }

      // Subtext rendered
      expect(screen.getByText(mockData.pwd.subtext)).toBeInTheDocument();
      expect(screen.getByText(mockData.recruitment.subtext)).toBeInTheDocument();
    });

    it.each([
      ["pwd", "/cases?status=pwd"],
      ["recruitment", "/cases?status=recruitment"],
      ["eta9089", "/cases?status=eta9089"],
      ["i140", "/cases?status=i140"],
      ["closed", "/cases?status=closed"],
    ])("passes correct href for %s tile", (_status, href) => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);
      expect(container.querySelector(`a[href="${href}"]`)).toBeInTheDocument();
    });

    it("Complete tile links to /cases?status=i140&progress=approved", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);
      const wrapper = container.querySelector('[data-status="complete"]');
      expect(wrapper?.querySelector("a")).toHaveAttribute("href", "/cases?status=i140&progress=approved");
    });

    it("all tiles are accessible links with names", () => {
      renderWithProviders(<SummaryTilesGrid />);
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(7); // Total badge + 6 tiles
      links.forEach((link) => expect(link).toHaveAccessibleName());
    });
  });

  describe("data scenarios", () => {
    it("handles empty dashboard (all zeros)", () => {
      vi.mocked(useQuery).mockReturnValue(dashboardScenarios.empty);
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("PWD")).toBeInTheDocument();
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });

    it("handles high-volume dashboard (100+ cases)", () => {
      vi.mocked(useQuery).mockReturnValue(dashboardScenarios.highVolume);
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("subtext requirements (perm_flow.md)", () => {
    it.each([
      ["pwd", "4 working, 3 filed"],
      ["recruitment", "5 ready to start, 5 in progress"],
      ["eta9089", "3 prep, 2 RFI, 3 filed"],
      ["i140", "2 prep, 1 RFE, 3 filed"],
    ])("renders correct subtext format for %s", (status, subtext) => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({ [status]: { count: 7, subtext } })
      );
      renderWithProviders(<SummaryTilesGrid />);
      expect(screen.getByText(subtext)).toBeInTheDocument();
    });
  });
});
