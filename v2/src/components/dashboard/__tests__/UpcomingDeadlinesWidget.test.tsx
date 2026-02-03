// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockUpcomingDeadlines,
  createEmptyUpcomingDeadlines,
} from "../../../../test-utils/activity-fixtures";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "convex/react";
import UpcomingDeadlinesWidget from "../UpcomingDeadlinesWidget";

describe("UpcomingDeadlinesWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders skeleton when data is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
  });

  describe("with data", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockUpcomingDeadlines(5));
    });

    it("renders heading, count badge, deadline items, and calendar button", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(screen.getByRole("heading", { name: /next 30 days/i })).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getAllByText(/Deadline Co/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/PWD Expires/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /calendar/i })).toBeInTheDocument();
    });

    it("displays all items without truncation", () => {
      vi.mocked(useQuery).mockReturnValue(createMockUpcomingDeadlines(15));
      renderWithProviders(<UpcomingDeadlinesWidget />);
      expect(screen.getAllByText(/Deadline Co/i).length).toBe(15);
    });
  });

  describe("empty state", () => {
    it("shows empty message with heading and calendar button", () => {
      vi.mocked(useQuery).mockReturnValue(createEmptyUpcomingDeadlines());
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(screen.getByText(/no deadlines in next 30 days/i)).toBeInTheDocument();
      expect(screen.getByText(/you're all caught up!/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /next 30 days/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /calendar/i })).toBeInTheDocument();
    });
  });

  it("has semantic list structure and proper heading hierarchy", () => {
    vi.mocked(useQuery).mockReturnValue(createMockUpcomingDeadlines(3));
    const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);
    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /next 30 days/i }).tagName).toBe("H3");
  });
});
