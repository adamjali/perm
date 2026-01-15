// @vitest-environment jsdom
/**
 * AuthFooter Component Tests
 *
 * Tests essential behavior:
 * - All footer links render with correct hrefs
 * - Contact link opens in new tab (security requirement)
 * - Copyright displays current year
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook and manual QA.
 */

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AuthFooter from "../AuthFooter";

describe("AuthFooter", () => {
  describe("links", () => {
    it("renders all footer links with correct hrefs", () => {
      renderWithProviders(<AuthFooter />);

      // Privacy link
      const privacyLink = screen.getByRole("link", { name: /privacy/i });
      expect(privacyLink).toHaveAttribute("href", "/privacy");

      // Terms link
      const termsLink = screen.getByRole("link", { name: /terms/i });
      expect(termsLink).toHaveAttribute("href", "/terms");

      // Contact link
      const contactLink = screen.getByRole("link", { name: /contact/i });
      expect(contactLink).toHaveAttribute("href", "/contact");
    });

    it("contact link opens in new tab with security attributes", () => {
      renderWithProviders(<AuthFooter />);

      const contactLink = screen.getByRole("link", { name: /contact/i });
      expect(contactLink).toHaveAttribute("target", "_blank");
      expect(contactLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("copyright", () => {
    it("displays copyright with current year", () => {
      renderWithProviders(<AuthFooter />);

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(new RegExp(`© ${currentYear} PERM Tracker`, "i"))
      ).toBeInTheDocument();
    });
  });
});
