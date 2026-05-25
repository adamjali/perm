// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AuthFooter from "../AuthFooter";

describe("AuthFooter", () => {
  it("renders footer links with correct hrefs and copyright year", () => {
    renderWithProviders(<AuthFooter />);

    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");

    const contactLink = screen.getByRole("link", { name: /contact/i });
    expect(contactLink).toHaveAttribute("href", "/contact");

    const currentYear = new Date().getFullYear();
    // eslint-disable-next-line security/detect-non-literal-regexp -- interpolates the current year (a number) into a fixed string, not user input
    expect(screen.getByText(new RegExp(`© ${currentYear} PERM Tracker`, "i"))).toBeInTheDocument();
  });
});
