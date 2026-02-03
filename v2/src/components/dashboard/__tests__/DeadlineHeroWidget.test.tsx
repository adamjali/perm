// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockDeadlineGroups,
  createEmptyDeadlineGroups,
} from "../../../../test-utils/deadline-fixtures";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

import { useQuery } from "convex/react";
import DeadlineHeroWidget from "../DeadlineHeroWidget";

vi.useFakeTimers();

describe("DeadlineHeroWidget", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.runOnlyPendingTimers());

  it("renders skeleton when data is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = renderWithProviders(<DeadlineHeroWidget />);
    expect(container.querySelectorAll('[class*="h-"]').length).toBeGreaterThan(0);
  });

  describe("with data", () => {
    beforeEach(() => vi.mocked(useQuery).mockReturnValue(createMockDeadlineGroups()));

    it("renders heading, total count badge, all 4 urgency groups, and refresh button", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByRole("heading", { name: /deadline hub/i })).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("Overdue")).toBeInTheDocument();
      expect(screen.getByText("This Week")).toBeInTheDocument();
      expect(screen.getByText("This Month")).toBeInTheDocument();
      expect(screen.getByText("Later")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });

    it("updates last refresh time and shows spinner on refresh click", () => {
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
      });

      expect(screen.getByText(/just now/i)).toBeInTheDocument();
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message and CTA when no deadlines", () => {
      vi.mocked(useQuery).mockReturnValue(createEmptyDeadlineGroups());
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
      expect(screen.getByText(/create a case/i)).toBeInTheDocument();
    });
  });
});
