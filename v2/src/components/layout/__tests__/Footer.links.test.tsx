// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import Footer from "../Footer";
import { LEGAL_NAME, NOT_LEGAL_SERVICES } from "@/lib/constants/about";
import { APP_FOOTER, FOOTER_COLUMNS, FOOTER_LEGAL } from "@/lib/siteMap";

/**
 * One footer component for the public site and the signed-in app (Oct 14
 * 2026): three columns and a legal line in public, one line in the app.
 * Every page, both audiences, says this isn't a law firm.
 */
describe("Footer", () => {
  for (const audience of ["public", "app"] as const) {
    it(`says this isn't a law firm, and whose site it is, for the ${audience} audience`, () => {
      renderWithProviders(<Footer audience={audience} />);
      expect(screen.getByText(NOT_LEGAL_SERVICES)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} ${LEGAL_NAME}`))).toBeInTheDocument();
    });

    it(`never offers sign in or sign up for the ${audience} audience (the header does that)`, () => {
      const { container } = renderWithProviders(<Footer audience={audience} />);
      expect(container.querySelector('a[href="/login"]')).toBeNull();
      expect(container.querySelector('a[href="/signup"]')).toBeNull();
    });
  }

  it("lays the public footer out as its three columns and the legal line", () => {
    renderWithProviders(<Footer />);
    for (const col of FOOTER_COLUMNS) {
      const nav = screen.getByRole("navigation", { name: col.title });
      for (const p of col.pages) expect(nav.querySelector(`a[href="${p.href}"]`), p.href).not.toBeNull();
    }
    const legal = screen.getByRole("navigation", { name: "Legal" });
    for (const p of FOOTER_LEGAL) expect(legal.querySelector(`a[href="${p.href}"]`), p.href).not.toBeNull();
    expect(screen.getByRole("link", { name: "PERM Tracker" })).toHaveAttribute("href", "/");
  });

  it("gives the signed-in app one line", () => {
    const { container } = renderWithProviders(<Footer audience="app" />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(APP_FOOTER.map((p) => p.href));
  });
});
