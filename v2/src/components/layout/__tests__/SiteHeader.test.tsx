// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ value: "/perm-employers" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/search/SiteSearch", () => ({ SiteSearch: () => null }));

import SiteHeader from "../SiteHeader";
import { GROUPS, LEARN_PAGES, SECTIONS } from "@/lib/siteMap";

/**
 * The public header (Oct 14 2026): five places, a search box and Sign in;
 * Data and Learn open panels whose links are always in the HTML.
 */
describe("SiteHeader", () => {
  it("names the site's main places", () => {
    pathname.value = "/";
    render(<SiteHeader />);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Case status", "Processing times", "Data", "Learn", "For attorneys"]) {
      expect(within(main).getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("keeps every Data and Learn link in the page while the menus are closed, out of the tab order", () => {
    pathname.value = "/";
    const { container } = render(<SiteHeader />);
    const data = container.querySelector("#data-menu")!;
    const learn = container.querySelector("#learn-menu")!;
    expect(data).toHaveAttribute("inert");
    expect(learn).toHaveAttribute("inert");
    for (const s of SECTIONS) expect(data.querySelector(`a[href="${s.href}"]`), s.href).not.toBeNull();
    for (const p of LEARN_PAGES) expect(learn.querySelector(`a[href="${p.href}"]`), p.href).not.toBeNull();
    // All six groups, side by side in one panel.
    for (const g of GROUPS) expect(within(data as HTMLElement).getByText(g)).toBeInTheDocument();
  });

  it("opens the Data menu on click and closes it with Escape", () => {
    pathname.value = "/";
    const { container } = render(<SiteHeader />);
    const button = screen.getByRole("button", { name: /^Data/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector("#data-menu")).not.toHaveAttribute("inert");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("marks Data as where you are on a data page", () => {
    pathname.value = "/perm-employers/adobe-inc";
    render(<SiteHeader />);
    expect(screen.getByRole("button", { name: /^Data/ }).className).toContain("font-semibold");
  });

  it("marks the current page link", () => {
    pathname.value = "/perm-case-status";
    render(<SiteHeader />);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Case status" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the phone menu as one sheet", () => {
    pathname.value = "/";
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    const sheet = screen.getByRole("navigation", { name: "Menu" });
    expect(within(sheet).getAllByRole("link", { name: "Case status" })[0]).toHaveAttribute("href", "/perm-case-status");
    expect(within(sheet).getByText("Data", { selector: "summary" })).toBeInTheDocument();
  });
});
