// @vitest-environment jsdom
/**
 * NoCasesYet Component Tests
 *
 * Tests essential behavior:
 * - Renders correct content (heading, description, icon)
 * - CTA links to /cases/new
 * - onAddCase callback works
 * - Accessibility requirements met
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook and manual QA.
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { NoCasesYet } from "../NoCasesYet";

describe("NoCasesYet", () => {
  describe("content", () => {
    it("renders heading, description, and icon", () => {
      const { container } = renderWithProviders(<NoCasesYet />);

      expect(
        screen.getByRole("heading", { name: /no cases yet/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/get started/i) ||
          screen.getByText(/add your first/i) ||
          screen.getByText(/track deadlines/i)
      ).toBeInTheDocument();
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("CTA button", () => {
    it("renders CTA link to /cases/new", () => {
      renderWithProviders(<NoCasesYet />);

      const ctaButton = screen.getByRole("link", {
        name: /add your first case|create.*case|get started/i,
      });
      expect(ctaButton).toHaveAttribute("href", "/cases/new");
    });

    it("calls onAddCase callback when provided", async () => {
      const user = userEvent.setup();
      const onAddCase = vi.fn();

      renderWithProviders(<NoCasesYet onAddCase={onAddCase} />);

      const ctaButton = screen.getByRole("button", {
        name: /add your first case|create.*case|get started/i,
      });
      await user.click(ctaButton);

      expect(onAddCase).toHaveBeenCalledTimes(1);
    });

    it("renders button instead of link when onAddCase is provided", () => {
      const onAddCase = vi.fn();

      renderWithProviders(<NoCasesYet onAddCase={onAddCase} />);

      const button = screen.getByRole("button", {
        name: /add your first case|create.*case|get started/i,
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has semantic heading (h2)", () => {
      const { container } = renderWithProviders(<NoCasesYet />);

      const heading = container.querySelector("h2");
      expect(heading).toBeInTheDocument();
      expect(heading?.textContent).toMatch(/no cases yet/i);
    });

    it("CTA is focusable", () => {
      renderWithProviders(<NoCasesYet />);

      const cta = screen.getByRole("link", {
        name: /add your first case|create.*case|get started/i,
      });
      expect(cta).not.toHaveAttribute("tabindex", "-1");
    });

    it("icon is decorative (aria-hidden)", () => {
      const { container } = renderWithProviders(<NoCasesYet />);

      const icon = container.querySelector("svg");
      expect(
        icon?.hasAttribute("aria-hidden") ||
          icon?.closest("[aria-hidden]") !== null
      ).toBe(true);
    });

    it("has test id for integration testing", () => {
      renderWithProviders(<NoCasesYet />);

      expect(screen.getByTestId("no-cases-yet")).toBeInTheDocument();
    });
  });
});
