// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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
import { getFunctionName } from "convex/server";
import DeadlineHeroWidget from "../DeadlineHeroWidget";

describe("DeadlineHeroWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders skeleton when data is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = renderWithProviders(<DeadlineHeroWidget />);
    expect(container.querySelectorAll('[class*="h-"]').length).toBeGreaterThan(0);
  });

  describe("with data", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockImplementation(((fn: unknown) =>
        getFunctionName(fn as never) === "dashboard:getSummary" ? undefined : createMockDeadlineGroups()) as never);
    });

    it("renders the heading with its total, the four groups and a calendar link", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Deadlines");
      expect(heading).toHaveTextContent("8");
      for (const group of ["Overdue", "This week", "This month", "Later"]) {
        expect(screen.getByRole("heading", { level: 3, name: new RegExp(`^${group}`) })).toBeInTheDocument();
      }
      expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    });

    it("leads with the late deadlines, then the next one", () => {
      renderWithProviders(<DeadlineHeroWidget />);
      expect(screen.getByText(/^2 deadlines are late/)).toBeInTheDocument();
      expect(screen.getByText(/Next: .*in 2 days/)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    const summaryWith = (open: number) => ({
      pwd: { count: open },
      recruitment: { count: 0 },
      eta9089: { count: 0 },
      i140: { count: 0 },
      complete: { count: 0 },
      closed: { count: 3 },
      duplicates: { count: 0 },
    });
    function answer(summary: unknown) {
      vi.mocked(useQuery).mockImplementation(((fn: unknown) =>
        getFunctionName(fn as never) === "dashboard:getSummary"
          ? summary
          : createEmptyDeadlineGroups()) as never);
    }

    it("asks an account with no cases to add one", () => {
      answer(summaryWith(0));
      renderWithProviders(<DeadlineHeroWidget />);
      expect(screen.getByText(/^Add a case and its deadlines appear here/)).toBeInTheDocument();
    });

    it("tells an account with open cases that nothing is due, not to add one", () => {
      answer(summaryWith(44));
      renderWithProviders(<DeadlineHeroWidget />);
      expect(screen.getByText(/^Nothing is due on your 44 open cases/)).toBeInTheDocument();
      expect(screen.queryByText(/add a case/i)).not.toBeInTheDocument();
    });

    it("says nothing about cases while the summary loads", () => {
      answer(undefined);
      renderWithProviders(<DeadlineHeroWidget />);
      expect(screen.queryByText(/open cases/i)).not.toBeInTheDocument();
    });
  });
});
