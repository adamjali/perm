// @vitest-environment jsdom
/**
 * AddCaseButton Component Tests
 *
 * Tests essential behavior:
 * - Renders correct content (text + icon)
 * - Button navigation works
 * - Accessibility requirements met
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook and manual QA.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AddCaseButton from "../AddCaseButton";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
}));

describe("AddCaseButton", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("content", () => {
    it("renders Add New Case text and Plus icon", () => {
      const { container } = renderWithProviders(<AddCaseButton />);

      expect(screen.getByText(/add new case/i)).toBeInTheDocument();
      // Plus icon from lucide-react renders as SVG
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("button behavior", () => {
    it("is a button element", () => {
      renderWithProviders(<AddCaseButton />);

      const button = screen.getByRole("button", { name: /add new case/i });
      expect(button).toBeInTheDocument();
    });

    it("navigates to /cases/new when clicked", async () => {
      const { user } = renderWithProviders(<AddCaseButton />);

      const button = screen.getByRole("button", { name: /add new case/i });
      await user.click(button);

      expect(mockPush).toHaveBeenCalledWith("/cases/new");
    });
  });

  describe("accessibility", () => {
    it("has accessible name from text content", () => {
      renderWithProviders(<AddCaseButton />);

      const button = screen.getByRole("button", { name: /add new case/i });
      expect(button).toBeInTheDocument();
    });

    it("is keyboard accessible (not disabled)", () => {
      renderWithProviders(<AddCaseButton />);

      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();
    });
  });
});
