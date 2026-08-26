// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import Footer from "../Footer";

/**
 * There used to be a separate AuthFooter for /login, /signup and
 * /reset-password: a different, thinner footer on three pages, which is the
 * kind of inconsistency nobody notices until someone lands there from a
 * search result. One Footer now serves all three route groups, and these
 * assertions moved here with it.
 */
describe("Footer", () => {
  for (const variant of ["compact", "extended"] as const) {
    it(`carries the legal and contact links in the ${variant} variant`, () => {
      renderWithProviders(<Footer variant={variant} />);

      expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
      expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");
      expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute("href", "/contact");

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${currentYear} PERM Tracker`, "i"))).toBeInTheDocument();
    });
  }
});
