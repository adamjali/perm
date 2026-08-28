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
  for (const audience of ["public", "app"] as const) {
    it(`carries the legal and contact links for the ${audience} audience`, () => {
      renderWithProviders(<Footer variant="extended" audience={audience} />);

      expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
      expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");
      expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute("href", "/contact");

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${currentYear} PERM Tracker`, "i"))).toBeInTheDocument();
    });
  }

  it("offers Sign In and Sign Up to a logged-out visitor", () => {
    renderWithProviders(<Footer variant="extended" audience="public" />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /sign up free/i })).toHaveAttribute("href", "/signup");
  });

  /**
   * The signed-in app renders this same footer. It used to advertise Sign In
   * and Sign Up Free on every page of the app, to people already signed in.
   */
  it("carries no auth links at all for the signed-in app", () => {
    const { container } = renderWithProviders(<Footer variant="extended" audience="app" />);

    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(container.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("defaults to the public audience when none is given", () => {
    renderWithProviders(<Footer variant="extended" />);

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  /**
   * Everything except the two auth links is shared, so the app footer must
   * lose exactly two links and nothing else.
   */
  it("differs from the public footer by exactly the two auth links", () => {
    const hrefs = (audience: "public" | "app") => {
      const { container, unmount } = renderWithProviders(
        <Footer variant="extended" audience={audience} />
      );
      const found = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      unmount();
      return found;
    };

    const publicHrefs = hrefs("public");
    const appHrefs = hrefs("app");

    expect(publicHrefs.filter((h) => !appHrefs.includes(h)).sort()).toEqual(["/login", "/signup"]);
    expect(appHrefs.filter((h) => !publicHrefs.includes(h))).toEqual([]);
  });
});
